import { describe, it, expect, beforeEach } from 'vitest';
import { DotMatrixPrinter } from '../js/dot-matrix-printer.js';

beforeEach(() => {
  // Provide a Canvas2D shim sufficient for the printer's internal use.
  // Tracks calls so tests can assert behaviour without rasterising.
  window.HTMLCanvasElement.prototype.getContext = function () {
    const calls = [];
    return {
      _calls: calls,
      fillStyle: '',
      font: '',
      textBaseline: '',
      fillRect(...a)        { calls.push(['fillRect', ...a]); },
      fillText(...a)        { calls.push(['fillText', ...a]); },
      drawImage(...a)       { calls.push(['drawImage', ...a]); },
      arc(...a)             { calls.push(['arc', ...a]); },
      beginPath()           { calls.push(['beginPath']); },
      fill()                { calls.push(['fill']); },
      measureText(s)        { return { width: s.length * 8 }; },
      createRadialGradient() { return { addColorStop() {} }; },
      getImageData(_x, _y, w, h) {
        // A blank white canvas — every dot in the sampled grid is below
        // the ink threshold so no actual sampling-side branching matters here.
        const data = new Uint8ClampedArray(w * h * 4);
        for (let i = 0; i < data.length; i += 4) {
          data[i] = data[i + 1] = data[i + 2] = 255;
          data[i + 3] = 255;
        }
        return { width: w, height: h, data };
      },
    };
  };
});

function newPrinter(opts) {
  const c = document.createElement('canvas');
  return new DotMatrixPrinter(c, opts);
}

describe('DotMatrixPrinter — _columnsToString', () => {
  it('left-aligns by default', () => {
    const p = newPrinter();
    const s = p._columnsToString([{ text: 'AB', align: 'left', widthChars: 5 }]);
    expect(s).toBe('AB   ');
  });

  it('right-aligns explicitly', () => {
    const p = newPrinter();
    const s = p._columnsToString([{ text: 'AB', align: 'right', widthChars: 5 }]);
    expect(s).toBe('   AB');
  });

  it('joins multiple columns', () => {
    const p = newPrinter();
    const s = p._columnsToString([
      { text: 'AOK', align: 'left',  widthChars: 5 },
      { text: '52',  align: 'right', widthChars: 4 },
    ]);
    expect(s).toBe('AOK    52');
  });
});

describe('DotMatrixPrinter — _buildLines', () => {
  it('splits a string on newline', () => {
    const p = newPrinter();
    expect(p._buildLines('a\nb\nc')).toEqual(['a', 'b', 'c']);
  });

  it('returns an array as-is when given strings', () => {
    const p = newPrinter();
    expect(p._buildLines(['x', 'y'])).toEqual(['x', 'y']);
  });

  it('handles single-row ColSpec', () => {
    const p = newPrinter();
    const r = p._buildLines([{ text: 'a', align: 'left', widthChars: 3 }]);
    expect(r).toEqual(['a  ']);
  });

  it('handles multi-row ColSpec arrays', () => {
    const p = newPrinter();
    const r = p._buildLines([
      [{ text: 'a', align: 'left', widthChars: 2 }],
      [{ text: 'b', align: 'left', widthChars: 2 }],
    ]);
    expect(r).toEqual(['a ', 'b ']);
  });

  it('coerces non-arrays to a single-element string array', () => {
    const p = newPrinter();
    expect(p._buildLines(123)).toEqual(['123']);
  });
});

describe('DotMatrixPrinter — _merge', () => {
  it('does not mutate the base object', () => {
    const p = newPrinter();
    const base = { a: 1, nested: { x: 1 } };
    const out = p._merge(base, { nested: { y: 2 } });
    expect(base.nested).toEqual({ x: 1 });
    expect(out.nested).toEqual({ x: 1, y: 2 });
  });

  it('replaces arrays rather than merging', () => {
    const p = newPrinter();
    const out = p._merge({ a: [1, 2] }, { a: [9] });
    expect(out.a).toEqual([9]);
  });
});

describe('DotMatrixPrinter — _initRng', () => {
  it('produces different streams for different seeds', () => {
    const a = newPrinter({ seed: 1 });
    const b = newPrinter({ seed: 2 });
    expect(a._rng()).not.toBe(b._rng());
  });

  it('produces identical streams for the same seed', () => {
    const a = newPrinter({ seed: 42 });
    const b = newPrinter({ seed: 42 });
    expect(a._rng()).toBe(b._rng());
  });

  it('emits values in [0, 1)', () => {
    const p = newPrinter({ seed: 7 });
    for (let i = 0; i < 100; i++) {
      const v = p._rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('DotMatrixPrinter — render() does not throw', () => {
  it('static text mode', () => {
    const p = newPrinter({ seed: 1 });
    expect(() => p.render('Hello\nWorld')).not.toThrow();
  });

  it('animation mode (with no requestAnimationFrame loop in jsdom)', () => {
    const p = newPrinter({ seed: 1, animation: { enabled: true, charsPerSecond: 100 } });
    expect(() => p.render(['x'])).not.toThrow();
    p.stop();
  });

  it('stop() is safe when nothing is animating', () => {
    const p = newPrinter();
    expect(() => p.stop()).not.toThrow();
  });
});
