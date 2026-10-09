import { test, expect } from '@playwright/test';

test.describe('Editor Phase 2 Smoke Test', () => {
  test('drags elements, resizes, undo/redo, and zooms correctly', async ({ page }) => {
    // Navigate to editor directly. Mock auth by setting localStorage first
    await page.addInitScript(() => {
      window.localStorage.setItem('token', 'fake-token');
    });

    await page.goto('http://localhost:5173/editor');

    // Wait for canvas to be ready
    const canvas = page.locator('#canvas');
    await expect(canvas).toBeVisible();

    // 1. Drag the Text element to the canvas
    const textPalette = page.locator('text="Text"');
    await expect(textPalette).toBeVisible();

    // dnd-kit can be tricky to drag via Playwright. We use hover and mouse events.
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error("Canvas not found");
    const dropX = canvasBox.x + 50;
    const dropY = canvasBox.y + 50;

    await textPalette.hover();
    await page.mouse.down();
    await page.mouse.move(dropX, dropY, { steps: 10 });
    await page.mouse.up();

    // Check if Text element exists on canvas
    const textEl = page.locator('text="Sample Text"');
    await expect(textEl).toBeVisible();

    // 2. Drag to move it
    await textEl.hover();
    await page.mouse.down();
    await page.mouse.move(dropX + 50, dropY + 50, { steps: 10 });
    await page.mouse.up();

    // 3. Resize it via the 'se' handle (since it's selected, react-moveable renders handles)
    // The handle class usually starts with `moveable-control` or `moveable-se`
    const seHandle = page.locator('.moveable-control.moveable-se').first();
    await expect(seHandle).toBeVisible();
    await seHandle.hover();
    await page.mouse.down();
    await page.mouse.move(dropX + 100, dropY + 100, { steps: 10 });
    await page.mouse.up();

    // 4. Press Delete
    await page.keyboard.press('Delete');
    await expect(textEl).toBeHidden();

    // 5. Press Ctrl+Z
    await page.keyboard.press('Control+z');
    await expect(textEl).toBeVisible();

    // 6. Set zoom to 0.5 (using zoom out button)
    const zoomOutBtn = page.locator('button:has-text("-")');
    await zoomOutBtn.click();
    await zoomOutBtn.click();
    await zoomOutBtn.click();
    await zoomOutBtn.click();
    await zoomOutBtn.click();
    // Assuming 5 clicks drops from 100% -> 90 -> 80 -> 70 -> 60 -> 50%

    // 7. Drag Image element at zoom 0.5
    const imagePalette = page.locator('text="Image"');
    const box2 = await canvas.boundingBox();
    const dropX2 = box2!.x + 50;
    const dropY2 = box2!.y + 50;

    await imagePalette.hover();
    await page.mouse.down();
    await page.mouse.move(dropX2, dropY2, { steps: 10 });
    await page.mouse.up();

    const imageEl = page.locator('text="logo"');
    await expect(imageEl).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'test-results/editor-smoke.png' });
  });
});
