import { test } from '@playwright/test';

test('capture lecturer views full', async ({ page }) => {
  await page.goto('http://localhost:5173/login');
  await page.fill('input[name="email"], input[type="email"]', 'lecturer@gmail.com');
  await page.fill('input[name="password"], input[type="password"]', 'lecturerpassword');
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 60000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: '../Figure_5.7_Lecturer_Workspace.png', fullPage: true });
});
