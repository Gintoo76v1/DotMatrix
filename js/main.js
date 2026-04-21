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

function snapDpi(dpi) {
  return Math.max(100, Math.min(1200, Math.round(dpi / 50) * 50));
}

function estimateDpiFromImageSize(img) {
  const longPx   = Math.max(img.width, img.height);
  const a4LongIn = 297 / 25.4;
  return snapDpi(Math.round(longPx / a4LongIn));
}

// ==================== INTERACTIVE ANIMATIONS ====================

document.addEventListener('click', (e) => {
  if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
  const r = document.createElement('div');
  r.className = 'click-shockwave';
  r.style.left = e.clientX + 'px';
  r.style.top  = e.clientY + 'px';
  document.body.appendChild(r);
  setTimeout(() => r.remove(), 600);
});

document.addEventListener('keydown', (e) => {
  if (['INPUT','TEXTAREA'].includes(document.activeElement.tagName) && document.activeElement.type !== 'range') return;
  if (['Shift','Control','Alt','Meta','CapsLock','Tab'].includes(e.key)) return;
  const k = document.createElement('div');
  k.className = 'key-echo';
  k.textContent = e.key.length === 1 ? e.key.toUpperCase() : `[${e.key.toUpperCase()}]`;
  k.style.left   = (Math.random() * 80 + 10) + 'vw';
  k.style.bottom = '15vh';
  document.body.appendChild(k);
  setTimeout(() => k.remove(), 1200);
});

// ==================== DOM ELEMENTS ====================

const dropzone    = document.getElementById("dropzone");
const fileInput   = document.getElementById("fileInput");
const outCanvas   = document.getElementById("outCanvas");
const outCtx      = outCanvas.getContext("2d");
const outSection  = document.getElementById("outputSection");
const asciiEl     = document.getElementById("ascii");
const statusEl    = document.getElementById("status");
const renderBtn   = document.getElementById("renderBtn");
const downloadBtn = document.getElementById("downloadBtn");
const profileMeta = document.getElementById("profileMeta");

let lastRenderedBlob = null;

// ==================== HELPERS ====================

function setStatus(text, working = false) {
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

    if (isDoc) {
      const newContrast = Math.min(65, Math.round((220 / range - 1) * 55));
      state.brightness  = 0;
      state.contrast    = Math.max(20, newContrast);
      state.threshold   = 128;
      state.dither      = "threshold";
      document.getElementById("brightnessSlider").value    = 0;
      document.getElementById("brightnessVal").textContent = 0;
      document.getElementById("contrastSlider").value      = state.contrast;
      document.getElementById("contrastVal").textContent   = state.contrast;
      document.getElementById("thresholdSlider").value     = 128;
      document.getElementById("thresholdVal").textContent  = 128;
      document.querySelectorAll("#ditherBtns button").forEach(b =>
        b.classList.toggle("active", b.dataset.dither === "threshold")
      );
      document.getElementById("thresholdField").style.display = "block";
    } else {
      const newBrightness = Math.round(((p2 + p98) / 2 - 128) * -0.35);
      const newContrast   = Math.min(40, Math.round((180 / range - 1) * 30));
      state.brightness = Math.max(-60, Math.min(60, newBrightness));
      state.contrast   = Math.max(0,   Math.min(40, newContrast));
      document.getElementById("brightnessSlider").value    = state.brightness;
      document.getElementById("brightnessVal").textContent = state.brightness;
      document.getElementById("contrastSlider").value      = state.contrast;
      document.getElementById("contrastVal").textContent   = state.contrast;
    }
  } catch (e) { console.warn("Image analysis failed", e); }
}

function refreshAscii() {
  if (!state.sourceImage) return;
  try {
    asciiEl.classList.remove("empty");
    asciiEl.textContent = asciiPreview(state.sourceImage, 56);
  } catch (e) { console.warn(e); }
}

function updateProfileMeta() {
  const p = PROFILES[state.profile];
  profileMeta.textContent = `${p.label} · ${p.pins}-pin · ${p.dpi_h}×${p.dpi_v} dpi · dot ⌀ ${p.dot_diameter_mm}mm`;
  const condCheck = document.querySelector('[data-flag="condensed"]');
  if (!p.supports_condensed) {
    condCheck.dataset.disabled = "true";
    condCheck.classList.remove("on");
    state.condensed = false;
  } else {
    condCheck.dataset.disabled = "false";
  }
}

// ==================== THEME ====================

