import { test, expect } from '@playwright/test';

test('redirects to login when unauthorized', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/login\.html/);
});

test('tabs switch correctly', async ({ page }) => {
  await page.goto('/');

  // Expect default tab to be "Quelle" (Source)
  const sourceTab = page.locator('#tab-source');
  await expect(sourceTab).toBeVisible();

  // Click on "Presets" tab
  const presetsBtn = page.locator('.activity-bar .icon-btn[data-tab="tab-presets"]');
  await presetsBtn.click();

  // "Presets" tab should now be visible, and "Quelle" should be hidden
  const presetsTab = page.locator('#tab-presets');
  await expect(presetsTab).toBeVisible();
  await expect(sourceTab).toBeHidden();
});

test('sidebar toggle button collapses sidebar', async ({ page }) => {
  await page.goto('/');

  const sidebar = page.locator('.sidebar');
  await expect(sidebar).not.toHaveClass(/collapsed/);

  const toggleBtn = page.locator('#sidebarToggleBtn');
  await toggleBtn.click();

  await expect(sidebar).toHaveClass(/collapsed/);
});
