import { describe, it, expect, beforeEach } from "vitest";
import { completeForGst } from "./gstTemplate";
import { missingParticulars, particularsLostWithout } from "./gst";
import { canvasSchema, type Canvas } from "../schema/templateSchema";
import { STARTER_TEMPLATES } from "./starterTemplates";
import { useEditorStore } from "../store/editorStore";
import { PAGE_PRESETS } from "./units";

const shop = STARTER_TEMPLATES.find((t) => t.id === "shop-receipt")!.canvas;
const gstA4 = STARTER_TEMPLATES.find((t) => t.id === "gst-a4")!.canvas;

describe("completeForGst", () => {
  it.each([
    ["an empty thermal page", { ...shop, elements: [] }],
    ["a shop receipt", shop],
    ["an empty A4 page", { ...shop, page: PAGE_PRESETS.a4, elements: [] }],
  ])("turns %s into a compliant GST invoice", (_name, canvas: Canvas) => {
    const elements = completeForGst(canvas);
    expect(missingParticulars(elements)).toEqual([]);
    // A valid template too, once the page fits (the store grows thermal pages)
    const page = { ...canvas.page, height: Math.max(canvas.page.height, ...elements.map((e) => e.y + e.height)) };
    const result = canvasSchema.safeParse({ ...canvas, documentType: "gst_invoice", page, elements });
    expect(result.success, JSON.stringify(!result.success && result.error.issues)).toBe(true);
  });

  it("only adds: existing elements keep their place, the table gains the GST columns", () => {
    const elements = completeForGst(shop);
    for (const before of shop.elements) {
      const after = elements.find((e) => e.id === before.id)!;
      expect({ x: after.x, y: after.y, width: after.width }).toEqual({ x: before.x, y: before.y, width: before.width });
    }
    const table = elements.find((e) => e.type === "items_table")!;
    expect(table.type === "items_table" && table.props.columns.map((c) => c.key)).toEqual(
      ["description", "qty", "unit_price", "line_total", "hsn", "gst_rate", "taxable_value"],
    );
    const widths = table.type === "items_table" ? table.props.columns.reduce((sum, c) => sum + c.width, 0) : 0;
    expect(widths).toBeCloseTo(1, 3);
  });

  it("leaves a compliant template alone", () => {
    expect(completeForGst(gstA4)).toBe(gstA4.elements);
  });
});

describe("required GST fields in the editor", () => {
  beforeEach(() => {
    useEditorStore.getState().loadTemplate(gstA4);
  });

  it("knows what deleting an element would lose", () => {
    expect(particularsLostWithout(gstA4.elements, "sign")).toEqual(["Signature"]);
    expect(particularsLostWithout(gstA4.elements, "invoice")).toEqual([
      "Invoice number", "Invoice date", "Place of supply (state)", "Reverse charge (Yes / No)",
    ]);
    expect(particularsLostWithout(gstA4.elements, "footer")).toEqual([]);
  });

  it("refuses to delete a required element, with the reason", () => {
    useEditorStore.getState().deleteElement("sign");
    expect(useEditorStore.getState().elements.some((e) => e.id === "sign")).toBe(true);
    expect(useEditorStore.getState().notice).toMatch(/A GST invoice must show: Signature/);
    expect(useEditorStore.getState().past).toHaveLength(0); // a refusal isn't an undo step

    useEditorStore.getState().deleteElement("footer");
    expect(useEditorStore.getState().elements.some((e) => e.id === "footer")).toBe(false);
  });

  it("a plain receipt deletes anything; the document type is one undo step", () => {
    useEditorStore.getState().setDocumentType("receipt");
    useEditorStore.getState().deleteElement("sign");
    expect(useEditorStore.getState().elements.some((e) => e.id === "sign")).toBe(false);
    useEditorStore.getState().undo();
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().documentType).toBe("gst_invoice");
  });

  it("Add missing fields is one undo step", () => {
    useEditorStore.getState().loadTemplate({ ...shop, documentType: "gst_invoice" });
    useEditorStore.getState().addGstRequirements();
    expect(missingParticulars(useEditorStore.getState().elements)).toEqual([]);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().elements).toHaveLength(shop.elements.length);
  });
});
