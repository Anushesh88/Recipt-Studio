import React from "react";
import type { CanvasElement } from "../../schema/templateSchema";
import { DIVIDER_MIN_THICKNESS, MIN_ELEMENT_SIZE } from "../../lib/units";
import { ColorField, NumberField, Section, SegmentedField } from "./fields";
import { usePropUpdater } from "./usePropUpdater";

type DividerElement = Extract<CanvasElement, { type: "divider" }>;

const STYLE_OPTIONS = [
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
] as const;

export const DividerPanel: React.FC<{ element: DividerElement }> = ({ element }) => {
  const set = usePropUpdater(element);
  const { props } = element;
  return (
    <Section title="Divider">
      <SegmentedField label="Line style" value={props.style} options={STYLE_OPTIONS} onChange={(v) => set("style", v)} />
      <NumberField
        id="divider-thickness"
        label="Thickness (px)"
        value={props.thickness}
        min={DIVIDER_MIN_THICKNESS}
        // the divider's box is MIN_ELEMENT_SIZE tall
        max={MIN_ELEMENT_SIZE}
        live
        onCommit={(v) => set("thickness", v)}
      />
      <ColorField id="divider-color" label="Color" value={props.color} onChange={(v) => set("color", v)} />
    </Section>
  );
};
