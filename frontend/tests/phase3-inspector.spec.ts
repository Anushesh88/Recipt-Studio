import { test, expect, type Page } from '@playwright/test';

// Phase 3 "done when": every element's props are editable and reflected live;
// variables render as sample values or highlighted chips on the canvas.

const API = 'http://localhost:8000';
// 1x1 transparent PNG
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

interface StoreEl { id: string; type: string; height: number; props: Record<string, unknown> }
interface StoreShape { getState: () => { elements: StoreEl[]; past: unknown[] } }

const store = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as { __editorStore: StoreShape }).__editorStore.getState();
    return { elements: s.elements, pastLength: s.past.length };
  });

async function drop(page: Page, label: string, x = 20, y = 20) {
  const canvas = (await page.locator('#canvas').boundingBox())!;
  await page.locator(`text="${label}"`).first().hover();
  await page.mouse.down();
  await page.mouse.move(canvas.x + x, canvas.y + y, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(50);
}

async function pick(page: Page, combobox: string, option: string) {
  await page.getByRole('combobox', { name: combobox, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

test.describe('Phase 3 inspector', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('token', 'fake-token'));
    await page.goto('http://localhost:5173/editor');
    await expect(page.locator('#canvas')).toBeVisible();
  });

  test('text props are editable and reflected live; variables show as samples / chips', async ({ page }) => {
    await drop(page, 'Text');
    const text = page.locator('[data-type="text"] > div');

    await page.getByLabel('Size (px)').fill('24');
    await expect(text).toHaveCSS('font-size', '24px');
    await page.getByLabel('Line height').fill('1.5');
    await expect(text).toHaveCSS('line-height', '36px');
    await pick(page, 'Font', 'Merriweather');
    await expect(text).toHaveCSS('font-family', /Merriweather/);
    await pick(page, 'Weight', 'Bold (700)');
    await expect(text).toHaveCSS('font-weight', '700');
    await page.locator('[aria-label="Align center"]').click();
    await expect(text).toHaveCSS('text-align', 'center');
    await page.getByLabel('Color', { exact: true }).fill('#FF0000');
    await expect(text).toHaveCSS('color', 'rgb(255, 0, 0)');

    await page.locator('#text-content').fill('Hello {{customer.name}} at {{custom.table_no}}');
    await expect(text).toContainText('Hello Jane Doe at custom.table_no');
    await expect(text.locator('[data-variable-kind="builtin"]')).toHaveText('Jane Doe');
    await expect(text.locator('[data-variable-kind="custom"]')).toHaveText('custom.table_no');

    await page.locator('#text-content').fill('Oops {{foo.bar}}');
    await expect(page.getByRole('alert')).toContainText('Unknown variable {{foo.bar}}');
    await expect(text.locator('[data-variable-kind="unknown"]')).toBeVisible();
  });

  test('typing in a field is one undo step, and its keys never delete the element', async ({ page }) => {
    await drop(page, 'Text');
    const before = (await store(page)).pastLength;
    await page.locator('#text-content').fill('');
    await page.locator('#text-content').pressSequentially('Receipt');
    expect((await store(page)).pastLength).toBe(before + 1);

    // Backspace / Delete inside the inspector edit the field, not the canvas
    await page.getByLabel('Size (px)').press('Backspace');
    await page.getByRole('combobox', { name: 'Font', exact: true }).press('Delete');
    expect((await store(page)).elements).toHaveLength(1);
  });

  test('inline editing: double-click, insert built-in and new custom variables, one undo step', async ({ page }) => {
    await drop(page, 'Text');
    await page.locator('[data-type="text"]').dblclick();
    const editor = page.locator('[data-inline-editor] textarea');
    await expect(editor).toBeFocused();

    await editor.press('Control+a');
    await editor.pressSequentially('Thanks ');
    await page.locator('[data-inline-editor]').getByRole('button', { name: 'Insert variable' }).click();
    await page.locator('[data-variable-menu]').getByRole('button', { name: /Customer name/ }).click();
    await expect(editor).toHaveValue('Thanks {{customer.name}}');
    await expect(editor).toBeFocused();

    await editor.pressSequentially(', table ');
    await page.locator('[data-inline-editor]').getByRole('button', { name: 'Insert variable' }).click();
    const fieldName = page.locator('[data-variable-menu]').getByLabel('Add your own field');
    await fieldName.fill('Table 1');
    await expect(page.locator('[data-variable-menu]')).toContainText('Use letters and spaces only');
    // A plain name is turned into a field key
    await fieldName.fill('Table no');
    await expect(page.locator('[data-variable-menu]')).toContainText('Adds {{custom.table_no}}');
    await page.locator('[data-variable-menu]').getByRole('button', { name: 'Add', exact: true }).click();
    await expect(editor).toHaveValue('Thanks {{customer.name}}, table {{custom.table_no}}');

    await editor.press('Escape');
    await expect(page.locator('[data-inline-editor]')).toHaveCount(0);
    const text = page.locator('[data-type="text"] > div');
    await expect(text).toContainText('Thanks Jane Doe, table custom.table_no');

    await page.keyboard.press('Control+z');
    await expect(text).toHaveText('Sample Text');
  });

  test('table, totals, QR, divider and signature props', async ({ page }) => {
    // Items table: row metrics drive its height; columns are editable
    await drop(page, 'Table', 12, 12);
    await page.getByLabel('Size', { exact: true }).fill('16');
    // (ceil(16 * 1.3) + 2 * 4) * (header + 3 rows) = 29 * 4
    await expect.poll(async () => (await store(page)).elements[0].height).toBe(116);
    await page.locator('#col-label-description').fill('Product');
    await expect(page.locator('[data-type="items_table"] th').first()).toHaveText('Product');
    await page.locator('[data-column="qty"]').getByRole('button', { name: 'Remove column' }).click();
    await expect(page.locator('[data-type="items_table"] th')).toHaveCount(3);
    await expect(page.getByText('Total width: 100%')).toBeVisible();
    await page.getByRole('button', { name: 'Add column' }).click();
    await expect(page.locator('[data-type="items_table"] th')).toHaveCount(4);

    await drop(page, 'Totals', 120, 150);
    await page.getByRole('checkbox', { name: 'Tax', exact: true }).click();
    const totals = page.locator('[data-type="totals"]');
    await expect(totals).not.toContainText('Tax');
    await page.getByLabel('Currency symbol').fill('€');
    await expect(totals).toContainText('€35.00');

    await drop(page, 'QR Code', 12, 250);
    await page.locator('#qr-content').fill('https://example.test/r/{{receipt.number}}');
    await pick(page, 'Error correction', 'High (30%)');
    const qr = (await store(page)).elements.find((e) => e.type === 'qr')!;
    expect(qr.props).toMatchObject({ content: 'https://example.test/r/{{receipt.number}}', errorCorrection: 'H' });

    await drop(page, 'Divider', 12, 360);
    await page.locator('[aria-label="Dotted"]').click();
    await page.getByLabel('Thickness (px)').fill('3');
    const line = page.locator('[data-type="divider"] > div');
    await expect(line).toHaveCSS('border-top-style', 'dotted');
    await expect(line).toHaveCSS('border-top-width', '3px');

    await drop(page, 'Signature', 150, 250);
    await page.getByLabel('Label under the line').fill('Cashier');
    await expect(page.locator('[data-type="signature"]')).toContainText('Cashier');
  });

  test('page preset selector switches size and height mode', async ({ page }) => {
    const canvas = page.locator('#canvas');
    await pick(page, 'Page size', 'A5 portrait');
    await expect(canvas).toHaveCSS('width', '559px');
    await expect(canvas).toHaveCSS('height', '794px');
    await expect(page.getByText('Auto-Height Mode')).toHaveCount(0);

    await pick(page, 'Page size', 'Thermal 80 mm (auto height)');
    await expect(canvas).toHaveCSS('width', '302px');
    await expect(page.getByText('Auto-Height Mode')).toBeVisible();
    await page.getByLabel('Design height (px)').fill('600');
    await page.getByLabel('Design height (px)').press('Enter');
    await expect(canvas).toHaveCSS('height', '600px');
  });
});

