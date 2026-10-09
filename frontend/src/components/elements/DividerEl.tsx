import React from "react";
import { BaseElementWrapper, type ElementProps } from "./BaseElementWrapper";

export const DividerEl = React.forwardRef<HTMLDivElement, ElementProps<"divider">>(({ element, ...domProps }, ref) => {
  const { props } = element;
  return (
    <BaseElementWrapper element={element} ref={ref} {...domProps}>
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
DividerEl.displayName = "DividerEl";
