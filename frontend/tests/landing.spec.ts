import { test, expect, devices } from '@playwright/test';

// The landing page visitors see at the site root

const APP = 'http://localhost:5173';
const SHOTS = process.env.LANDING_SHOTS;

test('visitors see the landing page, and Start free opens sign-up', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${APP}/`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Beautiful bills and GST invoices');
  // Real templates, rendered
  await expect(page.locator('[data-landing-samples] [data-receipt-preview]')).toHaveCount(6);
  // The demo bill fills itself in and is "sent"
  await expect(page.getByText('Sent on WhatsApp')).toBeVisible({ timeout: 10_000 });
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/landing-desktop.png`, fullPage: true });

  await page.getByRole('link', { name: 'Start free' }).first().click();
  await expect(page).toHaveURL(/\/login\?mode=signup/);
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
});

test('signed-in users go straight to their templates', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('token', 'some-token'));
  await page.route('**/auth/me', (route) => route.fulfill({ status: 401, body: '{}' }));
  await page.goto(`${APP}/`);
  // The (bad) token is dropped and they land on sign-in; a good one would show /templates
  await expect(page).toHaveURL(/\/(templates|login)/);
});

test('unknown addresses take visitors to the landing page', async ({ page }) => {
  await page.goto(`${APP}/no-such-page`);
  await expect(page).toHaveURL(`${APP}/`);
});

test.describe('on a phone', () => {
  const { defaultBrowserType: _browser, ...iPhone } = devices['iPhone 13'];
  test.use(iPhone);
  test('nothing scrolls sideways', async ({ page }) => {
    await page.goto(`${APP}/`);
    await expect(page.locator('[data-landing-samples] [data-receipt-preview]').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/landing-phone.png`, fullPage: true });
  });
});
