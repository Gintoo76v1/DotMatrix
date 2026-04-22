import { state, PROFILES, SYSTEM_PRESETS, WEAR_PATTERNS } from './config.js';
import { render, asciiPreview } from './engine.js';

// ==================== I18N DICTIONARY ====================
const translations = {
  de: {
    sourceTitle: "Bildquelle", dropzoneBig: "Bild auswählen",
    profileTitle: "Druckerprofil", doubleStrike: "Double-Strike", condensedMode: "Condensed Mode",
    adjustTitle: "Bildanpassung", brightness: "Helligkeit", contrast: "Kontrast", gamma: "Gamma", invert: "Invertieren",
    halftoneTitle: "Halftone", paperFormatTitle: "Papier & Format",
    inkTitle: "Tinte", paperTitle: "Papier",
    presetsTitle: "Gespeicherte Presets", btnExport: "Export YAML", btnImport: "Import YAML",
    createPresetTitle: "Preset Erstellen", btnSavePreset: "Speichern", btnApplyYaml: "Aus Textfeld anwenden",
    errorsTitle: "Hardware Fehler", advancedTitle: "Erweiterte Render-Optionen", softBlur: "Weichzeichner (Blur)",
    systemTitle: "System Einstellungen", language: "Sprache", themeMode: "Theme Mode",
    btnRender: "Rendern", previewTitle: "Live-Vorschau"
  },
  en: {
    sourceTitle: "Image Source", dropzoneBig: "Select Image",
    profileTitle: "Printer Profile", doubleStrike: "Double-Strike", condensedMode: "Condensed Mode",
    adjustTitle: "Adjustments", brightness: "Brightness", contrast: "Contrast", gamma: "Gamma", invert: "Invert",
    halftoneTitle: "Halftone", paperFormatTitle: "Paper & Format",
    inkTitle: "Ink", paperTitle: "Paper",
    presetsTitle: "Saved Presets", btnExport: "Export YAML", btnImport: "Import YAML",
    createPresetTitle: "Create Preset", btnSavePreset: "Save Preset", btnApplyYaml: "Apply from Textbox",
    errorsTitle: "Hardware Errors", advancedTitle: "Advanced Options", softBlur: "Softening Blur",
    systemTitle: "System Settings", language: "Language", themeMode: "Theme Mode",
    btnRender: "Render", previewTitle: "Live Preview"
  },
  fr: {
    sourceTitle: "Source d'image", dropzoneBig: "Sélectionner",
    profileTitle: "Profil", doubleStrike: "Double frappe", condensedMode: "Mode condensé",
    adjustTitle: "Ajustements", brightness: "Luminosité", contrast: "Contraste", gamma: "Gamma", invert: "Inverser",
    halftoneTitle: "Demi-teinte", paperFormatTitle: "Papier et Format",
    inkTitle: "Encre", paperTitle: "Papier",
    presetsTitle: "Préréglages", btnExport: "Exporter YAML", btnImport: "Importer YAML",
    createPresetTitle: "Créer", btnSavePreset: "Sauvegarder", btnApplyYaml: "Appliquer YAML",
    errorsTitle: "Erreurs", advancedTitle: "Options avancées", softBlur: "Flou",
    systemTitle: "Système", language: "Langue", themeMode: "Thème",
    btnRender: "Rendu", previewTitle: "Aperçu en direct"
  }
};

function applyLanguage(lang) {
  const dict = translations[lang] || translations.de;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) el.textContent = dict[key];
  });
}

