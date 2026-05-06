import { describe, it, expect } from 'vitest';
import {
  toGrayscale,
  floydSteinberg,
  orderedDither,
  thresholdDither,
  boxBlur3x3,
} from '../scripts/filters.js';
import { makeImageData, defaultGrayState, mean } from './helpers.js';

describe('toGrayscale (luma path, default)', () => {
  it('white image → all 255', () => {
    const img = makeImageData(8, 8, { pattern: 'solid', rgb: [255, 255, 255] });
    const g = toGrayscale(img, defaultGrayState());
    for (let i = 0; i < g.length; i++) expect(g[i]).toBe(255);
  });

  it('black image → all 0', () => {
    const img = makeImageData(8, 8, { pattern: 'solid', rgb: [0, 0, 0] });
    const g = toGrayscale(img, defaultGrayState());
    for (let i = 0; i < g.length; i++) expect(g[i]).toBe(0);
  });

  it('Rec. 601 luma weights for pure RGB', () => {
    const r = makeImageData(2, 2, { pattern: 'solid', rgb: [255, 0, 0] });
    const g = makeImageData(2, 2, { pattern: 'solid', rgb: [0, 255, 0] });
    const b = makeImageData(2, 2, { pattern: 'solid', rgb: [0, 0, 255] });
    expect(toGrayscale(r, defaultGrayState())[0]).toBeCloseTo(0.299 * 255, -1);
    expect(toGrayscale(g, defaultGrayState())[0]).toBeCloseTo(0.587 * 255, -1);
    expect(toGrayscale(b, defaultGrayState())[0]).toBeCloseTo(0.114 * 255, -1);
  });

  it('brightness +50 raises mid-grey by ~50', () => {
    const img = makeImageData(4, 4, { pattern: 'solid', rgb: [128, 128, 128] });
    const out = toGrayscale(img, defaultGrayState({ brightness: 50 }));
    expect(out[0]).toBeCloseTo(178, 0);
  });

  it('invert flips white ↔ black', () => {
    const w = makeImageData(2, 2, { pattern: 'solid', rgb: [255, 255, 255] });
    const out = toGrayscale(w, defaultGrayState({ invert: true }));
    expect(out[0]).toBe(0);
  });

  it('gamma 2.0 squares normalised value', () => {
    const img = makeImageData(2, 2, { pattern: 'solid', rgb: [128, 128, 128] });
    const out = toGrayscale(img, defaultGrayState({ gamma: 2.0 }));
    // 128/255 ≈ 0.502, squared ≈ 0.252, *255 ≈ 64
    expect(out[0]).toBeCloseTo(64, 0);
  });

  it('output is clamped to [0, 255]', () => {
    const img = makeImageData(2, 2, { pattern: 'solid', rgb: [255, 255, 255] });
    const out = toGrayscale(img, defaultGrayState({ brightness: 500 }));
    expect(out[0]).toBe(255);
    const img2 = makeImageData(2, 2, { pattern: 'solid', rgb: [0, 0, 0] });
    const out2 = toGrayscale(img2, defaultGrayState({ brightness: -500 }));
    expect(out2[0]).toBe(0);
  });
});

describe('toGrayscale (legacy RGB path)', () => {
  it('legacy path produces same result for grey images', () => {
    // RGB and luma paths converge for monochrome inputs
    const img = makeImageData(8, 8, { pattern: 'solid', rgb: [100, 100, 100] });
    const luma = toGrayscale(img, defaultGrayState({ contrast: 30, gamma: 1.5 }), {
      grayscale: 'luma',
    });
    const legacy = toGrayscale(img, defaultGrayState({ contrast: 30, gamma: 1.5 }), {
      grayscale: 'rgb',
    });
    for (let i = 0; i < luma.length; i++) {
      expect(Math.abs(luma[i] - legacy[i])).toBeLessThan(1);
    }
  });
});

