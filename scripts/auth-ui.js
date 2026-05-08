import { api, APIError } from './api.js?v=14';
import { showError } from './ui/toast.js';

// Bereits eingeloggt? Direkt zur App weiterleiten (ohne Browser-History-Eintrag)
(async () => {
  try {
    await api.auth.me();
    const base = window.location.pathname.replace(/[^/]*$/, '');
    window.location.replace(`${base}index.html`);
  } catch {
    // Nicht authentifiziert – Formular normal anzeigen
  }
})();

const loginForm    = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const submitBtn    = document.getElementById('submitBtn');

function setLoading(isLoading) {
  if (!submitBtn) return;
  submitBtn.disabled = isLoading;
  const label = loginForm ? 'Anmelden' : 'Registrieren';
  submitBtn.innerHTML = isLoading
    ? `<span class="btn-spinner"></span>${label}`
    : label;
}

function showRedirectSplash() {
  const splash = document.getElementById('authSplash');
  if (!splash) return;
  splash.style.cssText = '';
  splash.removeAttribute('aria-hidden');
}

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(loginForm);
    try {
      await api.auth.login(fd.get('username'), fd.get('password'));
      const base = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
      sessionStorage.setItem('dm_login_at', String(Date.now()));
      showRedirectSplash();
      window.location.href = `${base}index.html`;
    } catch (err) {
      showError(err instanceof APIError ? err.message : 'Ein Netzwerkfehler ist aufgetreten.');
      setLoading(false);
    }
  });
}

if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(registerForm);
    try {
      await api.auth.register(
        fd.get('inviteCode'),
        fd.get('username'),
        fd.get('password'),
        fd.get('email') || undefined
      );
      const base = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
      sessionStorage.setItem('dm_login_at', String(Date.now()));
      showRedirectSplash();
      window.location.href = `${base}index.html`;
    } catch (err) {
      showError(err instanceof APIError ? err.message : 'Ein Netzwerkfehler ist aufgetreten.');
      setLoading(false);
    }
  });
}
