// Variable placeholders ({{namespace.key}}) in text and QR content.
// The pattern is shared with the backend (app/schemas/canvas.py, and Phase 5's
// variables_service.resolve()), so both sides agree on what counts as a variable.
import type { CanvasElement } from "../schema/templateSchema";

export const VARIABLE_PATTERN = String.raw`\{\{\s*([a-z_]+(?:\.[a-z_]+)?)\s*\}\}`;
const variableRegex = () => new RegExp(VARIABLE_PATTERN, "g");

export interface BuiltinVariable {
  key: string;
  label: string;
  // Shown on the canvas while designing (real values come from the Generate form)
  sample: string;
}

export const BUILTIN_VARIABLES: readonly BuiltinVariable[] = [
  { key: "business.name", label: "Business name", sample: "Acme Cafe" },
  { key: "customer.name", label: "Customer name", sample: "Jane Doe" },
  { key: "customer.email", label: "Customer email", sample: "jane@example.com" },
  { key: "receipt.number", label: "Receipt number", sample: "R-0001" },
  { key: "receipt.date", label: "Receipt date", sample: "2026-10-09" },
  { key: "receipt.payment_method", label: "Payment method", sample: "Card" },
  { key: "receipt.currency", label: "Currency", sample: "USD" },
  { key: "receipt.notes", label: "Notes", sample: "Thank you!" },
];

const BUILTIN_KEYS = new Set(BUILTIN_VARIABLES.map((v) => v.key));

export const CUSTOM_PREFIX = "custom.";
// docs/03-schema.md also lists digits for custom keys, but the shared pattern only
// matches [a-z_] after the dot, so a key with digits would never be recognised.
export const CUSTOM_KEY_PATTERN = /^[a-z_]+$/;

export type VariableKind = "builtin" | "custom" | "unknown";

export function variableKind(key: string): VariableKind {
  if (BUILTIN_KEYS.has(key)) return "builtin";
  if (key.startsWith(CUSTOM_PREFIX) && CUSTOM_KEY_PATTERN.test(key.slice(CUSTOM_PREFIX.length))) {
    return "custom";
  }
  return "unknown";
}

// Every variable key in the text, in order (repeats included)
export function findVariables(text: string): string[] {
  return Array.from(text.matchAll(variableRegex()), (m) => m[1]);
}

export function findUnknownVariables(text: string): string[] {
  return [...new Set(findVariables(text).filter((key) => variableKind(key) === "unknown"))];
}

type ContentElement = Extract<CanvasElement, { type: "text" | "qr" }>;

const hasVariableContent = (el: CanvasElement): el is ContentElement => el.type === "text" || el.type === "qr";

// Unique variable keys used by a template, in order of first appearance.
// Only text and QR content can hold variables (docs/03-schema.md).
export function extractVariables(template: { elements: CanvasElement[] }): string[] {
  const keys = template.elements.filter(hasVariableContent).flatMap((el) => findVariables(el.props.content));
  return [...new Set(keys)];
}

export type TextSegment =
  | { type: "text"; text: string }
  | { type: "variable"; key: string; raw: string };

export function splitVariables(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(variableRegex())) {
    const start = match.index ?? 0;
    if (start > last) segments.push({ type: "text", text: text.slice(last, start) });
    segments.push({ type: "variable", key: match[1], raw: match[0] });
    last = start + match[0].length;
  }
  if (last < text.length) segments.push({ type: "text", text: text.slice(last) });
  return segments;
}

export type VariableValues = Record<string, string>;

export const SAMPLE_VALUES: VariableValues = Object.fromEntries(BUILTIN_VARIABLES.map((v) => [v.key, v.sample]));

// Replaces placeholders with values; keys without a value use `fallback`
export function resolveVariables(
  text: string,
  values: VariableValues,
  fallback: (key: string) => string = () => "",
): string {
  return text.replace(variableRegex(), (_raw, key: string) => values[key] ?? fallback(key));
}

// Human label for a variable key, e.g. "custom.table_no" -> "Table no"
export function variableLabel(key: string): string {
  const builtin = BUILTIN_VARIABLES.find((v) => v.key === key);
  if (builtin) return builtin.label;
  const name = key.startsWith(CUSTOM_PREFIX) ? key.slice(CUSTOM_PREFIX.length) : key;
  const words = name.replace(/_+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
