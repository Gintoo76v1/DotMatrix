// ── Image analysis: paper-color detection + auto adjustments ──────────────
//
// Bug A in v1: brightness/contrast/dither were assigned to state but the
// matching slider DOM nodes were not synchronised, so the UI lagged the model
// until the next user interaction.  Fixed by routing through the shared
// slider registry.

import { setSliderValue } from './sliders.js';
import { setSegmentedValue } from './segments.js';
import { setSwatchValue } from './swatches.js';

export function detectAndSetPaperColor(state, img) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, 64, 64);
  const data = ctx.getImageData(0, 0, 64, 64).data;
  let r = 0,
    g = 0,
    b = 0,
    count = 0;
  for (let y = 4; y < 60; y++) {
    for (let x = 4; x < 60; x++) {
      const idx = (y * 64 + x) * 4;
      r += data[idx];
      g += data[idx + 1];
      b += data[idx + 2];
      count++;
    }
  }
  r = Math.round(r / count);
  g = Math.round(g / count);
  b = Math.round(b / count);

  let best = null,
    minDist = Infinity;
  document.querySelectorAll('#paperSwatches .swatch').forEach((sw) => {
    if (!sw.dataset.paper) return;
    const rgb = sw.dataset.paper.split(',').map(Number);
    const dist = (r - rgb[0]) ** 2 + (g - rgb[1]) ** 2 + (b - rgb[2]) ** 2;
    if (dist < minDist) {
      minDist = dist;
      best = sw;
    }
  });
  if (best) {
    state.paper = best.dataset.paper.split(',').map(Number);
    setSwatchValue('paperSwatches', 'paper', state.paper);
  }
}

/**
 * Heuristic auto-adjust based on the source histogram.
 * High-key (mostly bright) → boost contrast and switch to threshold dither.
 * Otherwise centre the histogram by adjusting brightness toward 128.
 */
export function analyzeAndAdaptImage(state, img, onSettingsChanged) {
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 160;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, 160, 160);
  const { data } = ctx.getImageData(0, 0, 160, 160);

  const hist = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) {
    const luma = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    hist[luma]++;
  }
  const total = 160 * 160;

  let cum = 0,
    p2 = 0,
    p98 = 255;
  for (let i = 0; i < 256; i++) {
    cum += hist[i];
    if (cum / total < 0.02) p2 = i;
    if (cum / total < 0.98) p98 = i;
  }

  const highKey = hist.slice(180).reduce((a, b) => a + b, 0) / total > 0.45;
  if (highKey) {
    state.contrast = 45;
    state.dither = 'threshold';
    setSliderValue(state, 'contrast', 45);
    setSegmentedValue('ditherBtns', 'dither', 'threshold');
    const tf = document.getElementById('thresholdField');
    if (tf) tf.style.display = 'block';
  } else {
    const newBrightness = Math.max(-60, Math.min(60, Math.round(((p2 + p98) / 2 - 128) * -0.35)));
    state.brightness = newBrightness;
    setSliderValue(state, 'brightness', newBrightness);
  }
  if (onSettingsChanged) onSettingsChanged();
}
