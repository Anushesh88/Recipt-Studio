import { BRAND_STRIP_HEIGHT } from '../src/lib/layout';
import { test, expect, type Page } from '@playwright/test';

// Phase 5: the server's receipt HTML (what WeasyPrint turns into the PDF) must
// lay out exactly like the editor's live preview. For 1, 5 and 30 line items,
// every element box, table row, totals line and inner part is compared within
// 1px. Also checks PDF / PNG downloads from Generate and History.

const API = 'http://localhost:8000';
const APP = 'http://localhost:5173';
const TOLERANCE_PX = 1;
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function loginAsNewUser(page: Page): Promise<string> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const password = `pw-${Math.random().toString(36).slice(2)}`;
  expect((await page.request.post(`${API}/auth/register`, { data: { email, password } })).status()).toBe(200);
  const { access_token: token } = await (await page.request.post(`${API}/auth/login`, { form: { username: email, password } })).json();
  await page.addInitScript((t) => window.localStorage.setItem('token', t), token);
  return token;
}

const base = { zIndex: 1, locked: false };
const allTypesCanvas = (assetId: string) => ({
  schemaVersion: 1,
  page: { preset: 'thermal80', width: 302, height: 420, heightMode: 'auto', background: '#FFFFFF', margin: 12 },
  elements: [
    { ...base, id: 'logo', type: 'image', x: 100, y: 4, width: 100, height: 40, props: { source: 'logo', assetId, fit: 'contain' } },
    { ...base, id: 'title', type: 'text', x: 12, y: 48, width: 278, height: 36,
      props: { content: 'Hi {{customer.name}} · #{{receipt.number}}', fontFamily: 'Merriweather', fontSize: 14, fontWeight: 700, color: '#111111', align: 'center', lineHeight: 1.3 } },
    { ...base, id: 'rule', type: 'divider', x: 12, y: 84, width: 278, height: 8, props: { style: 'dashed', thickness: 3, color: '#999999' } },
    { ...base, id: 'table', type: 'items_table', x: 12, y: 96, width: 278, height: 96,
      props: { binding: 'receipt.items', columns: [
        { key: 'description', label: 'Item', width: 0.45, align: 'left' },
        { key: 'qty', label: 'Qty', width: 0.15, align: 'right' },
        { key: 'unit_price', label: 'Price', width: 0.2, align: 'right' },
        { key: 'line_total', label: 'Total', width: 0.2, align: 'right' },
      ], fontFamily: 'Inter', fontSize: 12, lineHeight: 1.3, rowPadding: 4, headerBold: true, rowDivider: true, color: '#000000' } },
    { ...base, id: 'totals', type: 'totals', x: 120, y: 200, width: 170, height: 96,
      props: { binding: 'receipt.totals', show: ['subtotal', 'tax', 'discount', 'total'], fontFamily: 'Poppins', fontSize: 13, emphasizeTotal: true, currencySymbol: '$' } },
    { ...base, id: 'qr', type: 'qr', x: 12, y: 200, width: 90, height: 90, props: { content: 'https://example.com/r/{{receipt.number}}', errorCorrection: 'M' } },
    { ...base, id: 'sig', type: 'signature', x: 150, y: 330, width: 140, height: 60, props: { label: 'Cashier', assetId, lineColor: '#111111' } },
  ],
});

// Boxes relative to the page root, keyed by element / part
const measure = (page: Page, rootSelector: string) =>
  page.evaluate((selector) => {
    const root = document.querySelector(selector)!;
    const origin = root.getBoundingClientRect();
    const rel = (node: Element) => {
      const b = node.getBoundingClientRect();
      return [b.left - origin.left, b.top - origin.top, b.width, b.height];
    };
    const boxes: Record<string, number[]> = {};
    root.querySelectorAll('[data-element-id]').forEach((el) => {
      const id = el.getAttribute('data-element-id')!;
      boxes[id] = rel(el);
      el.querySelectorAll('tr').forEach((tr, i) => (boxes[`${id}/row${i}`] = rel(tr)));
      Array.from(el.children).forEach((child, i) => {
        if (child.tagName !== 'TABLE') boxes[`${id}/part${i}`] = rel(child);
      });
    });
    return { size: [origin.width, origin.height], boxes };
  }, rootSelector);

