// Runs shared/fixtures (also run by the backend's pytest) against the frontend libs
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { applyLayout, type LayoutElement, type LayoutPage } from "../src/lib/layout";
import { extractVariables, findUnknownVariables, findVariables, resolveVariables } from "../src/lib/variables";
import { computeTotals } from "../src/lib/money";
import {
  computeGstTotals,
  financialYear,
  financialYearLabel,
  formatInvoiceNumber,
  gstinProblem,
  missingParticulars,
  type GstLineInput,
  type GstTotals,
} from "../src/lib/gst";
import type { CanvasElement } from "../src/schema/templateSchema";

const load = <T,>(name: string): T =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../../shared/fixtures/${name}`, import.meta.url)), "utf8")) as T;

interface LayoutFixtures {
  templates: Record<string, { page: LayoutPage; elements: LayoutElement[] }>;
  cases: {
    name: string;
    template: string;
    n_rows: number;
    expected: { delta: number; page_height: number; error: string | null; positions: Record<string, { y: number; height: number }> };
  }[];
}

describe("shared layout fixtures", () => {
  const { templates, cases } = load<LayoutFixtures>("layout_cases.json");
  it.each(cases)("$name", ({ template, n_rows, expected }) => {
    const { page, elements } = templates[template];
    const result = applyLayout(page, elements, n_rows);
    expect(result.delta).toBe(expected.delta);
    expect(result.pageHeight).toBe(expected.page_height);
    expect(result.error).toBe(expected.error);
    expect(Object.fromEntries(result.elements.map((e) => [e.id, { y: e.y, height: e.height }]))).toEqual(expected.positions);
  });
});

interface VariableFixtures {
  find: { text: string; variables: string[]; unknown: string[] }[];
  extract: { name: string; elements: unknown[]; variables: string[] }[];
  resolve: { text: string; values: Record<string, string>; resolved: string }[];
}

describe("shared variables fixtures", () => {
  const fixtures = load<VariableFixtures>("variables_cases.json");
  it.each(fixtures.find)("find: $text", ({ text, variables, unknown }) => {
    expect(findVariables(text)).toEqual(variables);
    expect(findUnknownVariables(text)).toEqual(unknown);
  });
  it.each(fixtures.extract)("extract: $name", ({ elements, variables }) => {
    expect(extractVariables({ elements: elements as CanvasElement[] })).toEqual(variables);
  });
  it.each(fixtures.resolve)("resolve: $text", ({ text, values, resolved }) => {
    expect(resolveVariables(text, values)).toBe(resolved);
  });
});

interface TotalsFixtures {
  cases: {
    name: string;
    items: { qty: string; unit_price: string }[];
    tax_rate: string;
    discount: string;
    expected?: { line_totals: string[]; subtotal: string; discount: string; tax: string; total: string };
    error?: string;
  }[];
}

describe("shared totals fixtures", () => {
  it.each(load<TotalsFixtures>("totals_cases.json").cases)("$name", ({ items, tax_rate, discount, expected, error }) => {
    const result = computeTotals(items, tax_rate, discount);
    if (error) {
      expect(result).toEqual({ ok: false, error });
      return;
    }
    expect(result.ok).toBe(true);
    if (!result.ok || !expected) return;
    expect(result.totals).toEqual({
      lineTotals: expected.line_totals,
      subtotal: expected.subtotal,
      discount: expected.discount,
      tax: expected.tax,
      total: expected.total,
    });
  });
});

interface GstFixtures {
  gstin: { gstin: string; problem: string | null }[];
  totals: {
    name: string;
    supplier_state: string;
    place_of_supply: string;
    lines: GstLineInput[];
    expected?: Omit<GstTotals, "lines" | "tax"> & { lines: Omit<GstTotals["lines"][number], "tax">[] };
    error?: string;
  }[];
  financial_year: { date: string; start_year: number; label: string }[];
  invoice_numbers: { prefix: string; start_year: number; seq: number; number: string }[];
  particulars: { name: string; elements: { type: CanvasElement["type"]; props: unknown }[]; missing: string[] }[];
}

describe("shared GST fixtures", () => {
  const fixtures = load<GstFixtures>("gst_cases.json");

  it.each(fixtures.gstin)("GSTIN $gstin", ({ gstin, problem }) => {
    expect(gstinProblem(gstin)).toBe(problem);
  });

  it.each(fixtures.totals)("$name", ({ lines, supplier_state, place_of_supply, expected, error }) => {
    const result = computeGstTotals(lines, supplier_state, place_of_supply);
    if (error) {
      expect(result).toMatchObject({ ok: false, error });
      return;
    }
    expect(result.ok).toBe(true);
    if (!result.ok || !expected) return;
    const { lines: computedLines, tax: _tax, ...totals } = result.totals;
    expect(computedLines.map(({ tax: _lineTax, ...line }) => line)).toEqual(expected.lines);
    const { lines: _expectedLines, ...expectedTotals } = expected;
    expect(totals).toEqual(expectedTotals);
  });

  it("financial years and invoice numbers", () => {
    for (const { date, start_year, label } of fixtures.financial_year) {
      expect(financialYear(date)).toBe(start_year);
      expect(financialYearLabel(start_year)).toBe(label);
    }
    for (const { prefix, start_year, seq, number } of fixtures.invoice_numbers) {
      expect(formatInvoiceNumber(prefix, start_year, seq)).toBe(number);
    }
  });

  it.each(fixtures.particulars)("particulars: $name", ({ elements, missing }) => {
    expect(missingParticulars(elements)).toEqual(missing);
  });
});
