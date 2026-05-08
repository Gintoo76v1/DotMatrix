// ── Global error handler ────────────────────────────────────────────────────
// Routes uncaught exceptions and unhandled promise rejections to the toast
// notification system so all runtime errors surface consistently.

import { showError, showWarning } from './toast.js';

export { showError, showWarning };

export function initErrorPopup() {
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