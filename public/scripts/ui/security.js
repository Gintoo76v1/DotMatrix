import { api } from '../api.js?v=14';
import { showSuccess, showError, showWarning } from './toast.js';

export async function initSecurityUI() {
  const container = document.getElementById('securitySettings');
  if (!container) return;

  await _render(container);
}

async function _render(container) {
  let twoFactorEnabled = false;
  try {
    const userRes = await api.auth.me();
    twoFactorEnabled = !!userRes.user.twoFactorEnabled;
  } catch { /* show UI anyway */ }

  container.innerHTML = `
    <div class="settings-subgroup">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <span style="font-size:11px;font-weight:600;color:var(--dm-text-strong);">Zwei-Faktor-Authentifizierung</span>
        <span id="2faStatusBadge" style="font-size:10px;padding:2px 7px;border-radius:4px;font-weight:600;
          background:${twoFactorEnabled ? 'rgb(18 201 5 / 15%)' : 'var(--dm-surface-overlay)'};
          color:${twoFactorEnabled ? 'var(--dm-success)' : 'var(--dm-text-weak)'};">
          ${twoFactorEnabled ? '● Aktiv' : '○ Inaktiv'}
        </span>
      </div>
      ${twoFactorEnabled ? `
        <p style="font-size:10px;color:var(--dm-text-weak);margin-bottom:10px;">
          2FA schützt dein Konto mit einem zeitbasierten Einmalpasswort (TOTP).
        </p>
        <div style="display:flex;gap:8px;">
          <input type="text" id="2faDisableToken" class="text-input" placeholder="6-stelliger Code zum Deaktivieren"
            style="flex:1;text-align:center;letter-spacing:3px;font-size:13px;" maxlength="6" />
          <button class="btn btn-sm" id="disable2FABtn" style="color:var(--dm-error);border-color:var(--dm-error);">
            Deaktivieren
          </button>
        </div>
      ` : `
        <p style="font-size:10px;color:var(--dm-text-weak);margin-bottom:10px;">
          2FA fügt eine zusätzliche Sicherheitsebene hinzu. Du benötigst eine Authenticator-App (z.B. Google Authenticator oder Bitwarden).
        </p>
        <button class="btn btn-sm primary" id="setup2FABtn" style="width:100%;">2FA Einrichten</button>
        <div id="2faSetupArea" style="display:none;margin-top:14px;">
          <p style="font-size:10px;color:var(--dm-text-weak);margin-bottom:10px;text-align:center;">
            Scanne den QR-Code mit deiner Authenticator-App, dann bestätige mit dem 6-stelligen Code.
          </p>
          <div style="text-align:center;margin-bottom:12px;">
            <img id="2faQR" style="background:#fff;padding:8px;border-radius:8px;width:160px;height:160px;" />
          </div>
          <input type="text" id="2faToken" class="text-input"
            placeholder="6-stelliger Code" maxlength="6"
            style="text-align:center;letter-spacing:4px;font-size:14px;width:100%;margin-bottom:8px;" />
          <button class="btn primary btn-sm" id="confirm2FABtn" style="width:100%;">Aktivieren</button>
        </div>
      `}
    </div>

    <div class="settings-subgroup" style="margin-top:20px;padding-top:16px;border-top:1px solid var(--dm-border-base);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <span style="font-size:11px;font-weight:600;color:var(--dm-text-strong);">API-Keys</span>
      </div>
      <div id="apiKeyList" class="scroll-list" style="max-height:140px;margin-bottom:10px;"></div>
      <div style="display:flex;gap:8px;">
        <input type="text" id="newKeyName" class="text-input"
          placeholder="Key-Name (z.B. Python Script)" style="flex:1;font-size:12px;" />
        <button class="btn-sm" id="createKeyBtn">+ Erstellen</button>
      </div>
      <div id="newKeyDisplay" style="display:none;margin-top:10px;padding:10px;
        background:var(--dm-surface-overlay);border-radius:8px;border:1px solid var(--dm-primary);">
        <div style="font-size:10px;color:var(--dm-primary);text-transform:uppercase;font-weight:600;margin-bottom:4px;">
          Nur einmal sichtbar — jetzt kopieren!
        </div>
        <code id="rawKeyText" style="word-break:break-all;font-size:11px;color:var(--dm-text-strong);"></code>
      </div>
    </div>
  `;

  _wire2FA(twoFactorEnabled, container);
  _wireAPIKeys(container);
  _renderAPIKeys();
}

