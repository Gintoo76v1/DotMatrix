import { getAuthUser, hasPermission, unauthorized, forbidden } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, projectSnapshots } from '@/server/db/schema.js';
import { and, eq } from 'drizzle-orm';
import { logAction } from '@/lib/audit';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; snapId: string }> }
) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  if (!(await hasPermission(user.id, 'projects.write.own'))) return forbidden();

  const { id, snapId } = await params;
  try {
    const snap = await db
      .select()
      .from(projectSnapshots)
      .where(and(eq(projectSnapshots.id, snapId), eq(projectSnapshots.projectId, id)))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!snap) return Response.json({ error: 'Snapshot not found' }, { status: 404 });

    const [updated] = await db
      .update(projects)
      .set({ contentJson: snap.contentJson, version: snap.version + 1, updatedAt: new Date() })
      .where(and(eq(projects.id, id), eq(projects.ownerId, user.id)))
      .returning();

    if (!updated) return Response.json({ error: 'Project not found' }, { status: 404 });

    await logAction(user.id, 'project.restore_snapshot', 'projects', updated.id, { snapshotId: snap.id });

    return Response.json({ project: updated });
  } catch {
    return Response.json({ error: 'Failed to restore snapshot' }, { status: 500 });
  }
}
