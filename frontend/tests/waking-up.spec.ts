import { test, expect } from '@playwright/test';

// Free hosting sleeps when idle: a slow first answer gets a friendly notice

const API = 'http://localhost:8000';
const APP = 'http://localhost:5173';

test('a slow first answer says the server is waking up, then goes away', async ({ page }) => {
  await page.route(`${API}/auth/providers`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 4500)); // a sleeping server starting
    await route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, json: { google_client_id: null } });
  });
  await page.goto(`${APP}/login`);
  const notice = page.locator('[data-waking-up]');
  await expect(notice).toHaveText(/Waking up the server/, { timeout: 4000 });
  await expect(notice).toHaveCount(0, { timeout: 5000 });
});

test('a quick answer shows nothing', async ({ page }) => {
  await page.goto(`${APP}/login`);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.waitForTimeout(3500);
  await expect(page.locator('[data-waking-up]')).toHaveCount(0);
});
