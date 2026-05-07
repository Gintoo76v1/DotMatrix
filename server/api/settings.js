import express from 'express';
import { db } from '../db/index.js';
import { userSettings } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const settings = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, req.session.userId))
      .limit(1)
      .then((r) => r[0]);
    res.json({ settings: settings ? settings.settingsJson : {} });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/', requireAuth, async (req, res) => {
  const { settingsJson } = req.body;

  try {
    const [settings] = await db
      .insert(userSettings)
      .values({ userId: req.session.userId, settingsJson, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: { settingsJson, updatedAt: new Date() },
      })
      .returning();

    res.json({ settings: settings.settingsJson });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
