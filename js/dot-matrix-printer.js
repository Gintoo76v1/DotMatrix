/**
 * DotMatrixPrinter — standalone dot-matrix print effect component
 * Pure Canvas API · no external dependencies
 *
 * ── Glyph strategy ──────────────────────────────────────────────────────────
 * System monospace font → offscreen canvas → luminance sampling → dot grid.
 *
 * Why: the browser's text renderer handles all Unicode (€ £ ¥ ₽ ₩ ₹ Ä ü ç …)
 * and monospace fonts naturally produce even character cells. Sampling the
 * rendered pixels into a regular dot pitch gives authentic pin-column spacing
 * without maintaining a hand-crafted bitmap font.
 * Trade-off: output depends on the browser's installed fonts. Specify a
 * detailed fontFamily stack to get consistent results across platforms.
 */

export class DotMatrixPrinter {

  // ── Default configuration ──────────────────────────────────────────────────

  static DEFAULTS = {
    mode: 'text',                          // 'text' | 'postprocess'

    // ── Dot appearance ────────────────────────────────────────────────────────
    dotRadius:       1.8,                  // base dot radius in canvas-px
    dotSpacing:      5.0,                  // center-to-center pitch (px)
    intensityJitter: 0.24,                 // max random opacity reduction [0–1]
    positionJitter:  0.50,                 // max random offset per dot (px)
    shapeJitter:     0.22,                 // max radius scale variation [0–1]
    softEdge:        true,                 // radial-gradient halo (more organic)
    inkColor:        [28, 25, 32],         // [R,G,B]
    inkThreshold:    0.06,                 // minimum sampled ink to place a dot

    // ── Text mode ─────────────────────────────────────────────────────────────
    fontFamily: '"Courier New", Courier, "Lucida Console", monospace',
    fontSize:    15,                       // px — source render size
    lineHeight:  1.50,                     // relative multiplier
    padding:     16,                       // canvas inner padding (px)

    // ── Ribbon wear ───────────────────────────────────────────────────────────
    // Simulates exhausted ribbon zones: horizontal bands with reduced ink.
    ribbonWear: {
      enabled:        false,
      intensity:      0.40,               // 0 = no effect  · 1 = fully bleached bands
      bandFrequency:  3.2,                // sine cycles per full canvas height
      bandSoftness:   0.55,              // 0 = crisp bands · 1 = very smooth gradient
    },

    // ── Print animation ───────────────────────────────────────────────────────
    animation: {
      enabled:        false,
      charsPerSecond: 110,               // print-head speed
      lineDelayMs:    65,               // carriage-return + paper-feed pause (ms)
      onComplete:     null,              // () => void  callback after last char
    },

    // ── Misc ──────────────────────────────────────────────────────────────────
    seed:       0,                        // 0 = random per render; >0 = reproducible
    background: [255, 255, 255],          // [R,G,B] paper colour
  };

  // ── Constructor ────────────────────────────────────────────────────────────

  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.opts   = this._merge(DotMatrixPrinter.DEFAULTS, options);
    this._animId  = null;
    this._stopped = false;
    this._rng     = null;
    this._initRng();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Render input to the canvas.
   *
   * Text mode — input can be:
   *   • string            — plain multiline text (split on '\n')
   *   • Array<string>     — pre-split lines
   *   • Array<ColSpec[]>  — per-line column descriptors (see _columnsToString)
   *   • ColSpec[]         — single row of columns
   *
   * ColSpec = { text: string, align: 'left'|'right', widthChars: number }
   *
   * Post-process mode — input must be:
   *   • HTMLCanvasElement | ImageData
   */
  render(input) {
    this.stop();
    this._initRng();

    if (this.opts.mode === 'postprocess') {
      this._doPostProcess(input);
    } else {
      const lines = this._buildLines(input);
      if (this.opts.animation.enabled) {
        this._animate(lines);
      } else {
        this._static(lines);
      }
    }
  }

  /** Abort any in-progress animation. Safe to call even if not animating. */
  stop() {
    this._stopped = true;
    if (this._animId !== null) {
      cancelAnimationFrame(this._animId);
      this._animId = null;
    }
  }

  // ── Text preparation ───────────────────────────────────────────────────────

  _buildLines(input) {
    if (typeof input === 'string') return input.split('\n');
    if (!Array.isArray(input))    return [String(input)];

    const first = input[0];
    // Single-row ColSpec array
    if (first && typeof first === 'object' && 'text' in first) {
      return [this._columnsToString(input)];
    }
    // Multi-row ColSpec arrays
    if (Array.isArray(first)) {
      return input.map(row => this._columnsToString(row));
    }
    // Plain string array
    return input.map(String);
  }

