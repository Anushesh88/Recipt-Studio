import React from "react";
import type { CanvasElement } from "../../schema/templateSchema";


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
      className={`absolute select-none ${className}`}
      onPointerDown={onPointerDown}
      onClick={onClick}
      style={{
        left: `${element.x}px`,
        top: `${element.y}px`,
        width: `${element.width}px`,
        height: `${element.height}px`,
        zIndex: element.zIndex,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
});
BaseElementWrapper.displayName = "BaseElementWrapper";

