import { test } from '@playwright/test';

test('capture resource detail correct', async ({ page }) => {
  await page.goto('http://localhost:5173/login');
  await page.fill('input[name="email"], input[type="email"]', 'muhammadelkufahn8442@gmail.com');
  await page.fill('input[name="password"], input[type="password"]', 'Khalifah@8442');
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 60000 });
  await page.waitForTimeout(3000);
  
  await page.goto('http://localhost:5173/resources');
  await page.waitForTimeout(4000);
  
  // Click the first resource card - look for ResourceCard structure
  const resourceLink = page.locator('a[href^="/resources/"]').filter({ hasNotText: 'Upload' }).first();
  if (await resourceLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    await resourceLink.click();
    await page.waitForTimeout(12000);
    await page.screenshot({ path: '../Figure_5.5_Resource_Detail_Summary.png', fullPage: true });
  } else {
    // Fallback - look for card with role button
    const card = page.locator('[role="button"][tabindex="0"]').first();
    if (await card.isVisible({ timeout: 5000 }).catch(() => false)) {
      await card.click();
      await page.waitForTimeout(12000);
      await page.screenshot({ path: '../Figure_5.5_Resource_Detail_Summary.png', fullPage: true });
    } else {
      await page.screenshot({ path: '../Figure_5.5_Resource_Detail_Summary.png', fullPage: true });
    }
  }
});
