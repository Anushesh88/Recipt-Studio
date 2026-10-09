import { describe, it, expect } from "vitest";
import { tableHeight, tableRowHeight, type TableRowMetrics } from "./layout";
import { DEFAULT_ELEMENTS, ITEMS_TABLE_SAMPLE_ROWS } from "./units";

describe("table row metrics (Layout Algorithm)", () => {
  it("row_h = ceil(fontSize * lineHeight) + 2 * rowPadding", () => {
    // ceil(12 * 1.3) = ceil(15.6) = 16; 16 + 2 * 4 = 24
    expect(tableRowHeight({ fontSize: 12, lineHeight: 1.3, rowPadding: 4 })).toBe(24);
    expect(tableRowHeight({ fontSize: 10, lineHeight: 1, rowPadding: 0 })).toBe(10);
  });

  it("table height is header + n rows", () => {
    expect(tableHeight({ fontSize: 12, lineHeight: 1.3, rowPadding: 4 }, 3)).toBe(96);
    expect(tableHeight({ fontSize: 12, lineHeight: 1.3, rowPadding: 4 }, 0)).toBe(24);
  });

  it("the default items_table is exactly header + sample rows tall", () => {
    const table = DEFAULT_ELEMENTS.items_table;
    const metrics = table.props as TableRowMetrics; // items_table props carry the row metrics
    expect(table.height).toBe(tableHeight(metrics, ITEMS_TABLE_SAMPLE_ROWS));
    expect(table.height).toBe(96);
  });
});
