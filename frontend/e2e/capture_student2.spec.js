import { test } from '@playwright/test';

test('capture student views', async ({ page }) => {
  // Login as student
  await page.goto('http://localhost:5173/login');
  await page.fill('input[name="email"], input[type="email"]', 'muhammadelkufahn8442@gmail.com');
  await page.fill('input[name="password"], input[type="password"]', 'Khalifah@8442');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '../Figure_5.2_Student_Dashboard.png' });
  
  // AI Assistant / Chat
  await page.goto('http://localhost:5173/chat');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '../Figure_5.3_AI_Academic_Assistant.png' });
  
  // Resource Hub
  await page.goto('http://localhost:5173/resources');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '../Figure_5.4_Resource_Hub.png' });
  
  // Resource detail / general
  await page.goto('http://localhost:5173/resources');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '../Figure_5.5_Resource_Detail_Summary.png' });
  
  // Quiz workflow
  await page.goto('http://localhost:5173/quizzes');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '../Figure_5.6_Quiz_Workflow.png' });
});