test('server HTML lays out exactly like the live preview for 1, 5 and 30 items', async ({ page, context }) => {
  test.setTimeout(120_000);
  const token = await loginAsNewUser(page);
  const auth = { Authorization: `Bearer ${token}` };
  const upload = await page.request.post(`${API}/assets`, {
    headers: auth,
    multipart: { kind: 'logo', file: { name: 'logo.png', mimeType: 'image/png', buffer: PNG_1PX } },
  });
  const assetId = (await upload.json()).id;
  const canvas = allTypesCanvas(assetId);
  const created = await page.request.post(`${API}/templates`, { headers: auth, data: { name: 'Parity', canvas } });
  const templateId = (await created.json()).id;
  const serverPage = await context.newPage();

  await page.goto(`${APP}/generate/${templateId}`);
  await page.getByLabel('Customer name').fill('Jane Doe');
  await page.getByLabel('Tax rate (%)').fill('10');

  let filled = 0;
  for (const n of [1, 5, 30]) {
    // Same receipt in the live preview...
    while (filled < n) {
      if (filled > 0) await page.getByRole('button', { name: 'Add item' }).click();
      await page.getByLabel(`Item ${filled + 1} description`).fill(`Item ${filled + 1}`);
      await page.getByLabel(`Item ${filled + 1} unit price`).fill('2.00');
      filled += 1;
    }
    await expect(page.locator('[data-receipt-preview] tbody tr')).toHaveCount(n);
    await expect(page.locator('[data-receipt-preview] [data-type="image"] img')).toBeVisible();
    const preview = await measure(page, '[data-receipt-preview]');

    // ...and as the server renders it for the PDF
    const items = Array.from({ length: n }, (_, i) => ({ description: `Item ${i + 1}`, qty: '1', unit_price: '2.00' }));
    const html = await page.request.post(`${API}/preview`, {
      headers: auth,
      data: { canvas, format: 'html', data: { customer: { name: 'Jane Doe' }, items, tax_rate: '0.10' } },
    });
    expect(html.status()).toBe(200);
    await serverPage.setContent(await html.text());
    const server = await measure(serverPage, '.page');

    // The thermal page grows by one 24px row per item beyond the 3 designed
    // rows, plus the "Made with Receipt Studio" strip under the content
    expect(server.size).toEqual([302, 420 + (n - 3) * 24 + BRAND_STRIP_HEIGHT]);
    expect(preview.size).toEqual(server.size);
    const brandTop = (p: Page, root: string) =>
      p.evaluate((r) => {
        const page = document.querySelector(r)!;
        const scale = page.getBoundingClientRect().width / (page as HTMLElement).offsetWidth;
        const strip = page.querySelector('[data-brand]')!;
        return [(strip.getBoundingClientRect().top - page.getBoundingClientRect().top) / scale, strip.textContent!.trim()];
      }, root);
    expect(await brandTop(serverPage, '.page')).toEqual([server.size[1] - BRAND_STRIP_HEIGHT, 'Made with Receipt Studio']);
    expect(await brandTop(page, '[data-receipt-preview]')).toEqual(await brandTop(serverPage, '.page'));
    const missing = Object.keys(server.boxes).filter((k) => !(k in preview.boxes));
    const extra = Object.keys(preview.boxes).filter((k) => !(k in server.boxes));
    expect({ missing, extra }, `parts at ${n} items`).toEqual({ missing: [], extra: [] });
    for (const [key, box] of Object.entries(server.boxes)) {
      const drift = box.map((v, i) => Math.abs(v - preview.boxes[key][i]));
      expect(Math.max(...drift), `${key} at ${n} items: server ${box} vs preview ${preview.boxes[key]}`).toBeLessThanOrEqual(TOLERANCE_PX);
    }
  }
});

test('PDF and PNG downloads from Generate and History', async ({ page }) => {
  const token = await loginAsNewUser(page);
  const auth = { Authorization: `Bearer ${token}` };
  const created = await page.request.post(`${API}/templates`, {
    headers: auth,
    data: { name: 'Downloads', canvas: { ...allTypesCanvas('00000000-0000-0000-0000-000000000000'), elements: allTypesCanvas('').elements.filter((e) => e.type !== 'image' && e.type !== 'signature') } },
  });
  expect(created.status()).toBe(201);
  const templateId = (await created.json()).id;

  await page.goto(`${APP}/generate/${templateId}`);
  await page.getByLabel('Customer name').fill('Jane Doe');
  await page.getByLabel('Item 1 description').fill('Latte');
  await page.getByLabel('Item 1 unit price').fill('4.50');
  await page.getByRole('button', { name: 'Create receipt' }).click();
  await expect(page.getByRole('status')).toContainText('Receipt R-0001 saved');

  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download R-0001 as PDF' }).click()]);
  expect(pdf.suggestedFilename()).toBe('receipt-R-0001.pdf');
  const pdfBytes = await (await pdf.createReadStream()).toArray();
  expect(Buffer.concat(pdfBytes).subarray(0, 5).toString()).toBe('%PDF-');

  await page.getByRole('link', { name: 'Receipt history' }).click();
  const row = page.locator('[data-receipt-row="R-0001"]');
  await expect(row).toContainText('Jane Doe');
  await expect(row).toContainText('USD 4.50');
  const [png] = await Promise.all([page.waitForEvent('download'), row.getByRole('button', { name: 'Download R-0001 as PNG' }).click()]);
  expect(png.suggestedFilename()).toBe('receipt-R-0001.png');
  const pngBytes = Buffer.concat(await (await png.createReadStream()).toArray());
  expect(pngBytes.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
});
