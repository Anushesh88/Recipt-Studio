import React from "react";
import { BaseElementWrapper, type ElementProps } from "./BaseElementWrapper";
import { ITEMS_TABLE_SAMPLE_ROWS, TABLE_DIVIDER_PX, TABLE_ROW_DIVIDER_ALPHA, fontStack } from "../../lib/units";
import { withAlpha } from "../../lib/elementLayout";
import { tableRowHeight } from "../../lib/layout";

// Placeholder line items shown in the editor (real items come from the Generate form).
// They sum to the TotalsEl placeholder subtotal of 35.00 (5% GST on GST invoices).
const SAMPLE_ITEMS: Record<string, string>[] = [
  { description: "Item 1", qty: "1 NOS", unit_price: "10.00", line_total: "10.00", hsn: "1006", taxable_value: "10.00", gst_rate: "5%", tax_amount: "0.50" },
  { description: "Item 2", qty: "2 NOS", unit_price: "5.00", line_total: "10.00", hsn: "0902", taxable_value: "10.00", gst_rate: "5%", tax_amount: "0.50" },
  { description: "Item 3", qty: "1 KGS", unit_price: "15.00", line_total: "15.00", hsn: "1701", taxable_value: "15.00", gst_rate: "5%", tax_amount: "0.76" },
];
const SAMPLE_ROWS = Array.from({ length: ITEMS_TABLE_SAMPLE_ROWS }, (_, i) => SAMPLE_ITEMS[i % SAMPLE_ITEMS.length]);

// One line item as shown in the table (all values already formatted)
export type TableRow = Record<string, string>;

// `rows` are the receipt's line items (Generate preview); without them the editor
// shows sample rows.
export const TableEl = React.forwardRef<HTMLDivElement, ElementProps<"items_table"> & { rows?: TableRow[] }>(({ element, rows, ...domProps }, ref) => {
  const { props } = element;
  const bodyRows = rows ?? SAMPLE_ROWS;
  const lineBox = Math.ceil(props.fontSize * props.lineHeight);
  const rowHeight = tableRowHeight(props);

  // Every row is exactly rowHeight (the Layout Algorithm's row_h), so the default
  // height of header + sample rows fills the element box. The 1px divider comes out
  // of the bottom padding, and borders are "separate" so they don't collapse into
  // neighbouring rows.
  const cellStyle = (align: React.CSSProperties["textAlign"], divider: string | null): React.CSSProperties => ({
    textAlign: align,
    lineHeight: `${lineBox}px`,
    padding: `${props.rowPadding}px 0 ${Math.max(0, props.rowPadding - (divider ? TABLE_DIVIDER_PX : 0))}px`,
    borderBottom: divider ?? "none",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  });

  const headerDivider = props.rowDivider ? `${TABLE_DIVIDER_PX}px solid ${props.color}` : null;
  const rowDivider = props.rowDivider ? `${TABLE_DIVIDER_PX}px dashed ${withAlpha(props.color, TABLE_ROW_DIVIDER_ALPHA)}` : null;

  return (
    <BaseElementWrapper element={element} ref={ref} {...domProps}>
      <table
        style={{
          tableLayout: "fixed",
          width: "100%",
          fontFamily: fontStack(props.fontFamily),
          fontSize: `${props.fontSize}px`,
          color: props.color,
          borderCollapse: "separate",
          borderSpacing: 0,
        }}
      >
        <thead>
          <tr style={{ height: `${rowHeight}px` }}>
            {props.columns.map((col, i) => (
              <th
                key={i}
                style={{
                  ...cellStyle(col.align, headerDivider),
                  width: `${col.width * 100}%`,
                  fontWeight: props.headerBold ? "bold" : "normal",
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, rIdx) => (
            <tr key={rIdx} style={{ height: `${rowHeight}px` }}>
              {props.columns.map((col, cIdx) => (
                <td key={cIdx} style={cellStyle(col.align, rIdx < bodyRows.length - 1 ? rowDivider : null)}>
                  {row[col.key] || "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </BaseElementWrapper>
  );
});
TableEl.displayName = "TableEl";
