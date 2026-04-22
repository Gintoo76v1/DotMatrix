import { state, PROFILES, SYSTEM_PRESETS, WEAR_PATTERNS } from './config.js';
import { render } from './engine.js';

// ==================== GLOBAL ERROR CATCHER ====================
function showError(msg) {
  const pop = document.getElementById('errorPopup');
  const txt = document.getElementById('errorText');
  if(pop && txt) {
    txt.textContent = msg;
    pop.classList.add('show');
    setTimeout(() => pop.classList.remove('show'), 7000); 
  } else {
    console.error(msg); 
  }
}

const errorCloseBtn = document.getElementById('errorCloseBtn');
if (errorCloseBtn) {
  errorCloseBtn.onclick = () => { document.getElementById('errorPopup').classList.remove('show'); };
}

window.onerror = function(message, source, lineno, colno, error) {
  showError(`[JS Fehler]: ${message} (Zeile ${lineno})`); return false; 
};
window.addEventListener('unhandledrejection', function(event) {
  showError(`[Promise Fehler]: ${event.reason}`);
});

// ==================== LANGUAGE ====================
const translations = {
  de: { sourceTitle: "Bildquelle", dropzoneBig: "Bild auswählen", profileTitle: "Druckerprofil", adjustTitle: "Bildanpassung", presetsTitle: "Presets", errorsTitle: "Hardware Fehler", advancedTitle: "Erweitert", btnRender: "Manuell Rendern", previewTitle: "Live-Vorschau" },
  en: { sourceTitle: "Image Source", dropzoneBig: "Select Image", profileTitle: "Printer Profile", adjustTitle: "Adjustments", presetsTitle: "Presets", errorsTitle: "Hardware Errors", advancedTitle: "Advanced", btnRender: "Manual Render", previewTitle: "Live Preview" }
};
function applyLanguage(lang) {
  try {
    const dict = translations[lang] || translations.de;
    document.querySelectorAll('[data-i18n]').forEach(el => { const key = el.getAttribute('data-i18n'); if (dict[key]) el.textContent = dict[key]; });
  } catch(e) { showError(`[Language Fehler]: ${e.message}`); }
}

// ==================== PRO AUDIO SYSTEM ====================
let audioCtx = null;
const initAudio = () => {
  try {
    if (!audioCtx) { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    if (audioCtx.state === 'suspended') { audioCtx.resume(); }
  } catch(e) { console.warn("Audio konnte nicht initialisiert werden.", e); }
};
document.addEventListener('touchstart', initAudio, { once: true, passive: true });
document.addEventListener('mousedown', initAudio, { once: true, passive: true });

function playClickSound() {
  if (!state.uiSounds || !audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.type = 'triangle'; osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.03);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.03);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.03);
  } catch(e) {} 
}

let isDragging = false;
document.addEventListener('pointerup', (e) => {
  if (isDragging) return; 
  if (!audioCtx) initAudio(); else if (audioCtx.state === 'suspended') audioCtx.resume();
  
  if (e.target.closest('button, .icon-btn, .sli, .swatch, .check, .er-head, .dropzone, input[type="range"], .color-picker')) playClickSound();
  if (['BUTTON','INPUT','SELECT'].includes(e.target.tagName)) return;
  
  const r = document.createElement('div'); r.className = 'click-shockwave';
  r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
  document.body.appendChild(r); setTimeout(() => r.remove(), 600); 
});

// ==================== PAN & ZOOM SYSTEM ====================
const zoomContainer = document.getElementById('zoomContainer');
const canvasWrapper = document.getElementById('canvasWrapper');
const zoomLevelText = document.getElementById('zoomLevel');
const outCanvas = document.getElementById('outCanvas');

let currentZoom = 1; let panX = 0, panY = 0;
let startX, startY; let pointers = [];

function updateTransform(smooth = false) {
  if (!zoomContainer || !zoomLevelText) return;
  zoomContainer.style.transition = smooth ? 'transform 0.2s ease-out' : 'none';
  zoomContainer.style.transform = `translate(${panX}px, ${panY}px) scale(${currentZoom})`;
  zoomLevelText.textContent = `${Math.round(currentZoom * 100)}%`;
}

