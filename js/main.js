import { state, PROFILES, SYSTEM_PRESETS, WEAR_PATTERNS } from './config.js';
import { render, asciiPreview } from './engine.js';

// ==================== UTILITIES & DEBOUNCE (Schützt vor Freezes) ====================
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => { clearTimeout(timeout); func(...args); };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const debouncedRefreshAscii = debounce(refreshAscii, 150);

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
  const longPx   = Math.max(img.width, img.height);
  const a4LongIn = 297 / 25.4;
  return snapDpi(Math.round(longPx / a4LongIn));
}

// ==================== DOM ELEMENTS (Mit Sicherheits-Checks) ====================
const dropzone    = document.getElementById("dropzone");
const fileInput   = document.getElementById("fileInput");
const outCanvas   = document.getElementById("outCanvas");
const outCtx      = outCanvas ? outCanvas.getContext("2d") : null;
const outSection  = document.getElementById("outputSection");
const asciiEl     = document.getElementById("ascii");
const statusEl    = document.getElementById("status");
const renderBtn   = document.getElementById("renderBtn");
const downloadBtn = document.getElementById("downloadBtn");
const profileMeta = document.getElementById("profileMeta");

let lastRenderedBlob = null;

// ==================== HELPERS ====================
function setStatus(text, working = false) {
  if(!statusEl) return;
  statusEl.textContent = text;
  statusEl.className = "status" + (working ? " working" : "");
}

function detectAndSetPaperColor(img) {
  try {
    const c = document.createElement("canvas");
    c.width = 64; c.height = 64;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, 64, 64);
    const data = ctx.getImageData(0, 0, 64, 64).data;
    let r = 0, g = 0, b = 0, count = 0;
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        if (x < 4 || x > 59 || y < 4 || y > 59) {
          const idx = (y * 64 + x) * 4;
          r += data[idx]; g += data[idx+1]; b += data[idx+2]; count++;
        }
      }
    }
    r = Math.round(r/count); g = Math.round(g/count); b = Math.round(b/count);
    let bestSwatch = null, minDist = Infinity;
    document.querySelectorAll('#paperSwatches .swatch').forEach(sw => {
      const rgb  = sw.dataset.paper.split(",").map(Number);
      const dist = (r-rgb[0])**2 + (g-rgb[1])**2 + (b-rgb[2])**2;
      if (dist < minDist) { minDist = dist; bestSwatch = sw; }
    });
    if (bestSwatch) {
      document.querySelectorAll('#paperSwatches .swatch').forEach(s => s.classList.remove("active"));
      bestSwatch.classList.add("active");
      state.paper = bestSwatch.dataset.paper.split(",").map(Number);
    }
  } catch (e) { console.warn("Paper auto-detect failed", e); }
}

function analyzeAndAdaptImage(img) {
  try {
    const c = document.createElement("canvas");
    c.width = 160; c.height = 160;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, 160, 160);
    const { data } = ctx.getImageData(0, 0, 160, 160);
    const hist = new Uint32Array(256);
    for (let i = 0; i < data.length; i += 4) {
      hist[Math.round(0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2])]++;
    }
    const total = 160 * 160;
    let cumSum = 0, p2 = 0, p98 = 255;
    for (let i = 0; i < 256; i++) {
      cumSum += hist[i];
      if (cumSum / total < 0.02) p2  = i;
      if (cumSum / total < 0.98) p98 = i;
    }
    const range     = Math.max(p98 - p2, 20);
    const brightPx  = hist.slice(180).reduce((a, b) => a + b, 0);
    const isDoc     = brightPx / total > 0.45;

    const setSliderSafely = (id, valId, val) => {
      const s = document.getElementById(id), v = document.getElementById(valId);
      if(s) s.value = val;
      if(v) v.textContent = val;
    };

    if (isDoc) {
      const newContrast = Math.min(65, Math.round((220 / range - 1) * 55));
      state.brightness  = 0;
      state.contrast    = Math.max(20, newContrast);
      state.threshold   = 128;
      state.dither      = "threshold";
      setSliderSafely("brightnessSlider", "brightnessVal", 0);
      setSliderSafely("contrastSlider", "contrastVal", state.contrast);
      setSliderSafely("thresholdSlider", "thresholdVal", 128);
      document.querySelectorAll("#ditherBtns button").forEach(b => b.classList.toggle("active", b.dataset.dither === "threshold"));
      if(document.getElementById("thresholdField")) document.getElementById("thresholdField").style.display = "block";
    } else {
      const newBrightness = Math.round(((p2 + p98) / 2 - 128) * -0.35);
      const newContrast   = Math.min(40, Math.round((180 / range - 1) * 30));
      state.brightness = Math.max(-60, Math.min(60, newBrightness));
      state.contrast   = Math.max(0,   Math.min(40, newContrast));
      setSliderSafely("brightnessSlider", "brightnessVal", state.brightness);
      setSliderSafely("contrastSlider", "contrastVal", state.contrast);
    }
  } catch (e) { console.warn("Image analysis failed", e); }
}

