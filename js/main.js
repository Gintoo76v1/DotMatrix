// ── Application entry point ────────────────────────────────────────────────
//
// Wires together the UI modules. All complex behaviour lives in the
// per-feature modules under js/ui/* and js/*.js so this file stays small
// and easy to read end-to-end.

import { state, PROFILES } from './config.js';
import { renderImage } from './render-client.js';
import { hydrateState } from './settings-store.js';

import { initErrorPopup, showError } from './ui/error.js';
import { initAudio, playClickSound, playToggleSound } from './ui/audio.js';
import { initZoom, dragState } from './ui/zoom.js';
import { registerSlider, wireSlider, syncAllFromState } from './ui/sliders.js';
import { wireSegmented } from './ui/segments.js';
import { wireSwatches, wireCustomInk } from './ui/swatches.js';
import { initChecks } from './ui/checks.js';
import { initWearLayers } from './ui/wear.js';
import { initUpload } from './ui/upload.js';
import { initPresets, renderPresetList } from './ui/presets.js';
import { initAppearance } from './ui/appearance.js';
import { initChangelog } from './ui/changelog.js';

// ── Bootstrap ──────────────────────────────────────────────────────────────

const persisted = hydrateState(state);
initErrorPopup();
initAudio();
initZoom();

/* initTabs wurde aus dem gelöschten theme.js hierher migriert */
function initTabs() {
  document.querySelectorAll('.activity-bar .icon-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.activity-bar .icon-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
      const tab = document.getElementById(btn.dataset.tab);
      if (tab) tab.classList.add('active');
    });
  });
}
initTabs();

// ── Touch-scroll guard (mobile) ────────────────────────────────────────────
// Removed: passive: false + preventDefault() broke native scrolling on iOS.
// CSS overscroll-behavior: contain on scrollable elements is sufficient.

// ── Render orchestration ───────────────────────────────────────────────────

const outCanvas  = document.getElementById('outCanvas');
const renderBtn  = document.getElementById('renderBtn');
const downloadBtn = document.getElementById('downloadBtn');
const statusEl   = document.getElementById('status');

let lastRenderedBlob = null;
let isRendering = false;

function setStatus(text, working = false) {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.style.color = working ? 'var(--ink)' : 'var(--accent)';
}

export const triggerUpdate = (() => {
  let t;
  return () => {
    clearTimeout(t);
    t = setTimeout(() => { if (state.autoRender) performRender(); }, 300);
  };
})();

async function performRender() {
  if (!state.sourceImage || isRendering) return;
  isRendering = true;
  if (renderBtn) renderBtn.disabled = true;
  setStatus('Rendern...', true);

  try {
    const { imageData, width, height } = await renderImage(state.sourceImage,
      msg => setStatus(msg, true));

    if (outCanvas) {
      outCanvas.width = width;
      outCanvas.height = height;
      const ctx = outCanvas.getContext('2d');
      ctx.putImageData(imageData, 0, 0);

      if (state.renderDebug) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(8, 8, 280, 110);
        ctx.strokeStyle = '#00ff41';
        ctx.lineWidth = 1;
        ctx.strokeRect(8, 8, 280, 110);
        const terminalFont = state._terminalFontStack || 'monospace';
        ctx.font = `11px ${terminalFont}`;
        ctx.fillStyle = '#00ff41';
        const p = PROFILES[state.profile];
        const lines = [
          `Profile: ${p?.label || state.profile}`,
          `Size: ${width}x${height}`,
          `DPI: ${state.dpi}  Dither: ${state.dither}`,
          `Gamma: ${state.gamma}  Bright: ${state.brightness}`,
          `Contrast: ${state.contrast}  Jitter: ${state.jitterScale}`,
          `Wear: ${state.wearLayers.length} layers`,
        ];
        lines.forEach((line, i) => {
          ctx.fillText(line, 16, 28 + i * 14);
        });
      }

      outCanvas.toBlob((blob) => {
        lastRenderedBlob = blob;
        if (downloadBtn) downloadBtn.disabled = false;
      }, 'image/png');
    }
    setStatus(`${width}×${height} px ready`);
  } catch (e) {
    showError(`[Render Engine Absturz]: ${e.message}`);
    setStatus('Render Error');
  } finally {
    isRendering = false;
    if (renderBtn) renderBtn.disabled = false;
  }
}

// ── Slider registry ────────────────────────────────────────────────────────

registerSlider({ sliderId: 'thresholdSlider',  valueId: 'thresholdVal',  stateKey: 'threshold'    });
registerSlider({ sliderId: 'brightnessSlider', valueId: 'brightnessVal', stateKey: 'brightness'   });
registerSlider({ sliderId: 'contrastSlider',   valueId: 'contrastVal',   stateKey: 'contrast'     });
registerSlider({ sliderId: 'gammaSlider',      valueId: 'gammaVal',      stateKey: 'gamma',
  format: v => (+v).toFixed(1) });
registerSlider({ sliderId: 'dpiSlider',        valueId: 'dpiVal',        stateKey: 'dpi'          });
registerSlider({ sliderId: 'jitterSlider',     valueId: 'jitterVal',     stateKey: 'jitterScale',
  transform: v => +v / 10, inverse: v => v * 10, format: v => (+v).toFixed(1) });
