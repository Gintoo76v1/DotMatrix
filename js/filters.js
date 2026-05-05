// ── Image filters ───────────────────────────────────────────────────────────
// Pure functions; the only object the toGrayscale path touches besides the
// pixel buffer is `state` (read-only).
//
// All functions accept an optional `mode` object from math-mode.js. When the
// mode is omitted or `mode.grayscale === 'rgb'`, behaviour matches the v1
// implementation byte-for-byte (used for legacy parity tests).

import { clamp } from './utils.js';

/**
 * Convert an ImageData-like object to a Float32 grayscale buffer.
 *
 * Two paths:
 *   • 'rgb'  (legacy)  — apply brightness/contrast/gamma per RGB channel,
 *                        THEN compute luma. Mathematically duplicates work
 *                        because gamma is non-linear, but identical to the
 *                        original v1 output.
 *   • 'luma' (default) — compute luma first, then apply the linear adjustments
 *                        and gamma. ~3× faster (one pow per pixel instead of
 *                        three) and visually indistinguishable for typical
 *                        gamma values.
 */
export function toGrayscale(imgData, stateObj, mode) {
  const useLuma = !mode || mode.grayscale !== 'rgb';
  const { width, height, data } = imgData;
  const out = new Float32Array(width * height);
  const c = (stateObj.contrast / 100) + 1;
  const intercept = 128 * (1 - c);
  const b = stateObj.brightness;
  const g = stateObj.gamma;
  const inv = stateObj.invert;

  if (useLuma) {
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      let luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      luma = luma * c + intercept + b;
      luma = clamp(luma, 0, 255);
      if (g !== 1) luma = 255 * Math.pow(luma / 255, g);
      if (inv) luma = 255 - luma;
      out[j] = clamp(luma, 0, 255);
    }
  } else {
    // Legacy RGB path — duplicates per-channel math then luminance-mixes.
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      let r = data[i], green = data[i + 1], blue = data[i + 2];
      r     = r     * c + intercept + b;
      green = green * c + intercept + b;
      blue  = blue  * c + intercept + b;
      r     = 255 * Math.pow(clamp(r, 0, 255)     / 255, g);
      green = 255 * Math.pow(clamp(green, 0, 255) / 255, g);
      blue  = 255 * Math.pow(clamp(blue, 0, 255)  / 255, g);
      let luma = 0.299 * r + 0.587 * green + 0.114 * blue;
      if (inv) luma = 255 - luma;
      out[j] = clamp(luma, 0, 255);
    }
  }
  return out;
}

// ── Floyd–Steinberg error diffusion ─────────────────────────────────────────
//
// Default ('serpentine') mode reverses scan direction every row. This breaks
// up the ‘worm’ artefacts that classic FS produces on smooth gradients and
// honours `state.threshold` so the dither hinge can be moved off 50 %.
//
// Legacy ('classic') mode reproduces the v1 left-to-right pass with a fixed
// 128 threshold for byte-identical output.
export function floydSteinberg(gray, w, h, mode, threshold) {
  const serpentine = !mode || mode.floydSteinberg !== 'classic';
  const t = (mode && mode.useFloydThreshold && Number.isFinite(threshold)) ? threshold : 128;
  const buf = new Float32Array(gray);
  const out = new Uint8Array(w * h);

  for (let y = 0; y < h; y++) {
    const ltr = !serpentine || (y & 1) === 0;
    const xStart = ltr ? 0 : w - 1;
    const xEnd   = ltr ? w : -1;
    const xStep  = ltr ? 1 : -1;

    for (let x = xStart; x !== xEnd; x += xStep) {
      const i = y * w + x;
      const old = buf[i];
      const n = old < t ? 0 : 255;
      buf[i] = n;
      out[i] = n === 0 ? 1 : 0;
      const err = old - n;

      // Diffusion neighbours mirror across the scan direction.
      // Coefficients: 7/16, 3/16, 5/16, 1/16  (Floyd & Steinberg, 1976)
      if (ltr) {
        if (x + 1 < w)             buf[i + 1]     += err * 7 / 16;
        if (y + 1 < h) {
          if (x > 0)               buf[i + w - 1] += err * 3 / 16;
                                   buf[i + w]     += err * 5 / 16;
          if (x + 1 < w)           buf[i + w + 1] += err * 1 / 16;
        }
      } else {
        if (x - 1 >= 0)            buf[i - 1]     += err * 7 / 16;
        if (y + 1 < h) {
          if (x + 1 < w)           buf[i + w + 1] += err * 3 / 16;
                                   buf[i + w]     += err * 5 / 16;
          if (x - 1 >= 0)          buf[i + w - 1] += err * 1 / 16;
        }
      }
    }
  }
  return out;
}

// ── Ordered (Bayer 4×4) dither ──────────────────────────────────────────────
const BAYER4 = new Float32Array([
   0,  8,  2, 10,
  12,  4, 14,  6,
   3, 11,  1,  9,
  15,  7, 13,  5,
]).map(v => (v + 0.5) / 16 * 255);   // +0.5 centres thresholds in the 0–255 range

export function orderedDither(gray, w, h) {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = BAYER4[(y & 3) * 4 + (x & 3)];
      out[y * w + x] = gray[y * w + x] < t ? 1 : 0;
    }
  }
  return out;
}

// ── Plain threshold ────────────────────────────────────────────────────────
export function thresholdDither(gray, w, h, t) {
  const out = new Uint8Array(w * h);
  for (let i = 0; i < gray.length; i++) out[i] = gray[i] < t ? 1 : 0;
  return out;
}

// ── Separable 3×3 box blur (M10) ────────────────────────────────────────────
// One horizontal pass + one vertical pass = 6 taps/pixel instead of 9.
// Result is identical to the dense 2D kernel within FP tolerance for
// 8-bit input.  Alpha is left as 255.
export function boxBlur3x3(data, w, h) {
  const tmp = new Uint8ClampedArray(data.length);
  // Horizontal pass: write to tmp
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const di = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        let s = 0, n = 0;
        for (let kx = -1; kx <= 1; kx++) {
          const xx = x + kx;
          if (xx < 0 || xx >= w) continue;
          s += data[(y * w + xx) * 4 + c];
          n++;
        }
        tmp[di + c] = (s / n) | 0;
      }
      tmp[di + 3] = 255;
    }
  }
  // Vertical pass: write back to data
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const di = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        let s = 0, n = 0;
        for (let ky = -1; ky <= 1; ky++) {
          const yy = y + ky;
          if (yy < 0 || yy >= h) continue;
          s += tmp[(yy * w + x) * 4 + c];
          n++;
        }
        data[di + c] = (s / n) | 0;
      }
      data[di + 3] = 255;
    }
  }
}
