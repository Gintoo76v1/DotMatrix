// ── Appearance controller: Theme, Font, Animation, Layout ───────────────
// Centralises all visual customisation that is NOT tied to the render engine.
// This module wires the System-tab controls into CSS custom properties and
// persists the choices via settings-store.

import { state, PROFILES } from '../config.js';
import { saveSettings } from '../settings-store.js';
import { applyLanguage } from '../lang.js';

// ── Theme map: ID → human-readable label ────────────────────────────────────
const THEME_LABELS = {
  'oc-2':       'OC-2',
  'matrix':     'Matrix',
  'tokyonight': 'Tokyonight',
  'synthwave':  'Synthwave',
  'gruvbox':    'Gruvbox',
};

// ── Font stacks (CSS font-family values, NOT display names) ────────────────
const FONT_STACKS = {
  sans: {
    'Inter':           '"Inter", ui-sans-serif, system-ui, -apple-system, sans-serif',
    'System Sans':     'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    'SF Pro':          '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
    'Roboto':          '"Roboto", ui-sans-serif, system-ui, sans-serif',
    'Open Sans':       '"Open Sans", ui-sans-serif, system-ui, sans-serif',
  },
  mono: {
    'JetBrains Mono':  '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    'System Mono':     'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    'Fira Code':       '"Fira Code", ui-monospace, monospace',
    'Cascadia Code':   '"Cascadia Code", ui-monospace, monospace',
    'IBM Plex Mono':   '"IBM Plex Mono", ui-monospace, monospace',
  },
  terminal: {
    'JetBrainsMono Nerd Font Mono': '"JetBrainsMono Nerd Font Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    'JetBrains Mono':  '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    'Fira Code':       '"Fira Code", ui-monospace, monospace',
    'Hack':            '"Hack", ui-monospace, monospace',
  },
};

// ── Animation presets (CSS var overrides) ────────────────────────────────────
const ANIM_PRESETS = {
  aurora:   { pattern: 'aurora',   speed: 50, intensity: 30, size: 50 },
  pulse:    { pattern: 'pulse',    speed: 80, intensity: 40, size: 60 },
  orbit:    { pattern: 'orbit',    speed: 40, intensity: 25, size: 45 },
  drift:    { pattern: 'drift',    speed: 50, intensity: 30, size: 50 },
  breathe:  { pattern: 'breathe',  speed: 60, intensity: 35, size: 55 },
  off:      { pattern: 'off',      speed: 0,  intensity: 0,  size: 0 },
};

// ── Public API ──────────────────────────────────────────────────────────────

export function initAppearance(persisted = {}) {
  // Restore persisted values into DOM controls
  const restore = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val ?? el.value;
  };

  restore('themeSelector',      persisted.theme        || state.theme);
  restore('themeModeSelector',    persisted.themeMode    || state.themeMode);
  restore('fontSansSelector',     persisted.fontSans     || state.fontSans);
  restore('fontMonoSelector',     persisted.fontMono     || state.fontMono);
  restore('fontTerminalSelector', persisted.fontTerminal || state.fontTerminal);
  restore('fontSansCustom',      persisted.fontSansCustom     || '');
  restore('fontMonoCustom',      persisted.fontMonoCustom     || '');
  restore('fontTerminalCustom', persisted.fontTerminalCustom || '');
  restore('animPatternSelector',  persisted.animPattern  || state.animPattern);
  restore('animSpeedSlider',     (persisted.animSpeed     ?? state.animSpeed).toString());
  restore('animIntensitySlider', (persisted.animIntensity ?? state.animIntensity).toString());
  restore('animSizeSlider',      (persisted.animSize      ?? state.animSize).toString());
  restore('layoutSelector',      persisted.layout       || state.layout);
  restore('changelogAutoCheck',  persisted.autoCheckUpdates !== false);

  // Custom-font visibility
  _toggleCustomFields();

  // Apply everything to CSS
  applyAppearance();

  // Wire events
  _wire('themeSelector',      'theme',        applyAppearance);
  _wire('themeModeSelector',    'themeMode',    applyAppearance);
  _wire('fontSansSelector',     'fontSans',     () => { _toggleCustomFields(); applyAppearance(); });
  _wire('fontMonoSelector',     'fontMono',     () => { _toggleCustomFields(); applyAppearance(); });
  _wire('fontTerminalSelector', 'fontTerminal', () => { _toggleCustomFields(); applyAppearance(); });
  _wire('fontSansCustom',       'fontSansCustom',     applyAppearance);
  _wire('fontMonoCustom',       'fontMonoCustom',     applyAppearance);
  _wire('fontTerminalCustom',   'fontTerminalCustom', applyAppearance);
  _wire('animPatternSelector',  'animPattern',  () => { _applyAnimPreset(); applyAppearance(); });
  _wireSlider('animSpeedSlider',     'animSpeed',     v => v, applyAppearance);
  _wireSlider('animIntensitySlider', 'animIntensity', v => v, applyAppearance);
  _wireSlider('animSizeSlider',      'animSize',      v => v, applyAppearance);
  _wire('layoutSelector',       'layout',       applyAppearance);
  _wire('changelogAutoCheck',   'autoCheckUpdates', v => v === 'true' || v === true, null, true);

  // Language (already wired in old code, keep here for completeness)
  const lang = document.getElementById('langSelector');
  if (lang) {
    if (persisted.language) lang.value = persisted.language;
    applyLanguage(lang.value);
    lang.addEventListener('change', (e) => {
      applyLanguage(e.target.value);
      saveSettings({ language: e.target.value });
    });
  }

  // Legacy bgAnimStyle migration (if present in persisted)
  if (persisted.bgAnimStyle) {
    // Map old drift/breathe/orbit to new names
    const map = { drift: 'drift', breathe: 'breathe', orbit: 'orbit' };
    if (map[persisted.bgAnimStyle]) {
      state.animPattern = map[persisted.bgAnimStyle];
      restore('animPatternSelector', state.animPattern);
    }
  }

  updateBgAnimVisibility(state);
}

