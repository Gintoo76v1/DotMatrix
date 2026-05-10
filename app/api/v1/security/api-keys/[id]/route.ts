import { getAuthUser, unauthorized } from '@/lib/auth';
import { db } from '@/lib/db';
import { apiKeys } from '@/server/db/schema.js';
import { and, eq } from 'drizzle-orm';
import { logAction } from '@/lib/audit';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { id } = await params;
  try {
    const [deleted] = await db
      .delete(apiKeys)
      .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, user.id)))
      .returning();

    if (!deleted) return Response.json({ error: 'Key not found' }, { status: 404 });

    await logAction(user.id, 'security.api_key_revoked', 'api_keys', id);
    return Response.json({ message: 'API key revoked' });
  } catch {
    return Response.json({ error: 'Failed to revoke API key' }, { status: 500 });
  }
}
