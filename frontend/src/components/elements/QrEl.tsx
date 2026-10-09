import React from "react";
import { BaseElementWrapper } from "./BaseElementWrapper";
import type { CanvasElement } from "../../schema/templateSchema";
import { QRCodeSVG } from "qrcode.react";

export const QrEl = React.forwardRef<HTMLDivElement, { element: Extract<CanvasElement, { type: "qr" }>; className?: string; onPointerDown?: React.PointerEventHandler<HTMLDivElement>; onClick?: React.MouseEventHandler<HTMLDivElement>; }>(({ element, className, onPointerDown, onClick }, ref) => {
  return (
    <BaseElementWrapper element={element} className={className} ref={ref} onPointerDown={onPointerDown} onClick={onClick}>
      <div style={{ width: "100%", height: "100%" }}>
        <QRCodeSVG
          value={element.props.content || "empty"}
          level={element.props.errorCorrection as "L" | "M" | "Q" | "H"}
          width="100%"
          height="100%"
        />
      </div>
    </BaseElementWrapper>
  );
});
