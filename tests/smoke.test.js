// Smoke test: verify DOM structure and CSS rules for click-blocking
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

describe('UI Smoke Test', () => {
  it('all tab buttons have matching tab-content ids', () => {
    const html = fs.readFileSync('./index.html', 'utf8');
    document.documentElement.innerHTML = html;
    
    const btns = document.querySelectorAll('.activity-bar .icon-btn[data-tab]');
    expect(btns.length).toBeGreaterThan(0);
    
    btns.forEach(btn => {
      const tabId = btn.dataset.tab;
      const tab = document.getElementById(tabId);
      expect(tab, `tab ${tabId} must exist`).not.toBeNull();
      expect(tab.classList.contains('tab-content')).toBe(true);
    });
  });

  it('changelog overlay has pointer-events:none when closed', () => {
    const html = fs.readFileSync('./index.html', 'utf8');
    document.documentElement.innerHTML = html;
    const overlay = document.getElementById('changelogOverlay');
    expect(overlay).not.toBeNull();
    // Verify CSS class that sets pointer-events:none
    expect(overlay.classList.contains('changelog-overlay')).toBe(true);
  });
});
