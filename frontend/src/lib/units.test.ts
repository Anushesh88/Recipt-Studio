import { describe, it, expect } from "vitest";
import { DEFAULT_ELEMENTS, PAGE_PRESETS } from "./units";
import { canvasElementSchema, canvasSchema } from "../schema/templateSchema";
import type { CanvasElement } from "../schema/templateSchema";

describe("DEFAULT_ELEMENTS", () => {
  const types = Object.keys(DEFAULT_ELEMENTS) as CanvasElement["type"][];

  it.each(types)("default %s element passes the template schema", (type) => {
    const result = canvasElementSchema.safeParse({
      id: `el_${type}`,
      type,
      x: 0,
      y: 0,
      zIndex: 1,
      ...DEFAULT_ELEMENTS[type],
    });
    expect(result.success, JSON.stringify(!result.success && result.error.issues)).toBe(true);
  });

  it("a canvas with one of every default element is saveable", () => {
    const elements = types.map((type, i) => ({
      id: `el_${type}`,
      type,
      x: 0,
      y: 0,
      zIndex: i + 1,
      ...DEFAULT_ELEMENTS[type],
    }));
    const result = canvasSchema.safeParse({ schemaVersion: 1, page: PAGE_PRESETS.thermal80, elements });
    expect(result.success).toBe(true);
  });
});
