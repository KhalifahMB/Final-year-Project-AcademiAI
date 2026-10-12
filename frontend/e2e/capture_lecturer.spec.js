import { test } from '@playwright/test';

test('capture lecturer views', async ({ page }) => {
  await page.goto('http://localhost:5173/login');
  await page.fill('input[name="email"], input[type="email"]', 'lecturer@gmail.com');
  await page.fill('input[name="password"], input[type="password"]', 'lecturerpassword');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '../Figure_5.7_Lecturer_Workspace.png' });
});
