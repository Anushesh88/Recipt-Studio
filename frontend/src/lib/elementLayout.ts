// Inner layout of elements that draw several parts. The PDF template may only
// use absolute positioning (no flexbox / grid), so both the React components and
// backend render_service.py place every part at these explicit offsets.
// Change them together (the numbers live in lib/units.ts).
import type { CanvasElement } from "../schema/templateSchema";
import {
  SIGNATURE_LABEL_GAP,
  SIGNATURE_LABEL_HEIGHT,
  SIGNATURE_LINE_THICKNESS,
  TOTALS_EMPHASIS_SCALE,
  TOTALS_FIELDS,
  TOTALS_LINE_HEIGHT,
  TOTALS_ROW_GAP,
  type TotalsLine,
} from "./units";

type TotalsProps = Extract<CanvasElement, { type: "totals" }>["props"];

// What the "tax" line prints as: one Tax row on a receipt; on a GST invoice
// CGST + SGST (or UTGST) within a state, IGST between states
export interface TaxRow {
  key: string; // into the totals values: tax, cgst, sgst, igst
  label: string;
}
export const DEFAULT_TAX_ROWS: TaxRow[] = [{ key: "tax", label: "Tax" }];

const LABELS = Object.fromEntries(TOTALS_FIELDS.map((f) => [f.key, f.label])) as Record<TotalsLine, string>;

export interface TotalsRow {
  line: TotalsLine;
  key: string;
  label: string;
  top: number;
  height: number;
  fontSize: number;
  bold: boolean;
}

// One row per printed line, stacked from the top with a fixed gap
export function totalsRows(props: TotalsProps, taxRows: TaxRow[] = DEFAULT_TAX_ROWS): TotalsRow[] {
  const printed = props.show.flatMap((line): { line: TotalsLine; key: string; label: string }[] =>
    line === "tax" ? taxRows.map((t) => ({ line, ...t })) : [{ line, key: line, label: LABELS[line] }],
  );
  let top = 0;
  return printed.map(({ line, key, label }) => {
    const emphasized = line === "total" && props.emphasizeTotal;
    const fontSize = emphasized ? props.fontSize * TOTALS_EMPHASIS_SCALE : props.fontSize;
    const height = Math.ceil(fontSize * TOTALS_LINE_HEIGHT);
    const row = { line, key, label, top, height, fontSize, bold: emphasized };
    top += height + TOTALS_ROW_GAP;
    return row;
  });
}

// Label along the bottom, the line just above it, the image filling the rest
export function signatureLayout(height: number) {
  const labelTop = height - SIGNATURE_LABEL_HEIGHT;
  const lineTop = labelTop - SIGNATURE_LABEL_GAP - SIGNATURE_LINE_THICKNESS;
  return { imageHeight: Math.max(0, lineTop), lineTop, labelTop };
}

// "#RRGGBB" + alpha -> rgba(), which both browsers and WeasyPrint understand
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// The divider's line is centred vertically in its box
export const dividerLineTop = (height: number, thickness: number) => (height - thickness) / 2;
