// The Generate form, derived from the template (Architecture frontend rule 11):
// built-in variables the template uses become named fields, custom.* ones text
// fields labelled from their key, plus the line items, tax and discount.
// GST tax invoices (documentType "gst_invoice") instead ask for the buyer's
// details, place of supply and per-item HSN / GST rate, under rule 46's rules
// (mirrors backend receipt_service).
import { z } from "zod";
import type { Canvas } from "../../schema/templateSchema";
import type { Account } from "../../api/account";
import type { LineItemInput, ReceiptDataInput, ReceiptRecord } from "../../api/receipts";
import {
  CUSTOM_PREFIX,
  extractVariables,
  findVariables,
  resolveVariables,
  variableKind,
  variableLabel,
  type VariableValues,
} from "../../lib/variables";
import { computeTotals, fractionToPercent, percentToFraction } from "../../lib/money";
import {
  HSN_PATTERN,
  MAX_GST_RATE,
  STATES,
  UNIT_MAX_LENGTH,
  UNREGISTERED,
  UNREGISTERED_DETAILS_THRESHOLD,
  computeGstTotals,
  gstinProblem,
  stateLabel,
  type GstLineInput,
} from "../../lib/gst";
import { itemCells, taxRows, totalsValues, type Cells } from "../../lib/receiptContent";
import type { TaxRow } from "../../lib/elementLayout";
import { qrFits } from "../../lib/qr";
import {
  CUSTOM_VALUE_MAX_LENGTH,
  DEFAULT_CURRENCY,
  MAX_AMOUNT,
  MAX_LINE_ITEMS,
  MAX_QTY,
  NOTES_MAX_LENGTH,
  PAYMENT_METHOD_MAX_LENGTH,
  RECEIPT_NUMBER_MAX_LENGTH,
  SHORT_TEXT_MAX_LENGTH,
} from "../../lib/units";

export const GST_CURRENCY = "INR";
export const ADDRESS_MAX_LENGTH = 300;

export interface LineItemValues {
  description: string;
  qty: string;
  unit_price: string;
  // GST invoices only
  hsn: string;
  unit: string;
  discount: string;
  gst_rate: string; // percent
}

export interface GenerateValues {
  business: { name: string };
  customer: { name: string; email: string; address: string; gstin: string };
  receipt: {
    number: string;
    date: string;
    payment_method: string;
    currency: string;
    notes: string;
    place_of_supply: string; // GST state code
    reverse_charge: boolean;
  };
  custom: Record<string, string>;
  items: LineItemValues[];
  tax_percent: string;
  discount: string;
}

// Built-ins that get a field only when the template uses them. The receipt
// number and currency are always asked for (blank number = automatic). The
// business address and GSTIN come from Settings, never the form.
export const BUILTIN_FIELDS = [
  "business.name",
  "customer.name",
  "customer.email",
  "customer.gstin",
  "customer.address",
  "receipt.date",
  "receipt.payment_method",
  "receipt.place_of_supply",
  "receipt.reverse_charge",
  "receipt.notes",
] as const;
export type BuiltinField = (typeof BUILTIN_FIELDS)[number];

// The buyer and invoice details a GST invoice form always has
export const GST_PARTY_FIELDS: BuiltinField[] = [
  "customer.name", "customer.gstin", "customer.address", "receipt.place_of_supply", "receipt.reverse_charge",
];

const OPTIONAL_FIELDS = new Set<string>(["receipt.notes", "receipt.reverse_charge"]); // backend OPTIONAL_VARIABLES
// On a GST invoice the buyer's details are required only by the rules in
// superRefine (registered buyer, or unregistered at Rs 50,000 or more)
const GST_OPTIONAL_FIELDS = new Set<string>([...OPTIONAL_FIELDS, "customer.name", "customer.address", "customer.gstin"]);

// Longest value the server takes for each text field (backend schemas/receipt.py)
export const FIELD_MAX_LENGTH: Record<string, number> = {
  "business.name": SHORT_TEXT_MAX_LENGTH,
  "customer.name": SHORT_TEXT_MAX_LENGTH,
  "customer.address": ADDRESS_MAX_LENGTH,
  "customer.gstin": 15,
  "receipt.payment_method": PAYMENT_METHOD_MAX_LENGTH,
  "receipt.notes": NOTES_MAX_LENGTH,
  "receipt.number": RECEIPT_NUMBER_MAX_LENGTH,
};

