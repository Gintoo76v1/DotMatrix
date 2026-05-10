import { getAuthUser, hasPermission, unauthorized, forbidden } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { logAction } from '@/lib/audit';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  if (!(await hasPermission(user.id, 'users.update.any'))) return forbidden();

  const { id } = await params;
  const { status } = await req.json();

  if (!['active', 'suspended'].includes(status)) {
    return Response.json({ error: 'Invalid status' }, { status: 400 });
  }
  if (status === 'suspended' && id === user.id) {
    return Response.json({ error: 'You cannot suspend yourself' }, { status: 400 });
  }

  try {
    const [updated] = await db
      .update(users)
      .set({ status, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    if (!updated) return Response.json({ error: 'User not found' }, { status: 404 });

    await logAction(user.id, 'user.status_update', 'users', id, { status });
    return Response.json({ message: `User status updated to ${status}`, user: updated });
  } catch {
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
