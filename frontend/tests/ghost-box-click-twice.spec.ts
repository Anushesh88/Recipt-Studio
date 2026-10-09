import { test, expect } from '@playwright/test';

test.describe('Task 1: Ghost Box & Click Twice Verification', () => {
  test('dropped element is immediately draggable without clicking twice and moveable box stays synced without ghosts', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('token', 'fake-token');
    });

    await page.goto('http://localhost:5173/editor');

    const canvas = page.locator('#canvas');
    await expect(canvas).toBeVisible();

    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error('Canvas not found');

    const dropX = canvasBox.x + 40;
    const dropY = canvasBox.y + 40;

    // Drop a Text element
    const textPalette = page.locator('text="Text"').first();
    await textPalette.hover();
    await page.mouse.down();
    await page.mouse.move(dropX, dropY, { steps: 5 });
    await page.mouse.up();

    const textEl = page.locator('text="Sample Text"').first();
    await expect(textEl).toBeVisible();

    // WITHOUT clicking again, assert exactly one .moveable-control-box exists
    const controlBoxes = page.locator('.moveable-control-box');
    await expect(controlBoxes).toHaveCount(1);

    // Assert that moveable box matches element's bounding box within 2px
    const elBoxBefore = await textEl.boundingBox();
    const ctrlBoxBefore = await controlBoxes.first().boundingBox();
    expect(elBoxBefore).not.toBeNull();
    expect(ctrlBoxBefore).not.toBeNull();
    expect(Math.abs(elBoxBefore!.x - ctrlBoxBefore!.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(elBoxBefore!.y - ctrlBoxBefore!.y)).toBeLessThanOrEqual(2);

    // WITHOUT clicking again, drag it by 60px
    const startX = elBoxBefore!.x + elBoxBefore!.width / 2;
    const startY = elBoxBefore!.y + elBoxBefore!.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 60, startY + 60, { steps: 10 });
    await page.mouse.up();

    // Assert it actually moved by approx 60px
    const elBoxAfterDrag = await textEl.boundingBox();
    expect(elBoxAfterDrag!.x).toBeGreaterThan(elBoxBefore!.x + 40);

    // Assert exactly ONE moveable-control-box exists and matches the new bounding box (no ghost at old pos)
    await expect(controlBoxes).toHaveCount(1);
    const ctrlBoxAfterDrag = await controlBoxes.first().boundingBox();
    expect(Math.abs(elBoxAfterDrag!.x - ctrlBoxAfterDrag!.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(elBoxAfterDrag!.y - ctrlBoxAfterDrag!.y)).toBeLessThanOrEqual(2);

    // Repeat after a resize via se handle
    const seHandle = page.locator('.moveable-control.moveable-se').first();
    await expect(seHandle).toBeVisible();
    const seBox = await seHandle.boundingBox();
    expect(seBox).not.toBeNull();

    await page.mouse.move(seBox!.x + seBox!.width / 2, seBox!.y + seBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(seBox!.x + 40, seBox!.y + 40, { steps: 10 });
    await page.mouse.up();

    // Assert exactly ONE moveable-control-box exists and matches after resize
    await expect(controlBoxes).toHaveCount(1);
    const elBoxAfterResize = await textEl.boundingBox();
    const ctrlBoxAfterResize = await controlBoxes.first().boundingBox();
    expect(Math.abs(elBoxAfterResize!.x - ctrlBoxAfterResize!.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(elBoxAfterResize!.y - ctrlBoxAfterResize!.y)).toBeLessThanOrEqual(2);
    const seBoxAfter = await seHandle.boundingBox();
    expect(seBoxAfter).not.toBeNull();
    expect(Math.abs((seBoxAfter!.x + seBoxAfter!.width / 2) - (elBoxAfterResize!.x + elBoxAfterResize!.width))).toBeLessThanOrEqual(3);
    expect(Math.abs((seBoxAfter!.y + seBoxAfter!.height / 2) - (elBoxAfterResize!.y + elBoxAfterResize!.height))).toBeLessThanOrEqual(3);
  });
});
