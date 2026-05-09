// ── Universal Toast Notification System ─────────────────────────────────────
// Auto-injects its container into document.body on first use.
// Supports types: error, warning, info, success, debug
// Features: stacking, progress countdown bar, hover-pause, smooth animations.

const DURATIONS = { error: 8000, warning: 6000, info: 4000, success: 3500, debug: 5000 };
const ICONS     = { error: '⚠', warning: '⚡', info: 'ℹ', success: '✓', debug: '⬡' };
const MAX_VISIBLE = 3; // A30: max 3 toasts visible at once

let _container = null;

function _ensureContainer() {
  if (_container && _container.isConnected) return _container;
  _container = document.createElement('div');
  _container.className = 'toast-container';
  document.body.appendChild(_container);
  return _container;
}

// A30: Remove oldest toast if we exceed MAX_VISIBLE
function _enforceLimit(container) {
  const toasts = [...container.querySelectorAll('.toast--in')];
  if (toasts.length >= MAX_VISIBLE) {
    const oldest = toasts[0];
    oldest.classList.remove('toast--in');
    oldest.classList.add('toast--out');
    oldest.addEventListener('transitionend', () => oldest.remove(), { once: true });
    setTimeout(() => oldest.remove(), 400);
  }
}

function _escape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function showToast(msg, type = 'info', duration) {
  const container = _ensureContainer();
  const ms = duration ?? DURATIONS[type] ?? 5000;

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    <div class="toast-progress">
      <div class="toast-progress-bar" style="animation-duration:${ms}ms"></div>
    </div>
    <div class="toast-body">
      <span class="toast-icon" aria-hidden="true">${ICONS[type] || 'ℹ'}</span>
      <span class="toast-msg">${_escape(msg)}</span>
      <button class="toast-close" aria-label="Schließen" type="button">✕</button>
    </div>
  `;

  container.appendChild(toast);

  // A30: enforce max 3 visible toasts before showing the new one
  requestAnimationFrame(() => {
    _enforceLimit(container);
    requestAnimationFrame(() => toast.classList.add('toast--in'));
  });

  let timer;
  let _remaining = ms;
  let _startedAt = Date.now();
  const bar = toast.querySelector('.toast-progress-bar');

  function dismiss() {
    clearTimeout(timer);
    toast.classList.remove('toast--in');
    toast.classList.add('toast--out');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    setTimeout(() => toast.remove(), 500);
  }

  function startTimer(delay) {
    clearTimeout(timer);
    _remaining = delay;
    _startedAt = Date.now();
    timer = setTimeout(dismiss, delay);
  }

  toast.addEventListener('mouseenter', () => {
    clearTimeout(timer);
    _remaining = Math.max(0, _remaining - (Date.now() - _startedAt));
    bar.style.animationPlayState = 'paused';
  });
  toast.addEventListener('mouseleave', () => {
    bar.style.animationPlayState = 'running';
    startTimer(Math.max(800, _remaining));
  });

  toast.querySelector('.toast-close').addEventListener('click', dismiss);
  startTimer(ms);

  return { dismiss };
}

export const showError   = (msg, d) => showToast(msg, 'error', d);
export const showWarning = (msg, d) => showToast(msg, 'warning', d);
export const showInfo    = (msg, d) => showToast(msg, 'info', d);
export const showSuccess = (msg, d) => showToast(msg, 'success', d);
export const showDebug   = (msg, d) => showToast(msg, 'debug', d);
