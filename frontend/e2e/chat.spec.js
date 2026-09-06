import { test, expect } from '@playwright/test';
import { E2E_STUDENT, loginAs } from './helpers';

test.describe('Chat', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, E2E_STUDENT);
    await page.goto('/chat');
  });

  test('chat page renders input', async ({ page }) => {
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="chat-send"]')).toBeVisible();
  });

  test('can type message', async ({ page }) => {
    const input = page.locator('[data-testid="chat-input"]');
    await input.fill('Hello AI');
    await expect(input).toHaveValue('Hello AI');
  });

  test('send button disabled when empty', async ({ page }) => {
    const sendBtn = page.locator('[data-testid="chat-send"]');
    await expect(sendBtn).toBeDisabled();
  });
});