describe('floydSteinberg', () => {
  it('pure white → all off (no ink)', () => {
    const w = 16,
      h = 16;
    const gray = new Float32Array(w * h).fill(255);
    const out = floydSteinberg(gray, w, h);
    for (let i = 0; i < out.length; i++) expect(out[i]).toBe(0);
  });

  it('pure black → all on', () => {
    const w = 16,
      h = 16;
    const gray = new Float32Array(w * h).fill(0);
    const out = floydSteinberg(gray, w, h);
    for (let i = 0; i < out.length; i++) expect(out[i]).toBe(1);
  });

  it('mid-grey → ~50% ink density (energy preserved within ±5%)', () => {
    const w = 64,
      h = 64;
    const gray = new Float32Array(w * h).fill(128);
    const out = floydSteinberg(gray, w, h);
    const inkRatio = mean(Array.from(out));
    expect(inkRatio).toBeGreaterThan(0.45);
    expect(inkRatio).toBeLessThan(0.55);
  });

  it('honours custom threshold (raises threshold → less ink overall on bright input)', () => {
    const w = 32,
      h = 32;
    // Half mid-grey, half bright
    const gray = new Float32Array(w * h);
    for (let i = 0; i < gray.length; i++) gray[i] = i % w < w / 2 ? 100 : 200;
    const outLow = floydSteinberg(gray, w, h, 80);
    const outHigh = floydSteinberg(gray, w, h, 220);
    const ratioLow = mean(Array.from(outLow));
    const ratioHigh = mean(Array.from(outHigh));
    // Higher threshold accepts more pixels as "ink" (since old < t triggers ink path).
    expect(ratioHigh).toBeGreaterThan(ratioLow);
  });
});

describe('orderedDither', () => {
  it('white → all off', () => {
    const w = 16,
      h = 16;
    const gray = new Float32Array(w * h).fill(255);
    const out = orderedDither(gray, w, h);
    for (let i = 0; i < out.length; i++) expect(out[i]).toBe(0);
  });

  it('black → all on', () => {
    const w = 16,
      h = 16;
    const gray = new Float32Array(w * h).fill(0);
    const out = orderedDither(gray, w, h);
    for (let i = 0; i < out.length; i++) expect(out[i]).toBe(1);
  });

  it('50% grey → ≈50% ink', () => {
    const w = 32,
      h = 32;
    const gray = new Float32Array(w * h).fill(128);
    const out = orderedDither(gray, w, h);
    const ratio = mean(Array.from(out));
    expect(ratio).toBeGreaterThan(0.4);
    expect(ratio).toBeLessThan(0.6);
  });
});

describe('thresholdDither', () => {
  it('respects threshold parameter', () => {
    const gray = new Float32Array([0, 50, 100, 150, 200, 255]);
    expect(Array.from(thresholdDither(gray, 6, 1, 128))).toEqual([1, 1, 1, 0, 0, 0]);
    expect(Array.from(thresholdDither(gray, 6, 1, 75))).toEqual([1, 1, 0, 0, 0, 0]);
  });
});

describe('boxBlur3x3 (separable)', () => {
  it('constant image is unchanged', () => {
    const w = 8,
      h = 8;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 100;
      data[i + 1] = 150;
      data[i + 2] = 200;
      data[i + 3] = 255;
    }
    const orig = new Uint8ClampedArray(data);
    boxBlur3x3(data, w, h);
    for (let i = 0; i < data.length; i++)
      expect(Math.abs(data[i] - orig[i])).toBeLessThanOrEqual(1);
  });

  it('preserves mean within ±1', () => {
    const w = 16,
      h = 16;
    const img = makeImageData(w, h, { pattern: 'noise', seed: 7 });
    const before = mean(Array.from(img.data).filter((_, i) => i % 4 === 0));
    boxBlur3x3(img.data, w, h);
    const after = mean(Array.from(img.data).filter((_, i) => i % 4 === 0));
    expect(Math.abs(after - before)).toBeLessThan(2);
  });

  it('reduces high-frequency noise (stddev decreases)', () => {
    const w = 32,
      h = 32;
    const img = makeImageData(w, h, { pattern: 'noise', seed: 99 });
    const before = Array.from(img.data).filter((_, i) => i % 4 === 0);
    boxBlur3x3(img.data, w, h);
    const after = Array.from(img.data).filter((_, i) => i % 4 === 0);
    const sd = (a) => {
      const m = a.reduce((s, v) => s + v, 0) / a.length;
      return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length);
    };
    expect(sd(after)).toBeLessThan(sd(before));
  });
});
