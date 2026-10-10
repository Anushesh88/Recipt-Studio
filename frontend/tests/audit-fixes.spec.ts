import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

// Regressions from the Phase 5 audit: long QR content, signing in as someone
// else in the same tab, elements below a thermal page, double Ctrl+S, and the
// login form's rules.

const API = 'http://localhost:8000';
const APP = 'http://localhost:5173';

const PAGE = { preset: 'thermal80', width: 302, height: 400, heightMode: 'auto', background: '#FFFFFF', margin: 12 };
const base = { zIndex: 1, locked: false };
const text = (id: string, content: string, y = 12) => ({
  ...base, id, type: 'text', x: 12, y, width: 278, height: 32,
  props: { content, fontFamily: 'Inter', fontSize: 14, fontWeight: 400, color: '#111111', align: 'left', lineHeight: 1.3 },
});
const qr = (content: string, errorCorrection = 'M') => ({
  ...base, id: 'qr', type: 'qr', x: 12, y: 60, width: 100, height: 100, props: { content, errorCorrection },
});

interface Account { email: string; password: string; token: string }

async function newAccount(request: APIRequestContext): Promise<Account> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const password = `pw-${Math.random().toString(36).slice(2)}`;
  expect((await request.post(`${API}/auth/register`, { data: { email, password } })).status()).toBe(200);
  const { access_token: token } = await (await request.post(`${API}/auth/login`, { form: { username: email, password } })).json();
  return { email, password, token };
}

async function newTemplate(request: APIRequestContext, token: string, elements: unknown[], name = 'Audit') {
  const res = await request.post(`${API}/templates`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name, canvas: { schemaVersion: 1, page: PAGE, elements } },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).id as string;
}

const templateCount = async (request: APIRequestContext, token: string) =>
  (await (await request.get(`${API}/templates`, { headers: { Authorization: `Bearer ${token}` } })).json()).length as number;

// Seeds the token once, so a later sign-out in the test sticks across reloads
const signIn = (page: Page, token: string) =>
  page.addInitScript((t) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('token', t);
      sessionStorage.setItem('seeded', '1');
    }
  }, token);

test('too much QR text shows a notice instead of crashing the editor, and blocks saving', async ({ page }) => {
  const account = await newAccount(page.request);
  const id = await newTemplate(page.request, account.token, [qr('hello')]);
  await signIn(page, account.token);
  const crashes: string[] = [];
  page.on('pageerror', (e) => crashes.push(e.message));

  await page.goto(`${APP}/editor/${id}`);
  await page.locator('[data-element-id="qr"]').click();
  await page.locator('#qr-content').fill('x'.repeat(2400)); // level M holds 2331
  await expect(page.locator('[data-element-id="qr"] [data-qr-too-long]')).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'at most 2331 characters' })).toBeVisible();
  expect(crashes).toEqual([]);

  await page.keyboard.press('Control+s');
  await expect(page.getByText('Fix these before saving:')).toBeVisible();

  // Shortened, it draws again
  await page.locator('#qr-content').fill('x'.repeat(2000));
  await expect(page.locator('[data-element-id="qr"] svg')).toBeVisible();
});

test('a too-long QR code in Generate flags its fields; nothing is created', async ({ page }) => {
  const account = await newAccount(page.request);
  const id = await newTemplate(page.request, account.token, [qr('{{custom.a}}{{custom.b}}{{custom.c}}', 'H')]);
  await signIn(page, account.token);
  await page.goto(`${APP}/generate/${id}`);

  for (const key of ['a', 'b', 'c']) await page.locator(`#field-custom-${key}`).fill('x'.repeat(450)); // 1350 > 1273
  await expect(page.locator('[data-receipt-preview] [data-qr-too-long]')).toBeVisible();
  await page.getByLabel('Item 1 description').fill('Tea');
  await page.getByLabel('Item 1 unit price').fill('2.00');
  await page.getByRole('button', { name: 'Create receipt' }).click();
  await expect(page.getByText('Too long for the QR code')).toHaveCount(3);
  expect((await (await page.request.get(`${API}/receipts`, { headers: { Authorization: `Bearer ${account.token}` } })).json()).length).toBe(0);
});

test("signing in as someone else in the same tab shows none of the first account's data", async ({ page }) => {
  const first = await newAccount(page.request);
  const second = await newAccount(page.request);
  await page.request.patch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${first.token}` }, data: { business_name: 'Alpha Shop' } });
  await newTemplate(page.request, first.token, [text('t', 'Hi')], 'Alpha private template');
  await signIn(page, first.token);

  await page.goto(`${APP}/settings`);
  await expect(page.getByLabel('Business name')).toHaveValue('Alpha Shop');
  await page.getByRole('link', { name: 'Templates' }).click();
  await expect(page.locator('[data-template-card="Alpha private template"]')).toBeVisible();

  await page.getByRole('button', { name: 'Logout' }).click();
  await page.getByLabel('Email').fill(second.email);
  await page.getByLabel('Password').fill(second.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByText('No saved templates yet')).toBeVisible();
  await expect(page.locator('[data-template-card="Alpha private template"]')).toHaveCount(0);

  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByText(`Signed in as ${second.email}`)).toBeVisible();
  await expect(page.getByLabel('Business name')).toHaveValue('');
});

test('an element moved below a thermal page grows the page and stays in the preview', async ({ page }) => {
  const account = await newAccount(page.request);
  const id = await newTemplate(page.request, account.token, [text('t', 'Bottom line')]);
  await signIn(page, account.token);

  await page.goto(`${APP}/editor/${id}`);
  await page.locator('[data-element-id="t"]').click();
  await page.locator('#geom-y').fill('1000');
  await page.locator('#geom-y').press('Enter');
  const height = await page.evaluate(() => (window as unknown as { __editorStore: { getState: () => { page: { height: number } } } }).__editorStore.getState().page.height);
  expect(height).toBe(1032);
  await page.keyboard.press('Control+s');
  await expect(page.getByText('All changes saved')).toBeVisible();

  await page.goto(`${APP}/generate/${id}`);
  const preview = (await page.locator('[data-receipt-preview]').boundingBox())!;
  const element = (await page.locator('[data-receipt-preview] [data-element-id="t"]').boundingBox())!;
  expect(element.y + element.height).toBeLessThanOrEqual(preview.y + preview.height + 1);
});

test('pressing Ctrl+S twice quickly saves a new template once', async ({ page }) => {
  const account = await newAccount(page.request);
  await signIn(page, account.token);
  await page.goto(`${APP}/editor`);
  await page.locator('#canvas').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+s');
  await page.keyboard.press('Control+s');
  await page.waitForURL(/\/editor\/[0-9a-f-]{36}$/);
  await expect(page.getByText('All changes saved')).toBeVisible();
  expect(await templateCount(page.request, account.token)).toBe(1);
});

test('the register form checks the password before sending it', async ({ page }) => {
  await page.goto(`${APP}/login`);
  await page.getByRole('button', { name: "Don't have an account? Register" }).click();
  await page.getByLabel('Email').fill(`e2e-${Date.now()}@example.com`);
  await page.getByLabel('Password').fill('short');
  let registered = false;
  page.on('request', (r) => { if (r.url().endsWith('/auth/register')) registered = true; });
  await page.getByRole('button', { name: 'Sign Up' }).click();
  await expect(page.getByText('Use at least 8 characters')).toBeVisible();
  expect(registered).toBe(false);

  await page.getByLabel('Password').fill('long-enough-password');
  await page.getByRole('button', { name: 'Sign Up' }).click();
  await page.waitForURL('**/templates');
});
