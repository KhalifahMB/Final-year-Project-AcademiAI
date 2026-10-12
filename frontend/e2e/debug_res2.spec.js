import { test } from '@playwright/test';

test('debug resources', async ({ page }) => {
  await page.goto('http://localhost:5173/login');
  await page.fill('input[name="email"], input[type="email"]', 'muhammadelkufahn8442@gmail.com');
  await page.fill('input[name="password"], input[type="password"]', 'Khalifah@8442');
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 60000 });
  await page.goto('http://localhost:5173/resources');
  await page.waitForTimeout(8000);
  const links = await page.locator('a[href*="/resources/"]').all();
  console.log('count:', links.length);
});
