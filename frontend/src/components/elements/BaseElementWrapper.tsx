import React from "react";
import type { CanvasElement } from "../../schema/templateSchema";


export const BaseElementWrapper = React.forwardRef<HTMLDivElement, {
  element: CanvasElement;
  className?: string;
  children: React.ReactNode;
}>(({ element, className = "", children }, ref) => {
  return (
    <div
      ref={ref}
      id={element.id}
      className={`absolute select-none ${className}`}
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

