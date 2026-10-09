import type { CanvasElement, pageConfigSchema } from "../schema/templateSchema";
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
