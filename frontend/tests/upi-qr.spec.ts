import { test, expect, type Page } from '@playwright/test';
import { STARTER_TEMPLATES } from '../src/lib/starterTemplates';

// The "Pay by UPI" QR code: the bill amount filled in, and left off receipts
// until there's a UPI ID in Settings

const API = 'http://localhost:8000';
const APP = 'http://localhost:5173';
const SHOTS = process.env.UPI_SHOTS;

async function cafe(page: Page, upi: string | null) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const password = `pw-${Math.random().toString(36).slice(2)}`;
  await page.request.post(`${API}/auth/register`, { data: { email, password } });
  const { access_token: token } = await (await page.request.post(`${API}/auth/login`, { form: { username: email, password } })).json();
  const headers = { Authorization: `Bearer ${token}` };
  await page.request.patch(`${API}/auth/me`, { headers, data: { invoicing_mode: 'receipts', business_name: 'Brew & Bloom', upi_id: upi ?? '' } });
  const canvas = STARTER_TEMPLATES.find((t) => t.id === 'cafe-receipt')!.canvas;
  const id = (await (await page.request.post(`${API}/templates`, { headers, data: { name: 'Cafe', canvas } })).json()).id as string;
  await page.addInitScript((t) => window.localStorage.setItem('token', t), token);
  return { id, headers };
}

async function fillBill(page: Page) {
  await page.getByLabel('Item 1 description').fill('Masala chai');
  await page.getByLabel('Item 1 quantity').fill('3');
  await page.getByLabel('Item 1 unit price').fill('20');
}

test('the café bill shows a UPI QR with the amount once there is a UPI ID', async ({ page }) => {
  const { id, headers } = await cafe(page, 'brewbloom@okhdfc');
  await page.goto(`${APP}/generate/${id}`);
  await fillBill(page);
  const preview = page.locator('[data-receipt-preview]');
  await expect(preview).toContainText('Scan to pay by UPI: brewbloom@okhdfc');
  await expect(preview.locator('svg')).toHaveCount(1);
  if (SHOTS) await preview.screenshot({ path: `${SHOTS}/upi-preview.png` });

  // The PDF has it too
  const filled = await page.request.post(`${API}/receipts`, { headers, data: { template_id: id, data: {
    business: { name: 'Brew & Bloom' }, receipt: { date: '2026-10-14', currency: 'INR', payment_method: 'UPI' }, custom: { table_no: '4' },
    items: [{ description: 'Masala chai', qty: '3', unit_price: '20' }],
  } } });
  expect(filled.status()).toBe(201);
});

test('without a UPI ID the code and its caption are left off', async ({ page }) => {
  const { id } = await cafe(page, null);
  await page.goto(`${APP}/generate/${id}`);
  await fillBill(page);
  const preview = page.locator('[data-receipt-preview]');
  await expect(preview).toContainText('Paid by');
  await expect(preview).not.toContainText('Scan to pay');
  await expect(preview.locator('svg')).toHaveCount(0);
});

test('any QR code becomes a Pay by UPI code in one click', async ({ page }) => {
  const { id } = await cafe(page, null);
  await page.goto(`${APP}/editor/${id}`);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __editorStore: { getState: () => { elements: unknown[] } } }).__editorStore.getState().elements.length)).toBeGreaterThan(0);
  await page.evaluate(() => {
    const store = (window as unknown as { __editorStore: { getState: () => { selectElement: (id: string) => void; updateElement: (id: string, f: (el: { props: { content: string } }) => void) => void } } }).__editorStore;
    store.getState().updateElement('upi', (el) => { el.props.content = 'https://example.com'; });
    store.getState().selectElement('upi');
  });
  const panel = page.locator('[data-upi-qr]');
  await panel.getByRole('button', { name: 'Make it a Pay by UPI code' }).click();
  await expect(panel).toContainText('the bill amount is filled in');
  await expect(panel).toContainText('Add your UPI ID in Settings');
});