function _wire2FA(isEnabled, container) {
  if (isEnabled) {
    container.querySelector('#disable2FABtn')?.addEventListener('click', async () => {
      const token = container.querySelector('#2faDisableToken')?.value?.trim();
      if (!token || token.length !== 6) {
        showWarning('Bitte den 6-stelligen Code eingeben.');
        return;
      }
      try {
        await api.security.disable2FA(token);
        showSuccess('2FA wurde deaktiviert.');
        await _render(container);
      } catch (e) {
        showError(e.message || 'Ungültiger Code.');
      }
    });
  } else {
    container.querySelector('#setup2FABtn')?.addEventListener('click', async () => {
      const setupArea = container.querySelector('#2faSetupArea');
      const btn = container.querySelector('#setup2FABtn');
      btn.disabled = true;
      btn.textContent = '…';
      try {
        const res = await api.security.get2FASetup();
        container.querySelector('#2faQR').src = res.qrDataUrl;
        setupArea.style.display = 'block';
        container.querySelector('#2faToken')?.focus();
      } catch (e) {
        showError('2FA Setup fehlgeschlagen: ' + e.message);
      } finally {
        btn.disabled = false;
        btn.textContent = '2FA Einrichten';
      }
    });

    container.querySelector('#confirm2FABtn')?.addEventListener('click', async () => {
      const token = container.querySelector('#2faToken')?.value?.trim();
      if (!token || token.length !== 6) {
        showWarning('Bitte den 6-stelligen Code eingeben.');
        return;
      }
      const btn = container.querySelector('#confirm2FABtn');
      btn.disabled = true;
      btn.textContent = '…';
      try {
        await api.security.enable2FA(token);
        showSuccess('2FA erfolgreich aktiviert! Dein Konto ist jetzt zusätzlich geschützt.');
        await _render(container);
      } catch (e) {
        showError(e.message || '2FA-Aktivierung fehlgeschlagen.');
        btn.disabled = false;
        btn.textContent = 'Aktivieren';
      }
    });
  }
}

function _wireAPIKeys(container) {
  container.querySelector('#createKeyBtn')?.addEventListener('click', async () => {
    const nameEl = container.querySelector('#newKeyName');
    const name = nameEl?.value?.trim();
    if (!name) {
      showWarning('Bitte einen Namen für den API-Key eingeben.');
      return;
    }
    const btn = container.querySelector('#createKeyBtn');
    btn.disabled = true;
    try {
      const res = await api.security.apiKeys.create(name);
      container.querySelector('#rawKeyText').textContent = res.apiKey.key;
      container.querySelector('#newKeyDisplay').style.display = 'block';
      if (nameEl) nameEl.value = '';
      _renderAPIKeys();
    } catch (e) {
      showError('API-Key konnte nicht erstellt werden: ' + e.message);
    } finally {
      btn.disabled = false;
    }
  });
}

async function _renderAPIKeys() {
  const list = document.getElementById('apiKeyList');
  if (!list) return;
  list.innerHTML = '<div style="padding:8px;opacity:0.5;text-align:center;font-size:11px;">Lade…</div>';
  try {
    const res = await api.security.apiKeys.list();
    list.innerHTML = '';
    if (res.keys.length === 0) {
      list.innerHTML = '<div style="padding:8px;opacity:0.5;text-align:center;font-size:11px;">Keine API-Keys vorhanden</div>';
      return;
    }
    res.keys.forEach((k) => {
      const el = document.createElement('div');
      el.className = 'sli';
      const lastUsed = k.lastUsedAt
        ? new Date(k.lastUsedAt).toLocaleDateString('de-DE')
        : 'Nie';
      el.innerHTML = `
        <div class="sli-row">
          <div style="min-width:0;">
            <div style="font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${k.name}</div>
            <div style="font-size:10px;color:var(--dm-text-weak);">Zuletzt: ${lastUsed}</div>
          </div>
          <button class="sli-del" data-id="${k.id}" title="Key widerrufen">×</button>
        </div>
      `;
      el.querySelector('.sli-del').addEventListener('click', async () => {
        if (!confirm(`API-Key "${k.name}" wirklich widerrufen?`)) return;
        try {
          await api.security.apiKeys.revoke(k.id);
          showSuccess(`Key "${k.name}" wurde widerrufen.`);
          _renderAPIKeys();
        } catch (e) {
          showError('Konnte Key nicht widerrufen: ' + e.message);
        }
      });
      list.appendChild(el);
    });
  } catch (e) {
    list.innerHTML = '<div style="padding:8px;color:var(--dm-error);font-size:11px;">Fehler beim Laden der Keys</div>';
  }
}
