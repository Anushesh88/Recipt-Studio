// Receipt money for the live preview. The server recomputes everything on save
// (backend totals_service) and its numbers are the ones stored; this mirrors the
// same rules with exact decimal arithmetic (scaled BigInts, never floats), and
// both are checked against shared/fixtures/totals_cases.json.
//   line_total = round(qty * unit_price); subtotal = sum; taxable = subtotal - discount
//   tax = round(taxable * tax_rate); total = taxable + tax   (round = half-up to cents)
// The subtotal and total may not exceed MAX_AMOUNT (receipts.total_amount NUMERIC(12, 2)).

import { MAX_AMOUNT, MONEY_DECIMAL_PLACES as CENT_SCALE } from "./units";

const DECIMAL = /^\d+(\.\d+)?$/;

interface Scaled {
  units: bigint;
  scale: number;
}

const pow10 = (n: number) => 10n ** BigInt(n);

export function parseDecimal(text: string): Scaled | null {
  const trimmed = text.trim();
  if (!DECIMAL.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  return { units: BigInt(whole + fraction), scale: fraction.length };
}

const multiply = (a: Scaled, b: Scaled): Scaled => ({ units: a.units * b.units, scale: a.scale + b.scale });

// Non-negative value rounded half-up to whole cents
function toCents({ units, scale }: Scaled): bigint {
  if (scale <= CENT_SCALE) return units * pow10(CENT_SCALE - scale);
  const divisor = pow10(scale - CENT_SCALE);
  return (units + divisor / 2n) / divisor;
}

function formatScaled(units: bigint, scale: number): string {
  if (scale === 0) return units.toString();
  const digits = units.toString().padStart(scale + 1, "0");
  return `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

export const formatCents = (cents: bigint) => formatScaled(cents, CENT_SCALE);

// "8.25" (%) -> "0.0825"; null if not a plain non-negative number
export function percentToFraction(percent: string): string | null {
  const parsed = parseDecimal(percent);
  return parsed ? formatScaled(parsed.units, parsed.scale + 2) : null;
}

export interface MoneyLine {
  qty: string;
  unit_price: string;
}

export interface Totals {
  lineTotals: string[];
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
}

export type TotalsResult =
  | { ok: true; totals: Totals }
  | { ok: false; error: "INVALID_NUMBER" | "DISCOUNT_TOO_LARGE" | "AMOUNT_TOO_LARGE" };

export function computeTotals(items: MoneyLine[], taxRate: string, discount: string): TotalsResult {
  const lines = items.map((i) => [parseDecimal(i.qty), parseDecimal(i.unit_price)] as const);
  const rate = parseDecimal(taxRate);
  const discountValue = parseDecimal(discount);
  if (!rate || !discountValue || lines.some(([q, p]) => !q || !p)) return { ok: false, error: "INVALID_NUMBER" };

  const lineCents = lines.map(([q, p]) => toCents(multiply(q!, p!)));
  const subtotal = lineCents.reduce((sum, c) => sum + c, 0n);
  const discountCents = toCents(discountValue);
  if (discountCents > subtotal) return { ok: false, error: "DISCOUNT_TOO_LARGE" };
  const taxable = subtotal - discountCents;
  const tax = toCents(multiply({ units: taxable, scale: CENT_SCALE }, rate));
  const maxCents = toCents(parseDecimal(MAX_AMOUNT)!);
  if (subtotal > maxCents || taxable + tax > maxCents) return { ok: false, error: "AMOUNT_TOO_LARGE" };

  return {
    ok: true,
    totals: {
      lineTotals: lineCents.map(formatCents),
      subtotal: formatCents(subtotal),
      discount: formatCents(discountCents),
      tax: formatCents(tax),
      total: formatCents(taxable + tax),
    },
  };
}
