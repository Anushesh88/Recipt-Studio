import { z } from "zod";
import {
  CURRENCY_SYMBOL_MAX_LENGTH,
  DIVIDER_MIN_THICKNESS,
  ELEMENT_ID_MAX_LENGTH,
  FONT_FAMILIES,
  FONT_SIZE_RANGE,
  FONT_WEIGHTS,
  ITEM_COLUMN_KEYS,
  LABEL_MAX_LENGTH,
  LINE_HEIGHT_RANGE,
  MAX_CANVAS_BYTES,
  MAX_DESIGN_HEIGHT,
  MAX_ELEMENTS,
  MAX_PAGE_MARGIN,
  MIN_DESIGN_HEIGHT,
  MIN_ELEMENT_SIZE,
  PAGE_SIZES,
  ROW_PADDING_RANGE,
  TOTALS_FIELDS,
} from "../lib/units";
import { findUnknownVariables } from "../lib/variables";
import { qrFits, qrTooLongMessage } from "../lib/qr";

// Mirrors backend app/schemas/canvas.py, limits included: anything the editor
// can't produce is rejected (Architecture backend rule 2). z.number() already
// refuses Infinity and NaN.

// Text/QR content may only use built-in or custom.* variables
const variableContent = z.string().superRefine((text, ctx) => {
  const unknown = findUnknownVariables(text);
  if (unknown.length > 0) {
    ctx.addIssue({
      code: "custom",
      message: `Unknown variables in content: ${unknown.map((key) => `{{${key}}}`).join(", ")}`,
    });
  }
});

// Only the curated, bundled fonts (FONT_FAMILIES)
const fontFamily = z.enum(FONT_FAMILIES);
const fontSize = z.number().min(FONT_SIZE_RANGE.min).max(FONT_SIZE_RANGE.max);
const lineHeight = z.number().min(LINE_HEIGHT_RANGE.min).max(LINE_HEIGHT_RANGE.max);
const label = z.string().max(LABEL_MAX_LENGTH, `Use at most ${LABEL_MAX_LENGTH} characters`);
const assetId = z.uuid().nullable().default(null);

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color");

const FONT_WEIGHT_VALUES: readonly number[] = FONT_WEIGHTS.map((w) => w.value);

const unique = (values: readonly string[]) => new Set(values).size === values.length;

const baseElement = z.object({
  id: z.string().min(1).max(ELEMENT_ID_MAX_LENGTH),
  x: z.number().min(0),
  y: z.number().min(0).max(MAX_DESIGN_HEIGHT),
  width: z.number().min(MIN_ELEMENT_SIZE),
  height: z.number().min(MIN_ELEMENT_SIZE).max(MAX_DESIGN_HEIGHT),
  zIndex: z.number().int().min(0).max(MAX_ELEMENTS).default(1),
  locked: z.boolean().default(false),
});

const textProps = z.object({
  content: variableContent,
  fontFamily,
  fontSize,
  fontWeight: z.number().refine((w) => FONT_WEIGHT_VALUES.includes(w), `Font weight must be one of ${FONT_WEIGHT_VALUES.join(", ")}`).default(400),
  color: hexColor,
  align: z.enum(["left", "center", "right", "justify"]).default("left"),
  lineHeight: lineHeight.default(1.3),
});

export const textElementSchema = baseElement.extend({
  type: z.literal("text"),
  props: textProps,
});

const imageProps = z.object({
  source: z.enum(["logo", "signature", "image"]),
  assetId,
  fit: z.enum(["contain", "cover", "fill"]).default("contain"),
});

export const imageElementSchema = baseElement.extend({
  type: z.literal("image"),
  props: imageProps,
});

const columnDef = z.object({
  // The line-item field the column shows
  key: z.enum(ITEM_COLUMN_KEYS.map((k) => k.key) as [string, ...string[]]),
  label,
  width: z.number().min(0).max(1), // fraction of the table width
  align: z.enum(["left", "center", "right"]),
});

const itemsTableProps = z.object({
  binding: z.literal("receipt.items"),
  columns: z
    .array(columnDef)
    .min(1)
    .max(ITEM_COLUMN_KEYS.length)
    .refine((columns) => unique(columns.map((c) => c.key)), "Each line-item field can only have one column"),
  fontFamily,
  fontSize,
  lineHeight: lineHeight.default(1.3),
  rowPadding: z.number().min(ROW_PADDING_RANGE.min).max(ROW_PADDING_RANGE.max).default(4),
  headerBold: z.boolean().default(true),
  rowDivider: z.boolean().default(true),
  color: hexColor,
});

export const itemsTableElementSchema = baseElement.extend({
  type: z.literal("items_table"),
  props: itemsTableProps,
});

