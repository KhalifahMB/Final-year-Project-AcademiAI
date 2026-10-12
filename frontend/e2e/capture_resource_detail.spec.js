import { test } from '@playwright/test';

test('capture resource detail', async ({ page }) => {
  await page.goto('http://localhost:5173/login');
  await page.fill('input[name="email"], input[type="email"]', 'muhammadelkufahn8442@gmail.com');
  await page.fill('input[name="password"], input[type="password"]', 'Khalifah@8442');
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 60000 });
  
  // Go to resources first
  await page.goto('http://localhost:5173/resources');
  await page.waitForURL(/resources/, { timeout: 60000 });
  await page.waitForTimeout(3000);
  
  // Try to click on the first resource/card if it exists
  const firstResource = await page.locator('a[href*="/resources/"]').first();
  if (await firstResource.isVisible({ timeout: 5000 }).catch(() => false)) {
    await firstResource.click();
    await page.waitForURL(/resources\/[a-zA-Z0-9-]/, { timeout: 60000 });
    await page.waitForTimeout(3000);
  }
  await page.screenshot({ path: '../Figure_5.5_Resource_Detail_Summary.png', fullPage: true });
});
