import { getAuthUser, hasPermission, unauthorized, forbidden } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects } from '@/server/db/schema.js';
import { and, eq } from 'drizzle-orm';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: process.env.S3_REGION ?? 'eu-central-1',
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_KEY ?? 'minioadmin',
  },
  forcePathStyle: true,
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME ?? 'dotmatrix-projects';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  if (!(await hasPermission(user.id, 'projects.write.own'))) return forbidden();

  const { id } = await params;
  try {
    const { filename, contentType } = await req.json();

    const project = await db
      .select()
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
