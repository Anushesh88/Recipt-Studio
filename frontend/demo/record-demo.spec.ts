import { test, type Locator, type Page } from '@playwright/test';

// A one-minute walkthrough of Receipt Studio, recorded as a video: from the
// landing page to a branded café bill with a UPI QR, sent on WhatsApp.
// A cursor and captions are drawn on the page, since recordings show neither.

const OVERLAY = () => {
  const css = `
    #demo-cursor { position: fixed; z-index: 99999; width: 24px; height: 24px; margin: -3px 0 0 -3px; pointer-events: none; }
    #demo-cursor svg { filter: drop-shadow(0 1px 2px rgba(0,0,0,.45)); }
    .demo-ripple { position: fixed; z-index: 99998; width: 40px; height: 40px; margin: -20px 0 0 -20px; border-radius: 50%;
      background: rgba(79,70,229,.4); pointer-events: none; animation: demo-ripple .55s ease-out forwards; }
    @keyframes demo-ripple { from { transform: scale(.3); opacity: 1 } to { transform: scale(1.7); opacity: 0 } }
    #demo-caption { position: fixed; z-index: 99997; left: 50%; bottom: 26px; transform: translateX(-50%); max-width: 82%;
      background: rgba(17,24,39,.92); color: #fff; font: 600 22px/1.35 Inter, system-ui, sans-serif; padding: 12px 24px;
      border-radius: 14px; text-align: center; box-shadow: 0 8px 24px rgba(0,0,0,.25); }
    /* Phones: at the top, clear of the app's bottom bars */
    @media (max-width: 600px) {
      #demo-caption { bottom: auto; top: 64px; width: 90%; max-width: none; font-size: 19px; padding: 10px 14px; }
      #demo-card h1 { font-size: 38px; } #demo-card p { font-size: 18px; padding: 0 20px; } #demo-card .url { font-size: 17px; }
    }
    #demo-card { position: fixed; inset: 0; z-index: 100000; display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 14px; background: linear-gradient(135deg,#4338CA,#312E81); color: #fff;
      font-family: Inter, system-ui, sans-serif; text-align: center; }
    #demo-card h1 { font-size: 56px; margin: 0; font-weight: 800; }
    #demo-card p { font-size: 26px; margin: 0; opacity: .92; }
    #demo-card .url { margin-top: 18px; font-size: 26px; font-weight: 700; background: #fff; color: #312E81; padding: 10px 26px; border-radius: 999px; }`;
  const add = () => {
    if (document.getElementById('demo-cursor')) return;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    const cursor = document.createElement('div');
    cursor.id = 'demo-cursor';
    cursor.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M3 2l7 19 2.5-8L21 10z" fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    const last = sessionStorage.getItem('demo-cursor') ?? '640,360';
    const [x, y] = last.split(',');
    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;
    document.body.appendChild(cursor);
    document.addEventListener('mousemove', (e) => {
      cursor.style.left = `${e.clientX}px`;
      cursor.style.top = `${e.clientY}px`;
      sessionStorage.setItem('demo-cursor', `${e.clientX},${e.clientY}`);
    }, true);
    document.addEventListener('mousedown', (e) => {
      const ripple = document.createElement('div');
      ripple.className = 'demo-ripple';
      ripple.style.left = `${e.clientX}px`;
      ripple.style.top = `${e.clientY}px`;
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    }, true);
  };
  if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
};

async function caption(page: Page, text: string | null) {
  await page.evaluate((t) => {
    let el = document.getElementById('demo-caption');
    if (!t) { el?.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'demo-caption'; document.body.appendChild(el); }
    el.textContent = t;
  }, text);
}

const pause = (page: Page, ms: number) => page.waitForTimeout(ms);

// Glide the cursor to an element, then click it
async function tap(page: Page, target: Locator) {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
    await pause(page, 200);
  }
  await target.click();
}

async function type(page: Page, target: Locator, text: string) {
  await tap(page, target);
  await target.fill('');
  await target.pressSequentially(text, { delay: 65 });
}

async function scrollTo(page: Page, y: number) {
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'smooth' }), y);
  await pause(page, 1300);
}

