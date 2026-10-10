import type { Canvas, CanvasElement, pageConfigSchema } from "../schema/templateSchema";
import { z } from "zod";
import { tableHeight } from "./layout";

export const GRID_SIZE = 4;
export const MAX_ELEMENTS = 100;
export const MAX_HISTORY = 50;
// Matches the schema's width/height >= 8 rule
export const MIN_ELEMENT_SIZE = 8;
// Serialized template size limit (docs/03-schema.md)
export const MAX_CANVAS_BYTES = 256 * 1024;

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 3;
export const ZOOM_SENSITIVITY = 0.0015;
// Ignore zoom changes smaller than this (avoids re-rendering on float noise)
export const ZOOM_EPSILON = 0.0001;

// Scrollable gray workspace around the page, so zoom can center on any point
export const WORKSPACE_SIZE = 4000;
export const WORKSPACE_PAGE_ORIGIN = 1800;

export const TOAST_DURATION_MS = 3000;

// The curated 8 fonts (docs/03-schema.md). Six of the most-used sans-serifs plus
// the most-used serif and monospace, which suit receipts. Mirrors FontFamily in
// backend/app/schemas/canvas.py; the files are loaded by lib/fonts.ts.
export const FONT_FAMILIES = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Montserrat",
  "Lato",
  "Poppins",
  "Merriweather",
  "Roboto Mono",
] as const;
export type FontFamily = (typeof FONT_FAMILIES)[number];

const FONT_FALLBACKS: Partial<Record<FontFamily, string>> = {
  Merriweather: "serif",
  "Roboto Mono": "monospace",
};

// CSS font-family value with a generic fallback, e.g. `"Open Sans", sans-serif`
export const fontStack = (family: string) =>
  `"${family}", ${FONT_FALLBACKS[family as FontFamily] ?? "sans-serif"}`;

export const FONT_WEIGHTS = [
  { value: 400, label: "Regular" },
  { value: 500, label: "Medium" },
  { value: 600, label: "Semibold" },
  { value: 700, label: "Bold" },
] as const;

export const ELEMENT_LABELS: Record<CanvasElement["type"], string> = {
  text: "Text",
  image: "Image",
  items_table: "Items table",
  totals: "Totals",
  qr: "QR code",
  signature: "Signature",
  divider: "Divider",
};

// Line-item fields an items_table column can show (receipts.data items[])
export const ITEM_COLUMN_KEYS = [
  { key: "description", label: "Item" },
  { key: "qty", label: "Qty" },
  { key: "unit_price", label: "Price" },
  { key: "line_total", label: "Total" },
] as const;

export const TOTALS_FIELDS = [
  { key: "subtotal", label: "Subtotal" },
  { key: "tax", label: "Tax" },
  { key: "discount", label: "Discount" },
  { key: "total", label: "Total" },
] as const;

