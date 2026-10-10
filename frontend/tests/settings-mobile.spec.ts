import { test, expect, devices, type Page } from '@playwright/test';

// Account settings drive the Generate page (prefix, numbering mode, business
// name), and the Generate page fits a phone screen without sideways scrolling.

const API = 'http://localhost:8000';
const APP = 'http://localhost:5173';

const CANVAS = {
  schemaVersion: 1,
  page: { preset: 'thermal80', width: 302, height: 400, heightMode: 'auto', background: '#FFFFFF', margin: 12 },
  elements: [
    {
      id: 'business', type: 'text', x: 12, y: 12, width: 278, height: 32, zIndex: 1, locked: false,
      props: { content: '{{business.name}} · {{receipt.number}}', fontFamily: 'Inter', fontSize: 14, fontWeight: 400, color: '#111111', align: 'left', lineHeight: 1.3 },
    },
  ],
};

// A fresh account and one template; returns the template id
async function setUp(page: Page): Promise<string> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const password = `pw-${Math.random().toString(36).slice(2)}`;
  expect((await page.request.post(`${API}/auth/register`, { data: { email, password } })).status()).toBe(200);
  const { access_token: token } = await (await page.request.post(`${API}/auth/login`, { form: { username: email, password } })).json();
  await page.addInitScript((t) => window.localStorage.setItem('token', t), token);
  const created = await page.request.post(`${API}/templates`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: 'Settings check', canvas: CANVAS },
  });
  expect(created.status()).toBe(201);
  return (await created.json()).id;
}

test('settings change the next number and pre-fill the business name', async ({ page }) => {
  const templateId = await setUp(page);
  await page.goto(`${APP}/settings`);

  await page.getByLabel('Business name').fill('Corner Bakery');
  const prefix = page.getByLabel('Prefix for sequential numbers');
  await prefix.fill('INV/');
  await expect(page.locator('[data-next-number]')).toHaveText('INV/0001');

  // Characters outside the allowed set are refused before saving
  await prefix.fill('INV<');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByText('Use letters, digits, spaces and - _ / # . only')).toBeVisible();

  await prefix.fill('INV/');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByRole('status')).toHaveText('Settings saved.');

  await page.goto(`${APP}/generate/${templateId}`);
  await expect(page.getByLabel('Receipt number')).toHaveAttribute('placeholder', 'INV/0001');
  await expect(page.locator('[id="field-business.name"]')).toHaveValue('Corner Bakery');

  // Random IDs: the prefix no longer applies
  await page.goto(`${APP}/settings`);
  await page.getByLabel('Random ID').check();
  await expect(prefix).toBeDisabled();
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByRole('status')).toHaveText('Settings saved.');
  await page.goto(`${APP}/generate/${templateId}`);
  await expect(page.getByLabel('Receipt number')).toHaveAttribute('placeholder', 'Random ID');
});

test.describe('on a phone', () => {
  // Phone viewport and touch, still in Chromium (the browser type is per worker)
  const { defaultBrowserType: _browser, ...phone } = devices['iPhone 13'];
  test.use(phone);

  test('the Generate page fits the screen', async ({ page }) => {
    const templateId = await setUp(page);
    await page.goto(`${APP}/generate/${templateId}`);
    await page.waitForSelector('[data-generate-form]');
    await page.getByRole('button', { name: 'Add item' }).click();

    const metrics = await page.evaluate(() => ({
      viewport: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      form: document.querySelector('[data-generate-form]')!.getBoundingClientRect(),
      preview: document.querySelector('[data-receipt-preview]')!.getBoundingClientRect(),
    }));
    expect(metrics.scrollWidth).toBe(metrics.viewport);
    expect(metrics.form.right).toBeLessThanOrEqual(metrics.viewport);
    // Stacked: the preview comes after the form and fits the width
    expect(metrics.preview.top).toBeGreaterThanOrEqual(metrics.form.bottom);
    expect(metrics.preview.right).toBeLessThanOrEqual(metrics.viewport);
  });
});