if (canvasWrapper) {
  
  // Nativer Blocker: Verbietet Safari, das Canvas beim Draggen wie eine Webseite zu verschieben
  canvasWrapper.addEventListener('touchmove', (e) => {
    e.preventDefault();
  }, { passive: false });

  canvasWrapper.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return; 
    pointers.push(e);
    if (pointers.length === 1) {
      isDragging = true; startX = e.clientX - panX; startY = e.clientY - panY;
      canvasWrapper.setPointerCapture(e.pointerId);
    }
  });

  canvasWrapper.addEventListener('pointermove', (e) => {
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
  canvasWrapper.addEventListener('pointerup', pointerUp);
  canvasWrapper.addEventListener('pointercancel', pointerUp);

  canvasWrapper.addEventListener('wheel', (e) => {
    e.preventDefault(); 
    if (e.ctrlKey || e.metaKey) { currentZoom = Math.max(0.2, Math.min(currentZoom - (e.deltaY > 0 ? 0.1 : -0.1), 5)); } 
    else { panX -= e.deltaX; panY -= e.deltaY; }
    updateTransform(false);
  }, {passive: false});
}

const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
if (zoomInBtn) zoomInBtn.addEventListener('click', () => { currentZoom = Math.min(currentZoom + 0.25, 5); updateTransform(true); });
if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => { currentZoom = Math.max(currentZoom - 0.25, 0.2); updateTransform(true); });

// ==================== RENDERING ====================
let lastRenderedBlob = null;
const renderBtn = document.getElementById("renderBtn"); 
const downloadBtn = document.getElementById("downloadBtn"); 
let isRendering = false; 

const statusEl = document.getElementById("status");
function setStatus(text, working = false) {
  if (statusEl) {
    statusEl.textContent = text;
    statusEl.style.color = working ? "var(--ink)" : "var(--accent)";
  }
}

const triggerUpdate = (function() {
  let t; return () => { 
    clearTimeout(t); t = setTimeout(() => { if (state.autoRender) performRender(); }, 300); 
  };
})();

async function performRender() {
  if (!state.sourceImage || isRendering) return; 
  try {
    isRendering = true;
    if (renderBtn) renderBtn.disabled = true; 
    setStatus("Rendern...", true);
    
    const { imageData, width, height } = await render(state.sourceImage, msg => setStatus(msg, true));
    
    if (outCanvas) {
      outCanvas.width = width; outCanvas.height = height; 
      outCanvas.getContext("2d").putImageData(imageData, 0, 0);
      outCanvas.toBlob(blob => { lastRenderedBlob = blob; if(downloadBtn) downloadBtn.disabled = false; }, "image/png");
    }
    
    setStatus(`${width}×${height} px ready`);
  } catch (e) { 
    showError(`[Render Engine Absturz]: ${e.message}`);
    setStatus("Render Error");
  } finally {
    isRendering = false; 
    if (renderBtn) renderBtn.disabled = false;
  }
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
      if (!val) { currentArrayKey = key; preset[key] = []; } else if (val === '[]') preset[key] = []; else if (val === 'null') preset[key] = null; else if (val === 'true') preset[key] = true; else if (val === 'false') preset[key] = false;
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
function saveUserPresets(presets) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(presets)); } catch(e) { showError(`[Speicher Fehler]: ${e.message}`); } }
function deleteUserPreset(id) { saveUserPresets(loadUserPresets().filter(p => p.id !== id)); renderPresetList(); }

function captureCurrentPreset(name) {
  return {
    name: name || 'Unnamed', system: false, profile: state.profile, brightness: state.brightness, contrast: state.contrast, gamma: state.gamma, dither: state.dither, threshold: state.threshold, ink: [...state.ink], paper: [...state.paper], paperFormat: state.paperFormat, orientation: state.orientation, doubleStrike: state.doubleStrike, condensed: state.condensed, softBlur: state.softBlur, invert: state.invert, dpi: state.dpi, jitterScale: state.jitterScale, bandingScale: state.bandingScale, maxSize: state.maxSize, seed: state.seed, wearLayers: state.wearLayers.map(l => ({ ...l }))
  };
}

