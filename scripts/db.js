// ── Offline-First IndexedDB Layer ──────────────────────────────────────────

const DB_NAME = 'DotMatrixDB';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('blobs')) {
        db.createObjectStore('blobs', { keyPath: 'id' }); // For storing image blobs
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txPromise(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const localDB = {
  async getProject(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readonly');
      const req = tx.objectStore('projects').get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async getAllProjects() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readonly');
      const req = tx.objectStore('projects').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async saveProject(project) {
    const db = await openDB();
    const tx = db.transaction('projects', 'readwrite');
    tx.objectStore('projects').put(project);
    await txPromise(tx);
  },

  async deleteProject(id) {
    const db = await openDB();
    const tx = db.transaction('projects', 'readwrite');
    tx.objectStore('projects').delete(id);
    await txPromise(tx);
  },

  async getBlob(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('blobs', 'readonly');
      const req = tx.objectStore('blobs').get(id);
      req.onsuccess = () => resolve(req.result?.blob);
      req.onerror = () => reject(req.error);
    });
  },

  async saveBlob(id, blob) {
    const db = await openDB();
    const tx = db.transaction('blobs', 'readwrite');
    tx.objectStore('blobs').put({ id, blob });
    await txPromise(tx);
  },

  async enqueueSyncTask(task) {
    const db = await openDB();
    const tx = db.transaction('syncQueue', 'readwrite');
    tx.objectStore('syncQueue').add(task);
    await txPromise(tx);
  },

  async getSyncQueue() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('syncQueue', 'readonly');
      const req = tx.objectStore('syncQueue').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async removeSyncTask(id) {
    const db = await openDB();
    const tx = db.transaction('syncQueue', 'readwrite');
    tx.objectStore('syncQueue').delete(id);
    await txPromise(tx);
  }
};