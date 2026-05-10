import { getAuthUser, unauthorized } from '@/lib/auth';
import { db } from '@/lib/db';
import { apiKeys } from '@/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { logAction } from '@/lib/audit';
import crypto from 'crypto';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const keys = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        lastUsedAt: apiKeys.lastUsedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, user.id));

    return Response.json({ keys });
  } catch {
    return Response.json({ error: 'Failed to fetch API keys' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { name } = await req.json();
  if (!name) return Response.json({ error: 'Name is required' }, { status: 400 });

  try {
    const rawKey = `dm_${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const [apiKey] = await db
      .insert(apiKeys)
      .values({ userId: user.id, name, keyHash })
      .returning();

    await logAction(user.id, 'security.api_key_created', 'api_keys', apiKey.id);

    return Response.json({ apiKey: { ...apiKey, key: rawKey } }, { status: 201 });
  } catch {
    return Response.json({ error: 'Failed to create API key' }, { status: 500 });
  }
}