let activePresetId = null;

function applyPreset(p) {
  try {
    if (!p) return; 
    if (p.profile) state.profile = p.profile;
    const setS = (id, vid, v) => { const e=document.getElementById(id); if(e && v!==undefined){ e.value=v; document.getElementById(vid).textContent=v; state[id.replace('Slider','')] = parseFloat(v); }};
    if (p.brightness !== undefined) setS('brightnessSlider', 'brightnessVal', p.brightness);
    if (p.contrast !== undefined) setS('contrastSlider', 'contrastVal', p.contrast);
    if (p.gamma !== undefined) setS('gammaSlider', 'gammaVal', p.gamma);
    if (p.threshold !== undefined) setS('thresholdSlider', 'thresholdVal', p.threshold);
    if (p.dpi !== undefined) setS('dpiSlider', 'dpiVal', p.dpi);
    if (p.jitterScale !== undefined) setS('jitterSlider', 'jitterVal', p.jitterScale * 10);
    if (p.bandingScale !== undefined) setS('bandingSlider', 'bandingVal', p.bandingScale * 10);
    if (p.maxSize !== undefined) setS('maxSizeSlider', 'maxSizeVal', p.maxSize);
    
    if (p.dither) { state.dither = p.dither; document.querySelectorAll('#ditherBtns button').forEach(b => b.classList.toggle('active', b.dataset.dither === p.dither)); const tf = document.getElementById('thresholdField'); if(tf) tf.style.display = p.dither === 'threshold'?'block':'none'; }
    if (p.paperFormat) { state.paperFormat = p.paperFormat; document.querySelectorAll('#paperFormatBtns button').forEach(b => b.classList.toggle('active', b.dataset.format === p.paperFormat)); }
    if (p.orientation) { state.orientation = p.orientation; document.querySelectorAll('#orientationBtns button').forEach(b => b.classList.toggle('active', b.dataset.orient === p.orientation)); }
    
    if (p.ink) {
      state.ink = p.ink; const inkStr = p.ink.join(','); let found = false;
      document.querySelectorAll('#inkSwatches .swatch:not(.custom-swatch)').forEach(s => { const m = s.dataset.ink === inkStr; s.classList.toggle('active', m); if (m) found = true; });
      const custom = document.getElementById('customInkSwatch');
      const pick = document.getElementById('inkColorPicker');
      const hexIn = document.getElementById('inkHexInput');
      if (!found && custom && pick && hexIn) { const hex = "#" + p.ink.map(x => x.toString(16).padStart(2, '0')).join(''); custom.dataset.ink = inkStr; custom.style.background = hex; custom.classList.add('active'); pick.value = hex; hexIn.value = hex; }
      else if (custom) custom.classList.remove('active');
    }
    
    if (p.paper !== undefined) {
      if (p.paper === null) {
        if (state.sourceImage) detectAndSetPaperColor(state.sourceImage);
        else { state.paper = [255, 255, 255]; document.querySelectorAll('#paperSwatches .swatch').forEach(s => s.classList.toggle('active', s.dataset.paper === "255,255,255")); }
      } else {
        state.paper = p.paper; const paperStr = p.paper.join(',');
        document.querySelectorAll('#paperSwatches .swatch').forEach(s => s.classList.toggle('active', s.dataset.paper === paperStr));
      }
    }

    state.doubleStrike = !!p.doubleStrike; state.condensed = !!p.condensed; state.softBlur = !!p.softBlur; state.invert = !!p.invert;
    
    if (p.wearLayers !== undefined) {
      state.wearLayers = p.wearLayers.map(l => ({ ...l }));
      document.querySelectorAll('#errorList .er').forEach(el => { el.classList.remove('on'); const valEl = el.querySelector('.er-val'); if(valEl) valEl.textContent = '0%'; });
      for (const layer of p.wearLayers) {
        const el = document.querySelector(`#errorList .er[data-pattern="${layer.pattern}"]`);
        if (el) { el.classList.add('on'); const s = el.querySelector('.er-slider'); const v = el.querySelector('.er-val'); if(s) s.value = layer.strength ?? 50; if(v) v.textContent = (layer.strength ?? 50) + '%'; }
      }
    }
    updateUIFromState(); updateProfileMeta(); triggerUpdate();
  } catch(e) { showError(`[Preset Apply Fehler]: ${e.message}`); }
}

