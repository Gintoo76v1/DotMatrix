// ── Persisted UI settings ───────────────────────────────────────────────────
// Stores a small subset of the state object across sessions.
// Failures are silent — localStorage may be disabled (private mode etc.).

const KEY = 'dotmatrix_settings_v1';

const PERSIST_KEYS = [
  'autoRender', 'uiSounds', 'bgAnim',
  'legacyMath', 'useWorker',
  'language', 'theme', 'themeMode',
  'fontSans', 'fontSansCustom', 'fontMono', 'fontMonoCustom',
  'fontTerminal', 'fontTerminalCustom',
  'animPattern', 'animSpeed', 'animIntensity', 'animSize',
  'layout', 'navExpanded',
  'lastSeenVersion', 'autoCheckUpdates',
];

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return (obj && typeof obj === 'object') ? obj : {};
  } catch {
    return {};
  }
}

export function saveSettings(partial) {
  try {
    const current = loadSettings();
    const next = { ...current };
    for (const k of PERSIST_KEYS) {
      if (k in partial) next[k] = partial[k];
    }
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota or disabled — ignore */
  }
}

/** Apply persisted settings onto a state object in-place. */
export function hydrateState(state) {
  const s = loadSettings();
  for (const k of PERSIST_KEYS) {
    if (k in s) state[k] = s[k];
  }
  return s;
}