// --- Limits (mirrored by the backend schemas) ---------------------------------
export const FONT_SIZE_RANGE = { min: 6, max: 96 } as const;
export const LINE_HEIGHT_RANGE = { min: 0.8, max: 3, step: 0.1 } as const;
export const ROW_PADDING_RANGE = { min: 0, max: 24 } as const;
export const DIVIDER_MIN_THICKNESS = 1;
export const TEMPLATE_NAME_MAX_LENGTH = 120;
export const RECEIPT_NUMBER_MAX_LENGTH = 40;
export const NOTES_MAX_LENGTH = 1000;
export const MAX_LINE_ITEMS = 200;
export const CURRENCY_CODE_LENGTH = 3; // ISO 4217, e.g. USD
export const DEFAULT_CURRENCY = "USD";
export const CURRENCY_SYMBOL_MAX_LENGTH = 4;
export const HEX_COLOR_LENGTH = 7; // "#RRGGBB"
export const MAX_ASSET_BYTES = 2 * 1024 * 1024; // PNG / JPG uploads
export const BUSINESS_NAME_MAX_LENGTH = 120;
export const RECEIPT_PREFIX_MAX_LENGTH = 12;
// Letters, digits and a few separators (backend ReceiptPrefix)
export const RECEIPT_PREFIX_PATTERN = /^[A-Za-z0-9 _\-/#.]*$/;
export const MONEY_DECIMAL_PLACES = 2;

// --- Items table columns ---------------------------------------------------------
export const PERCENT = 100;
export const COLUMN_MIN_WIDTH_PERCENT = 1;
export const COLUMN_WIDTH_PRECISION = 10000; // widths are stored to 4 decimals

// --- Element inner layout (mirrored by backend render_service.py) -----------------
export const TABLE_DIVIDER_PX = 1;
export const TABLE_ROW_DIVIDER_ALPHA = 0.25;
export const TOTALS_LINE_HEIGHT = 1.4;
export const TOTALS_ROW_GAP = 4;
export const TOTALS_EMPHASIS_SCALE = 1.2;
export const SIGNATURE_LABEL_FONT_SIZE = 12;
export const SIGNATURE_LABEL_HEIGHT = 16;
export const SIGNATURE_LINE_THICKNESS = 2;
export const SIGNATURE_LABEL_GAP = 4;

// --- Editor interaction -----------------------------------------------------------
export const DRAG_ACTIVATION_DISTANCE_PX = 5; // pointer travel before a palette drag starts
export const TOUCH_ACTIVATION_DELAY_MS = 250; // long-press before a touch drag starts
export const TOUCH_ACTIVATION_TOLERANCE_PX = 5;
export const INLINE_TOOLBAR_GAP_PX = 4;
export const PREVIEW_MAX_WIDTH_PX = 520;
export const OBJECT_URL_REVOKE_DELAY_MS = 1000; // keep a download's blob URL alive this long

// The editor shows the items table with this many placeholder rows; its default
// height is exactly header + these rows, per the Layout Algorithm.
export const ITEMS_TABLE_SAMPLE_ROWS = 3;

export type PagePreset = z.infer<typeof pageConfigSchema>["preset"];

export const PAGE_PRESETS: Record<PagePreset, z.infer<typeof pageConfigSchema>> = {
  thermal80: {
    preset: "thermal80",
    width: 302, // 80mm
    height: 400, // design height
    heightMode: "auto",
    background: "#FFFFFF",
    margin: 12,
  },
  a5: {
    preset: "a5",
    width: 559, // A5 portrait @96dpi
    height: 794,
    heightMode: "fixed",
    background: "#FFFFFF",
    margin: 24,
  },
  a4: {
    preset: "a4",
    width: 794,
    height: 1123,
    heightMode: "fixed",
    background: "#FFFFFF",
    margin: 32,
  },
};

export const DEFAULT_PAGE = PAGE_PRESETS.thermal80;

export const BLANK_CANVAS: Canvas = { schemaVersion: 1, page: DEFAULT_PAGE, elements: [] };
export const UNTITLED_TEMPLATE = "Untitled receipt";

export const PAGE_PRESET_LABELS: Record<PagePreset, string> = {
  thermal80: "Thermal 80 mm (auto height)",
  a5: "A5 portrait",
  a4: "A4 portrait",
};

// Editable design height range for auto-height (thermal) pages
export const MIN_DESIGN_HEIGHT = 200;
export const MAX_DESIGN_HEIGHT = 3000;

const DEFAULT_TABLE_PROPS: Extract<CanvasElement, { type: "items_table" }>["props"] = {
  binding: "receipt.items",
  columns: [
    { key: "description", label: "Item", width: 0.45, align: "left" },
    { key: "qty", label: "Qty", width: 0.15, align: "right" },
    { key: "unit_price", label: "Price", width: 0.2, align: "right" },
    { key: "line_total", label: "Total", width: 0.2, align: "right" },
  ],
  fontFamily: "Inter",
  fontSize: 12,
  lineHeight: 1.3,
  rowPadding: 4,
  headerBold: true,
  rowDivider: true,
  color: "#000000",
};

// Default sizes and props when dropping
export const DEFAULT_ELEMENTS: Record<CanvasElement["type"], Omit<CanvasElement, "id" | "x" | "y" | "zIndex" | "type">> = {
  text: {
    width: 200,
    height: 30,
    locked: false,
    props: {
      content: "Sample Text",
      fontFamily: "Inter",
      fontSize: 16,
      fontWeight: 400,
      color: "#000000",
      align: "left",
      lineHeight: 1.3,
    },
  },
  image: {
    width: 100,
    height: 100,
    locked: false,
    props: {
      source: "logo",
      assetId: null,
      fit: "contain",
    },
  },
  items_table: {
    width: 278,
    height: tableHeight(DEFAULT_TABLE_PROPS, ITEMS_TABLE_SAMPLE_ROWS), // 4 rows x 24px = 96
    locked: false,
    props: DEFAULT_TABLE_PROPS,
  },
  totals: {
    width: 180,
    height: 90,
    locked: false,
    props: {
      binding: "receipt.totals",
      show: ["subtotal", "tax", "discount", "total"],
      fontFamily: "Inter",
      fontSize: 13,
      emphasizeTotal: true,
      currencySymbol: "$",
    },
  },
  qr: {
    width: 100,
    height: 100,
    locked: false,
    props: {
      content: "{{receipt.number}}",
      errorCorrection: "M",
    },
  },
  signature: {
    width: 140,
    height: 50,
    locked: false,
    props: {
      label: "Authorized signature",
      assetId: null,
      lineColor: "#000000",
    },
  },
  divider: {
    width: 278,
    height: MIN_ELEMENT_SIZE, // line is drawn centered; box must still pass schema min size
    locked: false,
    props: {
      style: "dashed",
      thickness: 1,
      color: "#999999",
    },
  },
};
