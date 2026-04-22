import { state, PROFILES, SYSTEM_PRESETS, WEAR_PATTERNS } from './config.js';
import { render, asciiPreview } from './engine.js';

// ==================== LANGUAGE & SOUNDS ====================
const translations = {
  de: { sourceTitle: "Bildquelle", dropzoneBig: "Bild auswählen", profileTitle: "Druckerprofil", adjustTitle: "Bildanpassung", presetsTitle: "Gespeicherte Presets", btnExport: "Export YAML", btnImport: "Import YAML", createPresetTitle: "Preset Erstellen", btnSavePreset: "Speichern", btnRender: "Manuell Rendern", previewTitle: "Live-Vorschau" },
  en: { sourceTitle: "Image Source", dropzoneBig: "Select Image", profileTitle: "Printer Profile", adjustTitle: "Adjustments", presetsTitle: "Saved Presets", btnExport: "Export YAML", btnImport: "Import YAML", createPresetTitle: "Create Preset", btnSavePreset: "Save", btnRender: "Manual Render", previewTitle: "Live Preview" }
};
function applyLanguage(lang) {
  const dict = translations[lang] || translations.de;
  document.querySelectorAll('[data-i18n]').forEach(el => { const key = el.getAttribute('data-i18n'); if (dict[key]) el.textContent = dict[key]; });
}

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playClickSound() {
  if (!state.uiSounds) return; if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
  osc.type = 'sine'; osc.frequency.setValueAtTime(800, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.05);
  gain.gain.setValueAtTime(0.05, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
  osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.05);
}

// ==================== PRESET LOGIC (RESTORED) ====================
function presetToYaml(p) {
  const skip = new Set(['id', 'system']); const lines = [];
  for (const [k, v] of Object.entries(p)) {
    if (skip.has(k)) continue;
    if (Array.isArray(v)) lines.push(v.length ? `${k}: [${v.join(', ')}]` : `${k}: []`);
    else lines.push(`${k}: ${v}`);
  } return lines.join('\n');
}
function yamlToPreset(yaml) {
  const p = {}; yaml.split('\n').forEach(line => {
    const [k, v] = line.split(':').map(s => s?.trim()); if (!k || !v) return;
    if (v.startsWith('[')) p[k] = v.slice(1, -1).split(',').map(n => parseFloat(n));
    else if (v === 'true' || v === 'false') p[k] = v === 'true';
    else p[k] = isNaN(parseFloat(v)) ? v : parseFloat(v);
  }); return p;
}
function captureCurrentPreset(name) {
  return { name: name || 'Unnamed', profile: state.profile, brightness: state.brightness, contrast: state.contrast, gamma: state.gamma, dither: state.dither, threshold: state.threshold, ink: [...state.ink], paper: [...state.paper], doubleStrike: state.doubleStrike, condensed: state.condensed, softBlur: state.softBlur, invert: state.invert, wearLayers: state.wearLayers.map(l => ({...l})) };
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
function updateUIFromState() {
  document.querySelectorAll('#profileList .sli').forEach(s => s.classList.toggle('active', s.dataset.profile === state.profile));
  document.querySelectorAll('.check').forEach(c => c.classList.toggle('on', state[c.dataset.flag]));
  document.querySelectorAll('#errorList .er').forEach(er => {
    const layer = state.wearLayers.find(l => l.pattern === er.dataset.pattern);
    er.classList.toggle('on', !!layer);
    if (layer) { er.querySelector('.er-slider').value = layer.strength; er.querySelector('.er-val').textContent = layer.strength + '%'; }
  });
}
function renderPresetList() {
  const list = document.getElementById('presetList'); list.innerHTML = '';
  const all = [...SYSTEM_PRESETS, ...JSON.parse(localStorage.getItem('dm_ps') || '[]')];
  all.forEach(p => {
    const el = document.createElement('div'); el.className = 'sli';
    el.innerHTML = `<div class="sli-row"><span>${p.name}</span><span class="sli-badge">${p.system ? 'SYS' : 'USR'}</span></div>`;
    el.onclick = () => { document.querySelectorAll('#presetList .sli').forEach(s=>s.classList.remove('active')); el.classList.add('active'); applyPreset(p); };
    list.appendChild(el);
  });
}

// ==================== RENDERING & ANALYSIS ====================
let isRendering = false;
async function performRender() {
  if (!state.sourceImage || isRendering) return; isRendering = true;
  const btn = document.getElementById("renderBtn"); btn.disabled = true;
  document.getElementById("status").textContent = "Rendern...";
  try {
    const { imageData, width, height } = await render(state.sourceImage, msg => document.getElementById("status").textContent = msg);
    const canvas = document.getElementById("outCanvas"); canvas.width = width; canvas.height = height;
    canvas.getContext("2d").putImageData(imageData, 0, 0);
    canvas.toBlob(blob => { window.lastBlob = blob; document.getElementById("downloadBtn").disabled = false; }, "image/png");
    document.getElementById("status").textContent = `Vorschau: ${width}×${height}`;
  } catch (e) { console.error(e); }
  isRendering = false; btn.disabled = false;
}
const triggerUpdate = (function() {
  let t; return () => { clearTimeout(t); t = setTimeout(() => { if (state.autoRender) performRender(); }, 300); };
})();

function analyzeAndAdaptImage(img) {
  const c = document.createElement("canvas"); c.width = 160; c.height = 160; const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0, 160, 160); const { data } = ctx.getImageData(0, 0, 160, 160);
  const hist = new Uint32Array(256); for (let i = 0; i < data.length; i += 4) hist[Math.round(0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2])]++;
  const total = 160*160; let cum = 0, p2 = 0, p98 = 255;
  for (let i = 0; i < 256; i++) { cum += hist[i]; if (cum/total < 0.02) p2 = i; if (cum/total < 0.98) p98 = i; }
  if (hist.slice(180).reduce((a,b)=>a+b,0)/total > 0.45) { // Doc Mode
    state.contrast = 45; state.dither = "threshold"; 
  } else { state.brightness = Math.max(-60, Math.min(60, Math.round(((p2+p98)/2-128)*-0.35))); }
  updateUIFromState();
}

