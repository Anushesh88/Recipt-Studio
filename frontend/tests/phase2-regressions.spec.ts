import { test, expect, type Page } from '@playwright/test';

// Regression checks for the Phase 2 review findings:
// 1. a plain click must not detach an element's DOM from the store
// 2. the thin divider must be selectable and draggable
// 4. drops are clamped inside the page
// 5. drops land at the cursor (top-left), at any zoom

const GRID = 4;

interface StoreEl { id: string; type: string; x: number; y: number; width: number; height: number }
interface StoreShape {
  getState: () => {
    elements: StoreEl[];
    selectedId: string | null;
    past: unknown[];
    page: { width: number; height: number };
    setZoom: (z: number) => void;
  };
}

const storeState = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as { __editorStore: StoreShape }).__editorStore.getState();
    return { elements: s.elements, selectedId: s.selectedId, pastLength: s.past.length, page: s.page };
  });

// Elements whose rendered box no longer matches the store geometry
const domStoreMismatches = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as { __editorStore: StoreShape }).__editorStore.getState();
    return s.elements.flatMap((el) => {
      const node = document.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
      if (!node) return [`${el.type}: missing node`];
      const dom = { x: node.offsetLeft, y: node.offsetTop, width: node.offsetWidth, height: node.offsetHeight };
      const ok =
        dom.x === el.x && dom.y === el.y && dom.width === el.width &&
        dom.height === Math.max(el.height, 8) && node.style.transform === '';
      return ok ? [] : [`${el.type}: dom=${JSON.stringify(dom)} store=${JSON.stringify(el)} transform=${node.style.transform}`];
    });
  });

async function dropFromPalette(page: Page, label: string, screenX: number, screenY: number) {
  await page.locator(`text="${label}"`).first().hover();
  await page.mouse.down();
  await page.mouse.move(screenX, screenY, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(50);
}

async function clickCenter(page: Page, selector: string) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`no box for ${selector}`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(50);
}

test.describe('Phase 2 regressions', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('token', 'fake-token'));
    await page.goto('http://localhost:5173/editor');
    await expect(page.locator('#canvas')).toBeVisible();
  });

  test('drops land with their top-left at the cursor, at zoom 1 and 2', async ({ page }) => {
    let canvasBox = (await page.locator('#canvas').boundingBox())!;
    await dropFromPalette(page, 'Text', canvasBox.x + 60, canvasBox.y + 80);
    let text = (await storeState(page)).elements.find((e) => e.type === 'text')!;
    expect(Math.abs(text.x - 60)).toBeLessThanOrEqual(GRID);
    expect(Math.abs(text.y - 80)).toBeLessThanOrEqual(GRID);

    await page.evaluate(() => (window as unknown as { __editorStore: StoreShape }).__editorStore.getState().setZoom(2));
    await page.waitForTimeout(100);
    canvasBox = (await page.locator('#canvas').boundingBox())!;
    // 100 screen px at zoom 2 = 50 page px
    await dropFromPalette(page, 'Image', canvasBox.x + 100, canvasBox.y + 100);
    const image = (await storeState(page)).elements.find((e) => e.type === 'image')!;
    expect(Math.abs(image.x - 50)).toBeLessThanOrEqual(GRID);
    expect(Math.abs(image.y - 50)).toBeLessThanOrEqual(GRID);
    text = (await storeState(page)).elements.find((e) => e.type === 'text')!;
    expect(text.x).toBeGreaterThan(0); // first drop untouched
  });

  test('drops near the page edge are clamped inside the page', async ({ page }) => {
    const canvasBox = (await page.locator('#canvas').boundingBox())!;
    await dropFromPalette(page, 'Text', canvasBox.x + canvasBox.width - 5, canvasBox.y + canvasBox.height - 5);
    const { elements, page: pageCfg } = await storeState(page);
    const text = elements.find((e) => e.type === 'text')!;
    expect(text.x + text.width).toBeLessThanOrEqual(pageCfg.width);
    expect(text.y + text.height).toBeLessThanOrEqual(pageCfg.height);
    expect(text.x % GRID).toBe(0);
    expect(text.y % GRID).toBe(0);
  });

  test('plain clicks keep every element attached to the store and add no undo steps', async ({ page }) => {
    const canvasBox = (await page.locator('#canvas').boundingBox())!;
    await dropFromPalette(page, 'Text', canvasBox.x + 20, canvasBox.y + 20);
    await dropFromPalette(page, 'QR Code', canvasBox.x + 20, canvasBox.y + 172);
    await dropFromPalette(page, 'Totals', canvasBox.x + 120, canvasBox.y + 172);
    const pastAfterDrops = (await storeState(page)).pastLength;

    // click each element, including re-clicking the already-selected one
    for (const type of ['text', 'qr', 'qr', 'totals', 'text']) {
      await clickCenter(page, `[data-type="${type}"]`);
      const { elements, selectedId } = await storeState(page);
      expect(elements.find((e) => e.id === selectedId)?.type).toBe(type);
      await expect(page.locator('.moveable-control-box')).toHaveCount(1);
      expect(await domStoreMismatches(page)).toEqual([]);
    }

    // press-and-release on a resize handle without moving
    await clickCenter(page, '.moveable-control.moveable-se');
    expect(await domStoreMismatches(page)).toEqual([]);

    expect((await storeState(page)).pastLength).toBe(pastAfterDrops);
  });

  test('divider is selectable by click and draggable by its middle; empty space deselects', async ({ page }) => {
    const canvasBox = (await page.locator('#canvas').boundingBox())!;
    await dropFromPalette(page, 'Text', canvasBox.x + 20, canvasBox.y + 20);
    await dropFromPalette(page, 'Divider', canvasBox.x + 8, canvasBox.y + 80);

    // pressing the gray workspace (outside the page) deselects
    await page.mouse.click(canvasBox.x - 40, canvasBox.y + 40);
    expect((await storeState(page)).selectedId).toBeNull();
    await expect(page.locator('.moveable-control-box')).toHaveCount(0);

    await clickCenter(page, '[data-type="divider"]');
    let state = await storeState(page);
    const divider = state.elements.find((e) => e.type === 'divider')!;
    expect(state.selectedId).toBe(divider.id);
    await expect(page.locator('.moveable-control-box')).toHaveCount(1);

    const box = (await page.locator('[data-type="divider"]').boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy + 40, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(50);

    state = await storeState(page);
    const moved = state.elements.find((e) => e.id === divider.id)!;
    expect(moved.y).toBeGreaterThanOrEqual(divider.y + 36);
    expect(moved.width).toBe(divider.width); // a drag, not a resize
    expect(await domStoreMismatches(page)).toEqual([]);

    // pressing the bare page also deselects
    await page.mouse.click(canvasBox.x + canvasBox.width - 10, canvasBox.y + canvasBox.height - 40);
    expect((await storeState(page)).selectedId).toBeNull();
  });
});
