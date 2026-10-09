import { test, expect } from '@playwright/test';

test.describe('Editor Phase 2 Comprehensive Smoke Test', () => {
  test('drops 7 element types, moves each in different order, resizes, deletes/undoes, checks toast, and wheel zooms', async ({ page }) => {
    // Navigate with mock auth
    await page.addInitScript(() => {
      window.localStorage.setItem('token', 'fake-token');
    });

    await page.goto('http://localhost:5173/editor');

    page.on('console', msg => console.log('[BROWSER]', msg.text()));
    const canvas = page.locator('#canvas');
    await expect(canvas).toBeVisible();

    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error('Canvas bounding box not found');

    const elementConfigs = [
      { type: 'text', label: 'Text', dropX: 10, dropY: 10 },
      { type: 'divider', label: 'Divider', dropX: 10, dropY: 50 },
      { type: 'signature', label: 'Signature', dropX: 10, dropY: 70 },
      { type: 'qr', label: 'QR Code', dropX: 10, dropY: 130 },
      { type: 'image', label: 'Image', dropX: 130, dropY: 130 },
      { type: 'totals', label: 'Totals', dropX: 10, dropY: 210 },
      { type: 'items_table', label: 'Table', dropX: 10, dropY: 300 },
    ];

    // 1. Drop ALL 7 element types at dedicated, non-overlapping coordinates
    for (const item of elementConfigs) {
      const paletteItem = page.locator(`text="${item.label}"`).first();
      await expect(paletteItem).toBeVisible();

      const targetX = canvasBox.x + item.dropX;
      const targetY = canvasBox.y + item.dropY;

      await paletteItem.hover();
      await page.mouse.down();
      await page.mouse.move(targetX, targetY, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(50);
    }

    // 2. Assert 7 elements exist
    const elements = page.locator('[data-element-id]');
    await expect(elements).toHaveCount(7);

    const allElements = await page.evaluate(() => {
      const store = (window as unknown as Window & { __editorStore?: { getState: () => { elements: Array<{ id: string; type: string; x: number; y: number; width: number; height: number }> } } }).__editorStore;
      return store?.getState().elements;
    });
    console.log('ALL ELEMENTS IN STORE AFTER DROPS:', allElements);

    // 3. Select each one in a different order and move it
    const visitOrder = ['totals', 'text', 'divider', 'qr', 'image', 'signature', 'items_table'];
    for (const type of visitOrder) {
      const el = page.locator(`[data-type="${type}"]`).first();
      const preBox = await el.boundingBox();
      console.log(`Pre-click box for ${type}:`, preBox);
      const clickX = preBox!.x + preBox!.width / 2;
      const clickY = preBox!.y + preBox!.height / 2;
      const elAtPoint = await page.evaluate(([x, y]) => {
        let cur = document.elementFromPoint(x, y);
        const trail: string[] = [];
        while (cur) {
          trail.push(`${cur.tagName}.${cur.className}(id=${cur.id})`);
          cur = cur.parentElement;
        }
        return trail.join(' -> ');
      }, [clickX, clickY]);
      console.log(`Ancestors at (${clickX}, ${clickY}):`, elAtPoint);
      await el.click({ force: true });
      const storeSelectedId = await page.evaluate(() => (window as any).__editorStore?.getState().selectedId);
      console.log('Store selectedId after clicking', type, ':', storeSelectedId);
      await expect(page.locator('.moveable-control-box')).toHaveCount(1);

      const initialX = Number(await el.getAttribute('data-x'));
      const initialY = Number(await el.getAttribute('data-y'));

      const box = await el.boundingBox();
      expect(box).not.toBeNull();

      const startX = box!.x + box!.width / 2;
      const startY = box!.y + box!.height / 2;

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + 32, startY, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(50);

      const updatedX = Number(await el.getAttribute('data-x'));
      const updatedY = Number(await el.getAttribute('data-y'));
      console.log(`Type: ${type}, initial: (${initialX},${initialY}), updated: (${updatedX},${updatedY})`);

      // Assert stored position changed
      expect(updatedX !== initialX).toBe(true);
    }

    // 4. Resize one via a handle (resize the Text element)
    const textEl = page.locator('[data-type="text"]').first();
    await textEl.click();
    await expect(page.locator('.moveable-control-box')).toHaveCount(1);

    const initialWidth = Number(await textEl.getAttribute('data-width'));
    const seHandle = page.locator('.moveable-control.moveable-se').first();
    await expect(seHandle).toBeVisible();

    const seBox = await seHandle.boundingBox();
    expect(seBox).not.toBeNull();

    await page.mouse.move(seBox!.x + seBox!.width / 2, seBox!.y + seBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(seBox!.x + 40, seBox!.y + 20, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(50);

    const updatedWidth = Number(await textEl.getAttribute('data-width'));
    expect(updatedWidth).toBeGreaterThan(initialWidth);

    // 5. Delete one and undo it
    // Deselect first: the resized text now overlaps the divider, and its selected
    // "s" handle would sit on top of the divider's center.
    await page.mouse.click(canvasBox.x - 40, canvasBox.y + 40);
    await expect(page.locator('.moveable-control-box')).toHaveCount(0);
    const dividerEl = page.locator('[data-type="divider"]').first();
    await dividerEl.click();
    await page.keyboard.press('Delete');
    await expect(page.locator('[data-element-id]')).toHaveCount(6);

    await page.keyboard.press('Control+z');
    await expect(page.locator('[data-element-id]')).toHaveCount(7);

    // 6. Verify toast for a second items_table
    const tablePalette = page.locator('text="Table"').first();
    await tablePalette.hover();
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + 50, canvasBox.y + 50, { steps: 5 });
    await page.mouse.up();

    const toast = page.locator('text="Only one items table is allowed."');
    await expect(toast).toBeVisible();

    // 7. Verify wheel zoom changes the scale
    const zoomBefore = await page.evaluate(() => {
      const store = (window as unknown as Window & { __editorStore?: { getState: () => { zoom: number } } }).__editorStore;
      return store?.getState().zoom ?? 1;
    });

    await page.mouse.move(canvasBox.x + 100, canvasBox.y + 100);
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(300);

    const zoomAfter = await page.evaluate(() => {
      const store = (window as unknown as Window & { __editorStore?: { getState: () => { zoom: number } } }).__editorStore;
      return store?.getState().zoom ?? 1;
    });

    expect(zoomAfter).toBeGreaterThan(zoomBefore);

    // 8. Save screenshot
    await page.screenshot({ path: 'test-results/editor-smoke.png' });
  });
});
