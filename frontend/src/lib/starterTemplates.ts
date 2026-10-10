// Ready-made templates offered on the Templates page, so a first receipt or
// GST invoice takes a minute instead of a design session. Each is a normal
// template once created (tests/starterTemplates.test.ts checks they're valid
// and that the GST ones show every rule 46 particular).
import type { Canvas, CanvasElement } from "../schema/templateSchema";
import { PAGE_PRESETS } from "./units";
import { GST_TABLE_COLUMNS } from "./gstTemplate";

export interface StarterTemplate {
  id: string;
  name: string;
  description: string;
  canvas: Canvas;
}

type Text = Extract<CanvasElement, { type: "text" }>;

const text = (
  id: string, content: string, box: { x: number; y: number; width: number; height: number },
  style: Partial<Text["props"]> = {},
): Text => ({
  id, type: "text", ...box, zIndex: 1, locked: false,
  props: { content, fontFamily: "Inter", fontSize: 12, fontWeight: 400, color: "#111111", align: "left", lineHeight: 1.3, ...style },
});

const withZ = (elements: CanvasElement[]) => elements.map((e, i) => ({ ...e, zIndex: i + 1 }));

const GST_A4: Canvas = {
  schemaVersion: 1,
  documentType: "gst_invoice",
  page: PAGE_PRESETS.a4,
  elements: withZ([
    text("title", "TAX INVOICE", { x: 32, y: 32, width: 730, height: 32 }, { fontSize: 20, fontWeight: 700, align: "center" }),
    text("supplier", "{{business.name}}\n{{business.address}}\nGSTIN: {{business.gstin}}", { x: 32, y: 76, width: 380, height: 84 }, { lineHeight: 1.4 }),
    text(
      "invoice",
      "Invoice no: {{receipt.number}}\nDate: {{receipt.date}}\nPlace of supply: {{receipt.place_of_supply}}\nReverse charge: {{receipt.reverse_charge}}",
      { x: 432, y: 76, width: 330, height: 84 },
      { align: "right", lineHeight: 1.4 },
    ),
    { id: "rule", type: "divider", x: 32, y: 168, width: 730, height: 8, zIndex: 1, locked: false, props: { style: "solid", thickness: 1, color: "#999999" } },
    text("buyer", "Bill to:\n{{customer.name}}\n{{customer.address}}\nGSTIN: {{customer.gstin}}", { x: 32, y: 184, width: 730, height: 84 }, { lineHeight: 1.4 }),
    {
      id: "items", type: "items_table", x: 32, y: 280, width: 730, height: 96, zIndex: 1, locked: false,
      props: {
        binding: "receipt.items",
        columns: [
          { key: "description", label: "Item", width: 0.32, align: "left" },
          { key: "hsn", label: "HSN/SAC", width: 0.12, align: "left" },
          { key: "qty", label: "Qty", width: 0.12, align: "right" },
          { key: "unit_price", label: "Rate", width: 0.12, align: "right" },
          { key: "gst_rate", label: "GST", width: 0.1, align: "right" },
          { key: "taxable_value", label: "Taxable value", width: 0.22, align: "right" },
        ],
        fontFamily: "Inter", fontSize: 12, lineHeight: 1.3, rowPadding: 4, headerBold: true, rowDivider: true, color: "#111111",
      },
    },
    {
      id: "totals", type: "totals", x: 512, y: 392, width: 250, height: 96, zIndex: 1, locked: false,
      props: { binding: "receipt.totals", show: ["taxable", "tax", "total"], fontFamily: "Inter", fontSize: 13, emphasizeTotal: true, currencySymbol: "₹" },
    },
    { id: "sign", type: "signature", x: 562, y: 512, width: 200, height: 60, zIndex: 1, locked: false, props: { label: "Authorised signatory", assetId: null, lineColor: "#111111" } },
    text("footer", "This is a computer-generated invoice.", { x: 32, y: 548, width: 480, height: 24 }, { fontSize: 10, color: "#666666" }),
  ]),
};

