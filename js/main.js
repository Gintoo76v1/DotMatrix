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
// Safari braucht harte User-Events zum Starten
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
  if (isDragging) return; // Kein Sound beim Loslassen von Drag&Drop
  if (e.target.closest('button, .icon-btn, .sli, .swatch, .check, .er-head, .dropzone, input[type="range"], .color-picker')) playClickSound();
  
  if (['BUTTON','INPUT','SELECT'].includes(e.target.tagName)) return;
  const r = document.createElement('div'); r.className = 'click-shockwave';
  r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
  document.body.appendChild(r); setTimeout(() => r.remove(), 600); // Bugfix: Memory Leak geschlossen
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
  } catch (e) { console.error(e); }
  isRendering = false; renderBtn.disabled = false;
}

// ==================== PRESET SYSTEM (RESTORED) ====================
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
  const setS = (id, vid, v) => { const e=document.getElementById(id); if(e){ e.value=v; document.getElementById(vid).textContent=v; state[id.replace('Slider','')] = v; }};
  if (p.brightness !== undefined) setS('brightnessSlider', 'brightnessVal', p.brightness);
  if (p.contrast !== undefined) setS('contrastSlider', 'contrastVal', p.contrast);
  if (p.gamma !== undefined) setS('gammaSlider', 'gammaVal', p.gamma);
  if (p.threshold !== undefined) setS('thresholdSlider', 'thresholdVal', p.threshold);
  if (p.dpi !== undefined) setS('dpiSlider', 'dpiVal', p.dpi);
  if (p.jitterScale !== undefined) setS('jitterSlider', 'jitterVal', p.jitterScale);
  if (p.bandingScale !== undefined) setS('bandingSlider', 'bandingVal', p.bandingScale);
  if (p.maxSize !== undefined) setS('maxSizeSlider', 'maxSizeVal', p.maxSize);
  
  if (p.dither) { state.dither = p.dither; document.querySelectorAll('#ditherBtns button').forEach(b => b.classList.toggle('active', b.dataset.dither === p.dither)); document.getElementById('thresholdField').style.display = p.dither === 'threshold'?'block':'none'; }
  if (p.paperFormat) { state.paperFormat = p.paperFormat; document.querySelectorAll('#paperFormatBtns button').forEach(b => b.classList.toggle('active', b.dataset.format === p.paperFormat)); }
  if (p.orientation) { state.orientation = p.orientation; document.querySelectorAll('#orientationBtns button').forEach(b => b.classList.toggle('active', b.dataset.orient === p.orientation)); }
  
  if (p.ink) state.ink = p.ink; if (p.paper) state.paper = p.paper;
  state.doubleStrike = !!p.doubleStrike; state.condensed = !!p.condensed; state.softBlur = !!p.softBlur; state.invert = !!p.invert;
  
  state.wearLayers = p.wearLayers || [];
  updateUIFromState(); triggerUpdate();
}

function updateUIFromState() {
  document.querySelectorAll('#profileList .sli').forEach(s => s.classList.toggle('active', s.dataset.profile === state.profile));
  document.querySelectorAll('.check').forEach(c => c.classList.toggle('on', state[c.dataset.flag]));
  document.querySelectorAll('#errorList .er').forEach(er => {
    const layer = state.wearLayers.find(l => l.pattern === er.dataset.pattern);
    er.classList.toggle('on', !!layer);
    if (layer) { er.querySelector('.er-slider').value = layer.strength; er.querySelector('.er-val').textContent = layer.strength + '%'; }
    else er.querySelector('.er-val').textContent = '0%';
  });
}

