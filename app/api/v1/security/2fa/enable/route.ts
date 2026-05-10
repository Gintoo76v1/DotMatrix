import { getAuthUser, unauthorized } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { users } from '@/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { logAction } from '@/lib/audit';

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { factorId, code } = await req.json();
  if (!factorId || !code) {
    return Response.json({ error: 'factorId and code are required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) return Response.json({ error: challengeError.message }, { status: 400 });

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    if (verifyError) return Response.json({ error: verifyError.message }, { status: 400 });

    await db.update(users).set({ twoFactorEnabled: true }).where(eq(users.id, user.id));
    await logAction(user.id, 'auth.2fa_enabled', 'users', user.id);

    return Response.json({ message: '2FA enabled successfully' });
  } catch {
    return Response.json({ error: 'Failed to enable 2FA' }, { status: 500 });
  }
}
