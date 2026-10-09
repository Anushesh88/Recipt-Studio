import React from "react";
import { BaseElementWrapper, type ElementProps } from "./BaseElementWrapper";
import { fontStack } from "../../lib/units";

export type TotalsValues = Record<"subtotal" | "tax" | "discount" | "total", string>;

// Placeholder amounts for the editor (they match TableEl's sample rows)
const SAMPLE_TOTALS: TotalsValues = {
  subtotal: "35.00",
  tax: "2.80",
  discount: "0.00",
  total: "37.80",
};

// `values` are the receipt's computed totals (Generate preview)
export const TotalsEl = React.forwardRef<HTMLDivElement, ElementProps<"totals"> & { values?: TotalsValues }>(({ element, values, ...domProps }, ref) => {
  const { props } = element;
  const amounts = values ?? SAMPLE_TOTALS;

  const labels: Record<string, string> = {
    subtotal: "Subtotal",
    tax: "Tax",
    discount: "Discount",
    total: "Total",
  };

  return (
    <BaseElementWrapper element={element} ref={ref} {...domProps}>
      <div
        style={{
          fontFamily: fontStack(props.fontFamily),
          fontSize: `${props.fontSize}px`,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        {props.show.map((field) => (
          <div
            key={field}
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontWeight: field === "total" && props.emphasizeTotal ? "bold" : "normal",
              fontSize: field === "total" && props.emphasizeTotal ? `${props.fontSize * 1.2}px` : `${props.fontSize}px`,
            }}
          >
            <span>{labels[field]}</span>
            <span>{props.currencySymbol}{amounts[field]}</span>
          </div>
        ))}
      </div>
    </BaseElementWrapper>
  );
});
TotalsEl.displayName = "TotalsEl";
