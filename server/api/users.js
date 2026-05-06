import express from 'express';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const router = express.Router();

router.get('/', requireAuth, requirePermission('users.read.any'), async (req, res) => {
  try {
    const allUsers = await db.select({
      id: users.id,
      username: users.username,
      email: users.email,
      status: users.status,
      roleId: users.roleId,
    }).from(users);
    res.json({ users: allUsers });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.patch('/:id', requireAuth, requirePermission('users.update.any'), async (req, res) => {
  const { id } = req.params;
  const { roleId, status } = req.body;

  try {
    const [user] = await db.update(users)
      .set({ roleId, status, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning({ id: users.id, username: users.username, status: users.status, roleId: users.roleId });

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;