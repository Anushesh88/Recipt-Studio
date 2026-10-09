# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: editor.spec.ts >> Editor Phase 2 Smoke Test >> drags elements, resizes, undo/redo, and zooms correctly
- Location: tests\editor.spec.ts:4:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.moveable-control.moveable-se').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('.moveable-control.moveable-se').first() with timeout 5000ms
  - waiting for locator('.moveable-control.moveable-se').first()

```

```yaml
- banner:
  - heading "Receipt Studio - Editor (Phase 2)" [level=1]
  - button "-"
  - text: 100%
  - button "+"
  - button "Undo"
  - button "Redo"
- heading "Elements" [level=2]
- button "Text"
- button "Image"
- button "Table"
- button "Totals"
- button "QR Code"
- button "Signature"
- button "Divider"
- text: 100%
- button "Reset"
- text: Auto-Height Mode Sample Text
- status: Draggable item palette-text was dropped over droppable area canvas
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Editor Phase 2 Smoke Test', () => {
  4  |   test('drags elements, resizes, undo/redo, and zooms correctly', async ({ page }) => {
  5  |     // Navigate to editor directly. Mock auth by setting localStorage first
  6  |     await page.addInitScript(() => {
  7  |       window.localStorage.setItem('token', 'fake-token');
  8  |     });
  9  | 
  10 |     await page.goto('http://localhost:5173/editor');
  11 | 
  12 |     // Wait for canvas to be ready
  13 |     const canvas = page.locator('#canvas');
  14 |     await expect(canvas).toBeVisible();
  15 | 
  16 |     // 1. Drag the Text element to the canvas
  17 |     const textPalette = page.locator('text="Text"');
  18 |     await expect(textPalette).toBeVisible();
  19 | 
  20 |     // dnd-kit can be tricky to drag via Playwright. We use hover and mouse events.
  21 |     const canvasBox = await canvas.boundingBox();
  22 |     if (!canvasBox) throw new Error("Canvas not found");
  23 |     const dropX = canvasBox.x + 50;
  24 |     const dropY = canvasBox.y + 50;
  25 | 
  26 |     await textPalette.hover();
  27 |     await page.mouse.down();
  28 |     await page.mouse.move(dropX, dropY, { steps: 10 });
  29 |     await page.mouse.up();
  30 | 
  31 |     // Check if Text element exists on canvas
  32 |     const textEl = page.locator('text="Sample Text"');
  33 |     await expect(textEl).toBeVisible();
  34 | 
  35 |     // 2. Drag to move it
  36 |     await textEl.hover();
  37 |     await page.mouse.down();
  38 |     await page.mouse.move(dropX + 50, dropY + 50, { steps: 10 });
  39 |     await page.mouse.up();
  40 | 
  41 |     // 3. Resize it via the 'se' handle (since it's selected, react-moveable renders handles)
  42 |     // The handle class usually starts with `moveable-control` or `moveable-se`
  43 |     const seHandle = page.locator('.moveable-control.moveable-se').first();
> 44 |     await expect(seHandle).toBeVisible();
     |                            ^ Error: expect(locator).toBeVisible() failed
  45 |     await seHandle.hover();
  46 |     await page.mouse.down();
  47 |     await page.mouse.move(dropX + 100, dropY + 100, { steps: 10 });
  48 |     await page.mouse.up();
  49 | 
  50 |     // 4. Press Delete
  51 |     await page.keyboard.press('Delete');
  52 |     await expect(textEl).toBeHidden();
  53 | 
  54 |     // 5. Press Ctrl+Z
  55 |     await page.keyboard.press('Control+z');
  56 |     await expect(textEl).toBeVisible();
  57 | 
  58 |     // 6. Set zoom to 0.5 (using zoom out button)
  59 |     const zoomOutBtn = page.locator('button:has-text("-")');
  60 |     await zoomOutBtn.click();
  61 |     await zoomOutBtn.click();
  62 |     await zoomOutBtn.click();
  63 |     await zoomOutBtn.click();
  64 |     await zoomOutBtn.click();
  65 |     // Assuming 5 clicks drops from 100% -> 90 -> 80 -> 70 -> 60 -> 50%
  66 | 
  67 |     // 7. Drag Image element at zoom 0.5
  68 |     const imagePalette = page.locator('text="Image"');
  69 |     const box2 = await canvas.boundingBox();
  70 |     const dropX2 = box2!.x + 50;
  71 |     const dropY2 = box2!.y + 50;
  72 | 
  73 |     await imagePalette.hover();
  74 |     await page.mouse.down();
  75 |     await page.mouse.move(dropX2, dropY2, { steps: 10 });
  76 |     await page.mouse.up();
  77 | 
  78 |     const imageEl = page.locator('text="logo"');
  79 |     await expect(imageEl).toBeVisible();
  80 | 
  81 |     // Take screenshot
  82 |     await page.screenshot({ path: 'test-results/editor-smoke.png' });
  83 |   });
  84 | });
  85 | 
```