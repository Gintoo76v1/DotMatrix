import { getAuthUser, unauthorized } from '@/lib/auth';
import { db } from '@/lib/db';
import { userSettings } from '@/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { readJson, jsonObject } from '@/lib/validate';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const settings = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, user.id))
      .limit(1)
      .then((r) => r[0]);

    return Response.json({ settings: settings ? settings.settingsJson : {} });
  } catch {
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

const SettingsSchema = z.object({ settingsJson: jsonObject });

export async function PUT(req: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const parsed = await readJson(req, SettingsSchema);
  if (!parsed.ok) return parsed.response;
  const { settingsJson } = parsed.data;

  try {
    const [settings] = await db
      .insert(userSettings)
      .values({ userId: user.id, settingsJson, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: { settingsJson, updatedAt: new Date() },
      })
      .returning();

    return Response.json({ settings: settings.settingsJson });
  } catch {
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
