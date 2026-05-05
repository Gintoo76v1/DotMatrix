// ── Test helpers ────────────────────────────────────────────────────────────
// Mini-utilities for the DotMatrix test-suite. No external deps.

import { expect } from 'vitest';

/** Assert two floats are within tolerance. */
export function assertClose(actual, expected, tol = 1e-6, msg = '') {
  expect(Math.abs(actual - expected), msg || `expected ${expected} ± ${tol}, got ${actual}`).toBeLessThanOrEqual(tol);
}

/** Compute mean of a numeric array. */
export function mean(arr) {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return s / arr.length;
}

/** Compute std-dev of a numeric array. */
export function stddev(arr) {
  const m = mean(arr);
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += (arr[i] - m) ** 2;
  return Math.sqrt(s / arr.length);
}

/** Pearson correlation coefficient. */
export function correlation(a, b) {
  const ma = mean(a), mb = mean(b);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) {
    const xa = a[i] - ma, xb = b[i] - mb;
    num += xa * xb;
    da  += xa * xa;
    db  += xb * xb;
  }
  return num / Math.sqrt(da * db);
}

/**
 * Build a synthetic ImageData-like object (works in jsdom without canvas).
 * Pattern: 'solid' (rgb), 'checker' (rgb1, rgb2), 'gradient' (axis), 'noise' (seed)
 */
export function makeImageData(width, height, opts = {}) {
  const data = new Uint8ClampedArray(width * height * 4);
  const pattern = opts.pattern || 'solid';
  const fill = (i, r, g, b, a = 255) => { data[i] = r; data[i+1] = g; data[i+2] = b; data[i+3] = a; };

  if (pattern === 'solid') {
    const [r, g, b] = opts.rgb || [255, 255, 255];
    for (let i = 0; i < data.length; i += 4) fill(i, r, g, b);
  } else if (pattern === 'checker') {
    const [r1, g1, b1] = opts.rgb1 || [0, 0, 0];
    const [r2, g2, b2] = opts.rgb2 || [255, 255, 255];
    const sz = opts.size || 1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const c = (((x / sz) | 0) + ((y / sz) | 0)) & 1;
        if (c) fill(i, r2, g2, b2); else fill(i, r1, g1, b1);
      }
    }
  } else if (pattern === 'gradient') {
    const axis = opts.axis || 'x';
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const t = axis === 'x' ? x / Math.max(1, width - 1) : y / Math.max(1, height - 1);
        const v = Math.round(t * 255);
        fill((y * width + x) * 4, v, v, v);
      }
    }
  } else if (pattern === 'noise') {
    let s = (opts.seed || 1) >>> 0;
    const rng = () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), s | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.floor(rng() * 256);
      fill(i, v, v, v);
    }
  }
  return { width, height, data };
}

/** Default state object compatible with engine.toGrayscale call signature. */
export function defaultGrayState(overrides = {}) {
  return {
    brightness: 0,
    contrast: 0,
    gamma: 1.0,
    invert: false,
    legacyMath: false,
    ...overrides,
  };
}

/** Quick FNV-1a hash for byte arrays — used for parity tests. */
export function hashBytes(arr) {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < arr.length; i++) {
    h ^= arr[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
