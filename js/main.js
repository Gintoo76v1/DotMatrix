import { state, PROFILES, SYSTEM_PRESETS, WEAR_PATTERNS } from './config.js';
import { render, asciiPreview } from './engine.js';

// ==================== JFIF / PNG DPI DETECTION ====================
function readJfifDpi(buf) {
  const v = new DataView(buf);
  if (v.byteLength < 18 || v.getUint16(0) !== 0xFFD8) return null;
  if (v.getUint16(2) !== 0xFFE0) return null;
  const sig = String.fromCharCode(v.getUint8(6),v.getUint8(7),v.getUint8(8),v.getUint8(9),v.getUint8(10));
  if (sig !== 'JFIF\0') return null;
  const units = v.getUint8(11);
  const xd    = v.getUint16(12);
  if (!xd) return null;
  if (units === 1) return xd;
  if (units === 2) return Math.round(xd * 2.54);
  return null;
}

function readPngDpi(buf) {
  const v = new DataView(buf);
  if (v.byteLength < 30 || v.getUint32(0) !== 0x89504E47) return null;
  let pos = 8;
  while (pos + 12 <= v.byteLength) {
    const len  = v.getUint32(pos);
    const type = String.fromCharCode(v.getUint8(pos+4),v.getUint8(pos+5),v.getUint8(pos+6),v.getUint8(pos+7));
    if (type === 'pHYs' && len === 9 && pos + 21 <= v.byteLength) {
      const ppuX = v.getUint32(pos + 8);
      const unit = v.getUint8(pos + 16);
      if (unit === 1 && ppuX > 0) return Math.round(ppuX / 39.3701);
    }
    if (type === 'IDAT') break;
    pos += 12 + len;
  }
  return null;
}

function snapDpi(dpi) { return Math.max(100, Math.min(1200, Math.round(dpi / 50) * 50)); }
function estimateDpiFromImageSize(img) {
  const longPx = Math.max(img.width, img.height);
  const a4LongIn = 297 / 25.4;
  return snapDpi(Math.round(longPx / a4LongIn));
}

// ==================== 1. i18n SYSTEM ====================
const DICTIONARY = {
  de: {
    appTitle: "DotMatrix Studio", navSettings: "Einstellungen",
    secSource: "Quelle", dzTap: "Bild wählen",
    secPresets: "Presets", btnSavePreset: "Speichern", btnExport: "Export", btnImport: "Import",
    secProfile: "Drucker Profil", lblDoubleStrike: "Double-strike", lblCondensed: "Condensed Mode",
    secAdjustments: "Bildanpassung", lblBrightness: "Helligkeit", lblContrast: "Kontrast",
    secMedia: "Tinte & Papier", lblInk: "Tinte", lblPaper: "Papier", secErrors: "Hardware Fehler",
    btnRender: "Drucken", btnDownload: "PNG Speichern",
    tabPreview: "Live Vorschau", statReady: "Bereit.", statRendering: "Berechnet..."
  },
  en: {
    appTitle: "DotMatrix Studio", navSettings: "Settings",
    secSource: "Source", dzTap: "Select Image",
    secPresets: "Presets", btnSavePreset: "Save", btnExport: "Export", btnImport: "Import",
    secProfile: "Printer Profile", lblDoubleStrike: "Double-strike", lblCondensed: "Condensed Mode",
    secAdjustments: "Adjustments", lblBrightness: "Brightness", lblContrast: "Contrast",
    secMedia: "Ink & Paper", lblInk: "Ink", lblPaper: "Paper", secErrors: "Hardware Errors",
    btnRender: "Render", btnDownload: "Save PNG",
    tabPreview: "Live Preview", statReady: "Ready.", statRendering: "Processing..."
  }
};

let currentLang = 'de';
function applyLanguage(lang) {
  currentLang = lang;
  const dict = DICTIONARY[lang];
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = dict[el.dataset.i18n] || el.textContent; });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = dict[el.dataset.i18nTitle] || el.title; });
  document.getElementById('langDeBtn').classList.toggle('active', lang === 'de');
  document.getElementById('langEnBtn').classList.toggle('active', lang === 'en');
}
document.getElementById('langDeBtn').addEventListener('click', () => applyLanguage('de'));
document.getElementById('langEnBtn').addEventListener('click', () => applyLanguage('en'));

