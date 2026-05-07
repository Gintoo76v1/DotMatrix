import express from 'express';
import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { users, apiKeys } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { logAction } from '../utils/audit.js';

const router = express.Router();

// ── 2FA ──────────────────────────────────────────────────────────────────

router.get('/2fa/setup', requireAuth, async (req, res) => {
  try {
    const user = await db.select().from(users).where(eq(users.id, req.session.userId)).limit(1).then(r => r[0]);
    
    // Generate secret if not exists
    let secret = user.twoFactorSecret;
    if (!secret) {
      secret = authenticator.generateSecret();
      await db.update(users).set({ twoFactorSecret: secret }).where(eq(users.id, user.id));
    }

    const otpauth = authenticator.keyuri(user.username, 'DotMatrix Studio', secret);
    const qrDataUrl = await qrcode.toDataURL(otpauth);

    res.json({ qrDataUrl, secret });
  } catch (error) {
    res.status(500).json({ error: '2FA Setup failed' });
  }
});

router.post('/2fa/enable', requireAuth, async (req, res) => {
  const { token } = req.body;
  try {
    const user = await db.select().from(users).where(eq(users.id, req.session.userId)).limit(1).then(r => r[0]);
    if (!user.twoFactorSecret) return res.status(400).json({ error: 'Setup 2FA first' });

    const isValid = authenticator.verify({ token, secret: user.twoFactorSecret });
    if (!isValid) return res.status(400).json({ error: 'Invalid token' });

    await db.update(users).set({ twoFactorEnabled: true }).where(eq(users.id, user.id));
    await logAction(req, 'auth.2fa_enabled', 'users', user.id);

    res.json({ message: '2FA enabled successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to enable 2FA' });
  }
});

router.post('/2fa/disable', requireAuth, async (req, res) => {
  const { token } = req.body;
  try {
    const user = await db.select().from(users).where(eq(users.id, req.session.userId)).limit(1).then(r => r[0]);
    
    const isValid = authenticator.verify({ token, secret: user.twoFactorSecret });
    if (!isValid) return res.status(400).json({ error: 'Invalid token' });

    await db.update(users).set({ twoFactorEnabled: false, twoFactorSecret: null }).where(eq(users.id, user.id));
    await logAction(req, 'auth.2fa_disabled', 'users', user.id);

    res.json({ message: '2FA disabled successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to disable 2FA' });
  }
});

// ── API KEYS ─────────────────────────────────────────────────────────────

router.get('/api-keys', requireAuth, async (req, res) => {
  try {
    const keys = await db.select({
      id: apiKeys.id,
      name: apiKeys.name,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt
    }).from(apiKeys).where(eq(apiKeys.userId, req.session.userId));
    res.json({ keys });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

router.post('/api-keys', requireAuth, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  try {
    const rawKey = `dm_${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const [apiKey] = await db.insert(apiKeys).values({
      userId: req.session.userId,
      name,
      keyHash
    }).returning();

    await logAction(req, 'security.api_key_created', 'api_keys', apiKey.id);

    res.status(201).json({ apiKey: { ...apiKey, key: rawKey } }); // Send raw key only once!
  } catch (error) {
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

router.delete('/api-keys/:id', requireAuth, async (req, res) => {
  try {
    const [deleted] = await db.delete(apiKeys)
      .where(and(eq(apiKeys.id, req.params.id), eq(apiKeys.userId, req.session.userId)))
      .returning();
    
    if (!deleted) return res.status(404).json({ error: 'Key not found' });
    
    await logAction(req, 'security.api_key_revoked', 'api_keys', req.params.id);
    res.json({ message: 'API key revoked' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

export default router;
