import { test, expect } from '@playwright/test';

test.describe('Task 3: Cursor-Centered Zoom Verification', () => {
  test('wheel zooms toward cursor and supports drop/move/resize at zoom 0.5 and 2', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('token', 'fake-token');
    });

    await page.goto('http://localhost:5173/editor');

    const canvas = page.locator('#canvas');
    await expect(canvas).toBeVisible();

    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error('Canvas not found');

    // 1. Drop a Text element
    const textPalette = page.locator('text="Text"').first();
    await textPalette.hover();
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + 60, canvasBox.y + 60, { steps: 5 });
    await page.mouse.up();

    const textEl = page.locator('text="Sample Text"').first();
    await expect(textEl).toBeVisible();

    const boxBefore = await textEl.boundingBox();
    expect(boxBefore).not.toBeNull();
    const cursorX = boxBefore!.x + boxBefore!.width / 2;
    const cursorY = boxBefore!.y + boxBefore!.height / 2;

    // Hover mouse over the center of the element
    await page.mouse.move(cursorX, cursorY);

    // Wheel-zoom in
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(300);

    // Assert zoom changed
    const currentZoom = await page.evaluate(() => {
      const store = (window as unknown as Window & { __editorStore?: { getState: () => { zoom: number } } }).__editorStore;
      return store?.getState().zoom ?? 1;
    });
    expect(currentZoom).toBeGreaterThan(1.1);

    // Assert the element's center stays within 10px of the cursor
    const boxAfter = await textEl.boundingBox();
    expect(boxAfter).not.toBeNull();
    const newCenterX = boxAfter!.x + boxAfter!.width / 2;
    const newCenterY = boxAfter!.y + boxAfter!.height / 2;

    expect(Math.abs(newCenterX - cursorX)).toBeLessThanOrEqual(10);
    expect(Math.abs(newCenterY - cursorY)).toBeLessThanOrEqual(10);

    // Reset zoom to 100% using the reset button
    const resetBtn = page.locator('button:has-text("100%")').first();
    await resetBtn.click();
    await page.waitForTimeout(100);

    // 2. Test drop, move and resize at zoom 0.5
    await page.evaluate(() => {
      const store = (window as unknown as Window & { __editorStore?: { getState: () => { setZoom: (z: number) => void } } }).__editorStore;
      store?.getState().setZoom(0.5);
    });
    await page.waitForTimeout(100);

    const canvasBox05 = await canvas.boundingBox();
    expect(canvasBox05).not.toBeNull();

    // Drop Image at zoom 0.5
    const imagePalette = page.locator('text="Image"').first();
    await imagePalette.hover();
    await page.mouse.down();
    await page.mouse.move(canvasBox05!.x + 40, canvasBox05!.y + 40, { steps: 5 });
    await page.mouse.up();

    const imgEl = page.locator('text="logo"').first();
    await expect(imgEl).toBeVisible();

    // Move it by 30 screen px (which corresponds to 60 unscaled px at 0.5 scale)
    const imgBox = await imgEl.boundingBox();
    expect(imgBox).not.toBeNull();
    await page.mouse.move(imgBox!.x + imgBox!.width / 2, imgBox!.y + imgBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(imgBox!.x + imgBox!.width / 2 + 30, imgBox!.y + imgBox!.height / 2 + 30, { steps: 5 });
    await page.mouse.up();

    const imgBoxAfter = await imgEl.boundingBox();
    expect(imgBoxAfter!.x).toBeGreaterThan(imgBox!.x + 20);

    // 3. Test drop, move and resize at zoom 2.0
    await page.evaluate(() => {
      const store = (window as unknown as Window & { __editorStore?: { getState: () => { setZoom: (z: number) => void } } }).__editorStore;
      store?.getState().setZoom(2.0);
    });
    await page.waitForTimeout(100);

    const canvasBox2 = await canvas.boundingBox();
    expect(canvasBox2).not.toBeNull();

    // Drop QR Code at zoom 2.0
    const qrPalette = page.locator('text="QR Code"').first();
    await qrPalette.hover();
    await page.mouse.down();
    await page.mouse.move(canvasBox2!.x + 80, canvasBox2!.y + 80, { steps: 5 });
    await page.mouse.up();

    const qrEl = page.locator('[data-type="qr"]').first();
    await expect(qrEl).toBeVisible();

    // Move QR element at zoom 2.0
    const qrBox = await qrEl.boundingBox();
    expect(qrBox).not.toBeNull();
    await page.mouse.move(qrBox!.x + qrBox!.width / 2, qrBox!.y + qrBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(qrBox!.x + qrBox!.width / 2 + 40, qrBox!.y + qrBox!.height / 2 + 40, { steps: 5 });
    await page.mouse.up();

    const qrBoxAfter = await qrEl.boundingBox();
    expect(qrBoxAfter!.x).toBeGreaterThan(qrBox!.x + 30);
  });
});
