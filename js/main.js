import { state, PROFILES, SYSTEM_PRESETS, WEAR_PATTERNS } from './config.js';
import { render, asciiPreview } from './engine.js';

// ==================== LANGUAGE ====================
const translations = {
  de: { sourceTitle: "Bildquelle", dropzoneBig: "Bild auswählen", profileTitle: "Druckerprofil", adjustTitle: "Bildanpassung", presetsTitle: "Presets", errorsTitle: "Hardware Fehler", advancedTitle: "Erweitert", btnRender: "Manuell Rendern", previewTitle: "Live-Vorschau" },
  en: { sourceTitle: "Image Source", dropzoneBig: "Select Image", profileTitle: "Printer Profile", adjustTitle: "Adjustments", presetsTitle: "Presets", errorsTitle: "Hardware Errors", advancedTitle: "Advanced", btnRender: "Manual Render", previewTitle: "Live Preview" }
};
function applyLanguage(lang) {
  const dict = translations[lang] || translations.de;
  document.querySelectorAll('[data-i18n]').forEach(el => { const key = el.getAttribute('data-i18n'); if (dict[key]) el.textContent = dict[key]; });
}

// ==================== PRO AUDIO SYSTEM ====================
let audioCtx = null;
const initAudio = () => {
  if (!audioCtx) { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
  if (audioCtx.state === 'suspended') { audioCtx.resume(); }
};
document.addEventListener('touchstart', initAudio, { once: true });
document.addEventListener('mousedown', initAudio, { once: true });

function playClickSound() {
  if (!state.uiSounds || !audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
  osc.type = 'triangle'; osc.frequency.setValueAtTime(600, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.03);
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.03);
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime + 0.03);
}

document.addEventListener('pointerup', (e) => {
  if (isDragging) return; 
  if (e.target.closest('button, .icon-btn, .sli, .swatch, .check, .er-head, .dropzone, input[type="range"], .color-picker')) playClickSound();
  if (['BUTTON','INPUT','SELECT'].includes(e.target.tagName)) return;
  const r = document.createElement('div'); r.className = 'click-shockwave';
  r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
  document.body.appendChild(r); setTimeout(() => r.remove(), 600); 
});

// ==================== PAN, ZOOM & LOUPE SYSTEM ====================
const zoomContainer = document.getElementById('zoomContainer');
const canvasWrapper = document.getElementById('canvasWrapper');
const zoomLevelText = document.getElementById('zoomLevel');
const loupe = document.getElementById('loupe');
const loupeCanvas = document.getElementById('loupeCanvas');
const outCanvas = document.getElementById('outCanvas');

let currentZoom = 1; let panX = 0, panY = 0;
let isDragging = false; let startX, startY; let pointers = [];
let isLoupeActive = false;

document.getElementById('loupeToggle').onclick = (e) => {
  isLoupeActive = !isLoupeActive;
  e.currentTarget.classList.toggle('active', isLoupeActive);
  loupe.style.display = isLoupeActive ? 'block' : 'none';
};

function updateTransform(smooth = false) {
  zoomContainer.style.transition = smooth ? 'transform 0.2s ease-out' : 'none';
  zoomContainer.style.transform = `translate(${panX}px, ${panY}px) scale(${currentZoom})`;
  zoomLevelText.textContent = `${Math.round(currentZoom * 100)}%`;
}

canvasWrapper.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button')) return; 
  pointers.push(e);
  if (pointers.length === 1) {
    isDragging = true; startX = e.clientX - panX; startY = e.clientY - panY;
    canvasWrapper.setPointerCapture(e.pointerId);
  }
});

