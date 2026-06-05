import { localDB } from './db.js';
import { api } from './api.js?v=14';

let ws = null;
let currentUserId = null;
let isSyncing = false;
let syncInterval = null;

async function processQueue() {
  if (isSyncing || !navigator.onLine) return;
  isSyncing = true;
  try {
    const queue = await localDB.getSyncQueue();
    for (const task of queue) {
      try {
        if (task.type === 'project_update') {
          await api.projects.update(task.projectId, task.version, task.contentJson);
        } else if (task.type === 'project_create') {
          await api.projects.create(task.name, task.contentJson);
        } else if (task.type === 'project_delete') {
          await api.projects.delete(task.projectId);
        } else if (task.type === 'blob_upload') {
          const blob = await localDB.getBlob(task.blobId);
          if (blob) {
            const { uploadUrl } = await api.projects.getUploadUrl(
              task.projectId,
              task.filename,
              task.contentType
            );
            await fetch(uploadUrl, {
              method: 'PUT',
              body: blob,
              headers: { 'Content-Type': task.contentType },
            });
          }
        } else if (task.type === 'settings_update') {
          await api.settings.update(task.settingsJson);
        }

        await localDB.removeSyncTask(task.id);
      } catch (err) {
        if (err.status === 401) break;
        if (err.status === 409) {
          console.error('Conflict detected during sync', err);
          await localDB.removeSyncTask(task.id);
        }
        console.warn('Sync task failed, will retry', err);
      }
    }
  } finally {
    isSyncing = false;
  }
}

export function initSyncManager(userId) {
  currentUserId = userId;
  window.removeEventListener('online', processQueue);
  window.addEventListener('online', processQueue);

  if (syncInterval) clearInterval(syncInterval);
  syncInterval = setInterval(processQueue, 10000);

  processQueue();
}

// Real-time WebSocket sync was removed: Vercel's serverless runtime has no
// persistent WebSocket server, so the connection only failed and retried in a
// loop. Offline changes reconcile via the 10s polling loop above instead.

export function broadcastState(state) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type: 'sync', state }));
  }
}

export async function queueSaveProject(projectId, version, contentJson) {
  await localDB.saveProject({ id: projectId, version, contentJson, updatedAt: Date.now() });
  await localDB.enqueueSyncTask({ type: 'project_update', projectId, version, contentJson });
  processQueue();
}

export async function queueCreateProject(name, contentJson) {
  await localDB.enqueueSyncTask({ type: 'project_create', name, contentJson });
  processQueue();
}

export async function queueDeleteProject(projectId) {
  await localDB.deleteProject(projectId);
  await localDB.enqueueSyncTask({ type: 'project_delete', projectId });
  processQueue();
}

export async function queueSaveSettings(settingsJson) {
  await localDB.enqueueSyncTask({ type: 'settings_update', settingsJson });
  processQueue();
}

export async function queueBlobUpload(projectId, blobId, blob, filename, contentType) {
  await localDB.saveBlob(blobId, blob);
  await localDB.enqueueSyncTask({ type: 'blob_upload', projectId, blobId, filename, contentType });
  processQueue();
}
