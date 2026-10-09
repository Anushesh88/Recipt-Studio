// Pieces of the shared Layout Algorithm (docs/03-schema.md). Phase 4 extends this
// file with the full push-down computation; keep it in sync with layout_service.py.

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
