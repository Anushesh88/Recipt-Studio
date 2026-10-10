// Ready-made templates offered on the Templates page, so a first receipt or
// GST invoice takes a minute instead of a design session: ten receipts and ten
// GST tax invoices for different kinds of business. Each is a normal template
// once created (starterTemplates.test.ts checks they're valid, don't overlap,
// and that the GST ones show every rule 46 particular; the browser tests check
// the server accepts and renders them all).
import type { Canvas, CanvasElement } from "../schema/templateSchema";
import { PAGE_PRESETS } from "./units";
import { GST_TABLE_COLUMNS } from "./gstTemplate";
import { col, design } from "./templateBuilder";

// Made-up details the gallery fills the template with, so each one shows the
// business it's for
export interface StarterSample {
  business: { name: string; address: string; gstin?: string };
  customer?: { name?: string; address?: string; gstin?: string };
  receipt?: { payment_method?: string; notes?: string; place_of_supply?: string };
  custom?: Record<string, string>;
  items: { description: string; qty: string; unit_price: string; hsn?: string; unit?: string; gst_rate?: string; discount?: string }[];
  tax_percent?: string;
  discount?: string;
}

export interface StarterTemplate {
  id: string;
  name: string;
  // The kind of business it's made for, shown as a tag
  business: string;
  description: string;
  canvas: Canvas;
  sample: StarterSample;
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

// --- Receipts ---------------------------------------------------------------------

const GREY = "#6B7280";

const CAFE = design({ preset: "thermal80", font: "Poppins", color: "#1F2937" }, (s) => {
  s.text("name", "{{business.name}}", { fontSize: 18, fontWeight: 700, align: "center" })
    .text("tagline", "Freshly brewed, every day", { fontSize: 10, align: "center", color: GREY })
    .gap(4)
    .text("meta", "Bill {{receipt.number}}\nTable {{custom.table_no}}\n{{receipt.date}}", { fontSize: 10, align: "center" })
    .gap(4)
    .divider("rule-top", "dotted", GREY)
    .table("items", [col("description", "Item", 0.5), col("qty", "Qty", 0.15), col("line_total", "Amount", 0.35)], { fontSize: 11, rowDivider: false })
    .divider("rule-bottom", "dotted", GREY)
    .totals("totals", ["subtotal", "tax", "total"], { width: 180, fontSize: 12 })
    .gap(8)
    .text("paid", "Paid by {{receipt.payment_method}}", { fontSize: 10, align: "center", color: GREY })
    .gap(4)
    .text("thanks", "Thank you! See you again soon.", { fontSize: 11, fontWeight: 600, align: "center" });
});

const RESTAURANT = design({ preset: "thermal80", font: "Roboto Mono" }, (s) => {
  s.text("name", "{{business.name}}", { fontSize: 15, fontWeight: 700, align: "center" })
    .text("address", "{{business.address}}", { fontSize: 10, align: "center" }, 2)
    .divider("rule-1")
    .text("meta", "Bill: {{receipt.number}}\nDate: {{receipt.date}}\nTable: {{custom.table_no}}\nCovers: {{custom.covers}}\nServer: {{custom.server_name}}", { fontSize: 10 })
    .divider("rule-2")
    .table("items", [col("description", "Item", 0.46), col("qty", "Qty", 0.14), col("unit_price", "Rate", 0.2), col("line_total", "Amt", 0.2)], { fontSize: 10, rowPadding: 3, rowDivider: false })
    .divider("rule-3")
    .totals("totals", ["subtotal", "discount", "tax", "total"], { width: 200, fontSize: 11 })
    .divider("rule-4")
    .text("thanks", "Thank you. Please visit again!", { fontSize: 10, align: "center" });
});

const BAKERY_BROWN = "#5B3A29";
const BAKERY = design({ preset: "a5", font: "Merriweather", color: BAKERY_BROWN, background: "#FFF9F2" }, (s) => {
  s.logo("logo", 120, 56)
    .gap(8)
    .text("name", "{{business.name}}", { fontSize: 22, fontWeight: 700, align: "center" })
    .text("address", "{{business.address}}", { fontSize: 11, align: "center", color: "#8A6A55" })
    .gap(8)
    .divider("rule", "solid", "#D6B89C")
    .gap(4)
    .columns([
      [0.5, (c) => c.text("customer", "Order for\n{{customer.name}}", { fontSize: 11 })],
      [0.5, (c) => c.text("meta", "Receipt {{receipt.number}}\n{{receipt.date}}\nPickup: {{custom.pickup_date}}", { fontSize: 11, align: "right" })],
    ])
    .gap(8)
    .table("items", [col("description", "Item", 0.5), col("qty", "Qty", 0.14), col("unit_price", "Price", 0.16), col("line_total", "Amount", 0.2)], { rowPadding: 6, color: BAKERY_BROWN })
    .gap(8)
    .columns([
      [0.55, (c) => c.text("notes", "Message on the cake:\n{{receipt.notes}}", { fontSize: 11 }, 3)],
      [0.45, (c) => c.totals("totals", ["subtotal", "discount", "total"], { width: 220, fontSize: 12 })],
    ])
    .gap(16)
    .text("thanks", "Baked with love. Thank you!", { fontSize: 13, fontWeight: 700, align: "center" });
});

const SALON_ROSE = "#9D174D";
const SALON = design({ preset: "a5", font: "Montserrat", color: "#1F1F1F" }, (s) => {
  s.text("name", "{{business.name}}", { fontSize: 22, fontWeight: 700, color: SALON_ROSE })
    .text("address", "{{business.address}}", { fontSize: 11, color: GREY })
    .gap(4)
    .divider("rule", "solid", SALON_ROSE, 2)
    .gap(8)
    .columns([
      [0.5, (c) => c.text("client-label", "CLIENT", { fontSize: 10, fontWeight: 700, color: SALON_ROSE }).text("client", "{{customer.name}}", { fontSize: 12 })],
      [0.5, (c) => c.text("meta", "Receipt {{receipt.number}}\n{{receipt.date}}\nStylist: {{custom.stylist}}", { fontSize: 11, align: "right" })],
    ])
    .gap(12)
    .table("items", [col("description", "Service", 0.55), col("qty", "Qty", 0.15), col("line_total", "Amount", 0.3)], { rowPadding: 6 })
    .gap(8)
    .totals("totals", ["subtotal", "discount", "tax", "total"], { width: 220 })
    .gap(12)
    .text("paid", "Paid by {{receipt.payment_method}}", { fontSize: 11, color: GREY })
    .gap(16)
    .text("rebook", "Book your next visit: call us or message us on WhatsApp.", { fontSize: 11, align: "center", color: SALON_ROSE });
});

const CLINIC_TEAL = "#0F766E";
const CLINIC = design({ preset: "a5", font: "Lato", color: "#1F2937" }, (s) => {
  s.columns([
    [0.6, (c) => c.text("name", "{{business.name}}", { fontSize: 20, fontWeight: 700, color: CLINIC_TEAL }).text("address", "{{business.address}}", { fontSize: 11, color: GREY }, 2)],
    [0.4, (c) => c.text("meta", "Receipt {{receipt.number}}\nDate: {{receipt.date}}", { fontSize: 11, align: "right" })],
  ])
    .gap(4)
    .divider("rule", "solid", CLINIC_TEAL, 2)
    .gap(8)
    .text("patient", "Patient: {{customer.name}}\nAge / sex: {{custom.age_sex}}\nConsulting doctor: {{custom.doctor}}", { lineHeight: 1.5 })
    .gap(8)
    .table("items", [col("description", "Particulars", 0.7), col("line_total", "Amount", 0.3)], { rowPadding: 6 })
    .gap(8)
    .totals("totals", ["subtotal", "discount", "total"], { width: 220 })
    .gap(8)
    .text("paid", "Payment: {{receipt.payment_method}}", { fontSize: 11 })
    .gap(24)
    .signature("sign", "Doctor's signature / clinic stamp", { width: 220 })
    .gap(8)
    .text("footer", "Wishing you a speedy recovery.", { fontSize: 10, align: "center", color: GREY });
});

const TUITION_NAVY = "#1E3A8A";
const TUITION = design({ preset: "a5", font: "Merriweather", color: "#1F2937" }, (s) => {
  s.text("name", "{{business.name}}", { fontSize: 20, fontWeight: 700, align: "center", color: TUITION_NAVY })
    .text("address", "{{business.address}}", { fontSize: 11, align: "center", color: GREY })
    .gap(8)
    .text("title", "FEE RECEIPT", { fontSize: 13, fontWeight: 700, align: "center", color: TUITION_NAVY })
    .divider("rule", "solid", TUITION_NAVY)
    .gap(8)
    .columns([
      [0.55, (c) => c.text("student", "Student: {{customer.name}}\nClass / batch: {{custom.batch}}\nFor: {{custom.fee_period}}", { fontSize: 11, lineHeight: 1.5 })],
      [0.45, (c) => c.text("meta", "Receipt no: {{receipt.number}}\nDate: {{receipt.date}}\nPaid by: {{receipt.payment_method}}", { fontSize: 11, lineHeight: 1.5, align: "right" })],
    ])
    .gap(8)
    .table("items", [col("description", "Particulars", 0.7), col("line_total", "Amount", 0.3)], { rowPadding: 6 })
    .gap(8)
    .totals("totals", ["subtotal", "discount", "total"], { width: 220 })
    .gap(24)
    .columns([
      [0.5, (c) => c.gap(28).text("terms", "Fees once paid are not refundable.", { fontSize: 10, color: GREY }, 2)],
      [0.5, (c) => c.signature("sign", "Received by", { color: TUITION_NAVY })],
    ]);
});

const RENT = design({ preset: "a5", font: "Open Sans" }, (s) => {
  s.text("title", "RENT RECEIPT", { fontSize: 18, fontWeight: 700, align: "center" })
    .text("meta", "Receipt no: {{receipt.number}}    Date: {{receipt.date}}", { fontSize: 11, align: "center", color: GREY })
    .gap(8)
    .divider("rule", "solid", "#111111")
    .gap(8)
    .text(
      "body",
      "Received from {{customer.name}} the rent for {{custom.rent_period}} for the property at {{custom.property_address}}, paid by {{receipt.payment_method}}.",
      { lineHeight: 1.6 },
      5,
    )
    .gap(8)
    .table("items", [col("description", "Description", 0.7), col("line_total", "Amount", 0.3)], { rowPadding: 6 })
    .gap(8)
    .totals("totals", ["total"], { width: 220 })
    .gap(16)
    .columns([
      [0.55, (c) => c.text("landlord", "Landlord: {{business.name}}\nPAN: {{custom.landlord_pan}}\n{{business.address}}", { fontSize: 11 }, 4)],
      [0.45, (c) => c.signature("sign", "Landlord's signature", { height: 72 })],
    ])
    .gap(8)
    .text("stamp", "Affix a revenue stamp on cash payments above ₹5,000.", { fontSize: 9, color: GREY });
});

const GYM = design({ preset: "thermal80", font: "Montserrat" }, (s) => {
  s.text("name", "{{business.name}}", { fontSize: 18, fontWeight: 700, align: "center" })
    .text("title", "MEMBERSHIP RECEIPT", { fontSize: 11, fontWeight: 700, align: "center" })
    .divider("rule-1", "solid", "#111111", 2)
    .text("meta", "Receipt: {{receipt.number}}\nDate: {{receipt.date}}\nMember: {{customer.name}}\nMember ID: {{custom.member_id}}\nValid till: {{custom.valid_till}}", { fontSize: 10, lineHeight: 1.4 })
    .divider("rule-2")
    .table("items", [col("description", "Plan", 0.6), col("line_total", "Amount", 0.4)], { fontSize: 11 })
    .divider("rule-3")
    .totals("totals", ["subtotal", "discount", "tax", "total"], { width: 200, fontSize: 12 })
    .gap(8)
    .text("paid", "Paid by {{receipt.payment_method}}", { fontSize: 10, align: "center" })
    .gap(4)
    .text("motto", "Train hard. Stay consistent.", { fontSize: 11, fontWeight: 700, align: "center" });
});

const FREELANCE_PURPLE = "#6D28D9";
const FREELANCE = design({ preset: "a4", font: "Poppins", color: "#1F2937" }, (s) => {
  s.columns([
    [0.6, (c) => c.logo("logo", 120, 48, "left").gap(8).text("name", "{{business.name}}", { fontSize: 22, fontWeight: 700, color: FREELANCE_PURPLE }).text("address", "{{business.address}}", { fontSize: 11, color: GREY }, 2)],
    [0.4, (c) => c.text("title", "PAYMENT RECEIPT", { fontSize: 16, fontWeight: 700, align: "right", color: FREELANCE_PURPLE }).text("meta", "No. {{receipt.number}}\n{{receipt.date}}", { fontSize: 11, align: "right" })],
  ])
    .gap(12)
    .divider("rule", "solid", "#DDD6FE", 2)
    .gap(12)
    .columns([
      [0.5, (c) => c.text("from-label", "RECEIVED FROM", { fontSize: 10, fontWeight: 700, color: GREY }).text("from", "{{customer.name}}")],
      [0.5, (c) => c.text("project-label", "PROJECT", { fontSize: 10, fontWeight: 700, color: GREY, align: "right" }).text("project", "{{custom.project}}\nPaid by {{receipt.payment_method}}", { align: "right" })],
    ])
    .gap(16)
    .table("items", [col("description", "Description", 0.52), col("qty", "Qty", 0.12), col("unit_price", "Rate", 0.16), col("line_total", "Amount", 0.2)], { rowPadding: 8 })
    .gap(12)
    .columns([
      [0.55, (c) => c.text("notes-label", "Notes", { fontSize: 10, fontWeight: 700 }).text("notes", "{{receipt.notes}}", { fontSize: 11 }, 3)],
      [0.45, (c) => c.totals("totals", ["subtotal", "discount", "tax", "total"], { width: 320 })],
    ])
    .gap(32)
    .signature("sign", "Authorised signature")
    .gap(16)
    .text("thanks", "Thank you for your business!", { fontSize: 13, fontWeight: 700, align: "center", color: FREELANCE_PURPLE });
});

// --- GST tax invoices ----------------------------------------------------------------

const SUPPLIER = "{{business.address}}\nGSTIN: {{business.gstin}}";
const BUYER = "{{customer.name}}\n{{customer.address}}\nGSTIN: {{customer.gstin}}";
const SUPPLY = "Place of supply: {{receipt.place_of_supply}}\nReverse charge: {{receipt.reverse_charge}}";

const RESTAURANT_GST = design({ preset: "thermal80", documentType: "gst_invoice", font: "Roboto Mono" }, (s) => {
  s.text("name", "{{business.name}}", { fontSize: 14, fontWeight: 700, align: "center" })
    .text("supplier", SUPPLIER, { fontSize: 10, align: "center" }, 3)
    .gap(4)
    .text("title", "TAX INVOICE", { fontSize: 11, fontWeight: 700, align: "center" })
    .divider("rule-1")
    .text("invoice", `Bill: {{receipt.number}}\nTable: {{custom.table_no}}\nDate: {{receipt.date}}\n${SUPPLY}`, { fontSize: 10 })
    .text("buyer", `Customer: ${BUYER}`, { fontSize: 10 })
    .divider("rule-2")
    .table("items", GST_TABLE_COLUMNS, { fontSize: 10, rowPadding: 3, rowDivider: false })
    .divider("rule-3")
    .totals("totals", ["taxable", "tax", "total"], { width: 200, fontSize: 11 })
    .gap(8)
    .signature("sign", "Authorised signatory", { width: 150, height: 52 })
    .gap(8)
    .text("thanks", "Thank you! Visit again.", { fontSize: 10, align: "center" });
});

const PHARMACY_GREEN = "#065F46";
const PHARMACY = design({ preset: "a5", documentType: "gst_invoice", font: "Roboto", color: "#1F2937" }, (s) => {
  s.columns([
    [0.6, (c) => c.text("name", "{{business.name}}", { fontSize: 18, fontWeight: 700, color: PHARMACY_GREEN }).text("supplier", `${SUPPLIER}\nD.L. no: 20B-______ / 21B-______`, { fontSize: 10 }, 4)],
    [0.4, (c) => c.text("title", "TAX INVOICE", { fontSize: 13, fontWeight: 700, align: "right", color: PHARMACY_GREEN }).text("invoice", "No. {{receipt.number}}\nDate: {{receipt.date}}", { fontSize: 10, align: "right" })],
  ])
    .gap(4)
    .divider("rule", "solid", PHARMACY_GREEN)
    .gap(4)
    .columns([
      [0.55, (c) => c.text("buyer", `Patient: ${BUYER}`, { fontSize: 10 })],
      [0.45, (c) => c.text("supply", `${SUPPLY}\nPaid by: {{receipt.payment_method}}`, { fontSize: 10, align: "right" })],
    ])
    .gap(8)
    .table(
      "items",
      [col("description", "Medicine", 0.32), col("hsn", "HSN", 0.14), col("qty", "Qty", 0.12), col("unit_price", "Rate", 0.12), col("gst_rate", "GST", 0.1), col("taxable_value", "Taxable", 0.2)],
      { fontSize: 10 },
    )
    .gap(8)
    .columns([
      [0.55, (c) => c.text("terms", "Medicines once sold are not taken back without the bill. Keep all medicines away from children.", { fontSize: 9, color: GREY }, 3)],
      [0.45, (c) => c.totals("totals", ["taxable", "tax", "total"], { width: 220, fontSize: 11 })],
    ])
    .gap(16)
    .signature("sign", "Pharmacist", { width: 160 });
});

const ELECTRONICS_BLUE = "#1D4ED8";
const ELECTRONICS = design({ preset: "a4", documentType: "gst_invoice", font: "Inter", color: "#111827" }, (s) => {
  s.columns([
    [0.55, (c) => c.logo("logo", 140, 56, "left").gap(8).text("name", "{{business.name}}", { fontSize: 20, fontWeight: 700 }).text("supplier", SUPPLIER, { fontSize: 11 }, 3)],
    [0.45, (c) => c.text("title", "TAX INVOICE", { fontSize: 22, fontWeight: 700, align: "right", color: ELECTRONICS_BLUE }).gap(4).text("invoice", `Invoice no: {{receipt.number}}\nDate: {{receipt.date}}\n${SUPPLY}`, { fontSize: 11, align: "right" })],
  ])
    .gap(12)
    .divider("rule", "solid", ELECTRONICS_BLUE, 2)
    .gap(8)
    .columns([
      [0.5, (c) => c.text("buyer-label", "BILL TO", { fontSize: 10, fontWeight: 700, color: ELECTRONICS_BLUE }).text("buyer", BUYER, { fontSize: 11 }, 4)],
      [0.5, (c) => c.text("product-label", "PRODUCT DETAILS", { fontSize: 10, fontWeight: 700, color: ELECTRONICS_BLUE, align: "right" }).text("product", "Serial / IMEI: {{custom.serial_no}}\nWarranty: {{custom.warranty}}", { fontSize: 11, align: "right" })],
    ])
    .gap(12)
    .table(
      "items",
      [col("description", "Product", 0.3), col("hsn", "HSN", 0.11), col("qty", "Qty", 0.09), col("unit_price", "Rate", 0.13), col("discount", "Disc.", 0.1), col("gst_rate", "GST", 0.08), col("taxable_value", "Taxable", 0.19)],
      { fontSize: 11, rowPadding: 6 },
    )
    .gap(8)
    .columns([
      [0.55, (c) => c.text("terms-label", "Terms", { fontSize: 10, fontWeight: 700 }).text("terms", "1. Warranty as per the manufacturer's terms.\n2. Goods once sold will not be taken back.\n3. Subject to local jurisdiction.", { fontSize: 10, color: GREY })],
      [0.45, (c) => c.totals("totals", ["taxable", "tax", "total"], { width: 300 })],
    ])
    .gap(32)
    .signature("sign", "Authorised signatory", { width: 200 });
});

const WHOLESALE_INK = "#0F172A";
const WHOLESALE = design({ preset: "a4", documentType: "gst_invoice", font: "Roboto", color: WHOLESALE_INK }, (s) => {
  s.text("title", "TAX INVOICE", { fontSize: 18, fontWeight: 700, align: "center" })
    .text("copy", "Original for recipient", { fontSize: 9, align: "center", color: GREY })
    .gap(4)
    .divider("rule-1", "solid", WHOLESALE_INK)
    .gap(4)
    .columns([
      [0.5, (c) => c.text("supplier-label", "Supplier", { fontSize: 10, fontWeight: 700 }).text("supplier", `{{business.name}}\n${SUPPLIER}`, { fontSize: 11 }, 4)],
      [0.5, (c) => c.text("invoice", `Invoice no: {{receipt.number}}\nDate: {{receipt.date}}\n${SUPPLY}\nVehicle no: {{custom.vehicle_no}}`, { fontSize: 11, align: "right" })],
    ])
    .divider("rule-2", "solid", "#CBD5E1")
    .text("buyer-label", "Bill to (buyer)", { fontSize: 10, fontWeight: 700 })
    .text("buyer", BUYER, { fontSize: 11 }, 4)
    .gap(8)
    .table(
      "items",
      [
        col("description", "Description of goods", 0.26), col("hsn", "HSN", 0.1), col("qty", "Qty", 0.1), col("unit_price", "Rate", 0.1),
        col("discount", "Disc.", 0.08), col("taxable_value", "Taxable", 0.14), col("gst_rate", "GST", 0.08), col("tax_amount", "Tax", 0.14),
      ],
      { fontSize: 10 },
    )
    .gap(8)
    .columns([
      [0.55, (c) => c.text("bank-label", "Bank details", { fontSize: 10, fontWeight: 700 }).text("bank", "Bank:\nA/c no:\nIFSC:", { fontSize: 10 })],
      [0.45, (c) => c.totals("totals", ["subtotal", "discount", "taxable", "tax", "total"], { width: 300, fontSize: 12 })],
    ])
    .gap(16)
    .columns([
      [0.55, (c) => c.text("declaration", "Declaration: we declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.", { fontSize: 9, color: GREY }, 3)],
      [0.45, (c) => c.signature("sign", "Authorised signatory", { width: 200 })],
    ]);
});

const IT_INDIGO = "#4338CA";
const IT_SERVICES = design({ preset: "a4", documentType: "gst_invoice", font: "Montserrat", color: "#1F2937" }, (s) => {
  s.columns([
    [0.6, (c) => c.text("name", "{{business.name}}", { fontSize: 24, fontWeight: 700, color: IT_INDIGO }).text("supplier", SUPPLIER, { fontSize: 11, color: GREY }, 3)],
    [0.4, (c) => c.text("title", "TAX INVOICE", { fontSize: 14, fontWeight: 700, align: "right" }).text("invoice", "{{receipt.number}}\n{{receipt.date}}", { align: "right" })],
  ])
    .gap(16)
    .columns([
      [0.5, (c) => c.text("buyer-label", "BILLED TO", { fontSize: 10, fontWeight: 700, color: IT_INDIGO }).text("buyer", BUYER, {}, 4)],
      [0.5, (c) => c.text("details-label", "DETAILS", { fontSize: 10, fontWeight: 700, color: IT_INDIGO, align: "right" }).text("details", `PO / reference: {{custom.po_number}}\n${SUPPLY}`, { fontSize: 11, align: "right" })],
    ])
    .gap(16)
    .table(
      "items",
      [col("description", "Service", 0.38), col("hsn", "SAC", 0.12), col("qty", "Qty", 0.1), col("unit_price", "Rate", 0.14), col("gst_rate", "GST", 0.08), col("taxable_value", "Amount", 0.18)],
      { rowPadding: 8 },
    )
    .gap(12)
    .columns([
      [0.55, (c) => c.text("pay-label", "PAY BY UPI", { fontSize: 10, fontWeight: 700, color: IT_INDIGO }).gap(4).qr("upi", "upi://pay?pa={{custom.upi_id}}&cu=INR", 96, "left").text("pay", "Scan with any UPI app, or pay to {{custom.upi_id}}", { fontSize: 10, color: GREY })],
      [0.45, (c) => c.totals("totals", ["taxable", "tax", "total"], { width: 300 })],
    ])
    .gap(24)
    .columns([
      [0.55, (c) => c.gap(32).text("thanks", "Thank you for your business.", { fontSize: 12, fontWeight: 700, color: IT_INDIGO })],
      [0.45, (c) => c.signature("sign", "Authorised signatory", { width: 200 })],
    ]);
});

const BOUTIQUE_RUST = "#7C2D12";
const BOUTIQUE = design({ preset: "a5", documentType: "gst_invoice", font: "Lato", color: "#3F3F46", background: "#FFFCF7" }, (s) => {
  s.logo("logo", 120, 48)
    .gap(4)
    .text("name", "{{business.name}}", { fontSize: 20, fontWeight: 700, align: "center", color: BOUTIQUE_RUST, fontFamily: "Merriweather" })
    .text("supplier", SUPPLIER, { fontSize: 10, align: "center" }, 2)
    .gap(4)
    .divider("rule", "dotted", BOUTIQUE_RUST)
    .text("title", "TAX INVOICE", { fontSize: 11, fontWeight: 700, align: "center", color: BOUTIQUE_RUST })
    .gap(4)
    .columns([
      [0.5, (c) => c.text("buyer", `Bill to: ${BUYER}`, { fontSize: 10 }, 3)],
      [0.5, (c) => c.text("invoice", `No. {{receipt.number}}\nDate: {{receipt.date}}\n${SUPPLY}`, { fontSize: 10, align: "right" })],
    ])
    .gap(8)
    .table(
      "items",
      [col("description", "Item", 0.34), col("hsn", "HSN", 0.14), col("qty", "Qty", 0.12), col("gst_rate", "GST", 0.12), col("taxable_value", "Taxable", 0.28)],
      { fontSize: 11, rowPadding: 5 },
    )
    .gap(8)
    .totals("totals", ["taxable", "tax", "total"], { width: 220 })
    .gap(12)
    .columns([
      [0.5, (c) => c.gap(24).text("terms", "Exchange within 7 days with the bill. No cash refunds.", { fontSize: 9, color: GREY }, 2)],
      [0.5, (c) => c.signature("sign", "Authorised signatory", { width: 160, height: 56, color: BOUTIQUE_RUST })],
    ]);
});

const HOTEL_CYAN = "#0E7490";
const HOTEL = design({ preset: "a4", documentType: "gst_invoice", font: "Open Sans", color: "#1F2937" }, (s) => {
  s.columns([
    [0.6, (c) => c.logo("logo", 120, 48, "left").gap(8).text("name", "{{business.name}}", { fontSize: 22, fontWeight: 700 }).text("supplier", SUPPLIER, { fontSize: 11, color: GREY }, 3)],
    [0.4, (c) => c.text("title", "TAX INVOICE", { fontSize: 18, fontWeight: 700, align: "right", color: HOTEL_CYAN }).text("invoice", "Invoice no: {{receipt.number}}\nDate: {{receipt.date}}", { fontSize: 11, align: "right" })],
  ])
    .gap(12)
    .divider("rule", "solid", HOTEL_CYAN, 2)
    .gap(8)
    .columns([
      [0.5, (c) => c.text("guest-label", "GUEST", { fontSize: 10, fontWeight: 700, color: HOTEL_CYAN }).text("buyer", BUYER, { fontSize: 11 }, 4)],
      [0.5, (c) => c.text("stay-label", "STAY", { fontSize: 10, fontWeight: 700, color: HOTEL_CYAN, align: "right" }).text("stay", `Room: {{custom.room_no}}\nCheck-in: {{custom.check_in}}\nCheck-out: {{custom.check_out}}\n${SUPPLY}`, { fontSize: 11, align: "right" })],
    ])
    .gap(12)
    .table(
      "items",
      [col("description", "Particulars", 0.34), col("hsn", "SAC", 0.12), col("qty", "Nights / qty", 0.14), col("unit_price", "Rate", 0.14), col("gst_rate", "GST", 0.08), col("taxable_value", "Taxable", 0.18)],
      { fontSize: 11, rowPadding: 6 },
    )
    .gap(8)
    .columns([
      [0.55, (c) => c.text("paid", "Paid by {{receipt.payment_method}}\nThank you for staying with us!", { fontSize: 11 })],
      [0.45, (c) => c.totals("totals", ["taxable", "tax", "total"], { width: 300 })],
    ])
    .gap(32)
    .signature("sign", "Front office / authorised signatory", { width: 240 });
});

const WORKSHOP_RED = "#B91C1C";
const WORKSHOP = design({ preset: "a4", documentType: "gst_invoice", font: "Inter", color: "#111827" }, (s) => {
  s.columns([
    [0.6, (c) => c.text("name", "{{business.name}}", { fontSize: 22, fontWeight: 700, color: WORKSHOP_RED }).text("supplier", SUPPLIER, { fontSize: 11 }, 3)],
    [0.4, (c) => c.text("title", "TAX INVOICE", { fontSize: 16, fontWeight: 700, align: "right" }).text("invoice", `Invoice no: {{receipt.number}}\nDate: {{receipt.date}}\n${SUPPLY}`, { fontSize: 11, align: "right" })],
  ])
    .gap(8)
    .divider("rule", "solid", WORKSHOP_RED, 2)
    .gap(8)
    .columns([
      [0.5, (c) => c.text("customer-label", "CUSTOMER", { fontSize: 10, fontWeight: 700, color: WORKSHOP_RED }).text("buyer", BUYER, { fontSize: 11 }, 4)],
      [0.5, (c) => c.text("vehicle-label", "VEHICLE", { fontSize: 10, fontWeight: 700, color: WORKSHOP_RED, align: "right" }).text("vehicle", "Reg. no: {{custom.vehicle_no}}\nModel: {{custom.vehicle_model}}\nOdometer: {{custom.odometer}} km", { fontSize: 11, align: "right" })],
    ])
    .gap(12)
    .table(
      "items",
      [col("description", "Parts / labour", 0.32), col("hsn", "HSN/SAC", 0.13), col("qty", "Qty", 0.1), col("unit_price", "Rate", 0.13), col("gst_rate", "GST", 0.09), col("taxable_value", "Taxable", 0.23)],
      { fontSize: 11, rowPadding: 6 },
    )
    .gap(8)
    .columns([
      [0.55, (c) => c.text("terms", "Please check your vehicle before leaving the workshop.\nParts carry the manufacturer's warranty.", { fontSize: 10, color: GREY }, 3)],
      [0.45, (c) => c.totals("totals", ["taxable", "tax", "total"], { width: 300 })],
    ])
    .gap(32)
    .columns([
      [0.5, (c) => c.signature("customer-sign", "Customer's signature", { width: 200, align: "left" })],
      [0.5, (c) => c.signature("sign", "Authorised signatory", { width: 200 })],
    ]);
});

// Receipts first, then GST invoices (the Templates page filters by kind)
export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "shop-receipt", name: "Shop receipt", business: "Retail shop", canvas: SHOP_RECEIPT,
    description: "A simple thermal receipt for any counter.",
    sample: {
      business: { name: "Gupta General Store", address: "Shop 4, Station Road, Nashik" },
      items: [{ description: "Basmati rice 5 kg", qty: "1", unit_price: "540" }, { description: "Sunflower oil 1 L", qty: "2", unit_price: "165" }, { description: "Tea 250 g", qty: "1", unit_price: "140" }],
      tax_percent: "0", discount: "20",
    },
  },
  {
    id: "cafe-receipt", name: "Café bill", business: "Café", canvas: CAFE,
    description: "Table number, a tagline and a friendly sign-off.",
    sample: {
      business: { name: "Brew & Bloom Café", address: "" },
      receipt: { payment_method: "UPI" }, custom: { table_no: "7" },
      items: [{ description: "Cappuccino", qty: "2", unit_price: "180" }, { description: "Masala chai", qty: "1", unit_price: "60" }, { description: "Blueberry muffin", qty: "1", unit_price: "140" }],
      tax_percent: "5",
    },
  },
  {
    id: "restaurant-receipt", name: "Restaurant bill", business: "Restaurant", canvas: RESTAURANT,
    description: "Classic monospace bill with table, covers and server.",
    sample: {
      business: { name: "Spice Route Kitchen", address: "22 FC Road, Pune 411004" },
      custom: { table_no: "12", covers: "4", server_name: "Ravi" },
      items: [{ description: "Paneer tikka", qty: "1", unit_price: "320" }, { description: "Dal makhani", qty: "1", unit_price: "280" }, { description: "Butter naan", qty: "4", unit_price: "60" }],
      tax_percent: "5", discount: "50",
    },
  },
  {
    id: "bakery-receipt", name: "Bakery order", business: "Bakery", canvas: BAKERY,
    description: "Warm A5 order slip with pickup date and cake message.",
    sample: {
      business: { name: "The Butter Crumb", address: "8 Hill Road, Bandra West, Mumbai" },
      customer: { name: "Priya Nair" }, receipt: { notes: "Happy 30th, Anjali!" }, custom: { pickup_date: "Sat, 3 pm" },
      items: [{ description: "Chocolate truffle cake 1 kg", qty: "1", unit_price: "1200" }, { description: "Butter cookies box", qty: "2", unit_price: "250" }, { description: "Candles", qty: "1", unit_price: "40" }],
      discount: "100",
    },
  },
  {
    id: "salon-receipt", name: "Salon & spa", business: "Salon & spa", canvas: SALON,
    description: "Services, stylist and a rebooking reminder.",
    sample: {
      business: { name: "Glow Studio", address: "2nd floor, Indiranagar 100 Ft Road, Bengaluru" },
      customer: { name: "Meera Iyer" }, receipt: { payment_method: "Card" }, custom: { stylist: "Sana" },
      items: [{ description: "Haircut & styling", qty: "1", unit_price: "800" }, { description: "Hair spa", qty: "1", unit_price: "1500" }, { description: "Manicure", qty: "1", unit_price: "600" }],
      tax_percent: "18", discount: "200",
    },
  },
  {
    id: "clinic-receipt", name: "Clinic consultation", business: "Clinic", canvas: CLINIC,
    description: "Patient, doctor and a space for the clinic stamp.",
    sample: {
      business: { name: "Sunrise Family Clinic", address: "14 Park Street, Kolkata 700016" },
      customer: { name: "Arjun Sen" }, receipt: { payment_method: "Cash" }, custom: { age_sex: "42 / M", doctor: "Dr. R. Banerjee" },
      items: [{ description: "Consultation fee", qty: "1", unit_price: "600" }, { description: "Blood sugar test", qty: "1", unit_price: "150" }, { description: "ECG", qty: "1", unit_price: "400" }],
    },
  },
  {
    id: "tuition-receipt", name: "Tuition fee receipt", business: "Tuition & coaching", canvas: TUITION,
    description: "Student, batch and fee period, signed by the receiver.",
    sample: {
      business: { name: "Bright Minds Academy", address: "Sector 15, Rohini, Delhi" },
      customer: { name: "Kabir Malhotra" }, receipt: { payment_method: "UPI" }, custom: { batch: "Class 10 - Science", fee_period: "October 2026" },
      items: [{ description: "Tuition fee", qty: "1", unit_price: "4500" }, { description: "Study material", qty: "1", unit_price: "800" }, { description: "Test series", qty: "1", unit_price: "500" }],
    },
  },
  {
    id: "rent-receipt", name: "House rent receipt", business: "Landlord", canvas: RENT,
    description: "Rent receipt for HRA claims, with the landlord's PAN.",
    sample: {
      business: { name: "Suresh Kulkarni", address: "Flat 302, Lotus Residency, Kothrud, Pune" },
      customer: { name: "Neha Joshi" }, receipt: { payment_method: "bank transfer" },
      custom: { rent_period: "October 2026", property_address: "Flat 302, Lotus Residency, Kothrud, Pune", landlord_pan: "ABCPK1234D" },
      items: [{ description: "House rent, October 2026", qty: "1", unit_price: "18000" }, { description: "Maintenance", qty: "1", unit_price: "1500" }, { description: "Parking", qty: "1", unit_price: "500" }],
    },
  },
  {
    id: "gym-receipt", name: "Gym membership", business: "Gym & fitness", canvas: GYM,
    description: "Member ID, plan and validity on a bold thermal slip.",
    sample: {
      business: { name: "Iron Pulse Fitness", address: "" },
      customer: { name: "Rohit Verma" }, receipt: { payment_method: "UPI" }, custom: { member_id: "IPF-0458", valid_till: "31 Jan 2027" },
      items: [{ description: "Quarterly plan", qty: "1", unit_price: "6000" }, { description: "Personal training", qty: "4", unit_price: "500" }, { description: "Locker", qty: "1", unit_price: "300" }],
      tax_percent: "18", discount: "500",
    },
  },
  {
    id: "freelance-receipt", name: "Freelancer payment receipt", business: "Freelancer", canvas: FREELANCE,
    description: "A clean A4 receipt for clients, with your logo and notes.",
    sample: {
      business: { name: "Ananya Rao Photography", address: "Jubilee Hills, Hyderabad" },
      customer: { name: "Kapoor Weddings" }, receipt: { payment_method: "bank transfer", notes: "Edited photos will be delivered within 10 days." },
      custom: { project: "Engagement shoot, 12 Oct" },
      items: [{ description: "Photography (6 hours)", qty: "1", unit_price: "25000" }, { description: "Edited photos", qty: "150", unit_price: "40" }, { description: "Travel", qty: "1", unit_price: "2000" }],
    },
  },
  {
    id: "gst-a4", name: "GST tax invoice (A4)", business: "Any business", canvas: GST_A4,
    description: "Every rule 46 detail, for B2B and B2C sales.",
    sample: {
      business: { name: "Sharma Traders", address: "12 MG Road, Pune 411001", gstin: "27AAPFU0939F1ZV" },
      customer: { name: "Bengaluru Retail Pvt Ltd", address: "4 Brigade Road, Bengaluru", gstin: "29AAGCB7383J1Z4" }, receipt: { place_of_supply: "29" },
      items: [{ description: "Steel water bottle", qty: "50", unit_price: "220", hsn: "7323", unit: "PCS", gst_rate: "18" }, { description: "Lunch box", qty: "30", unit_price: "350", hsn: "3924", unit: "PCS", gst_rate: "18" }, { description: "Cotton bag", qty: "100", unit_price: "45", hsn: "6305", unit: "PCS", gst_rate: "5" }],
    },
  },
  {
    id: "gst-thermal", name: "GST invoice (thermal)", business: "Retail counter", canvas: GST_THERMAL,
    description: "A compliant tax invoice for receipt printers.",
    sample: {
      business: { name: "Patel Kirana", address: "Navrangpura, Ahmedabad", gstin: "24AAACG1209J1Z2" },
      items: [{ description: "Atta 10 kg", qty: "1", unit_price: "420", hsn: "1101", unit: "BAG", gst_rate: "5" }, { description: "Ghee 1 L", qty: "1", unit_price: "620", hsn: "0405", unit: "LTR", gst_rate: "5" }, { description: "Soap", qty: "4", unit_price: "40", hsn: "3401", unit: "PCS", gst_rate: "18" }],
    },
  },
  {
    id: "gst-restaurant", name: "Restaurant GST bill", business: "Restaurant", canvas: RESTAURANT_GST,
    description: "Thermal tax invoice with table number, at 5% GST.",
    sample: {
      business: { name: "Coastal Curry House", address: "MG Road, Kochi", gstin: "32AAJFK4417C1ZT" }, custom: { table_no: "5" },
      items: [{ description: "Fish curry meal", qty: "2", unit_price: "280", hsn: "9963", unit: "NOS", gst_rate: "5" }, { description: "Appam", qty: "4", unit_price: "30", hsn: "9963", unit: "NOS", gst_rate: "5" }, { description: "Lime soda", qty: "2", unit_price: "70", hsn: "9963", unit: "NOS", gst_rate: "5" }],
    },
  },
  {
    id: "gst-pharmacy", name: "Pharmacy invoice", business: "Pharmacy", canvas: PHARMACY,
    description: "Medicines with HSN and rate, drug licence in the header.",
    sample: {
      business: { name: "Lifeline Medicals", address: "Anna Nagar, Chennai 600040", gstin: "33AAACT2727Q1Z3" },
      customer: { name: "K. Lakshmi", address: "Anna Nagar, Chennai" }, receipt: { payment_method: "UPI" },
      items: [{ description: "Paracetamol 650 (15)", qty: "2", unit_price: "30", hsn: "3004", unit: "PAC", gst_rate: "5" }, { description: "Vitamin D3 sachet", qty: "4", unit_price: "35", hsn: "3004", unit: "PCS", gst_rate: "5" }, { description: "Digital thermometer", qty: "1", unit_price: "250", hsn: "9025", unit: "PCS", gst_rate: "18" }],
    },
  },
  {
    id: "gst-electronics", name: "Electronics store invoice", business: "Electronics", canvas: ELECTRONICS,
    description: "Serial / IMEI, warranty, discount and terms.",
    sample: {
      business: { name: "Digital Point", address: "Nehru Place, New Delhi 110019", gstin: "07AABCS1429B1ZW" },
      customer: { name: "Amit Khanna", address: "Lajpat Nagar, New Delhi" }, custom: { serial_no: "356789104512345", warranty: "1 year" },
      items: [{ description: "Smartphone 128 GB", qty: "1", unit_price: "18999", hsn: "8517", unit: "PCS", gst_rate: "18", discount: "1000" }, { description: "Phone cover", qty: "1", unit_price: "399", hsn: "3926", unit: "PCS", gst_rate: "18" }, { description: "Charger 33W", qty: "1", unit_price: "999", hsn: "8504", unit: "PCS", gst_rate: "18" }],
    },
  },
  {
    id: "gst-wholesale", name: "Wholesale / B2B invoice", business: "Distributor", canvas: WHOLESALE,
    description: "Dense A4 invoice with tax per line, vehicle no and bank details.",
    sample: {
      business: { name: "Ganga Distributors", address: "Transport Nagar, Lucknow 226012", gstin: "09AAFCD5862R1ZT" },
      customer: { name: "Shree Ram Stores", address: "Burrabazar, Kolkata 700007", gstin: "19AABCR6721L1Z2" }, receipt: { place_of_supply: "19" }, custom: { vehicle_no: "UP32 AB 1234" },
      items: [{ description: "Biscuits carton", qty: "40", unit_price: "480", hsn: "1905", unit: "BOX", gst_rate: "18", discount: "400" }, { description: "Detergent 1 kg", qty: "60", unit_price: "110", hsn: "3402", unit: "PAC", gst_rate: "18" }, { description: "Toor dal 30 kg", qty: "10", unit_price: "3600", hsn: "0713", unit: "BAG", gst_rate: "0" }],
    },
  },
  {
    id: "gst-services", name: "IT & consulting invoice", business: "Services", canvas: IT_SERVICES,
    description: "SAC codes, a PO number and a UPI QR code for payment.",
    sample: {
      business: { name: "Nimbus Tech Solutions", address: "HITEC City, Hyderabad 500081", gstin: "36AACCI5743M1Z8" },
      customer: { name: "Medisure Healthcare Pvt Ltd", address: "Whitefield, Bengaluru 560066", gstin: "29AAICM3344F1ZF" }, receipt: { place_of_supply: "29" },
      custom: { po_number: "PO-2026-118", upi_id: "nimbustech@upi" },
      items: [{ description: "Website development", qty: "1", unit_price: "60000", hsn: "998314", unit: "NOS", gst_rate: "18" }, { description: "Hosting (12 months)", qty: "1", unit_price: "9000", hsn: "998315", unit: "NOS", gst_rate: "18" }, { description: "Support hours", qty: "10", unit_price: "1200", hsn: "998316", unit: "NOS", gst_rate: "18" }],
    },
  },
  {
    id: "gst-boutique", name: "Boutique invoice", business: "Clothing & boutique", canvas: BOUTIQUE,
    description: "Elegant A5 invoice with logo and exchange policy.",
    sample: {
      business: { name: "Rang Rasiya", address: "Johari Bazaar, Jaipur", gstin: "08AAGFB2211N1ZL" },
      customer: { name: "Ritu Agarwal", address: "Malviya Nagar, Jaipur" },
      items: [{ description: "Block-print kurta", qty: "2", unit_price: "1450", hsn: "6204", unit: "PCS", gst_rate: "5" }, { description: "Silk dupatta", qty: "1", unit_price: "2400", hsn: "6214", unit: "PCS", gst_rate: "5" }, { description: "Juttis", qty: "1", unit_price: "1100", hsn: "6403", unit: "PRS", gst_rate: "5" }],
    },
  },
  {
    id: "gst-hotel", name: "Hotel & guest house invoice", business: "Hotel", canvas: HOTEL,
    description: "Room, check-in and check-out, with SAC codes.",
    sample: {
      business: { name: "Lakeview Residency", address: "Fateh Sagar Road, Udaipur", gstin: "08AAGFB2211N1ZL" },
      customer: { name: "Vikram Desai", address: "Satellite, Ahmedabad" }, receipt: { payment_method: "Card" },
      custom: { room_no: "204", check_in: "10 Oct 2026", check_out: "12 Oct 2026" },
      items: [{ description: "Deluxe room", qty: "2", unit_price: "3500", hsn: "996311", unit: "NOS", gst_rate: "5" }, { description: "Breakfast", qty: "4", unit_price: "350", hsn: "996331", unit: "NOS", gst_rate: "5" }, { description: "Airport pickup", qty: "1", unit_price: "1200", hsn: "996412", unit: "NOS", gst_rate: "5" }],
    },
  },
  {
    id: "gst-workshop", name: "Car service invoice", business: "Auto workshop", canvas: WORKSHOP,
    description: "Vehicle details, parts and labour, two signatures.",
    sample: {
      business: { name: "Speedline Motors", address: "Sector 18, Gurugram", gstin: "06AAEPM1234C1ZD" },
      customer: { name: "Sanjay Yadav", address: "DLF Phase 3, Gurugram" }, custom: { vehicle_no: "HR26 DK 4521", vehicle_model: "Maruti Swift", odometer: "48,210" },
      items: [{ description: "Engine oil 3.5 L", qty: "1", unit_price: "2400", hsn: "2710", unit: "BTL", gst_rate: "18" }, { description: "Oil filter", qty: "1", unit_price: "350", hsn: "8421", unit: "PCS", gst_rate: "18" }, { description: "General service labour", qty: "1", unit_price: "1500", hsn: "998714", unit: "NOS", gst_rate: "18" }],
    },
  },
];