export interface FormModel {
  gst: boolean;
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

const atMost = (max: number) => [max, `Use at most ${max} characters`] as const;
const required = (label: string, max: number) => z.string().trim().min(1, `${label} is required`).max(...atMost(max));

const formatAmount = (amount: string | number) => Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2 });
const withinMaxAmount = (v: string) => Number(v) <= Number(MAX_AMOUNT);
const AMOUNT_LIMIT_MESSAGE = `At most ${formatAmount(MAX_AMOUNT)}`;
const TOTAL_LIMIT_MESSAGE = `The total can't be more than ${formatAmount(MAX_AMOUNT)}`;
export const REQUIRED_ON_INVOICE = "Required on this GST invoice";

// Blank (an unregistered buyer) or a valid GSTIN, in any case
const gstinField = z
  .string()
  .trim()
  .toUpperCase()
  .superRefine((gstin, ctx) => {
    const problem = gstin === "" ? null : gstinProblem(gstin);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  });

const gstLines = (items: LineItemValues[]): GstLineInput[] =>
  items.map((i) => ({ qty: i.qty, unit_price: i.unit_price, discount: i.discount || "0", gst_rate: i.gst_rate || "0" }));

// The form's values as variable values (used by the preview and the QR check).
// The business address and GSTIN (and on a GST invoice the name) are the account's.
function formVariableValues(values: GenerateValues, receiptNumber: string, gst: boolean, account?: Account): VariableValues {
  const customer = values.customer ?? { name: "", email: "", address: "", gstin: "" };
  return {
    "business.name": (gst ? account?.business_name : values.business?.name) ?? "",
    "business.address": account?.business_address ?? "",
    "business.gstin": account?.gstin ?? "",
    "customer.name": customer.name ?? "",
    "customer.email": customer.email ?? "",
    "customer.address": customer.address ?? "",
    "customer.gstin": customer.gstin?.trim().toUpperCase() || (gst ? UNREGISTERED : ""),
    "receipt.number": receiptNumber,
    "receipt.date": values.receipt?.date ?? "",
    "receipt.payment_method": values.receipt?.payment_method ?? "",
    "receipt.currency": gst ? GST_CURRENCY : (values.receipt?.currency ?? "").toUpperCase(),
    "receipt.notes": values.receipt?.notes ?? "",
    "receipt.place_of_supply": stateLabel(values.receipt?.place_of_supply ?? ""),
    "receipt.reverse_charge": values.receipt?.reverse_charge ? "Yes" : "No",
    ...Object.fromEntries(Object.entries(values.custom ?? {}).map(([k, v]) => [CUSTOM_PREFIX + k, v])),
  };
}

export const today = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const emptyLineItem = (): LineItemValues => ({
  description: "", qty: "1", unit_price: "", hsn: "", unit: "", discount: "", gst_rate: "",
});

