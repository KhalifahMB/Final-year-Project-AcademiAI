import { test } from '@playwright/test';

test('get resource detail', async ({ page }) => {
  await page.goto('http://localhost:5173/login');
  await page.fill('input[name="email"], input[type="email"]', 'muhammadelkufahn8442@gmail.com');
  await page.fill('input[name="password"], input[type="password"]', 'Khalifah@8442');
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 60000 });
  await page.goto('http://localhost:5173/resources');
  await page.waitForTimeout(8000);
  const link = page.locator('a[href*="/resources/"]').first();
  const href = await link.getAttribute('href');
  await link.click();
  await page.waitForTimeout(20000);
  await page.screenshot({ path: '../Figure_5.5_Resource_Detail_Summary.png', fullPage: true });
});
