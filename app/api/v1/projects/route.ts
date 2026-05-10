import { getAuthUser, hasPermission, unauthorized, forbidden } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects } from '@/server/db/schema.js';
import { eq } from 'drizzle-orm';

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

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  if (!(await hasPermission(user.id, 'projects.write.own'))) return forbidden();

  try {
    const { name, contentJson } = await req.json();
    if (!name) return Response.json({ error: 'name is required' }, { status: 400 });

    const [project] = await db
      .insert(projects)
      .values({ name, contentJson: contentJson ?? {}, ownerId: user.id, version: 1 })
      .returning();

    return Response.json({ project }, { status: 201 });
  } catch {
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
