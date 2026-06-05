import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { users } from '@/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { headers } from 'next/headers';
import { logAction } from '@/lib/audit';
import { readJson } from '@/lib/validate';
import { isRateLimited, recordAttempt, clientIp } from '@/lib/rate-limit';

const LoginSchema = z.object({
  usernameOrEmail: z.string().min(1).max(255),
  password: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  try {
    const ip = clientIp(await headers());
    if (await isRateLimited('login', ip, { max: 10, windowSec: 900 })) {
      return Response.json(
        { error: 'Zu viele Versuche – bitte einen Moment warten.' },
        { status: 429 }
      );
    }

    const parsed = await readJson(req, LoginSchema);
    if (!parsed.ok) return parsed.response;
    const { usernameOrEmail, password } = parsed.data;

    // Resolve email from username if needed
    let email = usernameOrEmail;
    if (!usernameOrEmail.includes('@')) {
      const profile = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.username, usernameOrEmail))
        .limit(1)
        .then((r) => r[0] ?? null);

      if (!profile?.email) {
        await recordAttempt('login', ip);
        return Response.json({ error: 'Invalid credentials' }, { status: 401 });
      }
      email = profile.email;
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      await recordAttempt('login', ip);
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Check profile status
    const profile = await db
      .select()
      .from(users)
      .where(eq(users.id, data.user.id))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (profile?.status !== 'active') {
      await supabase.auth.signOut();
      return Response.json({ error: 'Account is not active' }, { status: 403 });
    }

    // Update last login
    await db
      .update(users)
      .set({ lastLoginAt: new Date(), lastActiveAt: new Date() })
      .where(eq(users.id, data.user.id));

    await logAction(data.user.id, 'auth.login', 'users', data.user.id);

    return Response.json({
      message: 'Login successful',
      user: { id: data.user.id, username: profile?.username },
    });
  } catch {
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
