import { test, expect, type Locator } from '@playwright/test';
import { STARTER_TEMPLATES } from '../src/lib/starterTemplates';

// The Templates page: a blank template first, then your saved ones, then the
// ready-made gallery

const API = 'http://localhost:8000';
const APP = 'http://localhost:5173';

const top = async (locator: Locator) => (await locator.boundingBox())!.y;

test('blank first, then saved templates, then the ready-made ones', async ({ page }) => {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const password = `pw-${Math.random().toString(36).slice(2)}`;
  await page.request.post(`${API}/auth/register`, { data: { email, password } });
  const { access_token: token } = await (await page.request.post(`${API}/auth/login`, { form: { username: email, password } })).json();
  const headers = { Authorization: `Bearer ${token}` };
  await page.request.patch(`${API}/auth/me`, { headers, data: { invoicing_mode: 'receipts' } });
  const canvas = STARTER_TEMPLATES.find((t) => t.id === 'cafe-receipt')!.canvas;
  await page.request.post(`${API}/templates`, { headers, data: { name: 'My café bill', canvas } });
  await page.addInitScript((t) => window.localStorage.setItem('token', t), token);

  await page.goto(`${APP}/templates`);
  const blank = page.getByRole('button', { name: 'New blank receipt' });
  const saved = page.locator('[data-template-card="My café bill"]');
  const gallery = page.getByRole('heading', { name: 'Start from a ready-made template' });
  await expect(saved).toBeVisible();
  await expect(gallery).toBeVisible();
  expect(await top(blank)).toBeLessThanOrEqual(await top(saved));
  expect(await top(saved)).toBeLessThan(await top(gallery));
  expect(await top(page.getByRole('heading', { name: 'Your templates' }))).toBeLessThan(await top(blank));
});
