import { db } from '../db/index.js';
import { rolePermissions, permissions, roles, users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

export const requirePermission = (requiredPermission) => async (req, res, next) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await db.select().from(users).where(eq(users.id, req.session.userId)).limit(1).then(r => r[0]);
    if (!user || !user.roleId) {
      return res.status(403).json({ error: 'Forbidden: No role assigned' });
    }

    const role = await db.select().from(roles).where(eq(roles.id, user.roleId)).limit(1).then(r => r[0]);
    if (role.name === 'admin') {
      return next(); // Admin bypass
    }

    // Check specific permission
    const hasPermission = await db.select()
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, user.roleId))
      .then(res => res.some(p => p.permissions.key === requiredPermission));

    if (!hasPermission) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};