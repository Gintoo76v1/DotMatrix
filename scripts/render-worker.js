// ── Render worker ───────────────────────────────────────────────────────────
// Receives a serialised state + an ImageBitmap, runs the engine pipeline
// using OffscreenCanvas, and posts back the resulting ImageData (transferred,
// zero-copy).
//
// Usage: instantiate with `new Worker(url, { type: 'module' })`.

import { state } from './config.js';
import { render } from './engine.js';

function offscreenCreateCanvas(w, h) {
  return new OffscreenCanvas(w, h);
}

self.onmessage = async (ev) => {
  const msg = ev.data;
  if (!msg || msg.type !== 'render') return;

  try {
    // Hydrate the worker-side state from the snapshot
    Object.assign(state, msg.state);
    state.sourceImage = msg.bitmap;

    const result = await render(
      msg.bitmap,
      (status) => self.postMessage({ type: 'progress', status }),
      { createCanvas: offscreenCreateCanvas }
    );

    // Transfer the underlying buffer back (avoids a copy)
    const buf = result.imageData.data.buffer;
    self.postMessage(
      {
        type: 'done',
        width: result.width,
        height: result.height,
        data: result.imageData.data, // Uint8ClampedArray
      },
      [buf]
    );
  } catch (e) {
    self.postMessage({ type: 'error', message: e.message, stack: e.stack });
  } finally {
    if (msg.bitmap && typeof msg.bitmap.close === 'function') {
      msg.bitmap.close();
    }
  }
};
