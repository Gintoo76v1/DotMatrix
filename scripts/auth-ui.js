import { api, APIError } from './api.js';

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
  if (submitBtn) {
    submitBtn.disabled = isLoading;
    submitBtn.textContent = isLoading ? 'Bitte warten...' : loginForm ? 'Anmelden' : 'Registrieren';
  }
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
      // Redirect to main app on success. Use relative path.
      const baseUrl = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
      window.location.href = baseUrl;
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
      // Optional: Since our backend does auto-login (sets session cookie),
      // we can redirect directly to the app. Use relative path.
      const baseUrl = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
      window.location.href = baseUrl;
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