canvasWrapper.addEventListener('pointermove', (e) => {
  if (isLoupeActive && state.sourceImage && outCanvas.width > 0) {
    const rect = outCanvas.getBoundingClientRect();
    if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
      loupe.style.left = (e.clientX - 80) + 'px'; loupe.style.top = (e.clientY - 80) + 'px';
      const scaleX = outCanvas.width / rect.width; const scaleY = outCanvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX; const y = (e.clientY - rect.top) * scaleY;
      const lctx = loupeCanvas.getContext('2d'); lctx.clearRect(0,0,160,160);
      const sSize = 160 / 3; // 3x Zoom
      lctx.drawImage(outCanvas, x - sSize/2, y - sSize/2, sSize, sSize, 0, 0, 160, 160);
    }
  }
  const index = pointers.findIndex(p => p.pointerId === e.pointerId);
  if (index !== -1) pointers[index] = e;

  if (pointers.length === 1 && isDragging) {
    panX = e.clientX - startX; panY = e.clientY - startY; updateTransform(false);
  } else if (pointers.length === 2) {
    const dist = Math.hypot(pointers[0].clientX - pointers[1].clientX, pointers[0].clientY - pointers[1].clientY);
    if (!canvasWrapper.lastDist) { canvasWrapper.lastDist = dist; return; }
    currentZoom = Math.max(0.2, Math.min(currentZoom + (dist - canvasWrapper.lastDist) * 0.01, 5));
    updateTransform(false); canvasWrapper.lastDist = dist;
  }
});

const pointerUp = (e) => {
  pointers = pointers.filter(p => p.pointerId !== e.pointerId);
  if (pointers.length < 2) canvasWrapper.lastDist = null;
  if (pointers.length === 0) { setTimeout(() => { isDragging = false; }, 50); canvasWrapper.releasePointerCapture(e.pointerId); }
};
canvasWrapper.addEventListener('pointerup', pointerUp); canvasWrapper.addEventListener('pointercancel', pointerUp);

canvasWrapper.addEventListener('wheel', (e) => {
  e.preventDefault(); 
  if (e.ctrlKey || e.metaKey) { currentZoom = Math.max(0.2, Math.min(currentZoom - (e.deltaY > 0 ? 0.1 : -0.1), 5)); } 
  else { panX -= e.deltaX; panY -= e.deltaY; }
  updateTransform(false);
}, {passive: false});

document.getElementById('zoomIn').addEventListener('click', () => { currentZoom = Math.min(currentZoom + 0.25, 5); updateTransform(true); });
document.getElementById('zoomOut').addEventListener('click', () => { currentZoom = Math.max(currentZoom - 0.25, 0.2); updateTransform(true); });

// ==================== RENDERING & AUTO-RENDER ====================
let lastRenderedBlob = null;
const renderBtn = document.getElementById("renderBtn"); 
const downloadBtn = document.getElementById("downloadBtn"); 
let isRendering = false; 

const statusEl = document.getElementById("status");
function setStatus(text, working = false) {
  statusEl.textContent = text;
  statusEl.style.color = working ? "var(--ink)" : "var(--accent)";
}

const triggerUpdate = (function() {
  let t; return () => { 
    clearTimeout(t); t = setTimeout(() => { if (state.autoRender) performRender(); }, 300); 
  };
})();

async function performRender() {
  if (!state.sourceImage || isRendering) return; isRendering = true;
  renderBtn.disabled = true; setStatus("Rendern...", true);
  try {
    const { imageData, width, height } = await render(state.sourceImage, msg => setStatus(msg, true));
    outCanvas.width = width; outCanvas.height = height; outCanvas.getContext("2d").putImageData(imageData, 0, 0);
    outCanvas.toBlob(blob => { lastRenderedBlob = blob; downloadBtn.disabled = false; }, "image/png");
    setStatus(`${width}×${height} px ready`);
  } catch (e) { console.error(e); setStatus("Fehler"); }
  isRendering = false; renderBtn.disabled = false;
}

// ==================== PRESET SYSTEM ====================
function presetToYaml(preset) {
  const SKIP = new Set(['id', 'system']); const lines = [];
  for (const [k, v] of Object.entries(preset)) {
    if (SKIP.has(k)) continue;
    if (Array.isArray(v)) {
      if (v.length === 0) lines.push(`${k}: []`);
      else if (typeof v[0] === 'number') lines.push(`${k}: [${v.join(', ')}]`);
      else { lines.push(`${k}:`); for (const obj of v) { const entries = Object.entries(obj); lines.push(`  - ${entries[0][0]}: ${entries[0][1]}`); for (let i = 1; i < entries.length; i++) lines.push(`    ${entries[i][0]}: ${entries[i][1]}`); } }
    } else if (v === null) lines.push(`${k}: null`); else lines.push(`${k}: ${v}`);
  } return lines.join('\n');
}

