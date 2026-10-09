import React from "react";
import type { CanvasElement } from "../../schema/templateSchema";
import { MIN_ELEMENT_SIZE } from "../../lib/units";

export const BaseElementWrapper = React.forwardRef<HTMLDivElement, {
  element: CanvasElement;
  className?: string;
  children: React.ReactNode;
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}>(({ element, className = "", children, onPointerDown, onClick }, ref) => {
  return (
    <div
      ref={ref}
      id={element.id}
      data-element-id={element.id}
      data-type={element.type}
      data-x={element.x}
      data-y={element.y}
      data-width={element.width}
      data-height={element.height}
      className={`absolute select-none ${className}`}
      onPointerDown={onPointerDown}
      onClick={onClick}
      // No CSS z-index: the elements array order is the canonical paint order and
      // elements are rendered in that order, so later siblings paint on top.
      // element.zIndex is informational only (docs/03-schema.md).
      style={{
        left: `${element.x}px`,
        top: `${element.y}px`,
        width: `${element.width}px`,
        height: `${Math.max(element.height, MIN_ELEMENT_SIZE)}px`,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
});
BaseElementWrapper.displayName = "BaseElementWrapper";

