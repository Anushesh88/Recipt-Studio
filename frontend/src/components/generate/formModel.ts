// The Generate form, derived from the template (Architecture frontend rule 11):
// built-in variables the template uses become named fields, custom.* ones text
// fields labelled from their key, plus the line items, tax and discount.
import { z } from "zod";
import type { Canvas } from "../../schema/templateSchema";
import type { ReceiptDataInput, ReceiptRecord } from "../../api/receipts";
import { CUSTOM_PREFIX, extractVariables, variableKind, variableLabel, type VariableValues } from "../../lib/variables";
import { computeTotals, percentToFraction, type Totals } from "../../lib/money";
import type { TableRow } from "../elements/TableEl";
import type { TotalsValues } from "../elements/TotalsEl";
import { DEFAULT_CURRENCY, MAX_LINE_ITEMS, NOTES_MAX_LENGTH, RECEIPT_NUMBER_MAX_LENGTH } from "../../lib/units";


export interface LineItemValues {
  description: string;
  qty: string;
  unit_price: string;
}

export interface GenerateValues {
  business: { name: string };
  customer: { name: string; email: string };
  receipt: { number: string; date: string; payment_method: string; currency: string; notes: string };
  custom: Record<string, string>;
  items: LineItemValues[];
  tax_percent: string;
  discount: string;
}

// Built-ins that get a field only when the template uses them. The receipt
// number and currency are always asked for (blank number = automatic).
export const BUILTIN_FIELDS = [
  "business.name",
  "customer.name",
  "customer.email",
  "receipt.date",
  "receipt.payment_method",
  "receipt.notes",
] as const;
export type BuiltinField = (typeof BUILTIN_FIELDS)[number];

const OPTIONAL_FIELDS = new Set<string>(["receipt.notes"]); // backend OPTIONAL_VARIABLES

export interface FormModel {
  builtinFields: BuiltinField[];
  customKeys: string[]; // without the "custom." prefix
  schema: z.ZodType<GenerateValues, GenerateValues>;
  defaults: GenerateValues;
}

const QTY = /^\d+(\.\d{1,3})?$/;
const MONEY = /^\d+(\.\d{1,2})?$/;
const PERCENT = /^\d+(\.\d{1,2})?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY = /^[A-Za-z]{3}$/;

const required = (label: string) => z.string().trim().min(1, `${label} is required`);

const today = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const emptyLineItem = (): LineItemValues => ({ description: "", qty: "1", unit_price: "" });

export function buildFormModel(canvas: Canvas): FormModel {
  const used = extractVariables(canvas);
  const usedSet = new Set(used);
  const builtinFields = BUILTIN_FIELDS.filter((key) => usedSet.has(key));
  const customKeys = used.filter((key) => variableKind(key) === "custom").map((key) => key.slice(CUSTOM_PREFIX.length));

  const field = (key: BuiltinField) =>
    usedSet.has(key) && !OPTIONAL_FIELDS.has(key) ? required(variableLabel(key)) : z.string();

  const schema = z
    .object({
      business: z.object({ name: field("business.name") }),
      customer: z.object({
        name: field("customer.name"),
        email: usedSet.has("customer.email")
          ? required("Customer email").pipe(z.email("Enter a valid email address"))
          : z.string(),
      }),
      receipt: z.object({
        number: z.string().trim().max(RECEIPT_NUMBER_MAX_LENGTH, `Use at most ${RECEIPT_NUMBER_MAX_LENGTH} characters`),
        date: usedSet.has("receipt.date")
          ? required("Receipt date").regex(ISO_DATE, "Pick a date")
          : z.string(),
        payment_method: field("receipt.payment_method"),
        currency: z.string().trim().regex(CURRENCY, "Use a 3-letter currency code, e.g. USD"),
        notes: z.string().max(NOTES_MAX_LENGTH, `Use at most ${NOTES_MAX_LENGTH} characters`),
      }),
      custom: z.object(Object.fromEntries(customKeys.map((key) => [key, required(variableLabel(CUSTOM_PREFIX + key))]))),
      items: z
        .array(
          z.object({
            description: required("Description"),
            qty: z.string().trim().regex(QTY, "A number, up to 3 decimals").refine((v) => Number(v) > 0, "More than 0"),
            unit_price: z.string().trim().regex(MONEY, "An amount like 4.50"),
          }),
        )
        .max(MAX_LINE_ITEMS, `At most ${MAX_LINE_ITEMS} items`),
      tax_percent: z.string().trim().regex(PERCENT, "A percentage like 8 or 8.25").refine((v) => Number(v) <= 100, "At most 100%"),
      discount: z.string().trim().regex(MONEY, "An amount like 2.00"),
    })
    .superRefine((values, ctx) => {
      const result = computeTotals(values.items, percentToFraction(values.tax_percent) ?? "0", values.discount);
      if (!result.ok && result.error === "DISCOUNT_TOO_LARGE") {
        ctx.addIssue({ code: "custom", path: ["discount"], message: "The discount can't be more than the subtotal" });
      }
    }) as unknown as z.ZodType<GenerateValues, GenerateValues>;

  return {
    builtinFields,
    customKeys,
    schema,
    defaults: {
      business: { name: "" },
      customer: { name: "", email: "" },
      receipt: { number: "", date: today(), payment_method: "", currency: DEFAULT_CURRENCY, notes: "" },
      custom: Object.fromEntries(customKeys.map((key) => [key, ""])),
      items: [emptyLineItem()],
      tax_percent: "0",
      discount: "0.00",
    },
  };
}