// ==================== DPI & FILE HELPERS ====================
function readJfifDpi(buf) {
  const v = new DataView(buf);
  if (v.byteLength < 18 || v.getUint16(0) !== 0xFFD8) return null;
  if (v.getUint16(2) !== 0xFFE0) return null;
  const sig = String.fromCharCode(v.getUint8(6),v.getUint8(7),v.getUint8(8),v.getUint8(9),v.getUint8(10));
  if (sig !== 'JFIF\0') return null;
  const units = v.getUint8(11);
  const xd = v.getUint16(12);
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
    const len = v.getUint32(pos);
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
function estimateDpiFromImageSize(img) { return snapDpi(Math.round(Math.max(img.width, img.height) / (297 / 25.4))); }

const statusEl = document.getElementById("status");
function setStatus(text, working = false) {
  statusEl.textContent = text;
  statusEl.style.color = working ? "var(--accent)" : "var(--ink-soft)";
}

// ==================== DEBOUNCER FOR PERFORMANCE ====================
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

const debouncedRefreshAscii = debounce(() => {
  if (!state.sourceImage) return;
  try {
    const asciiEl = document.getElementById("ascii");
    asciiEl.classList.remove("empty");
    asciiEl.textContent = asciiPreview(state.sourceImage, 56);
  } catch (e) { console.warn(e); }
}, 150);

// ==================== APP LAYOUT TABS ====================
document.querySelectorAll('.activity-bar .icon-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.activity-bar .icon-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.sidebar .tab-content').forEach(tc => tc.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// ==================== SYSTEM (LANG & THEME) ====================
document.getElementById('langSelector').addEventListener('change', (e) => applyLanguage(e.target.value));
document.getElementById('themeModeSelector').addEventListener('change', (e) => {
  document.body.className = e.target.value === 'light' ? 'light-mode' : 'dark-mode';
});

// ==================== ZOOM CONTROLS ====================
let currentZoom = 1;
const zoomContainer = document.getElementById('zoomContainer');
const zoomLevelText = document.getElementById('zoomLevel');
function setZoom(level) {
  currentZoom = Math.max(0.5, Math.min(level, 3));
  zoomContainer.style.transform = `scale(${currentZoom})`;
  zoomLevelText.textContent = `${Math.round(currentZoom * 100)}%`;
}
document.getElementById('zoomIn').addEventListener('click', () => setZoom(currentZoom + 0.25));
document.getElementById('zoomOut').addEventListener('click', () => setZoom(currentZoom - 0.25));
document.getElementById('canvasWrapper').addEventListener('wheel', (e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    setZoom(currentZoom - (e.deltaY > 0 ? 0.1 : -0.1));
  }
});

// ==================== UI WIRING & LOGIC ====================
function updateProfileMeta() {
  const p = PROFILES[state.profile];
  document.getElementById("profileMeta").textContent = `${p.pins}-pin · ${p.dpi_h}×${p.dpi_v} dpi · ⌀ ${p.dot_diameter_mm}mm`;
  const condCheck = document.querySelector('[data-flag="condensed"]');
  if (!p.supports_condensed) {
    condCheck.dataset.disabled = "true"; condCheck.classList.remove("on"); state.condensed = false;
  } else {
    condCheck.dataset.disabled = "false";
  }
}

document.getElementById('profileList').addEventListener('click', (e) => {
  const item = e.target.closest('.sli');
  if (!item) return;
  document.querySelectorAll('#profileList .sli').forEach(s => s.classList.remove('active'));
  item.classList.add('active');
  state.profile = item.dataset.profile;
  updateProfileMeta();
  debouncedRefreshAscii();
});

function wireSegmented(containerId, stateKey, attrKey, onChange = null) {
  document.getElementById(containerId).addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    document.querySelectorAll(`#${containerId} button`).forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state[stateKey] = btn.dataset[attrKey];
    if (onChange) onChange();
    debouncedRefreshAscii();
  });
}
wireSegmented("ditherBtns", "dither", "dither", () => {
  document.getElementById("thresholdField").style.display = state.dither === "threshold" ? "block" : "none";
});
wireSegmented("paperFormatBtns", "paperFormat", "format");
wireSegmented("orientationBtns", "orientation", "orient");

document.querySelectorAll(".check").forEach(el => {
  el.addEventListener("click", () => {
    if (el.dataset.disabled === "true") return;
    el.classList.toggle("on");
    state[el.dataset.flag] = el.classList.contains("on");
    debouncedRefreshAscii();
  });
});

function wireSlider(id, valId, stateKey, transform = v => +v, format = v => v) {
  const s = document.getElementById(id);
  const v = document.getElementById(valId);
  const apply = () => {
    const raw = transform(s.value);
    state[stateKey] = raw;
    v.textContent = format(raw);
    debouncedRefreshAscii();
  };
  s.addEventListener("input", apply);
  apply();
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

// ==================== COLORS & INK ====================
function wireSwatches(containerId, stateKey, attrKey) {
  const box = document.getElementById(containerId);
  box.addEventListener("click", (e) => {
    const sw = e.target.closest(".swatch");
    if (!sw || !sw.dataset[attrKey]) return;
    box.querySelectorAll(".swatch").forEach(s => s.classList.remove("active"));
    sw.classList.add("active");
    state[stateKey] = sw.dataset[attrKey].split(",").map(Number);
  });
}
wireSwatches("inkSwatches", "ink", "ink");
wireSwatches("paperSwatches", "paper", "paper");

const inkColorPicker = document.getElementById('inkColorPicker');
const inkHexInput = document.getElementById('inkHexInput');
function hexToRgb(hex) {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}
function applyCustomInk(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return;
  const swatch = document.getElementById('customInkSwatch');
  swatch.dataset.ink = rgb.join(',');
  swatch.style.background = hex;
  document.querySelectorAll('#inkSwatches .swatch').forEach(s => s.classList.remove('active'));
  swatch.classList.add('active');
  state.ink = rgb;
  debouncedRefreshAscii();
}
inkColorPicker.addEventListener('input', (e) => {
  inkHexInput.value = e.target.value;
  applyCustomInk(e.target.value);
});
inkHexInput.addEventListener('input', (e) => {
  const hex = e.target.value.trim();
  if (/^#[0-9a-f]{6}$/i.test(hex)) {
    inkColorPicker.value = hex;
    applyCustomInk(hex);
  }
});

function detectAndSetPaperColor(img) {
  try {
    const c = document.createElement("canvas"); c.width = 64; c.height = 64;
    const ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0, 64, 64);
    const data = ctx.getImageData(0, 0, 64, 64).data;
    let r = 0, g = 0, b = 0, count = 0;
    for (let y = 4; y < 60; y++) {
      for (let x = 4; x < 60; x++) {
        const idx = (y * 64 + x) * 4;
        r += data[idx]; g += data[idx+1]; b += data[idx+2]; count++;
      }
    }
    r = Math.round(r/count); g = Math.round(g/count); b = Math.round(b/count);
    let bestSwatch = null, minDist = Infinity;
    document.querySelectorAll('#paperSwatches .swatch').forEach(sw => {
      if(!sw.dataset.paper) return;
      const rgb = sw.dataset.paper.split(",").map(Number);
      const dist = (r-rgb[0])**2 + (g-rgb[1])**2 + (b-rgb[2])**2;
      if (dist < minDist) { minDist = dist; bestSwatch = sw; }
    });
    if (bestSwatch) {
      document.querySelectorAll('#paperSwatches .swatch').forEach(s => s.classList.remove("active"));
      bestSwatch.classList.add("active");
      state.paper = bestSwatch.dataset.paper.split(",").map(Number);
    }
  } catch (e) { console.warn(e); }
}

