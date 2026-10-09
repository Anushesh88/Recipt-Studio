import type { CanvasElement, pageConfigSchema } from "../schema/templateSchema";
import { z } from "zod";

export const GRID_SIZE = 4;
export const MAX_ELEMENTS = 100;
export const MAX_HISTORY = 50;
// Matches the schema's width/height >= 8 rule
export const MIN_ELEMENT_SIZE = 8;

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 3;
export const ZOOM_SENSITIVITY = 0.0015;

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
    height: 100, // header + 3 rows
    locked: false,
    props: {
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
    },
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