function yamlToPreset(yaml) {
  const preset = {}; const lines = yaml.split('\n'); let currentArrayKey = null; let currentObj = null;
  for (const raw of lines) {
    const trimmed = raw.trim(); if (!trimmed || trimmed.startsWith('#')) continue; const indent = raw.search(/\S/);
    if (indent === 0) {
      currentArrayKey = null; currentObj = null; const ci = trimmed.indexOf(':'); if (ci === -1) continue;
      const key = trimmed.slice(0, ci).trim(); const val = trimmed.slice(ci + 1).trim();
      if (!val) { currentArrayKey = key; preset[key] = []; }
      else if (val === '[]') preset[key] = []; else if (val === 'null') preset[key] = null; else if (val === 'true') preset[key] = true; else if (val === 'false') preset[key] = false;
      else if (val.startsWith('[')) { const inner = val.slice(1, val.lastIndexOf(']')); preset[key] = inner.split(',').map(s => isNaN(parseFloat(s.trim())) ? s.trim() : parseFloat(s.trim())); }
      else { preset[key] = isNaN(parseFloat(val)) ? val : parseFloat(val); }
    } else if (indent === 2 && trimmed.startsWith('- ') && currentArrayKey) {
      const inner = trimmed.slice(2).trim(); const ci = inner.indexOf(':'); if (ci === -1) continue;
      const k = inner.slice(0, ci).trim(); const vr = inner.slice(ci + 1).trim(); currentObj = { [k]: isNaN(parseFloat(vr)) ? vr : parseFloat(vr) }; preset[currentArrayKey].push(currentObj);
    } else if (indent === 4 && currentObj !== null) {
      const ci = trimmed.indexOf(':'); if (ci === -1) continue;
      const k = trimmed.slice(0, ci).trim(); const vr = trimmed.slice(ci + 1).trim(); currentObj[k] = isNaN(parseFloat(vr)) ? vr : parseFloat(vr);
    }
  } return preset;
}

const STORAGE_KEY = 'dotmatrix_user_presets';
function loadUserPresets() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
function saveUserPresets(presets) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(presets)); } catch {} }
function deleteUserPreset(id) { saveUserPresets(loadUserPresets().filter(p => p.id !== id)); renderPresetList(); }

function captureCurrentPreset(name) {
  return {
    name: name || 'Unnamed', system: false, profile: state.profile, brightness: state.brightness, contrast: state.contrast, gamma: state.gamma, dither: state.dither, threshold: state.threshold, ink: [...state.ink], paper: [...state.paper], paperFormat: state.paperFormat, orientation: state.orientation, doubleStrike: state.doubleStrike, condensed: state.condensed, softBlur: state.softBlur, invert: state.invert, dpi: state.dpi, jitterScale: state.jitterScale, bandingScale: state.bandingScale, maxSize: state.maxSize, seed: state.seed, wearLayers: state.wearLayers.map(l => ({ ...l }))
  };
}

let activePresetId = null;

function applyPreset(p) {
  if (!p) return; 
  if (p.profile) state.profile = p.profile;
  const setS = (id, vid, v) => { const e=document.getElementById(id); if(e){ e.value=v; document.getElementById(vid).textContent=v; state[id.replace('Slider','')] = v; }};
  if (p.brightness !== undefined) setS('brightnessSlider', 'brightnessVal', p.brightness);
  if (p.contrast !== undefined) setS('contrastSlider', 'contrastVal', p.contrast);
  if (p.gamma !== undefined) setS('gammaSlider', 'gammaVal', p.gamma);
  if (p.threshold !== undefined) setS('thresholdSlider', 'thresholdVal', p.threshold);
  if (p.dpi !== undefined) setS('dpiSlider', 'dpiVal', p.dpi);
  if (p.jitterScale !== undefined) setS('jitterSlider', 'jitterVal', p.jitterScale);
  if (p.bandingScale !== undefined) setS('bandingSlider', 'bandingVal', p
