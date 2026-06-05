import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  primaryKey,
  index,
} from 'drizzle-orm/pg-core';

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
  key: varchar('key', { length: 100 }).notNull().unique(),
  description: text('description'),
});

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.roleId, table.permissionId] }),
    permissionIdIdx: index('role_permissions_permission_id_idx').on(table.permissionId),
  })
);

// ── USERS (profile table — auth handled by Supabase Auth) ────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey(), // Matches auth.users.id from Supabase
  username: varchar('username', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 255 }).unique(),
  displayName: varchar('display_name', { length: 100 }),
  roleId: uuid('role_id').references(() => roles.id, { onDelete: 'restrict' }),
  status: varchar('status', { length: 20 }).default('active'),
  twoFactorEnabled: boolean('two_factor_enabled').default(false),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  roleIdIdx: index('users_role_id_idx').on(table.roleId),
}));

// ── API KEYS ─────────────────────────────────────────────────────────────

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  keyHash: varchar('key_hash', { length: 255 }).notNull().unique(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  userIdIdx: index('api_keys_user_id_idx').on(table.userId),
}));

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
}, (table) => ({
  roleIdIdx: index('invite_codes_role_id_idx').on(table.roleId),
  createdByIdx: index('invite_codes_created_by_idx').on(table.createdBy),
}));

export const inviteRedemptions = pgTable('invite_redemptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  inviteCodeId: uuid('invite_code_id').references(() => inviteCodes.id, { onDelete: 'restrict' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  redeemedAt: timestamp('redeemed_at', { withTimezone: true }).defaultNow(),
  ipAddress: varchar('ip_address'),
  userAgent: text('user_agent'),
}, (table) => ({
  inviteCodeIdIdx: index('invite_redemptions_invite_code_id_idx').on(table.inviteCodeId),
  userIdIdx: index('invite_redemptions_user_id_idx').on(table.userId),
}));

// ── APP DATA ─────────────────────────────────────────────────────────────

export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
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
}, (table) => ({
  ownerIdIdx: index('projects_owner_id_idx').on(table.ownerId),
}));

export const projectSnapshots = pgTable('project_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  contentJson: jsonb('content_json').notNull(),
  version: integer('version').notNull(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  projectIdIdx: index('project_snapshots_project_id_idx').on(table.projectId),
  createdByIdx: index('project_snapshots_created_by_idx').on(table.createdBy),
}));

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
}, (table) => ({
  actorUserIdIdx: index('audit_log_actor_user_id_idx').on(table.actorUserId),
}));

// ── AUTH RATE LIMITING (serverless-safe, Postgres-backed) ────────────────

export const authAttempts = pgTable(
  'auth_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bucket: varchar('bucket', { length: 50 }).notNull(),
    ip: varchar('ip').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    lookup: index('auth_attempts_lookup_idx').on(table.bucket, table.ip, table.createdAt),
  })
);
