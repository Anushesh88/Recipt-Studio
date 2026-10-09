import { test, expect } from '@playwright/test';

test.describe('Bug A Selection Test', () => {
  test('can select older elements', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('token', 'fake-token');
    });

    await page.goto('http://localhost:5173/editor');

    const canvas = page.locator('#canvas');
    await expect(canvas).toBeVisible();
    
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error('no canvas');

    // Drop text 1
    await page.locator('text="Text"').hover();
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + 50, canvasBox.y + 50, { steps: 10 });
    await page.mouse.up();
    
    const text1 = page.locator('text="Sample Text"').first();
    await expect(text1).toBeVisible();

    // Drop image
    await page.locator('text="Image"').hover();
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + 100, canvasBox.y + 100, { steps: 10 });
    await page.mouse.up();

    const img1 = page.locator('text="logo"').first();
    await expect(img1).toBeVisible();

    // Click text 1 (the older element)
    await text1.click();
    
    // Assert Moveable appears for text 1
    // The moveable box has a class 'moveable-control-box'
    const moveableBox = page.locator('.moveable-control-box');
    await expect(moveableBox).toBeVisible();

    // Now drag text1 by its center
    const t1Box = await text1.boundingBox();
    if (!t1Box) throw new Error('no t1box');
    
    await page.mouse.move(t1Box.x + t1Box.width / 2, t1Box.y + t1Box.height / 2);
    await page.mouse.down();
    await page.mouse.move(t1Box.x + t1Box.width / 2 + 40, t1Box.y + t1Box.height / 2 + 40, { steps: 10 });
    await page.mouse.up();

    // The text1 should have moved
    const t1BoxAfter = await text1.boundingBox();
    expect(t1BoxAfter!.x).toBeGreaterThan(t1Box.x + 20); // allow for snap
  });
});