test.describe('Phase 3 uploads', () => {
  test('logo upload shows on the canvas; non-PNG/JPG files are refused by the server', async ({ page }) => {
    // A throwaway account in the local dev database. (Reserved TLDs such as .test
    // are rejected by the API's email validation, hence example.com.)
    const email = `e2e-${Date.now()}@example.com`;
    const password = `pw-${Math.random().toString(36).slice(2)}`;
    const register = await page.request.post(`${API}/auth/register`, { data: { email, password } });
    expect(register.status(), await register.text()).toBe(200);
    const login = await page.request.post(`${API}/auth/login`, { form: { username: email, password } });
    expect(login.status()).toBe(200);
    const { access_token: token } = await login.json();
    await page.addInitScript((t) => window.localStorage.setItem('token', t), token);
    await page.goto('http://localhost:5173/editor');

    await drop(page, 'Image');
    const fileInput = page.locator('[data-inspector] input[type="file"]');
    await fileInput.setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG_1PX });
    const img = page.locator('[data-type="image"] img');
    await expect(img).toBeVisible();
    expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(1);
    const image = (await store(page)).elements.find((e) => e.type === 'image')!;
    expect(image.props.assetId).toMatch(/^[0-9a-f-]{36}$/);

    // Claims to be a PNG but isn't: the server checks the bytes
    await fileInput.setInputFiles({ name: 'fake.png', mimeType: 'image/png', buffer: Buffer.from('GIF89a-not-really') });
    await expect(page.locator('[data-inspector]').getByRole('alert')).toHaveText('Only PNG and JPG images are supported.');

    await page.getByRole('button', { name: 'Remove' }).click();
    await expect(img).toHaveCount(0);
  });
});
