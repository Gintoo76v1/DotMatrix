import { describe, it, expect } from 'vitest';
import { mulberry32, gaussian, makeGaussian, smoothstep, clamp, yieldUI } from '../js/utils.js';
import { mean, stddev, correlation } from './helpers.js';

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it('produces values in [0, 1)', () => {
    const r = mulberry32(1);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('different seeds produce uncorrelated streams', () => {
    const a = mulberry32(1),
      b = mulberry32(99999);
    const arrA = [],
      arrB = [];
    for (let i = 0; i < 2000; i++) {
      arrA.push(a());
      arrB.push(b());
    }
    expect(Math.abs(correlation(arrA, arrB))).toBeLessThan(0.1);
  });

  it('seed 0 is treated like seed 1 (no all-zero pathology)', () => {
    const r = mulberry32(0);
    // Should still emit varied output, not just zeroes
    const samples = Array.from({ length: 50 }, () => r());
    expect(stddev(samples)).toBeGreaterThan(0.05);
  });

  it('uniform mean ≈ 0.5 over 10k samples', () => {
    const r = mulberry32(7);
    const arr = [];
    for (let i = 0; i < 10000; i++) arr.push(r());
    expect(Math.abs(mean(arr) - 0.5)).toBeLessThan(0.02);
  });
});

describe('gaussian / makeGaussian', () => {
  it('legacy gaussian has μ ≈ 0, σ ≈ 1 over 10k samples', () => {
    const r = mulberry32(123);
    const arr = [];
    for (let i = 0; i < 10000; i++) arr.push(gaussian(r));
    expect(Math.abs(mean(arr))).toBeLessThan(0.05);
    expect(Math.abs(stddev(arr) - 1)).toBeLessThan(0.05);
  });

  it('cached gaussian has μ ≈ 0, σ ≈ 1 over 10k samples', () => {
    const r = mulberry32(456);
    const g = makeGaussian(r);
    const arr = [];
    for (let i = 0; i < 10000; i++) arr.push(g());
    expect(Math.abs(mean(arr))).toBeLessThan(0.05);
    expect(Math.abs(stddev(arr) - 1)).toBeLessThan(0.05);
  });

  it('cached gaussian uses 2nd box-muller value (consumes fewer rng calls)', () => {
    let calls = 0;
    const counted = () => {
      calls++;
      return mulberry32(1)();
    };
    // Better: track via wrapper around a real RNG
    const r = mulberry32(99);
    const wrapper = () => {
      calls++;
      return r();
    };
    const g = makeGaussian(wrapper);
    g(); // first call: 2 rng draws
    const after1 = calls;
    g(); // second call: should consume 0 rng draws (cached)
    expect(calls).toBe(after1);
  });
});

describe('smoothstep', () => {
  it('endpoints map to themselves', () => {
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(1)).toBe(1);
  });

  it('midpoint is 0.5', () => {
    expect(smoothstep(0.5)).toBeCloseTo(0.5, 10);
  });

  it('is monotonic on [0, 1]', () => {
    let prev = -Infinity;
    for (let i = 0; i <= 100; i++) {
      const v = smoothstep(i / 100);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe('clamp', () => {
  it('clamps below lower bound', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });
  it('clamps above upper bound', () => {
    expect(clamp(50, 0, 10)).toBe(10);
  });
  it('passes through in-range values', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
});

describe('yieldUI', () => {
  it('resolves on next macrotask', async () => {
    const start = Date.now();
    await yieldUI();
    expect(Date.now() - start).toBeLessThan(50);
  });
});