// ==================== 2. THEME & ZOOM ====================
document.getElementById('themeToggleBtn').addEventListener('click', () => {
  const html = document.documentElement;
  html.setAttribute('data-theme', html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});

let zoomLevel = 1;
const canvasWrap = document.getElementById('canvasContainer');
function updateZoom() { canvasWrap.style.transform = `scale(${zoomLevel})`; }
document.getElementById('zoomInBtn').addEventListener('click', () => { zoomLevel = Math.min(zoomLevel + 0.2, 3); updateZoom(); });
document.getElementById('zoomOutBtn').addEventListener('click', () => { zoomLevel = Math.max(zoomLevel - 0.2, 0.2); updateZoom(); });
document.getElementById('zoomResetBtn').addEventListener('click', () => { zoomLevel = 1; updateZoom(); });
document.getElementById('editorViewport').addEventListener('wheel', (e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    zoomLevel += e.deltaY > 0 ? -0.1 : 0.1;
    zoomLevel = Math.max(0.2, Math.min(zoomLevel, 3));
    updateZoom();
  }
}, { passive: false });

// ==================== 3. HELPERS & DEBOUNCING ====================
const statusEl = document.getElementById('status');
function setStatus(text) { statusEl.textContent = text; }

let previewTimeout;
function debouncedRefresh() {
  clearTimeout(previewTimeout);
  previewTimeout = setTimeout(() => {
    if (state.sourceImage) {
      const asciiEl = document.getElementById('ascii');
      try {
        asciiEl.style.display = 'block';
        asciiEl.textContent = asciiPreview(state.sourceImage, 60);
        setStatus(DICTIONARY[currentLang].statReady);
      } catch (e) { console.warn(e); }
    }
  }, 200);
}

function updateProfileMeta() {
  const p = PROFILES[state.profile];
  document.getElementById('profileMeta').textContent = `${p.pins}-pin · ${p.dpi_h}×${p.dpi_v} dpi · ⌀ ${p.dot_diameter_mm}mm`;
  const condCheck = document.querySelector('[data-flag="condensed"]');
  if (!p.supports_condensed) {
    condCheck.style.opacity = '0.4'; condCheck.style.pointerEvents = 'none';
    condCheck.classList.remove("on"); state.condensed = false;
  } else {
    condCheck.style.opacity = '1'; condCheck.style.pointerEvents = 'auto';
  }
}

// ==================== 4. SLIDERS, BUTTONS, INPUTS ====================
function wireSlider(id, valId, stateKey, transform = v=>+v, format = v=>v) {
  const s = document.getElementById(id);
  const v = document.getElementById(valId);
  const apply = () => {
    const raw = transform(s.value);
    state[stateKey] = raw;
    v.textContent = format(raw);
    debouncedRefresh();
  };
  s.addEventListener("input", apply);
}
wireSlider("brightnessSlider", "brightnessVal", "brightness");
wireSlider("contrastSlider",   "contrastVal",   "contrast");
wireSlider("gammaSlider",      "gammaVal",      "gamma", v => +v, v => (+v).toFixed(1));
wireSlider("thresholdSlider",  "thresholdVal",  "threshold");
wireSlider("dpiSlider",        "dpiVal",        "dpi");
wireSlider("jitterSlider",     "jitterVal",     "jitterScale", v => +v/10, v => (+v/10).toFixed(1));
wireSlider("bandingSlider",    "bandingVal",    "bandingScale", v => +v/10, v => (+v/10).toFixed(1));

function wireSegmented(containerId, stateKey, attrKey) {
  document.getElementById(containerId).addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    document.querySelectorAll(`#${containerId} button`).forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state[stateKey] = btn.dataset[attrKey];
    debouncedRefresh();
  });
}
wireSegmented("ditherBtns", "dither", "dither");
wireSegmented("paperFormatBtns", "paperFormat", "format");
wireSegmented("orientationBtns", "orientation", "orient");

document.querySelectorAll(".check").forEach(el => {
  el.addEventListener("click", () => {
    if (el.style.pointerEvents === 'none') return;
    el.classList.toggle("on");
    state[el.dataset.flag] = el.classList.contains("on");
    debouncedRefresh();
  });
});

document.getElementById('profileList').addEventListener('click', (e) => {
  const sli = e.target.closest('.sli');
  if (sli) {
    document.querySelectorAll('#profileList .sli').forEach(s => s.classList.remove('active'));
    sli.classList.add('active');
    state.profile = sli.dataset.profile;
    updateProfileMeta();
    debouncedRefresh();
  }
});

// Ink & Paper
const inkColorPicker = document.getElementById('inkColorPicker');
const inkHexDisplay = document.getElementById('inkHexDisplay');
function hexToRgb(hex) { const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i); return m ? [parseInt(m[1],16), parseInt(m[2],16), parseInt(m[3],16)] : [0,0,0]; }
function rgbToHex(r,g,b) { return '#' + [r,g,b].map(x=>x.toString(16).padStart(2,'0')).join(''); }

inkColorPicker.addEventListener('input', (e) => {
  const hex = e.target.value;
  inkHexDisplay.textContent = hex;
  state.ink = hexToRgb(hex);
  debouncedRefresh();
});

