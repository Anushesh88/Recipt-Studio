import { describe, it, expect } from "vitest";
import { computeDropCoords } from "./canvasUtils";

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
