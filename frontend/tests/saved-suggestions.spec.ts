import { test, expect, devices, type Page } from '@playwright/test';
import { STARTER_TEMPLATES } from '../src/lib/starterTemplates';

// Items and customers from earlier receipts, offered in a dropdown on the
// Generate form: one tap fills them in again

const API = 'http://localhost:8000';
const APP = 'http://localhost:5173';
const SHOTS = process.env.SUGGEST_SHOTS;

async function shopWithHistory(page: Page) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const password = `pw-${Math.random().toString(36).slice(2)}`;
  await page.request.post(`${API}/auth/register`, { data: { email, password } });
  const { access_token: token } = await (await page.request.post(`${API}/auth/login`, { form: { username: email, password } })).json();
  const headers = { Authorization: `Bearer ${token}` };
  await page.request.patch(`${API}/auth/me`, { headers, data: { invoicing_mode: 'receipts', business_name: 'Glow Studio' } });
  const canvas = STARTER_TEMPLATES.find((t) => t.id === 'salon-receipt')!.canvas;
  const id = (await (await page.request.post(`${API}/templates`, { headers, data: { name: 'Salon', canvas } })).json()).id as string;
  // An earlier receipt: these are now remembered
  const first = await page.request.post(`${API}/receipts`, { headers, data: { template_id: id, data: {
    business: { name: 'Glow Studio' }, customer: { name: 'Meera Iyer' }, receipt: { date: '2026-10-10', currency: 'INR', payment_method: 'Card' },
    custom: { stylist: 'Sana' },
    items: [{ description: 'Haircut & styling', qty: '1', unit_price: '800' }, { description: 'Hair spa', qty: '1', unit_price: '1500' }],
  } } });
  expect(first.status()).toBe(201);
  await page.addInitScript((t) => window.localStorage.setItem('token', t), token);
  return id;
}

for (const [name, device] of [['desktop', {}], ['phone', (({ defaultBrowserType: _b, ...d }) => d)(devices['iPhone 13'])]] as const) {
  test.describe(name, () => {
    test.use(device);
    test('saved items and customers are one tap away', async ({ page }) => {
      const id = await shopWithHistory(page);
      await page.goto(`${APP}/generate/${id}`);

      // Tapping the box lists what was used before, with prices
      const description = page.getByLabel('Item 1 description');
      await description.click();
      const list = page.getByRole('listbox', { name: 'Saved items' });
      await expect(list.getByRole('option')).toHaveCount(2);
      await expect(list.getByRole('option', { name: /Hair spa/ })).toContainText('₹1500.00');
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/suggest-${name}.png` });

      // Typing narrows it; picking fills in the price
      await description.fill('spa');
      await expect(list.getByRole('option')).toHaveCount(1);
      await list.getByRole('option', { name: /Hair spa/ }).click();
      await expect(description).toHaveValue('Hair spa');
      await expect(page.getByLabel('Item 1 unit price')).toHaveValue('1500.00');
      await expect(page.locator('[data-receipt-preview]')).toContainText('Hair spa');

      // The keyboard works too
      await page.getByRole('button', { name: 'Add item' }).click();
      const second = page.getByLabel('Item 2 description');
      await second.click();
      await second.press('ArrowDown');
      await second.press('Enter');
      await expect(second).toHaveValue('Haircut & styling');
      await expect(page.getByLabel('Item 2 unit price')).toHaveValue('800.00');

      // Customers too
      const customer = page.getByLabel('Customer name');
      await customer.click();
      await page.getByRole('listbox', { name: 'Saved customers' }).getByRole('option', { name: /Meera Iyer/ }).click();
      await expect(customer).toHaveValue('Meera Iyer');

      // Something new can still be typed
      await page.getByRole('button', { name: 'Add item' }).click();
      await page.getByLabel('Item 3 description').fill('Beard trim');
      await expect(page.getByRole('listbox', { name: 'Saved items' })).toHaveCount(0);
    });
  });
}
