import { state, PROFILES, PRESETS } from './config.js';
import { render, asciiPreview } from './engine.js';

// ==================== SOURCE DPI DETECTION ====================

function readJfifDpi(buf) {
  const v = new DataView(buf);
  if (v.byteLength < 18 || v.getUint16(0) !== 0xFFD8) return null;
  if (v.getUint16(2) !== 0xFFE0) return null;
  const sig = String.fromCharCode(v.getUint8(6), v.getUint8(7), v.getUint8(8), v.getUint8(9), v.getUint8(10));
  if (sig !== 'JFIF\0') return null;
  const units = v.getUint8(11);
  const xd   = v.getUint16(12);
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
    const type = String.fromCharCode(v.getUint8(pos+4), v.getUint8(pos+5), v.getUint8(pos+6), v.getUint8(pos+7));
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
  const longPx    = Math.max(img.width, img.height);
  const a4LongIn  = 297 / 25.4;
  return snapDpi(Math.round(longPx / a4LongIn));
}

// ==================== INTERACTIVE ANIMATIONS ====================
document.addEventListener('click', (e) => {
  if(e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  const ripple = document.createElement('div');
  ripple.className = 'click-shockwave';
  ripple.style.left = e.clientX + 'px';
  ripple.style.top = e.clientY + 'px';
  document.body.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
});

document.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) && document.activeElement.type !== 'range') return;
  if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) return;

  const keyEl = document.createElement('div');
  keyEl.className = 'key-echo';
  keyEl.textContent = e.key.length === 1 ? e.key.toUpperCase() : `[${e.key.toUpperCase()}]`;
  keyEl.style.left = (Math.random() * 80 + 10) + 'vw';
  keyEl.style.bottom = '15vh';
  document.body.appendChild(keyEl);
  setTimeout(() => keyEl.remove(), 1200);
});

// ==================== DOM ELEMENTS ====================
const dropzone  = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const outCanvas = document.getElementById("outCanvas");
const outCtx    = outCanvas.getContext("2d");
const outSection = document.getElementById("outputSection");
const asciiEl   = document.getElementById("ascii");
const statusEl  = document.getElementById("status");
const renderBtn = document.getElementById("renderBtn");
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
      const rgb = sw.dataset.paper.split(",").map(Number);
      const dist = (r-rgb[0])**2 + (g-rgb[1])**2 + (b-rgb[2])**2;
      if (dist < minDist) { minDist = dist; bestSwatch = sw; }
    });
    if (bestSwatch) {
      document.querySelectorAll('#paperSwatches .swatch').forEach(s => s.classList.remove("active"));
      bestSwatch.classList.add("active");
      state.paper = bestSwatch.dataset.paper.split(",").map(Number);
    }
  } catch (e) {
    console.warn("Paper auto-detect failed", e);
  }
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
      const luma = Math.round(0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
      hist[luma]++;
    }

    const total = 160 * 160;
    let cumSum = 0, p2 = 0, p98 = 255;
    for (let i = 0; i < 256; i++) {
      cumSum += hist[i];
      if (cumSum / total < 0.02) p2 = i;
      if (cumSum / total < 0.98) p98 = i;
    }

    const range = Math.max(p98 - p2, 20);
    const midpoint = (p2 + p98) / 2;
    const brightPixels = hist.slice(180).reduce((a, b) => a + b, 0);
    const isDocument   = brightPixels / total > 0.45;

    if (isDocument) {
      const newContrast = Math.min(65, Math.round((220 / range - 1) * 55));
      state.brightness = 0;
      state.contrast   = Math.max(20, newContrast);
      state.threshold  = 128;
      state.dither     = "threshold";

      document.getElementById("brightnessSlider").value = 0;
      document.getElementById("brightnessVal").textContent = 0;
      document.getElementById("contrastSlider").value = state.contrast;
      document.getElementById("contrastVal").textContent = state.contrast;
      document.getElementById("thresholdSlider").value = 128;
      document.getElementById("thresholdVal").textContent = 128;
      document.querySelectorAll("#ditherBtns button").forEach(b =>
        b.classList.toggle("active", b.dataset.dither === "threshold")
      );
      document.getElementById("thresholdField").style.display = "block";
    } else {
      const newBrightness = Math.round((128 - midpoint) * 0.35);
      const newContrast   = Math.min(40, Math.round((180 / range - 1) * 30));
      state.brightness = Math.max(-60, Math.min(60, newBrightness));
      state.contrast   = Math.max(0,   Math.min(40, newContrast));

      document.getElementById("brightnessSlider").value = state.brightness;
      document.getElementById("brightnessVal").textContent = state.brightness;
      document.getElementById("contrastSlider").value = state.contrast;
      document.getElementById("contrastVal").textContent = state.contrast;
    }
  } catch (e) {
    console.warn("Image analysis failed", e);
  }
}

