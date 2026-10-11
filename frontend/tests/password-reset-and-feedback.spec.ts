import { test, expect, type Page } from '@playwright/test';

// Forgot password (/forgot-password, /reset-password?token=…) and the Feedback button

const API = 'http://localhost:8000';
const APP = 'http://localhost:5173';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };

async function newAccount(page: Page): Promise<{ email: string; token: string }> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const password = `pw-${Math.random().toString(36).slice(2)}`;
  await page.request.post(`${API}/auth/register`, { data: { email, password } });
  const { access_token: token } = await (await page.request.post(`${API}/auth/login`, { form: { username: email, password } })).json();
  await page.request.patch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` }, data: { invoicing_mode: 'both' } });
  return { email, token };
}

test('forgot password: ask for a link from the sign-in page', async ({ page }) => {
  const { email } = await newAccount(page);
  await page.goto(`${APP}/login`);
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await page.getByLabel('Email').fill('not-an-email');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByText('Enter a valid email address')).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  // The same answer whether or not the account exists
  await expect(page.getByRole('status')).toContainText("If an account uses that email, we've sent it a link");
});

test('reset password: a bad link says so; a good one signs you in', async ({ page }) => {
  await page.goto(`${APP}/reset-password`);
  await expect(page.getByRole('alert')).toContainText('This link is incomplete');

  // A token the server doesn't accept (the real backend answers)
  await page.goto(`${APP}/reset-password?token=not-a-real-token`);
  await page.getByLabel('New password').fill('a-new-password');
  await page.getByLabel('Type it again').fill('a-different-one');
  await page.getByRole('button', { name: 'Save and sign in' }).click();
  await expect(page.getByText("The passwords don't match")).toBeVisible();
  await page.getByLabel('Type it again').fill('a-new-password');
  await page.getByRole('button', { name: 'Save and sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('This link has expired or was already used');
  await expect(page.getByRole('link', { name: 'Ask for a new link' })).toBeVisible();

  // A good link (the emailed token is stood in for; the backend side is in test_password_reset_and_feedback.py)
  const { token } = await newAccount(page);
  const sent: unknown[] = [];
  await page.route(`${API}/auth/reset-password`, (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ headers: CORS });
    sent.push(route.request().postDataJSON());
    return route.fulfill({ headers: CORS, json: { access_token: token, token_type: 'bearer' } });
  });
  await page.goto(`${APP}/reset-password?token=emailed-token`);
  await page.getByLabel('New password').fill('my-new-password');
  await page.getByLabel('Type it again').fill('my-new-password');
  await page.getByRole('button', { name: 'Save and sign in' }).click();
  await page.waitForURL('**/templates');
  expect(sent).toEqual([{ token: 'emailed-token', password: 'my-new-password' }]);
});

test('feedback: sent from any page, not shown in the editor', async ({ page }) => {
  const { token } = await newAccount(page);
  await page.addInitScript((t) => window.localStorage.setItem('token', t), token);
  await page.goto(`${APP}/history`);
  await page.getByRole('button', { name: 'Feedback' }).click();
  const box = page.locator('[data-feedback]');
  await expect(box.getByRole('button', { name: 'Send feedback' })).toBeDisabled();
  await box.getByLabel("What's confusing, broken, or missing?").fill('The history page needs a search box');
  await box.getByRole('button', { name: 'Send feedback' }).click();
  await expect(box.getByRole('status')).toContainText('Thanks! Your feedback was sent.');

  await page.goto(`${APP}/editor`);
  await expect(page.locator('#canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Feedback' })).toHaveCount(0);
  // Not an admin: no "Read feedback" link
  await page.goto(`${APP}/settings`);
  await expect(page.getByText('Signed in as')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Read feedback' })).toHaveCount(0);
});
