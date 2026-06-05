// ── Application entry point ────────────────────────────────────────────────
//
// Wires together the UI modules. All complex behaviour lives in the
// per-feature modules under js/ui/* and js/*.js so this file stays small
// and easy to read end-to-end.

import { state, PROFILES } from './config.js';
import { renderImage } from './render-client.js';
import { hydrateState, saveSettings } from './settings-store.js';

import { initErrorPopup, showError } from './ui/error.js?v=2';
import { initAudio, playClickSound, playToggleSound } from './ui/audio.js';
import { initZoom, dragState } from './ui/zoom.js';
import { registerSlider, wireSlider, syncAllFromState } from './ui/sliders.js';
import { wireSegmented } from './ui/segments.js';
import { loadProjectHistory } from './ui/history.js';
import { initSecurityUI } from './ui/security.js';
import { wireSwatches, wireCustomInk, wireCustomPaper } from './ui/swatches.js';
import { initChecks } from './ui/checks.js';
import { initWearLayers } from './ui/wear.js';
import { initUpload } from './ui/upload.js';
import { initPresets, renderPresetList } from './ui/presets.js';
import { initAppearance } from './ui/appearance.js';
import { initChangelog, hasUnreadUpdates } from './ui/changelog.js?v=2';
import { showWarning } from './ui/toast.js';
import { api } from './api.js?v=14';
import { initAdminUI } from './ui/admin.js';
import { initAccount } from './ui/account.js';
import { queueSaveProject, initSyncManager } from './sync.js';
import { captureCurrentPreset, applyPreset } from './ui/presets.js';

// Record boot time so the splash stays visible for at least 1500 ms
const _bootAt = Date.now();

// ── Authentication Check ───────────────────────────────────────────────────

// Verify session before initializing the app. If unauthorized, api.js will redirect to /login.
export let currentUser = null;
let currentPermissions = [];
try {
  const data = await api.auth.me();
  currentUser = data.user;
  currentPermissions = data.permissions || [];
} catch {
  // Redirect to login on any auth failure (api.js handles 401, this covers network/other errors)
  window.location.href = '/login';
  await new Promise(() => {});
}

// ── Bootstrap ──────────────────────────────────────────────────────────────

const persisted = await hydrateState(state);
initErrorPopup();
initAudio();
initZoom();
initSyncManager(currentUser?.id);
await initAdminUI(currentPermissions, currentUser);
initAccount(currentUser);
initSecurityUI();

// Initialize a session-based project if none exists (Auto-Save Phase F)
if (!state.currentProjectId) {
  state.currentProjectId = 'session_' + Date.now();
}