function updateUIFromState() {
  document.querySelectorAll('#profileList .sli').forEach(s => s.classList.toggle('active', s.dataset.profile === state.profile));
  document.querySelectorAll('.check').forEach(c => c.classList.toggle('on', state[c.dataset.flag]));
}

function renderPresetList() {
  try {
    const list = document.getElementById('presetList');
    if(!list) return;
    list.innerHTML = '';
    const allPresets = [...(SYSTEM_PRESETS || []), ...loadUserPresets()];
    allPresets.forEach(p => {
      const el = document.createElement('div'); el.className = 'sli' + (p.id === activePresetId ? ' active' : '');
      if(p.system) { 
        el.innerHTML = `<div class="sli-row" style="width:100%;"><span class="sli-name">${p.name}</span><span class="sli-badge">SYS</span></div>`; 
      } else { 
        el.innerHTML = `<div class="sli-row" style="width:100%;"><span class="sli-name">${p.name}</span><div><span class="sli-badge" style="margin-right:5px;">USR</span><button class="sli-del" title="Löschen">×</button></div></div>`; 
        el.querySelector('.sli-del').addEventListener('click', (e) => { e.stopPropagation(); if(confirm(`Preset "${p.name}" löschen?`)) { if(activePresetId === p.id) activePresetId = null; deleteUserPreset(p.id); }}); 
      }
      el.addEventListener('click', () => { activePresetId = p.id; document.querySelectorAll('#presetList .sli').forEach(s => s.classList.remove('active')); el.classList.add('active'); applyPreset(p); });
      list.appendChild(el);
    });
  } catch(e) { showError(`[Preset Liste Fehler]: ${e.message}`); }
}

function downloadText(text, filename) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); }
document.getElementById('exportPresetBtn').addEventListener('click', () => { let name = document.getElementById('presetNameInput').value.trim(); if (!name) { name = prompt('Preset Name:', 'My Preset'); if (!name) return; document.getElementById('presetNameInput').value = name; } downloadText(presetToYaml(captureCurrentPreset(name)), `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.yaml`); });
document.getElementById('exportCurrentBtn').addEventListener('click', () => { const name = document.getElementById('presetNameInput').value.trim() || 'my-preset'; const yaml = presetToYaml(captureCurrentPreset(name)); document.getElementById('presetYamlArea').value = yaml; downloadText(yaml, `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.yaml`); });
document.getElementById('importPresetBtn').addEventListener('click', () => document.getElementById('presetFileInput').click());
document.getElementById('presetFileInput').addEventListener('change', async (e) => { const file = e.target.files[0]; if (!file) return; importFromText(await file.text()); e.target.value = ''; });
document.getElementById('savePresetBtn').addEventListener('click', () => { const name = document.getElementById('presetNameInput').value.trim(); if (!name) return showError('Name für das Preset ist erforderlich.'); const preset = captureCurrentPreset(name); preset.id = 'usr_'+Date.now(); const presets = loadUserPresets(); presets.push(preset); saveUserPresets(presets); activePresetId = preset.id; renderPresetList(); setStatus(`Gespeichert.`); });
document.getElementById('importYamlBtn').addEventListener('click', () => { const text = document.getElementById('presetYamlArea').value.trim(); if (!text) return showError('Bitte füge YAML Code in das Textfeld ein!'); importFromText(text); });

function importFromText(text) {
  try {
    const stripped = text.trim();
    let preset = stripped.startsWith('{') ? JSON.parse(stripped) : yamlToPreset(stripped);
    if (!preset.name) preset.name = 'Imported';
    applyPreset(preset); setStatus(`Importiert.`);
    if (preset.name !== 'Imported') { preset.id = 'usr_' + Date.now(); preset.system = false; const presets = loadUserPresets(); presets.push(preset); saveUserPresets(presets); activePresetId = preset.id; renderPresetList(); }
  } catch (err) { showError(`[YAML Import Fehler]: Das Format des Codes ist ungültig. (${err.message})`); }
}

