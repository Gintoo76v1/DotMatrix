// ── Text-Print tab wiring ───────────────────────────────────────────────────
// Drives the DotMatrixPrinter component.  Sliders/checks are mirrored into
// the printer's option object and a render is kicked off when any input
// changes.  Renders into the same #outCanvas the main render pipeline uses,
// so pan/zoom controls work transparently.

import { DotMatrixPrinter } from '../dot-matrix-printer.js';

let printer = null;
const opts = {
  fontFamily: '"JetBrains Mono", "Courier New", Courier, monospace',
  fontSize:   15,
  lineHeight: 1.55,
  padding:    20,
  dotRadius:       1.8,
  dotSpacing:      5.0,
  positionJitter:  0.50,
  intensityJitter: 0.24,
  shapeJitter:     0.22,
  softEdge:        true,
  ribbonWear: { enabled: false, intensity: 0.40, bandFrequency: 3.2, bandSoftness: 0.55 },
  animation:  { enabled: false, charsPerSecond: 110, lineDelayMs: 65 },
  inkColor:        [28, 25, 32],
  background:      [255, 255, 255],
};

function bindSlider(id, valId, fmt, apply) {
  const s = document.getElementById(id);
  const v = document.getElementById(valId);
  if (!s || !v) return;
  const onInput = () => {
    const x = +s.value;
    v.textContent = fmt(x);
    apply(x);
  };
  s.addEventListener('input', onInput);
  onInput();
}

function bindCheck(flag, apply) {
  const el = document.querySelector(`.check[data-tp-flag="${flag}"]`);
  if (!el) return;
  apply(el.classList.contains('on'));
  el.addEventListener('click', () => {
    el.classList.toggle('on');
    apply(el.classList.contains('on'));
  });
}

function ensurePrinter(state) {
  const canvas = document.getElementById('outCanvas');
  if (!canvas) return null;
  if (!printer) printer = new DotMatrixPrinter(canvas, opts);
  // Inherit colours from the global state (matches the rest of the app)
  if (state && state.ink) opts.inkColor = state.ink;
  if (state && state.paper) opts.background = state.paper;
  printer.opts = printer._merge(DotMatrixPrinter.DEFAULTS, opts);
  return printer;
}

function renderText(state) {
  const p = ensurePrinter(state);
  const txt = document.getElementById('textPrintInput');
  if (!p || !txt) return;
  p.render(txt.value);
}

export function initTextPrinter(state, opts2 = {}) {
  bindSlider('tpDotRadiusSlider',     'tpDotRadiusVal',     v => (v / 10).toFixed(1),
    v => { opts.dotRadius = v / 10; });
  bindSlider('tpDotSpacingSlider',    'tpDotSpacingVal',    v => (v / 10).toFixed(1),
    v => { opts.dotSpacing = v / 10; });
  bindSlider('tpFontSizeSlider',      'tpFontSizeVal',      v => String(v),
    v => { opts.fontSize = v; });
  bindSlider('tpPosJitterSlider',     'tpPosJitterVal',     v => (v / 100).toFixed(2),
    v => { opts.positionJitter = v / 100; });
  bindSlider('tpIntJitterSlider',     'tpIntJitterVal',     v => (v / 100).toFixed(2),
    v => { opts.intensityJitter = v / 100; });
  bindSlider('tpShapeJitterSlider',   'tpShapeJitterVal',   v => (v / 100).toFixed(2),
    v => { opts.shapeJitter = v / 100; });
  bindSlider('tpWearIntensitySlider', 'tpWearIntensityVal', v => (v / 100).toFixed(2),
    v => { opts.ribbonWear.intensity = v / 100; });
  bindSlider('tpBandFreqSlider',      'tpBandFreqVal',      v => (v / 10).toFixed(1),
    v => { opts.ribbonWear.bandFrequency = v / 10; });
  bindSlider('tpCpsSlider',           'tpCpsVal',           v => String(v),
    v => { opts.animation.charsPerSecond = v; });
  bindSlider('tpLineDelaySlider',     'tpLineDelayVal',     v => String(v),
    v => { opts.animation.lineDelayMs = v; });

  bindCheck('softEdge',   v => { opts.softEdge = v; });
  bindCheck('ribbonWear', v => { opts.ribbonWear.enabled = v; });

  const renderBtn  = document.getElementById('textPrintRenderBtn');
  const animateBtn = document.getElementById('textPrintAnimateBtn');
  const stopBtn    = document.getElementById('textPrintStopBtn');
  const txt        = document.getElementById('textPrintInput');

  if (renderBtn) renderBtn.addEventListener('click', () => {
    opts.animation.enabled = false;
    renderText(state);
  });
  if (animateBtn) animateBtn.addEventListener('click', () => {
    opts.animation.enabled = true;
    renderText(state);
  });
  if (stopBtn) stopBtn.addEventListener('click', () => {
    if (printer) printer.stop();
  });
  // Live re-render on text edits in static mode (debounced)
  if (txt) {
    let t;
    txt.addEventListener('input', () => {
      if (opts.animation.enabled) return; // don't interrupt animation
      clearTimeout(t);
      t = setTimeout(() => renderText(state), 200);
    });
  }
}
