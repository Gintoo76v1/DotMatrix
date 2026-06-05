import { db } from '@/lib/db';
import { authAttempts } from '@/server/db/schema.js';
import { and, eq, gte, lt, sql } from 'drizzle-orm';

/**
 * Postgres-backed, serverless-safe rate limiting (no in-memory state).
 *
 * Both helpers FAIL OPEN: if the backing query errors for any reason (e.g. the
 * table does not exist yet), they never block a legitimate request.
 */
export async function isRateLimited(
  bucket: string,
  ip: string,
  opts: { max: number; windowSec: number }
): Promise<boolean> {
  try {
    const since = new Date(Date.now() - opts.windowSec * 1000);
    const rows = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(authAttempts)
      .where(
        and(
          eq(authAttempts.bucket, bucket),
          eq(authAttempts.ip, ip),
          gte(authAttempts.createdAt, since)
        )
      );
    return (rows[0]?.n ?? 0) >= opts.max;
  } catch {
    return false;
  }
}

export async function recordAttempt(bucket: string, ip: string): Promise<void> {
  try {
    await db.insert(authAttempts).values({ bucket, ip });
    // Opportunistically prune stale rows for this key (keeps the table small).
    await db
      .delete(authAttempts)
      .where(
        and(
          eq(authAttempts.bucket, bucket),
          eq(authAttempts.ip, ip),
          lt(authAttempts.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
        )
      );
  } catch {
    /* fail open */
  }
}

/** Best-effort client IP from the standard proxy header. */
export function clientIp(headerList: { get(name: string): string | null }): string {
  return headerList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}
