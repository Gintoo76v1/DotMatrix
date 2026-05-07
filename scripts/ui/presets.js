// ── Preset list + import/export ────────────────────────────────────────────

import { state, SYSTEM_PRESETS } from '../config.js';
import { presetToYaml, yamlToPreset } from '../preset-yaml.js';
import { setSliderValue, syncAllFromState } from './sliders.js';
import { setSegmentedValue } from './segments.js';
import { setSwatchValue } from './swatches.js';
import { applyWearLayersToUI } from './wear.js';
import { detectAndSetPaperColor } from './analyze.js';
import { showError } from './error.js';
import { api } from '../api.js';
import { localDB } from '../db.js';
import { queueCreateProject, queueDeleteProject } from '../sync.js';
import { loadProjectHistory } from './history.js';

let activePresetId = null;
let onAfterApply = null;

// ── User preset persistence ────────────────────────────────────────────────

// Wir nutzen jetzt localDB für Offline-First und API für den Sync
async function loadUserPresets() {
  try {
    const res = await api.projects.list();
    if (res && res.projects) {
      // Speichere die geladenen Projekte lokal als Fallback
      for (const p of res.projects) {
        await localDB.saveProject(p);
      }
      return res.projects.map((p) => ({
        id: p.id,
        name: p.name,
        system: false,
        ...p.contentJson,
      }));
    }
  } catch (err) {
    console.warn('Could not fetch projects from server, falling back to localDB', err);
  }

  // Fallback auf lokale Datenbank
  try {
    const localProjects = await localDB.getAllProjects();
    return localProjects.map((p) => ({
      id: p.id,
      name: p.name,
      system: false,
      ...p.contentJson,
    }));
  } catch {
    return [];
  }
}

async function saveUserPreset(preset) {
  try {
    const { id, name, system, ...contentJson } = preset;
    // Neue Presets haben noch keine echte UUID (nur usr_timestamp).
    // Wir übergeben sie der API als Create-Aufruf.
    await queueCreateProject(name, contentJson);
    await renderPresetList();
  } catch (e) {
    showError(`[Speicher Fehler]: ${e.message}`);
  }
}

async function deleteUserPreset(id) {
  try {
    await queueDeleteProject(id);
    await renderPresetList();
  } catch (e) {
    showError(`[Löschen Fehler]: ${e.message}`);
  }
}

// ── Capture current state as a preset ──────────────────────────────────────

export function captureCurrentPreset(name) {
  return {
    name: name || 'Unnamed',
    system: false,
    profile: state.profile,
    brightness: state.brightness,
    contrast: state.contrast,
    gamma: state.gamma,
    dither: state.dither,
    threshold: state.threshold,
    ink: [...state.ink],
    paper: state.paper ? [...state.paper] : null,
    paperFormat: state.paperFormat,
    orientation: state.orientation,
    doubleStrike: state.doubleStrike,
    condensed: state.condensed,
    softBlur: state.softBlur,
    invert: state.invert,
    wearLayers: state.wearLayers.map((l) => ({ ...l })),
  };
}

// ── Apply a preset back into state + UI ────────────────────────────────────

const SLIDER_KEYS = [
  'brightness',
  'contrast',
  'gamma',
  'threshold',
  'dpi',
  'jitterScale',
  'bandingScale',
  'maxSize',
  'seed',
];

export function applyPreset(p) {
  if (!p) return;
  try {
    if (p.profile) state.profile = p.profile;

    for (const k of SLIDER_KEYS) {
      if (p[k] !== undefined) {
        state[k] = p[k];
        setSliderValue(state, k, p[k]);
      }
    }

    if (p.dither) {
      state.dither = p.dither;
      setSegmentedValue('ditherBtns', 'dither', p.dither);
      const tf = document.getElementById('thresholdField');
      if (tf) tf.style.display = p.dither === 'threshold' ? 'block' : 'none';
    }
    if (p.paperFormat) {
      state.paperFormat = p.paperFormat;
      setSegmentedValue('paperFormatBtns', 'format', p.paperFormat);
    }
    if (p.orientation) {
      state.orientation = p.orientation;
      setSegmentedValue('orientationBtns', 'orient', p.orientation);
    }

    if (p.ink) {
      state.ink = [...p.ink];
      const inkStr = p.ink.join(',');
      let found = false;
      document.querySelectorAll('#inkSwatches .swatch:not(.custom-swatch)').forEach((s) => {
        const m = s.dataset.ink === inkStr;
        s.classList.toggle('active', m);
        if (m) found = true;
      });
      const custom = document.getElementById('customInkSwatch');
      const picker = document.getElementById('inkColorPicker');
      const hexIn = document.getElementById('inkHexInput');
      if (!found && custom && picker && hexIn) {
        const hex = '#' + p.ink.map((x) => x.toString(16).padStart(2, '0')).join('');
        custom.dataset.ink = inkStr;
        custom.style.background = hex;
        custom.classList.add('active');
        picker.value = hex;
        hexIn.value = hex;
      } else if (custom) {
        custom.classList.remove('active');
      }
    }

    if (p.paper !== undefined) {
      if (p.paper === null) {
        if (state.sourceImage) detectAndSetPaperColor(state, state.sourceImage);
        else {
          state.paper = [255, 255, 255];
          setSwatchValue('paperSwatches', 'paper', state.paper);
        }
      } else {
        state.paper = [...p.paper];
        setSwatchValue('paperSwatches', 'paper', state.paper);
      }
    }

    state.doubleStrike = !!p.doubleStrike;
    state.condensed = !!p.condensed;
    state.softBlur = !!p.softBlur;
    state.invert = !!p.invert;

    document.querySelectorAll('.check').forEach((c) => {
      const flag = c.dataset.flag;
      if (flag in state) c.classList.toggle('on', !!state[flag]);
    });

    if (p.wearLayers !== undefined) {
      state.wearLayers = p.wearLayers.map((l) => ({ ...l }));
      applyWearLayersToUI(state);
    }

    document
      .querySelectorAll('#profileList .sli')
      .forEach((s) => s.classList.toggle('active', s.dataset.profile === state.profile));

    if (onAfterApply) onAfterApply();
  } catch (e) {
    showError(`[Preset Apply Fehler]: ${e.message}`);
  }
}