// ==================== ERRORS / WEAR LAYERS ====================
function syncWearLayersFromUI() {
  state.wearLayers = [];
  document.querySelectorAll('#errorList .er.on').forEach(el => {
    const slider = el.querySelector('.er-slider');
    state.wearLayers.push({ pattern: el.dataset.pattern, strength: +slider.value });
  });
}
document.getElementById('errorList').addEventListener('click', (e) => {
  const head = e.target.closest('.er-head');
  if (!head) return;
  const er = head.closest('.er');
  er.classList.toggle('on');
  er.querySelector('.er-val').textContent = er.classList.contains('on') ? er.querySelector('.er-slider').value + '%' : '0%';
  syncWearLayersFromUI();
});
document.getElementById('errorList').addEventListener('input', (e) => {
  if (!e.target.classList.contains('er-slider')) return;
  e.target.closest('.er').querySelector('.er-val').textContent = e.target.value + '%';
  syncWearLayersFromUI();
});

// ==================== PRESET SYSTEM ====================
function loadUserPresets() { try { return JSON.parse(localStorage.getItem('dm_presets') || '[]'); } catch { return []; } }
function saveUserPresets(ps) { try { localStorage.setItem('dm_presets', JSON.stringify(ps)); } catch {} }

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

function captureCurrentPreset(name) {
  return {
    name: name || 'Unnamed', system: false, profile: state.profile,
    brightness: state.brightness, contrast: state.contrast, gamma: state.gamma, dither: state.dither, threshold: state.threshold,
    ink: [...state.ink], paper: [...state.paper], paperFormat: state.paperFormat, orientation: state.orientation,
    doubleStrike: state.doubleStrike, condensed: state.condensed, softBlur: state.softBlur, invert: state.invert,
    dpi: state.dpi, jitterScale: state.jitterScale, bandingScale: state.bandingScale, maxSize: state.maxSize, seed: state.seed,
    wearLayers: state.wearLayers.map(l => ({ ...l }))
  };
}

