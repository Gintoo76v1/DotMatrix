// ── Account Settings Panel ───────────────────────────────────────────────────
// Opens as a small popup above the footer when the user clicks their name chip.

import { api, APIError } from '../api.js?v=14';
import { showSuccess, showError, showInfo } from './toast.js';

let _user = null;
let _isOpen = false;

export function initAccount(user) {
  _user = user;

  const chip = document.getElementById('userSessionChip');
  chip?.addEventListener('click', (e) => { e.stopPropagation(); togglePanel(); });

  document.getElementById('accountClose')?.addEventListener('click', closePanel);
  document.getElementById('acLogoutBtn')?.addEventListener('click', _handleLogout);
  document.getElementById('acPasswordBtn')?.addEventListener('click', _togglePasswordForm);
  document.getElementById('acPwSave')?.addEventListener('click', _handlePasswordChange);
  document.getElementById('acPwCancel')?.addEventListener('click', () => {
    _hidePasswordForm();
  });
  document.getElementById('ac2faBtn')?.addEventListener('click', _handle2FA);

  document.addEventListener('click', (e) => {
    if (_isOpen && !e.target.closest('#accountPanel') && !e.target.closest('#userSessionChip')) {
      closePanel();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _isOpen) closePanel();
  });
}

function togglePanel() {
  _isOpen ? closePanel() : openPanel();
}

export function openPanel() {
  const panel = document.getElementById('accountPanel');
  if (!panel) return;
  _isOpen = true;
  _refresh();
  panel.classList.add('open');
  panel.removeAttribute('aria-hidden');
}

export function closePanel() {
  const panel = document.getElementById('accountPanel');
  if (!panel) return;
  _isOpen = false;
  _hidePasswordForm();
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
}

function _refresh() {
  const usernameEl = document.getElementById('acUsername');
  const roleEl     = document.getElementById('acRole');
  const sessionEl  = document.getElementById('acSession');
  const tfaStatus  = document.getElementById('ac2faStatus');

  if (usernameEl && _user) usernameEl.textContent = _user.username;
  if (roleEl && _user) {
    roleEl.textContent = _user.role || 'user';
    roleEl.dataset.role = _user.role || 'user';
  }

  const loginAt = parseInt(sessionStorage.getItem('dm_login_at') || '0', 10);
  if (sessionEl && loginAt) {
    const mins = Math.floor((Date.now() - loginAt) / 60000);
    const h = Math.floor(mins / 60), m = mins % 60;
    sessionEl.textContent = h > 0 ? `${h}h ${m}m` : mins > 0 ? `${mins}m` : '< 1m';
  }

  if (tfaStatus && _user) {
    const on = _user.twoFactorEnabled;
    tfaStatus.textContent  = on ? '✓ Aktiv' : '○ Inaktiv';
    tfaStatus.style.color  = on ? 'var(--dm-success)' : 'var(--dm-text-weaker)';
  }
}

function _togglePasswordForm() {
  const form = document.getElementById('acPasswordForm');
  if (!form) return;
  const open = form.style.display !== 'none';
  form.style.display = open ? 'none' : 'flex';
  if (!open) document.getElementById('acCurPw')?.focus();
}

function _hidePasswordForm() {
  const form = document.getElementById('acPasswordForm');
  if (form) form.style.display = 'none';
  const cur = document.getElementById('acCurPw');
  const nxt = document.getElementById('acNewPw');
  if (cur) cur.value = '';
  if (nxt) nxt.value = '';
}

async function _handlePasswordChange() {
  const cur = document.getElementById('acCurPw')?.value?.trim();
  const nxt = document.getElementById('acNewPw')?.value?.trim();

  if (!cur || !nxt)     return showError('Bitte beide Felder ausfüllen.');
  if (nxt.length < 8)   return showError('Neues Passwort muss mindestens 8 Zeichen haben.');

  const btn = document.getElementById('acPwSave');
  if (btn) { btn.disabled = true; btn.textContent = '…'; }

  try {
    await api.auth.changePassword(cur, nxt);
    showSuccess('Passwort erfolgreich geändert.');
    _hidePasswordForm();
  } catch (err) {
    showError(err instanceof APIError ? err.message : 'Fehler beim Ändern des Passworts.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Speichern'; }
  }
}

function _handle2FA() {
  showInfo('2FA-Einrichtung ist in den Sicherheitseinstellungen verfügbar (bald verfügbar).');
}

async function _handleLogout() {
  const btn = document.getElementById('acLogoutBtn');
  if (btn) btn.disabled = true;
  try { await api.auth.logout(); } catch { /* ignore */ }
  sessionStorage.removeItem('dm_login_at');
  const base = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
  window.location.href = `${base}login.html`;
}
