export const E2E_STUDENT = {
  email: 'student@e2e.local',
  password: 'E2EPass123!',
};

export async function loginAs(page, { email, password } = E2E_STUDENT, { waitFor = '/dashboard' } = {}) {
  await page.goto('/login');
  await page.fill('[data-testid="login-email"]', email);
  await page.fill('[data-testid="login-password"]', password);
  await Promise.all([
    page.waitForURL(`**${waitFor}`, { timeout: 30000 }),
    page.click('[data-testid="login-submit"]'),
  ]);
}
