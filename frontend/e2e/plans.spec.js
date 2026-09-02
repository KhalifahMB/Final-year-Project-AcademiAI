import { test, expect } from '@playwright/test';
import { E2E_STUDENT, loginAs } from './helpers';

test.describe('Study Plans', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, E2E_STUDENT);
    await page.goto('/plans');
  });

  test('plans page loads', async ({ page }) => {
    await expect(page.locator('h1:has-text("Study Plans")')).toBeVisible({ timeout: 15000 });
  });

  test('create plan button visible', async ({ page }) => {
    await expect(page.locator('[data-testid="plans-create-btn"]')).toBeVisible();
  });

  test('status filters render', async ({ page }) => {
    await expect(page.locator('button:has-text("All")')).toBeVisible();
    await expect(page.locator('button:has-text("active")')).toBeVisible();
    await expect(page.locator('button:has-text("completed")')).toBeVisible();
  });
});