// ==================== IMAGE ANALYSIS ====================
function detectAndSetPaperColor(img) {
  try {
    const c = document.createElement("canvas"); c.width = 64; c.height = 64; const ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0, 64, 64);
    const data = ctx.getImageData(0, 0, 64, 64).data; let r = 0, g = 0, b = 0, count = 0;
    for (let y = 4; y < 60; y++) { for (let x = 4; x < 60; x++) { const idx = (y * 64 + x) * 4; r += data[idx]; g += data[idx+1]; b += data[idx+2]; count++; } }
    r = Math.round(r/count); g = Math.round(g/count); b = Math.round(b/count);
    let bestSwatch = null, minDist = Infinity;
    document.querySelectorAll('#paperSwatches .swatch').forEach(sw => {
      if(!sw.dataset.paper) return; const rgb = sw.dataset.paper.split(",").map(Number);
      const dist = (r-rgb[0])**2 + (g-rgb[1])**2 + (b-rgb[2])**2; if (dist < minDist) { minDist = dist; bestSwatch = sw; }
    });
    if (bestSwatch) { document.querySelectorAll('#paperSwatches .swatch').forEach(s => s.classList.remove("active")); bestSwatch.classList.add("active"); state.paper = bestSwatch.dataset.paper.split(",").map(Number); }
  } catch (e) { console.warn(e); }
}

function analyzeAndAdaptImage(img) {
  try {
    const c = document.createElement("canvas"); c.width = 160; c.height = 160; const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, 160, 160); const { data } = ctx.getImageData(0, 0, 160, 160);
    const hist = new Uint32Array(256); for (let i = 0; i < data.length; i += 4) hist[Math.round(0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2])]++;
    const total = 160*160; let cum = 0, p2 = 0, p98 = 255;
    for (let i = 0; i < 256; i++) { cum += hist[i]; if (cum/total < 0.02) p2 = i; if (cum/total < 0.98) p98 = i; }
    if (hist.slice(180).reduce((a,b)=>a+b,0)/total > 0.45) { state.contrast = 45; state.dither = "threshold"; } 
    else { state.brightness = Math.max(-60, Math.min(60, Math.round(((p2+p98)/2-128)*-0.35))); }
    updateUIFromState();
  } catch(e) { showError(`[Bildanalyse Fehler]: ${e.message}`); }
}

// ==================== WIRING & EVENTS ====================
function wireSegmented(containerId, stateKey, attrKey, onChange = null) {
  const container = document.getElementById(containerId); if (!container) return;
  container.addEventListener("click", (e) => {
    const btn = e.target.closest("button"); if (!btn) return;
    container.querySelectorAll("button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active"); state[stateKey] = btn.dataset[attrKey];
    if (onChange) onChange(); triggerUpdate();
  });
}
wireSegmented("ditherBtns", "dither", "dither", () => { const tf = document.getElementById("thresholdField"); if(tf) tf.style.display = state.dither === "threshold" ? "block" : "none"; });
wireSegmented("paperFormatBtns", "paperFormat", "format");
wireSegmented("orientationBtns", "orientation", "orient");

function wireSlider(id, valId, stateKey, transform = v => +v, format = v => v) {
  const s = document.getElementById(id); const v = document.getElementById(valId); if (!s || !v) return;
  const apply = () => { const raw = transform(s.value); state[stateKey] = raw; v.textContent = format(raw); triggerUpdate(); };
  s.addEventListener("input", apply);
  const rawInit = transform(s.value); state[stateKey] = rawInit; v.textContent = format(rawInit);
}
wireSlider("thresholdSlider", "thresholdVal", "threshold");
wireSlider("brightnessSlider","brightnessVal","brightness");
wireSlider("contrastSlider",  "contrastVal",  "contrast");
wireSlider("gammaSlider",     "gammaVal",     "gamma", v => +v, v => (+v).toFixed(1));
wireSlider("dpiSlider",       "dpiVal",       "dpi");
wireSlider("jitterSlider",    "jitterVal",    "jitterScale", v => +v/10, v => (+v).toFixed(1));
wireSlider("bandingSlider",   "bandingVal",   "bandingScale", v => +v/10, v => (+v).toFixed(1));
wireSlider("maxSizeSlider",   "maxSizeVal",   "maxSize");
wireSlider("seedSlider",      "seedVal",      "seed");

