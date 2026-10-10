import React from "react";
import { AlignCenter, AlignJustify, AlignLeft, AlignRight } from "lucide-react";
import type { CanvasElement } from "../../schema/templateSchema";
import { VariableTextarea } from "../variables/VariableTextarea";
import { ColorField, NumberField, Section, SegmentedField, SelectField } from "./fields";
import { FONT_OPTIONS, FONT_WEIGHT_OPTIONS } from "./options";
import { usePropUpdater } from "./usePropUpdater";
import { FONT_SIZE_RANGE, LINE_HEIGHT_RANGE } from "../../lib/units";

type TextElement = Extract<CanvasElement, { type: "text" }>;

const ALIGN_OPTIONS = [
  { value: "left", label: "Align left", icon: <AlignLeft /> },
  { value: "center", label: "Align center", icon: <AlignCenter /> },
  { value: "right", label: "Align right", icon: <AlignRight /> },
  { value: "justify", label: "Justify", icon: <AlignJustify /> },
] as const;

export const TextPanel: React.FC<{ element: TextElement }> = ({ element }) => {
  const set = usePropUpdater(element);
  const { props } = element;
  return (
    <>
      <Section title="Content">
        <VariableTextarea id="text-content" label="Text" value={props.content} onChange={(v) => set("content", v)} />
        <p className="text-xs text-muted-foreground">Tip: double-click the text on the canvas to type in place.</p>
      </Section>
      <Section title="Typography">
        <SelectField id="text-font" label="Font" value={props.fontFamily} options={FONT_OPTIONS} onChange={(v) => set("fontFamily", v)} />
        <div className="grid grid-cols-2 gap-2">
          <NumberField id="text-size" label="Size (px)" value={props.fontSize} {...FONT_SIZE_RANGE} live onCommit={(v) => set("fontSize", v)} />
          <NumberField id="text-line-height" label="Line height" value={props.lineHeight} {...LINE_HEIGHT_RANGE} live onCommit={(v) => set("lineHeight", v)} />
        </div>
        <SelectField
          id="text-weight"
          label="Weight"
          value={String(props.fontWeight)}
          options={FONT_WEIGHT_OPTIONS}
          onChange={(v) => set("fontWeight", Number(v))}
        />
        <SegmentedField label="Alignment" value={props.align} options={ALIGN_OPTIONS} onChange={(v) => set("align", v)} />
        <ColorField id="text-color" label="Color" value={props.color} onChange={(v) => set("color", v)} />
      </Section>
    </>
  );
};