function refreshAscii() {
  if (!state.sourceImage || !asciiEl) return;
  try {
    asciiEl.classList.remove("empty");
    asciiEl.textContent = asciiPreview(state.sourceImage, 60);
  } catch (e) { console.warn(e); }
}

function updateProfileMeta() {
  if(!profileMeta) return;
  const p = PROFILES[state.profile];
  if(!p) return;
  profileMeta.textContent = `${p.label} · ${p.pins}-pin · ${p.dpi_h}×${p.dpi_v} dpi · ⌀ ${p.dot_diameter_mm}mm`;
  const condCheck = document.querySelector('[data-flag="condensed"]');
  if(condCheck) {
    if (!p.supports_condensed) {
      condCheck.dataset.disabled = "true";
      condCheck.classList.remove("on");
      state.condensed = false;
    } else {
      condCheck.dataset.disabled = "false";
    }
  }
}

// ==================== SEGMENTED BUTTONS ====================
function wireSegmented(containerId, stateKey, attrKey, onChange = null) {
  const container = document.getElementById(containerId);
  if(!container) return;
  container.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    container.querySelectorAll(`button`).forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state[stateKey] = btn.dataset[attrKey];
    if (onChange) onChange();
    markModified();
    debouncedRefreshAscii();
  });
}

wireSegmented("ditherBtns", "dither", "dither", () => {
  const tField = document.getElementById("thresholdField");
  if(tField) tField.style.display = state.dither === "threshold" ? "block" : "none";
});
wireSegmented("paperFormatBtns", "paperFormat", "format");
wireSegmented("orientationBtns",  "orientation", "orient");

// ==================== PROFILE SCROLL LIST ====================
const profileList = document.getElementById('profileList');
if(profileList) {
  profileList.addEventListener('click', (e) => {
    const item = e.target.closest('.sli');
    if (!item) return;
    profileList.querySelectorAll('.sli').forEach(s => s.classList.remove('active'));
    item.classList.add('active');
    state.profile = item.dataset.profile;
    updateProfileMeta();
    markModified();
    debouncedRefreshAscii();
  });
}

// ==================== ERROR SCROLL LIST ====================
function syncWearLayersFromUI() {
  state.wearLayers = [];
  document.querySelectorAll('#errorList .er.on').forEach(el => {
    const slider = el.querySelector('.er-slider');
    if(slider) {
      state.wearLayers.push({ pattern: el.dataset.pattern, strength: +slider.value });
    }
  });
}

