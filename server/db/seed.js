import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://dotmatrix:dotmatrixpassword@localhost:5432/dotmatrix',
});

const db = drizzle(pool, { schema });

async function seed() {
  console.log('Seeding initial admin role and invite code...');
  
  // Create admin role
  const [adminRole] = await db.insert(schema.roles).values({
    name: 'admin',
    description: 'System Administrator',
    isSystem: true
  }).onConflictDoNothing().returning();

  if (!adminRole) {
    console.log('Admin role already exists.');
    process.exit(0);
  }

  // Create an initial invite code
  const code = crypto.randomBytes(6).toString('hex').toUpperCase().match(/.{4}/g).join('-');
  
  await db.insert(schema.inviteCodes).values({
    code,
    roleId: adminRole.id,
    maxUses: 1,
    note: 'Initial Bootstrap Admin Invite',
  });

  console.log('✅ Success! Initial setup complete.');
  console.log('Use this Invite Code to register your first Admin account:');
  console.log('\n==============================');
  console.log(`       ${code}`);
  console.log('==============================\n');
  
  process.exit(0);
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});