import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { db } from '@/lib/db';
import { users, inviteCodes, inviteRedemptions } from '@/server/db/schema.js';
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { logAction } from '@/lib/audit';
import { headers } from 'next/headers';
import { readJson } from '@/lib/validate';
import { isRateLimited, recordAttempt, clientIp } from '@/lib/rate-limit';

const RegisterSchema = z.object({
  inviteCode: z.string().min(1).max(50),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid username format'),
  email: z.string().email('Invalid email').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  displayName: z.string().max(100).nullish(),
});

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const ip = clientIp(headersList);
    const userAgent = headersList.get('user-agent') ?? '';

    if (await isRateLimited('register', ip, { max: 10, windowSec: 3600 })) {
      return Response.json(
        { error: 'Zu viele Versuche – bitte einen Moment warten.' },
        { status: 429 }
      );
    }
    await recordAttempt('register', ip);

    const parsed = await readJson(req, RegisterSchema);
    if (!parsed.ok) return parsed.response;
    const { inviteCode, username, email, password, displayName } = parsed.data;

    // 1. Atomically claim one invite slot — prevents a race past maxUses when two
    //    registrations use the same code concurrently.
    const claimed = await db
      .update(inviteCodes)
      .set({ usedCount: sql`COALESCE(${inviteCodes.usedCount}, 0) + 1` })
      .where(
        and(
          eq(inviteCodes.code, inviteCode),
          eq(inviteCodes.isRevoked, false),
          sql`COALESCE(${inviteCodes.usedCount}, 0) < COALESCE(${inviteCodes.maxUses}, 1)`,
          or(isNull(inviteCodes.expiresAt), gt(inviteCodes.expiresAt, new Date()))
        )
      )
      .returning();

    const invite = claimed[0] ?? null;
    if (!invite) {
      return Response.json({ error: 'Invalid or expired invite code' }, { status: 400 });
    }

    // Compensating action if anything after the claim fails.
    const releaseInvite = async () => {
      try {
        await db
          .update(inviteCodes)
          .set({ usedCount: sql`GREATEST(COALESCE(${inviteCodes.usedCount}, 1) - 1, 0)` })
          .where(eq(inviteCodes.id, invite.id));
      } catch {
        /* best effort */
      }
    };

    // 2. Create Supabase Auth user (email confirmed immediately)
    const adminClient = createAdminClient();
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, display_name: displayName },
    });

    if (authError || !authData.user) {
      await releaseInvite();
      if (authError?.message?.toLowerCase().includes('already registered')) {
        return Response.json({ error: 'Email already exists' }, { status: 409 });
      }
      return Response.json({ error: 'Registration failed' }, { status: 400 });
    }

    const authUserId = authData.user.id;

    try {
      // 3. Create profile in users table
      await db.insert(users).values({
        id: authUserId,
        username,
        email,
        displayName: displayName || null,
        roleId: invite.roleId,
        status: 'active',
      });

      // 4. Log redemption (the slot was already claimed atomically above)
      await db.insert(inviteRedemptions).values({
        inviteCodeId: invite.id,
        userId: authUserId,
        ipAddress: ip,
        userAgent,
      });

      await logAction(authUserId, 'auth.register', 'users', authUserId, { username }, ip);
    } catch (dbErr: unknown) {
      // Rollback: delete the Supabase Auth user and release the invite slot.
      await adminClient.auth.admin.deleteUser(authUserId);
      await releaseInvite();
      const msg = dbErr instanceof Error ? dbErr.message : '';
      if (msg.includes('unique') || msg.includes('23505')) {
        return Response.json({ error: 'Username already exists' }, { status: 409 });
      }
      return Response.json({ error: 'Registration failed' }, { status: 400 });
    }

    // 5. Sign in the newly created user to establish session
    const supabase = await createClient();
    await supabase.auth.signInWithPassword({ email, password });

    return Response.json(
      { message: 'Registration successful', user: { id: authUserId, username } },
      { status: 201 }
    );
  } catch {
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
