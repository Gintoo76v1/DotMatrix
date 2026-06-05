import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/server/db/schema.js';

// Connect through the Supabase transaction pooler (PgBouncer), so prepared
// statements must stay disabled. Keep the per-instance pool tiny: Vercel
// serverless functions are ephemeral and the pooler multiplexes connections.
const client = postgres(process.env.DATABASE_URL!, {
  prepare: false,
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });
