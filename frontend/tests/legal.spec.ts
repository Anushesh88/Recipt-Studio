import { test, expect } from '@playwright/test';

// Privacy Policy and Terms: public, and linked from the login page (Google's
// consent screen links to them too)

const APP = 'http://localhost:5173';

test('the legal pages open without signing in, from the login page', async ({ page }) => {
  await page.goto(`${APP}/login`);
  await page.getByRole('link', { name: 'Privacy Policy' }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole('heading', { name: 'Privacy Policy', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'anusheshjumale88@gmail.com' }).first()).toHaveAttribute('href', 'mailto:anusheshjumale88@gmail.com');

  await page.getByRole('link', { name: 'Terms of Service' }).click();
  await expect(page.getByRole('heading', { name: 'Terms of Service', level: 1 })).toBeVisible();
  await expect(page.getByText("you're responsible for what you issue")).toBeVisible();

  await page.goto(`${APP}/login`);
  await page.getByRole('button', { name: "Don't have an account? Register" }).click();
  await expect(page.getByText('By creating an account you agree to the')).toBeVisible();
});

test('they stay reachable when signed in', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('token', 'any-token'));
  await page.goto(`${APP}/terms`);
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByRole('heading', { name: 'Terms of Service', level: 1 })).toBeVisible();
});