function refreshAscii() {
  if (!state.sourceImage) return;
  try {
    asciiEl.classList.remove("empty");
    asciiEl.textContent = asciiPreview(state.sourceImage, 56);
  } catch (e) {
    console.warn(e);
  }
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

// ==================== WIRING ====================
document.getElementById('themeSelector').addEventListener('click', (e) => {
  const btn = e.target.closest('.theme-btn');
  if (!btn) return;
  document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.documentElement.setAttribute('data-theme', btn.dataset.settheme);
});

// --- PRESET SYSTEM ---
const presetSelect = document.getElementById('presetSelect');
function loadPresetsToUI() {
  presetSelect.innerHTML = '<option value="">-- Select Preset --</option>';
  Object.keys(PRESETS).forEach(name => {
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    presetSelect.appendChild(opt);
  });
}
loadPresetsToUI();

function applyPreset(presetName) {
  if (!PRESETS[presetName]) return;
  const p = PRESETS[presetName];
  Object.assign(state, JSON.parse(JSON.stringify(p))); // Deep copy

  document.querySelectorAll('#profileBtns button').forEach(b => b.classList.toggle('active', b.dataset.profile === state.profile));
  updateProfileMeta();
  
  document.getElementById("thresholdSlider").value = state.threshold; document.getElementById("thresholdVal").textContent = state.threshold;
  document.getElementById("brightnessSlider").value = state.brightness; document.getElementById("brightnessVal").textContent = state.brightness;
  document.getElementById("contrastSlider").value = state.contrast; document.getElementById("contrastVal").textContent = state.contrast;
  document.getElementById("gammaSlider").value = state.gamma; document.getElementById("gammaVal").textContent = state.gamma.toFixed(1);
  document.getElementById("dpiSlider").value = state.dpi; document.getElementById("dpiVal").textContent = state.dpi;
  document.getElementById("jitterSlider").value = state.jitterScale * 10; document.getElementById("jitterVal").textContent = state.jitterScale.toFixed(1);
  document.getElementById("bandingSlider").value = state.bandingScale * 10; document.getElementById("bandingVal").textContent = state.bandingScale.toFixed(1);
  document.getElementById("maxSizeSlider").value = state.maxSize; document.getElementById("maxSizeVal").textContent = state.maxSize;
  
  document.querySelectorAll('#errorList input[type="range"]').forEach(slider => {
    const key = slider.dataset.error;
    slider.value = state.wear[key] || 0;
    document.getElementById(`wear_${key}_val`).textContent = `${slider.value}%`;
  });

  document.querySelectorAll("#ditherBtns button").forEach(b => b.classList.toggle("active", b.dataset.dither === state.dither));
  document.getElementById("thresholdField").style.display = state.dither === "threshold" ? "block" : "none";
  document.querySelectorAll("#paperFormatBtns button").forEach(b => b.classList.toggle("active", b.dataset.format === state.paperFormat));
  document.querySelectorAll("#orientationBtns button").forEach(b => b.classList.toggle("active", b.dataset.orient === state.orientation));

  const doubleStrikeCheck = document.querySelector('[data-flag="doubleStrike"]');
  state.doubleStrike ? doubleStrikeCheck.classList.add("on") : doubleStrikeCheck.classList.remove("on");

  const condensedCheck = document.querySelector('[data-flag="condensed"]');
  state.condensed ? condensedCheck.classList.add("on") : condensedCheck.classList.remove("on");

  const invertCheck = document.querySelector('[data-flag="invert"]');
  state.invert ? invertCheck.classList.add("on") : invertCheck.classList.remove("on");

  const softBlurCheck = document.querySelector('[data-flag="softBlur"]');
  state.softBlur ? softBlurCheck.classList.add("on") : softBlurCheck.classList.remove("on");

  document.querySelectorAll('#inkSwatches .swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.ink === state.ink.join(','));
  });
  document.querySelectorAll('#paperSwatches .swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.paper === state.paper.join(','));
  });

  refreshAscii();
}

presetSelect.addEventListener('change', (e) => applyPreset(e.target.value));

document.getElementById('exportPresetBtn').addEventListener('click', () => {
  const exportData = JSON.stringify(state, null, 2);
  const blob = new Blob([exportData], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `dotmatrix_preset_${Date.now()}.json`;
  a.click();
});

document.getElementById('importPresetBtn').addEventListener('click', () => document.getElementById('presetInput').click());
document.getElementById('presetInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const imported = JSON.parse(ev.target.result);
      const name = "Imported_" + file.name.split('.')[0];
      PRESETS[name] = imported;
      loadPresetsToUI();
      presetSelect.value = name;
      applyPreset(name);
    } catch(err) { alert("Invalid JSON file"); }
  };
  reader.readAsText(file);
});


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

