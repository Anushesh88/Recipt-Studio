import { test, expect, type Page } from '@playwright/test';

// The brand kit in Settings: logo, colour and fonts, taken on by the template
// gallery, by copied templates and (on request) by the editor

const API = 'http://localhost:8000';
const APP = 'http://localhost:5173';
const SHOTS = process.env.BRAND_SHOTS;
// A 1x1 red PNG
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64');

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

const editorStore = (page: Page) =>
  page.evaluate(() => (window as unknown as { __editorStore: { getState: () => { elements: { id: string; props: Record<string, unknown> }[] } } }).__editorStore.getState().elements);

test('a brand kit set in Settings restyles ready-made templates', async ({ page }) => {
  const headers = await account(page);
  await page.goto(`${APP}/settings`);
  const kit = page.locator('[data-brand-kit]');
  await kit.getByLabel('Logo file').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG_1PX });
  await expect(kit.getByText('Logo saved.')).toBeVisible();
  await kit.getByRole('button', { name: 'Brand colour #0F766E' }).click();
  await expect(kit.getByText('Colour saved.')).toBeVisible();
  await kit.getByRole('radio', { name: /Classic/ }).click();
  await expect(kit.getByText('Fonts saved.')).toBeVisible();
  await expect(kit.locator('[data-brand-preview]')).toContainText('Glow Studio');
  if (SHOTS) await kit.screenshot({ path: `${SHOTS}/brand-kit.png` });

  const me = await (await page.request.get(`${API}/auth/me`, { headers })).json();
  expect([me.brand_color, me.brand_fonts]).toEqual(['#0F766E', 'merriweather-lato']);
  expect(me.brand_logo_asset_id).toBeTruthy();

  // The gallery shows the brand; the copy is branded too
  await page.goto(`${APP}/templates`);
  await page.getByRole('button', { name: 'Show all 10' }).click();
  const salon = page.locator('[data-starter="salon-receipt"]');
  if (SHOTS) await salon.screenshot({ path: `${SHOTS}/gallery-salon.png` });
  await salon.click();
  await page.waitForURL(/\/editor\//);
  await expect.poll(async () => (await editorStore(page)).length).toBeGreaterThan(0);
  const elements = await editorStore(page);
  const name = elements.find((e) => e.id === 'name')!;
  expect([name.props.color, name.props.fontFamily]).toEqual(['#0F766E', 'Merriweather']);
});

test('the editor applies the brand kit to an existing template, and undo reverts it', async ({ page }) => {
  const headers = await account(page);
  await page.request.patch(`${API}/auth/me`, { headers, data: { brand_color: '#B91C1C', brand_fonts: 'poppins-inter' } });
  const { STARTER_TEMPLATES } = await import('../src/lib/starterTemplates');
  const canvas = STARTER_TEMPLATES.find((t) => t.id === 'clinic-receipt')!.canvas;
  const id = (await (await page.request.post(`${API}/templates`, { headers, data: { name: 'Clinic', canvas } })).json()).id;
  await page.goto(`${APP}/editor/${id}`);
  await expect.poll(async () => (await editorStore(page)).length).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Apply my brand colour and fonts' }).click();
  let name = (await editorStore(page)).find((e) => e.id === 'name')!;
  expect([name.props.color, name.props.fontFamily]).toEqual(['#B91C1C', 'Poppins']);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  name = (await editorStore(page)).find((e) => e.id === 'name')!;
  expect(name.props.color).toBe('#0F766E');

  // Colour pickers offer the brand colour
  await page.evaluate(() => (window as unknown as { __editorStore: { getState: () => { selectElement: (id: string) => void } } }).__editorStore.getState().selectElement('name'));
  await expect(page.getByRole('button', { name: /brand colour/ }).first()).toBeVisible();
});
