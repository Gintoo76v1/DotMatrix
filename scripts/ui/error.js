// ── Toast-style error popup ────────────────────────────────────────────────
// All non-fatal errors flow through showError() so the user sees a single,
// consistent UI element.  Falls back to console.error if the popup elements
// are missing from the DOM.

let popupEl = null;
let textEl = null;
let hideTimer = null;

export function initErrorPopup() {
  popupEl = document.getElementById('errorPopup');
  textEl = document.getElementById('errorText');
  const closeBtn = document.getElementById('errorCloseBtn');
  if (closeBtn && popupEl) {
    closeBtn.addEventListener('click', () => popupEl.classList.remove('show'));
  }

  // Global capture — uncaught exceptions and unhandled rejections.
  window.addEventListener('error', (ev) => {
    showError(`[JS Fehler]: ${ev.message} (Zeile ${ev.lineno || '?'})`);
  });
  window.addEventListener('unhandledrejection', (ev) => {
    showError(`[Promise Fehler]: ${ev.reason}`);
  });
}

export function showError(msg) {
  if (popupEl && textEl) {
    textEl.textContent = msg;
    popupEl.classList.add('show');
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => popupEl.classList.remove('show'), 7000);
  } else {
    console.error(msg);
  }
}
