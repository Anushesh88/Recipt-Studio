// Runs shared/fixtures (also run by the backend's pytest) against the frontend libs
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { applyLayout, type LayoutElement, type LayoutPage } from "../src/lib/layout";
import { extractVariables, findUnknownVariables, findVariables, resolveVariables } from "../src/lib/variables";
import { computeTotals } from "../src/lib/money";
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
