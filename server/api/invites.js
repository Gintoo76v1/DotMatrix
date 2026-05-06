import express from 'express';
import { db } from '../db/index.js';
import { inviteCodes } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import crypto from 'crypto';

const router = express.Router();

function generateInviteCode() {
  // Generates a base32-like string (e.g. XXXX-XXXX-XXXX)
  return crypto.randomBytes(6).toString('hex').toUpperCase().match(/.{4}/g).join('-');
}

// Get all invites
router.get('/', requireAuth, requirePermission('invites.read.any'), async (req, res) => {
  try {
    const invites = await db.select().from(inviteCodes);
    res.json({ invites });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Create new invite
router.post('/', requireAuth, requirePermission('invites.create'), async (req, res) => {
  const { roleId, maxUses, expiresAt, note } = req.body;
  
  if (!roleId) return res.status(400).json({ error: 'roleId is required' });

  try {
    const code = generateInviteCode();
    const [invite] = await db.insert(inviteCodes).values({
      code,
      roleId,
      createdBy: req.session.userId,
      maxUses: maxUses || 1,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      note
    }).returning();

    res.status(201).json({ invite });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Revoke/Delete invite
router.delete('/:id', requireAuth, requirePermission('invites.revoke'), async (req, res) => {
  const { id } = req.params;

  try {
    const [invite] = await db.update(inviteCodes)
      .set({ isRevoked: true })
      .where(eq(inviteCodes.id, id))
      .returning();

    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    res.json({ message: 'Invite revoked successfully', invite });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;