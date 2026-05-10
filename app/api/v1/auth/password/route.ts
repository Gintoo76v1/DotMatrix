import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { logAction } from '@/lib/audit';

export async function PATCH(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { newPassword } = await req.json();
    if (!newPassword || newPassword.length < 8) {
      return Response.json({ error: 'Passwort muss mindestens 8 Zeichen haben.' }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    await logAction(user.id, 'auth.password_change', 'users', user.id);
    return Response.json({ message: 'Passwort erfolgreich geändert.' });
  } catch {
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
