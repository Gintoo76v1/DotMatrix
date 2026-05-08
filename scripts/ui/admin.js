import { api } from '../api.js?v=14';

export async function initAdminUI(permissions) {
  const isAdmin =
    permissions.includes('*') ||
    permissions.includes('roles.manage') ||
    permissions.includes('invites.read.any');
  if (!isAdmin) return;

  // Add the tab button
  const nav = document.querySelector('.activity-bar');
  const systemBtn = document.querySelector('.icon-btn[data-tab="tab-system"]');

  const adminBtn = document.createElement('div');
  adminBtn.className = 'icon-btn';
  adminBtn.dataset.tab = 'tab-admin';
  adminBtn.title = 'Admin';
  adminBtn.textContent = '🛡️';

  nav.insertBefore(adminBtn, systemBtn);

  // Add the tab content
  const sidebar = document.querySelector('.sidebar-scrollable');

  const adminTab = document.createElement('div');
  adminTab.className = 'tab-content';
  adminTab.id = 'tab-admin';
  adminTab.innerHTML = `
    <div class="sidebar-logo">DotMatrix Studio</div>
    <h2>Admin Dashboard</h2>
    
    <div style="margin-top:24px;">
      <h3>Invites</h3>
      <div id="inviteList" class="scroll-list" style="margin-bottom:12px; max-height:200px;"></div>
      <button class="btn primary btn-sm" id="createInviteBtn" style="width:100%;">Neuen Invite erstellen</button>
    </div>

    <div style="margin-top:24px;">
      <h3>Users</h3>
      <div id="userList" class="scroll-list" style="max-height:200px;"></div>
    </div>
  `;

  sidebar.appendChild(adminTab);

  // Wire tab switching specifically for the new button
  adminBtn.addEventListener('click', () => {
    document
      .querySelectorAll('.activity-bar .icon-btn')
      .forEach((b) => b.classList.remove('active'));
    adminBtn.classList.add('active');
    document.querySelectorAll('.tab-content').forEach((tc) => tc.classList.remove('active'));
    adminTab.classList.add('active');
    loadAdminData();
  });

  // Wire buttons
  document.getElementById('createInviteBtn').addEventListener('click', async () => {
    try {
      // Create a basic user invite for 1 use, valid for 7 days
      const roleId = await getDefaultRoleId();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const res = await api.invites.create(roleId, 1, expiresAt, 'Auto-generated via UI');
      alert('Neuer Invite Code: ' + res.invite.code);
      loadAdminData();
    } catch (e) {
      alert('Fehler beim Erstellen: ' + e.message);
    }
  });
}

// Global role cache
let defaultRoleId = null;
async function getDefaultRoleId() {
  if (defaultRoleId) return defaultRoleId;
  try {
    const res = await api.roles.list();
    const userRole = res.roles.find((r) => r.name === 'user') || res.roles[0];
    defaultRoleId = userRole.id;
    return defaultRoleId;
  } catch {
    return null;
  }
}

async function loadAdminData() {
  try {
    const inviteList = document.getElementById('inviteList');
    if (inviteList) {
      const res = await api.invites.list();
      inviteList.innerHTML = '';
      if (res.invites.length === 0) {
        inviteList.innerHTML =
          '<div style="padding:10px; color:var(--dm-text-weak); text-align:center;">Keine Invites</div>';
      }
      res.invites.forEach((inv) => {
        const el = document.createElement('div');
        el.className = 'sli';
        const isRevoked = inv.isRevoked;
        el.innerHTML = `
          <div class="sli-row">
            <span style="${isRevoked ? 'text-decoration:line-through; opacity:0.5;' : ''}">${inv.code}</span>
            <div>
              <span class="sli-badge" style="margin-right:5px">${inv.usedCount}/${inv.maxUses}</span>
              ${!isRevoked ? '<button class="sli-del" data-id="' + inv.id + '" title="Widerrufen">×</button>' : ''}
            </div>
          </div>`;

        const delBtn = el.querySelector('.sli-del');
        if (delBtn) {
          delBtn.addEventListener('click', async () => {
            if (confirm('Diesen Code wirklich widerrufen?')) {
              await api.invites.revoke(inv.id);
              loadAdminData();
            }
          });
        }
        inviteList.appendChild(el);
      });
    }

    const userList = document.getElementById('userList');
    if (userList) {
      const res = await api.users.list();
      userList.innerHTML = '';
      res.users.forEach((u) => {
        const el = document.createElement('div');
        el.className = 'sli';
        const isActive = u.status === 'active';
        el.innerHTML = `
          <div class="sli-row">
            <span style="${!isActive ? 'opacity:0.5;' : ''}">${u.username}</span>
            <button class="btn-sm" style="font-size:9px; padding:2px 6px; border-color:${isActive ? 'var(--dm-border-base)' : 'var(--dm-error)'}">
              ${isActive ? 'Sperren' : 'Aktivieren'}
            </button>
          </div>`;

        el.querySelector('button').addEventListener('click', async () => {
          const nextStatus = isActive ? 'suspended' : 'active';
          if (confirm(`User ${u.username} wirklich ${isActive ? 'sperren' : 'aktivieren'}?`)) {
            try {
              await api.users.updateStatus(u.id, nextStatus);
              loadAdminData();
            } catch (err) {
              alert(err.message);
            }
          }
        });
        userList.appendChild(el);
      });
    }
  } catch (e) {
    console.warn('Failed to load admin data', e);
  }
}
