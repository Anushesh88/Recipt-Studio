import React from "react";
import { BaseElementWrapper } from "./BaseElementWrapper";
import type { CanvasElement } from "../../schema/templateSchema";

export const TextEl = React.forwardRef<HTMLDivElement, { element: Extract<CanvasElement, { type: "text" }>; className?: string }>(({ element, className }, ref) => {
  return (
    <BaseElementWrapper element={element} className={className} ref={ref}>
      <div
        style={{
          fontFamily: element.props.fontFamily,
          fontSize: `${element.props.fontSize}px`,
          fontWeight: element.props.fontWeight,
          color: element.props.color,
          textAlign: element.props.align,
          lineHeight: element.props.lineHeight,
          width: "100%",
          height: "100%",
        }}
      >
        {element.props.content}
      </div>
    </BaseElementWrapper>
  );
});
