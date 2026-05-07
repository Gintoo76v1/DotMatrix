import { api } from '../api.js';
import { applyPreset } from './presets.js';

export async function initHistoryUI() {
  const container = document.getElementById('tab-history');
  if (!container) return;

  container.innerHTML = `
    <div class="sidebar-logo">DotMatrix Studio</div>
    <h2>Projekt Historie</h2>
    <p class="setting-desc">Hier werden automatische Snapshots gespeichert. Klicke auf einen Eintrag, um den Stand wiederherzustellen.</p>
    
    <div id="snapshotList" class="scroll-list" style="margin-top:20px; max-height:400px;">
      <div style="padding:20px; text-align:center; opacity:0.5;">Wähle ein Projekt aus...</div>
    </div>
  `;
}

export async function loadProjectHistory(projectId) {
  const list = document.getElementById('snapshotList');
  if (!list) return;

  list.innerHTML = '<div style="padding:20px; text-align:center;">Lade Snapshots...</div>';

  try {
    const res = await api.projects.snapshots(projectId);
    list.innerHTML = '';

    if (res.snapshots.length === 0) {
      list.innerHTML =
        '<div style="padding:20px; text-align:center; opacity:0.5;">Noch keine Snapshots für dieses Projekt.</div>';
      return;
    }

    res.snapshots.forEach((snap) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'sli';
      const date = new Date(snap.createdAt).toLocaleString();
      el.innerHTML = `
        <div class="sli-row">
          <div style="display:flex; flex-direction:column;">
            <span style="font-weight:bold;">Version ${snap.version}</span>
            <span style="font-size:10px; opacity:0.6;">${date}</span>
          </div>
          <button class="btn-sm" style="font-size:9px; padding:2px 8px;">Restore</button>
        </div>
      `;

      el.addEventListener('click', async () => {
        if (
          confirm(
            `Möchtest du Version ${snap.version} wiederherstellen? Aktuelle ungespeicherte Änderungen gehen verloren.`
          )
        ) {
          const updateRes = await api.projects.restoreSnapshot(projectId, snap.id);
          applyPreset(updateRes.project.contentJson);
          alert('Wiederhergestellt!');
        }
      });

      list.appendChild(el);
    });
  } catch (e) {
    list.innerHTML = `<div style="padding:20px; text-align:center; color:var(--dm-error);">Fehler beim Laden: ${e.message}</div>`;
  }
}
