import { z } from 'zod';

/** A plain JSON object, capped to ~1 MB serialized to reject abusive payloads. */
export const jsonObject = z
  .record(z.unknown())
  .refine((v) => JSON.stringify(v).length <= 1_000_000, { message: 'Payload too large' });

/**
 * Parse + validate a JSON request body against a Zod schema.
 * Returns either the typed data or a ready-to-return 400 Response.
 */
export async function readJson<T extends z.ZodTypeAny>(
  req: Request,
  schema: T
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: Response }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { ok: false, response: Response.json({ error: 'Invalid JSON body' }, { status: 400 }) };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    const msg = result.error.issues[0]?.message ?? 'Invalid request';
    return { ok: false, response: Response.json({ error: msg }, { status: 400 }) };
  }

  return { ok: true, data: result.data };
}