export function buildFormModel(canvas: Canvas): FormModel {
  const gst = canvas.documentType === "gst_invoice";
  const used = extractVariables(canvas);
  const usedSet = new Set(used);
  // GST invoices always ask for the buyer; their business name comes from Settings
  const builtinFields = BUILTIN_FIELDS.filter((key) =>
    gst ? key !== "business.name" && (usedSet.has(key) || GST_PARTY_FIELDS.includes(key)) : usedSet.has(key),
  );
  const customKeys = used.filter((key) => variableKind(key) === "custom").map((key) => key.slice(CUSTOM_PREFIX.length));
  const optional = gst ? GST_OPTIONAL_FIELDS : OPTIONAL_FIELDS;

  const maxLength = (key: string) => FIELD_MAX_LENGTH[key] ?? SHORT_TEXT_MAX_LENGTH;
  const isRequired = (key: BuiltinField) => usedSet.has(key) && !optional.has(key);
  const field = (key: BuiltinField) =>
    isRequired(key) ? required(variableLabel(key), maxLength(key)) : z.string().max(...atMost(maxLength(key)));
  const qrCodes = canvas.elements.filter((e) => e.type === "qr");

  const lineItem = z.object({
    description: required("Description", SHORT_TEXT_MAX_LENGTH),
    qty: z
      .string()
      .trim()
      .regex(QTY, "A number, up to 3 decimals")
      .refine((v) => Number(v) > 0, "More than 0")
      .refine((v) => Number(v) <= MAX_QTY, `At most ${MAX_QTY.toLocaleString("en-US")}`),
    unit_price: z.string().trim().regex(MONEY, "An amount like 4.50").refine(withinMaxAmount, AMOUNT_LIMIT_MESSAGE),
    ...(gst
      ? {
          hsn: z.string().trim().refine((v) => v === "" || HSN_PATTERN.test(v), "4, 6 or 8 digits"),
          unit: z.string().trim().max(UNIT_MAX_LENGTH, `At most ${UNIT_MAX_LENGTH} characters`),
          discount: z.string().trim().refine((v) => v === "" || MONEY.test(v), "An amount like 2.00"),
          gst_rate: z
            .string()
            .trim()
            .regex(PERCENT, "A rate like 5 or 18")
            .refine((v) => Number(v) <= MAX_GST_RATE, `At most ${MAX_GST_RATE}%`),
        }
      : { hsn: z.string(), unit: z.string(), discount: z.string(), gst_rate: z.string() }),
  });

  const schema = z
    .object({
      business: z.object({ name: gst ? z.string() : field("business.name") }),
      customer: z.object({
        name: field("customer.name"),
        email: usedSet.has("customer.email")
          ? required("Customer email", SHORT_TEXT_MAX_LENGTH).pipe(z.email("Enter a valid email address"))
          : z.string(),
        address: field("customer.address"),
        gstin: isRequired("customer.gstin") ? required(variableLabel("customer.gstin"), 15).pipe(gstinField) : gstinField,
      }),
      receipt: z.object({
        number: z.string().trim().max(...atMost(RECEIPT_NUMBER_MAX_LENGTH)),
        date: usedSet.has("receipt.date") || gst
          ? required(gst ? "Invoice date" : "Receipt date", SHORT_TEXT_MAX_LENGTH).regex(ISO_DATE, "Pick a date")
          : z.string(),
        payment_method: field("receipt.payment_method"),
        currency: gst ? z.string() : z.string().trim().regex(CURRENCY, "Use a 3-letter currency code, e.g. USD"),
        notes: z.string().max(...atMost(NOTES_MAX_LENGTH)),
        place_of_supply: usedSet.has("receipt.place_of_supply") || gst
          ? z.string().refine((code) => code in STATES, "Pick the state of supply")
          : z.string(),
        reverse_charge: z.boolean(),
      }),
      custom: z.object(
        Object.fromEntries(customKeys.map((key) => [key, required(variableLabel(CUSTOM_PREFIX + key), CUSTOM_VALUE_MAX_LENGTH)])),
      ),
      items: z
        .array(lineItem)
        .max(MAX_LINE_ITEMS, `At most ${MAX_LINE_ITEMS} items`)
        .refine((list) => !gst || list.length > 0, "A GST invoice needs at least one item"),
      tax_percent: gst
        ? z.string()
        : z.string().trim().regex(PERCENT, "A percentage like 8 or 8.25").refine((v) => Number(v) <= 100, "At most 100%"),
      discount: gst ? z.string() : z.string().trim().regex(MONEY, "An amount like 2.00").refine(withinMaxAmount, AMOUNT_LIMIT_MESSAGE),
    })
    .superRefine((values, ctx) => {
      if (gst) {
        // The tax split doesn't change the taxable value, so any states will do here
        const result = computeGstTotals(gstLines(values.items), "", "");
        if (!result.ok && result.error === "LINE_DISCOUNT_TOO_LARGE") {
          ctx.addIssue({ code: "custom", path: ["items", result.index, "discount"], message: "More than the item's amount" });
        }
        if (result.ok) {
          if (Number(result.totals.subtotal) > Number(MAX_AMOUNT) || Number(result.totals.total) > Number(MAX_AMOUNT)) {
            ctx.addIssue({ code: "custom", path: ["items"], message: TOTAL_LIMIT_MESSAGE });
          }
          // Rule 46(d) / (e): who the buyer is must be on the invoice when they're
          // registered, or unregistered from a taxable value of Rs 50,000
          const registered = values.customer.gstin.trim() !== "";
          if (registered || Number(result.totals.taxable) >= UNREGISTERED_DETAILS_THRESHOLD) {
            for (const key of ["name", "address"] as const) {
              if (!values.customer[key].trim()) ctx.addIssue({ code: "custom", path: ["customer", key], message: REQUIRED_ON_INVOICE });
            }
          }
          if (registered) {
            values.items.forEach((item, index) => {
              if (!item.hsn.trim()) ctx.addIssue({ code: "custom", path: ["items", index, "hsn"], message: "HSN/SAC is required for a registered buyer" });
            });
          }
        }
      } else {
        const result = computeTotals(values.items, percentToFraction(values.tax_percent) ?? "0", values.discount);
        if (!result.ok && result.error === "DISCOUNT_TOO_LARGE") {
          ctx.addIssue({ code: "custom", path: ["discount"], message: "The discount can't be more than the subtotal" });
        }
        if (!result.ok && result.error === "AMOUNT_TOO_LARGE") {
          ctx.addIssue({ code: "custom", path: ["items"], message: TOTAL_LIMIT_MESSAGE });
        }
      }
      // A QR code holds limited text: flag the fields of any that overflow once
      // filled in (the server re-checks with the final receipt number)
      const filled = formVariableValues(values, values.receipt.number.trim(), gst);
      for (const qr of qrCodes) {
        if (qrFits(resolveVariables(qr.props.content, filled), qr.props.errorCorrection)) continue;
        for (const key of new Set(findVariables(qr.props.content))) {
          ctx.addIssue({ code: "custom", path: key.split("."), message: "Too long for the QR code" });
        }
      }
    }) as unknown as z.ZodType<GenerateValues, GenerateValues>;

  return {
    gst,
    builtinFields,
    customKeys,
    schema,
    defaults: {
      business: { name: "" },
      customer: { name: "", email: "", address: "", gstin: "" },
      receipt: {
        number: "", date: today(), payment_method: "", currency: gst ? GST_CURRENCY : DEFAULT_CURRENCY, notes: "",
        place_of_supply: "", reverse_charge: false,
      },
      custom: Object.fromEntries(customKeys.map((key) => [key, ""])),
      items: [emptyLineItem()],
      tax_percent: "0",
      discount: "0.00",
    },
  };
}

