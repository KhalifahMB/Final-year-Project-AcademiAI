import { test, expect } from '@playwright/test';
import { E2E_STUDENT, loginAs } from './helpers';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, E2E_STUDENT);
  });

  test('student dashboard renders', async ({ page }) => {
    await expect(page.locator('[data-testid="student-dashboard"]')).toBeVisible({ timeout: 15000 });
  });

  test('AI insight card renders', async ({ page }) => {
    await expect(page.locator('[data-testid="ai-insight-card"]')).toBeVisible({ timeout: 15000 });
  });

  test('navigate to chat from dashboard', async ({ page }) => {
    await page.click('[data-testid="dashboard-ask-ai"]');
    await page.waitForURL('**/chat', { timeout: 10000 });
    expect(page.url()).toContain('/chat');
  });
});
