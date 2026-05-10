import { getAuthUser, hasPermission, unauthorized, forbidden } from '@/lib/auth';
import { db } from '@/lib/db';
import { inviteCodes } from '@/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { logAction } from '@/lib/audit';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  if (!(await hasPermission(user.id, 'invites.revoke'))) return forbidden();

  const { id } = await params;
  try {
    const [invite] = await db
      .update(inviteCodes)
      .set({ isRevoked: true })
      .where(eq(inviteCodes.id, id))
      .returning();

    if (!invite) return Response.json({ error: 'Invite not found' }, { status: 404 });

    await logAction(user.id, 'invite.revoke', 'invite_codes', invite.id);
    return Response.json({ message: 'Invite revoked successfully', invite });
  } catch {
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
