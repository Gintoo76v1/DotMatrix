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

// ==================== PRO AUDIO SYSTEM (FIXED) ====================
let audioCtx = null;
const initAudio = () => {
  if (!audioCtx) { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
  if (audioCtx.state === 'suspended') { audioCtx.resume(); }
};
// Browser verlangen einen Klick/Touch zum Freischalten von Audio
document.addEventListener('pointerdown', initAudio, { once: true, passive: true });

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

// Schöne Shockwaves bei Standard-Klicks (NICHT beim Draggen)
document.addEventListener('pointerup', (e) => {
  if (isDragging) return;
  if (!audioCtx) initAudio(); else if (audioCtx.state === 'suspended') audioCtx.resume();
  
  if (e.target.closest('button, .icon-btn, .sli, .swatch, .check, .er-head, .dropzone, input[type="range"], .color-picker')) {
    playClickSound();
  }
  
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
      const sSize = 160 / 3; 
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
  } catch (e) { console.error(e); }
  isRendering = false; renderBtn.disabled = false;
}

// ==================== PRESET SYSTEM (Wieder aus original Datei integriert!) ====================
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
  const setS = (id, vid, v) => { const e=document.getElementById(id); if(e && v!==undefined){ e.value=v; document.getElementById(vid).textContent=v; state[id.replace('Slider','')] = parseFloat(v); }};
  if (p.brightness !== undefined) setS('brightnessSlider', 'brightnessVal', p.brightness);
  if (p.contrast !== undefined) setS('contrastSlider', 'contrastVal', p.contrast);
  if (p.gamma !== undefined) setS('gammaSlider', 'gammaVal', p.gamma);
  if (p.threshold !== undefined) setS('thresholdSlider', 'thresholdVal', p.threshold);
  if (p.dpi !== undefined) setS('dpiSlider', 'dpiVal', p.dpi);
  if (p.jitterScale !== undefined) setS('jitterSlider', 'jitterVal', p.jitterScale * 10);
  if (p.bandingScale !== undefined) setS('bandingSlider', 'bandingVal', p.bandingScale * 10);
  if (p.maxSize !== undefined) setS('maxSizeSlider', 'maxSizeVal', p.maxSize);
  
  if (p.dither) { state.dither = p.dither; document.querySelectorAll('#ditherBtns button').forEach(b => b.classList.toggle('active', b.dataset.dither === p.dither)); document.getElementById('thresholdField').style.display = p.dither === 'threshold'?'block':'none'; }
  if (p.paperFormat) { state.paperFormat = p.paperFormat; document.querySelectorAll('#paperFormatBtns button').forEach(b => b.classList.toggle('active', b.dataset.format === p.paperFormat)); }
  if (p.orientation) { state.orientation = p.orientation; document.querySelectorAll('#orientationBtns button').forEach(b => b.classList.toggle('active', b.dataset.orient === p.orientation)); }
  
  if (p.ink) {
    state.ink = p.ink; const inkStr = p.ink.join(','); let found = false;
    document.querySelectorAll('#inkSwatches .swatch:not(.custom-swatch)').forEach(s => { const m = s.dataset.ink === inkStr; s.classList.toggle('active', m); if (m) found = true; });
    const custom = document.getElementById('customInkSwatch');
    if (!found && custom) { const hex = "#" + p.ink.map(x => x.toString(16).padStart(2, '0')).join(''); custom.dataset.ink = inkStr; custom.style.background = hex; custom.classList.add('active'); document.getElementById('inkColorPicker').value = hex; document.getElementById('inkHexInput').value = hex; }
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
    document.querySelectorAll('#errorList .er').forEach(el => { el.classList.remove('on'); el.querySelector('.er-val').textContent = '0%'; });
    for (const layer of p.wearLayers) {
      const el = document.querySelector(`#errorList .er[data-pattern="${layer.pattern}"]`);
      if (el) { el.classList.add('on'); el.querySelector('.er-slider').value = layer.strength ?? 50; el.querySelector('.er-val').textContent = (layer.strength ?? 50) + '%'; }
    }
  }
  updateUIFromState(); updateProfileMeta(); triggerUpdate();
}

function updateUIFromState() {
  document.querySelectorAll('#profileList .sli').forEach(s => s.classList.toggle('active', s.dataset.profile === state.profile));
  document.querySelectorAll('.check').forEach(c => c.classList.toggle('on', state[c.dataset.flag]));
}

