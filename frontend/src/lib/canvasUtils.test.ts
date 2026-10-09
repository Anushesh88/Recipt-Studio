import { describe, it, expect } from "vitest";
import { clampToPage, computeDropCoords, getEventClientCoords } from "./canvasUtils";

describe("computeDropCoords", () => {
  it("computes correctly at zoom 1.0", () => {
    // overRect is at 100, 100
    // activeRect drops at 200, 150
    // unscaled should be 100, 50. snapped to 4
    const coords = computeDropCoords(200, 150, 100, 100, 1.0, 4);
    expect(coords).toEqual({ x: 100, y: 52 });
  });

  it("computes correctly at zoom 2.0", () => {
    // zoom 2: 100px screen dist = 50px unscaled dist
    const coords = computeDropCoords(200, 150, 100, 100, 2.0, 4);
    expect(coords).toEqual({ x: 52, y: 24 }); // 100/2=50 -> 52; 50/2=25 -> 24
  });

  it("computes correctly at zoom 0.5", () => {
    // zoom 0.5: 100px screen dist = 200px unscaled dist
    const coords = computeDropCoords(200, 150, 100, 100, 0.5, 4);
    expect(coords).toEqual({ x: 200, y: 100 });
  });

  it("clamps to positive coordinates", () => {
    const coords = computeDropCoords(50, 50, 100, 100, 1.0, 4);
    // would be -50, -50 => snapped to 0, 0
    expect(coords).toEqual({ x: 0, y: 0 });
  });
});

describe("clampToPage", () => {
  const page = { width: 302, height: 400 };

  it("leaves an in-bounds box untouched", () => {
    expect(clampToPage(40, 40, 100, 30, page, 4)).toEqual({ x: 40, y: 40 });
  });

  it("pulls a box back inside the right and bottom edges, on grid", () => {
    // 302 - 200 = 102 -> floored to grid = 100 (snapping up to 104 would overshoot)
    // 400 - 30 = 370 -> floored to grid = 368
    const { x, y } = clampToPage(244, 396, 200, 30, page, 4);
    expect({ x, y }).toEqual({ x: 100, y: 368 });
    expect(x + 200).toBeLessThanOrEqual(page.width);
    expect(y + 30).toBeLessThanOrEqual(page.height);
  });

  it("pins a box larger than the page to the origin", () => {
    expect(clampToPage(50, 50, 400, 500, page, 4)).toEqual({ x: 0, y: 0 });
  });
});

describe("getEventClientCoords", () => {
  it("reads mouse/pointer events", () => {
    const event = { clientX: 12, clientY: 34 } as unknown as Event;
    expect(getEventClientCoords(event)).toEqual({ x: 12, y: 34 });
  });

  it("reads the first touch of touch events", () => {
    const event = { touches: [{ clientX: 5, clientY: 6 }], changedTouches: [] } as unknown as Event;
    expect(getEventClientCoords(event)).toEqual({ x: 5, y: 6 });
  });

  it("falls back to changedTouches on touchend", () => {
    const event = { touches: [], changedTouches: [{ clientX: 7, clientY: 8 }] } as unknown as Event;
    expect(getEventClientCoords(event)).toEqual({ x: 7, y: 8 });
  });

  it("returns null for events without coordinates", () => {
    expect(getEventClientCoords({} as Event)).toBeNull();
  });
});
