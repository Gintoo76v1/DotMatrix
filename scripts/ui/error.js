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
    console.error('[Uncaught Error]', ev.error || ev.message);
    showError('Ein unerwarteter Fehler ist aufgetreten. Seite neu laden könnte helfen.');
  });
  window.addEventListener('unhandledrejection', (ev) => {
    console.error('[Unhandled Rejection]', ev.reason);
    const msg =
      ev.reason?.message && !ev.reason.message.match(/[A-Z][a-z]+Error|undefined|null/i)
        ? ev.reason.message
        : 'Ein unerwarteter Fehler ist aufgetreten.';
    showError(msg);
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
