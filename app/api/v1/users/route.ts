import { getAuthUser, hasPermission, unauthorized, forbidden } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, roles } from '@/server/db/schema.js';
import { eq } from 'drizzle-orm';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  if (!(await hasPermission(user.id, 'users.read.any'))) return forbidden();

  try {
    const allUsers = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        status: users.status,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        roleId: users.roleId,
        roleName: roles.name,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id));

    return Response.json({ users: allUsers });
  } catch {
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
