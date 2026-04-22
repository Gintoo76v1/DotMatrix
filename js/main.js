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
    createPresetTitle: "Preset Erstellen / Code", btnSavePreset: "Als Preset speichern", btnApplyYaml: "Aus Textfeld anwenden",
    errorsTitle: "Hardware Fehler", advancedTitle: "Erweiterte Render-Optionen", softBlur: "Weichzeichner (Blur)",
    systemTitle: "System Einstellungen", language: "Sprache", themeMode: "Theme Mode", themeAccent: "Theme Accent",
    btnRender: "Rendern", previewTitle: "Live-Vorschau"
  },
  en: {
    sourceTitle: "Image Source", dropzoneBig: "Select Image",
    profileTitle: "Printer Profile", doubleStrike: "Double-Strike", condensedMode: "Condensed Mode",
    adjustTitle: "Adjustments", brightness: "Brightness", contrast: "Contrast", gamma: "Gamma", invert: "Invert",
    halftoneTitle: "Halftone", paperFormatTitle: "Paper & Format",
    inkTitle: "Ink", paperTitle: "Paper",
    presetsTitle: "Saved Presets", btnExport: "Export YAML", btnImport: "Import YAML",
    createPresetTitle: "Create / Code", btnSavePreset: "Save as Preset", btnApplyYaml: "Apply from Textbox",
    errorsTitle: "Hardware Errors", advancedTitle: "Advanced Options", softBlur: "Softening Blur",
    systemTitle: "System Settings", language: "Language", themeMode: "Theme Mode", themeAccent: "Theme Accent",
    btnRender: "Render", previewTitle: "Live Preview"
  },
  fr: {
    sourceTitle: "Source d'image", dropzoneBig: "Sélectionner",
    profileTitle: "Profil", doubleStrike: "Double frappe", condensedMode: "Mode condensé",
    adjustTitle: "Ajustements", brightness: "Luminosité", contrast: "Contraste", gamma: "Gamma", invert: "Inverser",
    halftoneTitle: "Demi-teinte", paperFormatTitle: "Papier et Format",
    inkTitle: "Encre", paperTitle: "Papier",
    presetsTitle: "Préréglages", btnExport: "Exporter YAML", btnImport: "Importer YAML",
    createPresetTitle: "Créer / Code", btnSavePreset: "Sauvegarder", btnApplyYaml: "Appliquer YAML",
    errorsTitle: "Erreurs", advancedTitle: "Options avancées", softBlur: "Flou",
    systemTitle: "Système", language: "Langue", themeMode: "Thème", themeAccent: "Accent",
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

// ==================== INTERACTIVE ANIMATIONS ====================
document.addEventListener('click', (e) => {
  if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  const r = document.createElement('div');
  r.className = 'click-shockwave';
  r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
  document.body.appendChild(r);
  setTimeout(() => r.remove(), 600);
});

document.addEventListener('keydown', (e) => {
  if (['INPUT','TEXTAREA'].includes(document.activeElement.tagName) && document.activeElement.type !== 'range') return;
  if (['Shift','Control','Alt','Meta','CapsLock','Tab'].includes(e.key)) return;
  const k = document.createElement('div');
  k.className = 'key-echo';
  k.textContent = e.key.length === 1 ? e.key.toUpperCase() : `[${e.key.toUpperCase()}]`;
  k.style.left = (Math.random() * 80 + 10) + 'vw';
  k.style.bottom = '15vh';
  document.body.appendChild(k);
  setTimeout(() => k.remove(), 1200);
});

// ==================== DPI & FILE HELPERS ====================
function readJfifDpi(buf) {
  const v = new DataView(buf);
  if (v.byteLength < 18 || v.getUint16(0) !== 0xFFD8) return null;
  if (v.getUint16(2) !== 0xFFE0) return null;
  const sig = String.fromCharCode(v.getUint8(6),v.getUint8(7),v.getUint8(8),v.getUint8(9),v.getUint8(10));
  if (sig !== 'JFIF\0') return null;
  const units = v.getUint8(11); const xd = v.getUint16(12);
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
      const ppuX = v.getUint32(pos + 8); const unit = v.getUint8(pos + 16);
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

// ==================== APP LAYOUT TABS (VS CODE STYLE) ====================
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
document.getElementById('themeAccentSelector').addEventListener('change', (e) => {
  document.body.setAttribute('data-accent', e.target.value);
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
    if(!s) return;
    const raw = transform(s.value);
    state[stateKey] = raw;
    v.textContent = format(raw);
    debouncedRefreshAscii();
  };
  if(s) { s.addEventListener("input", apply); apply(); }
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

// ==================== COLORS, INK & ANALYSIS ====================
function wireSwatches(containerId, stateKey, attrKey) {
  const box = document.getElementById(containerId);
  box.addEventListener("click", (e) => {
    const sw = e.target.closest(".swatch");
    if (!sw || !sw.dataset[attrKey]) return;
    box.querySelectorAll(".swatch").forEach(s => s.classList.remove("active"));
    sw.classList.add("active");
    state[stateKey] = sw.dataset[attrKey].split(",").map(Number);
    debouncedRefreshAscii();
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

function analyzeAndAdaptImage(img) {
  try {
    const c = document.createElement("canvas"); c.width = 160; c.height = 160;
    const ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0, 160, 160);
    const { data } = ctx.getImageData(0, 0, 160, 160);
    const hist = new Uint32Array(256);
    for (let i = 0; i < data.length; i += 4) {
      hist[Math.round(0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2])]++;
    }
    const total = 160 * 160; let cumSum = 0, p2 = 0, p98 = 255;
    for (let i = 0; i < 256; i++) {
      cumSum += hist[i];
      if (cumSum / total < 0.02) p2 = i;
      if (cumSum / total < 0.98) p98 = i;
    }
    const range = Math.max(p98 - p2, 20);
    const brightPx = hist.slice(180).reduce((a, b) => a + b, 0);
    const isDoc = brightPx / total > 0.45;

    if (isDoc) {
      const newContrast = Math.min(65, Math.round((220 / range - 1) * 55));
      state.brightness = 0; state.contrast = Math.max(20, newContrast);
      state.threshold = 128; state.dither = "threshold";
      document.getElementById("brightnessSlider").value = 0; document.getElementById("brightnessVal").textContent = 0;
      document.getElementById("contrastSlider").value = state.contrast; document.getElementById("contrastVal").textContent = state.contrast;
      document.getElementById("thresholdSlider").value = 128; document.getElementById("thresholdVal").textContent = 128;
      document.querySelectorAll("#ditherBtns button").forEach(b => b.classList.toggle("active", b.dataset.dither === "threshold"));
      document.getElementById("thresholdField").style.display = "block";
    } else {
      const newBrightness = Math.round(((p2 + p98) / 2 - 128) * -0.35);
      const newContrast = Math.min(40, Math.round((180 / range - 1) * 30));
      state.brightness = Math.max(-60, Math.min(60, newBrightness));
      state.contrast = Math.max(0, Math.min(40, newContrast));
      document.getElementById("brightnessSlider").value = state.brightness; document.getElementById("brightnessVal").textContent = state.brightness;
      document.getElementById("contrastSlider").value = state.contrast; document.getElementById("contrastVal").textContent = state.contrast;
    }
  } catch (e) { console.warn("Image analysis failed", e); }
}

// ==================== ERRORS / WEAR LAYERS ====================
function syncWearLayersFromUI() {
  state.wearLayers = [];
  document.querySelectorAll('#errorList .er.on').forEach(el => {
    const slider = el.querySelector('.er-slider');
    state.wearLayers.push({ pattern: el.dataset.pattern, strength: +slider.value });
  });
  debouncedRefreshAscii();
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

// ==================== PRESET YAML SERIALIZER / PARSER ====================
function presetToYaml(preset) {
  const SKIP = new Set(['id', 'system']);
  const lines = [];
  for (const [k, v] of Object.entries(preset)) {
    if (SKIP.has(k)) continue;
    if (Array.isArray(v)) {
      if (v.length === 0) lines.push(`${k}: []`);
      else if (typeof v[0] === 'number') lines.push(`${k}: [${v.join(', ')}]`);
      else {
        lines.push(`${k}:`);
        for (const obj of v) {
          const entries = Object.entries(obj);
          lines.push(`  - ${entries[0][0]}: ${entries[0][1]}`);
          for (let i = 1; i < entries.length; i++) lines.push(`    ${entries[i][0]}: ${entries[i][1]}`);
        }
      }
    } else if (v === null) lines.push(`${k}: null`);
    else lines.push(`${k}: ${v}`);
  }
  return lines.join('\n');
}

function yamlToPreset(yaml) {
  const preset = {}; const lines = yaml.split('\n');
  let currentArrayKey = null; let currentObj = null;
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const indent = raw.search(/\S/);
    if (indent === 0) {
      currentArrayKey = null; currentObj = null;
      const ci = trimmed.indexOf(':'); if (ci === -1) continue;
      const key = trimmed.slice(0, ci).trim(); const val = trimmed.slice(ci + 1).trim();
      if (!val) { currentArrayKey = key; preset[key] = []; }
      else if (val === '[]') preset[key] = [];
      else if (val === 'null') preset[key] = null;
      else if (val === 'true') preset[key] = true;
      else if (val === 'false') preset[key] = false;
      else if (val.startsWith('[')) {
        const inner = val.slice(1, val.lastIndexOf(']'));
        preset[key] = inner.split(',').map(s => isNaN(parseFloat(s.trim())) ? s.trim() : parseFloat(s.trim()));
      } else { preset[key] = isNaN(parseFloat(val)) ? val : parseFloat(val); }
    } else if (indent === 2 && trimmed.startsWith('- ') && currentArrayKey) {
      const inner = trimmed.slice(2).trim();
      const ci = inner.indexOf(':'); if (ci === -1) continue;
      const k = inner.slice(0, ci).trim(); const vr = inner.slice(ci + 1).trim();
      currentObj = { [k]: isNaN(parseFloat(vr)) ? vr : parseFloat(vr) };
      preset[currentArrayKey].push(currentObj);
    } else if (indent === 4 && currentObj !== null) {
      const ci = trimmed.indexOf(':'); if (ci === -1) continue;
      const k = trimmed.slice(0, ci).trim(); const vr = trimmed.slice(ci + 1).trim();
      currentObj[k] = isNaN(parseFloat(vr)) ? vr : parseFloat(vr);
    }
  }
  return preset;
}

// ==================== PRESET SYSTEM ====================
const STORAGE_KEY = 'dotmatrix_user_presets';
function loadUserPresets() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
function saveUserPresets(presets) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(presets)); } catch {} }
function deleteUserPreset(id) { saveUserPresets(loadUserPresets().filter(p => p.id !== id)); renderPresetList(); }

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

let activePresetId = null;

function applyPreset(p) {
  if (!p) return;
  const setS = (id, vid, v) => { const e=document.getElementById(id); if(e && v!==undefined){ e.value=v; document.getElementById(vid).textContent=v; }};
  if (p.profile && PROFILES[p.profile]) { state.profile = p.profile; document.querySelectorAll('#profileList .sli').forEach(s => s.classList.toggle('active', s.dataset.profile === p.profile)); updateProfileMeta(); }
  
  if (p.brightness!==undefined) { state.brightness = p.brightness; setS('brightnessSlider','brightnessVal',p.brightness); }
  if (p.contrast!==undefined) { state.contrast = p.contrast; setS('contrastSlider','contrastVal',p.contrast); }
  if (p.gamma!==undefined) { state.gamma = p.gamma; setS('gammaSlider','gammaVal',p.gamma); }
  if (p.threshold!==undefined) { state.threshold = p.threshold; setS('thresholdSlider','thresholdVal',p.threshold); }
  if (p.dpi!==undefined) { state.dpi = p.dpi; setS('dpiSlider','dpiVal',p.dpi); }
  if (p.jitterScale!==undefined) { state.jitterScale = p.jitterScale; setS('jitterSlider','jitterVal',Math.round(p.jitterScale*10),v=>(+v/10).toFixed(1)); }
  if (p.bandingScale!==undefined){ state.bandingScale = p.bandingScale; setS('bandingSlider','bandingVal',Math.round(p.bandingScale*10),v=>(+v/10).toFixed(1)); }
  if (p.maxSize!==undefined) { state.maxSize = p.maxSize; setS('maxSizeSlider','maxSizeVal',p.maxSize); }
  if (p.seed!==undefined) { state.seed = p.seed; setS('seedSlider','seedVal',p.seed); }
  
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

  const setB = (flag, v) => { if (v!==undefined){ state[flag] = v; const el = document.querySelector(`[data-flag="${flag}"]`); if(el) el.classList.toggle('on', v); }};
  setB('doubleStrike', p.doubleStrike); setB('condensed', p.condensed); setB('softBlur', p.softBlur); setB('invert', p.invert);
  updateProfileMeta();
  
  if (p.wearLayers !== undefined) {
    state.wearLayers = p.wearLayers.map(l => ({ ...l }));
    document.querySelectorAll('#errorList .er').forEach(el => { el.classList.remove('on'); el.querySelector('.er-val').textContent = '0%'; });
    for (const layer of p.wearLayers) {
      const el = document.querySelector(`#errorList .er[data-pattern="${layer.pattern}"]`);
      if (el) { el.classList.add('on'); el.querySelector('.er-slider').value = layer.strength ?? 50; el.querySelector('.er-val').textContent = (layer.strength ?? 50) + '%'; }
    }
  } else {
    state.wearLayers = [];
    document.querySelectorAll('#errorList .er').forEach(el => { el.classList.remove('on'); el.querySelector('.er-val').textContent = '0%'; });
  }
  debouncedRefreshAscii();
}

function renderPresetList() {
  const list = document.getElementById('presetList');
  list.innerHTML = '';
  const allPresets = [...SYSTEM_PRESETS, ...loadUserPresets()];
  allPresets.forEach(p => {
    const el = document.createElement('div');
    el.className = 'sli' + (p.id === activePresetId ? ' active' : '');
    
    if(p.system) {
      el.innerHTML = `<div class="sli-row" style="width:100%;"><span class="sli-name">${p.name}</span><span class="sli-badge">SYS</span></div>`;
    } else {
      el.innerHTML = `<div class="sli-row" style="width:100%;"><span class="sli-name">${p.name}</span><div><span class="sli-badge" style="margin-right:5px;">USR</span><button class="sli-del" title="Löschen">×</button></div></div>`;
      el.querySelector('.sli-del').addEventListener('click', (e) => {
        e.stopPropagation();
        if(confirm(`Preset "${p.name}" löschen?`)) { if(activePresetId === p.id) activePresetId = null; deleteUserPreset(p.id); }
      });
    }

    el.addEventListener('click', () => {
      activePresetId = p.id;
      document.querySelectorAll('#presetList .sli').forEach(s => s.classList.remove('active'));
      el.classList.add('active');
      applyPreset(p);
    });
    list.appendChild(el);
  });
}

// ==================== EXPORT / IMPORT (INKL. LEGACY REPAIR) ====================
function downloadText(text, filename) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  a.download = filename; document.body.appendChild(a); a.click(); a.remove();
}

