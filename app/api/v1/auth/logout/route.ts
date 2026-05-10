import { createClient } from '@/lib/supabase/server';
import { logAction } from '@/lib/audit';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      await logAction(user.id, 'auth.logout', 'users', user.id);
    }

    await supabase.auth.signOut();

    return Response.json({ message: 'Logged out successfully' });
  } catch {
    return Response.json({ error: 'Logout failed' }, { status: 500 });
  }
}
