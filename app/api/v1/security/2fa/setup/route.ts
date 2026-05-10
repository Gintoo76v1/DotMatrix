import { getAuthUser, unauthorized } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const supabase = await createClient();

    // Unenroll any existing unverified TOTP factors first to avoid duplicates
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const unverified = factors?.all?.find((f) => f.factor_type === 'totp' && f.status === 'unverified');
    if (unverified) {
      await supabase.auth.mfa.unenroll({ factorId: unverified.id });
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'DotMatrix Studio',
    });

    if (error) return Response.json({ error: error.message }, { status: 400 });

    return Response.json({
      factorId: data.id,
      qrDataUrl: data.totp.qr_code,
      secret: data.totp.secret,
    });
  } catch {
    return Response.json({ error: '2FA setup failed' }, { status: 500 });
  }
}
