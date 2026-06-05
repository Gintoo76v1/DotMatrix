import { getAuthUser, hasPermission, unauthorized, forbidden } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, projectSnapshots } from '@/server/db/schema.js';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { logAction } from '@/lib/audit';
import { readJson, jsonObject } from '@/lib/validate';

const UpdateProjectSchema = z.object({
  version: z.number().int().nonnegative(),
  contentJson: jsonObject,
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  if (!(await hasPermission(user.id, 'projects.write.own'))) return forbidden();

  const { id } = await params;
  const parsed = await readJson(req, UpdateProjectSchema);
  if (!parsed.ok) return parsed.response;
  const { contentJson, version } = parsed.data;

  try {
    const project = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.ownerId, user.id)))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });
    if (project.version !== version) {
      return Response.json({ error: 'Conflict: Version mismatch' }, { status: 409 });
    }

    const [updated] = await db
      .update(projects)
      .set({ contentJson, version: version + 1, updatedAt: new Date() })
      .where(and(eq(projects.id, id), eq(projects.ownerId, user.id), eq(projects.version, version)))
      .returning();

    if (!updated) {
      return Response.json({ error: 'Conflict: Version mismatch during update' }, { status: 409 });
    }

    if ((updated.version ?? 0) % 5 === 0) {
      await db.insert(projectSnapshots).values({
        projectId: id,
        contentJson,
        version: updated.version ?? 0,
        createdBy: user.id,
      });
    }

    return Response.json({ project: updated });
  } catch {
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  if (!(await hasPermission(user.id, 'projects.delete.own'))) return forbidden();

  const { id } = await params;
  try {
    const project = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.ownerId, user.id)))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

    await db.delete(projectSnapshots).where(eq(projectSnapshots.projectId, id));
    await db.delete(projects).where(eq(projects.id, id));

    await logAction(user.id, 'project.delete', 'projects', id);
    return Response.json({ message: 'Project deleted' });
  } catch {
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