document.getElementById('themeSelector').addEventListener('click', (e) => {
  const btn = e.target.closest('.theme-btn');
  if (!btn) return;
  document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.documentElement.setAttribute('data-theme', btn.dataset.settheme);
});

// ==================== SEGMENTED BUTTONS ====================

function wireSegmented(containerId, stateKey, attrKey, onChange = null) {
  document.getElementById(containerId).addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    document.querySelectorAll(`#${containerId} button`).forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state[stateKey] = btn.dataset[attrKey];
    if (onChange) onChange();
    refreshAscii();
  });
}

wireSegmented("ditherBtns", "dither", "dither", () => {
  document.getElementById("thresholdField").style.display =
    state.dither === "threshold" ? "block" : "none";
});
wireSegmented("paperFormatBtns", "paperFormat", "format");
wireSegmented("orientationBtns",  "orientation", "orient");

// ==================== PROFILE SCROLL LIST ====================

document.getElementById('profileList').addEventListener('click', (e) => {
  const item = e.target.closest('.sli');
  if (!item) return;
  document.querySelectorAll('#profileList .sli').forEach(s => s.classList.remove('active'));
  item.classList.add('active');
  state.profile = item.dataset.profile;
  updateProfileMeta();
  refreshAscii();
});

// ==================== ERROR SCROLL LIST (multi-select + per-error slider) ====================

function syncWearLayersFromUI() {
  state.wearLayers = [];
  document.querySelectorAll('#errorList .er.on').forEach(el => {
    const slider = el.querySelector('.er-slider');
    state.wearLayers.push({
      pattern:  el.dataset.pattern,
      strength: +slider.value,
    });
  });
}

document.getElementById('errorList').addEventListener('click', (e) => {
  // Toggle on/off only when clicking the header row (not the slider)
  const head = e.target.closest('.er-head');
  if (!head) return;
  const er = head.closest('.er');
  er.classList.toggle('on');
  // If newly activated and slider is still at default 50, leave as-is
  const slider = er.querySelector('.er-slider');
  const valEl  = er.querySelector('.er-val');
  if (!er.classList.contains('on')) {
    valEl.textContent = '0%';
  } else {
    valEl.textContent = slider.value + '%';
  }
  syncWearLayersFromUI();
});

document.getElementById('errorList').addEventListener('input', (e) => {
  if (!e.target.classList.contains('er-slider')) return;
  const er    = e.target.closest('.er');
  const valEl = er.querySelector('.er-val');
  valEl.textContent = e.target.value + '%';
  syncWearLayersFromUI();
});

// ==================== CHECKBOXES ====================

document.querySelectorAll(".check").forEach(el => {
  el.addEventListener("click", () => {
    if (el.dataset.disabled === "true") return;
    el.classList.toggle("on");
    state[el.dataset.flag] = el.classList.contains("on");
    refreshAscii();
  });
});

// ==================== SWATCHES ====================

function wireSwatches(containerId, stateKey, attrKey) {
  const box = document.getElementById(containerId);
  box.addEventListener("click", (e) => {
    const sw = e.target.closest(".swatch");
    if (!sw) return;
    box.querySelectorAll(".swatch").forEach(s => s.classList.remove("active"));
    sw.classList.add("active");
    state[stateKey] = sw.dataset[attrKey].split(",").map(Number);
  });
}
wireSwatches("inkSwatches",   "ink",   "ink");
wireSwatches("paperSwatches", "paper", "paper");

// ==================== SLIDERS ====================

function wireSlider(id, valId, stateKey, transform = v => +v, format = v => v, liveRefresh = false) {
  const s = document.getElementById(id);
  const v = document.getElementById(valId);
  const apply = () => {
    const raw = transform(s.value);
    state[stateKey] = raw;
    v.textContent = format(raw);
    if (liveRefresh) refreshAscii();
  };
  s.addEventListener("input", apply);
  apply();
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
      if (v.length === 0) {
        lines.push(`${k}: []`);
      } else if (typeof v[0] === 'number') {
        lines.push(`${k}: [${v.join(', ')}]`);
      } else {
        lines.push(`${k}:`);
        for (const obj of v) {
          const entries = Object.entries(obj);
          lines.push(`  - ${entries[0][0]}: ${entries[0][1]}`);
          for (let i = 1; i < entries.length; i++) {
            lines.push(`    ${entries[i][0]}: ${entries[i][1]}`);
          }
        }
      }
    } else if (v === null) {
      lines.push(`${k}: null`);
    } else {
      lines.push(`${k}: ${v}`);
    }
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
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function saveUserPresets(presets) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(presets)); } catch {}
}