// ==================== INIT & EVENTS ====================
document.querySelectorAll('.activity-bar .icon-btn').forEach(btn => btn.onclick = () => {
  document.querySelectorAll('.activity-bar .icon-btn, .tab-content').forEach(el => el.classList.remove('active'));
  btn.classList.add('active'); document.getElementById(btn.dataset.tab).classList.add('active');
});
document.getElementById('fileInput').onchange = (e) => {
  const file = e.target.files[0]; if (!file) return; const img = new Image();
  img.onload = () => { state.sourceImage = img; analyzeAndAdaptImage(img); performRender(); };
  img.src = URL.createObjectURL(file);
};
document.getElementById('renderBtn').onclick = performRender;
document.getElementById('downloadBtn').onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(window.lastBlob); a.download = `print_${Date.now()}.png`; a.click(); };
document.querySelectorAll('.check').forEach(el => el.onclick = () => { el.classList.toggle('on'); state[el.dataset.flag] = el.classList.contains('on'); triggerUpdate(); });
document.querySelectorAll('input[type=range]').forEach(s => s.oninput = () => { const v = document.getElementById(s.id.replace('Slider','Val')); if(v) v.textContent = s.value; state[s.id.replace('Slider','')] = parseFloat(s.value); triggerUpdate(); });

state.autoRender = true; state.uiSounds = true; state.wearLayers = []; applyLanguage('de'); renderPresetList();
function updateProfileMeta() { const p = PROFILES[state.profile]; document.getElementById("profileMeta").textContent = `${p.pins}-pin · ${p.dpi_h}×${p.dpi_v} dpi`; }
updateProfileMeta();
