// GST tax invoices (CGST Rules 2017, rule 46) for regular taxpayers with an
// aggregate turnover up to Rs 5 crore (no e-invoice IRN needed). Mirrors
// backend app/services/gst_service.py; both are checked against
// shared/fixtures/gst_cases.json. Not legal advice.
//   - within one state: CGST + SGST at half the rate each (UTGST in Union
//     territories without a legislature); between states: IGST at the full rate
//   - per line: taxable value = round(qty * unit price) - discount; each tax is
//     rounded half-up to the paisa, then summed
import type { CanvasElement } from "../schema/templateSchema";
import { extractVariables } from "./variables";
import { formatCents, multiply, parseDecimal, toCents } from "./money";

// GST state / UT codes (the first two digits of a GSTIN)
export const STATES: Record<string, string> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
  "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
  "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra", "29": "Karnataka",
  "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
  "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
  "97": "Other Territory",
};
const UTGST_STATES = new Set(["04", "26", "31", "35", "38"]);

// For <select>s, alphabetical
export const STATE_OPTIONS = Object.entries(STATES)
  .map(([code, name]) => ({ value: code, label: `${name} (${code})` }))
  .sort((a, b) => a.label.localeCompare(b.label));

export const stateLabel = (code: string) => (STATES[code] ? `${STATES[code]} (${code})` : "");

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const GSTIN_LENGTH = 15;
export const HSN_PATTERN = /^(\d{4}|\d{6}|\d{8})$/;
export const INVOICE_NUMBER_PATTERN = /^[A-Za-z0-9/-]{1,16}$/;
export const INVOICE_PREFIX_PATTERN = /^[A-Za-z0-9/-]{0,6}$/;
export const INVOICE_PREFIX_MAX_LENGTH = 6;
export const MAX_GST_RATE = 40;
export const UNIT_MAX_LENGTH = 8;
// Rule 46(e): an unregistered buyer's details are required from this taxable value
export const UNREGISTERED_DETAILS_THRESHOLD = 50000;
export const UNREGISTERED = "Unregistered";

// Suggestions only: since 22 Sept 2025 most goods are 5% or 18%, sin goods 40%,
// with a few special rates; the rate for an item depends on its HSN/SAC entry
export const COMMON_GST_RATES = ["0", "5", "18", "40", "3", "0.25"];
// Common Unique Quantity Codes (rule 46(h))
export const COMMON_UNITS = ["NOS", "PCS", "KGS", "GMS", "LTR", "MLT", "MTR", "BOX", "BAG", "BTL", "DOZ", "PAC", "SET", "PRS", "UNT"];

function gstinCheckChar(first14: string): string {
  let total = 0;
  for (let i = 0; i < first14.length; i++) {
    const value = GSTIN_CHARS.indexOf(first14[i]) * (i % 2 ? 2 : 1);
    total += Math.floor(value / 36) + (value % 36);
  }
  return GSTIN_CHARS[(36 - (total % 36)) % 36];
}

// Why this isn't a valid GSTIN, or null
export function gstinProblem(gstin: string): string | null {
  if (!GSTIN_PATTERN.test(gstin)) return "A GSTIN is 15 characters, like 27AAPFU0939F1ZV.";
  if (!STATES[gstin.slice(0, 2)]) return `${gstin.slice(0, 2)} isn't a GST state code.`;
  if (gstinCheckChar(gstin.slice(0, 14)) !== gstin[14]) return "This GSTIN's last character doesn't match; check it for a typo.";
  return null;
}

// The holder's state, for a valid GSTIN
export const gstinState = (gstin: string) => (gstinProblem(gstin) === null ? gstin.slice(0, 2) : null);

export type Supply = "intra" | "inter";
export const stateTaxLabel = (supplierState: string) => (UTGST_STATES.has(supplierState) ? "UTGST" : "SGST");
export const supplyType = (supplierState: string, placeOfSupply: string): Supply =>
  supplierState === placeOfSupply ? "intra" : "inter";

// The calendar year the Indian financial year (April to March) starts in
export function financialYear(isoDate: string): number {
  const [year, month] = isoDate.split("-").map(Number);
  return month >= 4 ? year : year - 1;
}

const twoDigits = (n: number) => String(n % 100).padStart(2, "0");
export const financialYearLabel = (startYear: number) => `${twoDigits(startYear)}-${twoDigits(startYear + 1)}`;
export const formatInvoiceNumber = (prefix: string, startYear: number, seq: number) =>
  `${prefix}${financialYearLabel(startYear)}/${String(seq).padStart(4, "0")}`;

// "18" -> "18%", "2.50" -> "2.5%"
export const formatRate = (rate: string) => `${Number(rate)}%`;

export interface GstLineInput {
  qty: string;
  unit_price: string;
  discount: string;
  gst_rate: string; // percent
}

export interface GstLine {
  amount: string;
  taxable_value: string;
  cgst: string;
  sgst: string;
  igst: string;
  tax: string;
}

export interface GstTotals {
  supply: Supply;
  state_tax_label: "SGST" | "UTGST";
  lines: GstLine[];
  subtotal: string;
  discount: string;
  taxable: string;
  cgst: string;
  sgst: string;
  igst: string;
  tax: string;
  total: string;
}

export type GstTotalsResult =
  | { ok: true; totals: GstTotals }
  | { ok: false; error: "INVALID_NUMBER" | "LINE_DISCOUNT_TOO_LARGE"; index: number };

