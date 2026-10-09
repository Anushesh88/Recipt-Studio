import { test, expect } from '@playwright/test';

test.describe('Task 2: Live Clamping Verification', () => {
  test('element is clamped within page bounds during drag even before mouse up', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('token', 'fake-token');
    });

    await page.goto('http://localhost:5173/editor');

    const canvas = page.locator('#canvas');
    await expect(canvas).toBeVisible();

    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error('Canvas not found');

    // Drop a Text element
    const textPalette = page.locator('text="Text"').first();
    await textPalette.hover();
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + 50, canvasBox.y + 50, { steps: 5 });
    await page.mouse.up();

    const textEl = page.locator('text="Sample Text"').first();
    await expect(textEl).toBeVisible();

    const elBox = await textEl.boundingBox();
    if (!elBox) throw new Error('Element not found');

    // 1. Drag the element FAR outside the page to top-left with mouse STILL held down
    await page.mouse.move(elBox.x + elBox.width / 2, elBox.y + elBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x - 200, canvasBox.y - 200, { steps: 10 });

    // Assert (BEFORE mouse up) that its bounding box is inside the page's bounding box
    const liveElBoxTopLeft = await textEl.boundingBox();
    expect(liveElBoxTopLeft).not.toBeNull();
    expect(liveElBoxTopLeft!.x).toBeGreaterThanOrEqual(canvasBox.x - 1);
    expect(liveElBoxTopLeft!.y).toBeGreaterThanOrEqual(canvasBox.y - 1);

    // 2. Drag the element FAR outside to bottom-right with mouse STILL held down
    await page.mouse.move(canvasBox.x + canvasBox.width + 300, canvasBox.y + canvasBox.height + 300, { steps: 10 });
    const liveElBoxBottomRight = await textEl.boundingBox();
    expect(liveElBoxBottomRight).not.toBeNull();
    expect(liveElBoxBottomRight!.x + liveElBoxBottomRight!.width).toBeLessThanOrEqual(canvasBox.x + canvasBox.width + 1);
    expect(liveElBoxBottomRight!.y + liveElBoxBottomRight!.height).toBeLessThanOrEqual(canvasBox.y + canvasBox.height + 1);

    await page.mouse.up();
  });
});
