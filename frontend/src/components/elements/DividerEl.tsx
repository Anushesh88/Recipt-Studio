import React from "react";
import { BaseElementWrapper, type ElementProps } from "./BaseElementWrapper";
import { dividerLineTop } from "../../lib/elementLayout";

// The line is placed absolutely, centred in the box (mirrored by receipt.html.j2)
export const DividerEl = React.forwardRef<HTMLDivElement, ElementProps<"divider">>(({ element, ...domProps }, ref) => {
  const { props } = element;
  return (
    <BaseElementWrapper element={element} ref={ref} {...domProps}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: dividerLineTop(element.height, props.thickness),
          width: "100%",
          height: 0,
          borderTop: `${props.thickness}px ${props.style} ${props.color}`,
        }}
      />
    </BaseElementWrapper>
  );
});
DividerEl.displayName = "DividerEl";
