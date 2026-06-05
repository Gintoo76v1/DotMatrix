import { getAuthUser, hasPermission, unauthorized, forbidden } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects } from '@/server/db/schema.js';
import { readJson } from '@/lib/validate';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const UploadUrlSchema = z.object({
  filename: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Invalid filename'),
  contentType: z.string().min(1).max(150),
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME ?? 'dotmatrix-projects';

// Build an S3 client only when fully configured. Fail closed: we never fall back
// to default ("minioadmin") credentials, which would expose the bucket.
function getStorageClient(): S3Client | null {
  const { S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY } = process.env;
  if (!S3_ENDPOINT || !S3_ACCESS_KEY || !S3_SECRET_KEY) return null;
  return new S3Client({
    region: process.env.S3_REGION ?? 'eu-central-1',
    endpoint: S3_ENDPOINT,
    credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY },
    forcePathStyle: true,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  if (!(await hasPermission(user.id, 'projects.write.own'))) return forbidden();

  const s3Client = getStorageClient();
  if (!s3Client) {
    return Response.json({ error: 'File storage is not configured' }, { status: 503 });
  }

  const { id } = await params;
  const parsed = await readJson(req, UploadUrlSchema);
  if (!parsed.ok) return parsed.response;
  const { filename, contentType } = parsed.data;

  try {
    const project = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.ownerId, user.id)))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

    const key = `projects/${user.id}/${id}/${Date.now()}_${filename}`;
    const command = new PutObjectCommand({ Bucket: BUCKET_NAME, Key: key, ContentType: contentType });
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    return Response.json({ uploadUrl, key });
  } catch {
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
