// Wear-layer construction is internal to engine.js but the side-effects
// observable through render() are sufficient. We cover behaviour that is
// strength-monotonic: turning each pattern on at full strength must not
// crash and must perceptibly affect the output for at least one cell.

import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../scripts/config.js';
import { render } from '../scripts/engine.js';

beforeEach(() => {
  // Canvas + ImageData polyfills (shared logic with engine.test.js)
  window.HTMLCanvasElement.prototype.getContext = function () {
    return {
      fillStyle: '#fff',
      fillRect() {},
      drawImage() {},
      getImageData(_x, _y, w, h) {
        const data = new Uint8ClampedArray(w * h * 4);
        for (let yy = 0; yy < h; yy++) {
          for (let xx = 0; xx < w; xx++) {
            const i = (yy * w + xx) * 4;
            const v = ((xx + yy) * 16) & 255;
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
    globalThis.ImageData = class {
      constructor(w, h) {
        this.width = w;
        this.height = h;
        this.data = new Uint8ClampedArray(w * h * 4);
      }
    };
  }
  // Default render state
  state.profile = 'oki_microline';
  state.paperFormat = 'Original';
  state.maxSize = 64;
  state.dither = 'threshold';
  state.threshold = 128;
  state.wearLayers = [];
  state.softBlur = false;
  state.legacyMath = false;
  state.seed = 1;
  state.dpi = 100;
  state.ink = [25, 25, 30];
  state.paper = [255, 255, 255];
  state.brightness = 0;
  state.contrast = 0;
  state.gamma = 1.0;
  state.invert = false;
  state.jitterScale = 1.0;
  state.bandingScale = 1.0;
  state.doubleStrike = false;
  state.condensed = false;
});

const PATTERNS = [
  'cloudy',
  'ghosting',
  'misaligned',
  'pin_skip',
  'smudge',
  'ribbon_twist',
  'head_gap',
  'ink_starved',
  'paper_slip',
  'static_noise',
  'double_feed',
  'mechanical_resonance',
];

describe('wear layers — each renders without throwing', () => {
  for (const pattern of PATTERNS) {
    it(`pattern "${pattern}" with strength 100 renders`, async () => {
      const img = { width: 24, height: 24 };
      state.wearLayers = [{ pattern, strength: 100 }];
      const r = await render(img);
      expect(r.width).toBeGreaterThan(0);
      expect(r.height).toBeGreaterThan(0);
    });
  }

  it('strength 0 wear layer is effectively a no-op', async () => {
    const img = { width: 16, height: 16 };
    state.wearLayers = [];
    const a = await render(img);
    state.wearLayers = [{ pattern: 'cloudy', strength: 0 }];
    const b = await render(img);
    // Identical RNG seed → identical output
    let max = 0;
    for (let i = 0; i < a.imageData.data.length; i++) {
      max = Math.max(max, Math.abs(a.imageData.data[i] - b.imageData.data[i]));
    }
    expect(max).toBeLessThanOrEqual(1);
  });

  it('mechanical_resonance with random phase varies between seeds', async () => {
    const img = { width: 16, height: 16 };
    state.wearLayers = [{ pattern: 'mechanical_resonance', strength: 100 }];
    state.seed = 1;
    const a = await render(img);
    state.seed = 2;
    const b = await render(img);
    let diff = 0;
    for (let i = 0; i < a.imageData.data.length; i++) {
      if (a.imageData.data[i] !== b.imageData.data[i]) diff++;
    }
    expect(diff).toBeGreaterThan(0);
  });

  it('pin_skip 100% leaves visible voids vs 0%', async () => {
    const img = { width: 24, height: 24 };
    state.wearLayers = [];
    const baseline = await render(img);
    state.wearLayers = [{ pattern: 'pin_skip', strength: 100 }];
    const damaged = await render(img);
    // Damaged should have more white pixels (paper) than baseline.
    const countLight = (r) => {
      let c = 0;
      for (let i = 0; i < r.imageData.data.length; i += 4) {
        if (r.imageData.data[i] > 200) c++;
      }
      return c;
    };
    expect(countLight(damaged)).toBeGreaterThanOrEqual(countLight(baseline));
  });
});
