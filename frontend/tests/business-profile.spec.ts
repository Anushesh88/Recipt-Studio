import { test, expect, type Page } from '@playwright/test';
import { STARTER_TEMPLATES } from '../src/lib/starterTemplates';

// The business profile in Settings, printed by templates (empty lines left out)

const API = 'http://localhost:8000';
const APP = 'http://localhost:5173';

async function account(page: Page) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const password = `pw-${Math.random().toString(36).slice(2)}`;
  await page.request.post(`${API}/auth/register`, { data: { email, password } });
  const { access_token: token } = await (await page.request.post(`${API}/auth/login`, { form: { username: email, password } })).json();
  const headers = { Authorization: `Bearer ${token}` };
  await page.request.patch(`${API}/auth/me`, { headers, data: { invoicing_mode: 'receipts', business_name: 'Glow Studio' } });
  await page.addInitScript((t) => window.localStorage.setItem('token', t), token);
  return headers;
}

test('Settings saves the business details and checks them', async ({ page }) => {
  await account(page);
  await page.goto(`${APP}/settings`);
  const profile = page.locator('[data-business-profile]');
  await profile.getByLabel('UPI ID').fill('glow studio');
  await profile.getByLabel('PAN').fill('abcpk1234d');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(profile).toContainText('A UPI ID looks like yourname@okhdfc');

  await profile.getByLabel('UPI ID').fill('glowstudio@okhdfc');
  await profile.getByLabel('Phone').fill('+91 98450 12345');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByText('Settings saved.')).toBeVisible();
  await page.reload();
  await expect(profile.getByLabel('PAN')).toHaveValue('ABCPK1234D');
  await expect(profile.getByLabel('Phone')).toHaveValue('+91 98450 12345');
});

test('templates print the details and leave out empty lines', async ({ page }) => {
  const headers = await account(page);
  await page.request.patch(`${API}/auth/me`, { headers, data: { business_phone: '+91 98450 12345' } });
  const canvas = STARTER_TEMPLATES.find((t) => t.id === 'salon-receipt')!.canvas;
  const id = (await (await page.request.post(`${API}/templates`, { headers, data: { name: 'Salon', canvas } })).json()).id;
  await page.goto(`${APP}/generate/${id}`);
  const preview = page.locator('[data-receipt-preview]');
  await expect(preview).toContainText('+91 98450 12345');
  // The form doesn't ask for details that come from Settings
  await expect(page.getByLabel('Business phone')).toHaveCount(0);
});

test('a missing detail leaves no stray label on the receipt', async ({ page }) => {
  await account(page);
  const canvas = STARTER_TEMPLATES.find((t) => t.id === 'cafe-receipt')!.canvas;
  await page.goto(`${APP}/templates`);
  const headers = { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('token'))}` };
  const id = (await (await page.request.post(`${API}/templates`, { headers, data: { name: 'Cafe', canvas } })).json()).id;
  await page.goto(`${APP}/generate/${id}`);
  await expect(page.locator('[data-receipt-preview]')).toContainText('Paid by');
  await expect(page.locator('[data-receipt-preview]')).not.toContainText('UPI:');
});
