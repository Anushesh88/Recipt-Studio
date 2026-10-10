import { describe, it, expect } from "vitest";
import { STARTER_TEMPLATES } from "./starterTemplates";
import { canvasSchema } from "../schema/templateSchema";
import { missingParticulars } from "./gst";
import { SAMPLE_GST_TAX_ROWS } from "./gstTemplate";
import { totalsRows } from "./elementLayout";
import { applyLayout, tableHeight } from "./layout";
import { findVariables } from "./variables";
import { starterPreview, starterValues } from "../components/templates/starterPreview";
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

describe("starter template gallery", () => {
  it("has ten receipts and ten GST invoices, each for a different business", () => {
    const of = (type: string) => STARTER_TEMPLATES.filter((t) => t.canvas.documentType === type);
    expect([of("receipt").length, of("gst_invoice").length]).toEqual([10, 10]);
    expect(new Set(STARTER_TEMPLATES.map((t) => t.id)).size).toBe(20);
    for (const kind of ["receipt", "gst_invoice"]) expect(new Set(of(kind).map((t) => t.business)).size).toBe(10);
    // Every page size is represented
    expect(new Set(STARTER_TEMPLATES.map((t) => t.canvas.page.preset))).toEqual(new Set(["thermal80", "a5", "a4"]));
  });

  it.each(STARTER_TEMPLATES)("$name: its sample fills the form without errors", (starter) => {
    const { model, values } = starterValues(starter);
    const result = model.schema.safeParse(values);
    expect(result.success, JSON.stringify(!result.success && result.error.issues)).toBe(true);
    const preview = starterPreview(starter);
    expect(preview.totals.total).toMatch(/^\d+\.\d{2}$/);
    // Every variable the template prints has a value (a walk-in GST buyer may be blank)
    const optional = new Set(["receipt.notes", ...(model.gst ? ["customer.name", "customer.address"] : [])]);
    for (const [key, value] of Object.entries(preview.values)) {
      if (findVariables(JSON.stringify(starter.canvas)).includes(key) && !optional.has(key)) expect(value, key).not.toBe("");
    }
  });

  // Room for a realistic number of line items before the page is full
  const MIN_ITEMS = { a5: 10, a4: 15 } as const;
  it.each(STARTER_TEMPLATES.filter((t) => t.canvas.page.heightMode === "fixed"))("$name: fits its page with plenty of line items", ({ canvas }) => {
    const rows = MIN_ITEMS[canvas.page.preset as keyof typeof MIN_ITEMS];
    expect(applyLayout(canvas.page, canvas.elements, rows).error).toBeNull();
  });
});