document.getElementById('paperSwatches').addEventListener('click', (e) => {
  const sw = e.target.closest('.swatch');
  if (sw) {
    document.querySelectorAll('#paperSwatches .swatch').forEach(s => s.classList.remove('active'));
    sw.classList.add('active');
    state.paper = sw.dataset.paper.split(',').map(Number);
    debouncedRefresh();
  }
});

// Errors
function syncWearLayers() {
  state.wearLayers = [];
  document.querySelectorAll('#errorList .er.on').forEach(el => {
    state.wearLayers.push({ pattern: el.dataset.pattern, strength: +el.querySelector('.er-slider').value });
  });
  debouncedRefresh();
}
document.getElementById('errorList').addEventListener('click', (e) => {
  const head = e.target.closest('.er-head');
  if (head) {
    const er = head.closest('.er');
    er.classList.toggle('on');
    er.querySelector('.er-val').textContent = er.classList.contains('on') ? er.querySelector('.er-slider').value + '%' : '0%';
    syncWearLayers();
  }
});
document.getElementById('errorList').addEventListener('input', (e) => {
  if (e.target.classList.contains('er-slider')) {
    e.target.closest('.er').querySelector('.er-val').textContent = e.target.value + '%';
    syncWearLayers();
  }
});

// ==================== 5. PRESETS & YAML ====================
const STORAGE_KEY = 'dotmatrix_user_presets';

function loadUserPresets() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
function saveUserPresets(arr) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); } catch {} }

function renderPresetList() {
  const list = document.getElementById('presetList');
  list.innerHTML = '';
  const allPresets = [...SYSTEM_PRESETS, ...loadUserPresets()];
  allPresets.forEach(p => {
    const el = document.createElement('div');
    el.className = 'sli';
    el.innerHTML = `<div class="sli-row"><span class="sli-name">${p.name}</span><span class="sli-badge">${p.system ? 'SYS' : 'USR'}</span></div>`;
    el.addEventListener('click', () => {
      document.querySelectorAll('#presetList .sli').forEach(s => s.classList.remove('active'));
      el.classList.add('active');
      applyPreset(p);
    });
    list.appendChild(el);
  });
}

function applyPreset(p) {
  if (p.profile) {
    state.profile = p.profile;
    document.querySelectorAll('#profileList .sli').forEach(s => s.classList.toggle('active', s.dataset.profile === p.profile));
    updateProfileMeta();
  }
  const setSld = (id, valId, val) => { if(val!==undefined) { document.getElementById(id).value = val; document.getElementById(valId).textContent = val; state[id.replace('Slider','')] = val; } };
  setSld('brightnessSlider', 'brightnessVal', p.brightness);
  setSld('contrastSlider', 'contrastVal', p.contrast);
  setSld('thresholdSlider', 'thresholdVal', p.threshold);
  setSld('dpiSlider', 'dpiVal', p.dpi);
  
  if (p.dither) {
    state.dither = p.dither;
    document.querySelectorAll('#ditherBtns button').forEach(b => b.classList.toggle('active', b.dataset.dither === p.dither));
  }
  if (p.ink) {
    state.ink = p.ink;
    const hex = rgbToHex(...p.ink);
    inkColorPicker.value = hex; inkHexDisplay.textContent = hex;
  }
  if (p.paper) {
    state.paper = p.paper;
    const pStr = p.paper.join(',');
    document.querySelectorAll('#paperSwatches .swatch').forEach(s => s.classList.toggle('active', s.dataset.paper === pStr));
  }
  
  document.querySelectorAll('#errorList .er').forEach(el => { el.classList.remove('on'); el.querySelector('.er-val').textContent = '0%'; });
  if (p.wearLayers) {
    p.wearLayers.forEach(wl => {
      const el = document.querySelector(`#errorList .er[data-pattern="${wl.pattern}"]`);
      if (el) { el.classList.add('on'); el.querySelector('.er-slider').value = wl.strength; el.querySelector('.er-val').textContent = wl.strength + '%'; }
    });
  }
  syncWearLayers();
}

function captureCurrentPreset(name) {
  return {
    id: 'usr_' + Date.now(), name: name || 'Custom', system: false,
    profile: state.profile, brightness: state.brightness, contrast: state.contrast,
    gamma: state.gamma, dither: state.dither, threshold: state.threshold,
    ink: [...state.ink], paper: [...state.paper], dpi: state.dpi,
    wearLayers: state.wearLayers.map(l => ({...l}))
  };
}

document.getElementById('savePresetBtn').addEventListener('click', () => {
  const name = document.getElementById('presetNameInput').value.trim() || 'Custom Preset';
  const p = captureCurrentPreset(name);
  const arr = loadUserPresets(); arr.push(p); saveUserPresets(arr);
  renderPresetList(); setStatus(`Preset "${name}" saved.`);
});

