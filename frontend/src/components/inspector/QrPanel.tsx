import React from "react";
import type { CanvasElement } from "../../schema/templateSchema";
import { VariableTextarea } from "../variables/VariableTextarea";
import { Section, SelectField } from "./fields";
import { usePropUpdater } from "./usePropUpdater";
import { qrFits, qrTooLongMessage } from "../../lib/qr";

type QrElement = Extract<CanvasElement, { type: "qr" }>;

const ERROR_CORRECTION_OPTIONS = [
  { value: "L", label: "Low (7%)" },
  { value: "M", label: "Medium (15%)" },
  { value: "Q", label: "Quartile (25%)" },
  { value: "H", label: "High (30%)" },
] as const;

export const QrPanel: React.FC<{ element: QrElement }> = ({ element }) => {
  const set = usePropUpdater(element);
  const { props } = element;
  return (
    <Section title="QR code">
      <VariableTextarea id="qr-content" label="Encoded content" value={props.content} onChange={(v) => set("content", v)} rows={2} />
      {qrFits(props.content, props.errorCorrection) ? (
        <p className="text-xs text-muted-foreground">The canvas encodes sample values; exports encode the real ones.</p>
      ) : (
        <p role="alert" className="text-xs text-destructive">{qrTooLongMessage(props.errorCorrection)}</p>
      )}
      <SelectField
        id="qr-error-correction"
        label="Error correction"
        value={props.errorCorrection}
        options={ERROR_CORRECTION_OPTIONS}
        onChange={(v) => set("errorCorrection", v)}
        hint="Higher survives more damage but makes a denser code."
      />
    </Section>
  );
};
