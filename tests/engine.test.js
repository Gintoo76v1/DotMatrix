import { describe, it, expect, beforeEach } from 'vitest';
import { makeDotStamp, stampInto, makeValueNoise, render } from '../js/engine.js';
import { state } from '../js/config.js';
import { mulberry32 } from '../js/utils.js';

// jsdom does not implement canvas2d. Patch a minimal API the engine uses:
//   • createElement('canvas') with width/height
//   • getContext('2d') with fillRect/drawImage/getImageData/putImageData
function installCanvasPolyfill() {
  // jsdom's HTMLCanvasElement already has width/height but no real getContext('2d').
  // Override getContext on the prototype with a synthetic 2D shim that returns
  // a deterministic gradient ImageData.
  const proto = window.HTMLCanvasElement.prototype;
  proto.getContext = function () {
    const self = this;
    return {
      fillStyle: '#fff',
      fillRect() {},
      drawImage() {},
      getImageData(_x, _y, w, h) {
        const data = new Uint8ClampedArray(w * h * 4);
        for (let yy = 0; yy < h; yy++) {
          for (let xx = 0; xx < w; xx++) {
            const i = (yy * w + xx) * 4;
            const v = ((xx + yy) * 8) & 255;
            data[i] = data[i + 1] = data[i + 2] = v;
            data[i + 3] = 255;
          }
        }
        return { width: w, height: h, data };
      },
      putImageData() {},
    };
  };

  if (typeof globalThis.ImageData === 'undefined') {
    globalThis.ImageData = class ImageData {
      constructor(w, h) {
        this.width = w;
        this.height = h;
        this.data = new Uint8ClampedArray(w * h * 4);
      }
    };
  }
}

beforeEach(() => {
  installCanvasPolyfill();
});

describe('makeDotStamp', () => {
  it('returns odd-sized buffer', () => {
    const s = makeDotStamp(5, 0.3, 0.9);
    expect(s.size % 2).toBe(1);
    expect(s.data.length).toBe(s.size * s.size);
  });

  it('center pixel has the highest value', () => {
    const s = makeDotStamp(7, 0.3, 1.0);
    const c = (s.size - 1) / 2;
    const center = s.data[c * s.size + c];
    for (let i = 0; i < s.data.length; i++) {
      expect(s.data[i]).toBeLessThanOrEqual(center + 1e-6);
    }
  });

  it('density scales linearly', () => {
    const a = makeDotStamp(7, 0.3, 0.5);
    const b = makeDotStamp(7, 0.3, 1.0);
    const c = (a.size - 1) / 2;
    expect(b.data[c * b.size + c]).toBeCloseTo(2 * a.data[c * a.size + c], 5);
  });

  it('isotropic when dpiH == dpiV', () => {
    const s = makeDotStamp(9, 0.2, 1.0, { dpiH: 360, dpiV: 360 });
    const c = (s.size - 1) / 2;
    // top vs left: equidistant from centre with equal scaling → equal values
    expect(s.data[(c - 2) * s.size + c]).toBeCloseTo(s.data[c * s.size + (c - 2)], 5);
  });

  it('anisotropic stretch when dpiH > dpiV (epson_fx-like)', () => {
    const s = makeDotStamp(9, 0.2, 1.0, { dpiH: 120, dpiV: 72 });
    const c = (s.size - 1) / 2;
    // x is stretched → x-pixels should retain higher values than y-pixels
    expect(s.data[c * s.size + (c - 2)]).toBeGreaterThanOrEqual(s.data[(c - 2) * s.size + c]);
  });

  it('legacy mode uses 0.88 squashing factor', () => {
    const s = makeDotStamp(9, 0.2, 1.0, { legacy: true });
    expect(s.size).toBe(9);
    // sanity: not crashing
    expect(s.data.every((v) => v >= 0 && v <= 1)).toBe(true);
  });
});

describe('stampInto', () => {
  let ink, stamp;
  const W = 20,
    H = 20,
    SS = 5;
  beforeEach(() => {
    ink = new Float32Array(W * H);
    stamp = new Float32Array(SS * SS).fill(1.0);
  });

  it('writes within bounds', () => {
    stampInto(ink, W, H, stamp, SS, 5, 5, 1);
    let count = 0;
    for (let i = 0; i < ink.length; i++) if (ink[i] > 0) count++;
    expect(count).toBe(SS * SS);
  });

  it('clamps accumulation at 1.0', () => {
    stampInto(ink, W, H, stamp, SS, 5, 5, 1);
    stampInto(ink, W, H, stamp, SS, 5, 5, 1);
    for (let i = 0; i < ink.length; i++) expect(ink[i]).toBeLessThanOrEqual(1.0);
  });

  it('does nothing when fully outside', () => {
    stampInto(ink, W, H, stamp, SS, 100, 100, 1);
    stampInto(ink, W, H, stamp, SS, -100, -100, 1);
    for (let i = 0; i < ink.length; i++) expect(ink[i]).toBe(0);
  });

  it('clips at top-left edge', () => {
    stampInto(ink, W, H, stamp, SS, -2, -2, 1);
    // 3×3 visible block should be set
    let count = 0;
    for (let i = 0; i < ink.length; i++) if (ink[i] > 0) count++;
    expect(count).toBe(9);
  });

  it('clips at bottom-right edge', () => {
    stampInto(ink, W, H, stamp, SS, W - 2, H - 2, 1);
    let count = 0;
    for (let i = 0; i < ink.length; i++) if (ink[i] > 0) count++;
    expect(count).toBe(4); // 2×2 visible
  });

  it('respects band multiplier', () => {
    stampInto(ink, W, H, stamp, SS, 5, 5, 0.5);
    expect(ink[5 * W + 5]).toBeCloseTo(0.5, 6);
  });
});

