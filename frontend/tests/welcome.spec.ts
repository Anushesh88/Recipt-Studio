import { test, expect, type Page } from '@playwright/test';

// The one-time question after sign-up: receipts, GST invoices or both

const API = 'http://localhost:8000';
const APP = 'http://localhost:5173';

async function signUp(page: Page) {
  await page.goto(`${APP}/login`);
  await page.getByRole('button', { name: "Don't have an account? Register" }).click();
  await page.getByLabel('Email').fill(`e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`);
  await page.getByLabel('Password').fill('long-enough-password');
  await page.getByRole('button', { name: 'Sign Up', exact: true }).click();
  await page.waitForURL('**/welcome');
}

const account = (page: Page) =>
  page.evaluate(async (api) => (await fetch(`${api}/auth/me`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })).json(), API);

test('a GST seller is set up for GST invoices', async ({ page }) => {
  await signUp(page);
  await page.getByLabel('GST tax invoices').check();
  await page.getByLabel('Business name').fill('Sharma Traders');
  await page.getByRole('textbox', { name: 'GSTIN' }).fill('27aapfu0939f1zv');
  await expect(page.getByText('Registered in Maharashtra (27)')).toBeVisible();
  await page.getByLabel('Business address').fill('12 MG Road, Pune');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForURL('**/templates');

  expect(await account(page)).toMatchObject({ invoicing_mode: 'gst', gstin: '27AAPFU0939F1ZV', business_name: 'Sharma Traders' });
  // GST starters first, and a blank template is a GST invoice that's already complete
  await expect(page.locator('[data-starter]').first()).toHaveAttribute('data-starter', 'gst-a4');
  await page.getByRole('button', { name: 'New blank GST invoice' }).click();
  await expect(page.locator('#document-type')).toContainText('GST tax invoice');
  await expect(page.locator('[data-gst-checklist]')).toContainText('Shows everything a GST tax invoice needs');

  // Asked once: Templates doesn't send them back
  await page.goto(`${APP}/templates`);
  await expect(page).toHaveURL(/\/templates$/);
});

test('a receipt user sees receipts first; skipping means both; Settings can change it', async ({ page }) => {
  await signUp(page);
  await expect(page.locator('[data-welcome-gst]')).toHaveCount(0); // no GST questions for receipts
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForURL('**/templates');
  await expect(page.locator('[data-starter]').first()).toHaveAttribute('data-starter', 'shop-receipt');
  await expect(page.getByRole('button', { name: 'New blank receipt' })).toBeVisible();

  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByLabel('You mostly create').selectOption('gst');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Settings saved.' })).toBeVisible();
  expect((await account(page)).invoicing_mode).toBe('gst');

  // A new account in the same tab is asked again
  await page.getByRole('link', { name: 'Templates' }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
  await signUp(page);
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.waitForURL('**/templates');
  expect((await account(page)).invoicing_mode).toBe('both');
});
