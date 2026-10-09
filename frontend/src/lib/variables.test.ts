import { describe, it, expect } from "vitest";
import {
  extractVariables,
  findUnknownVariables,
  findVariables,
  resolveVariables,
  splitVariables,
  variableKind,
  variableLabel,
  SAMPLE_VALUES,
} from "./variables";
import type { CanvasElement } from "../schema/templateSchema";

const text = (id: string, content: string): CanvasElement => ({
  id, type: "text", x: 0, y: 0, width: 100, height: 20, zIndex: 1, locked: false,
  props: { content, fontFamily: "Inter", fontSize: 12, fontWeight: 400, color: "#000000", align: "left", lineHeight: 1.3 },
});

describe("variables", () => {
  it("finds variables with the shared pattern, tolerating inner spaces", () => {
    expect(findVariables("Hi {{customer.name}}, #{{ receipt.number }}")).toEqual(["customer.name", "receipt.number"]);
    // Not variables under the shared pattern: uppercase, digits, single braces
    expect(findVariables("{{Customer.Name}} {{custom.table1}} {customer.name}")).toEqual([]);
  });

  it("classifies built-in, custom and unknown keys", () => {
    expect(variableKind("receipt.date")).toBe("builtin");
    expect(variableKind("custom.table_no")).toBe("custom");
    expect(variableKind("customer.phone")).toBe("unknown");
    expect(variableKind("custom")).toBe("unknown");
  });

  it("reports each unknown variable once", () => {
    expect(findUnknownVariables("{{foo.bar}} {{foo.bar}} {{customer.name}} {{oops}}")).toEqual(["foo.bar", "oops"]);
  });

  it("extracts unique variables from text and QR content in order", () => {
    const qr: CanvasElement = {
      id: "q", type: "qr", x: 0, y: 0, width: 50, height: 50, zIndex: 2, locked: false,
      props: { content: "{{receipt.number}}|{{custom.table_no}}", errorCorrection: "M" },
    };
    const elements = [text("a", "{{business.name}} - {{receipt.number}}"), qr, text("b", "{{business.name}}")];
    expect(extractVariables({ elements })).toEqual(["business.name", "receipt.number", "custom.table_no"]);
  });

  it("splits text into literal and variable segments", () => {
    expect(splitVariables("Table {{ custom.table_no }}!")).toEqual([
      { type: "text", text: "Table " },
      { type: "variable", key: "custom.table_no", raw: "{{ custom.table_no }}" },
      { type: "text", text: "!" },
    ]);
    expect(splitVariables("")).toEqual([]);
  });

  it("resolves values with a fallback for missing keys", () => {
    expect(resolveVariables("{{customer.name}} @ {{custom.table_no}}", SAMPLE_VALUES, (k) => `[${k}]`))
      .toBe("Jane Doe @ [custom.table_no]");
    expect(resolveVariables("{{customer.name}}", {})).toBe("");
  });

  it("labels variables for forms", () => {
    expect(variableLabel("receipt.payment_method")).toBe("Payment method");
    expect(variableLabel("custom.table_no")).toBe("Table no");
  });
});
