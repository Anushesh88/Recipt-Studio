import { describe, it, expect } from "vitest";
import { STARTER_TEMPLATES } from "./starterTemplates";
import { canvasSchema } from "../schema/templateSchema";
import { missingParticulars } from "./gst";
import { SAMPLE_GST_TAX_ROWS } from "./gstTemplate";
import { totalsRows } from "./elementLayout";
import { tableHeight } from "./layout";
import { ITEMS_TABLE_SAMPLE_ROWS } from "./units";

describe("starter templates", () => {
  it.each(STARTER_TEMPLATES)("$name is a valid template", ({ canvas }) => {
    const result = canvasSchema.safeParse(canvas);
    expect(result.success, JSON.stringify(!result.success && result.error.issues)).toBe(true);
  });

  it.each(STARTER_TEMPLATES.filter((t) => t.canvas.documentType === "gst_invoice"))("$name shows every GST particular", ({ canvas }) => {
    expect(missingParticulars(canvas.elements)).toEqual([]);
  });

  it.each(STARTER_TEMPLATES)("$name: tables are header + sample rows tall and totals fit their rows", ({ canvas }) => {
    for (const element of canvas.elements) {
      if (element.type === "items_table") expect(element.height).toBe(tableHeight(element.props, ITEMS_TABLE_SAMPLE_ROWS));
      if (element.type === "totals") {
        const rows = totalsRows(element.props, canvas.documentType === "gst_invoice" ? SAMPLE_GST_TAX_ROWS : undefined);
        const last = rows[rows.length - 1];
        expect(element.height).toBeGreaterThanOrEqual(last.top + last.height);
      }
    }
  });

  it.each(STARTER_TEMPLATES)("$name: nothing overlaps the next element down", ({ canvas }) => {
    const sorted = [...canvas.elements].sort((a, b) => a.y - b.y);
    for (const [i, a] of sorted.entries()) {
      for (const b of sorted.slice(i + 1)) {
        const sideBySide = a.x + a.width <= b.x || b.x + b.width <= a.x;
        if (!sideBySide) expect(a.y + a.height, `${a.id} runs into ${b.id}`).toBeLessThanOrEqual(b.y);
      }
    }
  });
});
