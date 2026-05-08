import express from 'express';
import { db } from '../db/index.js';
import { users, roles } from '../db/schema.js';
import { eq, ne } from 'drizzle-orm';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { logAction } from '../utils/audit.js';

const router = express.Router();

// List users
router.get('/', requireAuth, requirePermission('users.read.any'), async (req, res) => {
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

    res.json({ users: allUsers });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Update user status (admin action)
router.patch(
  '/:id/status',
  requireAuth,
  requirePermission('users.update.any'),
  async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    try {
      // Prevent self-suspension of the last admin
      if (status === 'suspended' && id === req.session.userId) {
        return res.status(400).json({ error: 'You cannot suspend yourself' });
      }

      const [updated] = await db
        .update(users)
        .set({ status, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();

      if (!updated) return res.status(404).json({ error: 'User not found' });

      await logAction(req, 'user.status_update', 'users', id, { status });

      res.json({ message: `User status updated to ${status}`, user: updated });
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);

export default router;
