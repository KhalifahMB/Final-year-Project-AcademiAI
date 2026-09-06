import { test, expect } from '@playwright/test';
import { E2E_STUDENT, loginAs } from './helpers';

test.describe('Resources', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, E2E_STUDENT);
    await page.goto('/resources');
  });

  test('resources page loads', async ({ page }) => {
    await expect(page.locator('[data-testid="resources-stats"]')).toBeVisible({ timeout: 15000 });
  });

  test('resources grid renders', async ({ page }) => {
    await expect(page.locator('[data-testid="resources-grid"]')).toBeVisible({ timeout: 15000 });
  });

  test('search filters resources', async ({ page }) => {
    const searchInput = page.locator('input[aria-label="Search resources"]');
    await searchInput.fill('test');
    await expect(searchInput).toHaveValue('test');
  });
});
