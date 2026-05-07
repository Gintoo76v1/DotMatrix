import express from 'express';
import { db } from '../db/index.js';
import { roles, permissions, rolePermissions } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const router = express.Router();

router.get('/', requireAuth, requirePermission('roles.manage'), async (req, res) => {
  try {
    const allRoles = await db.select().from(roles);
    res.json({ roles: allRoles });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/', requireAuth, requirePermission('roles.manage'), async (req, res) => {
  const { name, description } = req.body;

  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    const [role] = await db
      .insert(roles)
      .values({
        name,
        description,
      })
      .returning();

    res.status(201).json({ role });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