function renderPresetList() {
  const list = document.getElementById('presetList'); list.innerHTML = '';
  const allPresets = [...SYSTEM_PRESETS, ...loadUserPresets()];
  allPresets.forEach(p => {
    const el = document.createElement('div'); el.className = 'sli' + (p.id === activePresetId ? ' active' : '');
    if(p.system) { el.innerHTML = `<div class="sli-row" style="width:100%;"><span class="sli-name">${p.name}</span><span class="sli-badge">SYS</span></div>`; } 
    else { el.innerHTML = `<div class="sli-row" style="width:100%;"><span class="sli-name">${p.name}</span><div><span class="sli-badge" style="margin-right:5px;">USR</span><button class="sli-del" title="Löschen">×</button></div></div>`; el.querySelector('.sli-del').addEventListener('click', (e) => { e.stopPropagation(); if(confirm(`Preset "${p.name}" löschen?`)) { if(activePresetId === p.id) activePresetId = null; deleteUserPreset(p.id); }}); }
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
  try { const stripped = text.trim(); let preset = stripped.startsWith('{') ? JSON.parse(stripped) : yamlToPreset(stripped); if (!preset.name) preset.name = 'Imported'; applyPreset(preset); setStatus(`Importiert.`); if (preset.name !== 'Imported') { preset.id = 'usr_' + Date.now(); preset.system = false; const presets = loadUserPresets(); presets.push(preset); saveUserPresets(presets); activePresetId = preset.id; renderPresetList(); } } catch (err) { alert('Import fehlgeschlagen: ' + err.message); }
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

// ==================== DOM EVENTS ====================
document.getElementById('fileInput').onchange = (e) => {
  const file = e.target.files[0]; if (!file) return; const img = new Image();
  img.onload = () => { state.sourceImage = img; analyzeAndAdaptImage(img); performRender(); };
  img.src = URL.createObjectURL(file);
};
document.getElementById('renderBtn').onclick = performRender;
document.getElementById('downloadBtn').onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(lastRenderedBlob); a.download = `print_${Date.now()}.png`; a.click(); };
document.querySelectorAll('.activity-bar .icon-btn').forEach(btn => btn.onclick = () => {
  document.querySelectorAll('.activity-bar .icon-btn, .tab-content').forEach(el => el.classList.remove('active'));
  btn.classList.add('active'); document.getElementById(btn.dataset.tab).classList.add('active');
});

document.querySelectorAll('#errorList .er').forEach(er => {
  er.querySelector('.er-head').onclick = () => {
    er.classList.toggle('on');
    er.querySelector('.er-val').textContent = er.classList.contains('on') ? er.querySelector('.er-slider').value + '%' : '0%';
    state.wearLayers = Array.from(document.querySelectorAll('#errorList .er.on')).map(el => ({ pattern: el.dataset.pattern, strength: +el.querySelector('.er-slider').value }));
    triggerUpdate();
  };
  er.querySelector('.er-slider').oninput = (e) => {
    er.querySelector('.er-val').textContent = e.target.value + '%';
    state.wearLayers = Array.from(document.querySelectorAll('#errorList .er.on')).map(el => ({ pattern: el.dataset.pattern, strength: +el.querySelector('.er-slider').value }));
    triggerUpdate();
  };
});
document.querySelectorAll('.check').forEach(el => el.onclick = () => { el.classList.toggle('on'); state[el.dataset.flag] = el.classList.contains('on'); triggerUpdate(); });
document.querySelectorAll('input[type=range]:not(.er-slider)').forEach(s => s.oninput = () => { const v = document.getElementById(s.id.replace('Slider','Val')); if(v) v.textContent = s.value; state[s.id.replace('Slider','')] = parseFloat(s.value); triggerUpdate(); });
document.getElementById('themeAccentSelector').addEventListener('change', e => document.body.setAttribute('data-accent', e.target.value));
document.getElementById('themeModeSelector').addEventListener('change', e => document.body.className = e.target.value === 'light' ? 'light-mode' : 'dark-mode');

state.autoRender = true; state.uiSounds = true; state.wearLayers = []; applyLanguage('de'); renderPresetList();
function updateProfileMeta() { const p = PROFILES[state.profile]; document.getElementById("profileMeta").textContent = `${p.pins}-pin · ${p.dpi_h}×${p.dpi_v} dpi`; }
updateProfileMeta();
