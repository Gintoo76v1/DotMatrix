import { describe, it, expect } from 'vitest';
import {
  PROFILES,
  SYSTEM_PRESETS,
  WEAR_PATTERNS,
  PAPER_SIZES_MM,
  MM_PER_INCH,
  state,
} from '../js/config.js';

describe('PROFILES sanity', () => {
  const required = [
    'label',
    'pins',
    'dpi_h',
    'dpi_v',
    'dot_diameter_mm',
    'dot_softness',
    'ink_density',
    'passes',
    'jitter_mm',
    'banding',
    'ribbon_fade',
    'supports_condensed',
  ];

  for (const [id, p] of Object.entries(PROFILES)) {
    it(`profile "${id}" has all required fields`, () => {
      for (const k of required) {
        expect(p, `missing field ${k}`).toHaveProperty(k);
      }
    });

    it(`profile "${id}" has realistic numeric ranges`, () => {
      expect(p.pins).toBeGreaterThanOrEqual(7);
      expect(p.pins).toBeLessThanOrEqual(48);
      expect(p.dpi_h).toBeGreaterThan(50);
      expect(p.dpi_h).toBeLessThanOrEqual(720);
      expect(p.dpi_v).toBeGreaterThan(50);
      expect(p.dpi_v).toBeLessThanOrEqual(720);
      expect(p.dot_diameter_mm).toBeGreaterThan(0.05);
      expect(p.dot_diameter_mm).toBeLessThan(1.0);
      expect(p.dot_softness).toBeGreaterThanOrEqual(0);
      expect(p.dot_softness).toBeLessThanOrEqual(1);
      expect(p.ink_density).toBeGreaterThan(0.5);
      expect(p.ink_density).toBeLessThanOrEqual(1.0);
      expect(p.passes).toBeGreaterThanOrEqual(1);
      expect(p.ribbon_fade).toBeGreaterThanOrEqual(0);
      expect(p.ribbon_fade).toBeLessThan(0.5);
    });
  }
});

describe('SYSTEM_PRESETS', () => {
  it('all presets reference valid profiles', () => {
    for (const preset of SYSTEM_PRESETS) {
      expect(PROFILES[preset.profile], `preset ${preset.id}`).toBeDefined();
    }
  });

  it('all presets have a unique id', () => {
    const ids = SYSTEM_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('wearLayer patterns reference valid WEAR_PATTERNS', () => {
    for (const preset of SYSTEM_PRESETS) {
      for (const layer of preset.wearLayers || []) {
        expect(WEAR_PATTERNS[layer.pattern], `${preset.id}/${layer.pattern}`).toBeDefined();
      }
    }
  });
});

describe('PAPER_SIZES_MM', () => {
  it('all sizes are tuples of positive numbers', () => {
    for (const [name, size] of Object.entries(PAPER_SIZES_MM)) {
      expect(size, name).toHaveLength(2);
      expect(size[0]).toBeGreaterThan(0);
      expect(size[1]).toBeGreaterThan(0);
    }
  });

  it('A4 is 210 × 297 mm (ISO)', () => {
    expect(PAPER_SIZES_MM.A4).toEqual([210, 297]);
  });
});

describe('MM_PER_INCH', () => {
  it('equals 25.4', () => {
    expect(MM_PER_INCH).toBe(25.4);
  });
});

describe('state defaults', () => {
  it('has legacyMath, useWorker, autoRender flags', () => {
    expect(state).toHaveProperty('legacyMath');
    expect(state).toHaveProperty('useWorker');
    expect(state).toHaveProperty('autoRender');
  });

  it('legacyMath defaults to false (= new math)', () => {
    expect(state.legacyMath).toBe(false);
  });
});
