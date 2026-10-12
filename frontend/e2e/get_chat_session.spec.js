import { test } from '@playwright/test';

test('capture chat session', async ({ page }) => {
  await page.goto('http://localhost:5173/login');
  await page.fill('input[name="email"], input[type="email"]', 'muhammadelkufahn8442@gmail.com');
  await page.fill('input[name="password"], input[type="password"]', 'Khalifah@8442');
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 60000 });
  
  await page.goto('http://localhost:5173/chat?session=25695d61-e307-4c73-9a6d-63d5527a998d');
  await page.waitForTimeout(20000);
  await page.screenshot({ path: '../Figure_5.3_AI_Academic_Assistant.png', fullPage: true });
});
