import { describe, it, expect } from "vitest";
import { computeTotals, formatCents, parseDecimal, percentToFraction } from "./money";

describe("money", () => {
  it("parses plain non-negative decimals only", () => {
    expect(parseDecimal(" 4.50 ")).toEqual({ units: 450n, scale: 2 });
    for (const bad of ["", "-1", "1e3", "1.", ".5", "1,5", "abc"]) expect(parseDecimal(bad)).toBeNull();
  });

  it("converts a tax percentage to the fraction the API expects", () => {
    expect(percentToFraction("8")).toBe("0.08");
    expect(percentToFraction("8.25")).toBe("0.0825");
    expect(percentToFraction("100")).toBe("1.00");
    expect(percentToFraction("0")).toBe("0.00");
    expect(percentToFraction("eight")).toBeNull();
  });

  it("formats cents", () => {
    expect(formatCents(0n)).toBe("0.00");
    expect(formatCents(5n)).toBe("0.05");
    expect(formatCents(123456n)).toBe("1234.56");
  });

  it("reports unparseable input instead of guessing", () => {
    expect(computeTotals([{ qty: "two", unit_price: "1.00" }], "0", "0")).toEqual({ ok: false, error: "INVALID_NUMBER" });
    expect(computeTotals([], "abc", "0")).toEqual({ ok: false, error: "INVALID_NUMBER" });
  });
});
