import React from "react";
import type { CanvasElement } from "../../schema/templateSchema";
import { MIN_ELEMENT_SIZE } from "../../lib/units";

// DOM hooks the editor attaches to an element; previews pass none of them
export interface ElementDomProps {
  className?: string;
  onPointerDown?: React.PointerEventHandler<HTMLDivElement>;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  onDoubleClick?: React.MouseEventHandler<HTMLDivElement>;
}

export type ElementProps<T extends CanvasElement["type"]> = {
  element: Extract<CanvasElement, { type: T }>;
} & ElementDomProps;

export const BaseElementWrapper = React.forwardRef<HTMLDivElement, {
  element: CanvasElement;
  children: React.ReactNode;
} & ElementDomProps>(({ element, className = "", children, onPointerDown, onClick, onDoubleClick }, ref) => {
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
      onDoubleClick={onDoubleClick}
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