function wireSwatches(containerId, stateKey, attrKey) {
  const box = document.getElementById(containerId); if(!box) return;
  box.addEventListener("click", (e) => {
    const sw = e.target.closest(".swatch"); if (!sw || !sw.dataset[attrKey]) return;
    box.querySelectorAll(".swatch").forEach(s => s.classList.remove("active"));
    sw.classList.add("active"); state[stateKey] = sw.dataset[attrKey].split(",").map(Number); triggerUpdate();
  });
}
wireSwatches("inkSwatches", "ink", "ink");
wireSwatches("paperSwatches", "paper", "paper");

const inkColorPicker = document.getElementById('inkColorPicker'); const inkHexInput = document.getElementById('inkHexInput');
function applyCustomInk(hex) {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i); if (!m) return;
  const rgb = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  const swatch = document.getElementById('customInkSwatch'); if(swatch) { swatch.dataset.ink = rgb.join(','); swatch.style.background = hex; document.querySelectorAll('#inkSwatches .swatch').forEach(s => s.classList.remove('active')); swatch.classList.add('active'); }
  state.ink = rgb; triggerUpdate();
}
if(inkColorPicker && inkHexInput) {
  inkColorPicker.addEventListener('input', (e) => { inkHexInput.value = e.target.value; applyCustomInk(e.target.value); });
  inkHexInput.addEventListener('input', (e) => { const hex = e.target.value.trim(); if (/^#[0-9a-f]{6}$/i.test(hex)) { inkColorPicker.value = hex; applyCustomInk(hex); }});
}

const dropzone = document.getElementById("dropzone"); const fileInput = document.getElementById("fileInput");
if (dropzone && fileInput) {
  dropzone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => handleFile(e.target.files[0]));
  dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.style.borderColor = "var(--accent)"; });
  dropzone.addEventListener("dragleave", () => dropzone.style.borderColor = "var(--glass-border-light)");
  dropzone.addEventListener("drop", (e) => { e.preventDefault(); dropzone.style.borderColor = "var(--glass-border-light)"; if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
}

function estimateDpiFromImageSize(img) { return Math.max(100, Math.min(1200, Math.round((Math.max(img.width, img.height) / (297 / 25.4)) / 50) * 50)); }

async function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) return showError("Bitte wähle eine gültige Bilddatei aus (PNG, JPG, WebP).");
  setStatus("Lade Bild...");
  try {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      state.dpi = estimateDpiFromImageSize(img);
      const ds = document.getElementById("dpiSlider"); const dv = document.getElementById("dpiVal");
      if(ds) ds.value = state.dpi; if(dv) dv.textContent = state.dpi;
      state.sourceImage = img; detectAndSetPaperColor(img); analyzeAndAdaptImage(img);
      const b = document.getElementById("dzBig"); const s = document.getElementById("dzSmall");
      if(b) b.textContent = file.name; if(s) s.textContent = `${img.width} × ${img.height}`;
      const scale = Math.min(1, 800 / Math.max(img.width, img.height));
      if(outCanvas) {
        outCanvas.width = Math.round(img.width * scale); outCanvas.height = Math.round(img.height * scale);
        outCanvas.getContext("2d").drawImage(img, 0, 0, outCanvas.width, outCanvas.height);
      }
      if(renderBtn) renderBtn.disabled = false; triggerUpdate();
    };
    img.onerror = () => showError("[Bild Fehler]: Das Bild konnte nicht gelesen werden.");
    img.src = url;
  } catch(e) { showError(`[Upload Fehler]: ${e.message}`); }
}

