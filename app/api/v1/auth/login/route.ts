import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { users } from '@/server/db/schema.js';
import { or, eq } from 'drizzle-orm';
import { logAction } from '@/lib/audit';

export async function POST(req: Request) {
  try {
    const { usernameOrEmail, password } = await req.json();

    if (!usernameOrEmail || !password) {
      return Response.json({ error: 'Missing credentials' }, { status: 400 });
    }

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
        return Response.json({ error: 'Invalid credentials' }, { status: 401 });
      }
      email = profile.email;
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
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