const orNull = (value: string) => value.trim() || null;

export function toPayload(values: GenerateValues, model: Pick<FormModel, "customKeys" | "gst">): ReceiptDataInput {
  const { gst } = model;
  const item = (i: LineItemValues): LineItemInput => {
    const base = { description: i.description.trim(), qty: i.qty.trim(), unit_price: i.unit_price.trim() };
    return gst
      ? { ...base, hsn: orNull(i.hsn), unit: orNull(i.unit)?.toUpperCase() ?? null, discount: i.discount.trim() || "0", gst_rate: i.gst_rate.trim() }
      : base;
  };
  return {
    business: { name: orNull(values.business.name) },
    customer: {
      name: orNull(values.customer.name),
      email: orNull(values.customer.email),
      address: orNull(values.customer.address),
      gstin: orNull(values.customer.gstin)?.toUpperCase() ?? null,
    },
    receipt: {
      number: orNull(values.receipt.number),
      date: orNull(values.receipt.date),
      payment_method: orNull(values.receipt.payment_method),
      currency: gst ? GST_CURRENCY : values.receipt.currency.trim().toUpperCase(),
      notes: orNull(values.receipt.notes),
      place_of_supply: orNull(values.receipt.place_of_supply),
      reverse_charge: values.receipt.reverse_charge,
    },
    custom: Object.fromEntries(model.customKeys.map((key) => [key, values.custom[key]?.trim() ?? ""])),
    items: values.items.map(item),
    tax_rate: gst ? "0" : percentToFraction(values.tax_percent) ?? "0",
    discount: gst ? "0" : values.discount.trim() || "0",
  };
}

// "Use again": a new receipt pre-filled from a stored one (new number and date)
export function valuesFromReceipt(receipt: ReceiptRecord, model: FormModel): GenerateValues {
  const { data } = receipt;
  return {
    business: { name: data.business.name ?? "" },
    customer: {
      name: data.customer.name ?? "",
      email: data.customer.email ?? "",
      address: data.customer.address ?? "",
      gstin: data.customer.gstin ?? "",
    },
    receipt: {
      ...model.defaults.receipt,
      payment_method: data.receipt.payment_method ?? "",
      currency: model.gst ? GST_CURRENCY : data.receipt.currency,
      notes: data.receipt.notes ?? "",
      place_of_supply: data.receipt.place_of_supply ?? "",
      reverse_charge: data.receipt.reverse_charge ?? false,
    },
    custom: Object.fromEntries(model.customKeys.map((key) => [key, data.custom[key] ?? ""])),
    items: data.items.map((i) => ({
      description: i.description,
      qty: i.qty,
      unit_price: i.unit_price,
      hsn: i.hsn ?? "",
      unit: i.unit ?? "",
      discount: i.discount && Number(i.discount) !== 0 ? i.discount : "",
      gst_rate: i.gst_rate ? String(Number(i.gst_rate)) : "",
    })),
    tax_percent: fractionToPercent(data.tax_rate),
    discount: data.discount,
  };
}

export interface PreviewData {
  values: VariableValues;
  rows: Cells[];
  totals: Cells;
  taxRows: TaxRow[] | undefined;
}

