import { getAuthUser, hasPermission, unauthorized, forbidden } from '@/lib/auth';
import { db } from '@/lib/db';
import { inviteCodes, inviteRedemptions, users } from '@/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { logAction } from '@/lib/audit';
import crypto from 'crypto';

function generateInviteCode() {
  return crypto.randomBytes(6).toString('hex').toUpperCase().match(/.{4}/g)!.join('-');
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  if (!(await hasPermission(user.id, 'invites.read.any'))) return forbidden();

  try {
    const allInvites = await db.select().from(inviteCodes);
    const redemptions = await db
      .select({
        inviteCodeId: inviteRedemptions.inviteCodeId,
        username: users.username,
        email: users.email,
        redeemedAt: inviteRedemptions.redeemedAt,
      })
      .from(inviteRedemptions)
      .leftJoin(users, eq(inviteRedemptions.userId, users.id));

    const invites = allInvites.map((inv) => ({
      ...inv,
      redemptions: redemptions.filter((r) => r.inviteCodeId === inv.id),
    }));

    return Response.json({ invites });
  } catch {
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  if (!(await hasPermission(user.id, 'invites.create'))) return forbidden();

  const { roleId, maxUses, expiresAt, note } = await req.json();
  if (!roleId) return Response.json({ error: 'roleId is required' }, { status: 400 });

  try {
    const code = generateInviteCode();
    const [invite] = await db
      .insert(inviteCodes)
      .values({ code, roleId, createdBy: user.id, maxUses: maxUses ?? 1, expiresAt: expiresAt ? new Date(expiresAt) : null, note })
      .returning();

    await logAction(user.id, 'invite.create', 'invite_codes', invite.id, { roleId, code: invite.code });
    return Response.json({ invite }, { status: 201 });
  } catch {
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
