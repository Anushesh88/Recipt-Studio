import React from "react";
import { BaseElementWrapper } from "./BaseElementWrapper";
import type { CanvasElement } from "../../schema/templateSchema";
import { fontStack } from "../../lib/units";

export const TextEl = React.forwardRef<HTMLDivElement, { element: Extract<CanvasElement, { type: "text" }>; className?: string; onPointerDown?: React.PointerEventHandler<HTMLDivElement>; onClick?: React.MouseEventHandler<HTMLDivElement>; }>(({ element, className, onPointerDown, onClick }, ref) => {
  return (
    <BaseElementWrapper element={element} className={className} ref={ref} onPointerDown={onPointerDown} onClick={onClick}>
      <div
        style={{
          fontFamily: fontStack(element.props.fontFamily),
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