const PENDING = "—";
const PENDING_TOTALS: Cells = {
  subtotal: PENDING, discount: PENDING, taxable: PENDING, tax: PENDING, total: PENDING, cgst: PENDING, sgst: PENDING, igst: PENDING,
};

function receiptPreview(values: GenerateValues): Pick<PreviewData, "rows" | "totals"> {
  const items = values.items ?? [];
  const result = computeTotals(items, percentToFraction(values.tax_percent ?? "") ?? "0", values.discount ?? "");
  const lineTotal = (item: LineItemValues) => {
    const one = computeTotals([item], "0", "0");
    return one.ok ? one.totals.subtotal : PENDING;
  };
  return {
    rows: items.map((item) => itemCells({ ...item, hsn: null, unit: null, discount: null, gst_rate: null, line_total: lineTotal(item) })),
    totals: result.ok
      ? totalsValues({ subtotal: result.totals.subtotal, tax: result.totals.tax, discount: result.totals.discount, total: result.totals.total })
      : PENDING_TOTALS,
  };
}

function gstPreview(values: GenerateValues, account: Account | undefined): Pick<PreviewData, "rows" | "totals" | "taxRows"> {
  const items = values.items ?? [];
  const supplierState = account?.gstin?.slice(0, 2) ?? "";
  const place = values.receipt?.place_of_supply || supplierState;
  const result = computeGstTotals(gstLines(items), supplierState, place);
  const rows = items.map((item, index) => {
    // A line with a number still being typed shows dashes; the others their amounts
    const one = result.ok ? { ok: true as const, line: result.totals.lines[index] } : (() => {
      const single = computeGstTotals(gstLines([item]), supplierState, place);
      return single.ok ? { ok: true as const, line: single.totals.lines[0] } : { ok: false as const };
    })();
    return itemCells({
      ...item,
      line_total: one.ok ? one.line.amount : PENDING,
      taxable_value: one.ok ? one.line.taxable_value : PENDING,
      tax_amount: one.ok ? one.line.tax : PENDING,
      unit: item.unit.trim().toUpperCase(),
    });
  });
  if (!result.ok) return { rows, totals: PENDING_TOTALS, taxRows: taxRows({ supply: supplierState === place ? "intra" : "inter", state_tax_label: "SGST" }) };
  const t = result.totals;
  return {
    rows,
    totals: totalsValues({
      subtotal: t.subtotal, tax: t.tax, discount: t.discount, total: t.total,
      gst: { supply: t.supply, state_tax_label: t.state_tax_label, taxable: t.taxable, cgst: t.cgst, sgst: t.sgst, igst: t.igst },
    }),
    taxRows: taxRows(t),
  };
}

// What the live preview shows for the current (possibly incomplete) form
export function previewFromForm(
  values: GenerateValues, nextNumber: string | null, gst: boolean, account: Account | undefined,
): PreviewData {
  const number = values.receipt?.number?.trim() || nextNumber || "";
  const content = gst ? gstPreview(values, account) : { ...receiptPreview(values), taxRows: undefined };
  return { values: formVariableValues(values, number, gst, account), ...content };
}

// The stored receipt, as the server computed it
export function previewFromReceipt(receipt: ReceiptRecord): PreviewData {
  const { data } = receipt;
  const gst = receipt.document_type === "gst_invoice";
  return {
    values: {
      "business.name": data.business.name ?? "",
      "business.address": data.business.address ?? "",
      "business.gstin": data.business.gstin ?? "",
      "customer.name": data.customer.name ?? "",
      "customer.email": data.customer.email ?? "",
      "customer.address": data.customer.address ?? "",
      "customer.gstin": data.customer.gstin || (gst ? UNREGISTERED : ""),
      "receipt.number": receipt.receipt_number,
      "receipt.date": data.receipt.date ?? "",
      "receipt.payment_method": data.receipt.payment_method ?? "",
      "receipt.currency": data.receipt.currency,
      "receipt.notes": data.receipt.notes ?? "",
      "receipt.place_of_supply": stateLabel(data.receipt.place_of_supply ?? ""),
      "receipt.reverse_charge": data.receipt.reverse_charge ? "Yes" : "No",
      ...Object.fromEntries(Object.entries(data.custom).map(([k, v]) => [CUSTOM_PREFIX + k, v])),
    },
    rows: data.items.map(itemCells),
    totals: totalsValues(data.computed),
    taxRows: gst ? taxRows(data.computed.gst) : undefined,
  };
}
