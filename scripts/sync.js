import { localDB } from './db.js';
import { api } from './api.js';

// eslint-disable-next-line no-unused-vars
let syncInterval = null;
let isSyncing = false;

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
          // 1. Get presigned URL
          const { uploadUrl } = await api.projects.getUploadUrl(task.projectId, task.filename, task.contentType);
          // 2. Fetch blob from localDB
          const blob = await localDB.getBlob(task.blobId);
          if (blob) {
            // 3. Upload to S3
            await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': task.contentType } });
            // Cleanup blob from local DB if desired
            // await localDB.saveBlob(task.blobId, null); // Or delete
          }
        } else if (task.type === 'settings_update') {
          await api.settings.update(task.settingsJson);
        }
        
        // Remove task upon success
        await localDB.removeSyncTask(task.id);
      } catch (err) {
        // If 401, stop syncing. If 409, handle conflict.
        if (err.status === 401) break;
        if (err.status === 409) {
          console.error('Conflict detected during sync', err);
          // For now, remove task to avoid blocking queue, ideally we'd trigger a merge UI
          await localDB.removeSyncTask(task.id);
        }
        // Other errors: keep in queue and retry later
        console.warn('Sync task failed, will retry', err);
      }
    }
  } finally {
    isSyncing = false;
  }
}

export function initSyncManager() {
  window.addEventListener('online', processQueue);
  
  // Periodically check queue
  syncInterval = setInterval(processQueue, 10000);
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