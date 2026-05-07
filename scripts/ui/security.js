import { api } from '../api.js';

export async function initSecurityUI() {
  const container = document.getElementById('securitySettings');
  if (!container) return;

  container.innerHTML = `
    <div class="settings-subgroup" style="margin-top:10px;">
      <h3>Zwei-Faktor-Authentisierung (2FA)</h3>
      <div id="2faStatus" style="font-size:11px; margin-bottom:10px;">Laden...</div>
      <button class="btn-sm" id="setup2FABtn">2FA Einrichten</button>
      <div id="2faSetupArea" style="display:none; margin-top:15px; text-align:center;">
        <img id="2faQR" style="background:#fff; padding:10px; border-radius:8px; width:180px; height:180px;" />
        <div style="margin-top:10px;">
          <input type="text" id="2faToken" class="text-input" placeholder="6-stelliger Code" style="text-align:center; letter-spacing:4px;" />
          <button class="btn primary btn-sm" id="confirm2FABtn" style="width:100%; margin-top:10px;">Aktivieren</button>
        </div>
      </div>
    </div>

    <div class="settings-subgroup" style="margin-top:24px; padding-top:16px; border-top:1px solid var(--dm-border-base);">
      <h3>API-Keys</h3>
      <div id="apiKeyList" class="scroll-list" style="max-height:150px; margin-bottom:10px;"></div>
      <div style="display:flex; gap:8px;">
        <input type="text" id="newKeyName" class="text-input" placeholder="Key Name (z.B. Python Script)" style="flex:1" />
        <button class="btn-sm" id="createKeyBtn">Erstellen</button>
      </div>
      <div id="newKeyDisplay" style="display:none; margin-top:10px; padding:10px; background:var(--dm-surface-overlay); border-radius:8px; border:1px solid var(--accent);">
        <div style="font-size:10px; color:var(--accent); text-transform:uppercase; font-weight:bold;">Wichtig: Key nur einmal sichtbar!</div>
        <code id="rawKeyText" style="word-break:break-all; font-size:12px;"></code>
      </div>
    </div>
  `;

  render2FA();
  renderAPIKeys();

  // 2FA Wire
  document.getElementById('setup2FABtn').addEventListener('click', async () => {
    const res = await api.security.get2FASetup();
    document.getElementById('2faQR').src = res.qrDataUrl;
    document.getElementById('2faSetupArea').style.display = 'block';
  });

  document.getElementById('confirm2FABtn').addEventListener('click', async () => {
    const token = document.getElementById('2faToken').value.trim();
    try {
      await api.security.enable2FA(token);
      alert('2FA erfolgreich aktiviert!');
      location.reload();
    } catch (e) {
      alert('Fehler: ' + e.message);
    }
  });

  // API Key Wire
  document.getElementById('createKeyBtn').addEventListener('click', async () => {
    const name = document.getElementById('newKeyName').value.trim();
    if (!name) return;
    const res = await api.security.apiKeys.create(name);
    document.getElementById('rawKeyText').textContent = res.apiKey.key;
    document.getElementById('newKeyDisplay').style.display = 'block';
    renderAPIKeys();
  });
}

async function render2FA() {
  const userRes = await api.auth.me();
  const statusEl = document.getElementById('2faStatus');
  // Note: auth.me doesn't return 2fa state yet, let's assume we add it to the user object in auth.js
  const isEnabled = userRes.user.twoFactorEnabled;
  statusEl.innerHTML = isEnabled
    ? '<span style="color:var(--dm-success)">● Aktiviert</span>'
    : '<span style="color:var(--dm-text-weak)">○ Deaktiviert</span>';
}

async function renderAPIKeys() {
  const res = await api.security.apiKeys.list();
  const list = document.getElementById('apiKeyList');
  list.innerHTML = '';
  if (res.keys.length === 0)
    list.innerHTML = '<div style="padding:10px; opacity:0.5; text-align:center;">Keine Keys</div>';
  res.keys.forEach((k) => {
    const el = document.createElement('div');
    el.className = 'sli';
    el.innerHTML = `<div class="sli-row"><span>${k.name}</span><button class="sli-del" data-id="${k.id}">×</button></div>`;
    el.querySelector('.sli-del').addEventListener('click', async () => {
      if (confirm('Key löschen?')) {
        await api.security.apiKeys.revoke(k.id);
        renderAPIKeys();
      }
    });
    list.appendChild(el);
  });
}