wireSegmented("profileBtns", "profile", "profile", updateProfileMeta);

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
    refreshAscii();
  });
});

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
wireSwatches("inkSwatches", "ink", "ink");
wireSwatches("paperSwatches", "paper", "paper");

// --- MODULAR ERRORS BINDING ---
document.querySelectorAll('#errorList input[type="range"]').forEach(slider => {
  const key = slider.dataset.error;
  const valEl = document.getElementById(`wear_${key}_val`);
  slider.addEventListener('input', (e) => {
    state.wear[key] = parseInt(e.target.value);
    valEl.textContent = `${e.target.value}%`;
    refreshAscii();
  });
});


function wireSlider(id, valId, stateKey, transform = v => +v, format = v => v, previewUpdate = false) {
  const s = document.getElementById(id);
  const v = document.getElementById(valId);
  const apply = () => {
    const raw = transform(s.value);
    state[stateKey] = raw;
    v.textContent = format(raw);
    if(previewUpdate) refreshAscii();
  };
  s.addEventListener("input", apply);
  apply();
}
wireSlider("thresholdSlider", "thresholdVal", "threshold", v => +v, v => v, true);
wireSlider("brightnessSlider", "brightnessVal", "brightness", v => +v, v => v, true);
wireSlider("contrastSlider", "contrastVal", "contrast", v => +v, v => v, true);
wireSlider("gammaSlider", "gammaVal", "gamma", v => +v, v => v.toFixed(1), true);
wireSlider("dpiSlider", "dpiVal", "dpi", v => +v, v => v);
wireSlider("jitterSlider", "jitterVal", "jitterScale", v => +v / 10, v => v.toFixed(1));
wireSlider("bandingSlider", "bandingVal", "bandingScale", v => +v / 10, v => v.toFixed(1));
wireSlider("maxSizeSlider", "maxSizeVal", "maxSize", v => +v, v => v);
wireSlider("seedSlider", "seedVal", "seed", v => +v, v => v);

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
  if (!file || !file.type.startsWith("image/")) {
    setStatus("Not an image file."); return;
  }
  setStatus("Loading image...");

  let metaDpi = null;
  try {
    const headerBuf = await file.slice(0, 256).arrayBuffer();
    if (file.type === 'image/jpeg') metaDpi = readJfifDpi(headerBuf);
    else if (file.type === 'image/png') metaDpi = readPngDpi(headerBuf);
  } catch { }

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const sourceDpi = (metaDpi && metaDpi > 96) ? snapDpi(metaDpi) : estimateDpiFromImageSize(img);
    state.dpi = sourceDpi;
    document.getElementById("dpiSlider").value = sourceDpi;
    document.getElementById("dpiVal").textContent = sourceDpi;

    state.sourceImage = img;
    detectAndSetPaperColor(img);
    analyzeAndAdaptImage(img);

    document.getElementById("dzBig").textContent = file.name;
    document.getElementById("dzSmall").textContent = `${img.width} × ${img.height} · tap to change`;
    
    outSection.style.display = "block";
    const maxDisplay = 800;
    const scale = Math.min(1, maxDisplay / Math.max(img.width, img.height));
    outCanvas.width = Math.round(img.width * scale);
    outCanvas.height = Math.round(img.height * scale);
    outCtx.drawImage(img, 0, 0, outCanvas.width, outCanvas.height);
    renderBtn.disabled = false;
    setStatus("Ready. Tap RENDER.");
    refreshAscii();
  };
  img.onerror = () => setStatus("Failed to load image.");
  img.src = url;
}

// ==================== EXECUTION ====================
renderBtn.addEventListener("click", async () => {
  if (!state.sourceImage) return;
  renderBtn.disabled = true;
  downloadBtn.disabled = true;
  setStatus("Rendering...", true);
  try {
    const t0 = performance.now();
    const { imageData, width, height } = await render(state.sourceImage, (msg) => setStatus(msg, true));
    
    outCanvas.width = width;
    outCanvas.height = height;
    outCtx.putImageData(imageData, 0, 0);
    outCanvas.toBlob((blob) => {
      lastRenderedBlob = blob;
      downloadBtn.disabled = false;
    }, "image/png");
    
    const dt = ((performance.now() - t0) / 1000).toFixed(2);
    setStatus(`Done in ${dt}s · ${width}×${height}`);
  } catch (e) {
    console.error(e);
    setStatus("Render failed: " + e.message);
  } finally {
    renderBtn.disabled = false;
  }
});

downloadBtn.addEventListener("click", () => {
  if (!lastRenderedBlob) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(lastRenderedBlob);
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  a.download = `dotmatrix_${state.profile}_${ts}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
});

updateProfileMeta();
