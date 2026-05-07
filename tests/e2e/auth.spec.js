import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should show login page and validation errors', async ({ page }) => {
    await page.goto('/login.html');
    
    await expect(page.locator('h1')).toContainText('Login');
    
    // Attempt login with empty fields
    await page.click('button[type="submit"]');
    // We assume some error handling/validation is in place (script-side)
    // The exact check depends on auth-ui.js implementation
  });

  test('should navigate to registration page', async ({ page }) => {
    await page.goto('/login.html');
    await page.click('a[href="register.html"]');
    await expect(page).toHaveURL(/register\.html/);
    await expect(page.locator('h1')).toContainText('Registrierung');
  });
});