/* initTabs wurde aus dem gelöschten theme.js hierher migriert */
function initTabs() {
  const btns = document.querySelectorAll('.activity-bar .icon-btn[data-tab]');
  const ACTIVE_TAB_KEY = 'dm_active_tab';

  function activateTab(targetId) {
    document.querySelectorAll('.activity-bar .icon-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((tc) => tc.classList.remove('active'));
    const btn = [...btns].find((b) => b.dataset.tab === targetId) || btns[0];
    if (!btn) return;
    btn.classList.add('active');
    const tab = document.getElementById(btn.dataset.tab);
    if (tab) tab.classList.add('active');
  }

  // Restore last active tab or fall back to first
  const saved = sessionStorage.getItem(ACTIVE_TAB_KEY);
  const savedExists = saved && document.getElementById(saved);
  activateTab(savedExists ? saved : btns[0]?.dataset.tab);

  btns.forEach((btn) => {
    btn.addEventListener('click', () => {
      activateTab(btn.dataset.tab);
      sessionStorage.setItem(ACTIVE_TAB_KEY, btn.dataset.tab);

      // Preset-Liste beim Öffnen des Preset-Tabs aktualisieren
      if (btn.dataset.tab === 'tab-presets') {
        renderPresetList();
      }
      // Verlauf beim Öffnen laden
      if (btn.dataset.tab === 'tab-history' && state.currentProjectId) {
        loadProjectHistory(state.currentProjectId);
      }
    });
  });
}
initTabs();

// ── Touch-scroll guard (mobile) ────────────────────────────────────────────
// Removed: passive: false + preventDefault() broke native scrolling on iOS.
// CSS overscroll-behavior: contain on scrollable elements is sufficient.

// ── Render orchestration ───────────────────────────────────────────────────

const outCanvas = document.getElementById('outCanvas');
const renderBtn = document.getElementById('renderBtn');
const downloadBtn = document.getElementById('downloadBtn');
const statusEl = document.getElementById('status');

let lastRenderedBlob = null;
let isRendering = false;

function setStatus(text, working = false) {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.style.color = working ? 'var(--ink)' : 'var(--accent)';
}

export const triggerUpdate = (() => {
  let t;
  let s;
  return () => {
    // 1. Debounced Render
    clearTimeout(t);
    t = setTimeout(() => {
      if (state.autoRender) performRender();
    }, 300);

    // 2. Debounced Auto-Save (Phase F)
    if (state.currentProjectId) {
      clearTimeout(s);
      s = setTimeout(async () => {
        state.syncStatus = 'saving';
        _updateSyncUI();
        try {
          const content = captureCurrentPreset();
          await queueSaveProject(state.currentProjectId, state.currentProjectVersion, content);
          state.syncStatus = 'synced';
        } catch {
          state.syncStatus = 'error';
        } finally {
          _updateSyncUI();
        }
      }, 2000);
    }
  };
})();

function _updateSyncUI() {
  const el = document.getElementById('status');
  if (!el) return;
  // Visual hint in status bar about saving state
  if (state.syncStatus === 'saving') {
    el.classList.add('saving');
  } else {
    el.classList.remove('saving');
  }
}

function _drawRenderDebug(ctx, width, height) {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(8, 8, 280, 110);
  ctx.strokeStyle = '#00ff41';
  ctx.lineWidth = 1;
  ctx.strokeRect(8, 8, 280, 110);
  const terminalFont = state._terminalFontStack || 'monospace';
  ctx.font = `11px ${terminalFont}`;
  ctx.fillStyle = '#00ff41';
  const p = PROFILES[state.profile];
  const lines = [
    `Profile: ${p?.label || state.profile}`,
    `Size: ${width}x${height}`,
    `DPI: ${state.dpi}  Dither: ${state.dither}`,
    `Gamma: ${state.gamma}  Bright: ${state.brightness}`,
    `Contrast: ${state.contrast}  Jitter: ${state.jitterScale}`,
    `Wear: ${state.wearLayers.length} layers`,
  ];
  lines.forEach((line, i) => {
    ctx.fillText(line, 16, 28 + i * 14);
  });
}

async function performRender() {
  if (!state.sourceImage || isRendering) return;
  isRendering = true;
  if (renderBtn) renderBtn.disabled = true;
  setStatus('Rendern...', true);

  try {
    const { imageData, width, height } = await renderImage(state.sourceImage, (msg) =>
      setStatus(msg, true)
    );

    if (outCanvas) {
      outCanvas.width = width;
      outCanvas.height = height;
      const ctx = outCanvas.getContext('2d');
      ctx.putImageData(imageData, 0, 0);

      if (state.renderDebug) {
        _drawRenderDebug(ctx, width, height);
      }

      outCanvas.toBlob((blob) => {
        lastRenderedBlob = blob;
        if (downloadBtn) downloadBtn.disabled = false;
      }, 'image/png');
    }
    setStatus(`${width}×${height} px ready`);
  } catch (e) {
    console.error('[Render Engine]', e);
    showError('Fehler beim Rendern. Bitte ein anderes Preset oder Bild versuchen.');
    setStatus('Render Error');
  } finally {
    isRendering = false;
    if (renderBtn) renderBtn.disabled = false;
  }
}

// ── Slider registry ────────────────────────────────────────────────────────

registerSlider({ sliderId: 'thresholdSlider', valueId: 'thresholdVal', stateKey: 'threshold' });
registerSlider({ sliderId: 'brightnessSlider', valueId: 'brightnessVal', stateKey: 'brightness' });
registerSlider({ sliderId: 'contrastSlider', valueId: 'contrastVal', stateKey: 'contrast' });
registerSlider({
  sliderId: 'gammaSlider',
  valueId: 'gammaVal',
  stateKey: 'gamma',
  format: (v) => (+v).toFixed(1),
});
registerSlider({ sliderId: 'dpiSlider', valueId: 'dpiVal', stateKey: 'dpi' });
registerSlider({
  sliderId: 'jitterSlider',
  valueId: 'jitterVal',
  stateKey: 'jitterScale',
  transform: (v) => +v / 10,
  inverse: (v) => v * 10,
  format: (v) => (+v).toFixed(1),
});
registerSlider({
  sliderId: 'bandingSlider',
  valueId: 'bandingVal',
  stateKey: 'bandingScale',
  transform: (v) => +v / 10,
  inverse: (v) => v * 10,
  format: (v) => (+v).toFixed(1),
});
registerSlider({ sliderId: 'maxSizeSlider', valueId: 'maxSizeVal', stateKey: 'maxSize' });
registerSlider({ sliderId: 'seedSlider', valueId: 'seedVal', stateKey: 'seed' });

for (const key of [
  'threshold',
  'brightness',
  'contrast',
  'gamma',
  'dpi',
  'jitterScale',
  'bandingScale',
  'maxSize',
  'seed',
]) {
  wireSlider(state, key, () => triggerUpdate());
}

// ── Segmented buttons ──────────────────────────────────────────────────────

wireSegmented('ditherBtns', state, 'dither', 'dither', () => {
  const tf = document.getElementById('thresholdField');
  if (tf) tf.style.display = state.dither === 'threshold' ? 'block' : 'none';
  triggerUpdate();
});
wireSegmented('paperFormatBtns', state, 'paperFormat', 'format', triggerUpdate);
wireSegmented('orientationBtns', state, 'orientation', 'orient', triggerUpdate);

// ── Swatches ───────────────────────────────────────────────────────────────

wireSwatches('inkSwatches', state, 'ink', 'ink', triggerUpdate);
wireSwatches('paperSwatches', state, 'paper', 'paper', triggerUpdate);
wireCustomInk(state, triggerUpdate);
wireCustomPaper(state, triggerUpdate);

// ── Sidebar collapse toggle (A10) ──────────────────────────────────────────

const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
const sidebarEl = document.querySelector('.sidebar');
if (sidebarToggleBtn && sidebarEl) {
  sidebarToggleBtn.addEventListener('click', () => {
    sidebarEl.classList.toggle('collapsed');
    sidebarToggleBtn.classList.toggle('collapsed', sidebarEl.classList.contains('collapsed'));
  });
}

// ── Profile list ───────────────────────────────────────────────────────────

function updateProfileMeta() {
  const p = PROFILES[state.profile];
  const pm = document.getElementById('profileMeta');
  if (p && pm) pm.textContent = `${p.pins}-pin · ${p.dpi_h}×${p.dpi_v} dpi`;
}

const profileList = document.getElementById('profileList');
if (profileList) {
  profileList.addEventListener('click', (e) => {
    const item = e.target.closest('.sli');
    if (!item) return;
    document.querySelectorAll('#profileList .sli').forEach((s) => s.classList.remove('active'));
    item.classList.add('active');
    state.profile = item.dataset.profile;
    updateProfileMeta();
    triggerUpdate();
  });
}

// ── Boolean checks (uiSounds, autoRender, useWorker, …) ────────

initChecks(state, (flag) => {
  if (flag === 'invert' || flag === 'softBlur' || flag === 'doubleStrike' || flag === 'condensed') {
    triggerUpdate();
  }
});

// ── Wear-layer UI ──────────────────────────────────────────────────────────

initWearLayers(state, triggerUpdate);

// ── Upload + presets ───────────────────────────────────────────────────────

initUpload(state, {
  setStatus,
  onLoad: () => {
    syncAllFromState(state);
    updateProfileMeta();
    triggerUpdate();
  },
});

initPresets({
  onApply: () => {
    updateProfileMeta();
    triggerUpdate();
  },
  onSetStatus: setStatus,
});

// ── Appearance (theme, fonts, animation) ─────────────────────────────────────

initAppearance(persisted);
await initChangelog();

// ── Custom event bridge (avoids circular imports) ──────────────────────────

document.addEventListener('dm:triggerRender', () => {
  triggerUpdate();
});

// ── Click sounds on every interactive element ─────────────────────────────

const INTERACTIVE_SELECTOR =
  'button, .icon-btn, .sli, .swatch, .check, .er-head, .dropzone, input[type="range"], .color-picker, .segmented button, select, .btn-sm, .changelog-close, .settings-search-clear, textarea, .zoom-controls button, .footer-right';

document.addEventListener('click', (e) => {
  if (!state.uiSounds) return;
  const el = e.target.closest(INTERACTIVE_SELECTOR);
  if (el) {
    // Toggle sounds for checkboxes
    if (el.classList.contains('check')) {
      const isOn = el.classList.contains('on');
      playToggleSound(!isOn);
    } else {
      playClickSound();
    }
  }
});

// ── Pointer-up: ripple effect ──────────────────────────────────────────────

document.addEventListener('pointerup', (e) => {
  if (dragState.hasDragged) return;
  if (['BUTTON', 'INPUT', 'SELECT'].includes(e.target.tagName)) return;

  const r = document.createElement('div');
  r.className = 'click-shockwave';
  r.style.left = e.clientX + 'px';
  r.style.top = e.clientY + 'px';
  document.body.appendChild(r);
  setTimeout(() => r.remove(), 600);
});

// ── Final wiring ───────────────────────────────────────────────────────────

if (renderBtn) renderBtn.addEventListener('click', performRender);
if (downloadBtn)
  downloadBtn.addEventListener('click', () => {
    if (!lastRenderedBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(lastRenderedBlob);
    a.download = `print_${Date.now()}.png`;
    a.click();
  });

await renderPresetList();
updateProfileMeta();
syncAllFromState(state);

// ── App Splash ausblenden (min. 1500 ms sichtbar) ─────────────────────────

const _splash = document.getElementById('appSplash');
if (_splash) {
  const _splashDelay = Math.max(0, 1500 - (Date.now() - _bootAt));
  setTimeout(() => {
    _splash.classList.add('hidden');
    _splash.addEventListener('transitionend', () => _splash.remove(), { once: true });
  }, _splashDelay);
}

// ── User session display & logout ─────────────────────────────────────────

function _initUserSession(user) {
  const nameEl = document.getElementById('sessionUsername');
  const timeEl = document.getElementById('sessionTime');
  const btn = document.getElementById('logoutBtn');

  if (nameEl) nameEl.textContent = user.username;

  let loginAt = parseInt(sessionStorage.getItem('dm_login_at') || '0', 10);
  if (!loginAt) {
    loginAt = Date.now();
    sessionStorage.setItem('dm_login_at', String(loginAt));
  }

  // Initial render only — idle timer owns the live updates every 5s
  function _tick() {
    if (!timeEl) return;
    const mins = Math.floor((Date.now() - loginAt) / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    timeEl.textContent = h > 0 ? `· ${h}h ${m}m` : mins > 0 ? `· ${mins}m` : '· < 1m';
  }
  _tick();

  if (btn) {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = '…';
      try { await api.auth.logout(); } catch {}
      sessionStorage.removeItem('dm_login_at');
      window.location.href = '/login';
    });
  }
}
_initUserSession(currentUser);

// ── Online / Offline indicator (footer-right green dot) ───────────────────

function _updateOnlineDot() {
  const dot = document.getElementById('onlineDot');
  if (!dot) return;
  const online = navigator.onLine;
  dot.classList.toggle('offline', !online);
  dot.title = online ? 'Online' : 'Offline';
}
window.addEventListener('online', _updateOnlineDot);
window.addEventListener('offline', _updateOnlineDot);
_updateOnlineDot();

// ══════════════════════════════════════════════════════════════════════════════
// V1.6 Feature additions
// ══════════════════════════════════════════════════════════════════════════════

// ── A5: Set initials on avatar ─────────────────────────────────────────────
(function _initAvatar() {
  const avatar = document.getElementById('acAvatar');
  if (!avatar || !currentUser) return;
  const name = currentUser.username || currentUser.email || '?';
  const initials = name.substring(0, 2).toUpperCase();
  avatar.setAttribute('data-initials', initials);
})();

// ── A9/A8: Pulse dot only when update NOT seen at welcome screen ─────────────
(function _initUpdateDot() {
  const dot = document.getElementById('onlineDot');
  if (!dot) return;
  const hasUpdates = hasUnreadUpdates();
  const shownInWelcome = sessionStorage.getItem('dm_welcome_shown') === '1';
  dot.classList.toggle('has-updates', hasUpdates && !shownInWelcome);
})();

// ── A16: Show filename/project name in footer ─────────────────────────────
export function setFooterFilename(name) {
  const el = document.getElementById('footerFilename');
  const div = document.getElementById('footerFilenameDivider');
  if (!el || !div) return;
  if (name) {
    const maxLen = 28;
    el.textContent = name.length > maxLen ? name.substring(0, maxLen) + '…' : name;
    el.style.display = 'inline';
    div.style.display = 'inline';
  } else {
    el.style.display = 'none';
    div.style.display = 'none';
  }
}

// Listen for upload to set filename in footer
document.addEventListener('dm:imageLoaded', (e) => {
  if (e.detail?.name) setFooterFilename(e.detail.name);
});

// ── A10: Floating actions collapse toggle ───────────────────────────────────
(function _initFloatingCollapse() {
  const btn = document.getElementById('floatingActionsToggle');
  const box = document.getElementById('floatingActions');
  if (!btn || !box) return;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const collapsed = box.classList.toggle('actions-collapsed');
    btn.classList.toggle('collapsed', collapsed);
  });
})();