const errorList = document.getElementById('errorList');
if(errorList) {
  errorList.addEventListener('click', (e) => {
    const head = e.target.closest('.er-head');
    if (!head) return;
    const er = head.closest('.er');
    er.classList.toggle('on');
    const slider = er.querySelector('.er-slider');
    const valEl  = er.querySelector('.er-val');
    if(valEl && slider) {
      valEl.textContent = er.classList.contains('on') ? slider.value + '%' : '0%';
    }
    syncWearLayersFromUI();
    markModified();
  });

  errorList.addEventListener('input', (e) => {
    if (!e.target.classList.contains('er-slider')) return;
    const er = e.target.closest('.er');
    const valEl = er.querySelector('.er-val');
    if(valEl) valEl.textContent = e.target.value + '%';
    syncWearLayersFromUI();
    markModified();
  });
}

// ==================== CHECKBOXES ====================
document.querySelectorAll(".check").forEach(el => {
  el.addEventListener("click", () => {
    if (el.dataset.disabled === "true") return;
    el.classList.toggle("on");
    state[el.dataset.flag] = el.classList.contains("on");
    markModified();
    debouncedRefreshAscii();
  });
});

// ==================== SWATCHES ====================
function wireSwatches(containerId, stateKey, attrKey) {
  const box = document.getElementById(containerId);
  if(!box) return;
  box.addEventListener("click", (e) => {
    const sw = e.target.closest(".swatch");
    if (!sw || !sw.dataset[attrKey]) return;
    box.querySelectorAll(".swatch").forEach(s => s.classList.remove("active"));
    sw.classList.add("active");
    state[stateKey] = sw.dataset[attrKey].split(",").map(Number);
    markModified();
  });
}
wireSwatches("inkSwatches",   "ink",   "ink");
wireSwatches("paperSwatches", "paper", "paper");

// ==================== CUSTOM INK PICKER (Übersichtlich & Logisch) ====================
function hexToRgb(hex) {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('');
}

const inkColorPicker = document.getElementById('inkColorPicker');
const applyCustomInkBtn = document.getElementById('applyCustomInkBtn');

if(inkColorPicker && applyCustomInkBtn) {
  applyCustomInkBtn.addEventListener('click', () => {
    const hex = inkColorPicker.value;
    const rgb = hexToRgb(hex);
    if (!rgb) return;
    
    const swatch = document.getElementById('customInkSwatch');
    if(swatch) {
      swatch.dataset.ink = rgb.join(',');
      swatch.style.background = hex;
      document.querySelectorAll('#inkSwatches .swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
    }
    state.ink = rgb;
    markModified();
  });
}

// ==================== SLIDERS (with Safeties & Debounce) ====================
function wireSlider(id, valId, stateKey, transform = v => +v, format = v => v, liveRefresh = false) {
  const s = document.getElementById(id);
  const v = document.getElementById(valId);
  if (!s || !v) return;
  const apply = (fromUser) => {
    const raw = transform(s.value);
    state[stateKey] = raw;
    v.textContent = format(raw);
    if (fromUser) markModified();
    if (liveRefresh) debouncedRefreshAscii();
  };
  s.addEventListener("input", () => apply(true));
  apply(false); // Init
}

wireSlider("thresholdSlider", "thresholdVal", "threshold", v => +v, v => v, true);
wireSlider("brightnessSlider","brightnessVal","brightness", v => +v, v => v, true);
wireSlider("contrastSlider",  "contrastVal",  "contrast",  v => +v, v => v, true);
wireSlider("gammaSlider",     "gammaVal",     "gamma",     v => +v, v => (+v).toFixed(1), true);
wireSlider("dpiSlider",       "dpiVal",       "dpi",       v => +v, v => v);
wireSlider("jitterSlider",    "jitterVal",    "jitterScale", v => +v / 10, v => v.toFixed(1));
wireSlider("bandingSlider",   "bandingVal",   "bandingScale", v => +v / 10, v => v.toFixed(1));
wireSlider("maxSizeSlider",   "maxSizeVal",   "maxSize",   v => +v, v => v);
wireSlider("seedSlider",      "seedVal",      "seed",      v => +v, v => v);

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
  const preset = {};
  const lines  = yaml.split('\n');
  let currentArrayKey = null;
  let currentObj      = null;

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const indent = raw.search(/\S/);

    if (indent === 0) {
      currentArrayKey = null; currentObj = null;
      const ci = trimmed.indexOf(':');
      if (ci === -1) continue;
      const key = trimmed.slice(0, ci).trim();
      const val = trimmed.slice(ci + 1).trim();
      if (!val) { currentArrayKey = key; preset[key] = []; }
      else if (val === '[]')   preset[key] = [];
      else if (val === 'null') preset[key] = null;
      else if (val === 'true') preset[key] = true;
      else if (val === 'false')preset[key] = false;
      else if (val.startsWith('[')) {
        const inner = val.slice(1, val.lastIndexOf(']'));
        preset[key] = inner.split(',').map(s => {
          const n = parseFloat(s.trim());
          return isNaN(n) ? s.trim() : n;
        });
      } else {
        const n = parseFloat(val);
        preset[key] = isNaN(n) ? val : n;
      }
    } else if (indent === 2 && trimmed.startsWith('- ') && currentArrayKey) {
      const inner = trimmed.slice(2).trim();
      const ci    = inner.indexOf(':');
      if (ci === -1) continue;
      const k  = inner.slice(0, ci).trim();
      const vr = inner.slice(ci + 1).trim();
      const n  = parseFloat(vr);
      currentObj = { [k]: isNaN(n) ? vr : n };
      preset[currentArrayKey].push(currentObj);
    } else if (indent === 4 && currentObj !== null) {
      const ci = trimmed.indexOf(':');
      if (ci === -1) continue;
      const k  = trimmed.slice(0, ci).trim();
      const vr = trimmed.slice(ci + 1).trim();
      const n  = parseFloat(vr);
      currentObj[k] = isNaN(n) ? vr : n;
    }
  }
  return preset;
}

