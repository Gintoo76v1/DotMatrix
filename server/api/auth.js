import express from 'express';
import argon2 from 'argon2';
import { db } from '../db/index.js';
import { users, inviteCodes, inviteRedemptions } from '../db/schema.js';
import { eq, or, sql } from 'drizzle-orm';
import { validate } from '../middleware/validate.js';
import { loginSchema, registerSchema } from '../utils/schemas.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login requests per `window`
  message: { error: 'Too many login attempts, please try again later.' }
});

router.post('/register', validate(registerSchema), async (req, res) => {
  const { inviteCode, username, password, email, displayName } = req.body;

  try {
    // 1. Validate Invite Code within a transaction
    await db.transaction(async (tx) => {
      const invite = await tx.select()
        .from(inviteCodes)
        .where(eq(inviteCodes.code, inviteCode))
        .for('update') // Pessimistic lock
        .limit(1)
        .then(res => res[0]);

      if (!invite) {
        throw new Error('Invalid invite code');
      }
      if (invite.isRevoked) {
        throw new Error('Invite code revoked');
      }
      if (invite.expiresAt && new Date() > invite.expiresAt) {
        throw new Error('Invite code expired');
      }
      if (invite.usedCount >= invite.maxUses) {
        throw new Error('Invite code fully used');
      }

      // 2. Hash Password
      const passwordHash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4
      });

      // 3. Create User
      const [newUser] = await tx.insert(users).values({
        username,
        email,
        passwordHash,
        displayName,
        roleId: invite.roleId,
      }).returning();

      // 4. Update Invite uses
      await tx.update(inviteCodes)
        .set({ usedCount: sql`${inviteCodes.usedCount} + 1` })
        .where(eq(inviteCodes.id, invite.id));

      // 5. Log Redemption
      await tx.insert(inviteRedemptions).values({
        inviteCodeId: invite.id,
        userId: newUser.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      // Optional: Auto-login after registration
      req.session.userId = newUser.id;
      req.session.roleId = newUser.roleId;

      res.status(201).json({ message: 'Registration successful', user: { id: newUser.id, username: newUser.username } });
    });
  } catch (error) {
    if (error.code === '23505') {
      // Postgres unique violation
      return res.status(409).json({ error: 'Username or email already exists' });
    }
    return res.status(400).json({ error: error.message });
  }
});

router.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {
  const { usernameOrEmail, password } = req.body;

  try {
    const user = await db.select()
      .from(users)
      .where(or(
        eq(users.username, usernameOrEmail),
        eq(users.email, usernameOrEmail)
      ))
      .limit(1)
      .then(res => res[0]);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is not active' });
    }

    if (user.lockedUntil && new Date() < user.lockedUntil) {
      return res.status(403).json({ error: 'Account temporarily locked. Try again later.' });
    }

    const isValid = await argon2.verify(user.passwordHash, password);

    if (!isValid) {
      // Handle failed login count and lockout
      const failedCount = user.failedLoginCount + 1;
      let lockedUntil = null;
      if (failedCount >= 5) {
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // Lock for 15 mins
      }
      await db.update(users)
        .set({ failedLoginCount: failedCount, lockedUntil })
        .where(eq(users.id, user.id));

      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Success login
    await db.update(users)
      .set({ 
        failedLoginCount: 0, 
        lockedUntil: null, 
        lastLoginAt: new Date(),
        lastActiveAt: new Date()
      })
      .where(eq(users.id, user.id));

    req.session.userId = user.id;
    req.session.roleId = user.roleId;

    res.json({ message: 'Login successful', user: { id: user.id, username: user.username } });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

router.get('/me', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // TODO: Fetch user details and permissions
  res.json({ user: { id: req.session.userId } });
});

export default router;