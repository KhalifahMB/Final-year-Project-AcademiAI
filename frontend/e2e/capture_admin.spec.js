import { test } from '@playwright/test';

test('capture admin views', async ({ page }) => {
  await page.goto('http://localhost:5173/login');
  await page.fill('input[name="email"], input[type="email"]', 'muhammadelkufahn27@gmail.com');
  await page.fill('input[name="password"], input[type="password"]', 'Khalifah@8442');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '../Figure_5.8_Admin_Workspace.png' });
});
