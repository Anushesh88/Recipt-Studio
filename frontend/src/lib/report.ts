// Sales report helpers: the period presets and the CSV download
import type { SalesReport } from "../api/reports";

export interface Period {
  start: string;
  end: string;
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Indian financial years run April to March
export const PERIOD_PRESETS: { id: string; label: string; period: (today: Date) => Period }[] = [
  { id: "today", label: "Today", period: (t) => ({ start: iso(t), end: iso(t) }) },
  { id: "this-month", label: "This month", period: (t) => ({ start: iso(new Date(t.getFullYear(), t.getMonth(), 1)), end: iso(new Date(t.getFullYear(), t.getMonth() + 1, 0)) }) },
  { id: "last-month", label: "Last month", period: (t) => ({ start: iso(new Date(t.getFullYear(), t.getMonth() - 1, 1)), end: iso(new Date(t.getFullYear(), t.getMonth(), 0)) }) },
  { id: "last-30", label: "Last 30 days", period: (t) => ({ start: iso(new Date(t.getFullYear(), t.getMonth(), t.getDate() - 29)), end: iso(t) }) },
  {
    id: "this-fy", label: "This financial year",
    period: (t) => {
      const startYear = t.getMonth() >= 3 ? t.getFullYear() : t.getFullYear() - 1;
      return { start: iso(new Date(startYear, 3, 1)), end: iso(new Date(startYear + 1, 2, 31)) };
    },
  },
];

// Whole numbers without decimals, others as stored ("2", "1.5")
export const formatQuantity = (qty: string) => String(Number(qty));

const cell = (value: string | number) => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

// The table and totals as CSV, for Excel / Google Sheets
export function reportCsv(report: SalesReport): string {
  const { totals } = report;
  const otherTax = (Number(totals.tax) - Number(totals.cgst) - Number(totals.sgst) - Number(totals.igst)).toFixed(2);
  const rows: (string | number)[][] = [
    [`Sales report ${report.start} to ${report.end}`, "", "", "", report.currency ?? ""],
    ["Item", "Unit", "Quantity sold", "On receipts", "Amount"],
    ...report.items.map((i) => [i.description, i.unit ?? "", formatQuantity(i.quantity), i.receipts, i.amount]),
    [],
    ["Receipts", "", "", "", report.receipt_count],
    ["Subtotal", "", "", "", totals.subtotal],
    ["Discount", "", "", "", totals.discount],
    ["Taxable value", "", "", "", totals.taxable],
    ["CGST", "", "", "", totals.cgst],
    ["SGST / UTGST", "", "", "", totals.sgst],
    ["IGST", "", "", "", totals.igst],
    ["Other tax", "", "", "", otherTax],
    ["Total tax", "", "", "", totals.tax],
    ["Total sales", "", "", "", totals.total],
  ];
  return rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