test('record the demo', async ({ page }) => {
  await page.addInitScript(OVERLAY);
  const email = `demo-${Date.now()}@example.com`;

  // 1. The landing page
  await page.goto('/');
  await caption(page, 'Receipt Studio: beautiful bills and GST invoices, in seconds');
  await pause(page, 5500);
  await caption(page, '20 ready-made designs for shops, cafés, clinics, tuition and more');
  await scrollTo(page, await page.locator('#samples').evaluate((el) => el.getBoundingClientRect().top + window.scrollY - 40));
  await pause(page, 2500);
  await scrollTo(page, 0);

  // 2. Sign up
  await caption(page, 'Start free: no card needed');
  await tap(page, page.getByRole('link', { name: 'Start free' }).first());
  await type(page, page.getByLabel('Email'), email);
  await type(page, page.getByLabel('Password'), 'demo-password-123');
  await tap(page, page.getByRole('button', { name: 'Sign Up', exact: true }));
  await page.waitForURL(/welcome|templates/);
  if (page.url().includes('welcome')) {
    await caption(page, 'Simple receipts, GST tax invoices, or both');
    await pause(page, 800);
    await tap(page, page.getByText('Simple receipts', { exact: true }));
    await type(page, page.getByLabel('Business name'), 'Brew & Bloom Café');
    await tap(page, page.getByRole('button', { name: 'Continue' }));
    await page.waitForURL(/templates/);
  }

  // 3. Business details and brand kit, once
  await page.goto('/settings');
  await caption(page, 'Add your details and brand once: every bill uses them');
  const profile = page.locator('[data-business-profile]');
  await type(page, profile.getByLabel('Phone'), '+91 98765 43210');
  await type(page, profile.getByLabel('UPI ID'), 'brewbloom@okhdfc');
  await tap(page, page.getByRole('button', { name: 'Save settings' }));
  await pause(page, 600);
  const kit = page.locator('[data-brand-kit]');
  await kit.scrollIntoViewIfNeeded();
  await kit.getByLabel('Logo file').setInputFiles('public/apple-touch-icon.png');
  await kit.getByText('Logo saved.').waitFor();
  await tap(page, kit.getByRole('button', { name: 'Brand colour #0F766E' }));
  await kit.getByText('Colour saved.').waitFor();
  await tap(page, kit.getByRole('radio', { name: /Friendly/ }));
  await kit.getByText('Fonts saved.').waitFor();
  await kit.locator('[data-brand-preview]').scrollIntoViewIfNeeded();
  await pause(page, 2000);

  // 4. Pick a template: it already wears the brand
  await page.goto('/templates');
  await caption(page, 'Pick a template: your logo, colour and fonts are already on it');
  const cafe = page.locator('[data-starter="cafe-receipt"]');
  await cafe.scrollIntoViewIfNeeded();
  await pause(page, 2200);
  await tap(page, cafe);
  await page.waitForURL(/editor\/.+/);
  await caption(page, 'Change anything, like in Canva, or use it as it is');
  await pause(page, 3500);

  // 5. Fill in a bill
  await page.goto(page.url().replace('/editor/', '/generate/'));
  await caption(page, 'Fill in the bill: totals, tax and the bill number are done for you');
  const business = page.getByLabel('Business name');
  if (!(await business.inputValue())) await type(page, business, 'Brew & Bloom Café');
  await type(page, page.getByLabel('Table no'), '7');
  await type(page, page.getByLabel('Payment method'), 'UPI');
  await type(page, page.getByLabel('Item 1 description'), 'Cappuccino');
  await type(page, page.getByLabel('Item 1 quantity'), '2');
  await type(page, page.getByLabel('Item 1 unit price'), '180');
  await tap(page, page.getByRole('button', { name: 'Add item' }));
  await type(page, page.getByLabel('Item 2 description'), 'Blueberry muffin');
  await type(page, page.getByLabel('Item 2 unit price'), '140');
  await caption(page, 'A UPI QR for the exact amount is on the bill');
  await page.locator('[data-receipt-preview]').scrollIntoViewIfNeeded();
  await pause(page, 3500);

  // 6. Create and send
  await caption(page, 'Create it, then send the PDF on WhatsApp');
  await tap(page, page.getByRole('button', { name: 'Create receipt' }).first());
  await page.getByText(/Receipt R-\d+ saved/).waitFor();
  await pause(page, 1200);
  await tap(page, page.getByRole('button', { name: /on WhatsApp/ }).first());
  await pause(page, 1400);
  await type(page, page.getByLabel("Customer's WhatsApp number"), '98765 43210');
  await pause(page, 2600);
  await page.keyboard.press('Escape');

  // 7. Reports
  await page.goto('/reports');
  await caption(page, 'See what sold, with totals and tax, for any period');
  await pause(page, 3500);

  // 8. End card
  await caption(page, null);
  await page.evaluate(() => {
    const card = document.createElement('div');
    card.id = 'demo-card';
    card.innerHTML = '<h1>Receipt Studio</h1><p>Your design. The maths done. Paid by UPI.</p><p>Free while in early access</p><div class="url">receipt-studio-5tp.pages.dev</div>';
    document.body.appendChild(card);
  });
  await pause(page, 5000);
});
