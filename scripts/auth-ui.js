import { api, APIError } from './api.js?v=14';

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

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const errorMsg = document.getElementById('errorMsg');
const submitBtn = document.getElementById('submitBtn');

function showError(msg) {
  if (errorMsg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
  }
}

function clearError() {
  if (errorMsg) {
    errorMsg.textContent = '';
    errorMsg.style.display = 'none';
  }
}

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
    clearError();
    setLoading(true);

    const formData = new FormData(loginForm);
    const usernameOrEmail = formData.get('username');
    const password = formData.get('password');

    try {
      await api.auth.login(usernameOrEmail, password);
      const baseUrl = window.location.pathname.substring(
        0,
        window.location.pathname.lastIndexOf('/') + 1
      );
      showRedirectSplash();
      window.location.href = `${baseUrl}index.html`;
    } catch (error) {
      if (error instanceof APIError) {
        showError(error.message);
      } else {
        showError('Ein Netzwerkfehler ist aufgetreten.');
      }
      setLoading(false);
    }
  });
}

if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();
    setLoading(true);

    const formData = new FormData(registerForm);
    const inviteCode = formData.get('inviteCode');
    const username = formData.get('username');
    const password = formData.get('password');
    const email = formData.get('email') || undefined; // Optional

    try {
      await api.auth.register(inviteCode, username, password, email);
      const baseUrl = window.location.pathname.substring(
        0,
        window.location.pathname.lastIndexOf('/') + 1
      );
      showRedirectSplash();
      window.location.href = `${baseUrl}index.html`;
    } catch (error) {
      if (error instanceof APIError) {
        showError(error.message);
      } else {
        showError('Ein Netzwerkfehler ist aufgetreten.');
      }
      setLoading(false);
    }
  });
}
