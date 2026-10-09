import React from "react";
import { BaseElementWrapper } from "./BaseElementWrapper";
import type { CanvasElement } from "../../schema/templateSchema";

export const TableEl = React.forwardRef<HTMLDivElement, { element: Extract<CanvasElement, { type: "items_table" }>; className?: string }>(({ element, className }, ref) => {
  const { props } = element;
  
  // Create 3 dummy rows for preview
  const dummyRows = [
    { description: "Item 1", qty: "1", unit_price: "10.00", line_total: "10.00" },
    { description: "Item 2", qty: "2", unit_price: "5.00", line_total: "10.00" },
    { description: "Item 3", qty: "1", unit_price: "15.00", line_total: "15.00" },
  ];

  return (
    <BaseElementWrapper element={element} className={className} ref={ref}>
      <table
        style={{
          tableLayout: "fixed",
          width: "100%",
          fontFamily: props.fontFamily,
          fontSize: `${props.fontSize}px`,
          lineHeight: props.lineHeight,
          color: props.color,
          borderCollapse: "collapse",
        }}
      >
        <thead>
          <tr>
            {props.columns.map((col, i) => (
              <th
                key={i}
                style={{
                  width: `${col.width * 100}%`,
                  textAlign: col.align,
                  fontWeight: props.headerBold ? "bold" : "normal",
                  paddingBottom: `${props.rowPadding}px`,
                  borderBottom: props.rowDivider ? `1px solid ${props.color}` : "none",
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dummyRows.map((row, rIdx) => (
            <tr key={rIdx}>
              {props.columns.map((col, cIdx) => (
                <td
                  key={cIdx}
                  style={{
                    textAlign: col.align,
                    paddingTop: `${props.rowPadding}px`,
                    paddingBottom: `${props.rowPadding}px`,
                    borderBottom: props.rowDivider && rIdx < dummyRows.length - 1 ? `1px dashed ${props.color}40` : "none",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {(row as Record<string, string>)[col.key] || "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </BaseElementWrapper>
  );
});
