import { test } from '@playwright/test';

test('capture resource detail final deep', async ({ page }) => {
  await page.goto('http://localhost:5173/login');
  await page.fill('input[name="email"], input[type="email"]', 'muhammadelkufahn8442@gmail.com');
  await page.fill('input[name="password"], input[type="password"]', 'Khalifah@8442');
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 60000 });
  
  await page.goto('http://localhost:5173/resources');
  await page.waitForTimeout(8000);
  
  // Look for any resource card - the list shows cards with click handlers
  // From the page code: onClick navigates to /resources/
  const cards = page.locator('[role="button"], button, div[tabindex="0"]').filter({ hasText: /.{5,}/ });
  const count = await cards.count();
  if (count > 0) {
    // Try to find one that looks like a resource card
    for (let i = 0; i < Math.min(count, 10); i++) {
      const card = cards.nth(i);
      const text = await card.textContent().catch(() => '');
      if (text && (text.includes('PDF') || text.includes('KB') || text.includes('MB') || text.length > 30)) {
        await card.click();
        break;
      }
    }
  }
  await page.waitForTimeout(20000); // give time for content to load
  await page.screenshot({ path: '../Figure_5.5_Resource_Detail_Summary.png', fullPage: true });
});