  /**
   * Format a row of column descriptors into a padded string.
   *
   * Example:
   *   [{text:'AOK Berlin', align:'left', widthChars:30}, {text:'52', align:'right', widthChars:6}]
   *   → "AOK Berlin                        52"
   *
   * Note: widthChars is measured in ASCII/Latin characters. For CJK or other
   * double-wide glyphs, set widthChars to accommodate the visual width.
   */
  _columnsToString(cols) {
    return cols.map(col => {
      const txt   = String(col.text ?? '');
      const width = col.widthChars ?? txt.length;
      return col.align === 'right' ? txt.padStart(width) : txt.padEnd(width);
    }).join('');
  }

  // ── Offscreen rasterization ────────────────────────────────────────────────

  /**
   * Render lines of text to an offscreen canvas via the system font.
   * The canvas is black text on white — the inverse of the final output.
   * Returns the offscreen HTMLCanvasElement.
   */
  _rasterizeText(lines) {
    const { fontFamily, fontSize, lineHeight } = this.opts;
    const lhPx = Math.round(fontSize * lineHeight);
    const font = `${fontSize}px ${fontFamily}`;

    // Measure widths using a temporary context
    const probe = document.createElement('canvas').getContext('2d');
    probe.font  = font;
    const maxW  = Math.max(1, ...lines.map(l => Math.ceil(probe.measureText(l).width)));

    const off = document.createElement('canvas');
    off.width  = maxW + 8;
    off.height = lines.length * lhPx + 8;

    const c = off.getContext('2d');
    c.fillStyle    = '#ffffff';
    c.fillRect(0, 0, off.width, off.height);
    c.fillStyle    = '#000000';
    c.font         = font;
    c.textBaseline = 'top';

    for (let i = 0; i < lines.length; i++) {
      c.fillText(lines[i], 2, 2 + i * lhPx);
    }

    return off;
  }