// ==================== PRESET SYSTEM ====================
const STORAGE_KEY = 'dotmatrix_user_presets';

function loadUserPresets() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveUserPresets(presets) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(presets)); } catch {}
}
function deleteUserPreset(id) {
  const presets = loadUserPresets().filter(p => p.id !== id);
  saveUserPresets(presets);
  renderPresetBar();
}

function captureCurrentPreset(name) {
  return {
    name:         name || 'Neu',
    system:       false,
    profile:      state.profile,
    brightness:   state.brightness,
    contrast:     state.contrast,
    gamma:        state.gamma,
    dither:       state.dither,
    threshold:    state.threshold,
    ink:          [...state.ink],
    paper:        [...state.paper],
    paperFormat:  state.paperFormat,
    orientation:  state.orientation,
    doubleStrike: state.doubleStrike,
    condensed:    state.condensed,
    dpi:          state.dpi,
    jitterScale:  state.jitterScale,
    bandingScale: state.bandingScale,
    maxSize:      state.maxSize,
    wearLayers:   state.wearLayers.map(l => ({ ...l })),
    seed:         state.seed,
    softBlur:     state.softBlur,
    invert:       state.invert,
  };
}

function applyPreset(preset) {
  if (!preset) return;
  clearModified();

  if (preset.profile && PROFILES[preset.profile]) {
    state.profile = preset.profile;
    document.querySelectorAll('#profileList .sli').forEach(s => {
      s.classList.toggle('active', s.dataset.profile === preset.profile);
    });
    updateProfileMeta();
  }

  const setSlider = (id, valId, val, fmt = v => v) => {
    const el = document.getElementById(id), ve = document.getElementById(valId);
    if (el && val !== undefined && val !== null) { el.value = val; if (ve) ve.textContent = fmt(val); }
  };
  if (preset.brightness !== undefined) { state.brightness = preset.brightness; setSlider('brightnessSlider','brightnessVal', preset.brightness); }
  if (preset.contrast   !== undefined) { state.contrast   = preset.contrast;   setSlider('contrastSlider',  'contrastVal',   preset.contrast); }
  if (preset.gamma      !== undefined) { state.gamma      = preset.gamma;      setSlider('gammaSlider',     'gammaVal',      preset.gamma, v => (+v).toFixed(1)); }
  if (preset.threshold  !== undefined) { state.threshold  = preset.threshold;  setSlider('thresholdSlider', 'thresholdVal',  preset.threshold); }
  if (preset.dpi        !== undefined) { state.dpi        = preset.dpi;        setSlider('dpiSlider',       'dpiVal',        preset.dpi); }
  if (preset.jitterScale!== undefined) { state.jitterScale = preset.jitterScale; setSlider('jitterSlider','jitterVal', Math.round(preset.jitterScale * 10), v => (+v/10).toFixed(1)); }
  if (preset.bandingScale!== undefined){ state.bandingScale= preset.bandingScale;setSlider('bandingSlider','bandingVal',Math.round(preset.bandingScale*10),v=>(+v/10).toFixed(1)); }
  if (preset.maxSize    !== undefined) { state.maxSize    = preset.maxSize;    setSlider('maxSizeSlider',   'maxSizeVal',    preset.maxSize); }
  if (preset.seed       !== undefined) { state.seed       = preset.seed;       setSlider('seedSlider',      'seedVal',       preset.seed); }

  if (preset.dither) {
    state.dither = preset.dither;
    document.querySelectorAll('#ditherBtns button').forEach(b => b.classList.toggle('active', b.dataset.dither === preset.dither));
    const tf = document.getElementById('thresholdField');
    if(tf) tf.style.display = preset.dither === 'threshold' ? 'block' : 'none';
  }

  if (preset.paperFormat) {
    state.paperFormat = preset.paperFormat;
    document.querySelectorAll('#paperFormatBtns button').forEach(b => b.classList.toggle('active', b.dataset.format === preset.paperFormat));
  }
  if (preset.orientation) {
    state.orientation = preset.orientation;
    document.querySelectorAll('#orientationBtns button').forEach(b => b.classList.toggle('active', b.dataset.orient === preset.orientation));
  }

  if (preset.ink) {
    state.ink = preset.ink;
    const inkStr = preset.ink.join(',');
    let found = false;
    document.querySelectorAll('#inkSwatches .swatch:not(.custom-swatch)').forEach(s => {
      const match = s.dataset.ink === inkStr;
      s.classList.toggle('active', match);
      if (match) found = true;
    });
    const customSwatch = document.getElementById('customInkSwatch');
    if (!found && customSwatch) {
      const hex = rgbToHex(...preset.ink);
      customSwatch.dataset.ink = inkStr;
      customSwatch.style.background = hex;
      customSwatch.classList.add('active');
      if(document.getElementById('inkColorPicker')) document.getElementById('inkColorPicker').value = hex;
    } else if (customSwatch) {
      customSwatch.classList.remove('active');
    }
  }

  if (preset.paper) {
    state.paper = preset.paper;
    const paperStr = preset.paper.join(',');
    document.querySelectorAll('#paperSwatches .swatch').forEach(s => {
      s.classList.toggle('active', s.dataset.paper === paperStr);
    });
  }

  const setBool = (flag, val) => {
    if (val === undefined) return;
    state[flag] = val;
    const el = document.querySelector(`[data-flag="${flag}"]`);
    if (el) el.classList.toggle('on', val);
  };
  setBool('doubleStrike', preset.doubleStrike);
  setBool('condensed',    preset.condensed);
  setBool('softBlur',     preset.softBlur);
  setBool('invert',       preset.invert);
  updateProfileMeta();

  if (preset.wearLayers !== undefined) {
    state.wearLayers = preset.wearLayers.map(l => ({ ...l }));
    applyWearLayersToUI(state.wearLayers);
  }

  debouncedRefreshAscii();
}

