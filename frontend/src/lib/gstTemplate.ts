// "Add missing fields" for GST invoice templates: everything rule 46 needs that
// the template doesn't show yet (lib/gst.ts missingParticulars), added below the
// existing content. Existing elements only ever gain columns / totals lines.
import type { Canvas, CanvasElement } from "../schema/templateSchema";
import { REQUIRED_COLUMNS, REQUIRED_VARIABLES, missingParticulars } from "./gst";
import { totalsRows } from "./elementLayout";
import { findVariables } from "./variables";
import { generateId } from "./ids";
import { DEFAULT_ELEMENTS, GRID_SIZE, ITEM_COLUMN_KEYS, TOTALS_FIELDS, type TotalsLine } from "./units";

type TableElement = Extract<CanvasElement, { type: "items_table" }>;
type TotalsElement = Extract<CanvasElement, { type: "totals" }>;
type Column = TableElement["props"]["columns"][number];

// How each required variable is introduced on the details block
const VARIABLE_LINES: Record<string, string> = {
  "business.name": "{{business.name}}",
  "business.address": "{{business.address}}",
  "business.gstin": "GSTIN: {{business.gstin}}",
  "receipt.number": "Invoice no: {{receipt.number}}",
  "receipt.date": "Date: {{receipt.date}}",
  "customer.name": "Bill to: {{customer.name}}",
  "customer.address": "{{customer.address}}",
  "customer.gstin": "Customer GSTIN: {{customer.gstin}}",
  "receipt.place_of_supply": "Place of supply: {{receipt.place_of_supply}}",
  "receipt.reverse_charge": "Reverse charge: {{receipt.reverse_charge}}",
};

// The GST invoice table columns, with their share of the width
export const GST_TABLE_COLUMNS: Column[] = [
  { key: "description", label: "Item", width: 0.34, align: "left" },
  { key: "hsn", label: "HSN/SAC", width: 0.16, align: "left" },
  { key: "qty", label: "Qty", width: 0.14, align: "right" },
  { key: "gst_rate", label: "GST", width: 0.12, align: "right" },
  { key: "taxable_value", label: "Taxable", width: 0.24, align: "right" },
];
export const GST_TOTALS_LINES: TotalsLine[] = ["taxable", "tax", "total"];
// The editor shows a GST invoice's tax as CGST + SGST (the most rows it can take)
export const SAMPLE_GST_TAX_ROWS = [
  { key: "cgst", label: "CGST" },
  { key: "sgst", label: "SGST" },
];

const DETAILS_FONT_SIZE = 12;
const DETAILS_LINE_HEIGHT = 1.3;
const GAP = GRID_SIZE * 2;

const snapUp = (v: number) => Math.ceil(v / GRID_SIZE) * GRID_SIZE;
const round4 = (v: number) => Math.round(v * 10000) / 10000;

// Adds `keys` as columns, each taking an equal share; the rest shrink to fit
function withColumns(columns: Column[], keys: string[]): Column[] {
  if (keys.length === 0) return columns;
  const share = 1 / (columns.length + keys.length);
  const added = keys.map((key) => ({
    key,
    label: ITEM_COLUMN_KEYS.find((k) => k.key === key)?.label ?? key,
    width: share,
    align: key === "description" || key === "hsn" ? "left" : "right",
  }) as Column);
  const scaled = [...columns.map((c) => ({ ...c, width: c.width * (1 - share * keys.length) })), ...added];
  const sum = scaled.reduce((s, c) => s + c.width, 0);
  return scaled.map((c) => ({ ...c, width: round4(c.width / sum) }));
}

// Tall enough for the shown lines with the tax split in two
export function gstTotalsHeight(props: TotalsElement["props"]): number {
  const rows = totalsRows(props, SAMPLE_GST_TAX_ROWS);
  const last = rows[rows.length - 1];
  return snapUp(last ? last.top + last.height : 0);
}

export function completeForGst(canvas: Pick<Canvas, "page" | "elements">): CanvasElement[] {
  if (missingParticulars(canvas.elements).length === 0) return canvas.elements;
  const { page } = canvas;
  const x = page.margin;
  const width = page.width - 2 * page.margin;
  let nextY = snapUp(Math.max(0, ...canvas.elements.map((e) => e.y + e.height)) + GAP);
  const place = (height: number) => {
    const y = nextY;
    nextY = snapUp(y + height + GAP);
    return y;
  };

  const elements = canvas.elements.map((element) => {
    if (element.type === "items_table") {
      const have = new Set(element.props.columns.map((c) => c.key));
      const keys = Object.keys(REQUIRED_COLUMNS).filter((k) => !have.has(k));
      return { ...element, props: { ...element.props, columns: withColumns(element.props.columns, keys) } };
    }
    if (element.type === "totals") {
      const shown = new Set<TotalsLine>([...element.props.show, ...GST_TOTALS_LINES]);
      const props = { ...element.props, show: TOTALS_FIELDS.map((f) => f.key).filter((k) => shown.has(k)) };
      return { ...element, height: Math.max(element.height, gstTotalsHeight(props)), props };
    }
    return element;
  });

  // Required details not printed anywhere yet go on one text block
  const printed = new Set(elements.flatMap((e) => (e.type === "text" ? findVariables(e.props.content) : [])));
  const lines = Object.keys(REQUIRED_VARIABLES).filter((key) => !printed.has(key)).map((key) => VARIABLE_LINES[key]);
  if (lines.length > 0) {
    const height = snapUp(lines.length * Math.ceil(DETAILS_FONT_SIZE * DETAILS_LINE_HEIGHT) + GRID_SIZE);
    const text = DEFAULT_ELEMENTS.text as Omit<Extract<CanvasElement, { type: "text" }>, "id" | "x" | "y" | "zIndex" | "type">;
    elements.push({
      ...text,
      id: generateId(),
      type: "text",
      x, y: place(height), width, height, zIndex: elements.length + 1,
      props: { ...text.props, content: lines.join("\n"), fontSize: DETAILS_FONT_SIZE, lineHeight: DETAILS_LINE_HEIGHT },
    });
  }

  if (!elements.some((e) => e.type === "items_table")) {
    const table = DEFAULT_ELEMENTS.items_table as Omit<TableElement, "id" | "x" | "y" | "zIndex" | "type">;
    elements.push({
      ...table,
      id: generateId(),
      type: "items_table",
      x, y: place(table.height), width, zIndex: elements.length + 1,
      props: { ...table.props, columns: GST_TABLE_COLUMNS },
    });
  }

  if (!elements.some((e) => e.type === "totals")) {
    const totals = DEFAULT_ELEMENTS.totals as Omit<TotalsElement, "id" | "x" | "y" | "zIndex" | "type">;
    const props = { ...totals.props, show: GST_TOTALS_LINES, currencySymbol: "₹" };
    const height = gstTotalsHeight(props);
    elements.push({
      ...totals,
      id: generateId(),
      type: "totals",
      x: x + width - totals.width, y: place(height), height, zIndex: elements.length + 1,
      props,
    });
  }

  if (!elements.some((e) => e.type === "signature")) {
    const signature = DEFAULT_ELEMENTS.signature as Omit<Extract<CanvasElement, { type: "signature" }>, "id" | "x" | "y" | "zIndex" | "type">;
    elements.push({
      ...signature,
      id: generateId(),
      type: "signature",
      x: x + width - signature.width, y: place(signature.height), zIndex: elements.length + 1,
      props: { ...signature.props, label: "Authorised signatory" },
    });
  }
  return elements;
}