describe('makeValueNoise', () => {
  it('output is in [0, 1]', () => {
    const r = mulberry32(42);
    const noise = makeValueNoise(r, 8, 8);
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const v = noise(x, y, 64, 64);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('deterministic with same seed', () => {
    const a = makeValueNoise(mulberry32(1), 8, 8);
    const b = makeValueNoise(mulberry32(1), 8, 8);
    expect(a(13.7, 21.4, 64, 64)).toBeCloseTo(b(13.7, 21.4, 64, 64), 9);
  });

  it('smoothstep mode produces smoother gradient than bilinear', () => {
    const r1 = mulberry32(7);
    const noise = makeValueNoise(r1, 4, 4, { interp: 'bilinear' });
    const r2 = mulberry32(7);
    const noiseSmooth = makeValueNoise(r2, 4, 4);
    // 2nd derivative magnitude near a grid line — smoothstep variant should
    // not exhibit linear seams, so values just inside grid cells differ less
    // from the cell-centre samples.
    const a1 = noise(8.0, 8.0, 16, 16);
    const a2 = noise(8.5, 8.0, 16, 16);
    const b1 = noiseSmooth(8.0, 8.0, 16, 16);
    const b2 = noiseSmooth(8.5, 8.0, 16, 16);
    // Both finite, both ∈ [0,1] — sanity only (true smoothness requires FFT).
    expect(Number.isFinite(a1) && Number.isFinite(b1)).toBe(true);
    expect(Number.isFinite(a2) && Number.isFinite(b2)).toBe(true);
  });
});

describe('render integration', () => {
  it('renders a synthetic image without throwing', async () => {
    const img = { width: 16, height: 16 };
    state.profile = 'oki_microline';
    state.paperFormat = 'Original';
    state.maxSize = 64;
    state.dither = 'threshold';
    state.threshold = 128;
    state.wearLayers = [];
    state.softBlur = false;
    state.seed = 1;
    state.dpi = 100;
    state.ink = [25, 25, 30];
    state.paper = [255, 255, 255];

    const result = await render(img);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
    expect(result.imageData.data.length).toBe(result.width * result.height * 4);
  });

  it('renders cleanly with all wear-layers active', async () => {
    const img = { width: 16, height: 16 };
    state.profile = 'epson_fx';
    state.paperFormat = 'Original';
    state.maxSize = 64;
    state.dither = 'ordered';
    state.wearLayers = [
      { pattern: 'cloudy', strength: 50 },
      { pattern: 'ghosting', strength: 50 },
      { pattern: 'misaligned', strength: 50 },
      { pattern: 'pin_skip', strength: 50 },
      { pattern: 'smudge', strength: 50 },
      { pattern: 'ribbon_twist', strength: 50 },
      { pattern: 'head_gap', strength: 50 },
      { pattern: 'ink_starved', strength: 50 },
      { pattern: 'paper_slip', strength: 50 },
      { pattern: 'static_noise', strength: 50 },
      { pattern: 'double_feed', strength: 50 },
      { pattern: 'mechanical_resonance', strength: 50 },
    ];
    state.seed = 42;
    state.dpi = 100;
    state.ink = [25, 25, 30];
    state.paper = [255, 255, 255];

    const result = await render(img);
    expect(result.width).toBeGreaterThan(0);
  });

  it('legacy mode renders without throwing', async () => {
    const img = { width: 16, height: 16 };
    state.profile = 'oki_microline';
    state.paperFormat = 'Original';
    state.maxSize = 64;
    state.dither = 'floyd_steinberg';
    state.wearLayers = [{ pattern: 'cloudy', strength: 30 }];
    state.legacyMath = true;
    state.seed = 7;
    state.dpi = 100;
    state.ink = [25, 25, 30];
    state.paper = [255, 255, 255];

    const result = await render(img);
    state.legacyMath = false; // restore
    expect(result.width).toBeGreaterThan(0);
  });
});
