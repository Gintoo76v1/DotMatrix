import { api } from './api.js';
import { queueSaveSettings } from './sync.js';

// ── Persisted UI settings ───────────────────────────────────────────────────
// Stores a small subset of the state object across sessions.
// Will try to fetch from server on load. If server is offline or fails, falls back to LocalStorage.
// LocalStorage is also used as a write-ahead log.

const KEY = 'dotmatrix_settings_v1';
const MIGRATED_KEY = 'dotmatrix_settings_migrated_v1';

const PERSIST_KEYS = [
  'autoRender',
  'uiSounds',
  'bgAnim',
  'useWorker',
  'language',
  'theme',
  'themeMode',
  'fontSans',
  'fontSansCustom',
  'fontMono',
  'fontMonoCustom',
  'fontTerminal',
  'fontTerminalCustom',
  'animPattern',
  'animSpeed',
  'animIntensity',
  'animSize',
  'layout',
  'navExpanded',
  'lastSeenVersion',
  'autoCheckUpdates',
  // Simulation parameters
  'profile',
  'dither',
  'threshold',
  'ink',
  'paper',
  'paperFormat',
  'orientation',
  'doubleStrike',
  'condensed',
  'brightness',
  'contrast',
  'gamma',
  'invert',
  'dpi',
  'jitterScale',
  'bandingScale',
  'maxSize',
  'wearLayers',
  'seed',
  'softBlur',
  'legacyMath',
];

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : {};
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
    // Enqueue the update to the server via Sync Manager
    queueSaveSettings(next).catch(console.error);
  } catch {
    /* quota or disabled — ignore */
  }
}

/** Apply persisted settings onto a state object in-place. */
export async function hydrateState(state) {
  // 1. Load local fallback
  let localSettings = loadSettings();

  // 2. Try to fetch settings from server
  let serverSettings = {};
  let serverFetchSuccess = false;
  try {
    const response = await api.settings.get();
    if (response && response.settings) {
      serverSettings = response.settings;
      serverFetchSuccess = true;
    }
  } catch (err) {
    console.warn('Failed to fetch settings from server, using local fallback', err);
  }

  // 3. Migrate local to server if needed
  if (serverFetchSuccess && Object.keys(localSettings).length > 0) {
    const isMigrated = localStorage.getItem(MIGRATED_KEY);
    if (!isMigrated) {
      // Local settings exist, but haven't been pushed to the server yet.
      // Merge local over server (local wins during initial migration)
      serverSettings = { ...serverSettings, ...localSettings };
      queueSaveSettings(serverSettings).catch(console.error);
      localStorage.setItem(MIGRATED_KEY, 'true');
    }
  }

  // 4. Determine final settings (server wins over local if successfully fetched)
  const finalSettings = serverFetchSuccess ? serverSettings : localSettings;

  // 5. Update state
  for (const k of PERSIST_KEYS) {
    if (k in finalSettings) state[k] = finalSettings[k];
  }

  // 6. Update local storage cache
  try {
    localStorage.setItem(KEY, JSON.stringify(finalSettings));
  } catch {
    // ignore
  }

  return finalSettings;
}