// ── A11: Footer collapse toggle ──────────────────────────────────────────────
(function _initFooterCollapse() {
  const btn = document.getElementById('footerCollapseBtn');
  const footer = document.getElementById('appFooter');
  if (!btn || !footer) return;
  let collapsed = false;
  btn.addEventListener('click', () => {
    collapsed = !collapsed;
    footer.classList.toggle('footer-collapsed', collapsed);
    btn.textContent = collapsed ? '▲' : '▼';
    btn.title = collapsed ? 'Fußzeile aufklappen' : 'Fußzeile einklappen';
  });
})();

// ── A32: Toolbar render debug button ────────────────────────────────────────
(function _initToolbarRenderDebug() {
  const btn = document.getElementById('toolbarRenderDebug');
  if (!btn) return;
  function _syncBtn() {
    btn.classList.toggle('active', !!state.renderDebug);
  }
  _syncBtn();
  btn.addEventListener('click', () => {
    state.renderDebug = !state.renderDebug;
    _syncBtn();
    saveSettings({ renderDebug: state.renderDebug });
    // Sync the hidden checkbox in settings too
    const check = document.querySelector('.check[data-flag="renderDebug"]');
    if (check) check.classList.toggle('on', state.renderDebug);
    if (state.sourceImage && state.autoRender) {
      document.dispatchEvent(new CustomEvent('dm:triggerRender'));
    }
  });
})();

