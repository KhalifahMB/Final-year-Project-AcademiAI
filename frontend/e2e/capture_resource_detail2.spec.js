import { test } from '@playwright/test';

test('capture resource detail final', async ({ page }) => {
  await page.goto('http://localhost:5173/login');
  await page.fill('input[name="email"], input[type="email"]', 'muhammadelkufahn8442@gmail.com');
  await page.fill('input[name="password"], input[type="password"]', 'Khalifah@8442');
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 60000 });
  
  await page.goto('http://localhost:5173/resources');
  await page.waitForURL(/resources/, { timeout: 60000 });
  await page.waitForTimeout(5000);
  
  // Try to click on first clickable resource item
  const selectors = [
    'a[href*="/resources/"]:not([href$="/upload"])',
    '[data-testid*="resource"] a',
    '.resource-card a',
    'article a[href*="/resources/"]'
  ];
  let clicked = false;
  for (const selector of selectors) {
    const el = page.locator(selector).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      await el.click();
      clicked = true;
      break;
    }
  }
  if (clicked) {
    await page.waitForTimeout(8000);
  } else {
    await page.waitForTimeout(3000);
  }
  await page.screenshot({ path: '../Figure_5.5_Resource_Detail_Summary.png', fullPage: true });
});
