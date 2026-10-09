import React from "react";
import { BaseElementWrapper, type ElementProps } from "./BaseElementWrapper";
import { fontStack } from "../../lib/units";

// `assetSrc` is the resolved URL of props.assetId (fetched by the caller)
export const SignatureEl = React.forwardRef<HTMLDivElement, ElementProps<"signature"> & { assetSrc?: string }>(
  ({ element, assetSrc, ...domProps }, ref) => {
    const { props } = element;
    return (
      <BaseElementWrapper element={element} ref={ref} {...domProps}>
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
          {props.assetId && assetSrc ? (
            <img
              src={assetSrc}
              alt="signature"
              draggable={false}
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
  },
);
SignatureEl.displayName = "SignatureEl";
