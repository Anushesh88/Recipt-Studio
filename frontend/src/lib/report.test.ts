import { describe, it, expect } from "vitest";
import { PERIOD_PRESETS, reportCsv } from "./report";
import type { SalesReport } from "../api/reports";

const period = (id: string, today: Date) => PERIOD_PRESETS.find((p) => p.id === id)!.period(today);

describe("report periods", () => {
  it("covers the usual ranges, with April-March financial years", () => {
    const oct11 = new Date(2026, 9, 11);
    expect(period("today", oct11)).toEqual({ start: "2026-10-11", end: "2026-10-11" });
    expect(period("this-month", oct11)).toEqual({ start: "2026-10-01", end: "2026-10-31" });
    expect(period("last-month", oct11)).toEqual({ start: "2026-09-01", end: "2026-09-30" });
    expect(period("last-30", oct11)).toEqual({ start: "2026-09-12", end: "2026-10-11" });
    expect(period("this-fy", oct11)).toEqual({ start: "2026-04-01", end: "2027-03-31" });
    expect(period("this-fy", new Date(2027, 1, 5))).toEqual({ start: "2026-04-01", end: "2027-03-31" });
    expect(period("last-month", new Date(2026, 0, 15))).toEqual({ start: "2025-12-01", end: "2025-12-31" });
  });
});

describe("report CSV", () => {
  it("lists the items, then the totals, quoting where needed", () => {
    const report: SalesReport = {
      start: "2026-10-01", end: "2026-10-31", document_type: null, currency: "INR", currencies: ["INR"], receipt_count: 2,
      items: [{ description: 'Tea, "special"', unit: "CUP", quantity: "3.000", amount: "60.00", receipts: 2 }],
      totals: { subtotal: "60.00", discount: "0.00", taxable: "60.00", tax: "3.00", cgst: "1.00", sgst: "1.00", igst: "0.00", total: "63.00" },
    };
    const lines = reportCsv(report).split("\r\n");
    expect(lines.slice(0, 3)).toEqual(["Sales report 2026-10-01 to 2026-10-31,,,,INR", "Item,Unit,Quantity sold,On receipts,Amount", '"Tea, ""special""",CUP,3,2,60.00']);
    expect(lines).toContain("Other tax,,,,1.00");
    expect(lines).toContain("Total sales,,,,63.00");
  });
});