document.getElementById('exportPresetBtn').addEventListener('click', () => {
  let name = document.getElementById('presetNameInput').value.trim();
  if (!name) { name = prompt('Preset Name:', 'My Preset'); if (name === null) return; name = name.trim() || 'preset'; document.getElementById('presetNameInput').value = name; }
  const yaml = presetToYaml(captureCurrentPreset(name));
  downloadText(yaml, `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.yaml`);
});

document.getElementById('exportCurrentBtn').addEventListener('click', () => {
  const name = document.getElementById('presetNameInput').value.trim() || 'my-preset';
  const yaml = presetToYaml(captureCurrentPreset(name));
  document.getElementById('presetYamlArea').value = yaml;
  downloadText(yaml, `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.yaml`);
});

document.getElementById('importPresetBtn').addEventListener('click', () => document.getElementById('presetFileInput').click());
document.getElementById('presetFileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  importFromText(await file.text()); e.target.value = '';
});

document.getElementById('savePresetBtn').addEventListener('click', () => {
  const name = document.getElementById('presetNameInput').value.trim();
  if (!name) return alert('Name erforderlich');
  const preset = captureCurrentPreset(name); preset.id = 'usr_'+Date.now();
  const presets = loadUserPresets(); presets.push(preset); saveUserPresets(presets);
  activePresetId = preset.id; renderPresetList(); setStatus(`Preset "${name}" gespeichert.`);
});

