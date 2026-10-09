import { z } from "zod";

const VARIABLE_REGEX = /\{\{\s*([a-z_]+(?:\.[a-z_]+)?)\s*\}\}/g;
const BUILTIN_VARIABLES = new Set([
  "business.name", "customer.name", "customer.email", "receipt.number",
  "receipt.date", "receipt.payment_method", "receipt.currency", "receipt.notes"
]);

const validateVariables = (text: string) => {
  const matches = Array.from(text.matchAll(VARIABLE_REGEX));
  for (const match of matches) {
    const variable = match[1];
    if (!BUILTIN_VARIABLES.has(variable) && !variable.startsWith("custom.")) {
      return false;
    }
  }
  return true;
};

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color");

const baseElement = z.object({
  id: z.string(),
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().min(8),
  height: z.number().min(8),
  zIndex: z.number().default(1),
  locked: z.boolean().default(false),
});

const textProps = z.object({
  content: z.string().refine(validateVariables, "Unknown variables in content"),
  fontFamily: z.string(),
  fontSize: z.number().min(6).max(96),
  fontWeight: z.number().default(400),
  color: hexColor,
  align: z.enum(["left", "center", "right", "justify"]).default("left"),
  lineHeight: z.number().default(1.3),
});

export const textElementSchema = baseElement.extend({
  type: z.literal("text"),
  props: textProps,
});

const imageProps = z.object({
  source: z.enum(["logo", "signature", "image"]),
  assetId: z.string().nullable().default(null),
  fit: z.enum(["contain", "cover", "fill"]).default("contain"),
});

export const imageElementSchema = baseElement.extend({
  type: z.literal("image"),
  props: imageProps,
});

const columnDef = z.object({
  key: z.string(),
  label: z.string(),
  width: z.number(),
  align: z.enum(["left", "center", "right"]),
});

const itemsTableProps = z.object({
  binding: z.literal("receipt.items"),
  columns: z.array(columnDef),
  fontFamily: z.string(),
  fontSize: z.number().min(6).max(96),
  lineHeight: z.number().default(1.3),
  rowPadding: z.number().default(4),
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
  show: z.array(z.enum(["subtotal", "tax", "discount", "total"])),
  fontFamily: z.string(),
  fontSize: z.number().min(6).max(96),
  emphasizeTotal: z.boolean().default(true),
  currencySymbol: z.string().default("$"),
});

export const totalsElementSchema = baseElement.extend({
  type: z.literal("totals"),
  props: totalsProps,
});

const qrProps = z.object({
  content: z.string().refine(validateVariables, "Unknown variables in content"),
  errorCorrection: z.enum(["L", "M", "Q", "H"]).default("M"),
});

export const qrElementSchema = baseElement.extend({
  type: z.literal("qr"),
  props: qrProps,
});

const signatureProps = z.object({
  label: z.string(),
  assetId: z.string().nullable().default(null),
  lineColor: hexColor,
});

export const signatureElementSchema = baseElement.extend({
  type: z.literal("signature"),
  props: signatureProps,
});

const dividerProps = z.object({
  style: z.enum(["solid", "dashed", "dotted"]),
  thickness: z.number().min(1),
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

export const pageConfigSchema = z.object({
  preset: z.enum(["thermal80", "a5", "a4"]),
  width: z.number().positive(),
  height: z.number().positive(),
  heightMode: z.enum(["auto", "fixed"]),
  background: hexColor,
  margin: z.number().min(0),
});

export const canvasSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  page: pageConfigSchema,
  elements: z.array(canvasElementSchema).max(100),
}).refine(data => {
  const itemsTableCount = data.elements.filter(e => e.type === "items_table").length;
  if (itemsTableCount > 1) return false;
  return true;
}, "Max one items_table element is allowed")
  .refine(data => {
  const totalsCount = data.elements.filter(e => e.type === "totals").length;
  if (totalsCount > 1) return false;
  return true;
}, "Max one totals element is allowed");

export type CanvasElement = z.infer<typeof canvasElementSchema>;
export type Canvas = z.infer<typeof canvasSchema>;
