// Inner layout of elements that draw several parts. The PDF template may only
// use absolute positioning (no flexbox / grid), so both the React components and
// backend render_service.py place every part at these explicit offsets.
// Change them together.
import type { CanvasElement } from "../schema/templateSchema";

type TotalsProps = Extract<CanvasElement, { type: "totals" }>["props"];
type TotalsLine = TotalsProps["show"][number];

export const TOTALS_LINE_HEIGHT = 1.4;
export const TOTALS_ROW_GAP = 4;
export const TOTALS_EMPHASIS_SCALE = 1.2;

export interface TotalsRow {
  line: TotalsLine;
  top: number;
  height: number;
  fontSize: number;
  bold: boolean;
}

// One row per shown line, stacked from the top with a fixed gap
export function totalsRows(props: TotalsProps): TotalsRow[] {
  let top = 0;
  return props.show.map((line) => {
    const emphasized = line === "total" && props.emphasizeTotal;
    const fontSize = emphasized ? props.fontSize * TOTALS_EMPHASIS_SCALE : props.fontSize;
    const height = Math.ceil(fontSize * TOTALS_LINE_HEIGHT);
    const row = { line, top, height, fontSize, bold: emphasized };
    top += height + TOTALS_ROW_GAP;
    return row;
  });
}

export const SIGNATURE_LABEL_FONT_SIZE = 12;
export const SIGNATURE_LABEL_HEIGHT = 16;
export const SIGNATURE_LINE_THICKNESS = 2;
export const SIGNATURE_LABEL_GAP = 4;

// Label along the bottom, the line just above it, the image filling the rest
export function signatureLayout(height: number) {
  const labelTop = height - SIGNATURE_LABEL_HEIGHT;
  const lineTop = labelTop - SIGNATURE_LABEL_GAP - SIGNATURE_LINE_THICKNESS;
  return { imageHeight: Math.max(0, lineTop), lineTop, labelTop };
}

// The divider's line is centred vertically in its box
export const dividerLineTop = (height: number, thickness: number) => (height - thickness) / 2;