function deleteUserPreset(id) {
  const presets = loadUserPresets().filter(p => p.id !== id);
  saveUserPresets(presets);
  renderPresetBar();
}

// Capture the full current UI state into a plain preset object
function captureCurrentPreset(name) {
  return {
    name:         name || 'Unnamed',
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

// Apply a preset object to the full UI + state
function applyPreset(preset) {
  if (!preset) return;

  // Profile
  if (preset.profile && PROFILES[preset.profile]) {
    state.profile = preset.profile;
    document.querySelectorAll('#profileList .sli').forEach(s => {
      s.classList.toggle('active', s.dataset.profile === preset.profile);
    });
    updateProfileMeta();
  }

  // Image adjustments
  const setSlider = (id, valId, val, fmt = v => v) => {
    const el = document.getElementById(id);
    const ve = document.getElementById(valId);
    if (el && val !== undefined && val !== null) {
      el.value = val;
      if (ve) ve.textContent = fmt(val);
    }
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

  // Dither
  if (preset.dither) {
    state.dither = preset.dither;
    document.querySelectorAll('#ditherBtns button').forEach(b =>
      b.classList.toggle('active', b.dataset.dither === preset.dither)
    );
    document.getElementById('thresholdField').style.display =
      preset.dither === 'threshold' ? 'block' : 'none';
  }

  // Paper format / orientation
  if (preset.paperFormat) {
    state.paperFormat = preset.paperFormat;
    document.querySelectorAll('#paperFormatBtns button').forEach(b =>
      b.classList.toggle('active', b.dataset.format === preset.paperFormat)
    );
  }
  if (preset.orientation) {
    state.orientation = preset.orientation;
    document.querySelectorAll('#orientationBtns button').forEach(b =>
      b.classList.toggle('active', b.dataset.orient === preset.orientation)
    );
  }

  // Ink swatch
  if (preset.ink) {
    state.ink = preset.ink;
    const inkStr = preset.ink.join(',');
    document.querySelectorAll('#inkSwatches .swatch').forEach(s => {
      s.classList.toggle('active', s.dataset.ink === inkStr);
    });
  }

  // Paper swatch (null = keep auto-detected)
  if (preset.paper) {
    state.paper = preset.paper;
    const paperStr = preset.paper.join(',');
    document.querySelectorAll('#paperSwatches .swatch').forEach(s => {
      s.classList.toggle('active', s.dataset.paper === paperStr);
    });
  }

  // Checkboxes (doubleStrike, condensed, softBlur, invert)
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
  updateProfileMeta(); // re-check condensed support

  // Wear layers
  if (preset.wearLayers !== undefined) {
    state.wearLayers = preset.wearLayers.map(l => ({ ...l }));
    applyWearLayersToUI(state.wearLayers);
  }

  refreshAscii();
}

// Update the error list UI to match a given wearLayers array
function applyWearLayersToUI(layers) {
  // First clear all
  document.querySelectorAll('#errorList .er').forEach(el => {
    el.classList.remove('on');
    const valEl = el.querySelector('.er-val');
    if (valEl) valEl.textContent = '0%';
  });
  // Then activate the relevant ones
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

// ==================== PRESET BAR ====================

let activePresetId = null;

function renderPresetBar() {
  const bar         = document.getElementById('presetBar');
  const userPresets = loadUserPresets();
  bar.innerHTML     = '';

  const allPresets = [
    ...SYSTEM_PRESETS,
    ...userPresets,
  ];

  for (const preset of allPresets) {
    const pill = document.createElement('button');
    pill.className   = 'preset-pill' + (preset.system ? '' : ' user') + (preset.id === activePresetId ? ' active' : '');
    pill.textContent = preset.name;
    pill.dataset.id  = preset.id;
    pill.addEventListener('click', () => {
      activePresetId = preset.id;
      renderPresetBar();
      applyPreset(preset);
    });
    bar.appendChild(pill);

    // Delete button for user presets
    if (!preset.system) {
      const del = document.createElement('button');
      del.className   = 'preset-pill delete-btn';
      del.textContent = '×';
      del.title       = 'Delete preset';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Delete preset "${preset.name}"?`)) {
          if (activePresetId === preset.id) activePresetId = null;
          deleteUserPreset(preset.id);
        }
      });
      bar.appendChild(del);
    }
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

document.getElementById('exportPresetBtn').addEventListener('click', () => {
  const name   = document.getElementById('presetNameInput').value.trim() || 'dotmatrix-preset';
  const preset = captureCurrentPreset(name);
  const yaml   = presetToYaml(preset);
  const slug   = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  downloadText(yaml, `${slug}.yaml`);
});

document.getElementById('importPresetBtn').addEventListener('click', () => {
  document.getElementById('presetFileInput').click();
});

document.getElementById('presetFileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  importYamlText(text);
  e.target.value = '';
});

// Preset Creator buttons
document.getElementById('exportCurrentBtn').addEventListener('click', () => {
  const name   = document.getElementById('presetNameInput').value.trim() || 'my-preset';
  const preset = captureCurrentPreset(name);
  const yaml   = presetToYaml(preset);
  // Also fill the textarea so user can copy
  document.getElementById('presetYamlArea').value = yaml;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  downloadText(yaml, `${slug}.yaml`);
});

document.getElementById('savePresetBtn').addEventListener('click', () => {
  const name = document.getElementById('presetNameInput').value.trim();
  if (!name) { alert('Enter a preset name first.'); return; }
  const preset = captureCurrentPreset(name);
  preset.id    = 'user_' + Date.now();
  const presets = loadUserPresets();
  presets.push(preset);
  saveUserPresets(presets);
  activePresetId = preset.id;
  renderPresetBar();
  setStatus(`Preset "${name}" saved.`);
});

document.getElementById('importYamlBtn').addEventListener('click', () => {
  const text = document.getElementById('presetYamlArea').value.trim();
  if (!text) { alert('Paste YAML into the text area first.'); return; }
  importYamlText(text);
});

function importYamlText(text) {
  try {
    const preset = yamlToPreset(text);
    if (!preset.name) preset.name = 'Imported';
    applyPreset(preset);
    setStatus(`Preset "${preset.name}" imported.`);
    // Optionally save as user preset
    if (preset.name && preset.name !== 'Imported') {
      preset.id = 'user_' + Date.now();
      preset.system = false;
      const presets = loadUserPresets();
      presets.push(preset);
      saveUserPresets(presets);
      activePresetId = preset.id;
      renderPresetBar();
    }
  } catch (err) {
    alert('YAML parse failed: ' + err.message);
  }
}

// ==================== FILE HANDLING ====================

dropzone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (e) => handleFile(e.target.files[0]));
dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("dragover"); });
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("dragover");
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

async function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) { setStatus("Not an image file."); return; }
  setStatus("Loading image...");
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
    document.getElementById("dpiSlider").value     = sourceDpi;
    document.getElementById("dpiVal").textContent  = sourceDpi;
    state.sourceImage = img;
    detectAndSetPaperColor(img);
    analyzeAndAdaptImage(img);
    document.getElementById("dzBig").textContent   = file.name;
    document.getElementById("dzSmall").textContent = `${img.width} × ${img.height} · tap to change`;
    outSection.style.display = "block";
    const scale = Math.min(1, 800 / Math.max(img.width, img.height));
    outCanvas.width  = Math.round(img.width  * scale);
    outCanvas.height = Math.round(img.height * scale);
    outCtx.drawImage(img, 0, 0, outCanvas.width, outCanvas.height);
    renderBtn.disabled = false;
    setStatus("Ready. Tap RENDER.");
    refreshAscii();
  };
  img.onerror = () => setStatus("Failed to load image.");
  img.src = url;
}

// ==================== RENDER ====================

renderBtn.addEventListener("click", async () => {
  if (!state.sourceImage) return;
  renderBtn.disabled  = true;
  downloadBtn.disabled = true;
  setStatus("Rendering...", true);
  try {
    const t0 = performance.now();
    const { imageData, width, height } = await render(state.sourceImage, msg => setStatus(msg, true));
    outCanvas.width  = width;
    outCanvas.height = height;
    outCtx.putImageData(imageData, 0, 0);
    outCanvas.toBlob(blob => {
      lastRenderedBlob     = blob;
      downloadBtn.disabled = false;
    }, "image/png");
    setStatus(`Done in ${((performance.now() - t0) / 1000).toFixed(2)}s · ${width}×${height}`);
  } catch (e) {
    console.error(e);
    setStatus("Render failed: " + e.message);
  } finally {
    renderBtn.disabled = false;
  }
});

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

// ==================== INIT ====================

updateProfileMeta();
renderPresetBar();
