import React from "react";
import type { CanvasElement } from "../../schema/templateSchema";
import { AssetUpload } from "./AssetUpload";
import { Section, SelectField } from "./fields";
import { usePropUpdater } from "./usePropUpdater";

type ImageElement = Extract<CanvasElement, { type: "image" }>;

const SOURCE_OPTIONS = [
  { value: "logo", label: "Logo" },
  { value: "signature", label: "Signature" },
  { value: "image", label: "Other image" },
] as const;

const FIT_OPTIONS = [
  { value: "contain", label: "Fit (keep proportions)" },
  { value: "cover", label: "Fill (crop to box)" },
  { value: "fill", label: "Stretch" },
] as const;

export const ImagePanel: React.FC<{ element: ImageElement }> = ({ element }) => {
  const set = usePropUpdater(element);
  const { props } = element;
  return (
    <Section title="Image">
      <SelectField id="image-source" label="Used as" value={props.source} options={SOURCE_OPTIONS} onChange={(v) => set("source", v)} />
      <AssetUpload label="File" kind={props.source} assetId={props.assetId} onChange={(id) => set("assetId", id)} />
      <SelectField id="image-fit" label="Fit" value={props.fit} options={FIT_OPTIONS} onChange={(v) => set("fit", v)} />
    </Section>
  );
};