/**
 * Apply all appearance-related CSS custom properties and classes.
 * Call this whenever any appearance state changes.
 */
export function applyAppearance() {
  const body = document.body;
  const appBg = document.getElementById('appBg');

  // ── Theme ──
  body.setAttribute('data-theme', state.theme);
  const isLight = state.themeMode === 'light' ||
    (state.themeMode === 'auto' && window.matchMedia('(prefers-color-scheme: light)').matches);
  body.classList.toggle('light-mode', isLight);
  body.classList.toggle('dark-mode', !isLight);

  // ── Fonts ──
  const sansStack     = _resolveFont('sans',     state.fontSans,     state.fontSansCustom);
  const monoStack     = _resolveFont('mono',     state.fontMono,     state.fontMonoCustom);
  const terminalStack = _resolveFont('terminal', state.fontTerminal, state.fontTerminalCustom);

  body.style.setProperty('--dm-font-sans',      sansStack);
  body.style.setProperty('--dm-font-mono',      monoStack);
  body.style.setProperty('--dm-font-terminal',   terminalStack);

  // ── Animation ──
  if (appBg) {
    const isOff = !state.bgAnim || state.animPattern === 'off';
    appBg.setAttribute('data-anim', isOff ? 'off' : state.animPattern);

    // Speed, intensity, size are handled via CSS vars for dynamic adjustment
    body.style.setProperty('--anim-speed',     state.animSpeed / 100);
    body.style.setProperty('--anim-intensity', state.animIntensity / 100);
    body.style.setProperty('--anim-size',      state.animSize / 100);

    // Dynamic animation duration based on speed slider.
    // Base durations (seconds) per pattern — these match the CSS defaults.
    const baseDur = {
      aurora:  { before: 20, after: 25 },
      pulse:   { orb: 8 },
      orbit:   { orb1: 30, orb2: 35 },
      drift:   { orb1: 20, orb2: 25 },
      breathe: { orb1: 8,  orb2: 10 },
      off:     {},
    }[state.animPattern] || {};

    const speedFactor = Math.max(state.animSpeed, 1) / 100; // avoid div/0
    const scale = d => isOff || !d ? '0s' : `${d / speedFactor}s`;

    appBg.style.setProperty('--anim-dur-before', scale(baseDur.before));
    appBg.style.setProperty('--anim-dur-after',  scale(baseDur.after));
    appBg.style.setProperty('--anim-dur-orb',     scale(baseDur.orb));
    appBg.style.setProperty('--anim-dur-orb1',    scale(baseDur.orb1));
    appBg.style.setProperty('--anim-dur-orb2',    scale(baseDur.orb2));
  }

  // ── Layout ──
  body.setAttribute('data-layout', state.layout);
  _switchLayout(state.layout);

  // Persist
  saveSettings({
    theme: state.theme,
    themeMode: state.themeMode,
    fontSans: state.fontSans,
    fontSansCustom: state.fontSansCustom,
    fontMono: state.fontMono,
    fontMonoCustom: state.fontMonoCustom,
    fontTerminal: state.fontTerminal,
    fontTerminalCustom: state.fontTerminalCustom,
    animPattern: state.animPattern,
    animSpeed: state.animSpeed,
    animIntensity: state.animIntensity,
    animSize: state.animSize,
    layout: state.layout,
    autoCheckUpdates: state.autoCheckUpdates,
  });
}

/** Toggle bg-anim visibility (used by the bgAnim checkbox in checks.js). */
export function updateBgAnimVisibility(state) {
  const appBg = document.getElementById('appBg');
  const field = document.getElementById('bgAnimStyleField');
  const sel   = document.getElementById('bgAnimSelector');
  if (!appBg) return;
  // In the new system, visibility is controlled by the pattern selector
  // (already handled by applyAppearance reading state.bgAnim)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _wire(id, stateKey, onChange, transform = v => v, isCheckbox = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener(isCheckbox ? 'change' : 'input', () => {
    state[stateKey] = transform(isCheckbox ? el.checked : el.value);
    if (onChange) onChange();
  });
}