const profileList = document.getElementById('profileList');
if (profileList) {
  profileList.addEventListener('click', (e) => {
    const item = e.target.closest('.sli'); if (!item) return;
    document.querySelectorAll('#profileList .sli').forEach(s => s.classList.remove('active'));
    item.classList.add('active'); state.profile = item.dataset.profile;
    updateProfileMeta(); triggerUpdate();
  });
}

document.querySelectorAll('#errorList .er').forEach(er => {
  const head = er.querySelector('.er-head');
  const slider = er.querySelector('.er-slider');
  if(head) {
    head.onclick = () => {
      er.classList.toggle('on'); const valEl = er.querySelector('.er-val');
      if(valEl && slider) valEl.textContent = er.classList.contains('on') ? slider.value + '%' : '0%';
      state.wearLayers = Array.from(document.querySelectorAll('#errorList .er.on')).map(el => {
        const s = el.querySelector('.er-slider'); return { pattern: el.dataset.pattern, strength: s ? +s.value : 50 };
      });
      triggerUpdate();
    };
  }
  if(slider) {
    slider.oninput = (e) => {
      const valEl = er.querySelector('.er-val'); if(valEl) valEl.textContent = e.target.value + '%';
      state.wearLayers = Array.from(document.querySelectorAll('#errorList .er.on')).map(el => {
        const s = el.querySelector('.er-slider'); return { pattern: el.dataset.pattern, strength: s ? +s.value : 50 };
      });
      triggerUpdate();
    };
  }
});

document.querySelectorAll('.check').forEach(el => {
  el.onclick = () => { 
    if(el.dataset.flag === "bgAnim") { state.bgAnim = el.classList.toggle('on'); updateBgAnim(); } 
    else { el.classList.toggle('on'); state[el.dataset.flag] = el.classList.contains('on'); triggerUpdate(); }
  }
});

function updateBgAnim() {
  const bg = document.getElementById('appBg'); const sel = document.getElementById('bgAnimStyleField'); const selIn = document.getElementById('bgAnimSelector');
  if (!bg || !sel || !selIn) return;
  if(state.bgAnim) { bg.style.opacity = '1'; sel.style.opacity = '1'; selIn.disabled = false; } 
  else { bg.style.opacity = '0'; sel.style.opacity = '0.4'; selIn.disabled = true; }
}

document.querySelectorAll('.activity-bar .icon-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.activity-bar .icon-btn, .tab-content').forEach(el => el.classList.remove('active'));
    btn.classList.add('active'); const tab = document.getElementById(btn.dataset.tab); if(tab) tab.classList.add('active');
  }
});

const themeAcc = document.getElementById('themeAccentSelector');
if(themeAcc) themeAcc.addEventListener('change', e => document.body.setAttribute('data-accent', e.target.value));

const themeMode = document.getElementById('themeModeSelector');
if(themeMode) themeMode.addEventListener('change', e => document.body.className = e.target.value === 'light' ? 'light-mode' : 'dark-mode');

const langSel = document.getElementById('langSelector');
if(langSel) langSel.addEventListener('change', (e) => applyLanguage(e.target.value));

const bgAnimSel = document.getElementById('bgAnimSelector');
if(bgAnimSel) bgAnimSel.addEventListener('change', e => { const bg = document.getElementById('appBg'); if(bg) bg.setAttribute('data-anim', e.target.value); });

function updateProfileMeta() { const p = PROFILES[state.profile]; const pm = document.getElementById("profileMeta"); if(p && pm) pm.textContent = `${p.pins}-pin · ${p.dpi_h}×${p.dpi_v} dpi`; }

// ==================== INIT ====================
try {
  state.autoRender = true; state.uiSounds = true; state.wearLayers = []; state.bgAnim = true;
  applyLanguage('de'); updateProfileMeta(); 

  if (typeof SYSTEM_PRESETS !== 'undefined') {
    renderPresetList();
  }
  
  if (renderBtn) renderBtn.onclick = performRender;
  if (downloadBtn) downloadBtn.onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(lastRenderedBlob); a.download = `print_${Date.now()}.png`; a.click(); };
  
} catch(e) {
  showError(`[Initialisierungsfehler]: System konnte nicht geladen werden. ${e.message}`);
}
