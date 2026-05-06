import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  inet,
  jsonb,
  primaryKey,
  check
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ── ROLES & PERMISSIONS ──────────────────────────────────────────────────

export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 50 }).notNull().unique(),
  description: text('description'),
  isSystem: boolean('is_system').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const permissions = pgTable('permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: varchar('key', { length: 100 }).notNull().unique(), // e.g., 'invites.create'
  description: text('description'),
});

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.roleId, table.permissionId] }),
    };
  }
);

// ── USERS ────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 255 }).unique(), // Nullable since we might only use username
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 100 }),
  roleId: uuid('role_id').references(() => roles.id, { onDelete: 'restrict' }),
  status: varchar('status', { length: 20 }).default('active'), // 'active', 'suspended', 'pending'
  failedLoginCount: integer('failed_login_count').default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ── SESSIONS (handled by connect-pg-simple) ──────────────────────────────
// The "session" table is usually created automatically or via a provided SQL script,
// but we define it here for reference or manual creation if needed.
export const session = pgTable('session', {
  sid: varchar('sid').primaryKey(),
  sess: jsonb('sess').notNull(),
  expire: timestamp('expire', { precision: 6 }).notNull(),
});

// ── INVITES ──────────────────────────────────────────────────────────────

export const inviteCodes = pgTable('invite_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  roleId: uuid('role_id').references(() => roles.id, { onDelete: 'restrict' }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  maxUses: integer('max_uses').default(1),
  usedCount: integer('used_count').default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  isRevoked: boolean('is_revoked').default(false),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const inviteRedemptions = pgTable('invite_redemptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  inviteCodeId: uuid('invite_code_id').references(() => inviteCodes.id, { onDelete: 'restrict' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  redeemedAt: timestamp('redeemed_at', { withTimezone: true }).defaultNow(),
  ipAddress: varchar('ip_address'), // inet equivalent for generic varchar if inet fails, but we'll use varchar for now
  userAgent: text('user_agent'),
});

// ── APP DATA ─────────────────────────────────────────────────────────────

export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  settingsJson: jsonb('settings_json').notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  contentJson: jsonb('content_json').notNull().default({}),
  version: integer('version').default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const projectSnapshots = pgTable('project_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  contentJson: jsonb('content_json').notNull(),
  version: integer('version').notNull(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ── SECURITY AUDIT ───────────────────────────────────────────────────────

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 100 }).notNull(),
  targetType: varchar('target_type', { length: 50 }),
  targetId: uuid('target_id'),
  metadataJson: jsonb('metadata_json'),
  ipAddress: varchar('ip_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});