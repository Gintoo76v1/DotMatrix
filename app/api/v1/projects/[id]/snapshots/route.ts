import { getAuthUser, hasPermission, unauthorized, forbidden } from '@/lib/auth';
import { db } from '@/lib/db';
import { projectSnapshots } from '@/server/db/schema.js';
import { eq, desc } from 'drizzle-orm';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  if (!(await hasPermission(user.id, 'projects.read.own'))) return forbidden();

  const { id } = await params;
  try {
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
