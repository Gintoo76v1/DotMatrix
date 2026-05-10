import { api } from '../api.js?v=14';

let _currentUser = null;
let _rolesCache = null;

export async function initAdminUI(permissions, currentUser) {
  _currentUser = currentUser;

  const isAdmin =
    permissions.includes('*') ||
    permissions.includes('roles.manage') ||
    permissions.includes('invites.read.any');
  if (!isAdmin) return;

  const nav = document.querySelector('.activity-bar');
  const systemBtn = document.querySelector('.icon-btn[data-tab="tab-system"]');

  const adminBtn = document.createElement('div');
  adminBtn.className = 'icon-btn';
  adminBtn.dataset.tab = 'tab-admin';
  adminBtn.title = 'Admin';
  adminBtn.textContent = '🛡️';
  nav.insertBefore(adminBtn, systemBtn);

  const sidebar = document.querySelector('.sidebar-scrollable');
  const adminTab = document.createElement('div');
  adminTab.className = 'tab-content';
  adminTab.id = 'tab-admin';
  adminTab.innerHTML = `
    <div class="sidebar-logo">DotMatrix Studio</div>
    <h2>Admin Dashboard</h2>

    <div style="margin-top:24px;">
      <h3>Invites</h3>
      <div id="inviteList" style="margin-bottom:12px;"></div>
      <button class="btn primary btn-sm" id="createInviteBtn" style="width:100%;">Neuen Invite erstellen</button>
      <div id="createInviteForm" style="display:none; flex-direction:column; gap:8px; margin-top:12px; padding:12px; border:1px solid var(--dm-border-base); border-radius:8px;">
        <label style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:var(--dm-text-weak);">Rolle</label>
        <select id="inviteRoleSelect" class="text-input" style="font-size:13px;"></select>
        <label style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:var(--dm-text-weak);">Max. Nutzungen</label>
        <input type="number" id="inviteMaxUses" class="text-input" value="1" min="1" style="font-size:13px;" />
        <label style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:var(--dm-text-weak);">Notiz (optional)</label>
        <input type="text" id="inviteNote" class="text-input" placeholder="z.B. für Freund X" style="font-size:13px;" />
        <div style="display:flex;gap:8px;margin-top:4px;">
          <button class="btn primary btn-sm" id="confirmInviteBtn" style="flex:1;">Erstellen</button>
          <button class="btn btn-sm" id="cancelInviteBtn" style="flex:1;">Abbrechen</button>
        </div>
      </div>
      <div id="newCodeDisplay" style="display:none; margin-top:8px; padding:12px; border:1px solid var(--dm-primary); border-radius:8px; text-align:center;">
        <div style="font-size:10px;color:var(--dm-text-weak);margin-bottom:4px;">NEUER CODE</div>
        <span id="newCodeText" style="font-family:monospace;font-size:15px;letter-spacing:0.12em;color:var(--dm-primary);"></span>
      </div>
    </div>

    <div style="margin-top:24px;">
      <h3>Users</h3>
      <div id="userList"></div>
    </div>
  `;
  sidebar.appendChild(adminTab);

  adminBtn.addEventListener('click', () => {
    document.querySelectorAll('.activity-bar .icon-btn').forEach((b) => b.classList.remove('active'));
    adminBtn.classList.add('active');
    document.querySelectorAll('.tab-content').forEach((tc) => tc.classList.remove('active'));
    adminTab.classList.add('active');
    loadAdminData();
  });

  document.getElementById('createInviteBtn').addEventListener('click', async () => {
    const form = document.getElementById('createInviteForm');
    const isVisible = form.style.display === 'flex';
    form.style.display = isVisible ? 'none' : 'flex';
    if (!isVisible) await _loadRolesIntoSelect();
  });

  document.getElementById('cancelInviteBtn').addEventListener('click', () => {
    document.getElementById('createInviteForm').style.display = 'none';
  });

  document.getElementById('confirmInviteBtn').addEventListener('click', async () => {
    const roleId = document.getElementById('inviteRoleSelect').value;
    const maxUses = parseInt(document.getElementById('inviteMaxUses').value) || 1;
    const note = document.getElementById('inviteNote').value.trim() || null;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    try {
      const res = await api.invites.create(roleId, maxUses, expiresAt, note);
      document.getElementById('createInviteForm').style.display = 'none';
      document.getElementById('inviteNote').value = '';
      document.getElementById('inviteMaxUses').value = '1';
      _showNewCode(res.invite.code);
      loadAdminData();
    } catch (e) {
      alert('Fehler: ' + e.message);
    }
  });
}

function _showNewCode(code) {
  const display = document.getElementById('newCodeDisplay');
  document.getElementById('newCodeText').textContent = code;
  display.style.display = 'block';
  setTimeout(() => (display.style.display = 'none'), 30000);
}

async function _loadRolesIntoSelect() {
  if (_rolesCache) return;
  try {
    const res = await api.roles.list();
    _rolesCache = res.roles;
    const select = document.getElementById('inviteRoleSelect');
    if (!select) return;
    select.innerHTML = '';
    res.roles.forEach((r) => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = r.name.charAt(0).toUpperCase() + r.name.slice(1);
      if (r.name === 'user') opt.selected = true;
      select.appendChild(opt);
    });
  } catch {
    /* ignore */
  }
}

async function loadAdminData() {
  await Promise.all([_loadInvites(), _loadUsers()]).catch((e) =>
    console.warn('Admin data load failed', e)
  );
}

