import { test, expect } from '@playwright/test';

test.describe('SIGAF Authentication', () => {
  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText('SIGAF');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('invalid login shows error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'wrong@test.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await expect(page.locator('[data-sonner-toaster]')).toBeVisible({ timeout: 5000 });
  });

  test('valid login redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@oxxo.com');
    await page.fill('input[type="password"]', 'Comercio*1');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard', { timeout: 10000 });
    await expect(page.locator('h1')).toContainText('Dashboard');
  });
});

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Set auth cookie for authenticated tests
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@oxxo.com');
    await page.fill('input[type="password"]', 'Comercio*1');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('shows stats cards', async ({ page }) => {
    await expect(page.locator('text=Total Tiendas')).toBeVisible();
    await expect(page.locator('text=Total Equipos')).toBeVisible();
  });

  test('navigation works', async ({ page }) => {
    await page.click('text=Auditoría');
    await page.waitForURL('/audit');
    await expect(page.locator('h1')).toContainText('Auditoría');
  });
});