// ── Settings accordion: only one group open at a time ──────────────────────
(function _initSettingsAccordion() {
  const groups = document.querySelectorAll('#tab-system .settings-group');
  groups.forEach((group) => {
    group.addEventListener('toggle', () => {
      if (group.open) {
        groups.forEach((other) => {
          if (other !== group && other.open) other.removeAttribute('open');
        });
      }
    });
  });
})();

// ── A20: Author Easter Egg ──────────────────────────────────────────────────
(function _initEasterEgg() {
  const authorEl = document.getElementById('authorName');
  if (!authorEl) return;

  let clicks = 0;
  let holdTimer = null;
  let holdActive = false;
  let clickTimer = null;

  authorEl.addEventListener('click', () => {
    clicks++;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => { clicks = 0; }, 1500);

    if (clicks >= 3) {
      authorEl.closest('.splash-author')?.classList.add('easter-egg-active');
    }
  });

  authorEl.addEventListener('pointerdown', () => {
    if (clicks < 3) return;
    holdTimer = setTimeout(() => {
      holdActive = true;
      _showEasterEgg();
    }, 3000);
  });

  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => {
    authorEl.addEventListener(ev, () => {
      clearTimeout(holdTimer);
      if (!holdActive) {
        authorEl.closest('.splash-author')?.classList.remove('easter-egg-active');
      }
    });
  });

  function _showEasterEgg() {
    const toast = document.getElementById('easterEggToast');
    if (!toast) return;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
      authorEl.closest('.splash-author')?.classList.remove('easter-egg-active');
      clicks = 0;
      holdActive = false;
    }, 4000);
  }
})();