function presetToYaml(p) {
  const lines = [];
  for (const [k, v] of Object.entries(p)) {
    if (['id','system'].includes(k)) continue;
    if (Array.isArray(v)) {
      if (v.length === 0) lines.push(`${k}: []`);
      else if (typeof v[0] === 'number') lines.push(`${k}: [${v.join(', ')}]`);
      else { lines.push(`${k}:`); v.forEach(obj => { const e = Object.entries(obj); lines.push(`  - ${e[0][0]}: ${e[0][1]}`); for(let i=1;i<e.length;i++) lines.push(`    ${e[i][0]}: ${e[i][1]}`); }); }
    } else lines.push(`${k}: ${v}`);
  }
  return lines.join('\n');
}

document.getElementById('exportPresetBtn').addEventListener('click', () => {
  const name = document.getElementById('presetNameInput').value.trim() || 'preset';
  const yaml = presetToYaml(captureCurrentPreset(name));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([yaml], {type: 'text/plain'}));
  a.download = `${name.replace(/\s+/g,'_')}.yaml`;
  document.body.appendChild(a); a.click(); a.remove();
});

document.getElementById('importPresetBtn').addEventListener('click', () => {
  const area = document.getElementById('presetYamlArea');
  const btn = document.getElementById('importYamlBtn');
  area.style.display = area.style.display === 'none' ? 'block' : 'none';
  btn.style.display = btn.style.display === 'none' ? 'block' : 'none';
});

// ==================== 6. FILE HANDLING & RENDER ====================
const outCanvas = document.getElementById('outCanvas');
const outCtx = outCanvas.getContext('2d');
const renderBtn = document.getElementById('renderBtn');
const downloadBtn = document.getElementById('downloadBtn');
let lastBlob = null;

async function handleFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  setStatus("Lade Bild...");
  let metaDpi = null;
  try {
    const buf = await file.slice(0, 256).arrayBuffer();
    if (file.type === 'image/jpeg') metaDpi = readJfifDpi(buf);
    else if (file.type === 'image/png') metaDpi = readPngDpi(buf);
  } catch {}
  
  const img = new Image();
  img.onload = () => {
    state.dpi = (metaDpi && metaDpi > 96) ? snapDpi(metaDpi) : estimateDpiFromImageSize(img);
    document.getElementById("dpiSlider").value = state.dpi;
    document.getElementById("dpiVal").textContent = state.dpi;
    state.sourceImage = img;
    document.getElementById('dzBig').textContent = file.name;
    document.getElementById('dzSmall').textContent = `${img.width}x${img.height}`;
    
    // Base Canvas setup
    const scale = Math.min(1, 800 / Math.max(img.width, img.height));
    outCanvas.width = img.width * scale; outCanvas.height = img.height * scale;
    outCtx.drawImage(img, 0, 0, outCanvas.width, outCanvas.height);
    
    renderBtn.disabled = false;
    debouncedRefresh();
  };
  img.src = URL.createObjectURL(file);
}

document.getElementById('dropzone').addEventListener('click', () => document.getElementById('fileInput').click());
document.getElementById('fileInput').addEventListener('change', (e) => handleFile(e.target.files[0]));
document.getElementById('dropzone').addEventListener('dragover', e => { e.preventDefault(); e.target.closest('.dropzone').style.borderColor = 'var(--accent)'; });
document.getElementById('dropzone').addEventListener('dragleave', e => { e.target.closest('.dropzone').style.borderColor = 'var(--glass-border)'; });
document.getElementById('dropzone').addEventListener('drop', e => { e.preventDefault(); e.target.closest('.dropzone').style.borderColor = 'var(--glass-border)'; handleFile(e.dataTransfer.files[0]); });

renderBtn.addEventListener('click', async () => {
  if (!state.sourceImage) return;
  renderBtn.disabled = true; downloadBtn.disabled = true;
  setStatus(DICTIONARY[currentLang].statRendering);
  document.getElementById('ascii').style.display = 'none'; // Verstecke ASCII während des Renderns
  
  try {
    const { imageData, width, height } = await render(state.sourceImage, setStatus);
    outCanvas.width = width; outCanvas.height = height;
    outCtx.putImageData(imageData, 0, 0);
    outCanvas.toBlob(b => { lastBlob = b; downloadBtn.disabled = false; }, 'image/png');
    setStatus(DICTIONARY[currentLang].statReady);
  } catch (e) {
    console.error(e);
    setStatus("Fehler beim Rendern.");
  } finally {
    renderBtn.disabled = false;
  }
});

downloadBtn.addEventListener('click', () => {
  if (!lastBlob) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(lastBlob);
  a.download = `dotmatrix_${Date.now()}.png`;
  document.body.appendChild(a); a.click(); a.remove();
});

// INIT
applyLanguage('de');
updateProfileMeta();
renderPresetList();
