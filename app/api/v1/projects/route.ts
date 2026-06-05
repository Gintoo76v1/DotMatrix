import { getAuthUser, hasPermission, unauthorized, forbidden } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects } from '@/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { readJson, jsonObject } from '@/lib/validate';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  if (!(await hasPermission(user.id, 'projects.read.own'))) return forbidden();

  try {
    const userProjects = await db.select().from(projects).where(eq(projects.ownerId, user.id));
    return Response.json({ projects: userProjects });
  } catch {
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

const CreateProjectSchema = z.object({
  name: z.string().min(1, 'name is required').max(255),
  contentJson: jsonObject.optional(),
});

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  if (!(await hasPermission(user.id, 'projects.write.own'))) return forbidden();

  const parsed = await readJson(req, CreateProjectSchema);
  if (!parsed.ok) return parsed.response;
  const { name, contentJson } = parsed.data;

  try {
    const [project] = await db
      .insert(projects)
      .values({ name, contentJson: contentJson ?? {}, ownerId: user.id, version: 1 })
      .returning();

    return Response.json({ project }, { status: 201 });
  } catch {
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