// ── Welcome Overlay (show after login/register) ─────────────────────────────
(function _initWelcomeOverlay() {
  const justLoggedIn = sessionStorage.getItem('dm_just_logged_in') === '1';
  if (!justLoggedIn) return;
  sessionStorage.removeItem('dm_just_logged_in');

  _showWelcome(hasUnreadUpdates());
  // Mark update as seen since it's shown in welcome
  sessionStorage.setItem('dm_welcome_shown', '1');
  // Refresh pulse dot
  const dot = document.getElementById('onlineDot');
  if (dot) dot.classList.remove('has-updates');

  function _showWelcome(showChangelog) {
    const overlay = document.getElementById('welcomeOverlay');
    const body = document.getElementById('welcomeBody');
    const appLayout = document.querySelector('.app-layout');
    if (!overlay || !body) return;

    const username = currentUser?.username || 'Nutzer';

    body.innerHTML = `
      <div class="welcome-greeting">Willkommen zurück, <span>${_escHtml(username)}</span>! 👋</div>
      <div class="welcome-text">
        DotMatrix Studio ist dein kreativer Workspace für Dot-Matrix-Druck-Simulationen.
        Lade ein Bild hoch, wähle dein Druckerprofil und erlebe die Ästhetik klassischer Nadeldrucker.
      </div>
      <div class="welcome-divider"></div>
      ${showChangelog ? `
      <div>
        <div class="welcome-section-title">🔔 Letztes Update</div>
        <details style="border:1px solid var(--dm-border-base);border-radius:10px;overflow:hidden;">
          <summary style="padding:8px 12px;cursor:pointer;font-size:11px;color:var(--dm-text-base);list-style:none;user-select:none;">
            ▶ Changelog anzeigen
          </summary>
          <div id="welcomeChangelogInline" style="padding:10px 12px;font-size:11px;color:var(--dm-text-weak);line-height:1.5;">
            Lade...
          </div>
        </details>
      </div>
      <div class="welcome-divider"></div>
      ` : ''}
      <div>
        <div class="welcome-section-title">📖 Schnellstart</div>
        <div class="welcome-guide">
          <div class="welcome-guide-item">
            <div class="welcome-guide-num">1</div>
            <div class="welcome-guide-text"><b>Bild hochladen</b> — Klicke auf „Bild auswählen" oder ziehe eine Datei in den Upload-Bereich.</div>
          </div>
          <div class="welcome-guide-item">
            <div class="welcome-guide-num">2</div>
            <div class="welcome-guide-text"><b>Druckerprofil wählen</b> — Wähle einen Nadeldrucker (9-PIN, 24-PIN, 7-PIN) der das Rendering beeinflusst.</div>
          </div>
          <div class="welcome-guide-item">
            <div class="welcome-guide-num">3</div>
            <div class="welcome-guide-text"><b>Einstellungen anpassen</b> — Passe Helligkeit, Kontrast, Halftone-Algorithmus und weitere Parameter an.</div>
          </div>
          <div class="welcome-guide-item">
            <div class="welcome-guide-num">4</div>
            <div class="welcome-guide-text"><b>Rendern & Speichern</b> — Klicke „Rendern" und lade das fertige Bild als PNG herunter.</div>
          </div>
        </div>
      </div>
    `;

    // Open overlay
    overlay.classList.add('open');
    overlay.removeAttribute('aria-hidden');
    if (appLayout) appLayout.classList.add('overlay-open');

    // Load changelog content inline if needed
    if (showChangelog) {
      const base = window.location.pathname.replace(/[^/]*$/, '');
      fetch(`${base}version.json`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((data) => {
          const inlineEl = document.getElementById('welcomeChangelogInline');
          if (!inlineEl || !data?.changelog?.length) return;
          const latest = data.changelog[0];
          const items = (latest?.highlights || []).slice(0, 5).map((c) =>
            `<div style="margin:3px 0;padding-left:8px;border-left:2px solid var(--dm-primary);">
              ${_escHtml(String(c))}
            </div>`
          ).join('');
          inlineEl.innerHTML = `<b style="color:var(--dm-primary);">${_escHtml(latest?.version || '')}</b> — ${_escHtml(latest?.summary || '')}<br/>${items}`;
        })
        .catch(() => {});
    }

    // Start countdown
    let countdown = 15;
    const counter = document.getElementById('welcomeCounter');
    if (counter) counter.textContent = countdown;
    const tick = setInterval(() => {
      countdown--;
      if (counter) counter.textContent = countdown;
      if (countdown <= 0) {
        clearInterval(tick);
        _closeWelcome();
      }
    }, 1000);

    // Wire close
    function _closeWelcome() {
      clearInterval(tick);
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
      if (appLayout) appLayout.classList.remove('overlay-open');
    }

    document.getElementById('welcomeClose')?.addEventListener('click', _closeWelcome, { once: true });
    document.getElementById('welcomeBackdrop')?.addEventListener('click', _closeWelcome, { once: true });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') _closeWelcome();
    }, { once: true });
  }

  function _escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
})();

