import express from 'express';
import { db } from '../db/index.js';
import { projects, projectSnapshots } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logAction } from '../utils/audit.js';

const router = express.Router();

const s3Client = new S3Client({
  region: process.env.S3_REGION || 'eu-central-1',
  endpoint: process.env.S3_ENDPOINT, // e.g. for MinIO
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
  },
  forcePathStyle: true, // Needed for MinIO
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'dotmatrix-projects';

router.get('/', requireAuth, requirePermission('projects.read.own'), async (req, res) => {
  try {
    const userProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.ownerId, req.session.userId));
    res.json({ projects: userProjects });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/', requireAuth, requirePermission('projects.write.own'), async (req, res) => {
  const { name, contentJson } = req.body;

  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    const [project] = await db
      .insert(projects)
      .values({
        name,
        contentJson: contentJson || {},
        ownerId: req.session.userId,
        version: 1,
      })
      .returning();

    res.status(201).json({ project });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.patch('/:id', requireAuth, requirePermission('projects.write.own'), async (req, res) => {
  const { id } = req.params;
  const { contentJson, version } = req.body;

  try {
    // 1. Fetch current project to verify ownership and version
    const project = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.ownerId, req.session.userId)))
      .limit(1)
      .then((r) => r[0]);

    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.version !== version)
      return res.status(409).json({ error: 'Conflict: Version mismatch' });

    // 2. Update with optimistic locking
    const [updated] = await db
      .update(projects)
      .set({ contentJson, version: version + 1, updatedAt: new Date() })
      .where(and(eq(projects.id, id), eq(projects.version, version)))
      .returning();

    if (!updated)
      return res.status(409).json({ error: 'Conflict: Version mismatch during update' });

    // 3. Create a snapshot every 5 versions for history
    if (updated.version % 5 === 0) {
      await db.insert(projectSnapshots).values({
        projectId: id,
        contentJson,
        version: updated.version,
        createdBy: req.session.userId,
      });
    }

    res.json({ project: updated });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// S3 Upload Presigned URL
router.post(
  '/:id/upload-url',
  requireAuth,
  requirePermission('projects.write.own'),
  async (req, res) => {
    const { id } = req.params;
    const { filename, contentType } = req.body;

    try {
      const project = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, id), eq(projects.ownerId, req.session.userId)))
        .limit(1)
        .then((r) => r[0]);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const key = `projects/${req.session.userId}/${id}/${Date.now()}_${filename}`;
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ContentType: contentType,
      });

      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      res.json({ uploadUrl, key });
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);

router.delete('/:id', requireAuth, requirePermission('projects.delete.own'), async (req, res) => {
  const { id } = req.params;
  try {
    const project = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.ownerId, req.session.userId)))
      .limit(1)
      .then((r) => r[0]);

    if (!project) return res.status(404).json({ error: 'Project not found' });

    await db.delete(projectSnapshots).where(eq(projectSnapshots.projectId, id));
    await db.delete(projects).where(eq(projects.id, id));

    await logAction(req, 'project.delete', 'projects', id);
    res.json({ message: 'Project deleted' });
  } catch (error) {
    console.error('[project delete]', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── SNAPSHOTS & HISTORY ──────────────────────────────────────────────────

router.get(
  '/:id/snapshots',
  requireAuth,
  requirePermission('projects.read.own'),
  async (req, res) => {
    try {
      const snaps = await db
        .select({
          id: projectSnapshots.id,
          version: projectSnapshots.version,
          createdAt: projectSnapshots.createdAt,
        })
        .from(projectSnapshots)
        .where(eq(projectSnapshots.projectId, req.params.id))
        .orderBy(sql`${projectSnapshots.version} DESC`);

      res.json({ snapshots: snaps });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch snapshots' });
    }
  }
);

router.post(
  '/:id/snapshots/:snapId/restore',
  requireAuth,
  requirePermission('projects.write.own'),
  async (req, res) => {
    try {
      const snap = await db
        .select()
        .from(projectSnapshots)
        .where(
          and(
            eq(projectSnapshots.id, req.params.snapId),
            eq(projectSnapshots.projectId, req.params.id)
          )
        )
        .limit(1)
        .then((r) => r[0]);

      if (!snap) return res.status(404).json({ error: 'Snapshot not found' });

      const [updated] = await db
        .update(projects)
        .set({
          contentJson: snap.contentJson,
          version: snap.version + 1, // Increment from snapshot version
          updatedAt: new Date(),
        })
        .where(and(eq(projects.id, req.params.id), eq(projects.ownerId, req.session.userId)))
        .returning();

      await logAction(req, 'project.restore_snapshot', 'projects', updated.id, {
        snapshotId: snap.id,
      });

      res.json({ project: updated });
    } catch (error) {
      res.status(500).json({ error: 'Failed to restore snapshot' });
    }
  }
);

export default router;
