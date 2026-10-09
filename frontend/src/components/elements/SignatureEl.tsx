import React from "react";
import { BaseElementWrapper } from "./BaseElementWrapper";
import type { CanvasElement } from "../../schema/templateSchema";
import { fontStack } from "../../lib/units";

export const SignatureEl = React.forwardRef<HTMLDivElement, { element: Extract<CanvasElement, { type: "signature" }>; className?: string; onPointerDown?: React.PointerEventHandler<HTMLDivElement>; onClick?: React.MouseEventHandler<HTMLDivElement>; }>(({ element, className, onPointerDown, onClick }, ref) => {
  const { props } = element;
  return (
    <BaseElementWrapper element={element} className={className} ref={ref} onPointerDown={onPointerDown} onClick={onClick}>
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          alignItems: "center",
        }}
      >
        {props.assetId ? (
          <img
            src={`/api/assets/${props.assetId}`}
            alt="signature"
            style={{ width: "100%", height: "calc(100% - 20px)", objectFit: "contain" }}
          />
        ) : (
          <div style={{ flex: 1 }} />
        )}
        <div style={{ width: "100%", borderTop: `2px solid ${props.lineColor}` }} />
        <div style={{ fontSize: "12px", fontFamily: fontStack("Inter"), color: props.lineColor, marginTop: "4px" }}>
          {props.label}
        </div>
      </div>
    </BaseElementWrapper>
  );
});
