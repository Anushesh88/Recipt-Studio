import React from "react";
import { BaseElementWrapper, type ElementProps } from "./BaseElementWrapper";
import { TOTALS_FIELDS, fontStack } from "../../lib/units";
import { totalsRows } from "../../lib/elementLayout";

export type TotalsValues = Record<"subtotal" | "tax" | "discount" | "total", string>;

// Placeholder amounts for the editor (they match TableEl's sample rows)
const SAMPLE_TOTALS: TotalsValues = {
  subtotal: "35.00",
  tax: "2.80",
  discount: "0.00",
  total: "37.80",
};

const LABELS = Object.fromEntries(TOTALS_FIELDS.map((f) => [f.key, f.label])) as Record<keyof TotalsValues, string>;

// Totals have no color prop; set it explicitly so the editor and the PDF agree
// instead of inheriting different defaults
const TOTALS_COLOR = "#000000";

// `values` are the receipt's computed totals (Generate preview). Rows are placed
// absolutely (lib/elementLayout.ts), mirrored by receipt.html.j2.
export const TotalsEl = React.forwardRef<HTMLDivElement, ElementProps<"totals"> & { values?: TotalsValues }>(
  ({ element, values, ...domProps }, ref) => {
    const { props } = element;
    const amounts = values ?? SAMPLE_TOTALS;
    return (
      <BaseElementWrapper element={element} ref={ref} {...domProps}>
        {totalsRows(props).map((row) => (
          <div
            key={row.line}
            data-totals-line={row.line}
            style={{
              position: "absolute",
              left: 0,
              top: row.top,
              width: "100%",
              height: row.height,
              lineHeight: `${row.height}px`,
              fontFamily: fontStack(props.fontFamily),
              fontSize: `${row.fontSize}px`,
              fontWeight: row.bold ? 700 : 400,
              color: TOTALS_COLOR,
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ position: "absolute", left: 0, top: 0 }}>{LABELS[row.line]}</span>
            <span style={{ position: "absolute", right: 0, top: 0 }}>{props.currencySymbol}{amounts[row.line]}</span>
          </div>
        ))}
      </BaseElementWrapper>
    );
  },
);
TotalsEl.displayName = "TotalsEl";
