import express from 'express';
import { db } from '../db/index.js';
import { inviteCodes, inviteRedemptions, users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import crypto from 'crypto';
import { logAction } from '../utils/audit.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

const inviteCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 invites per hour
  message: { error: 'Too many invites created. Please try again later.' },
});

function generateInviteCode() {
  // Generates a base32-like string (e.g. XXXX-XXXX-XXXX)
  return crypto.randomBytes(6).toString('hex').toUpperCase().match(/.{4}/g).join('-');
}

// Get all invites (with redemption info)
router.get('/', requireAuth, requirePermission('invites.read.any'), async (req, res) => {
  try {
    const allInvites = await db.select().from(inviteCodes);

    const redemptions = await db
      .select({
        inviteCodeId: inviteRedemptions.inviteCodeId,
        username: users.username,
        email: users.email,
        redeemedAt: inviteRedemptions.redeemedAt,
      })
      .from(inviteRedemptions)
      .leftJoin(users, eq(inviteRedemptions.userId, users.id));

    const invites = allInvites.map((inv) => ({
      ...inv,
      redemptions: redemptions.filter((r) => r.inviteCodeId === inv.id),
    }));

    res.json({ invites });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Create new invite
router.post(
  '/',
  requireAuth,
  requirePermission('invites.create'),
  inviteCreateLimiter,
  async (req, res) => {
    const { roleId, maxUses, expiresAt, note } = req.body;

    if (!roleId) return res.status(400).json({ error: 'roleId is required' });

    try {
      const code = generateInviteCode();
      const [invite] = await db
        .insert(inviteCodes)
        .values({
          code,
          roleId,
          createdBy: req.session.userId,
          maxUses: maxUses || 1,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          note,
        })
        .returning();

      await logAction(req, 'invite.create', 'invite_codes', invite.id, {
        roleId,
        code: invite.code,
      });

      res.status(201).json({ invite });
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);

// Revoke/Delete invite
router.delete('/:id', requireAuth, requirePermission('invites.revoke'), async (req, res) => {
  const { id } = req.params;

  try {
    const [invite] = await db
      .update(inviteCodes)
      .set({ isRevoked: true })
      .where(eq(inviteCodes.id, id))
      .returning();

    if (!invite) return res.status(404).json({ error: 'Invite not found' });

    await logAction(req, 'invite.revoke', 'invite_codes', invite.id);

    res.json({ message: 'Invite revoked successfully', invite });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
