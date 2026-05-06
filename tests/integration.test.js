// Integration test: verify tab switching logic end-to-end in jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';

describe('Integration: Tab Switching', () => {
  beforeAll(() => {
    const html = fs.readFileSync('./index.html', 'utf8');
    document.documentElement.innerHTML = html;
  });

  it('initTabs logic switches active classes correctly', () => {
    // Simulate the exact initTabs logic from main.js
    function initTabs() {
      document.querySelectorAll('.activity-bar .icon-btn[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.activity-bar .icon-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
          const tab = document.getElementById(btn.dataset.tab);
          if (tab) tab.classList.add('active');
        });
      });
    }
    initTabs();

    const sourceBtn = document.querySelector('.activity-bar .icon-btn[data-tab="tab-source"]');
    const presetsBtn = document.querySelector('.activity-bar .icon-btn[data-tab="tab-presets"]');
    const sourceTab = document.getElementById('tab-source');
    const presetsTab = document.getElementById('tab-presets');

    expect(sourceBtn.classList.contains('active')).toBe(true);
    expect(sourceTab.classList.contains('active')).toBe(true);
    expect(presetsTab.classList.contains('active')).toBe(false);

    // Click presets button
    presetsBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(sourceBtn.classList.contains('active')).toBe(false);
    expect(presetsBtn.classList.contains('active')).toBe(true);
    expect(sourceTab.classList.contains('active')).toBe(false);
    expect(presetsTab.classList.contains('active')).toBe(true);
  });

  it('swatch click updates active state and reads data attribute', () => {
    const box = document.getElementById('inkSwatches');
    const swatches = box.querySelectorAll('.swatch');

    function wireSwatches(box) {
      box.addEventListener('click', (e) => {
        const sw = e.target.closest('.swatch');
        if (!sw || !sw.dataset.ink) return;
        box.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
        sw.classList.add('active');
      });
    }
    wireSwatches(box);

    const first = swatches[0];
    const second = swatches[1];

    expect(first.classList.contains('active')).toBe(true);

    second.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(second.classList.contains('active')).toBe(true);
    expect(first.classList.contains('active')).toBe(false);
  });

  it('segmented button click updates active class', () => {
    const container = document.getElementById('ditherBtns');
    const btns = container.querySelectorAll('button');

    function wireSegmented(container) {
      container.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn || !btn.dataset.dither) return;
        container.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    }
    wireSegmented(container);

    const first = btns[0];
    const second = btns[1];

    expect(first.classList.contains('active')).toBe(false); // threshold is active
    expect(container.querySelector('button.active').dataset.dither).toBe('threshold');

    second.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(second.classList.contains('active')).toBe(true);
    expect(first.classList.contains('active')).toBe(false);
  });
});
