import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { users, roles, rolePermissions, permissions } from '@/server/db/schema.js';
import { eq } from 'drizzle-orm';

export async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  const profile = await db
    .select()
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1)
    .then((r) => r[0] ?? null);

  return profile;
}

export async function hasPermission(userId: string, requiredPermission: string): Promise<boolean> {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!user?.roleId) return false;

  const role = await db
    .select()
    .from(roles)
    .where(eq(roles.id, user.roleId))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!role) return false;
  if (role.name === 'admin') return true;

  const perms = await db
    .select()
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(rolePermissions.roleId, user.roleId));

  return perms.some((p) => p.permissions.key === requiredPermission);
}

export function unauthorized() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}

export function forbidden() {
  return Response.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
}
