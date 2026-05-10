import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { users, roles, rolePermissions, permissions } from '@/server/db/schema.js';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!profile) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let userPermissions: string[] = [];
    let roleName = 'none';

    if (profile.roleId) {
      const role = await db
        .select()
        .from(roles)
        .where(eq(roles.id, profile.roleId))
        .limit(1)
        .then((r) => r[0] ?? null);

      if (role) {
        roleName = role.name;
        if (role.name === 'admin') {
          userPermissions = ['*'];
        } else {
          const perms = await db
            .select()
            .from(rolePermissions)
            .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
            .where(eq(rolePermissions.roleId, profile.roleId));
          userPermissions = perms.map((p) => p.permissions.key);
        }
      }
    }

    return Response.json({
      user: {
        id: profile.id,
        username: profile.username,
        role: roleName,
        twoFactorEnabled: profile.twoFactorEnabled,
      },
      permissions: userPermissions,
    });
  } catch {
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
