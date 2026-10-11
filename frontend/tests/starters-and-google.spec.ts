import { test, expect, type Page } from '@playwright/test';
import { STARTER_TEMPLATES } from '../src/lib/starterTemplates';
import { starterValues } from '../src/components/templates/starterPreview';
import { toPayload } from '../src/components/generate/formModel';

// The template gallery (ten receipts, ten GST invoices) and Sign in with Google

const API = 'http://localhost:8000';
const APP = 'http://localhost:5173';
const CORS = { 'Access-Control-Allow-Origin': '*' };

async function newAccount(page: Page, mode: string | null = 'both'): Promise<string> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const password = `pw-${Math.random().toString(36).slice(2)}`;
  expect((await page.request.post(`${API}/auth/register`, { data: { email, password } })).status()).toBe(200);
  const { access_token: token } = await (await page.request.post(`${API}/auth/login`, { form: { username: email, password } })).json();
  if (mode) await page.request.patch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` }, data: { invoicing_mode: mode } });
  return token;
}

test('every ready-made template is accepted, issued and rendered by the server', async ({ page }) => {
  test.setTimeout(120_000);
  const token = await newAccount(page);
  const auth = { Authorization: `Bearer ${token}` };
  for (const starter of STARTER_TEMPLATES) {
    const { model, values } = starterValues(starter);
    const { business } = starter.sample;
    // The seller's Settings: GST invoices take the name, address and GSTIN from there
    const profile = await page.request.patch(`${API}/auth/me`, {
      headers: auth, data: { business_name: business.name, business_address: business.address, gstin: business.gstin ?? '' },
    });
    expect(profile.status(), starter.id).toBe(200);

    const template = await page.request.post(`${API}/templates`, { headers: auth, data: { name: starter.name, canvas: starter.canvas } });
    expect(template.status(), `${starter.id}: ${await template.text()}`).toBe(201);
    const receipt = await page.request.post(`${API}/receipts`, {
      headers: auth, data: { template_id: (await template.json()).id, data: toPayload(values, model) },
    });
    expect(receipt.status(), `${starter.id}: ${await receipt.text()}`).toBe(201);
    const pdf = await page.request.get(`${API}/receipts/${(await receipt.json()).id}/export?format=pdf`, { headers: auth });
    expect(pdf.status(), `${starter.id}: ${pdf.status() === 200 ? '' : await pdf.text()}`).toBe(200);
    expect(pdf.headers()['content-type']).toBe('application/pdf');
  }
});

test('the gallery shows each kind and copies a template into the account', async ({ page }) => {
  const token = await newAccount(page, 'receipts');
  await page.addInitScript((t) => window.localStorage.setItem('token', t), token);
  await page.goto(`${APP}/templates`);

  const cards = page.locator('[data-starter]');
  await expect(page.getByRole('tab', { name: 'Receipts (10)' })).toHaveAttribute('aria-selected', 'true');
  await expect(cards).toHaveCount(4);
  await page.getByRole('button', { name: 'Show all 10' }).click();
  await expect(cards).toHaveCount(10);
  // Each card is a live preview filled with its sample business
  await expect(page.locator('[data-starter="cafe-receipt"] [data-receipt-preview]')).toContainText('Brew & Bloom Café');

  await page.getByRole('tab', { name: 'GST tax invoices (10)' }).click();
  await expect(cards).toHaveCount(10);
  await expect(page.locator('[data-starter="gst-hotel"] [data-receipt-preview]')).toContainText('Lakeview Residency');
  await page.getByRole('button', { name: 'Use the Hotel & guest house invoice template' }).click();
  await page.waitForURL(/\/editor\/[0-9a-f-]{36}$/);
  await expect(page.locator('[data-gst-checklist]')).toContainText('Shows everything a GST tax invoice needs');
  const templates = await (await page.request.get(`${API}/templates`, { headers: { Authorization: `Bearer ${token}` } })).json();
  expect(templates.map((t: { name: string }) => t.name)).toEqual(['Hotel & guest house invoice']);
});

test.describe('Sign in with Google', () => {
  test('is hidden until the backend has a Google client ID', async ({ page }) => {
    // (whatever this machine's backend/.env says)
    await page.route(`${API}/auth/providers`, (route) => route.fulfill({ headers: CORS, json: { google_client_id: null } }));
    await page.goto(`${APP}/login`);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.locator('[data-google-sign-in]')).toHaveCount(0);
  });

  // Google's script and the backend's token check are stood in for; the
  // backend's side is covered by tests/test_google_auth.py
  async function fakeGoogle(page: Page, signIn: { status: number; body: unknown }) {
    await page.route(`${API}/auth/providers`, (route) => route.fulfill({ headers: CORS, json: { google_client_id: 'test-client.apps.googleusercontent.com' } }));
    await page.route('https://accounts.google.com/gsi/client', (route) => route.fulfill({
      contentType: 'text/javascript',
      body: `window.google = { accounts: { id: {
        initialize(options) { window.__gis = options; },
        renderButton(parent, options) {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = options.text === 'signup_with' ? 'Sign up with Google' : 'Sign in with Google';
          button.onclick = () => window.__gis.callback({ credential: 'google-id-token' });
          parent.appendChild(button);
        },
      } } };`,
    }));
    const sent: unknown[] = [];
    await page.route(`${API}/auth/google`, (route) => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ headers: { ...CORS, 'Access-Control-Allow-Headers': '*' } });
      sent.push(route.request().postDataJSON());
      return route.fulfill({ status: signIn.status, headers: CORS, json: signIn.body });
    });
    return sent;
  }

  test('signs a new user in and asks the welcome question', async ({ page }) => {
    const token = await newAccount(page, null); // stands in for the account Google sign-in creates
    const sent = await fakeGoogle(page, { status: 200, body: { access_token: token, token_type: 'bearer' } });
    await page.goto(`${APP}/login`);
    await page.getByRole('button', { name: "Don't have an account? Register" }).click();
    await page.getByRole('button', { name: 'Sign up with Google' }).click();
    await page.waitForURL('**/welcome');
    expect(sent).toEqual([{ credential: 'google-id-token' }]);
  });

  test('shows why it failed', async ({ page }) => {
    await fakeGoogle(page, { status: 401, body: { detail: { code: 'GOOGLE_TOKEN_INVALID', message: 'Google sign-in failed. Please try again.' } } });
    await page.goto(`${APP}/login`);
    await page.getByRole('button', { name: 'Sign in with Google' }).click();
    await expect(page.getByRole('alert')).toHaveText('Google sign-in failed. Please try again.');
    await expect(page).toHaveURL(/\/login$/);
  });
});