function _wireSlider(id, stateKey, transform, onChange) {
  const el = document.getElementById(id);
  const valEl = document.getElementById(id.replace('Slider', 'Val'));
  if (!el) return;
  const apply = () => {
    const v = transform(+el.value);
    state[stateKey] = v;
    if (valEl) valEl.textContent = v + '%';
    if (onChange) onChange();
  };
  el.addEventListener('input', apply);
}

function _resolveFont(type, selected, custom) {
  if (selected === 'Custom' && custom && custom.trim()) {
    return `"${custom.trim()}", ${FONT_STACKS[type]['System Sans'] || FONT_STACKS[type]['System Mono']}`;
  }
  return FONT_STACKS[type][selected] || FONT_STACKS[type][Object.keys(FONT_STACKS[type])[0]];
}

function _toggleCustomFields() {
  const toggle = (selId, fieldId) => {
    const sel   = document.getElementById(selId);
    const field = document.getElementById(fieldId);
    if (sel && field) field.style.display = sel.value === 'Custom' ? 'block' : 'none';
  };
  toggle('fontSansSelector',     'fontSansCustomField');
  toggle('fontMonoSelector',     'fontMonoCustomField');
  toggle('fontTerminalSelector', 'fontTerminalCustomField');
}

function _applyAnimPreset() {
  const preset = ANIM_PRESETS[state.animPattern];
  if (!preset) return;
  const apply = (id, val) => {
    const el = document.getElementById(id);
    const vEl = document.getElementById(id.replace('Slider', 'Val'));
    if (el) el.value = val;
    if (vEl) vEl.textContent = val + '%';
    const map = {
      animSpeedSlider:     'animSpeed',
      animIntensitySlider: 'animIntensity',
      animSizeSlider:      'animSize',
    };
    if (map[id]) state[map[id]] = val;
  };
  apply('animSpeedSlider',     preset.speed);
  apply('animIntensitySlider', preset.intensity);
  apply('animSizeSlider',      preset.size);
}

/* ── Layout Switching ─────────────────────────────────────────────────────── */

let _bentoInterval = null;
let _mobileToggleWired = false;

function _switchLayout(layout) {

  // Bento cards: start/stop interval
  if (layout === 'opencode') {
    if (!_bentoInterval) {
      updateBento();
      _bentoInterval = setInterval(updateBento, 1000);
    }
  } else {
    if (_bentoInterval) {
      clearInterval(_bentoInterval);
      _bentoInterval = null;
    }
  }

  // Mobile sidebar toggle (once)
  if (!_mobileToggleWired) {
    _mobileToggleWired = true;
    const toggle = document.getElementById('sidebarToggle');
    const overlay = document.getElementById('sidebarOverlay');
    const sidebar = document.querySelector('.sidebar');
    if (toggle && sidebar) {
      toggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        if (overlay) overlay.classList.toggle('active', sidebar.classList.contains('open'));
      });
    }
    if (overlay && sidebar) {
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
      });
    }
  }
}

/**
 * Update Bento info cards from current state.
 * Called automatically every second when OpenCode layout is active.
 */
export function updateBento() {
  const els = {
    res:      document.getElementById('bentoRes'),
    resVal:   document.getElementById('bentoResVal'),
    paper:    document.getElementById('bentoPaper'),
    paperVal: document.getElementById('bentoPaperVal'),
    ink:      document.getElementById('bentoInk'),
    inkVal:   document.getElementById('bentoInkVal'),
    profile:  document.getElementById('bentoProfile'),
    profileVal: document.getElementById('bentoProfileVal'),
  };
  if (!els.res) return; // Bento not in DOM (classic layout)

  const p = PROFILES[state.profile];
  const profileName = p ? p.name : state.profile;

  // Resolution (from canvas or state)
  const canvas = document.getElementById('outCanvas');
  const w = canvas ? canvas.width : 0;
  const h = canvas ? canvas.height : 0;

  if (els.res)     els.res.textContent     = w && h ? `${w}×${h}` : '—';
  if (els.resVal)  els.resVal.textContent  = w && h ? `${(w * h / 1e6).toFixed(2)} MP` : '—';

  if (els.paper)    els.paper.textContent    = state.paperFormat || 'Original';
  if (els.paperVal) els.paperVal.textContent = state.orientation || 'Portrait';

  // Ink colour preview
  const ink = state.inkColour || [25, 25, 30];
  if (els.ink)     els.ink.textContent     = `RGB(${ink.join(', ')})`;
  if (els.inkVal)  els.inkVal.textContent  = `#${ink.map(c => c.toString(16).padStart(2, '0')).join('')}`;

  if (els.profile)    els.profile.textContent    = profileName;
  if (els.profileVal) els.profileVal.textContent = p ? `${p.pins}-PIN · ${p.dpi_h}×${p.dpi_v} dpi` : '—';
}
