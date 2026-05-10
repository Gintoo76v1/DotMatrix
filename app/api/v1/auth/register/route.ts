import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { db } from '@/lib/db';
import { users, inviteCodes, inviteRedemptions } from '@/server/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { logAction } from '@/lib/audit';
import { headers } from 'next/headers';

export async function POST(req: Request) {
  try {
    const { inviteCode, username, email, password, displayName } = await req.json();

    if (!inviteCode || !username || !email || !password) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (password.length < 8) {
      return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return Response.json({ error: 'Invalid username format' }, { status: 400 });
    }

    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for') ?? 'unknown';
    const userAgent = headersList.get('user-agent') ?? '';

    // 1. Verify invite code
    const invite = await db
      .select()
      .from(inviteCodes)
      .where(eq(inviteCodes.code, inviteCode))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!invite) return Response.json({ error: 'Invalid invite code' }, { status: 400 });
    if (invite.isRevoked) return Response.json({ error: 'Invite code revoked' }, { status: 400 });
    if (invite.expiresAt && new Date() > invite.expiresAt) {
      return Response.json({ error: 'Invite code expired' }, { status: 400 });
    }
    if ((invite.usedCount ?? 0) >= (invite.maxUses ?? 1)) {
      return Response.json({ error: 'Invite code fully used' }, { status: 400 });
    }

    // 2. Create Supabase Auth user (email confirmed immediately)
    const adminClient = createAdminClient();
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, display_name: displayName },
    });

    if (authError || !authData.user) {
      if (authError?.message?.includes('already registered')) {
        return Response.json({ error: 'Email already exists' }, { status: 409 });
      }
      return Response.json({ error: authError?.message ?? 'Registration failed' }, { status: 400 });
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

      // 4. Update invite usage + log redemption
      await db
        .update(inviteCodes)
        .set({ usedCount: sql`${inviteCodes.usedCount} + 1` })
        .where(eq(inviteCodes.id, invite.id));

      await db.insert(inviteRedemptions).values({
        inviteCodeId: invite.id,
        userId: authUserId,
        ipAddress: ip,
        userAgent,
      });

      await logAction(authUserId, 'auth.register', 'users', authUserId, { username }, ip);
    } catch (dbErr: unknown) {
      // Rollback: delete the Supabase Auth user if DB insert failed
      await adminClient.auth.admin.deleteUser(authUserId);
      const msg = dbErr instanceof Error ? dbErr.message : '';
      if (msg.includes('unique') || msg.includes('23505')) {
        return Response.json({ error: 'Username already exists' }, { status: 409 });
      }
      throw dbErr;
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