// Lade Presets aus config.js UND LocalStorage
function renderPresetList() {
  const list = document.getElementById('presetList');
  if(!list) return;
  list.innerHTML = '';
  // Sicherstellen, dass SYSTEM_PRESETS geladen wurden
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
}

function downloadText(text, filename) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); }
document.getElementById('exportPresetBtn').addEventListener('click', () => { let name = document.getElementById('presetNameInput').value.trim(); if (!name) { name = prompt('Preset Name:', 'My Preset'); if (!name) return; document.getElementById('presetNameInput').value = name; } downloadText(presetToYaml(captureCurrentPreset(name)), `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.yaml`); });
document.getElementById('exportCurrentBtn').addEventListener('click', () => { const name = document.getElementById('presetNameInput').value.trim() || 'my-preset'; const yaml = presetToYaml(captureCurrentPreset(name)); document.getElementById('presetYamlArea').value = yaml; downloadText(yaml, `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.yaml`); });
document.getElementById('importPresetBtn').addEventListener('click', () => document.getElementById('presetFileInput').click());
document.getElementById('presetFileInput').addEventListener('change', async (e) => { const file = e.target.files[0]; if (!file) return; importFromText(await file.text()); e.target.value = ''; });
document.getElementById('savePresetBtn').addEventListener('click', () => { const name = document.getElementById('presetNameInput').value.trim(); if (!name) return alert('Name erforderlich'); const preset = captureCurrentPreset(name); preset.id = 'usr_'+Date.now(); const presets = loadUserPresets(); presets.push(preset); saveUserPresets(presets); activePresetId = preset.id; renderPresetList(); setStatus(`Gespeichert.`); });
document.getElementById('importYamlBtn').addEventListener('click', () => { const text = document.getElementById('presetYamlArea').value.trim(); if (!text) return alert('YAML einfügen!'); importFromText(text); });

function importFromText(text) {
  try {
    const stripped = text.trim();
    let preset = stripped.startsWith('{') ? JSON.parse(stripped) : yamlToPreset(stripped);
    if (!preset.name) preset.name = 'Imported';
    applyPreset(preset); setStatus(`Importiert.`);
    if (preset.name !== 'Imported') { preset.id = 'usr_' + Date.now(); preset.system = false; const presets = loadUserPresets(); presets.push(preset); saveUserPresets(presets); activePresetId = preset.id; renderPresetList(); }
  } catch (err) { alert('Import fehlgeschlagen: ' + err.message); }
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
  const c = document.createElement("canvas"); c.width = 160; c.height = 160; const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0, 160, 160); const { data } = ctx.getImageData(0, 0, 160, 160);
  const hist = new Uint32Array(256); for (let i = 0; i < data.length; i += 4) hist[Math.round(0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2])]++;
  const total = 160*160; let cum = 0, p2 = 0, p98 = 255;
  for (let i = 0; i < 256; i++) { cum += hist[i]; if (cum/total < 0.02) p2 = i; if (cum/total < 0.98) p98 = i; }
  if (hist.slice(180).reduce((a,b)=>a+b,0)/total > 0.45) { state.contrast = 45; state.dither = "threshold"; } 
  else { state.brightness = Math.max(-60, Math.min(60, Math.round(((p2+p98)/2-128)*-0.35))); }
  updateUIFromState();
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
wireSegmented("ditherBtns", "dither", "dither", () => { document.getElementById("thresholdField").style.display = state.dither === "threshold" ? "block" : "none"; });
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
  const swatch = document.getElementById('customInkSwatch'); swatch.dataset.ink = rgb.join(','); swatch.style.background = hex;
  document.querySelectorAll('#inkSwatches .swatch').forEach(s => s.classList.remove('active')); swatch.classList.add('active');
  state.ink = rgb; triggerUpdate();
}
inkColorPicker.addEventListener('input', (e) => { inkHexInput.value = e.target.value; applyCustomInk(e.target.value); });
inkHexInput.addEventListener('input', (e) => { const hex = e.target.value.trim(); if (/^#[0-9a-f]{6}$/i.test(hex)) { inkColorPicker.value = hex; applyCustomInk(hex); }});

const dropzone = document.getElementById("dropzone"); const fileInput = document.getElementById("fileInput");
dropzone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (e) => handleFile(e.target.files[0]));
dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.style.borderColor = "var(--accent)"; });
dropzone.addEventListener("dragleave", () => dropzone.style.borderColor = "var(--glass-border-light)");
dropzone.addEventListener("drop", (e) => { e.preventDefault(); dropzone.style.borderColor = "var(--glass-border-light)"; if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });

