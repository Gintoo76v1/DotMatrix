import { db } from '@/lib/db';
import { auditLog } from '@/server/db/schema.js';

export async function logAction(
  actorUserId: string | null,
  action: string,
  targetType: string | null = null,
  targetId: string | null = null,
  metadata: Record<string, unknown> | null = null,
  ipAddress: string | null = null
) {
  try {
    await db.insert(auditLog).values({
      actorUserId,
      action,
      targetType,
      targetId,
      metadataJson: metadata,
      ipAddress,
    });
  } catch (err) {
    console.error('[audit] failed to write log:', err);
  }
}
