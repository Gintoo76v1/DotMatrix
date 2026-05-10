import { getAuthUser, hasPermission, unauthorized, forbidden } from '@/lib/auth';
import { db } from '@/lib/db';
import { auditLog } from '@/server/db/schema.js';
import { desc } from 'drizzle-orm';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  if (!(await hasPermission(user.id, 'audit.read'))) return forbidden();

  try {
    const logs = await db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(100);
    return Response.json({ logs });
  } catch {
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
