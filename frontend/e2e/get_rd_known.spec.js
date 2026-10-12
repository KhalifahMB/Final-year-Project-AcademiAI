import { test } from '@playwright/test';

test('capture resource detail with known id', async ({ page }) => {
  await page.goto('http://localhost:5173/login');
  await page.fill('input[name="email"], input[type="email"]', 'muhammadelkufahn8442@gmail.com');
  await page.fill('input[name="password"], input[type="password"]', 'Khalifah@8442');
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 60000 });
  
  await page.goto('http://localhost:5173/resources/f389d678-49d4-40fc-b34f-b63a86bd763d');
  await page.waitForTimeout(20000);
  await page.screenshot({ path: '../Figure_5.5_Resource_Detail_Summary.png', fullPage: true });
});
