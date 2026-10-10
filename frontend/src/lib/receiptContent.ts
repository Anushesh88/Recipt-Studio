// What the items table and totals show for a receipt: mirrors item_cells,
// totals_values and tax_rows in backend app/services/export_service.py.
import type { ComputedTotals } from "../api/receipts";
import { DEFAULT_TAX_ROWS, type TaxRow } from "./elementLayout";
import { formatRate } from "./gst";
import { formatCents, parseDecimal, toCents } from "./money";

const cents = (amount: string) => {
  const parsed = parseDecimal(amount);
  return parsed ? toCents(parsed) : 0n;
};

export type Cells = Record<string, string>;

export interface ItemForCells {
  description: string;
  qty: string;
  unit_price: string;
  line_total: string;
  hsn?: string | null;
  unit?: string | null;
  discount?: string | null;
  taxable_value?: string | null;
  gst_rate?: string | null;
  tax_amount?: string | null;
}

const isZero = (amount: string) => Number(amount) === 0;

// A line item as table cells, keyed like the columns; blanks print as "-"
export function itemCells(item: ItemForCells): Cells {
  return {
    description: item.description,
    qty: item.unit ? `${item.qty} ${item.unit}` : item.qty,
    unit_price: item.unit_price,
    line_total: item.line_total,
    hsn: item.hsn ?? "",
    discount: item.discount && !isZero(item.discount) ? item.discount : "",
    taxable_value: item.taxable_value ?? "",
    gst_rate: item.gst_rate ? formatRate(item.gst_rate) : "",
    tax_amount: item.tax_amount ?? "",
  };
}

export function totalsValues(computed: ComputedTotals): Cells {
  const values: Cells = {
    subtotal: computed.subtotal,
    discount: computed.discount,
    taxable: formatCents(cents(computed.subtotal) - cents(computed.discount)),
    tax: computed.tax,
    total: computed.total,
  };
  const { gst } = computed;
  return gst ? { ...values, taxable: gst.taxable, cgst: gst.cgst, sgst: gst.sgst, igst: gst.igst } : values;
}

// CGST + SGST (or UTGST) within a state, IGST between states, else one Tax line
export function taxRows(gst: Pick<NonNullable<ComputedTotals["gst"]>, "supply" | "state_tax_label"> | null | undefined): TaxRow[] {
  if (!gst) return DEFAULT_TAX_ROWS;
  return gst.supply === "intra"
    ? [{ key: "cgst", label: "CGST" }, { key: "sgst", label: gst.state_tax_label }]
    : [{ key: "igst", label: "IGST" }];
}
