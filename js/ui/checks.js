// ── Boolean state checkboxes ───────────────────────────────────────────────
// All `.check[data-flag]` elements toggle a single property on `state`.
// Persisted flags (autoRender, uiSounds, bgAnim, legacyMath, useWorker) are
// also written to localStorage via settings-store.

import { saveSettings } from '../settings-store.js';
import { updateBgAnimVisibility } from './appearance.js';

const PERSISTED = new Set(['autoRender', 'uiSounds', 'bgAnim', 'bgEffects', 'renderDebug', 'legacyMath', 'useWorker']);

export function initChecks(state, onChange) {
  document.querySelectorAll('.check[data-flag]').forEach(el => {
    const flag = el.dataset.flag;
    // Initialise visual state from current value
    if (state[flag]) el.classList.add('on');
    else             el.classList.remove('on');

    el.addEventListener('click', () => {
      el.classList.toggle('on');
      state[flag] = el.classList.contains('on');

      if (flag === 'bgAnim') updateBgAnimVisibility(state);
      if (PERSISTED.has(flag)) saveSettings({ [flag]: state[flag] });
      if (onChange) onChange(flag);
    });
  });
}

/** Sync a single flag's DOM check from state. */
export function syncCheck(flag, on) {
  document.querySelectorAll(`.check[data-flag="${flag}"]`).forEach(el => {
    el.classList.toggle('on', !!on);
  });
}