const orNull = (value: string) => value.trim() || null;

export function toPayload(values: GenerateValues, customKeys: string[]): ReceiptDataInput {
  return {
    business: { name: orNull(values.business.name) },
    customer: { name: orNull(values.customer.name), email: orNull(values.customer.email) },
    receipt: {
      number: orNull(values.receipt.number),
      date: orNull(values.receipt.date),
      payment_method: orNull(values.receipt.payment_method),
      currency: values.receipt.currency.trim().toUpperCase(),
      notes: orNull(values.receipt.notes),
    },
    custom: Object.fromEntries(customKeys.map((key) => [key, values.custom[key]?.trim() ?? ""])),
    items: values.items.map((i) => ({ description: i.description.trim(), qty: i.qty.trim(), unit_price: i.unit_price.trim() })),
    tax_rate: percentToFraction(values.tax_percent) ?? "0",
    discount: values.discount.trim() || "0",
  };
}

export interface PreviewData {
  values: VariableValues;
  rows: TableRow[];
  totals: TotalsValues;
  computed: Totals | null; // null while some amount isn't a valid number yet
}

const PENDING = "—";

// What the live preview shows for the current (possibly incomplete) form
export function previewFromForm(values: GenerateValues, nextNumber: string | null): PreviewData {
  const items = values.items ?? [];
  const result = computeTotals(items, percentToFraction(values.tax_percent ?? "") ?? "0", values.discount ?? "");
  const computed = result.ok ? result.totals : null;
  const lineTotal = (item: LineItemValues) => {
    const one = computeTotals([item], "0", "0");
    return one.ok ? one.totals.subtotal : PENDING;
  };
  return {
    values: {
      "business.name": values.business?.name ?? "",
      "customer.name": values.customer?.name ?? "",
      "customer.email": values.customer?.email ?? "",
      "receipt.number": values.receipt?.number?.trim() || nextNumber || "",
      "receipt.date": values.receipt?.date ?? "",
      "receipt.payment_method": values.receipt?.payment_method ?? "",
      "receipt.currency": (values.receipt?.currency ?? "").toUpperCase(),
      "receipt.notes": values.receipt?.notes ?? "",
      ...Object.fromEntries(Object.entries(values.custom ?? {}).map(([k, v]) => [CUSTOM_PREFIX + k, v])),
    },
    rows: items.map((item) => ({ ...item, line_total: lineTotal(item) })),
    totals: computed
      ? { subtotal: computed.subtotal, tax: computed.tax, discount: computed.discount, total: computed.total }
      : { subtotal: PENDING, tax: PENDING, discount: PENDING, total: PENDING },
    computed,
  };
}

// The stored receipt, as the server computed it
export function previewFromReceipt(receipt: ReceiptRecord): PreviewData {
  const { data } = receipt;
  return {
    values: {
      "business.name": data.business.name ?? "",
      "customer.name": data.customer.name ?? "",
      "customer.email": data.customer.email ?? "",
      "receipt.number": receipt.receipt_number,
      "receipt.date": data.receipt.date ?? "",
      "receipt.payment_method": data.receipt.payment_method ?? "",
      "receipt.currency": data.receipt.currency,
      "receipt.notes": data.receipt.notes ?? "",
      ...Object.fromEntries(Object.entries(data.custom).map(([k, v]) => [CUSTOM_PREFIX + k, v])),
    },
    rows: data.items,
    totals: data.computed,
    computed: null,
  };
}
