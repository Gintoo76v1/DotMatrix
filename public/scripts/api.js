// ── API Client Layer ─────────────────────────────────────────────────────────

// Absolute path — the app is hosted at the domain root on Vercel.
const API_BASE = '/api/v1';

// German user-friendly messages for HTTP status codes
const STATUS_MESSAGES = {
  401: 'Falsche Anmeldedaten.',
  403: 'Keine Berechtigung für diese Aktion.',
  404: 'Inhalt nicht gefunden.',
  409: 'Bereits vorhanden.',
  429: 'Zu viele Versuche – bitte einen Moment warten.',
  500: 'Serverfehler – bitte später erneut versuchen.',
  502: 'Server nicht erreichbar.',
  503: 'Dienst vorübergehend nicht verfügbar.',
};

export class APIError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(endpoint, options = {}) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  const url = `${API_BASE}/${cleanEndpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const config = {
    ...options,
    headers,
    credentials: 'same-origin',
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, config);

    if (response.status === 401) {
      const onAuthPage =
        window.location.pathname === '/login' || window.location.pathname === '/register';
      if (!onAuthPage) {
        window.location.href = '/login';
      }
      throw new APIError(401, STATUS_MESSAGES[401]);
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      // For 400 (validation), keep server message since it contains field-specific info.
      // For all other codes, use the German mapped message.
      const message =
        (response.status === 400 ? (data?.error || data?.message) : null) ||
        STATUS_MESSAGES[response.status] ||
        data?.error ||
        data?.message ||
        `Unbekannter Fehler (${response.status})`;
      throw new APIError(response.status, message);
    }

    return data;
  } catch (err) {
    if (err instanceof APIError) throw err;
    throw new APIError(0, 'Keine Verbindung zum Server.');
  }
}

export const api = {
  auth: {
    login: (usernameOrEmail, password) =>
      request('/auth/login', { method: 'POST', body: { usernameOrEmail, password } }),
    register: (inviteCode, username, password, email) =>
      request('/auth/register', {
        method: 'POST',
        body: { inviteCode, username, password, email },
      }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    me: () => request('/auth/me'),
    changePassword: (currentPassword, newPassword) =>
      request('/auth/password', { method: 'PATCH', body: { currentPassword, newPassword } }),
  },
  settings: {
    get: () => request('/me/settings'),
    update: (settingsJson) => request('/me/settings', { method: 'PUT', body: { settingsJson } }),
  },
  projects: {
    list: () => request('/projects'),
    create: (name, contentJson) =>
      request('/projects', { method: 'POST', body: { name, contentJson } }),
    update: (id, version, contentJson) =>
      request(`/projects/${id}`, { method: 'PATCH', body: { version, contentJson } }),
    delete: (id) => request(`/projects/${id}`, { method: 'DELETE' }),
    getUploadUrl: (id, filename, contentType) =>
      request(`/projects/${id}/upload-url`, { method: 'POST', body: { filename, contentType } }),
    snapshots: (id) => request(`/projects/${id}/snapshots`),
    restoreSnapshot: (id, snapId) =>
      request(`/projects/${id}/snapshots/${snapId}/restore`, { method: 'POST' }),
  },
  security: {
    get2FASetup: () => request('/security/2fa/setup'),
    enable2FA: (token) => request('/security/2fa/enable', { method: 'POST', body: { token } }),
    disable2FA: (token) => request('/security/2fa/disable', { method: 'POST', body: { token } }),
    apiKeys: {
      list: () => request('/security/api-keys'),
      create: (name) => request('/security/api-keys', { method: 'POST', body: { name } }),
      revoke: (id) => request(`/security/api-keys/${id}`, { method: 'DELETE' }),
    },
  },
  invites: {
    list: () => request('/invites'),
    create: (roleId, maxUses, expiresAt, note) =>
      request('/invites', { method: 'POST', body: { roleId, maxUses, expiresAt, note } }),
    revoke: (id) => request(`/invites/${id}`, { method: 'DELETE' }),
  },
  users: {
    list: () => request('/users'),
    updateStatus: (id, status) =>
      request(`/users/${id}/status`, { method: 'PATCH', body: { status } }),
  },
  roles: {
    list: () => request('/roles'),
  },
};
