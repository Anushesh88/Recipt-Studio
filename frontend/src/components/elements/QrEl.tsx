import React from "react";
import { BaseElementWrapper, type ElementProps } from "./BaseElementWrapper";
import { QRCodeSVG } from "qrcode.react";
import { resolveVariables, SAMPLE_VALUES, type VariableValues } from "../../lib/variables";
import { qrFits } from "../../lib/qr";

// Encodes resolved content; without `values` (the editor) built-ins use their
// sample values and other variables a [key] placeholder. Content too long for a
// QR code shows a notice instead (qrcode.react would throw and take the page down).
export const QrEl = React.forwardRef<HTMLDivElement, ElementProps<"qr"> & { values?: VariableValues }>(
  ({ element, values, ...domProps }, ref) => {
    const encoded = resolveVariables(element.props.content, values ?? SAMPLE_VALUES, (key) => (values ? "" : `[${key}]`));
    const level = element.props.errorCorrection;
    return (
      <BaseElementWrapper element={element} ref={ref} {...domProps}>
        {qrFits(encoded, level) ? (
          <div style={{ width: "100%", height: "100%" }}>
            <QRCodeSVG value={encoded || " "} level={level} width="100%" height="100%" />
          </div>
        ) : (
          <div
            data-qr-too-long=""
            className="flex h-full w-full items-center justify-center border-2 border-dashed border-red-400 bg-red-50 p-1 text-center text-[10px] leading-tight text-red-700"
          >
            Too much text for a QR code
          </div>
        )}
      </BaseElementWrapper>
    );
  },
);
QrEl.displayName = "QrEl";
