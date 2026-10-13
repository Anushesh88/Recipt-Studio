import { test, expect, devices, type Page } from '@playwright/test';
import { STARTER_TEMPLATES } from '../src/lib/starterTemplates';

// The app on a phone: nothing scrolls sideways, the editor works by tapping,
// Generate keeps its actions in reach, History and the report fit

const API = 'http://localhost:8000';
const APP = 'http://localhost:5173';

const { defaultBrowserType: _browser, ...iPhone } = devices['iPhone 13'];
test.use(iPhone);

async function shop(page: Page) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const password = `pw-${Math.random().toString(36).slice(2)}`;
  await page.request.post(`${API}/auth/register`, { data: { email, password } });
  const { access_token: token } = await (await page.request.post(`${API}/auth/login`, { form: { username: email, password } })).json();
  const headers = { Authorization: `Bearer ${token}` };
  await page.request.patch(`${API}/auth/me`, { headers, data: { invoicing_mode: 'both', business_name: 'Brew & Bloom Café' } });
  const canvas = STARTER_TEMPLATES.find((t) => t.id === 'shop-receipt')!.canvas;
  const template = (await (await page.request.post(`${API}/templates`, { headers, data: { name: 'Shop receipt', canvas } })).json()).id as string;
  await page.request.post(`${API}/receipts`, {
    headers,
    data: { template_id: template, data: { business: { name: 'Brew & Bloom Café' }, customer: { name: 'Asha' }, receipt: { date: '2026-10-05', currency: 'INR' }, items: [{ description: 'Cappuccino', qty: '2', unit_price: '180' }] } },
  });
  await page.addInitScript((t) => window.localStorage.setItem('token', t), token);
  return { template };
}

const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test('no page scrolls sideways', async ({ page }) => {
  const { template } = await shop(page);
  for (const path of ['/templates', '/history', '/reports', '/settings', `/generate/${template}`, `/editor/${template}`, '/privacy']) {
    await page.goto(`${APP}${path}`);
    await page.waitForLoadState('networkidle');
    expect(await sideways(page), path).toBe(0);
  }
});

test('the editor works by tapping: add, edit, undo', async ({ page }) => {
  const { template } = await shop(page);
  await page.goto(`${APP}/editor/${template}`);
  const tools = page.getByRole('navigation', { name: 'Editor tools' });
  await expect(tools).toBeVisible();
  // The page fits the screen; the desktop side panels aren't there
  const box = (await page.locator('#canvas').boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await expect(page.getByRole('complementary', { name: 'Inspector' })).toHaveCount(0);

  const count = () => page.evaluate(() => (window as unknown as { __editorStore: { getState: () => { elements: unknown[] } } }).__editorStore.getState().elements.length);
  const before = await count();
  await tools.getByRole('button', { name: 'Add' }).click();
  await page.locator('[data-sheet="add"]').getByRole('button', { name: 'QR Code' }).click();
  await expect(page.locator('[data-sheet="add"]')).toHaveCount(0);
  expect(await count()).toBe(before + 1);

  await tools.getByRole('button', { name: 'Edit QR code' }).click();
  const sheet = page.locator('[data-sheet="edit"]');
  await expect(sheet.getByText('Encoded content')).toBeVisible();
  await sheet.getByRole('button', { name: 'Close' }).click();

  await tools.getByRole('button', { name: 'Undo' }).click();
  expect(await count()).toBe(before);
  await expect(tools.getByRole('button', { name: 'Page' })).toBeVisible();
  await tools.getByRole('button', { name: 'Page' }).click();
  await expect(page.locator('[data-sheet="edit"]').getByText('Page size')).toBeVisible();
});

test('Generate keeps the total and Create in reach', async ({ page }) => {
  const { template } = await shop(page);
  await page.goto(`${APP}/generate/${template}`);
  const bar = page.locator('[data-generate-bar]');
  await expect(bar).toBeInViewport();
  await page.getByLabel('Item 1 description').fill('Masala chai');
  await page.getByLabel('Item 1 quantity').fill('3');
  await page.getByLabel('Item 1 unit price').fill('20');
  await expect(bar.locator('[data-bar-total]')).toHaveText('₹60.00');
  await bar.getByRole('button', { name: 'Preview' }).click();
  await expect(page.locator('[data-receipt-preview]')).toBeInViewport();
  await expect(bar).toBeInViewport();
  await bar.getByRole('button', { name: 'Create receipt' }).click();
  await expect(page.getByText('Receipt R-0002 saved')).toBeVisible();
  await expect(bar).toHaveCount(0);
});

test('History shows cards, and the report keeps the amounts on screen', async ({ page }) => {
  await shop(page);
  await page.goto(`${APP}/history`);
  const card = page.locator('[data-receipt-card="R-0001"]');
  await expect(card).toContainText('Asha');
  await expect(card).toContainText('INR 360.00');
  await expect(card.getByRole('button', { name: 'Send R-0001 on WhatsApp' })).toBeInViewport();

  await page.goto(`${APP}/reports`);
  await page.getByLabel('From').fill('2026-10-01');
  await page.getByLabel('To').fill('2026-10-31');
  const row = page.locator('[data-report-item="Cappuccino"]');
  await expect(row).toContainText('₹360.00');
  const cell = (await row.locator('td').last().boundingBox())!;
  expect(cell.x + cell.width).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test('WhatsApp on a phone sends the PDF file, not a link', async ({ page }) => {
  await shop(page);
  await page.addInitScript(() => {
    const w = window as unknown as { __shared?: { names: string[]; text: string } };
    Object.assign(navigator, {
      canShare: () => true,
      share: async (data: { files: File[]; text: string }) => { w.__shared = { names: data.files.map((f) => f.type), text: data.text }; },
    });
  });
  await page.goto(`${APP}/history`);
  await page.getByRole('button', { name: 'Send R-0001 on WhatsApp' }).click();
  const send = page.getByRole('button', { name: 'Send PDF on WhatsApp' });
  await expect(send).toBeEnabled();
  await send.click();
  const shared = await page.evaluate(() => (window as unknown as { __shared: { names: string[]; text: string } }).__shared);
  expect(shared.names).toEqual(['application/pdf']);
  expect(shared.text).toContain('R-0001');
  expect(shared.text).not.toContain('http');
});
