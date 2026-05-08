import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || 'postgres://dotmatrix:dotmatrixpassword@localhost:5432/dotmatrix',
});

const db = drizzle(pool, { schema });

const PERMISSIONS = [
  { key: 'projects.read.own',   description: 'Eigene Projekte lesen' },
  { key: 'projects.write.own',  description: 'Eigene Projekte erstellen/bearbeiten' },
  { key: 'projects.delete.own', description: 'Eigene Projekte löschen' },
  { key: 'settings.read',       description: 'App-Einstellungen lesen' },
  { key: 'settings.write',      description: 'App-Einstellungen speichern' },
  { key: 'invites.create',      description: 'Invite Codes erstellen' },
  { key: 'invites.read.any',    description: 'Alle Invite Codes lesen' },
  { key: 'invites.revoke',      description: 'Invite Codes widerrufen' },
  { key: 'users.read.any',      description: 'Alle Benutzer lesen' },
  { key: 'users.update.any',    description: 'Beliebige Benutzer verwalten' },
  { key: 'roles.manage',        description: 'Rollen verwalten' },
];

// Permissions granted to the "user" role
const USER_ROLE_PERMISSIONS = [
  'projects.read.own',
  'projects.write.own',
  'projects.delete.own',
  'settings.read',
  'settings.write',
];

async function seed() {
  console.log('Seeding roles, permissions and initial invite code...');

  // ── Roles ──────────────────────────────────────────────────────────────────

  const [adminRole] = await db
    .insert(schema.roles)
    .values({ name: 'admin', description: 'System Administrator', isSystem: true })
    .onConflictDoNothing()
    .returning();

  const [userRole] = await db
    .insert(schema.roles)
    .values({ name: 'user', description: 'Normaler Benutzer', isSystem: true })
    .onConflictDoNothing()
    .returning();

  // ── Permissions ────────────────────────────────────────────────────────────

  const insertedPerms = await Promise.all(
    PERMISSIONS.map((p) =>
      db
        .insert(schema.permissions)
        .values(p)
        .onConflictDoNothing()
        .returning()
        .then((r) => r[0])
    )
  );

  // ── Assign user-role permissions ───────────────────────────────────────────

  if (userRole) {
    const userPerms = insertedPerms.filter(
      (p) => p && USER_ROLE_PERMISSIONS.includes(p.key)
    );
    await Promise.all(
      userPerms.map((p) =>
        db
          .insert(schema.rolePermissions)
          .values({ roleId: userRole.id, permissionId: p.id })
          .onConflictDoNothing()
      )
    );
    console.log(`✅ User role configured with ${userPerms.length} permissions.`);
  } else {
    console.log('ℹ️  User role already exists — skipping permission assignment.');
  }

  // ── Initial Admin Invite (only on first run) ───────────────────────────────

  if (!adminRole) {
    console.log('ℹ️  Admin role already exists — skipping invite creation.');
    process.exit(0);
  }

  const code = crypto.randomBytes(6).toString('hex').toUpperCase().match(/.{4}/g).join('-');

  await db.insert(schema.inviteCodes).values({
    code,
    roleId: adminRole.id,
    maxUses: 1,
    note: 'Initial Bootstrap Admin Invite',
  });

  console.log('✅ Initial setup complete.');
  console.log('Use this Invite Code to register your first Admin account:');
  console.log('\n==============================');
  console.log(`       ${code}`);
  console.log('==============================\n');

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