function estimateDpiFromImageSize(img) { return Math.max(100, Math.min(1200, Math.round((Math.max(img.width, img.height) / (297 / 25.4)) / 50) * 50)); }

async function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) return setStatus("Kein Bild.");
  setStatus("Lade Bild...");
  const url = URL.createObjectURL(file); const img = new Image();
  img.onload = () => {
    state.dpi = estimateDpiFromImageSize(img);
    document.getElementById("dpiSlider").value = state.dpi; document.getElementById("dpiVal").textContent = state.dpi;
    state.sourceImage = img; detectAndSetPaperColor(img); analyzeAndAdaptImage(img);
    document.getElementById("dzBig").textContent = file.name; document.getElementById("dzSmall").textContent = `${img.width} × ${img.height}`;
    const scale = Math.min(1, 800 / Math.max(img.width, img.height));
    outCanvas.width = Math.round(img.width * scale); outCanvas.height = Math.round(img.height * scale);
    outCanvas.getContext("2d").drawImage(img, 0, 0, outCanvas.width, outCanvas.height);
    renderBtn.disabled = false; triggerUpdate();
  };
  img.src = url;
}

document.getElementById('profileList').addEventListener('click', (e) => {
  const item = e.target.closest('.sli'); if (!item) return;
  document.querySelectorAll('#profileList .sli').forEach(s => s.classList.remove('active'));
  item.classList.add('active'); state.profile = item.dataset.profile;
  updateProfileMeta(); triggerUpdate();
});

document.querySelectorAll('#errorList .er').forEach(er => {
  er.querySelector('.er-head').onclick = () => {
    er.classList.toggle('on'); er.querySelector('.er-val').textContent = er.classList.contains('on') ? er.querySelector('.er-slider').value + '%' : '0%';
    state.wearLayers = Array.from(document.querySelectorAll('#errorList .er.on')).map(el => ({ pattern: el.dataset.pattern, strength: +el.querySelector('.er-slider').value }));
    triggerUpdate();
  };
  er.querySelector('.er-slider').oninput = (e) => {
    er.querySelector('.er-val').textContent = e.target.value + '%';
    state.wearLayers = Array.from(document.querySelectorAll('#errorList .er.on')).map(el => ({ pattern: el.dataset.pattern, strength: +e.target.value }));
    triggerUpdate();
  };
});

document.querySelectorAll('.check').forEach(el => el.onclick = () => { 
  if(el.dataset.flag === "bgAnim") {
    state.bgAnim = el.classList.toggle('on');
    updateBgAnim();
  } else {
    el.classList.toggle('on'); state[el.dataset.flag] = el.classList.contains('on'); triggerUpdate(); 
  }
});

function updateBgAnim() {
  const bg = document.getElementById('appBg');
  const sel = document.getElementById('bgAnimStyleField');
  if(state.bgAnim) {
    bg.style.opacity = '1'; sel.style.opacity = '1'; document.getElementById('bgAnimSelector').disabled = false;
  } else {
    bg.style.opacity = '0'; sel.style.opacity = '0.4'; document.getElementById('bgAnimSelector').disabled = true;
  }
}

document.querySelectorAll('.activity-bar .icon-btn').forEach(btn => btn.onclick = () => {
  document.querySelectorAll('.activity-bar .icon-btn, .tab-content').forEach(el => el.classList.remove('active'));
  btn.classList.add('active'); document.getElementById(btn.dataset.tab).classList.add('active');
});

document.getElementById('themeAccentSelector').addEventListener('change', e => document.body.setAttribute('data-accent', e.target.value));
document.getElementById('themeModeSelector').addEventListener('change', e => document.body.className = e.target.value === 'light' ? 'light-mode' : 'dark-mode');
document.getElementById('langSelector').addEventListener('change', (e) => applyLanguage(e.target.value));

document.getElementById('bgAnimSelector').addEventListener('change', e => {
  document.getElementById('appBg').setAttribute('data-anim', e.target.value);
});

function updateProfileMeta() { const p = PROFILES[state.profile]; document.getElementById("profileMeta").textContent = `${p.pins}-pin · ${p.dpi_h}×${p.dpi_v} dpi`; }

// ==================== INIT ====================
state.autoRender = true; state.uiSounds = true; state.wearLayers = []; state.bgAnim = true;
applyLanguage('de'); updateProfileMeta(); renderPresetList();
