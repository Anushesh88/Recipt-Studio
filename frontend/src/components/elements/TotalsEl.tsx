import React from "react";
import { BaseElementWrapper, type ElementProps } from "./BaseElementWrapper";
import { fontStack } from "../../lib/units";
import { totalsRows, type TaxRow } from "../../lib/elementLayout";

// subtotal, discount, taxable, tax, total; GST invoices add cgst, sgst, igst
export type TotalsValues = Record<string, string>;

// Placeholder amounts for the editor, matching TableEl's sample rows: 8% tax on
// a receipt; 5% GST within a state on a GST invoice
const SAMPLE_TOTALS: TotalsValues = { subtotal: "35.00", discount: "0.00", taxable: "35.00", tax: "2.80", total: "37.80" };
const SAMPLE_GST_TOTALS: TotalsValues = {
  subtotal: "35.00", discount: "0.00", taxable: "35.00", tax: "1.76", cgst: "0.88", sgst: "0.88", igst: "1.75", total: "36.76",
};

// Totals have no color prop; set it explicitly so the editor and the PDF agree
// instead of inheriting different defaults
const TOTALS_COLOR = "#000000";

// `values` are the receipt's computed totals (Generate preview) and `taxRows`
// what its tax line prints as. Rows are placed absolutely (lib/elementLayout.ts),
// mirrored by receipt.html.j2.
export const TotalsEl = React.forwardRef<HTMLDivElement, ElementProps<"totals"> & { values?: TotalsValues; taxRows?: TaxRow[] }>(
  ({ element, values, taxRows, ...domProps }, ref) => {
    const { props } = element;
    const gst = taxRows !== undefined && taxRows.some((row) => row.key !== "tax");
    const amounts = values ?? (gst ? SAMPLE_GST_TOTALS : SAMPLE_TOTALS);
    return (
      <BaseElementWrapper element={element} ref={ref} {...domProps}>
        {totalsRows(props, taxRows).map((row) => (
          <div
            key={row.key}
            data-totals-line={row.key}
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
            <span style={{ position: "absolute", left: 0, top: 0 }}>{row.label}</span>
            <span style={{ position: "absolute", right: 0, top: 0 }}>{props.currencySymbol}{amounts[row.key]}</span>
          </div>
        ))}
      </BaseElementWrapper>
    );
  },
);
TotalsEl.displayName = "TotalsEl";
