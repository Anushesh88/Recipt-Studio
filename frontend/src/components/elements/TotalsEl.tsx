import React from "react";
import { BaseElementWrapper } from "./BaseElementWrapper";
import type { CanvasElement } from "../../schema/templateSchema";
import { fontStack } from "../../lib/units";

export const TotalsEl = React.forwardRef<HTMLDivElement, { element: Extract<CanvasElement, { type: "totals" }>; className?: string; onPointerDown?: React.PointerEventHandler<HTMLDivElement>; onClick?: React.MouseEventHandler<HTMLDivElement>; }>(({ element, className, onPointerDown, onClick }, ref) => {
  const { props } = element;
  
  const dummyValues: Record<string, string> = {
    subtotal: "35.00",
    tax: "2.80",
    discount: "0.00",
    total: "37.80",
  };

  const labels: Record<string, string> = {
    subtotal: "Subtotal",
    tax: "Tax",
    discount: "Discount",
    total: "Total",
  };

  return (
    <BaseElementWrapper element={element} className={className} ref={ref} onPointerDown={onPointerDown} onClick={onClick}>
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
            <span>{props.currencySymbol}{dummyValues[field]}</span>
          </div>
        ))}
      </div>
    </BaseElementWrapper>
  );
});
