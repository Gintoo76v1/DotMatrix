// ── Theme, language, background animation selectors ───────────────────────

import { applyLanguage } from '../lang.js';
import { saveSettings } from '../settings-store.js';

export function initTheme(state, persisted = {}) {
  // Initial values from persisted settings
  if (persisted.language)    setSelect('langSelector', persisted.language);
  if (persisted.themeAccent) setSelect('themeAccentSelector', persisted.themeAccent);
  if (persisted.themeMode)   setSelect('themeModeSelector', persisted.themeMode);
  if (persisted.bgAnimStyle) setSelect('bgAnimSelector', persisted.bgAnimStyle);

  document.body.setAttribute('data-accent', persisted.themeAccent || 'amber');
  document.body.className = (persisted.themeMode === 'light') ? 'light-mode' : 'dark-mode';

  const lang = document.getElementById('langSelector');
  const acc  = document.getElementById('themeAccentSelector');
  const mode = document.getElementById('themeModeSelector');
  const anim = document.getElementById('bgAnimSelector');
  const bg   = document.getElementById('appBg');

  if (lang) {
    applyLanguage(lang.value);
    lang.addEventListener('change', (e) => {
      applyLanguage(e.target.value);
      saveSettings({ language: e.target.value });
    });
  }
  if (acc) acc.addEventListener('change', (e) => {
    document.body.setAttribute('data-accent', e.target.value);
    saveSettings({ themeAccent: e.target.value });
  });
  if (mode) mode.addEventListener('change', (e) => {
    document.body.className = e.target.value === 'light' ? 'light-mode' : 'dark-mode';
    saveSettings({ themeMode: e.target.value });
  });
  if (anim) {
    if (bg && persisted.bgAnimStyle) bg.setAttribute('data-anim', persisted.bgAnimStyle);
    anim.addEventListener('change', (e) => {
      if (bg) bg.setAttribute('data-anim', e.target.value);
      saveSettings({ bgAnimStyle: e.target.value });
    });
  }

  updateBgAnimVisibility(state);
}

function setSelect(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

export function updateBgAnimVisibility(state) {
  const bg     = document.getElementById('appBg');
  const field  = document.getElementById('bgAnimStyleField');
  const select = document.getElementById('bgAnimSelector');
  if (!bg) return;
  if (state.bgAnim) {
    bg.style.opacity = '1';
    if (field) field.style.opacity = '1';
    if (select) select.disabled = false;
  } else {
    bg.style.opacity = '0';
    if (field) field.style.opacity = '0.4';
    if (select) select.disabled = true;
  }
}

// ── Activity-bar tab switching ────────────────────────────────────────────
export function initTabs() {
  document.querySelectorAll('.activity-bar .icon-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.activity-bar .icon-btn, .tab-content').forEach(el => el.classList.remove('active'));
      btn.classList.add('active');
      const tab = document.getElementById(btn.dataset.tab);
      if (tab) tab.classList.add('active');
    });
  });
}