const totalsProps = z.object({
  binding: z.literal("receipt.totals"),
  show: z
    .array(z.enum(TOTALS_FIELDS.map((f) => f.key) as ["subtotal", "tax", "discount", "total"]))
    .max(TOTALS_FIELDS.length)
    .refine(unique, "Each totals line can only be shown once"),
  fontFamily,
  fontSize,
  emphasizeTotal: z.boolean().default(true),
  currencySymbol: z.string().max(CURRENCY_SYMBOL_MAX_LENGTH).default("$"),
});

export const totalsElementSchema = baseElement.extend({
  type: z.literal("totals"),
  props: totalsProps,
});

const qrProps = z
  .object({
    content: variableContent,
    errorCorrection: z.enum(["L", "M", "Q", "H"]).default("M"),
  })
  .superRefine((props, ctx) => {
    if (!qrFits(props.content, props.errorCorrection)) {
      ctx.addIssue({ code: "custom", path: ["content"], message: qrTooLongMessage(props.errorCorrection) });
    }
  });

export const qrElementSchema = baseElement.extend({
  type: z.literal("qr"),
  props: qrProps,
});

const signatureProps = z.object({
  label,
  assetId,
  lineColor: hexColor,
});

export const signatureElementSchema = baseElement.extend({
  type: z.literal("signature"),
  props: signatureProps,
});

const dividerProps = z.object({
  style: z.enum(["solid", "dashed", "dotted"]),
  // The divider's box is a MIN_ELEMENT_SIZE strip; the line sits inside it
  thickness: z.number().min(DIVIDER_MIN_THICKNESS).max(MIN_ELEMENT_SIZE),
  color: hexColor,
});

export const dividerElementSchema = baseElement.extend({
  type: z.literal("divider"),
  props: dividerProps,
});

export const canvasElementSchema = z.discriminatedUnion("type", [
  textElementSchema,
  imageElementSchema,
  itemsTableElementSchema,
  totalsElementSchema,
  qrElementSchema,
  signatureElementSchema,
  dividerElementSchema,
]);

// The size comes from the preset (thermal 80mm / A5 / A4); thermal pages are
// auto-height with an editable design height
export const pageConfigSchema = z
  .object({
    preset: z.enum(["thermal80", "a5", "a4"]),
    width: z.number().positive(),
    height: z.number().positive(),
    heightMode: z.enum(["auto", "fixed"]),
    background: hexColor,
    margin: z.number().min(0).max(MAX_PAGE_MARGIN),
  })
  .superRefine((page, ctx) => {
    const size = PAGE_SIZES[page.preset];
    if (page.width !== size.width || page.heightMode !== size.heightMode) {
      ctx.addIssue({ code: "custom", message: `A ${page.preset} page is ${size.width}px wide with ${size.heightMode} height` });
    } else if (page.heightMode === "fixed" && page.height !== size.height) {
      ctx.addIssue({ code: "custom", path: ["height"], message: `A ${page.preset} page is ${size.height}px tall` });
    } else if (page.heightMode === "auto" && (page.height < MIN_DESIGN_HEIGHT || page.height > MAX_DESIGN_HEIGHT)) {
      ctx.addIssue({
        code: "custom",
        path: ["height"],
        message: `The design height must be between ${MIN_DESIGN_HEIGHT} and ${MAX_DESIGN_HEIGHT}px`,
      });
    }
  });

// Mirrors Canvas.validate_canvas in backend/app/schemas/canvas.py
export const canvasSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  page: pageConfigSchema,
  elements: z.array(canvasElementSchema).max(MAX_ELEMENTS),
}).superRefine((data, ctx) => {
  const count = (type: string) => data.elements.filter((e) => e.type === type).length;
  if (count("items_table") > 1) {
    ctx.addIssue({ code: "custom", message: "Max one items_table element is allowed", path: ["elements"] });
  }
  if (count("totals") > 1) {
    ctx.addIssue({ code: "custom", message: "Max one totals element is allowed", path: ["elements"] });
  }

  const seen = new Set<string>();
  data.elements.forEach((e, i) => {
    if (seen.has(e.id)) {
      ctx.addIssue({ code: "custom", message: `Duplicate element id: ${e.id}`, path: ["elements", i, "id"] });
    }
    seen.add(e.id);

    // Elements must fit the page width; fixed-height pages also bound the height
    // (auto-height pages grow at generation time).
    if (e.x + e.width > data.page.width) {
      ctx.addIssue({ code: "custom", message: `Element ${e.id} extends past the page width`, path: ["elements", i] });
    }
    if (data.page.heightMode === "fixed" && e.y + e.height > data.page.height) {
      ctx.addIssue({ code: "custom", message: `Element ${e.id} extends past the page height`, path: ["elements", i] });
    }
  });

  if (new TextEncoder().encode(JSON.stringify(data)).length > MAX_CANVAS_BYTES) {
    ctx.addIssue({ code: "custom", message: `Template is larger than ${MAX_CANVAS_BYTES / 1024} KB`, path: [] });
  }
});

export type CanvasElement = z.infer<typeof canvasElementSchema>;
export type Canvas = z.infer<typeof canvasSchema>;