function applyWearLayersToUI(layers) {
  document.querySelectorAll('#errorList .er').forEach(el => {
    el.classList.remove('on');
    const valEl = el.querySelector('.er-val');
    if (valEl) valEl.textContent = '0%';
  });
  if(!layers || !Array.isArray(layers)) return;
  for (const layer of layers) {
    const el = document.querySelector(`#errorList .er[data-pattern="${layer.pattern}"]`);
    if (!el) continue;
    el.classList.add('on');
    const slider = el.querySelector('.er-slider');
    const valEl  = el.querySelector('.er-val');
    if (slider) slider.value = layer.strength ?? 50;
    if (valEl)  valEl.textContent = (layer.strength ?? 50) + '%';
  }
}

let activePresetId = null;
let presetDirty    = false;

function markModified() { if (!presetDirty) { presetDirty = true; renderPresetBar(); } }
function clearModified() { presetDirty = false; }

function renderPresetBar() {
  const list = document.getElementById('presetList');
  if(!list) return;
  const userPresets = loadUserPresets();
  list.innerHTML = '';

  const allPresets = [...SYSTEM_PRESETS, ...userPresets];

  for (const preset of allPresets) {
    const isActive = preset.id === activePresetId;
    const isDirty  = isActive && presetDirty;
    
    const div = document.createElement('div');
    div.className = 'sli' + (isActive ? ' active' : '') + (isDirty ? ' modified' : '');
    div.dataset.id = preset.id;
    
    let innerHTML = `<div class="sli-row">
                       <span class="sli-name" style="font-size: 13px;">${preset.name}</span>
                       ${preset.system ? '<span class="sli-badge" style="border:none; opacity:0.5;">SYS</span>' : '<button class="delete-btn" title="Löschen">×</button>'}
                     </div>`;
    div.innerHTML = innerHTML;

    div.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-btn')) {
        e.stopPropagation();
        if (confirm(`Preset "${preset.name}" wirklich löschen?`)) {
          if (activePresetId === preset.id) { activePresetId = null; clearModified(); }
          deleteUserPreset(preset.id);
        }
        return;
      }
      activePresetId = preset.id;
      clearModified();
      renderPresetBar();
      applyPreset(preset);
    });

    list.appendChild(div);
  }
}

