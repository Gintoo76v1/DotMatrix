import { api } from '../api.js?v=14';

export async function loadProjectHistory(projectId) {
  const container = document.getElementById('tab-history');
  if (!container) return;

  container.innerHTML = '<p style="padding:12px;color:var(--dm-text-weak);font-size:13px">Lade Verlauf…</p>';

  try {
    const res = await api.projects.snapshots(projectId);
    const snapshots = res?.snapshots ?? [];

    if (snapshots.length === 0) {
      container.innerHTML =
        '<p style="padding:12px;color:var(--dm-text-weak);font-size:13px">Kein Verlauf verfügbar.</p>';
      return;
    }

    container.innerHTML = '';
    for (const snap of snapshots) {
      const date = new Date(snap.createdAt).toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      const el = document.createElement('div');
      el.className = 'sli';
      el.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px;';
      el.innerHTML = `
        <span style="font-size:12px;color:var(--dm-text)">${date}</span>
        <button class="btn" style="font-size:11px;padding:3px 8px">Wiederherstellen</button>
      `;
      el.querySelector('button').addEventListener('click', async () => {
        if (!confirm('Snapshot wiederherstellen? Aktuelle Änderungen gehen verloren.')) return;
        try {
          await api.projects.restoreSnapshot(projectId, snap.id);
          window.location.reload();
        } catch (e) {
          alert('Fehler beim Wiederherstellen: ' + e.message);
        }
      });
      container.appendChild(el);
    }
  } catch {
    container.innerHTML =
      '<p style="padding:12px;color:var(--dm-text-weak);font-size:13px">Verlauf konnte nicht geladen werden.</p>';
  }
}
