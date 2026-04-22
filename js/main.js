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

// ==================== PRO AUDIO SYSTEM ====================
let audioCtx = null;
function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
function playClickSound() {
  if (!state.uiSounds) return;
  initAudio(); if (!audioCtx) return;
  const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
  osc.type = 'triangle'; osc.frequency.setValueAtTime(600, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.03);
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.03);
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime + 0.03);
}

// Audio init & Visual effect mapped to pointerup (safer for drag/scroll)
document.addEventListener('pointerup', (e) => {
  if (!audioCtx) initAudio(); else if (audioCtx.state === 'suspended') audioCtx.resume();
  // Don't shockwave or sound if we were dragging the canvas
  if (isDragging) return;

  if (e.target.closest('button, .icon-btn, .sli, .swatch, .check, .er-head, .dropzone, input[type="range"], .color-picker')) playClickSound();
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

let currentZoom = 1;
let panX = 0, panY = 0;
let isDragging = false;
let startX, startY;
let pointers = [];
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
  // Loupe Update
  if (isLoupeActive && state.sourceImage && outCanvas.width > 0) {
    const rect = outCanvas.getBoundingClientRect();
    // Check if cursor is over the canvas
    if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
      loupe.style.left = (e.clientX - 80) + 'px'; // 160/2
      loupe.style.top = (e.clientY - 80) + 'px';
      
      const scaleX = outCanvas.width / rect.width;
      const scaleY = outCanvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      
      const lctx = loupeCanvas.getContext('2d');
      lctx.clearRect(0,0,160,160);
      const zoomLvl = 3; const sSize = 160 / zoomLvl;
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
canvasWrapper.addEventListener('pointerup', pointerUp);
canvasWrapper.addEventListener('pointercancel', pointerUp);

canvasWrapper.addEventListener('wheel', (e) => {
  e.preventDefault(); 
  if (e.ctrlKey || e.metaKey) { currentZoom = Math.max(0.2, Math.min(currentZoom - (e.deltaY > 0 ? 0.1 : -0.1), 5)); } 
  else { panX -= e.deltaX; panY -= e.deltaY; }
  updateTransform(false);
}, {passive: false});

document.getElementById('zoomIn').addEventListener('click', () => { currentZoom = Math.min(currentZoom + 0.25, 5); updateTransform(true); });
document.getElementById('zoomOut').addEventListener('click', () => { currentZoom = Math.max(currentZoom - 0.25, 0.2); updateTransform(true); });

// ==================== RENDERING & PRESETS ====================
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

function applyPreset(p) {
  if (!p) return; 
  if (p.profile) state.profile = p.profile;
  const setS = (id, vid, v) => { const e=document.getElementById(id); if(e){ e.value=v; document.getElementById(vid).textContent=v; state[id.replace('Slider','')] = v; }};
  if (p.brightness !== undefined) setS('brightnessSlider', 'brightnessVal', p.brightness);
  if (p.contrast !== undefined) setS('contrastSlider', 'contrastVal', p.contrast);
  if (p.gamma !== undefined) setS('gammaSlider', 'gammaVal', p.gamma);
  if (p.threshold !== undefined) setS('thresholdSlider', 'thresholdVal', p.threshold);
  if (p.ink) state.ink = p.ink; if (p.paper) state.paper = p.paper;
  state.doubleStrike = !!p.doubleStrike; state.condensed = !!p.condensed; state.softBlur = !!p.softBlur; state.invert = !!p.invert;
  state.wearLayers = p.wearLayers || [];
  updateUIFromState(); triggerUpdate();
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

state.autoRender = true; state.uiSounds = true; state.wearLayers = []; applyLanguage('de');
function updateProfileMeta() { const p = PROFILES[state.profile]; document.getElementById("profileMeta").textContent = `${p.pins}-pin · ${p.dpi_h}×${p.dpi_v} dpi`; }
updateProfileMeta();

if (typeof SYSTEM_PRESETS !== 'undefined') {
  const list = document.getElementById('presetList');
  [...SYSTEM_PRESETS, ...(JSON.parse(localStorage.getItem('dm_ps') || '[]'))].forEach(p => {
    const el = document.createElement('div'); el.className = 'sli';
    el.innerHTML = `<div class="sli-row"><span>${p.name}</span><span class="sli-badge">${p.system ? 'SYS' : 'USR'}</span></div>`;
    el.onclick = () => { document.querySelectorAll('#presetList .sli').forEach(s=>s.classList.remove('active')); el.classList.add('active'); applyPreset(p); };
    list.appendChild(el);
  });
}
