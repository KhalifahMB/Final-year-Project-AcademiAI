import { test } from '@playwright/test';

test('capture full landing', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '../Figure_5.1_Landing_Login.png', fullPage: true });
});