// ── B2: Inactivity timer ─────────────────────────────────────────────────────
(function _initIdleTimer() {
  const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  const WARN_INTERVALS = [10 * 60 * 1000, 5 * 60 * 1000, 60 * 1000]; // 10m, 5m, 1m
  const DIALOG_TRIGGER = 10 * 1000; // show "Bist du noch da?" at 10s remaining

  let _loginAt = parseInt(sessionStorage.getItem('dm_login_at') || '0', 10);
  if (!_loginAt) { _loginAt = Date.now(); sessionStorage.setItem('dm_login_at', String(_loginAt)); }

  let _deadline = _loginAt + TIMEOUT_MS;
  let _warnedAt = new Set();
  let _dialogOpen = false;
  let _dialogTimer = null;
  let _dialogInterval = null;
  let _checkInterval;

  function _reset() {
    _deadline = Date.now() + TIMEOUT_MS;
    _warnedAt.clear();
    _dialogOpen = false;
    clearInterval(_dialogTimer);
    clearInterval(_dialogInterval);
    const overlay = document.getElementById('idleOverlay');
    if (overlay) {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
    }
    _updateTimeoutDisplay();
  }

  function _updateTimeoutDisplay() {
    const timeEl = document.getElementById('sessionTime');
    if (!timeEl) return;
    const now = Date.now();
    const loginAt = parseInt(sessionStorage.getItem('dm_login_at') || '0', 10);
    const sesMins = loginAt ? Math.floor((now - loginAt) / 60000) : 0;
    const sesH = Math.floor(sesMins / 60), sesM = sesMins % 60;
    const sesText = sesH > 0 ? `${sesH}h ${sesM}m` : sesMins > 0 ? `${sesMins}m` : '< 1m';
    const remMs = _deadline - now;
    const remMins = Math.max(0, Math.ceil(remMs / 60000));
    const timeoutText = remMins > 0 ? `Timeout in ${remMins}m` : 'Timeout bald';
    timeEl.textContent = `· ${sesText} | ${timeoutText}`;
  }

  function _showIdleDialog() {
    if (_dialogOpen) return;
    _dialogOpen = true;
    const overlay = document.getElementById('idleOverlay');
    const bar = document.getElementById('idleProgressBar');
    const countdown = document.getElementById('idleCountdown');
    if (!overlay) return;
    overlay.classList.add('open');
    overlay.removeAttribute('aria-hidden');

    let secs = 10;
    if (countdown) countdown.textContent = secs;
    if (bar) {
      bar.style.transition = 'none';
      bar.style.width = '100%';
      requestAnimationFrame(() => {
        bar.style.transition = `width ${secs}s linear`;
        bar.style.width = '0%';
      });
    }

    _dialogInterval = setInterval(() => {
      secs--;
      if (countdown) countdown.textContent = secs;
      if (secs <= 0) {
        clearInterval(_dialogInterval);
        clearInterval(_checkInterval);
        _logout();
      }
    }, 1000);
  }

  async function _logout() {
    try { await api.auth.logout(); } catch {}
    sessionStorage.removeItem('dm_login_at');
    window.location.href = '/login';
  }

  // Wire dialog buttons
  document.getElementById('idleStayBtn')?.addEventListener('click', () => {
    clearInterval(_dialogInterval);
    _reset();
  });
  document.getElementById('idleLogoutBtn')?.addEventListener('click', _logout);

  // Activity resets deadline (only resets within 25min mark to avoid gaming)
  ['mousemove', 'keydown', 'click', 'touchstart'].forEach((ev) => {
    document.addEventListener(ev, () => {
      if (_dialogOpen) return; // don't reset while dialog is open
      const remaining = _deadline - Date.now();
      if (remaining < TIMEOUT_MS - 10000) _deadline = Date.now() + TIMEOUT_MS;
    }, { passive: true });
  });

  // Main check loop
  _checkInterval = setInterval(() => {
    const now = Date.now();
    const remaining = _deadline - now;

    _updateTimeoutDisplay();

    // Show toasts at warning intervals
    for (const interval of WARN_INTERVALS) {
      const key = Math.floor(interval / 1000);
      if (!_warnedAt.has(key) && remaining <= interval && remaining > interval - 65000) {
        _warnedAt.add(key);
        const mins = Math.round(interval / 60000);
        showWarning(`Sitzung läuft in ${mins} Minute${mins > 1 ? 'n' : ''} ab. Aktiv bleiben zum Verlängern.`, 8000);
      }
    }

    // Show idle dialog at 10s remaining
    if (!_dialogOpen && remaining <= DIALOG_TRIGGER && remaining > 0) {
      _showIdleDialog();
    }

    // Auto-logout if past deadline
    if (remaining <= 0 && !_dialogOpen) {
      clearInterval(_checkInterval);
      _logout();
    }
  }, 5000);

  _updateTimeoutDisplay();
})();