registerSlider({ sliderId: 'bandingSlider',    valueId: 'bandingVal',    stateKey: 'bandingScale',
  transform: v => +v / 10, inverse: v => v * 10, format: v => (+v).toFixed(1) });
registerSlider({ sliderId: 'maxSizeSlider',    valueId: 'maxSizeVal',    stateKey: 'maxSize'      });
registerSlider({ sliderId: 'seedSlider',       valueId: 'seedVal',       stateKey: 'seed'         });

for (const key of [
  'threshold', 'brightness', 'contrast', 'gamma', 'dpi',
  'jitterScale', 'bandingScale', 'maxSize', 'seed',
]) {
  wireSlider(state, key, () => triggerUpdate());
}

// ── Segmented buttons ──────────────────────────────────────────────────────

wireSegmented('ditherBtns', state, 'dither', 'dither', () => {
  const tf = document.getElementById('thresholdField');
  if (tf) tf.style.display = state.dither === 'threshold' ? 'block' : 'none';
  triggerUpdate();
});
wireSegmented('paperFormatBtns', state, 'paperFormat', 'format', triggerUpdate);
wireSegmented('orientationBtns', state, 'orientation', 'orient', triggerUpdate);

// ── Swatches ───────────────────────────────────────────────────────────────

wireSwatches('inkSwatches',   state, 'ink',   'ink',   triggerUpdate);
wireSwatches('paperSwatches', state, 'paper', 'paper', triggerUpdate);
wireCustomInk(state, triggerUpdate);

// ── Profile list ───────────────────────────────────────────────────────────

function updateProfileMeta() {
  const p = PROFILES[state.profile];
  const pm = document.getElementById('profileMeta');
  if (p && pm) pm.textContent = `${p.pins}-pin · ${p.dpi_h}×${p.dpi_v} dpi`;
}

const profileList = document.getElementById('profileList');
if (profileList) {
  profileList.addEventListener('click', (e) => {
    const item = e.target.closest('.sli');
    if (!item) return;
    document.querySelectorAll('#profileList .sli').forEach(s => s.classList.remove('active'));
    item.classList.add('active');
    state.profile = item.dataset.profile;
    updateProfileMeta();
    triggerUpdate();
  });
}

// ── Boolean checks (uiSounds, autoRender, legacyMath, useWorker, …) ────────

initChecks(state, (flag) => {
  if (flag === 'invert' || flag === 'softBlur' || flag === 'doubleStrike' ||
      flag === 'condensed' || flag === 'legacyMath') {
    triggerUpdate();
  }
});

// ── Wear-layer UI ──────────────────────────────────────────────────────────

initWearLayers(state, triggerUpdate);

// ── Upload + presets ───────────────────────────────────────────────────────

initUpload(state, {
  setStatus,
  onLoad: () => {
    syncAllFromState(state);
    updateProfileMeta();
    triggerUpdate();
  },
});

initPresets({
  onApply: () => { updateProfileMeta(); triggerUpdate(); },
  onSetStatus: setStatus,
});

// ── Appearance (theme, fonts, animation) ─────────────────────────────────────

initAppearance(persisted);
initChangelog();

// ── Custom event bridge (avoids circular imports) ──────────────────────────

document.addEventListener('dm:triggerRender', () => {
  triggerUpdate();
});

// ── Click sounds on every interactive element ─────────────────────────────

const INTERACTIVE_SELECTOR = 'button, .icon-btn, .sli, .swatch, .check, .er-head, .dropzone, input[type="range"], .color-picker, .segmented button, select, .btn-sm, .changelog-close, .settings-search-clear, textarea, .zoom-controls button, .footer-version';

document.addEventListener('click', (e) => {
  if (!state.uiSounds) return;
  const el = e.target.closest(INTERACTIVE_SELECTOR);
  if (el) {
    // Toggle sounds for checkboxes
    if (el.classList.contains('check')) {
      const isOn = el.classList.contains('on');
      playToggleSound(!isOn);
    } else {
      playClickSound();
    }
  }
});

// ── Pointer-up: ripple effect ──────────────────────────────────────────────

document.addEventListener('pointerup', (e) => {
  if (dragState.hasDragged) return;
  if (['BUTTON', 'INPUT', 'SELECT'].includes(e.target.tagName)) return;

  const r = document.createElement('div');
  r.className = 'click-shockwave';
  r.style.left = e.clientX + 'px';
  r.style.top  = e.clientY + 'px';
  document.body.appendChild(r);
  setTimeout(() => r.remove(), 600);
});

// ── Final wiring ───────────────────────────────────────────────────────────

if (renderBtn) renderBtn.addEventListener('click', performRender);
if (downloadBtn) downloadBtn.addEventListener('click', () => {
  if (!lastRenderedBlob) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(lastRenderedBlob);
  a.download = `print_${Date.now()}.png`;
  a.click();
});

renderPresetList();
updateProfileMeta();
syncAllFromState(state);