document.getElementById('importYamlBtn').addEventListener('click', () => {
  const text = document.getElementById('presetYamlArea').value.trim();
  if (!text) return alert('YAML einfügen!'); importFromText(text);
});

// Repariert alte Presets mit "wear: {cloudy: 30}" anstelle von "wearLayers: [...]"
function normalizePreset(raw) {
  if (raw.wear && !raw.wearLayers) {
    const known = new Set(["cloudy", "ghosting", "misaligned", "pin_skip", "smudge", "ribbon_twist", "head_gap", "ink_starved", "paper_slip", "static_noise", "double_feed", "mechanical_resonance"]);
    raw.wearLayers = Object.entries(raw.wear).filter(([k, v]) => known.has(k) && v > 0).map(([pattern, strength]) => ({ pattern, strength }));
    delete raw.wear;
  }
  return raw;
}

function importFromText(text) {
  try {
    const stripped = text.trim();
    let preset = stripped.startsWith('{') ? normalizePreset(JSON.parse(stripped)) : normalizePreset(yamlToPreset(stripped));
    if (!preset.name) preset.name = 'Imported';
    applyPreset(preset);
    setStatus(`Preset "${preset.name}" importiert.`);
    if (preset.name !== 'Imported') {
      preset.id = 'usr_' + Date.now(); preset.system = false;
      const presets = loadUserPresets(); presets.push(preset); saveUserPresets(presets);
      activePresetId = preset.id; renderPresetList();
    }
  } catch (err) { alert('Import fehlgeschlagen: ' + err.message); }
}

