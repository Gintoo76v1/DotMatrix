import express from 'express';
import { db } from '../db/index.js';
import { auditLog } from '../db/schema.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { desc } from 'drizzle-orm';

const router = express.Router();

router.get('/', requireAuth, requirePermission('audit.read'), async (req, res) => {
  try {
    const logs = await db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(100);
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