const GST_THERMAL: Canvas = {
  schemaVersion: 1,
  documentType: "gst_invoice",
  page: { ...PAGE_PRESETS.thermal80, height: 488 },
  elements: withZ([
    text("name", "{{business.name}}", { x: 12, y: 12, width: 278, height: 20 }, { fontSize: 14, fontWeight: 700, align: "center" }),
    text("supplier", "{{business.address}}\nGSTIN: {{business.gstin}}", { x: 12, y: 36, width: 278, height: 40 }, { fontSize: 10, align: "center" }),
    text("title", "TAX INVOICE", { x: 12, y: 80, width: 278, height: 16 }, { fontSize: 11, fontWeight: 700, align: "center" }),
    text(
      "invoice",
      "Invoice: {{receipt.number}}\nDate: {{receipt.date}}\nPlace of supply: {{receipt.place_of_supply}}\nReverse charge: {{receipt.reverse_charge}}",
      { x: 12, y: 100, width: 278, height: 56 },
      { fontSize: 10 },
    ),
    text("buyer", "Bill to: {{customer.name}}\n{{customer.address}}\nGSTIN: {{customer.gstin}}", { x: 12, y: 160, width: 278, height: 44 }, { fontSize: 10 }),
    { id: "rule", type: "divider", x: 12, y: 208, width: 278, height: 8, zIndex: 1, locked: false, props: { style: "dashed", thickness: 1, color: "#999999" } },
    {
      id: "items", type: "items_table", x: 12, y: 220, width: 278, height: 76, zIndex: 1, locked: false,
      props: {
        binding: "receipt.items", columns: GST_TABLE_COLUMNS,
        fontFamily: "Inter", fontSize: 10, lineHeight: 1.3, rowPadding: 3, headerBold: true, rowDivider: true, color: "#111111",
      },
    },
    {
      id: "totals", type: "totals", x: 102, y: 304, width: 188, height: 80, zIndex: 1, locked: false,
      props: { binding: "receipt.totals", show: ["taxable", "tax", "total"], fontFamily: "Inter", fontSize: 11, emphasizeTotal: true, currencySymbol: "₹" },
    },
    { id: "sign", type: "signature", x: 142, y: 392, width: 148, height: 52, zIndex: 1, locked: false, props: { label: "Authorised signatory", assetId: null, lineColor: "#111111" } },
    text("thanks", "Thank you!", { x: 12, y: 456, width: 278, height: 20 }, { fontSize: 11, align: "center" }),
  ]),
};

const SHOP_RECEIPT: Canvas = {
  schemaVersion: 1,
  documentType: "receipt",
  page: PAGE_PRESETS.thermal80,
  elements: withZ([
    text("name", "{{business.name}}", { x: 12, y: 12, width: 278, height: 24 }, { fontSize: 16, fontWeight: 700, align: "center" }),
    text("meta", "Receipt {{receipt.number}}\n{{receipt.date}}", { x: 12, y: 40, width: 278, height: 32 }, { fontSize: 11, align: "center" }),
    { id: "rule", type: "divider", x: 12, y: 76, width: 278, height: 8, zIndex: 1, locked: false, props: { style: "dashed", thickness: 1, color: "#999999" } },
    {
      id: "items", type: "items_table", x: 12, y: 88, width: 278, height: 96, zIndex: 1, locked: false,
      props: {
        binding: "receipt.items",
        columns: [
          { key: "description", label: "Item", width: 0.45, align: "left" },
          { key: "qty", label: "Qty", width: 0.15, align: "right" },
          { key: "unit_price", label: "Price", width: 0.2, align: "right" },
          { key: "line_total", label: "Total", width: 0.2, align: "right" },
        ],
        fontFamily: "Inter", fontSize: 12, lineHeight: 1.3, rowPadding: 4, headerBold: true, rowDivider: true, color: "#111111",
      },
    },
    {
      id: "totals", type: "totals", x: 110, y: 192, width: 180, height: 96, zIndex: 1, locked: false,
      props: { binding: "receipt.totals", show: ["subtotal", "discount", "tax", "total"], fontFamily: "Inter", fontSize: 13, emphasizeTotal: true, currencySymbol: "₹" },
    },
    text("thanks", "Thank you! Visit again.", { x: 12, y: 300, width: 278, height: 20 }, { fontSize: 11, align: "center" }),
  ]),
};

export const STARTER_TEMPLATES: StarterTemplate[] = [
  { id: "gst-a4", name: "GST tax invoice (A4)", description: "Every rule 46 detail, for B2B and B2C sales.", canvas: GST_A4 },
  { id: "gst-thermal", name: "GST invoice (thermal 80 mm)", description: "A compliant tax invoice for receipt printers.", canvas: GST_THERMAL },
  { id: "shop-receipt", name: "Shop receipt (thermal 80 mm)", description: "A simple receipt, no GST details.", canvas: SHOP_RECEIPT },
];
