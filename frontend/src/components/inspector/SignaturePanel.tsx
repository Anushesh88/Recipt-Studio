import React from "react";
import type { CanvasElement } from "../../schema/templateSchema";
import { AssetUpload } from "./AssetUpload";
import { ColorField, Section, TextField } from "./fields";
import { usePropUpdater } from "./usePropUpdater";
import { LABEL_MAX_LENGTH } from "../../lib/units";

type SignatureElement = Extract<CanvasElement, { type: "signature" }>;

export const SignaturePanel: React.FC<{ element: SignatureElement }> = ({ element }) => {
  const set = usePropUpdater(element);
  const { props } = element;
  return (
    <Section title="Signature">
      <TextField id="signature-label" label="Label under the line" value={props.label} maxLength={LABEL_MAX_LENGTH} onChange={(v) => set("label", v)} />
      <AssetUpload label="Signature image (optional)" kind="signature" assetId={props.assetId} onChange={(id) => set("assetId", id)} />
      <ColorField id="signature-color" label="Line and label color" value={props.lineColor} onChange={(v) => set("lineColor", v)} />
    </Section>
  );
};