// ==================== EXPORT / IMPORT ====================
function downloadText(text, filename) {
  const a = document.createElement('a');
  a.href     = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const exportBtn = document.getElementById('exportCurrentBtn');
if(exportBtn) {
  exportBtn.addEventListener('click', () => {
    const name   = prompt('Name für Export?', 'Mein Preset') || 'Mein Preset';
    const preset = captureCurrentPreset(name);
    const yaml   = presetToYaml(preset);
    const slug   = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    downloadText(yaml, `${slug}.yaml`);
  });
}

const importBtn = document.getElementById('importPresetBtn');
const fileInp = document.getElementById('presetFileInput');
if(importBtn && fileInp) {
  importBtn.addEventListener('click', () => fileInp.click());
  fileInp.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    importFromText(text);
    e.target.value = '';
  });
}

const saveBtn = document.getElementById('savePresetBtn');
if(saveBtn) {
  saveBtn.addEventListener('click', () => {
    const name = prompt('Name für neues Preset:', 'Mein Preset');
    if (!name) return;
    const preset = captureCurrentPreset(name.trim());
    preset.id    = 'user_' + Date.now();
    const presets = loadUserPresets();
    presets.push(preset);
    saveUserPresets(presets);
    activePresetId = preset.id;
    clearModified();
    renderPresetBar();
    setStatus(`Preset "${preset.name}" gespeichert.`);
  });
}

function normalizePreset(raw) {
  if (raw.wear && !raw.wearLayers) {
    const known = new Set(Object.keys({ cloudy:1, ghosting:1, misaligned:1, pin_skip:1, smudge:1, ribbon_twist:1, head_gap:1, ink_starved:1, paper_slip:1, static_noise:1, double_feed:1, mechanical_resonance:1 }));
    raw.wearLayers = Object.entries(raw.wear)
      .filter(([k, v]) => known.has(k) && v > 0)
      .map(([pattern, strength]) => ({ pattern, strength }));
    delete raw.wear;
  }
  return raw;
}