  /**
   * Sample a source canvas into an array of dot descriptors.
   * Each dot: { x, y, ink } where ink ∈ (inkThreshold, 1].
   * offsetX/Y shift all dot positions (used for canvas padding).
   */
  _sampleGrid(srcCanvas, offsetX = 0, offsetY = 0) {
    const { dotSpacing, inkThreshold } = this.opts;
    const { width: W, height: H }      = srcCanvas;
    const px = srcCanvas.getContext('2d').getImageData(0, 0, W, H).data;

    // Sample disk radius: ~40% of the dot pitch
    const sr   = Math.max(1, Math.floor(dotSpacing * 0.40));
    const sr2  = sr * sr;
    const dots = [];

    const cols = Math.ceil(W / dotSpacing);
    const rows = Math.ceil(H / dotSpacing);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cx = Math.round(col * dotSpacing);
        const cy = Math.round(row * dotSpacing);

        let sum = 0, n = 0;
        for (let dy = -sr; dy <= sr; dy++) {
          for (let dx = -sr; dx <= sr; dx++) {
            if (dx * dx + dy * dy > sr2) continue; // circular sample region
            const sx = cx + dx, sy = cy + dy;
            if (sx < 0 || sx >= W || sy < 0 || sy >= H) continue;
            const i = (sy * W + sx) * 4;
            // Luminance (source is black text on white)
            sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
            n++;
          }
        }

        const ink = n > 0 ? (255 - sum / n) / 255 : 0; // invert: dark text → ink=1
        if (ink > inkThreshold) {
          dots.push({ x: offsetX + col * dotSpacing, y: offsetY + row * dotSpacing, ink });
        }
      }
    }

    return dots;
  }

  // ── Dot drawing ────────────────────────────────────────────────────────────

  /**
   * Draw dot descriptors onto the main canvas.
   * canvasH is used only for ribbon-wear normalisation.
   */
  _drawDots(dots, canvasH) {
    const { ctx } = this;
    const {
      dotRadius, intensityJitter, positionJitter, shapeJitter,
      softEdge, inkColor, ribbonWear,
    } = this.opts;
    const [ir, ig, ib] = inkColor;
    const rng = this._rng;

    for (const dot of dots) {
      // Per-dot stochastic variation (driven by seeded RNG for reproducibility)
      const jx   = (rng() - 0.5) * 2 * positionJitter;
      const jy   = (rng() - 0.5) * 2 * positionJitter;
      const rMod = 1.0 + (rng() - 0.5) * 2 * shapeJitter;
      const aMod = 1.0 - rng() * intensityJitter;

      // Ribbon wear: sine-wave alpha reduction along Y axis
      let wearFade = 1.0;
      if (ribbonWear.enabled) {
        const { intensity, bandFrequency, bandSoftness } = ribbonWear;
        const t    = dot.y / Math.max(1, canvasH);
        const wave = Math.sin(t * Math.PI * 2 * bandFrequency); // ∈ [-1, 1]
        // Map to [0,1] and apply softness exponent to shape the band profile
        const band = Math.pow(Math.max(0, (wave + 1) / 2), Math.max(0.1, 1 / (1 - bandSoftness + 0.01)));
        wearFade = 1.0 - band * intensity;
      }

      const alpha = dot.ink * aMod * wearFade;
      if (alpha < 0.03) continue;

      const x = dot.x + jx;
      const y = dot.y + jy;
      const r = dotRadius * Math.max(0.3, rMod);

      if (softEdge) {
        // Radial gradient: dense core → transparent halo (simulates ink bleed)
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.55);
        g.addColorStop(0,    `rgba(${ir},${ig},${ib},${alpha.toFixed(3)})`);
        g.addColorStop(0.60, `rgba(${ir},${ig},${ib},${(alpha * 0.75).toFixed(3)})`);
        g.addColorStop(1.0,  `rgba(${ir},${ig},${ib},0)`);
        ctx.beginPath();
        ctx.arc(x, y, r * 1.55, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${ir},${ig},${ib},${alpha.toFixed(3)})`;
        ctx.fill();
      }
    }
  }

  // ── Static rendering ───────────────────────────────────────────────────────

  _static(lines) {
    const { canvas, ctx, opts } = this;
    const pad = opts.padding;

    const src = this._rasterizeText(lines);

    canvas.width  = src.width  + pad * 2;
    canvas.height = src.height + pad * 2;

    const [pr, pg, pb] = opts.background;
    ctx.fillStyle = `rgb(${pr},${pg},${pb})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const dots = this._sampleGrid(src, pad, pad);
    this._drawDots(dots, canvas.height);
  }

  // ── Post-process rendering ─────────────────────────────────────────────────

  _doPostProcess(source) {
    const { canvas, ctx, opts } = this;

    let src;
    if (source instanceof HTMLCanvasElement) {
      src = source;
    } else if (source instanceof ImageData) {
      src = document.createElement('canvas');
      src.width  = source.width;
      src.height = source.height;
      src.getContext('2d').putImageData(source, 0, 0);
    } else {
      console.error('DotMatrixPrinter postprocess: input must be HTMLCanvasElement or ImageData');
      return;
    }

    canvas.width  = src.width;
    canvas.height = src.height;

    const [pr, pg, pb] = opts.background;
    ctx.fillStyle = `rgb(${pr},${pg},${pb})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const dots = this._sampleGrid(src, 0, 0);
    this._drawDots(dots, canvas.height);
  }

  // ── Animation ──────────────────────────────────────────────────────────────

  _animate(lines) {
    const { canvas, ctx, opts } = this;
    const { animation, padding, fontSize, lineHeight, background } = opts;
    const lhPx = Math.round(fontSize * lineHeight);

    // Size canvas from full text (so it doesn't resize mid-animation)
    const fullSrc = this._rasterizeText(lines);
    canvas.width  = fullSrc.width  + padding * 2;
    canvas.height = fullSrc.height + padding * 2;

    const [pr, pg, pb] = background;
    ctx.fillStyle = `rgb(${pr},${pg},${pb})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    this._stopped = false;

    let lineIdx     = 0;
    let charIdx     = 0;
    let lastTs      = null;
    let extraDelay  = 0;                         // carriage-return hold-off (ms)
    const msPerChar = 1000 / animation.charsPerSecond;

    const step = (ts) => {
      if (this._stopped) return;

      if (lastTs === null) lastTs = ts;
      const elapsed = ts - lastTs;

      // Honour line-break delay (simulates paper feed)
      if (extraDelay > 0) {
        extraDelay -= elapsed;
        lastTs = ts;
        this._animId = requestAnimationFrame(step);
        return;
      }

      const advance = Math.max(0, Math.floor(elapsed / msPerChar));
      if (advance < 1) {
        this._animId = requestAnimationFrame(step);
        return;
      }
      lastTs += advance * msPerChar;

      for (let i = 0; i < advance; i++) {
        if (lineIdx >= lines.length) {
          if (animation.onComplete) animation.onComplete();
          return;
        }

        // [...str] splits on Unicode code points (handles surrogate pairs correctly)
        const chars = [...lines[lineIdx]];

        if (charIdx >= chars.length) {
          lineIdx++;
          charIdx    = 0;
          extraDelay = animation.lineDelayMs;
          break; // re-enter loop after delay
        }

        const partial = chars.slice(0, charIdx + 1).join('');
        this._redrawLine(lineIdx, partial, lhPx);
        charIdx++;
      }

      this._animId = requestAnimationFrame(step);
    };

    this._animId = requestAnimationFrame(step);
  }

  /**
   * Erase and redraw a single line strip with partial text.
   * Only the affected row is touched, leaving other lines intact.
   */
  _redrawLine(lineIdx, text, lhPx) {
    const { canvas, ctx, opts } = this;
    const { padding, background } = opts;
    const [pr, pg, pb] = background;

    const yTop = padding + lineIdx * lhPx - 2;

    // Clear just this line's horizontal strip
    ctx.fillStyle = `rgb(${pr},${pg},${pb})`;
    ctx.fillRect(0, yTop, canvas.width, lhPx + 4);

    const lineSrc = this._rasterizeText([text]);
    const dots    = this._sampleGrid(lineSrc, padding, padding + lineIdx * lhPx);
    this._drawDots(dots, canvas.height);
  }

  // ── Utilities ──────────────────────────────────────────────────────────────

  _initRng() {
    const seed = this.opts.seed || (Math.random() * 0xFFFFFF | 0);
    this._rng   = this._mulberry32(seed >>> 0);
  }

  /** Mulberry32 — fast seeded PRNG with excellent statistical distribution */
  _mulberry32(seed) {
    let s = seed >>> 0;
    return () => {
      s += 0x6D2B79F5;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Non-destructive deep merge — arrays are replaced, not merged */
  _merge(base, override) {
    const out = Object.assign({}, base);
    for (const key of Object.keys(override ?? {})) {
      const b = base[key], o = override[key];
      if (o && typeof o === 'object' && !Array.isArray(o) && b && typeof b === 'object') {
        out[key] = this._merge(b, o);
      } else {
        out[key] = o;
      }
    }
    return out;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// DEMO — Remove or guard with `if (import.meta.env?.DEV)` before production
// ══════════════════════════════════════════════════════════════════════════════

function _demo() {
  // ── Helper: create a labelled canvas block ───────────────────────────────
  function makeCanvas(id, label) {
    let c = document.getElementById(id);
    if (!c) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'margin:24px 0;font-family:monospace;font-size:11px;color:#666';
      wrap.innerHTML = `<div style="margin-bottom:4px;letter-spacing:.1em">${label}</div>`;
      c = document.createElement('canvas');
      c.id    = id;
      c.style = 'display:block;border:1px solid #ddd;border-radius:4px';
      wrap.appendChild(c);
      document.body.appendChild(wrap);
    }
    return c;
  }

  // ── 1. Static text with columns and Unicode ──────────────────────────────
  //
  // Best match for IMG_0376.jpeg reference (AOK Kassenrezept):
  //   dotRadius=1.7  dotSpacing=4.8  intensityJitter=0.20
  //   positionJitter=0.45  shapeJitter=0.20  fontSize=14  seed=42
  //
  const printer1 = new DotMatrixPrinter(makeCanvas('demo-static', 'STATIC · columns · Unicode'), {
    dotRadius:       1.7,
    dotSpacing:      4.8,
    intensityJitter: 0.20,
    positionJitter:  0.45,
    shapeJitter:     0.20,
    fontSize:        14,
    lineHeight:      1.55,
    padding:         20,
    inkColor:        [30, 28, 34],
    seed:            42,
  });

  printer1.render([
    // Each element = one line = array of ColSpec
    [{ text: 'AOK Berlin',         align: 'left',  widthChars: 30 }, { text: '52',       align: 'right', widthChars: 6 }],
    [{ text: '',                   align: 'left',  widthChars: 36 }],
    [{ text: 'Müller',             align: 'left',  widthChars: 36 }],
    [{ text: 'Élise Çelik',        align: 'left',  widthChars: 30 }, { text: '18.01.03', align: 'right', widthChars: 8 }],
    [{ text: 'Im Geiger 75',       align: 'left',  widthChars: 36 }],
    [{ text: 'D 70374 Stuttgart',  align: 'left',  widthChars: 36 }],
    [{ text: '',                   align: 'left',  widthChars: 36 }],
    [{ text: 'Rezept-Nr.',         align: 'left',  widthChars: 24 }, { text: '109519005',align: 'right', widthChars: 12 }],
    [{ text: 'Betrag',             align: 'left',  widthChars: 24 }, { text: '€ 4.09',  align: 'right', widthChars: 12 }],
    [{ text: 'Tax 7%',             align: 'left',  widthChars: 24 }, { text: '£ 0.27',  align: 'right', widthChars: 12 }],
    [{ text: 'Währung-Test',       align: 'left',  widthChars: 24 }, { text: '¥ 1,850', align: 'right', widthChars: 12 }],
  ]);


  // ── 2. Animated print with ribbon wear ───────────────────────────────────
  //
  // Tuning:
  //   charsPerSecond↑ = faster/noisier machine feel
  //   lineDelayMs↑    = more deliberate paper-feed pauses
  //   ribbonWear.intensity↑ = more pronounced horizontal fade bands
  //   bandFrequency↑ = more (narrower) bands per page
  //
  const printer2 = new DotMatrixPrinter(makeCanvas('demo-anim', 'ANIMATED · ribbon wear'), {
    dotRadius:       2.0,
    dotSpacing:      5.2,
    intensityJitter: 0.28,
    positionJitter:  0.55,
    shapeJitter:     0.24,
    inkColor:        [25, 22, 28],
    fontSize:        15,
    ribbonWear: {
      enabled:       true,
      intensity:     0.42,
      bandFrequency: 3.0,
      bandSoftness:  0.58,
    },
    animation: {
      enabled:        true,
      charsPerSecond: 95,
      lineDelayMs:    90,
      onComplete:     () => console.log('[DotMatrixPrinter] print job complete'),
    },
  });

  printer2.render([
    '================================',
    '   MARKTPLATZ KIOSK GmbH',
    '================================',
    '',
    'Café au lait        € 2,80',
    'Croissant           € 1,50',
    'Sparkling water     € 0,90',
    'Süße Teilchen       € 2,20',
    '--------------------------------',
    'SUMME               € 7,40',
    'inkl. MwSt. 7%      € 0,48',
    '',
    'Tschüss & Auf Wiedersehen! ♥',
    'Karte: ****  1337',
  ]);


  // ── 3. Post-processing an existing canvas ────────────────────────────────
  //
  // Build a source canvas with regular canvas2d text, then dot-matrixify it.
  //
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width  = 420;
  srcCanvas.height = 120;
  const sCtx = srcCanvas.getContext('2d');
  sCtx.fillStyle = '#fff';
  sCtx.fillRect(0, 0, 420, 120);
  sCtx.fillStyle = '#000';
  sCtx.font = 'bold 52px serif';
  sCtx.textBaseline = 'middle';
  sCtx.fillText('Hello World!', 20, 60);

  const printer3 = new DotMatrixPrinter(makeCanvas('demo-post', 'POST-PROCESS · blue ink'), {
    mode:            'postprocess',
    dotRadius:       1.6,
    dotSpacing:      4.5,
    intensityJitter: 0.22,
    positionJitter:  0.42,
    shapeJitter:     0.20,
    softEdge:        true,
    inkColor:        [20, 45, 130],
    background:      [248, 245, 232],
  });

  printer3.render(srcCanvas);


  // ── 4. Static with heavy ribbon wear ────────────────────────────────────
  const printer4 = new DotMatrixPrinter(makeCanvas('demo-wear', 'STATIC · heavy ribbon wear'), {
    dotRadius:       1.8,
    dotSpacing:      5.0,
    intensityJitter: 0.30,
    positionJitter:  0.50,
    inkColor:        [32, 28, 28],
    fontSize:        14,
    padding:         18,
    seed:            7,
    ribbonWear: {
      enabled:       true,
      intensity:     0.70,            // heavy — clearly visible faded bands
      bandFrequency: 4.5,
      bandSoftness:  0.45,
    },
  });

  printer4.render(
    'KASSENBON  Nr. 00442\n' +
    '--------------------\n' +
    'Mehl 1kg        0.89\n' +
    'Milch 1l        0.99\n' +
    'Butter 250g     1.79\n' +
    '--------------------\n' +
    'SUMME           3.67\n' +
    'BAR             5.00\n' +
    'RÜCKGELD        1.33'
  );
}

// Run demo only when loaded as a plain <script> in a browser page (not as a module)
if (typeof window !== 'undefined' && document.readyState !== 'loading') {
  // Comment out the line below to suppress the demo:
  // _demo();
} else if (typeof window !== 'undefined') {
  // document.addEventListener('DOMContentLoaded', _demo);
}
