import { test } from '@playwright/test';

test('capture resource detail best', async ({ page }) => {
  await page.goto('http://localhost:5173/login');
  await page.fill('input[name="email"], input[type="email"]', 'muhammadelkufahn8442@gmail.com');
  await page.fill('input[name="password"], input[type="password"]', 'Khalifah@8442');
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 60000 });
  
  await page.goto('http://localhost:5173/resources');
  await page.waitForTimeout(8000); // wait for data
  
  // Resource cards navigate to /resources/:id - look for card clickable
  const card = page.locator('.cursor-pointer').filter({ hasText: /pdf|document|lecture|assignment|chapter/i }).first();
  if (await card.isVisible({ timeout: 5000 }).catch(() => false)) {
    await card.click();
  } else {
    const anyCard = page.locator('.cursor-pointer').first();
    if (await anyCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await anyCard.click();
    }
  }
  await page.waitForTimeout(15000);
  await page.screenshot({ path: '../Figure_5.5_Resource_Detail_Summary.png', fullPage: true });
});