async function _loadInvites() {
  const container = document.getElementById('inviteList');
  if (!container) return;

  const res = await api.invites.list();
  const all = res.invites;
  const now = new Date();

  const active = all.filter(
    (i) => !i.isRevoked && i.usedCount < i.maxUses && (!i.expiresAt || new Date(i.expiresAt) > now)
  );
  const used = all.filter((i) => !i.isRevoked && i.usedCount >= i.maxUses);
  const dead = all.filter(
    (i) => i.isRevoked || (i.expiresAt && new Date(i.expiresAt) <= now && i.usedCount < i.maxUses)
  );

  container.innerHTML = '';
  _renderInviteGroup(container, 'Aktiv', active, 'var(--dm-primary)', false);
  _renderInviteGroup(container, 'Genutzt', used, '#4caf50', true);
  _renderInviteGroup(container, 'Widerrufen / Abgelaufen', dead, 'var(--dm-error)', true);
}

function _renderInviteGroup(container, label, invites, color, collapsed) {
  if (invites.length === 0) return;

  const details = document.createElement('details');
  if (!collapsed) details.open = true;
  details.style.marginBottom = '8px';

  const arrow = collapsed ? '▶' : '▼';
  const summary = document.createElement('summary');
  summary.style.cssText = `cursor:pointer;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:${color};padding:6px 0;user-select:none;list-style:none;display:flex;align-items:center;gap:6px;`;
  summary.innerHTML = `<span class="grp-arrow">${arrow}</span>${label}<span style="opacity:0.6;">(${invites.length})</span>`;
  details.addEventListener('toggle', () => {
    summary.querySelector('.grp-arrow').textContent = details.open ? '▼' : '▶';
  });
  details.appendChild(summary);

  invites.forEach((inv) => {
    const el = document.createElement('div');
    el.className = 'sli';
    el.style.cssText =
      'flex-direction:column;align-items:flex-start;gap:4px;padding:8px 10px;margin-bottom:2px;';

    const isDead = inv.isRevoked || (inv.expiresAt && new Date(inv.expiresAt) <= new Date());
    const isFullyUsed = inv.usedCount >= inv.maxUses;
    const canRevoke = !isDead && !isFullyUsed;

    const redemptions = inv.redemptions || [];
    const redemptionHtml = redemptions
      .map(
        (r) =>
          `<span style="font-size:10px;color:var(--dm-text-weak);">↳ ${r.username || r.email || 'Unbekannt'} · ${new Date(r.redeemedAt).toLocaleDateString('de-DE')}</span>`
      )
      .join('');

    el.innerHTML = `
      <div class="sli-row" style="width:100%;">
        <span style="font-family:monospace;font-size:12px;${isDead ? 'text-decoration:line-through;opacity:0.45;' : ''}">${inv.code}</span>
        <div style="display:flex;align-items:center;gap:4px;">
          <span class="sli-badge">${inv.usedCount}/${inv.maxUses}</span>
          ${canRevoke ? `<button class="sli-del" title="Widerrufen">×</button>` : ''}
        </div>
      </div>
      ${redemptionHtml ? `<div style="display:flex;flex-direction:column;gap:2px;padding-left:2px;">${redemptionHtml}</div>` : ''}
    `;

    const delBtn = el.querySelector('.sli-del');
    if (delBtn) {
      delBtn.addEventListener('click', async () => {
        if (confirm('Code wirklich widerrufen?')) {
          await api.invites.revoke(inv.id);
          _loadInvites();
        }
      });
    }
    details.appendChild(el);
  });

  container.appendChild(details);
}

async function _loadUsers() {
  const container = document.getElementById('userList');
  if (!container) return;

  // Eagerly load roles for display
  if (!_rolesCache) await _loadRolesIntoSelect();

  const res = await api.users.list();
  container.innerHTML = '';

  res.users.forEach((u) => {
    const isSelf   = _currentUser && u.id === _currentUser.id;
    const isActive = u.status === 'active';
    const roleName = u.roleName || (u.roleId && _rolesCache?.find((r) => r.id === u.roleId)?.name) || '—';
    const roleColor = roleName === 'admin' ? 'var(--dm-primary)' : 'var(--dm-text-weak)';

    const el = document.createElement('div');
    el.className = 'sli';
    el.innerHTML = `
      <div class="sli-row" style="width:100%;">
        <div style="display:flex;align-items:center;gap:6px;min-width:0;flex:1;">
          <span style="${!isActive ? 'opacity:0.45;text-decoration:line-through;' : ''};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${u.username}</span>
          ${isSelf ? '<span style="font-size:9px;color:var(--dm-primary);font-weight:600;flex-shrink:0;">ICH</span>' : ''}
          <span style="font-size:9px;color:${roleColor};border:1px solid ${roleColor};border-radius:3px;padding:0 4px;opacity:0.8;flex-shrink:0;">${roleName}</span>
        </div>
        <div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">
          ${!isActive ? '<span style="font-size:9px;color:var(--dm-error);">gesperrt</span>' : ''}
          ${
            isSelf
              ? ''
              : `<button class="btn-sm" style="font-size:9px;padding:2px 6px;border-color:${isActive ? 'var(--dm-border-base)' : 'var(--dm-error)'};">${isActive ? 'Sperren' : 'Aktivieren'}</button>`
          }
        </div>
      </div>
    `;

    if (!isSelf) {
      el.querySelector('button')?.addEventListener('click', async () => {
        const next = isActive ? 'suspended' : 'active';
        if (confirm(`"${u.username}" wirklich ${isActive ? 'sperren' : 'aktivieren'}?`)) {
          try {
            await api.users.updateStatus(u.id, next);
            _loadUsers();
          } catch (err) {
            alert(err.message);
          }
        }
      });
    }
    container.appendChild(el);
  });
}
