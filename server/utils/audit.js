import { db } from '../db/index.js';
import { auditLog } from '../db/schema.js';

/**
 * Log a security-relevant action to the audit_log table.
 */
export async function logAction(req, action, targetType = null, targetId = null, metadata = null) {
  try {
    await db.insert(auditLog).values({
      actorUserId: req.session?.userId || null,
      action,
      targetType,
      targetId,
      metadataJson: metadata,
      ipAddress: req.ip,
    });
  } catch (err) {
    console.error('[audit] failed to write log:', err);
    // Do not throw — we don't want audit failure to break the main transaction if not critical
  }
}