// The shared Layout Algorithm (docs/03-schema.md). Phase 5's layout_service.py
// implements the same steps; both must pass shared/fixtures/layout_cases.json.

export interface TableRowMetrics {
  fontSize: number;
  lineHeight: number;
  rowPadding: number;
}

// row_h = ceil(fontSize * lineHeight) + 2 * rowPadding  (header_h == row_h)
export function tableRowHeight({ fontSize, lineHeight, rowPadding }: TableRowMetrics): number {
  return Math.ceil(fontSize * lineHeight) + 2 * rowPadding;
}

// Height of a table with a header row plus `rows` body rows
export function tableHeight(metrics: TableRowMetrics, rows: number): number {
  return (1 + rows) * tableRowHeight(metrics);
}

export const CONTENT_OVERFLOW = "CONTENT_OVERFLOW";

// Just what the algorithm reads, so it works on full canvases and on fixtures
export interface LayoutPage {
  height: number;
  heightMode: "auto" | "fixed";
  margin: number;
}

export interface LayoutElement {
  id: string;
  type: string;
  y: number;
  height: number;
  props?: unknown;
}

export interface LayoutResult<E extends LayoutElement> {
  elements: E[];
  pageHeight: number;
  delta: number;
  error: typeof CONTENT_OVERFLOW | null;
}

// Positions the template for `nRows` line items:
//   actual_h = header_h + n_rows * row_h;  delta = actual_h - designed_h
//   fixed pages: delta = max(0, delta)
//   every element whose top is at/below the table's designed bottom moves by delta
//   the table becomes designed_h + delta tall
//   auto pages: page height += delta; fixed pages: anything past the bottom
//   margin is CONTENT_OVERFLOW
export function applyLayout<E extends LayoutElement>(page: LayoutPage, elements: E[], nRows: number): LayoutResult<E> {
  const fixed = page.heightMode === "fixed";
  const table = elements.find((e) => e.type === "items_table");

  let delta = 0;
  let positioned = elements;
  if (table) {
    const designed = table.height;
    delta = tableHeight(table.props as TableRowMetrics, nRows) - designed;
    if (fixed) delta = Math.max(0, delta);
    const tableBottom = table.y + designed;
    positioned = elements.map((e) => {
      if (e === table) return { ...e, height: designed + delta };
      return e.y >= tableBottom ? { ...e, y: e.y + delta } : e;
    });
  }

  const overflow = fixed && positioned.some((e) => e.y + e.height > page.height - page.margin);
  return {
    elements: positioned,
    pageHeight: fixed ? page.height : page.height + delta,
    delta,
    error: overflow ? CONTENT_OVERFLOW : null,
  };
}
