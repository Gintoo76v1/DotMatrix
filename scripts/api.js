// ── API Client Layer ─────────────────────────────────────────────────────────

const API_BASE = '/api/v1';

export class APIError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const config = {
    ...options,
    headers,
    credentials: 'same-origin' // Ensures session cookies are sent
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, config);
    
    if (response.status === 401) {
      // Unauthorized, redirect to login
      window.location.href = '/login.html';
      throw new APIError(401, 'Unauthorized');
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new APIError(response.status, data?.error || 'Unknown error');
    }

    return data;
  } catch (err) {
    if (err instanceof APIError) throw err;
    // Network error (Offline)
    throw new Error('Network error or offline');
  }
}

export const api = {
  auth: {
    login: (usernameOrEmail, password) => request('/auth/login', { method: 'POST', body: { usernameOrEmail, password } }),
    register: (inviteCode, username, password, email) => request('/auth/register', { method: 'POST', body: { inviteCode, username, password, email } }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    me: () => request('/auth/me'),
  },
  settings: {
    get: () => request('/me/settings'),
    update: (settingsJson) => request('/me/settings', { method: 'PUT', body: { settingsJson } }),
  },
  projects: {
    list: () => request('/projects'),
    create: (name, contentJson) => request('/projects', { method: 'POST', body: { name, contentJson } }),
    update: (id, version, contentJson) => request(`/projects/${id}`, { method: 'PATCH', body: { version, contentJson } }),
    delete: (id) => request(`/projects/${id}`, { method: 'DELETE' }),
    getUploadUrl: (id, filename, contentType) => request(`/projects/${id}/upload-url`, { method: 'POST', body: { filename, contentType } }),
    snapshots: (id) => request(`/projects/${id}/snapshots`),
    restoreSnapshot: (id, snapId) => request(`/projects/${id}/snapshots/${snapId}/restore`, { method: 'POST' }),
  },
  security: {
    get2FASetup: () => request('/security/2fa/setup'),
    enable2FA: (token) => request('/security/2fa/enable', { method: 'POST', body: { token } }),
    disable2FA: (token) => request('/security/2fa/disable', { method: 'POST', body: { token } }),
    apiKeys: {
      list: () => request('/security/api-keys'),
      create: (name) => request('/security/api-keys', { method: 'POST', body: { name } }),
      revoke: (id) => request(`/security/api-keys/${id}`, { method: 'DELETE' }),
    }
  },
  invites: {
    list: () => request('/invites'),
    create: (roleId, maxUses, expiresAt, note) => request('/invites', { method: 'POST', body: { roleId, maxUses, expiresAt, note } }),
    revoke: (id) => request(`/invites/${id}`, { method: 'DELETE' }),
  },
  users: {
    list: () => request('/users'),
    updateStatus: (id, status) => request(`/users/${id}/status`, { method: 'PATCH', body: { status } }),
  },
  roles: {
    list: () => request('/roles'),
  }
};