// ── Preset list rendering ──────────────────────────────────────────────────

function escapeHTML(str) {
  if (typeof str !== 'string') return String(str);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function renderPresetList() {
  const list = document.getElementById('presetList');
  if (!list) return;
  list.innerHTML = '';
  const userPresets = await loadUserPresets();
  const all = [...(SYSTEM_PRESETS || []), ...userPresets];
  for (const p of all) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'sli' + (p.id === activePresetId ? ' active' : '');
    const safeName = escapeHTML(p.name);
    if (p.system) {
      el.innerHTML = `<div class="sli-row" style="width:100%"><span class="sli-name">${safeName}</span><span class="sli-badge">SYS</span></div>`;
    } else {
      el.innerHTML = `<div class="sli-row" style="width:100%"><span class="sli-name">${safeName}</span><div><span class="sli-badge" style="margin-right:5px">USR</span><button class="sli-del" title="Löschen">×</button></div></div>`;
      el.querySelector('.sli-del').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Preset "${p.name}" löschen?`)) {
          if (activePresetId === p.id) activePresetId = null;
          deleteUserPreset(p.id);
        }
      });
    }
    el.addEventListener('click', () => {
      activePresetId = p.id;
      document.querySelectorAll('#presetList .sli').forEach((s) => s.classList.remove('active'));
      el.classList.add('active');
      applyPreset(p);
      if (!p.system) loadProjectHistory(p.id);
    });
    list.appendChild(el);
  }
}

// ── File download helper ───────────────────────────────────────────────────

function downloadText(text, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function fileNameFor(name) {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.yaml`;
}

// ── Wire all preset-related buttons ────────────────────────────────────────

export function initPresets({ onApply, onSetStatus } = {}) {
  onAfterApply = onApply;

  const expBtn = document.getElementById('exportPresetBtn');
  const expCur = document.getElementById('exportCurrentBtn');
  const impBtn = document.getElementById('importPresetBtn');
  const preFile = document.getElementById('presetFileInput');
  const saveBtn = document.getElementById('savePresetBtn');
  const impYaml = document.getElementById('importYamlBtn');
  const nameIn = document.getElementById('presetNameInput');
  const yamlArea = document.getElementById('presetYamlArea');

  if (expBtn)
    expBtn.addEventListener('click', () => {
      let name = nameIn ? nameIn.value.trim() : '';
      if (!name) {
        name = prompt('Preset Name:', 'My Preset');
        if (!name) return;
        if (nameIn) nameIn.value = name;
      }
      downloadText(presetToYaml(captureCurrentPreset(name)), fileNameFor(name));
    });

  if (expCur)
    expCur.addEventListener('click', () => {
      const name = (nameIn && nameIn.value.trim()) || 'my-preset';
      const yaml = presetToYaml(captureCurrentPreset(name));
      if (yamlArea) yamlArea.value = yaml;
      downloadText(yaml, fileNameFor(name));
    });

  if (impBtn && preFile) impBtn.addEventListener('click', () => preFile.click());
  if (preFile)
    preFile.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      importFromText(await file.text(), onSetStatus);
      e.target.value = '';
    });

  if (saveBtn)
    saveBtn.addEventListener('click', async () => {
      const name = nameIn ? nameIn.value.trim() : '';
      if (!name) return showError('Name für das Preset ist erforderlich.');
      const preset = captureCurrentPreset(name);
      preset.id = 'usr_' + Date.now(); // local fallback ID
      await saveUserPreset(preset);
      activePresetId = preset.id;
      if (onSetStatus) onSetStatus('Gespeichert.');
    });

  if (impYaml)
    impYaml.addEventListener('click', () => {
      if (!yamlArea || !yamlArea.value.trim()) {
        return showError('Bitte füge YAML Code in das Textfeld ein!');
      }
      importFromText(yamlArea.value.trim(), onSetStatus);
    });
}

function importFromText(text, onSetStatus) {
  try {
    const stripped = text.trim();
    let preset = stripped.startsWith('{') ? JSON.parse(stripped) : yamlToPreset(stripped);
    if (!preset.name) preset.name = 'Imported';
    applyPreset(preset);
    if (onSetStatus) onSetStatus('Importiert.');
    if (preset.name !== 'Imported') {
      preset.id = 'usr_' + Date.now();
      preset.system = false;
      saveUserPreset(preset).catch((e) => showError(`[Import Save Fehler]: ${e.message}`));
      activePresetId = preset.id;
    }
  } catch (err) {
    showError(`[YAML Import Fehler]: Das Format des Codes ist ungültig. (${err.message})`);
  }
}

// Re-export internal helper for external syncs (e.g. after upload)
export { syncAllFromState };
