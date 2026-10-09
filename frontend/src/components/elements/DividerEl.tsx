import React from "react";
import { BaseElementWrapper } from "./BaseElementWrapper";
import type { CanvasElement } from "../../schema/templateSchema";

export const DividerEl = React.forwardRef<HTMLDivElement, { element: Extract<CanvasElement, { type: "divider" }>; className?: string }>(({ element, className }, ref) => {
  const { props } = element;
  return (
    <BaseElementWrapper element={element} className={className} ref={ref}>
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            borderTop: `${props.thickness}px ${props.style} ${props.color}`,
          }}
        />
      </div>
    </BaseElementWrapper>
  );
});
