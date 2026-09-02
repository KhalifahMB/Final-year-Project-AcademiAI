import { test, expect } from '@playwright/test';
import { E2E_STUDENT, loginAs } from './helpers';

test.describe('Authentication', () => {
  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-email"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-password"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-submit"]')).toBeVisible();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="login-email"]', 'wrong@example.com');
    await page.fill('[data-testid="login-password"]', 'wrongpassword');
    await page.click('[data-testid="login-submit"]');
    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 15000 });
  });

  test('unauthenticated user redirected to login', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL('**/login', { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });

  test('valid student credentials log in successfully', async ({ page }) => {
    await loginAs(page, E2E_STUDENT);
    expect(page.url()).toContain('/dashboard');
  });
});
