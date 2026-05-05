// ── Render client ──────────────────────────────────────────────────────────
// Single entry point used by main.js — abstracts away whether the render
// happens in a Worker or inline on the main thread. Falls back gracefully
// when OffscreenCanvas / module workers / createImageBitmap are missing.
//
// Strategy: single-flight worker (only one render in progress at a time).
// Calling renderImage() while another is pending cancels the previous job.

import { state } from './config.js';
import { render as inlineRender } from './engine.js';

let workerInstance = null;
let workerSupported = null;
let activeJob = null;     // { resolve, reject, onProgress }

function detectWorkerSupport() {
  if (workerSupported !== null) return workerSupported;
  try {
    workerSupported = (
      typeof Worker !== 'undefined' &&
      typeof OffscreenCanvas !== 'undefined' &&
      typeof createImageBitmap === 'function'
    );
  } catch {
    workerSupported = false;
  }
  return workerSupported;
}

function killWorker(err) {
  if (activeJob) {
    activeJob.reject(err || new Error('worker terminated'));
    activeJob = null;
  }
  if (workerInstance) {
    try { workerInstance.terminate(); } catch {}
    workerInstance = null;
  }
}

function getWorker() {
  if (workerInstance) return workerInstance;
  workerInstance = new Worker(new URL('./render-worker.js', import.meta.url),
    { type: 'module' });
  workerInstance.onmessage = (ev) => {
    const m = ev.data;
    if (!activeJob) return;
    if (m.type === 'progress') {
      if (activeJob.onProgress) activeJob.onProgress(m.status);
    } else if (m.type === 'done') {
      const job = activeJob;
      activeJob = null;
      const imageData = new ImageData(m.data, m.width, m.height);
      job.resolve({ imageData, width: m.width, height: m.height });
    } else if (m.type === 'error') {
      const job = activeJob;
      activeJob = null;
      job.reject(new Error(m.message));
    }
  };
  workerInstance.onerror = () => {
    workerSupported = false;
    killWorker(new Error('worker runtime error'));
  };
  return workerInstance;
}

function snapshotState() {
  const { sourceImage, ...rest } = state;
  return rest;
}

async function renderInWorker(srcImage, onProgress) {
  if (activeJob) {
    activeJob.reject(new Error('superseded'));
    activeJob = null;
  }
  const w = getWorker();
  const bitmap = (srcImage instanceof ImageBitmap)
    ? srcImage
    : await createImageBitmap(srcImage);

  return new Promise((resolve, reject) => {
    activeJob = { resolve, reject, onProgress };
    w.postMessage({
      type: 'render',
      state: snapshotState(),
      bitmap,
    }, [bitmap]);
  });
}

/**
 * Render the current state.sourceImage. Uses the worker if available and
 * `state.useWorker` is true; otherwise renders on the main thread.
 */
export async function renderImage(srcImage, onProgress) {
  if (state.useWorker && detectWorkerSupport()) {
    try {
      return await renderInWorker(srcImage, onProgress);
    } catch (e) {
      if (e.message === 'superseded') throw e;
      console.warn('[render-client] worker failed, falling back to inline:', e.message);
      workerSupported = false;
    }
  }
  return inlineRender(srcImage, onProgress);
}

export function terminateWorker() {
  killWorker();
}