function importFromText(text) {
  try {
    let preset;
    const stripped = text.trim();
    if (stripped.startsWith('{')) preset = normalizePreset(JSON.parse(stripped));
    else preset = yamlToPreset(stripped);
    
    if (!preset.name) preset.name = 'Importiert';
    applyPreset(preset);
    clearModified();
    setStatus(`Preset "${preset.name}" importiert.`);
    
    preset.id = 'user_' + Date.now();
    preset.system = false;
    const presets = loadUserPresets();
    presets.push(preset);
    saveUserPresets(presets);
    activePresetId = preset.id;
    renderPresetBar();
  } catch (err) { alert('Import fehlgeschlagen: ' + err.message); }
}

// ==================== FILE HANDLING ====================
if(dropzone && fileInput) {
  dropzone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => handleFile(e.target.files[0]));
  dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("dragover"); });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
}

async function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) { setStatus("Keine gültige Bilddatei."); return; }
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
    const sourceDpi = (metaDpi && metaDpi > 96) ? snapDpi(metaDpi) : estimateDpiFromImageSize(img);
    state.dpi = sourceDpi;
    const dpiS = document.getElementById("dpiSlider");
    const dpiV = document.getElementById("dpiVal");
    if(dpiS) dpiS.value = sourceDpi;
    if(dpiV) dpiV.textContent = sourceDpi;
    
    state.sourceImage = img;
    detectAndSetPaperColor(img);
    analyzeAndAdaptImage(img);
    
    const dzB = document.getElementById("dzBig"), dzS = document.getElementById("dzSmall");
    if(dzB) dzB.textContent = file.name;
    if(dzS) dzS.textContent = `${img.width} × ${img.height} · Ändern klicken`;
    
    if(outSection) outSection.style.display = "flex";
    const scale = Math.min(1, 800 / Math.max(img.width, img.height));
    if(outCanvas && outCtx) {
      outCanvas.width  = Math.round(img.width  * scale);
      outCanvas.height = Math.round(img.height * scale);
      outCtx.drawImage(img, 0, 0, outCanvas.width, outCanvas.height);
    }
    
    if(renderBtn) renderBtn.disabled = false;
    setStatus("Bereit. Auf RENDER klicken.");
    debouncedRefreshAscii();
  };
  img.onerror = () => setStatus("Fehler beim Laden.");
  img.src = url;
}

// ==================== RENDER ====================
if(renderBtn) {
  renderBtn.addEventListener("click", async () => {
    if (!state.sourceImage) return;
    renderBtn.disabled  = true;
    if(downloadBtn) downloadBtn.disabled = true;
    setStatus("Rendern...", true);
    try {
      const t0 = performance.now();
      const { imageData, width, height } = await render(state.sourceImage, msg => setStatus(msg, true));
      if(outCanvas && outCtx) {
        outCanvas.width  = width;
        outCanvas.height = height;
        outCtx.putImageData(imageData, 0, 0);
        outCanvas.toBlob(blob => {
          lastRenderedBlob = blob;
          if(downloadBtn) downloadBtn.disabled = false;
        }, "image/png");
      }
      setStatus(`Fertig in ${((performance.now() - t0) / 1000).toFixed(2)}s · ${width}×${height}`);
    } catch (e) {
      console.error(e);
      setStatus("Render fehlgeschlagen: " + e.message);
    } finally {
      renderBtn.disabled = false;
    }
  });
}

if(downloadBtn) {
  downloadBtn.addEventListener("click", () => {
    if (!lastRenderedBlob) return;
    const a  = document.createElement("a");
    a.href   = URL.createObjectURL(lastRenderedBlob);
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    a.download = `dotmatrix_${state.profile}_${ts}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  });
}

// ==================== INIT ====================
document.addEventListener("DOMContentLoaded", () => {
  updateProfileMeta();
  renderPresetBar();
});
