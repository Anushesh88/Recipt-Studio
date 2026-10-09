import React from "react";
import { BaseElementWrapper } from "./BaseElementWrapper";
import type { CanvasElement } from "../../schema/templateSchema";

export const ImageEl = React.forwardRef<HTMLDivElement, { element: Extract<CanvasElement, { type: "image" }>; className?: string }>(({ element, className }, ref) => {
  // Placeholder for missing asset
  const content = element.props.assetId ? (
    <img
      src={`/api/assets/${element.props.assetId}`} // mock URL
      alt="image"
      style={{ width: "100%", height: "100%", objectFit: element.props.fit as any }}
    />
  ) : (
    <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm">
      {element.props.source}
    </div>
  );

  return (
    <BaseElementWrapper element={element} className={className} ref={ref}>
      {content}
    </BaseElementWrapper>
  );
});
