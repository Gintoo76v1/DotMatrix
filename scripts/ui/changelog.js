// ── Changelog overlay controller ────────────────────────────────────────────
// Reads version.json, displays version history, tracks read/unread state,
// and manages the footer indicator.

import { state } from '../config.js';
import { saveSettings } from '../settings-store.js';

let versionData = null;
let isOpen = false;

/** Initialise — fetch version.json and wire UI. */
export async function initChangelog() {
  await _loadVersionData();
  _wireFooter();
  _wireOverlay();
  _updateFooter();
}

/** Check if current version is newer than lastSeenVersion. */
export function hasUnreadUpdates() {
  if (!versionData) return false;
  const last = state.lastSeenVersion || '';
  const current = versionData.current || '';
  return last && current && _versionCompare(last, current) < 0;
}

/** Mark current version as seen. */
export function markSeen() {
  if (!versionData) return;
  state.lastSeenVersion = versionData.current;
  saveSettings({ lastSeenVersion: state.lastSeenVersion });
  _updateFooter();
}

// ── Internal ────────────────────────────────────────────────────────────────

async function _loadVersionData() {
  try {
    const base = window.location.pathname.replace(/[^/]*$/, '');
    const res = await fetch(`${base}version.json`, { cache: 'no-store' });
    if (!res.ok) throw new Error(res.statusText);
    versionData = await res.json();
  } catch (e) {
    console.warn('[changelog] version.json nicht ladbar:', e.message);
    versionData = null;
  }
}

function _wireFooter() {
  const footer = document.getElementById('footerVersion');
  if (!footer) return;
  footer.addEventListener('click', openOverlay);
  footer.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') openOverlay();
  });
}

function _wireOverlay() {
  const overlay = document.getElementById('changelogOverlay');
  const closeBtn = document.getElementById('changelogClose');
  const backdrop = overlay?.querySelector('.changelog-backdrop');
  if (!overlay) return;

  closeBtn?.addEventListener('click', closeOverlay);
  backdrop?.addEventListener('click', closeOverlay);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) closeOverlay();
  });

  // Touch swipe-down to close — only from header/backdrop, never from scrollable body
  let startY = 0;
  let canSwipeClose = false;
  overlay.addEventListener(
    'touchstart',
    (e) => {
      startY = e.touches[0].clientY;
      // Allow swipe-to-close only if touch started on header or backdrop, not on scrollable body
      canSwipeClose = !!e.target.closest('.changelog-header, .changelog-backdrop');
    },
    { passive: true }
  );
  overlay.addEventListener('touchend', (e) => {
    if (!canSwipeClose) return;
    const dy = e.changedTouches[0].clientY - startY;
    if (dy > 80) closeOverlay();
  });
}

export function openOverlay() {
  const overlay = document.getElementById('changelogOverlay');
  const body = document.getElementById('changelogBody');
  if (!overlay || !body || !versionData) return;

  isOpen = true;
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  body.innerHTML = _renderBody();
  markSeen();
  document.documentElement.classList.add('changelog-open');
}

export function closeOverlay() {
  const overlay = document.getElementById('changelogOverlay');
  if (!overlay) return;
  isOpen = false;
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  document.documentElement.classList.remove('changelog-open');
}

function _updateFooter() {
  const versionText = document.getElementById('versionText');
  const badges = document.getElementById('updateBadges');
  const onlineDot = document.getElementById('onlineDot');

  if (versionText && versionData) {
    const ver = versionData.current;
    const commit = versionData.commit;
    versionText.textContent = commit ? `v${ver}-${commit}` : `v${ver}`;
  }

  if (badges && versionData?.changelog?.length > 0) {
    const latest = versionData.changelog[0];
    badges.innerHTML = (latest.tags || [])
      .slice(0, 2)
      .map((tag) => {
        const cls = `update-badge--${_tagClass(tag)}`;
        return `<span class="update-badge ${cls}">${_escape(tag)}</span>`;
      })
      .join('');
  }

  if (onlineDot) {
    onlineDot.classList.toggle('has-updates', hasUnreadUpdates());
  }
}

function _renderBody() {
  if (!versionData?.changelog?.length) {
    return '<p style="color:var(--dm-text-weak); text-align:center;">Keine Changelog-Daten verfügbar.</p>';
  }

  const entries = versionData.changelog;
  let html = '';

  // Current (newest)
  const current = entries[0];
  html += _renderEntry(current, true);

  // Divider
  if (entries.length > 1) {
    html += '<div class="changelog-divider"><span>Vorherige Versionen</span></div>';
  }

  // Older
  for (let i = 1; i < entries.length; i++) {
    html += _renderEntry(entries[i], false, true);
  }

  return html;
}

function _renderEntry(entry, isCurrent, collapsible = false) {
  const tagHtml = (entry.tags || [])
    .map((tag) => {
      return `<span class="tag tag--${_tagClass(tag)}">${_escape(tag)}</span>`;
    })
    .join('');

  const detailsHtml = (entry.highlights || entry.details || [])
    .map((h) => `<li>${_escape(h)}</li>`)
    .join('');

  const version = _escape(entry.version);
  const commit = entry.commit ? _escape(entry.commit) : null;
  const versionLabel = commit ? `v${version}<span style="font-size:9px;opacity:0.5;font-weight:400;margin-left:4px;">${commit}</span>` : `v${version}`;
  const inProgressBadge = (isCurrent && commit) ? `<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:rgb(255 165 0 / 15%);color:orange;font-weight:600;letter-spacing:0.05em;">IN BEARBEITUNG</span>` : '';
  const date = _escape(entry.date);
  const summary = _escape(entry.summary || '');

  if (collapsible) {
    return `
      <details class="changelog-entry">
        <summary>
          <span class="changelog-version">${versionLabel}</span>
          <span class="changelog-date">${date}</span>
          ${inProgressBadge}
        </summary>
        <div class="changelog-tags">${tagHtml}</div>
        <p class="changelog-summary">${summary}</p>
        <ul class="changelog-details">${detailsHtml}</ul>
      </details>
    `;
  }

  return `
    <div class="changelog-entry ${isCurrent ? 'changelog-entry--current' : ''}">
      <div class="changelog-meta">
        <span class="changelog-version">${versionLabel}</span>
        <span class="changelog-date">${date}</span>
        ${isCurrent && !commit ? '<span class="changelog-badge--new">NEU</span>' : ''}
        ${inProgressBadge}
      </div>
      <div class="changelog-tags">${tagHtml}</div>
      <p class="changelog-summary">${summary}</p>
      <ul class="changelog-details">${detailsHtml}</ul>
    </div>
  `;
}

function _tagClass(tag) {
  const t = (tag || '').toLowerCase();
  if (t.includes('ui') || t.includes('design')) return 'ui';
  if (t.includes('perf') || t.includes('speed')) return 'perf';
  if (t.includes('fix') || t.includes('bug')) return 'bugfix';
  if (t.includes('test')) return 'test';
  if (t.includes('refactor')) return 'refactor';
  return 'ui';
}

function _escape(s) {
  if (typeof s !== 'string') return String(s);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Semantic version compare: -1 = a<b, 0 = a==b, 1 = a>b */
function _versionCompare(a, b) {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0,
      nb = pb[i] || 0;
    if (na < nb) return -1;
    if (na > nb) return 1;
  }
  return 0;
}
