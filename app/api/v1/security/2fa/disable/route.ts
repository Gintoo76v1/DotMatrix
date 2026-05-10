import { getAuthUser, unauthorized } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { users } from '@/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { logAction } from '@/lib/audit';

export async function POST() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const supabase = await createClient();

    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totpFactor = factors?.totp?.find((f) => f.status === 'verified');

    if (!totpFactor) {
      return Response.json({ error: '2FA is not enabled' }, { status: 400 });
    }

    const { error } = await supabase.auth.mfa.unenroll({ factorId: totpFactor.id });
    if (error) return Response.json({ error: error.message }, { status: 400 });

    await db.update(users).set({ twoFactorEnabled: false }).where(eq(users.id, user.id));
    await logAction(user.id, 'auth.2fa_disabled', 'users', user.id);

    return Response.json({ message: '2FA disabled successfully' });
  } catch {
    return Response.json({ error: 'Failed to disable 2FA' }, { status: 500 });
  }
}