// cents * rate% / divisor, rounded half-up to whole cents
function taxCents(taxableCents: bigint, rate: { units: bigint; scale: number }, divisor: bigint): bigint {
  const denominator = divisor * 100n * 10n ** BigInt(rate.scale);
  return (taxableCents * rate.units * 2n + denominator) / (2n * denominator);
}

export function computeGstTotals(lines: GstLineInput[], supplierState: string, placeOfSupply: string): GstTotalsResult {
  const supply = supplyType(supplierState, placeOfSupply);
  const computed: { amount: bigint; taxable: bigint; cgst: bigint; sgst: bigint; igst: bigint }[] = [];
  for (const [index, line] of lines.entries()) {
    const [qty, price, discount, rate] = [line.qty, line.unit_price, line.discount, line.gst_rate].map(parseDecimal);
    if (!qty || !price || !discount || !rate) return { ok: false, error: "INVALID_NUMBER", index };
    const amount = toCents(multiply(qty, price));
    const discountCents = toCents(discount);
    if (discountCents > amount) return { ok: false, error: "LINE_DISCOUNT_TOO_LARGE", index };
    const taxable = amount - discountCents;
    if (supply === "intra") {
      const half = taxCents(taxable, rate, 2n);
      computed.push({ amount, taxable, cgst: half, sgst: half, igst: 0n });
    } else {
      computed.push({ amount, taxable, cgst: 0n, sgst: 0n, igst: taxCents(taxable, rate, 1n) });
    }
  }
  const sum = (pick: (c: (typeof computed)[number]) => bigint) => computed.reduce((total, c) => total + pick(c), 0n);
  const taxable = sum((c) => c.taxable);
  const [cgst, sgst, igst] = [sum((c) => c.cgst), sum((c) => c.sgst), sum((c) => c.igst)];
  return {
    ok: true,
    totals: {
      supply,
      state_tax_label: stateTaxLabel(supplierState),
      lines: computed.map((c) => ({
        amount: formatCents(c.amount),
        taxable_value: formatCents(c.taxable),
        cgst: formatCents(c.cgst),
        sgst: formatCents(c.sgst),
        igst: formatCents(c.igst),
        tax: formatCents(c.cgst + c.sgst + c.igst),
      })),
      subtotal: formatCents(sum((c) => c.amount)),
      discount: formatCents(sum((c) => c.amount - c.taxable)),
      taxable: formatCents(taxable),
      cgst: formatCents(cgst),
      sgst: formatCents(sgst),
      igst: formatCents(igst),
      tax: formatCents(cgst + sgst + igst),
      total: formatCents(taxable + cgst + sgst + igst),
    },
  };
}

// --- Templates: what a GST invoice must show (rule 46) ------------------------------

export const REQUIRED_VARIABLES: Record<string, string> = {
  "business.name": "Your business name",
  "business.address": "Your business address",
  "business.gstin": "Your GSTIN",
  "receipt.number": "Invoice number",
  "receipt.date": "Invoice date",
  "customer.name": "Customer name",
  "customer.address": "Customer address",
  "customer.gstin": "Customer GSTIN",
  "receipt.place_of_supply": "Place of supply (state)",
  "receipt.reverse_charge": "Reverse charge (Yes / No)",
};
export const REQUIRED_COLUMNS: Record<string, string> = {
  description: "Item description column",
  hsn: "HSN / SAC column",
  qty: "Quantity (with unit) column",
  gst_rate: "GST rate column",
  taxable_value: "Taxable value column",
};
export const REQUIRED_TOTALS: Record<string, string> = {
  taxable: "Taxable value total",
  tax: "Tax lines (CGST + SGST, or IGST)",
  total: "Invoice total",
};
export const SIGNATURE_REQUIREMENT = "Signature";

// Just what the check reads, so it works on canvases and fixtures alike
type ParticularsElement = Pick<CanvasElement, "type"> & { props: unknown };

const textVariables = (elements: ParticularsElement[]) =>
  // Printed text only: a QR code doesn't show anything to the reader
  new Set(extractVariables({ elements: elements.filter((e) => e.type === "text") as CanvasElement[] }));

// What a GST invoice template still lacks, as readable names (empty = compliant)
export function missingParticulars(elements: ParticularsElement[]): string[] {
  const used = textVariables(elements);
  const missing = Object.entries(REQUIRED_VARIABLES).filter(([key]) => !used.has(key)).map(([, label]) => label);

  const table = elements.find((e) => e.type === "items_table");
  const columns = new Set(((table?.props as { columns?: { key: string }[] })?.columns ?? []).map((c) => c.key));
  missing.push(...Object.entries(REQUIRED_COLUMNS).filter(([key]) => !columns.has(key)).map(([, label]) => label));

  const totals = elements.find((e) => e.type === "totals");
  const shown = new Set((totals?.props as { show?: string[] })?.show ?? []);
  missing.push(...Object.entries(REQUIRED_TOTALS).filter(([key]) => !shown.has(key)).map(([, label]) => label));

  if (!elements.some((e) => e.type === "signature")) missing.push(SIGNATURE_REQUIREMENT);
  return missing;
}

// What deleting this element would take off a GST invoice (empty = safe to delete)
export function particularsLostWithout(elements: CanvasElement[], id: string): string[] {
  const before = new Set(missingParticulars(elements));
  return missingParticulars(elements.filter((e) => e.id !== id)).filter((label) => !before.has(label));
}
