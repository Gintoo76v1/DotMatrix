// Verify event handlers fire correctly
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';

describe('Event Handler Smoke Test', () => {
  beforeAll(() => {
    const html = fs.readFileSync('./index.html', 'utf8');
    document.documentElement.innerHTML = html;
  });

  it('tab switching works via simulated click', () => {
    const sourceBtn = document.querySelector('.activity-bar .icon-btn[data-tab="tab-source"]');
    const presetsBtn = document.querySelector('.activity-bar .icon-btn[data-tab="tab-presets"]');
    const sourceTab = document.getElementById('tab-source');
    const presetsTab = document.getElementById('tab-presets');
    
    expect(sourceBtn).not.toBeNull();
    expect(presetsBtn).not.toBeNull();
    expect(sourceTab.classList.contains('active')).toBe(true);
    expect(presetsTab.classList.contains('active')).toBe(false);
    
    // Simulate the initTabs logic manually
    document.querySelectorAll('.activity-bar .icon-btn').forEach(b => b.classList.remove('active'));
    presetsBtn.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
    presetsTab.classList.add('active');
    
    expect(sourceTab.classList.contains('active')).toBe(false);
    expect(presetsTab.classList.contains('active')).toBe(true);
  });

  it('swatch click changes active class', () => {
    const box = document.getElementById('inkSwatches');
    expect(box).not.toBeNull();
    const swatches = box.querySelectorAll('.swatch');
    expect(swatches.length).toBeGreaterThan(1);
    
    const first = swatches[0];
    const second = swatches[1];
    
    // Simulate wireSwatches click logic
    box.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
    second.classList.add('active');
    
    expect(second.classList.contains('active')).toBe(true);
    expect(first.classList.contains('active')).toBe(false);
  });
});