// ==================== FILE DROPPING ====================
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
dropzone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (e) => handleFile(e.target.files[0]));
dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.style.borderColor = "var(--accent)"; });
dropzone.addEventListener("dragleave", () => dropzone.style.borderColor = "var(--glass-border)");
dropzone.addEventListener("drop", (e) => {
  e.preventDefault(); dropzone.style.borderColor = "var(--glass-border)";
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

async function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) return setStatus("Kein Bild.");
  setStatus("Lade Bild...");
  let metaDpi = null;
  try {
    const buf = await file.slice(0, 256).arrayBuffer();
    if (file.type === 'image/jpeg') metaDpi = readJfifDpi(buf);
    else if (file.type === 'image/png') metaDpi = readPngDpi(buf);
  } catch {}

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    state.dpi = (metaDpi && metaDpi > 96) ? snapDpi(metaDpi) : estimateDpiFromImageSize(img);
    document.getElementById("dpiSlider").value = state.dpi; document.getElementById("dpiVal").textContent = state.dpi;
    state.sourceImage = img;
    
    detectAndSetPaperColor(img);
    analyzeAndAdaptImage(img);
    
    document.getElementById("dzBig").textContent = file.name;
    document.getElementById("dzSmall").textContent = `${img.width} × ${img.height}`;
    
    const outCanvas = document.getElementById("outCanvas");
    const scale = Math.min(1, 800 / Math.max(img.width, img.height));
    outCanvas.width = Math.round(img.width * scale); outCanvas.height = Math.round(img.height * scale);
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
