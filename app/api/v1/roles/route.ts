import { getAuthUser, hasPermission, unauthorized, forbidden } from '@/lib/auth';
import { db } from '@/lib/db';
import { roles } from '@/server/db/schema.js';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  if (!(await hasPermission(user.id, 'roles.manage'))) return forbidden();

  try {
    const allRoles = await db.select().from(roles);
    return Response.json({ roles: allRoles });
  } catch {
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  if (!(await hasPermission(user.id, 'roles.manage'))) return forbidden();

  const { name, description } = await req.json();
  if (!name) return Response.json({ error: 'name is required' }, { status: 400 });

  try {
    const [role] = await db.insert(roles).values({ name, description }).returning();
    return Response.json({ role }, { status: 201 });
  } catch {
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
