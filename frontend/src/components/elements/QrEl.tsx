import React from "react";
import { BaseElementWrapper, type ElementProps } from "./BaseElementWrapper";
import { QRCodeSVG } from "qrcode.react";
import { resolveVariables, SAMPLE_VALUES, type VariableValues } from "../../lib/variables";

// Encodes resolved content; without `values` (the editor) built-ins use their
// sample values and other variables a [key] placeholder.
export const QrEl = React.forwardRef<HTMLDivElement, ElementProps<"qr"> & { values?: VariableValues }>(
  ({ element, values, ...domProps }, ref) => {
    const encoded = resolveVariables(element.props.content, values ?? SAMPLE_VALUES, (key) => (values ? "" : `[${key}]`));
    return (
      <BaseElementWrapper element={element} ref={ref} {...domProps}>
        <div style={{ width: "100%", height: "100%" }}>
          <QRCodeSVG value={encoded || " "} level={element.props.errorCorrection} width="100%" height="100%" />
        </div>
      </BaseElementWrapper>
    );
  },
);
QrEl.displayName = "QrEl";