function applyPreset(p) {
  if (!p) return;
  const setS = (id, vid, v) => { const e=document.getElementById(id); if(e && v!==undefined){ e.value=v; document.getElementById(vid).textContent=v; }};
  if (p.profile) { state.profile = p.profile; document.querySelectorAll('#profileList .sli').forEach(s => s.classList.toggle('active', s.dataset.profile === p.profile)); updateProfileMeta(); }
  
  if (p.brightness!==undefined) { state.brightness = p.brightness; setS('brightnessSlider','brightnessVal',p.brightness); }
  if (p.contrast!==undefined) { state.contrast = p.contrast; setS('contrastSlider','contrastVal',p.contrast); }
  if (p.gamma!==undefined) { state.gamma = p.gamma; setS('gammaSlider','gammaVal',p.gamma); }
  if (p.threshold!==undefined) { state.threshold = p.threshold; setS('thresholdSlider','thresholdVal',p.threshold); }
  
  if (p.dither) { state.dither = p.dither; document.querySelectorAll('#ditherBtns button').forEach(b => b.classList.toggle('active', b.dataset.dither === p.dither)); document.getElementById('thresholdField').style.display = p.dither === 'threshold'?'block':'none'; }
  if (p.paperFormat) { state.paperFormat = p.paperFormat; document.querySelectorAll('#paperFormatBtns button').forEach(b => b.classList.toggle('active', b.dataset.format === p.paperFormat)); }
  if (p.orientation) { state.orientation = p.orientation; document.querySelectorAll('#orientationBtns button').forEach(b => b.classList.toggle('active', b.dataset.orient === p.orientation)); }
  
  if (p.ink) { state.ink = p.ink; document.querySelectorAll('#inkSwatches .swatch').forEach(s => s.classList.toggle('active', s.dataset.ink === p.ink.join(','))); }
  if (p.paper !== undefined) {
    if (p.paper === null && state.sourceImage) detectAndSetPaperColor(state.sourceImage);
    else if (p.paper) { state.paper = p.paper; document.querySelectorAll('#paperSwatches .swatch').forEach(s => s.classList.toggle('active', s.dataset.paper === p.paper.join(','))); }
  }

  const setB = (flag, v) => { if (v!==undefined){ state[flag] = v; const el = document.querySelector(`[data-flag="${flag}"]`); if(el) el.classList.toggle('on', v); }};
  setB('doubleStrike', p.doubleStrike); setB('condensed', p.condensed); setB('softBlur', p.softBlur); setB('invert', p.invert);
  
  if (p.wearLayers !== undefined) {
    state.wearLayers = p.wearLayers.map(l => ({ ...l }));
    document.querySelectorAll('#errorList .er').forEach(el => { el.classList.remove('on'); el.querySelector('.er-val').textContent = '0%'; });
    for (const layer of p.wearLayers) {
      const el = document.querySelector(`#errorList .er[data-pattern="${layer.pattern}"]`);
      if (el) { el.classList.add('on'); el.querySelector('.er-slider').value = layer.strength; el.querySelector('.er-val').textContent = layer.strength + '%'; }
    }
  }
  debouncedRefreshAscii();
}

document.getElementById('savePresetBtn').addEventListener('click', () => {
  const name = document.getElementById('presetNameInput').value.trim();
  if (!name) return alert('Name erforderlich');
  const preset = captureCurrentPreset(name); preset.id = 'usr_'+Date.now();
  const presets = loadUserPresets(); presets.push(preset); saveUserPresets(presets);
  renderPresetList(); setStatus("Preset gespeichert.");
});

// ==================== FILE DROPPING ====================
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
dropzone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (e) => handleFile(e.target.files[0]));

async function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) return setStatus("Kein Bild.");
  setStatus("Lade Bild...");
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    state.dpi = estimateDpiFromImageSize(img);
    document.getElementById("dpiSlider").value = state.dpi; document.getElementById("dpiVal").textContent = state.dpi;
    state.sourceImage = img;
    detectAndSetPaperColor(img);
    document.getElementById("dzBig").textContent = file.name;
    document.getElementById("dzSmall").textContent = `${img.width} × ${img.height}`;
    
    const outCanvas = document.getElementById("outCanvas");
    const scale = Math.min(1, 800 / Math.max(img.width, img.height));
    outCanvas.width = img.width * scale; outCanvas.height = img.height * scale;
    outCanvas.getContext("2d").drawImage(img, 0, 0, outCanvas.width, outCanvas.height);
    
    document.getElementById("renderBtn").disabled = false;
    setStatus("Bereit zum Rendern.");
    debouncedRefreshAscii();
  };
  img.src = url;
}

// ==================== RENDER ====================
let lastRenderedBlob = null;
const renderBtn = document.getElementById("renderBtn");
const downloadBtn = document.getElementById("downloadBtn");

renderBtn.addEventListener("click", async () => {
  if (!state.sourceImage) return;
  renderBtn.disabled = true; downloadBtn.disabled = true;
  setStatus("Rendern...", true);
  try {
    const t0 = performance.now();
    const { imageData, width, height } = await render(state.sourceImage, msg => setStatus(msg, true));
    const outCanvas = document.getElementById("outCanvas");
    outCanvas.width = width; outCanvas.height = height;
    outCanvas.getContext("2d").putImageData(imageData, 0, 0);
    outCanvas.toBlob(blob => { lastRenderedBlob = blob; downloadBtn.disabled = false; }, "image/png");
    setStatus(`Fertig in ${((performance.now() - t0) / 1000).toFixed(2)}s`);
  } catch (e) {
    console.error(e); setStatus("Fehler: " + e.message);
  } finally {
    renderBtn.disabled = false;
  }
});

downloadBtn.addEventListener("click", () => {
  if (!lastRenderedBlob) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(lastRenderedBlob);
  a.download = `dotmatrix_${state.profile}_${Date.now()}.png`;
  document.body.appendChild(a); a.click(); a.remove();
});

// ==================== INIT ====================
applyLanguage('de');
updateProfileMeta();
renderPresetList();
