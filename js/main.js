import { state, PROFILES, SYSTEM_PRESETS } from './config.js';
import { render, asciiPreview } from './engine.js';

// ==================== DEBOUNCE UTILITY (Verhindert Freezes!) ====================
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

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

let lastRenderedBlob = null;
let currentZoom = 1.0;

// ==================== THEME & LANGUAGE (VS Code Style) ====================
document.getElementById('themeModeBtns').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  document.querySelectorAll('#themeModeBtns button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.documentElement.setAttribute('data-theme', btn.dataset.mode);
});

document.getElementById('langBtns').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  document.querySelectorAll('#langBtns button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  // Hier kann später eine umfangreiche i18n-Übersetzung aufgerufen werden
  console.log("Sprache gewechselt zu:", btn.dataset.lang);
});

// ==================== ZOOM FUNKTION ====================
document.getElementById('zoomInBtn')?.addEventListener('click', () => {
  currentZoom = Math.min(currentZoom + 0.25, 3.0);
  applyZoom();
});
document.getElementById('zoomOutBtn')?.addEventListener('click', () => {
  currentZoom = Math.max(currentZoom - 0.25, 0.5);
  applyZoom();
});

function applyZoom() {
  outCanvas.style.transform = `scale(${currentZoom})`;
  document.getElementById('zoomLevel').textContent = `${Math.round(currentZoom * 100)}%`;
}

// ==================== PRESET SYSTEM (Als Listen-UI) ====================
const STORAGE_KEY = 'dotmatrix_user_presets';

function loadUserPresets() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } 
  catch { return []; }
}

function renderPresetList() {
  const list = document.getElementById('presetList');
  if (!list) return;
  list.innerHTML = '';
  const allPresets = [...SYSTEM_PRESETS, ...loadUserPresets()];

  allPresets.forEach(preset => {
    const div = document.createElement('div');
    div.className = 'sli';
    div.dataset.id = preset.id;
    div.innerHTML = `
      <div class="sli-row">
        <span class="sli-name">${preset.name}</span>
        ${preset.system ? '<span class="sli-badge">SYSTEM</span>' : '<span class="sli-badge" style="color:red">USER</span>'}
      </div>
      <div class="sli-meta">Klick zum Anwenden</div>
    `;
    div.addEventListener('click', () => {
      document.querySelectorAll('#presetList .sli').forEach(el => el.classList.remove('active'));
      div.classList.add('active');
      applyPreset(preset);
    });
    list.appendChild(div);
  });
}

function applyPreset(preset) {
  if (preset.profile) {
    state.profile = preset.profile;
    document.querySelectorAll('#profileList .sli').forEach(s => {
      s.classList.toggle('active', s.dataset.profile === preset.profile);
    });
  }
  
  if (preset.brightness !== undefined) {
    state.brightness = preset.brightness;
    document.getElementById('brightnessSlider').value = preset.brightness;
    document.getElementById('brightnessVal').textContent = preset.brightness;
  }
  if (preset.contrast !== undefined) {
    state.contrast = preset.contrast;
    document.getElementById('contrastSlider').value = preset.contrast;
    document.getElementById('contrastVal').textContent = preset.contrast;
  }
  
  debouncedRefreshAscii();
}

// ==================== COLOR PICKER FIX ====================
const inkColorPicker = document.getElementById('inkColorPicker');
const inkHexInput    = document.getElementById('inkHexInput');
const applyInkBtn    = document.getElementById('applyInkBtn');
const customSwatch   = document.getElementById('customInkSwatch');

function hexToRgb(hex) {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function applyCustomInkColor(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return;
  state.ink = rgb;
  customSwatch.style.background = hex;
  document.querySelectorAll('#inkSwatches .swatch').forEach(s => s.classList.remove('active'));
  customSwatch.classList.add('active');
  debouncedRefreshAscii();
}

inkColorPicker.addEventListener('input', (e) => {
  inkHexInput.value = e.target.value;
});

applyInkBtn.addEventListener('click', () => {
  let hex = inkHexInput.value.trim();
  if (!hex.startsWith('#')) hex = '#' + hex;
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
    inkColorPicker.value = hex;
    applyCustomInkColor(hex);
  } else {
    alert("Bitte einen gültigen Hex-Code eingeben (z.B. #ff0000)");
  }
});

document.getElementById('inkSwatches').addEventListener('click', (e) => {
  const sw = e.target.closest('.swatch');
  if (!sw || sw.id === 'customInkSwatch') return;
  document.querySelectorAll('#inkSwatches .swatch').forEach(s => s.classList.remove('active'));
  sw.classList.add('active');
  state.ink = sw.dataset.ink.split(',').map(Number);
  debouncedRefreshAscii();
});


// ==================== SLIDERS & LIVE UPDATE ====================
const debouncedRefreshAscii = debounce(() => {
  if (!state.sourceImage) return;
  asciiEl.classList.remove("empty");
  asciiEl.textContent = asciiPreview(state.sourceImage, 56);
}, 250); // 250ms Warten = Kein Einfrieren!

function wireSlider(id, valId, stateKey) {
  const s = document.getElementById(id);
  const v = document.getElementById(valId);
  s.addEventListener("input", (e) => {
    const val = parseInt(e.target.value, 10);
    state[stateKey] = val;
    v.textContent = val;
    debouncedRefreshAscii();
  });
}

wireSlider("brightnessSlider", "brightnessVal", "brightness");
wireSlider("contrastSlider", "contrastVal", "contrast");
wireSlider("thresholdSlider", "thresholdVal", "threshold");

// ==================== FILE HANDLING ====================
dropzone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (e) => handleFile(e.target.files[0]));
dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("dragover"); });
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault(); dropzone.classList.remove("dragover");
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

async function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) return;
  statusEl.textContent = "Lade Bild...";
  
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    state.sourceImage = img;
    document.getElementById("dzBig").textContent = file.name;
    document.getElementById("dzSmall").textContent = `${img.width} × ${img.height}`;
    outSection.style.display = "block";
    
    // Preview auf Canvas zeichnen
    const scale = Math.min(1, 800 / Math.max(img.width, img.height));
    outCanvas.width = Math.round(img.width * scale);
    outCanvas.height = Math.round(img.height * scale);
    outCtx.drawImage(img, 0, 0, outCanvas.width, outCanvas.height);
    
    renderBtn.disabled = false;
    statusEl.textContent = "Bereit. Klicke auf Render.";
    debouncedRefreshAscii();
  };
  img.src = url;
}

// ==================== RENDER ====================
renderBtn.addEventListener("click", async () => {
  if (!state.sourceImage) return;
  renderBtn.disabled = true;
  downloadBtn.disabled = true;
  statusEl.textContent = "Rendering läuft...";
  
  try {
    const { imageData, width, height } = await render(state.sourceImage, msg => statusEl.textContent = msg);
    outCanvas.width = width;
    outCanvas.height = height;
    outCtx.putImageData(imageData, 0, 0);
    outCanvas.toBlob(blob => {
      lastRenderedBlob = blob;
      downloadBtn.disabled = false;
    }, "image/png");
    statusEl.textContent = `Fertig! (${width}×${height})`;
  } catch (e) {
    statusEl.textContent = "Fehler beim Rendern!";
  } finally {
    renderBtn.disabled = false;
  }
});

// ==================== INIT ====================
renderPresetList();
