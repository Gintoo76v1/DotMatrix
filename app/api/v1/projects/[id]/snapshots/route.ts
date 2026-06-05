import { getAuthUser, hasPermission, unauthorized, forbidden } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, projectSnapshots } from '@/server/db/schema.js';
import { and, eq, desc } from 'drizzle-orm';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  if (!(await hasPermission(user.id, 'projects.read.own'))) return forbidden();

  const { id } = await params;
  try {
    // Verify the project belongs to the requesting user before exposing its history.
    const owned = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.ownerId, user.id)))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!owned) return Response.json({ error: 'Project not found' }, { status: 404 });

    const snaps = await db
      .select({
        id: projectSnapshots.id,
        version: projectSnapshots.version,
        createdAt: projectSnapshots.createdAt,
      })
      .from(projectSnapshots)
      .where(eq(projectSnapshots.projectId, id))
      .orderBy(desc(projectSnapshots.version));

    return Response.json({ snapshots: snaps });
  } catch {
    return Response.json({ error: 'Failed to fetch snapshots' }, { status: 500 });
  }
}
