import { test, expect, type Page } from '@playwright/test';

// Phase 4 "done when": save -> reload -> canvas identical; blank number gives
// R-0001, then R-0002; override works; a duplicate override returns a clear
// error; the preview pushes elements down as items are added.

const API = 'http://localhost:8000';
const APP = 'http://localhost:5173';

// Sorted-key JSON so equal canvases compare equal whatever their key order
const stable = (v: unknown) =>
  JSON.stringify(v, (_k, x: unknown) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1)))
      : x,
  );

// A fresh throwaway account in the local dev database (fresh = numbering starts at R-0001)
async function loginAsNewUser(page: Page): Promise<string> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const password = `pw-${Math.random().toString(36).slice(2)}`;
  expect((await page.request.post(`${API}/auth/register`, { data: { email, password } })).status()).toBe(200);
  const login = await page.request.post(`${API}/auth/login`, { form: { username: email, password } });
  const { access_token: token } = await login.json();
  // Past the one-time welcome question
  await page.request.patch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` }, data: { invoicing_mode: 'both' } });
  await page.addInitScript((t) => window.localStorage.setItem('token', t), token);
  return token;
}

const canvasJson = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as { __editorStore: { getState: () => { page: unknown; elements: unknown[] } } }).__editorStore.getState();
    return { page: s.page, elements: s.elements };
  });

async function drop(page: Page, label: string, x: number, y: number) {
  const canvas = (await page.locator('#canvas').boundingBox())!;
  await page.locator(`text="${label}"`).first().hover();
  await page.mouse.down();
  await page.mouse.move(canvas.x + x, canvas.y + y, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(50);
}

const saveStatus = (page: Page) => page.getByRole('status', { name: 'Save status' });

test('save, reload identical, unknown variables block saving, Save As, templates page', async ({ page }) => {
  await loginAsNewUser(page);
  await page.goto(`${APP}/editor`);
  await drop(page, 'Text', 12, 12);
  await page.locator('#text-content').fill('Hi {{customer.name}} at {{custom.table_no}}');
  await drop(page, 'Table', 12, 60);
  await drop(page, 'Totals', 120, 172);
  await page.getByLabel('Template name').fill('Cafe receipt');
  await expect(saveStatus(page)).toHaveText('Unsaved changes');

  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForURL(/\/editor\/[0-9a-f-]{36}$/);
  const savedUrl = page.url();
  await expect(saveStatus(page)).toHaveText('All changes saved');

  const before = stable(await canvasJson(page));
  await page.reload();
  await expect(page.locator('#canvas [data-element-id]')).toHaveCount(3);
  expect(stable(await canvasJson(page))).toBe(before);
  await expect(page.getByLabel('Template name')).toHaveValue('Cafe receipt');

  // Unknown variables block saving, naming the element
  await page.locator('[data-type="text"]').click();
  await page.locator('#text-content').fill('Hi {{customer.nmae}}');
  await page.keyboard.press('Control+s');
  await expect(page.getByRole('alert').filter({ hasText: 'Fix these before saving' })).toContainText(
    'Text (content): Unknown variables in content: {{customer.nmae}}',
  );
  await expect(saveStatus(page)).toHaveText('Unsaved changes');
  await page.locator('#text-content').fill('Hi {{customer.name}} at {{custom.table_no}}');
  await page.keyboard.press('Control+s');
  await expect(saveStatus(page)).toHaveText('All changes saved');
  expect(page.url()).toBe(savedUrl);

  // Save As creates a second template and switches to it
  await page.getByRole('button', { name: 'Save as…' }).click();
  await page.getByLabel('Save a copy as').fill('Bar receipt');
  await page.getByRole('button', { name: 'Save copy' }).click();
  await expect.poll(() => page.url()).not.toBe(savedUrl);
  await expect(page.getByLabel('Template name')).toHaveValue('Bar receipt');

  // Templates page: list, duplicate, delete
  await page.getByRole('link', { name: 'Templates' }).click();
  const cards = page.locator('[data-template-card]');
  await expect(cards).toHaveCount(2);
  await page.locator('[data-template-card="Cafe receipt"]').getByRole('button', { name: 'Duplicate' }).click();
  await expect(page.locator('[data-template-card="Cafe receipt (copy)"]')).toBeVisible();
  await page.locator('[data-template-card="Bar receipt"]').getByRole('button', { name: 'Delete Bar receipt' }).click();
  await page.locator('[data-template-card="Bar receipt"]').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.locator('[data-template-card="Bar receipt"]')).toHaveCount(0);
  await expect(cards).toHaveCount(2);

  // Opening a card loads it back into the editor
  await page.locator('[data-template-card="Cafe receipt"]').getByRole('link', { name: 'Edit' }).click();
  await expect(page.locator('#canvas [data-element-id]')).toHaveCount(3);
  expect(stable(await canvasJson(page))).toBe(before);
});

const textEl = (content: string) => ({
  id: 'title', type: 'text', x: 12, y: 12, width: 278, height: 40, zIndex: 1, locked: false,
  props: { content, fontFamily: 'Inter', fontSize: 14, fontWeight: 400, color: '#111111', align: 'left', lineHeight: 1.3 },
});
const tableEl = {
  id: 'table', type: 'items_table', x: 12, y: 60, width: 278, height: 96, zIndex: 2, locked: false,
  props: {
    binding: 'receipt.items',
    columns: [
      { key: 'description', label: 'Item', width: 0.6, align: 'left' },
      { key: 'line_total', label: 'Total', width: 0.4, align: 'right' },
    ],
    fontFamily: 'Inter', fontSize: 12, lineHeight: 1.3, rowPadding: 4, headerBold: true, rowDivider: true, color: '#111111',
  },
};
const totalsEl = {
  id: 'totals', type: 'totals', x: 120, y: 172, width: 170, height: 90, zIndex: 3, locked: false,
  props: { binding: 'receipt.totals', show: ['subtotal', 'tax', 'discount', 'total'], fontFamily: 'Inter', fontSize: 13, emphasizeTotal: true, currencySymbol: '$' },
};

test('generate: auto numbering, override, duplicate error, push-down preview', async ({ page }) => {
  const token = await loginAsNewUser(page);
  const created = await page.request.post(`${API}/templates`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name: 'Diner',
      canvas: {
        schemaVersion: 1,
        page: { preset: 'thermal80', width: 302, height: 400, heightMode: 'auto', background: '#FFFFFF', margin: 12 },
        elements: [textEl('{{customer.name}} / table {{custom.table_no}}'), tableEl, totalsEl],
      },
    },
  });
  expect(created.status()).toBe(201);
  const templateId = (await created.json()).id;
  await page.goto(`${APP}/generate/${templateId}`);

  const preview = page.locator('[data-receipt-preview]');
  const totalsY = async () => Number(await preview.locator('[data-type="totals"]').getAttribute('data-y'));
  const fillDetails = async () => {
    await page.getByLabel('Customer name').fill('Jane Doe');
    await page.getByLabel('Table no').fill('12');
    await page.getByLabel('Item 1 description').fill('Latte');
    await page.getByLabel('Item 1 unit price').fill('4.50');
  };

  await expect(page.getByLabel('Receipt number')).toHaveAttribute('placeholder', 'R-0001');

  // Client-side required fields
  await page.getByRole('button', { name: 'Create receipt' }).click();
  await expect(page.getByText('Customer name is required')).toBeVisible();
  await expect(page.getByText('Table no is required')).toBeVisible();

  await fillDetails();
  await expect(preview).toContainText('Jane Doe / table 12');
  await expect(preview).toContainText('Latte');

  // 1 item vs the 3-row design: the totals move up 2 rows (24 px each), then
  // down 1 row past the design with 4 items
  expect(await totalsY()).toBe(172 - 2 * 24);
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Add item' }).click();
  for (let i = 2; i <= 4; i++) {
    await page.getByLabel(`Item ${i} description`).fill(`Extra ${i}`);
    await page.getByLabel(`Item ${i} unit price`).fill('1.00');
  }
  expect(await totalsY()).toBe(172 + 24);
  await expect(page.locator('[data-total]')).toHaveText('7.50');

  // Blank number -> R-0001, then R-0002
  await page.getByRole('button', { name: 'Create receipt' }).click();
  await expect(page.getByRole('status')).toContainText('Receipt R-0001 saved');
  await expect(page.getByRole('status')).toContainText('Total USD 7.50');

  await page.getByRole('button', { name: 'Generate another' }).click();
  await expect(page.getByLabel('Receipt number')).toHaveAttribute('placeholder', 'R-0002');
  await fillDetails();
  await page.getByRole('button', { name: 'Create receipt' }).click();
  await expect(page.getByRole('status')).toContainText('Receipt R-0002 saved');

  // Override is used as-is...
  await page.getByRole('button', { name: 'Generate another' }).click();
  await fillDetails();
  await page.getByLabel('Receipt number').fill('INV-7');
  await page.getByRole('button', { name: 'Create receipt' }).click();
  await expect(page.getByRole('status')).toContainText('Receipt INV-7 saved');

  // ...and reusing it is a clear error on the field
  await page.getByRole('button', { name: 'Generate another' }).click();
  await fillDetails();
  await page.getByLabel('Receipt number').fill('INV-7');
  await page.getByRole('button', { name: 'Create receipt' }).click();
  await expect(page.getByText('Receipt number INV-7 is already used. Choose another or leave it blank.')).toBeVisible();
  await expect(page.getByLabel('Receipt number')).toHaveAttribute('aria-invalid', 'true');

  // The override didn't consume the sequence
  await page.getByLabel('Receipt number').fill('');
  await page.getByRole('button', { name: 'Create receipt' }).click();
  await expect(page.getByRole('status')).toContainText('Receipt R-0003 saved');
});
