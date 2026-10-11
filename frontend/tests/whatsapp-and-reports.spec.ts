import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { STARTER_TEMPLATES } from '../src/lib/starterTemplates';

// Send on WhatsApp (a message with a private PDF link) and the sales report

const API = 'http://localhost:8000';
const APP = 'http://localhost:5173';

async function shopWithSales(page: Page): Promise<string> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const password = `pw-${Math.random().toString(36).slice(2)}`;
  await page.request.post(`${API}/auth/register`, { data: { email, password } });
  const { access_token: token } = await (await page.request.post(`${API}/auth/login`, { form: { username: email, password } })).json();
  const headers = { Authorization: `Bearer ${token}` };
  await page.request.patch(`${API}/auth/me`, { headers, data: { invoicing_mode: 'both', business_name: 'Brew & Bloom Café' } });
  const canvas = STARTER_TEMPLATES.find((t) => t.id === 'shop-receipt')!.canvas;
  const template = await (await page.request.post(`${API}/templates`, { headers, data: { name: 'Café', canvas } })).json();
  for (const [date, customer, items] of [
    ['2026-09-30', 'Old', [['Cappuccino', '9', '180']]], // last month: not in the report below
    ['2026-10-01', 'Asha', [['Cappuccino', '2', '180'], ['Masala chai', '1', '60']]],
    ['2026-10-05', 'Meera', [['Masala chai', '4', '60'], ['Cappuccino', '1', '180']]],
  ] as const) {
    const res = await page.request.post(`${API}/receipts`, {
      headers,
      data: {
        template_id: template.id,
        data: {
          business: { name: 'Brew & Bloom Café' }, customer: { name: customer }, receipt: { date, currency: 'INR' },
          items: items.map(([description, qty, unit_price]) => ({ description, qty, unit_price })), tax_rate: '0.05', discount: '10',
        },
      },
    });
    expect(res.status()).toBe(201);
  }
  await page.addInitScript((t) => window.localStorage.setItem('token', t), token);
  return token;
}

test('WhatsApp opens a chat with the customer and a link to the PDF', async ({ page }) => {
  await shopWithSales(page);
  await page.goto(`${APP}/history`);
  await page.getByRole('button', { name: 'Send R-0003 on WhatsApp' }).click();
  const popup = page.locator('[data-whatsapp]');
  await expect(popup.getByLabel('Message')).toHaveValue(/^Hello Meera,\nHere is your receipt R-0003 from Brew & Bloom Café for ₹430\.50\./);

  await popup.getByLabel("Customer's WhatsApp number").fill('123');
  await expect(popup).toContainText('Enter a 10-digit mobile number');
  await expect(popup.getByRole('link', { name: 'Open WhatsApp' })).toHaveCount(0);
  await popup.getByLabel("Customer's WhatsApp number").fill('98765 43210');
  const href = await popup.getByRole('link', { name: 'Open WhatsApp' }).getAttribute('href');
  const url = new URL(href!);
  expect(`${url.origin}${url.pathname}`).toBe('https://wa.me/919876543210');

  // The link in the message opens the PDF for anyone, signed in or not
  const link = /View or download it: (\S+)/.exec(url.searchParams.get('text')!)![1];
  expect(link).toMatch(new RegExp(`^${API}/public/receipts/`));
  const pdf = await page.request.get(link, { headers: {} });
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toBe('application/pdf');
});

test('the sales report adds up each item and the totals for the period', async ({ page }) => {
  await shopWithSales(page);
  await page.goto(`${APP}/reports`);
  await page.getByLabel('From').fill('2026-10-01');
  await page.getByLabel('To').fill('2026-10-31');
  await expect(page.locator('[data-report-period]')).toContainText('2026-10-01 to 2026-10-31 · 2 receipts');

  const rows = page.locator('[data-report-item]');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toHaveText(/Cappuccino\s*3\s*2\s*₹540\.00/);
  await expect(rows.nth(1)).toHaveText(/Masala chai\s*5\s*2\s*₹300\.00/);
  // 840 sold, 10 off each receipt, 5% tax on the rest: (420 - 10) + (420 - 10) = 820 taxable, 41 tax
  await expect(page.locator('[data-total="Subtotal"]')).toContainText('₹840.00');
  await expect(page.locator('[data-total="Discount"]')).toContainText('−₹20.00');
  await expect(page.locator('[data-total="Tax"]')).toContainText('₹41.00');
  await expect(page.locator('[data-total="Total sales"]')).toContainText('₹861.00');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('sales-2026-10-01-to-2026-10-31.csv');
  const csv = readFileSync((await file.path())!, 'utf8');
  expect(csv).toContain('Cappuccino,,3,2,540.00');
  expect(csv).toContain('Total sales,,,,861.00');

  // Last month has the other receipt only
  await page.getByLabel('From').fill('2026-09-01');
  await page.getByLabel('To').fill('2026-09-30');
  await expect(page.locator('[data-report-period]')).toContainText('1 receipt');
  await expect(rows).toHaveCount(1);
  // An impossible period is caught before asking the server
  await page.getByLabel('To').fill('2026-08-01');
  await expect(page.getByRole('alert')).toHaveText('Pick a start date on or before the end date.');
});
