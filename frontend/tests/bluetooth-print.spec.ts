import { test, expect, type Page } from '@playwright/test';
import { STARTER_TEMPLATES } from '../src/lib/starterTemplates';

// Printing a receipt on a Bluetooth thermal printer. The printer is a fake
// that keeps the bytes it's sent; the test draws them back into the picture
// a real printer would burn.

const API = 'http://localhost:8000';
const APP = 'http://localhost:5173';
const SHOTS = process.env.PRINT_SHOTS;

async function cafeReceipt(page: Page) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const password = `pw-${Math.random().toString(36).slice(2)}`;
  await page.request.post(`${API}/auth/register`, { data: { email, password } });
  const { access_token: token } = await (await page.request.post(`${API}/auth/login`, { form: { username: email, password } })).json();
  const headers = { Authorization: `Bearer ${token}` };
  await page.request.patch(`${API}/auth/me`, { headers, data: { invoicing_mode: 'receipts', business_name: 'Brew & Bloom', upi_id: 'brewbloom@okhdfc' } });
  const canvas = STARTER_TEMPLATES.find((t) => t.id === 'cafe-receipt')!.canvas;
  const template = (await (await page.request.post(`${API}/templates`, { headers, data: { name: 'Cafe', canvas } })).json()).id;
  const receipt = await page.request.post(`${API}/receipts`, { headers, data: { template_id: template, data: {
    business: { name: 'Brew & Bloom' }, receipt: { date: '2026-10-16', currency: 'INR', payment_method: 'UPI' }, custom: { table_no: '4' },
    items: [{ description: 'Cappuccino', qty: '2', unit_price: '180' }, { description: 'Masala chai', qty: '1', unit_price: '60' }],
  } } });
  expect(receipt.status()).toBe(201);
  await page.addInitScript((t) => window.localStorage.setItem('token', t), token);
}

// A pretend Web Bluetooth printer that keeps what it's sent
const FAKE_PRINTER = () => {
  const sent: number[] = [];
  (window as unknown as { __printed: number[] }).__printed = sent;
  const characteristic = {
    uuid: 'fake', properties: { write: true, writeWithoutResponse: true },
    writeValue: async (d: Uint8Array) => { sent.push(...d); },
    writeValueWithoutResponse: async (d: Uint8Array) => { sent.push(...d); },
  };
  let connected = false;
  const device = {
    id: 'printer-1', name: 'MPT-II',
    gatt: {
      get connected() { return connected; },
      connect: async () => { connected = true; return { connected: true, getPrimaryServices: async () => [{ getCharacteristics: async () => [characteristic] }] }; },
      disconnect: () => { connected = false; },
    },
  };
  Object.defineProperty(navigator, 'bluetooth', { value: { requestDevice: async () => device } });
};

// The printed raster bands, as one picture (width in dots, rows of 0/1)
const decode = (bytes: number[]) => {
  const rows: number[][] = [];
  let width = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0x1d && bytes[i + 1] === 0x76 && bytes[i + 2] === 0x30) {
      const wide = bytes[i + 4] + bytes[i + 5] * 256;
      const high = bytes[i + 6] + bytes[i + 7] * 256;
      width = wide * 8;
      let at = i + 8;
      for (let y = 0; y < high; y++, at += wide) {
        rows.push(Array.from({ length: width }, (_, x) => (bytes[at + (x >> 3)] >> (7 - (x & 7))) & 1));
      }
      i = at - 1;
    }
  }
  return { width, rows };
};

for (const paper of [58, 80] as const) {
  test(`prints the receipt on a ${paper} mm Bluetooth printer`, async ({ page }) => {
    await page.addInitScript(FAKE_PRINTER);
    await cafeReceipt(page);
    await page.goto(`${APP}/history`);
    await page.getByRole('button', { name: /Print R-0001/ }).first().click();
    const menu = page.locator('[data-print]');
    await menu.getByRole('radio', { name: `${paper} mm` }).click();
    await menu.getByRole('button', { name: 'Print on a Bluetooth printer' }).click();
    await expect(menu.getByRole('status')).toHaveText('Sent to the printer.', { timeout: 20_000 });
    // The printer is remembered for the next receipt
    await expect(menu.getByRole('button', { name: 'Print on MPT-II' })).toBeVisible();

    const bytes = await page.evaluate(() => (window as unknown as { __printed: number[] }).__printed);
    expect(bytes.slice(0, 2)).toEqual([0x1b, 0x40]);
    const { width, rows } = decode(bytes);
    expect(width).toBe(paper === 58 ? 384 : 576);
    expect(rows.length).toBeGreaterThan(400);
    const ink = rows.flat().filter(Boolean).length / (width * rows.length);
    expect(ink).toBeGreaterThan(0.02); // text and the QR code are there...
    expect(ink).toBeLessThan(0.4); // ...on mostly white paper

    if (SHOTS) {
      // What the printer would burn, for a look
      const png = await page.evaluate(({ width, rows }) => {
        const c = document.createElement('canvas');
        c.width = width;
        c.height = rows.length;
        const ctx = c.getContext('2d')!;
        const img = ctx.createImageData(width, rows.length);
        rows.forEach((row, y) => row.forEach((dot, x) => {
          const i = (y * width + x) * 4;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = dot ? 0 : 255;
          img.data[i + 3] = 255;
        }));
        ctx.putImageData(img, 0, 0);
        return c.toDataURL('image/png');
      }, { width, rows });
      const fs = await import('node:fs');
      fs.writeFileSync(`${SHOTS}/printed-${paper}mm.png`, Buffer.from(png.split(',')[1], 'base64'));
    }
  });
}

test('without Web Bluetooth, the print menu says where it works and offers the PDF', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'bluetooth', { value: undefined }));
  await cafeReceipt(page);
  await page.goto(`${APP}/history`);
  await page.getByRole('button', { name: /Print R-0001/ }).first().click();
  const menu = page.locator('[data-print]');
  await expect(menu.locator('[data-no-bluetooth]')).toContainText('Chrome on Android');
  const popup = page.waitForEvent('popup');
  await menu.getByRole('button', { name: 'Print the PDF another way' }).click();
  await popup;
  await expect(menu.getByRole('status')).toContainText('Opened the PDF');
});
