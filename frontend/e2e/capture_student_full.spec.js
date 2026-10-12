import { test } from '@playwright/test';

test('capture student views full', async ({ page }) => {
  await page.goto('http://localhost:5173/login');
  await page.fill('input[name="email"], input[type="email"]', 'muhammadelkufahn8442@gmail.com');
  await page.fill('input[name="password"], input[type="password"]', 'Khalifah@8442');
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '../Figure_5.2_Student_Dashboard.png', fullPage: true });
  
  await page.goto('http://localhost:5173/chat');
  await page.waitForURL(/chat/, { timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '../Figure_5.3_AI_Academic_Assistant.png', fullPage: true });
  
  await page.goto('http://localhost:5173/resources');
  await page.waitForURL(/resources/, { timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '../Figure_5.4_Resource_Hub.png', fullPage: true });
  
  await page.screenshot({ path: '../Figure_5.5_Resource_Detail_Summary.png', fullPage: true });
  
  await page.goto('http://localhost:5173/quizzes');
  await page.waitForURL(/quizzes/, { timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '../Figure_5.6_Quiz_Workflow.png', fullPage: true });
});
