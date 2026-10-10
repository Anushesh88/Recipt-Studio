import React from "react";
import { BaseElementWrapper, type ElementProps } from "./BaseElementWrapper";
import { fontStack } from "../../lib/units";
import { SIGNATURE_LABEL_FONT_SIZE, SIGNATURE_LABEL_HEIGHT, SIGNATURE_LINE_THICKNESS } from "../../lib/units";
import { signatureLayout } from "../../lib/elementLayout";

// `assetSrc` is the resolved URL of props.assetId (fetched by the caller).
// Parts are placed absolutely (lib/elementLayout.ts), mirrored by receipt.html.j2.
export const SignatureEl = React.forwardRef<HTMLDivElement, ElementProps<"signature"> & { assetSrc?: string }>(
  ({ element, assetSrc, ...domProps }, ref) => {
    const { props } = element;
    const { imageHeight, lineTop, labelTop } = signatureLayout(element.height);
    return (
      <BaseElementWrapper element={element} ref={ref} {...domProps}>
        {props.assetId && assetSrc && (
          <img
            src={assetSrc}
            alt="signature"
            draggable={false}
            style={{ position: "absolute", left: 0, top: 0, width: "100%", height: imageHeight, objectFit: "contain", display: "block" }}
          />
        )}
        <div
          style={{ position: "absolute", left: 0, top: lineTop, width: "100%", height: SIGNATURE_LINE_THICKNESS, backgroundColor: props.lineColor }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: labelTop,
            width: "100%",
            height: SIGNATURE_LABEL_HEIGHT,
            lineHeight: `${SIGNATURE_LABEL_HEIGHT}px`,
            fontFamily: fontStack("Inter"),
            fontSize: `${SIGNATURE_LABEL_FONT_SIZE}px`,
            fontWeight: 400,
            color: props.lineColor,
            textAlign: "center",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {props.label}
        </div>
      </BaseElementWrapper>
    );
  },
);
SignatureEl.displayName = "SignatureEl";
