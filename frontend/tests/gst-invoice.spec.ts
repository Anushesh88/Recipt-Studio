import { test, expect, devices, type APIRequestContext, type Page } from '@playwright/test';
import { STARTER_TEMPLATES } from '../src/lib/starterTemplates';

// GST tax invoices (CGST rule 46) and the speed features around them: starter
// templates, saved customers / items, "Use again", sharing.

const API = 'http://localhost:8000';
const APP = 'http://localhost:5173';
const TOLERANCE_PX = 1;

const SUPPLIER_GSTIN = '27AAPFU0939F1ZV'; // Maharashtra (27)
const BUYER_GSTIN = '29AAGCB7383J1Z4';    // Karnataka (29)
const PROFILE = { business_name: 'Sharma Traders', business_address: '12 MG Road, Pune', gstin: SUPPLIER_GSTIN };

// Today's Indian financial year, e.g. "26-27"
function financialYearLabel(): string {
  const now = new Date();
  const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const two = (n: number) => String(n % 100).padStart(2, '0');
  return `${two(start)}-${two(start + 1)}`;
}

const starter = (id: string) => STARTER_TEMPLATES.find((t) => t.id === id)!.canvas;

async function newAccount(page: Page, profile?: Record<string, string>): Promise<string> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const password = `pw-${Math.random().toString(36).slice(2)}`;
  expect((await page.request.post(`${API}/auth/register`, { data: { email, password } })).status()).toBe(200);
  const { access_token: token } = await (await page.request.post(`${API}/auth/login`, { form: { username: email, password } })).json();
  if (profile) {
    const saved = await page.request.patch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` }, data: profile });
    expect(saved.status()).toBe(200);
  }
  await page.addInitScript((t) => window.localStorage.setItem('token', t), token);
  return token;
}

async function newTemplate(request: APIRequestContext, token: string, canvas: unknown, name = 'Invoice') {
  const res = await request.post(`${API}/templates`, { headers: { Authorization: `Bearer ${token}` }, data: { name, canvas } });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()).id as string;
}

test('Settings check the GSTIN and preview the invoice number', async ({ page }) => {
  await newAccount(page);
  await page.goto(`${APP}/settings`);
  await page.getByLabel('Business name').fill('Sharma Traders');
  await page.getByLabel('GSTIN').fill('27aapfu0939f1zx'); // typo in the last character
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByText("This GSTIN's last character doesn't match")).toBeVisible();

  await page.getByLabel('GSTIN').fill(SUPPLIER_GSTIN.toLowerCase());
  await expect(page.getByText('Registered in Maharashtra (27)')).toBeVisible();
  await page.getByLabel('Business address').fill('12 MG Road, Pune');
  await page.getByLabel('Invoice number prefix').fill('SA/');
  await expect(page.locator('[data-next-invoice]')).toHaveText(`SA/${financialYearLabel()}/0001`);
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Settings saved.' })).toBeVisible();
  await expect(page.getByLabel('GSTIN')).toHaveValue(SUPPLIER_GSTIN);
});

test('a GST template keeps its required fields; a receipt can be completed into one', async ({ page }) => {
  const token = await newAccount(page, { invoicing_mode: 'gst' }); // GST starters shown first
  await page.goto(`${APP}/templates`);
  await page.locator('[data-starter="gst-a4"]').click();
  await page.waitForURL(/\/editor\/[0-9a-f-]{36}$/);
  await expect(page.locator('[data-gst-checklist]')).toContainText('Shows everything a GST tax invoice needs');

  // The signature is required: deleting it is refused with the reason
  await page.locator('[data-element-id="sign"]').click();
  await page.keyboard.press('Delete');
  await expect(page.getByRole('alert').filter({ hasText: 'A GST invoice must show: Signature' })).toBeVisible();
  await expect(page.locator('#canvas [data-element-id="sign"]')).toHaveCount(1);
  // The footer isn't: it goes
  await page.locator('[data-element-id="footer"]').click();
  await page.keyboard.press('Delete');
  await expect(page.locator('#canvas [data-element-id="footer"]')).toHaveCount(0);

  // A plain receipt switched to a GST invoice can't be saved until it's complete
  const receiptId = await newTemplate(page.request, token, starter('shop-receipt'), 'Shop');
  await page.goto(`${APP}/editor/${receiptId}`);
  await page.locator('#document-type').click();
  await page.getByRole('option', { name: 'GST tax invoice' }).click();
  await expect(page.locator('[data-gst-checklist] [role="status"]')).toHaveText(/\d+ of 19 required details missing/);
  await page.keyboard.press('Control+s');
  await expect(page.getByText('Fix these before saving:')).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'A GST tax invoice must show' })).toBeVisible();

  await page.getByRole('button', { name: 'Add missing fields' }).click();
  await expect(page.locator('[data-gst-checklist]')).toContainText('Shows everything a GST tax invoice needs');
  await page.keyboard.press('Control+s');
  await expect(page.getByText('All changes saved')).toBeVisible();
  const saved = await (await page.request.get(`${API}/templates/${receiptId}`, { headers: { Authorization: `Bearer ${token}` } })).json();
  expect(saved.canvas.documentType).toBe('gst_invoice');
});

test('a B2B invoice between states: IGST, rule 46 checks, then Use again and autofill', async ({ page }) => {
  const token = await newAccount(page, PROFILE);
  const templateId = await newTemplate(page.request, token, starter('gst-a4'));
  const fy = financialYearLabel();

  await page.goto(`${APP}/generate/${templateId}`);
  await expect(page.locator('[data-supplier]')).toContainText(`GSTIN ${SUPPLIER_GSTIN} · Maharashtra (27)`);
  await expect(page.getByLabel('Invoice number')).toHaveAttribute('placeholder', `INV/${fy}/0001`);
  await expect(page.getByLabel('Place of supply')).toHaveValue('27'); // a walk-in sale is in the seller's state

  await page.getByLabel('Customer name').fill('Bangalore Stores');
  await page.getByLabel('Customer GSTIN').fill(BUYER_GSTIN.toLowerCase());
  await expect(page.getByLabel('Place of supply')).toHaveValue('29'); // from the buyer's GSTIN
  await page.getByLabel('Item 1 description').fill('Ghee 1 L');
  await page.getByLabel('Item 1 Qty').fill('10');
  await page.getByLabel('Item 1 Unit').fill('ltr');
  await page.getByLabel('Item 1 Price').fill('600');
  await page.getByLabel('Item 1 GST %').fill('5');
  await expect(page.locator('[data-tax="igst"]')).toHaveText('300.00');
  await expect(page.locator('[data-total]')).toHaveText('6300.00');
  await expect(page.locator('[data-receipt-preview]')).toContainText('IGST');
  await expect(page.locator('[data-receipt-preview]')).toContainText('Karnataka (29)');

  // Rule 46: a registered buyer's address and an HSN code on every line
  await page.getByRole('button', { name: 'Create invoice' }).click();
  await expect(page.getByText('HSN/SAC is required for a registered buyer')).toBeVisible();
  await expect(page.getByText('Required on this GST invoice')).toBeVisible();
  await page.getByLabel('Customer address').fill('4 Brigade Road, Bengaluru');
  await page.getByLabel('Item 1 HSN/SAC').fill('0405');
  await page.getByRole('button', { name: 'Create invoice' }).click();
  await expect(page.getByRole('status').filter({ hasText: `Invoice INV/${fy}/0001 saved` })).toBeVisible();
  await expect(page.locator('[data-receipt-preview]')).toContainText('10 LTR');

  // Use again: same buyer and items, next number
  await page.goto(`${APP}/history`);
  await expect(page.locator(`[data-receipt-row="INV/${fy}/0001"]`)).toContainText('GST');
  await page.getByRole('link', { name: `Use INV/${fy}/0001 again` }).click();
  await expect(page.getByLabel('Customer name')).toHaveValue('Bangalore Stores');
  await expect(page.getByLabel('Item 1 description')).toHaveValue('Ghee 1 L');
  await expect(page.getByLabel('Item 1 GST %')).toHaveValue('5');
  await expect(page.getByLabel('Invoice number')).toHaveAttribute('placeholder', `INV/${fy}/0002`);

  // Saved customer and item: typing the name fills in the rest
  await page.goto(`${APP}/generate/${templateId}`);
  await page.getByLabel('Customer name').fill('bangalore stores');
  await expect(page.getByLabel('Customer GSTIN')).toHaveValue(BUYER_GSTIN);
  await expect(page.getByLabel('Customer address')).toHaveValue('4 Brigade Road, Bengaluru');
  await page.getByLabel('Item 1 description').fill('ghee 1 l');
  await expect(page.getByLabel('Item 1 Price')).toHaveValue('600.00');
  await expect(page.getByLabel('Item 1 HSN/SAC')).toHaveValue('0405');
  await expect(page.getByLabel('Item 1 Unit')).toHaveValue('LTR');
});

// Boxes relative to the page root, keyed by element / part (as in phase5-export-parity)
const measure = (page: Page, rootSelector: string) =>
  page.evaluate((selector) => {
    const root = document.querySelector(selector) as HTMLElement;
    const origin = root.getBoundingClientRect();
    // The preview may be scaled down to fit its column; measure in page px
    const scale = origin.width / root.offsetWidth;
    const rel = (node: Element) => {
      const b = node.getBoundingClientRect();
      return [(b.left - origin.left) / scale, (b.top - origin.top) / scale, b.width / scale, b.height / scale];
    };
    const boxes: Record<string, number[]> = {};
    root.querySelectorAll('[data-element-id]').forEach((el) => {
      const id = el.getAttribute('data-element-id')!;
      boxes[id] = rel(el);
      el.querySelectorAll('tr').forEach((tr, i) => (boxes[`${id}/row${i}`] = rel(tr)));
      el.querySelectorAll('[data-totals-line]').forEach((row) => (boxes[`${id}/${row.getAttribute('data-totals-line')}`] = rel(row)));
    });
    return { size: [root.offsetWidth, root.offsetHeight], boxes };
  }, rootSelector);

test('the live preview lays out a GST invoice exactly like the server', async ({ page, context }) => {
  const token = await newAccount(page, PROFILE);
  for (const [id, n] of [['gst-a4', 5], ['gst-thermal', 4]] as const) {
    const canvas = starter(id);
    const templateId = await newTemplate(page.request, token, canvas, id);
    await page.goto(`${APP}/generate/${templateId}`);
    await page.getByLabel('Customer name').fill('Walk-in');
    for (let i = 0; i < n; i++) {
      if (i > 0) await page.getByRole('button', { name: 'Add item' }).click();
      await page.getByLabel(`Item ${i + 1} description`).fill(`Item ${i + 1}`);
      await page.getByLabel(`Item ${i + 1} Price`).fill('100');
      await page.getByLabel(`Item ${i + 1} GST %`).fill('18');
      await page.getByLabel(`Item ${i + 1} HSN/SAC`).fill('8471');
    }
    await expect(page.locator('[data-tax="cgst"]')).toHaveText((9 * n).toFixed(2));
    const preview = await measure(page, '[data-receipt-preview]');

    const items = Array.from({ length: n }, (_, i) => ({ description: `Item ${i + 1}`, qty: '1', unit_price: '100', gst_rate: '18', hsn: '8471' }));
    const html = await page.request.post(`${API}/preview`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { canvas, format: 'html', data: { customer: { name: 'Walk-in' }, receipt: { currency: 'INR', date: new Date().toISOString().slice(0, 10) }, items } },
    });
    expect(html.status()).toBe(200);
    const serverPage = await context.newPage();
    await serverPage.setContent(await html.text());
    const server = await measure(serverPage, '.page');
    await serverPage.close();

    expect(preview.size, id).toEqual(server.size);
    expect(Object.keys(preview.boxes).sort(), id).toEqual(Object.keys(server.boxes).sort());
    expect(server.boxes).toHaveProperty('totals/cgst');
    expect(server.boxes).toHaveProperty('totals/sgst');
    for (const [key, box] of Object.entries(server.boxes)) {
      const drift = Math.max(...box.map((v, i) => Math.abs(v - preview.boxes[key][i])));
      expect(drift, `${id} ${key}: server ${box} vs preview ${preview.boxes[key]}`).toBeLessThanOrEqual(TOLERANCE_PX);
    }
  }
});

test('Share hands the PDF to the system share sheet', async ({ page }) => {
  const token = await newAccount(page);
  // The test browser has no share sheet: record what would be shared
  await page.addInitScript(() => {
    const record = window as unknown as { __shared?: { name: string; type: string; size: number }[] };
    Object.defineProperty(navigator, 'canShare', { value: () => true });
    Object.defineProperty(navigator, 'share', {
      value: async ({ files }: { files: File[] }) => {
        record.__shared = files.map((f) => ({ name: f.name, type: f.type, size: f.size }));
      },
    });
  });
  const templateId = await newTemplate(page.request, token, starter('shop-receipt'), 'Shop');
  const created = await page.request.post(`${API}/receipts`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      template_id: templateId,
      data: { business: { name: 'Corner Shop' }, receipt: { date: '2026-10-09' }, items: [{ description: 'Tea', qty: '1', unit_price: '10.00' }] },
    },
  });
  expect(created.status()).toBe(201);
  await page.goto(`${APP}/history`);
  await page.getByRole('button', { name: 'Share R-0001 as PDF' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __shared?: unknown[] }).__shared)).toEqual([
    { name: 'receipt-R-0001.pdf', type: 'application/pdf', size: expect.any(Number) },
  ]);
});

test.describe('on a phone', () => {
  const { defaultBrowserType: _browser, ...phone } = devices['iPhone 13'];
  test.use(phone);

  test('the GST invoice form fits the screen', async ({ page }) => {
    const token = await newAccount(page, PROFILE);
    const templateId = await newTemplate(page.request, token, starter('gst-thermal'));
    await page.goto(`${APP}/generate/${templateId}`);
    await page.waitForSelector('[data-generate-form]');
    const widths = await page.evaluate(() => ({ viewport: window.innerWidth, scroll: document.documentElement.scrollWidth }));
    expect(widths.scroll).toBe(widths.viewport);
  });
});
