import React from "react";
import { BringToFront, ChevronDown, ChevronUp, SendToBack, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "../../store/editorStore";
import type { CanvasElement } from "../../schema/templateSchema";
import { ELEMENT_LABELS, MAX_DESIGN_HEIGHT, MIN_ELEMENT_SIZE } from "../../lib/units";
import { CheckboxField, NumberField, Section } from "./fields";
import { TextPanel } from "./TextPanel";
import { ImagePanel } from "./ImagePanel";
import { TablePanel } from "./TablePanel";
import { TotalsPanel } from "./TotalsPanel";
import { QrPanel } from "./QrPanel";
import { SignaturePanel } from "./SignaturePanel";
import { DividerPanel } from "./DividerPanel";

// Height that's derived rather than set by hand
const FIXED_HEIGHT_HINT: Partial<Record<CanvasElement["type"], string>> = {
  items_table: "Set by the rows (header + sample rows).",
  divider: "Dividers are a fixed-height strip.",
};

const TypePanel: React.FC<{ element: CanvasElement }> = ({ element }) => {
  switch (element.type) {
    case "text":
      return <TextPanel element={element} />;
    case "image":
      return <ImagePanel element={element} />;
    case "items_table":
      return <TablePanel element={element} />;
    case "totals":
      return <TotalsPanel element={element} />;
    case "qr":
      return <QrPanel element={element} />;
    case "signature":
      return <SignaturePanel element={element} />;
    case "divider":
      return <DividerPanel element={element} />;
  }
};

export const ElementInspector: React.FC<{ element: CanvasElement }> = ({ element }) => {
  const page = useEditorStore((s) => s.page);
  const updateElementGeometry = useEditorStore((s) => s.updateElementGeometry);
  const updateElement = useEditorStore((s) => s.updateElement);
  const reorderElement = useEditorStore((s) => s.reorderElement);
  const deleteElement = useEditorStore((s) => s.deleteElement);
  const index = useEditorStore((s) => s.elements.findIndex((e) => e.id === element.id));
  const count = useEditorStore((s) => s.elements.length);

  const geometry = (key: "x" | "y" | "width" | "height") => (value: number) =>
    updateElementGeometry(element.id, { [key]: value });
  const heightHint = FIXED_HEIGHT_HINT[element.type];
  const maxY = page.heightMode === "fixed" ? page.height : MAX_DESIGN_HEIGHT;

  return (
    <>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-semibold">{ELEMENT_LABELS[element.type]}</h2>
        <Button type="button" variant="destructive" size="xs" onClick={() => deleteElement(element.id)}>
          <Trash2 />
          Delete
        </Button>
      </div>

      <TypePanel element={element} />

      <Section title="Position & size">
        <div className="grid grid-cols-2 gap-2">
          <NumberField id="geom-x" label="X" value={element.x} min={0} max={page.width} onCommit={geometry("x")} />
          <NumberField id="geom-y" label="Y" value={element.y} min={0} max={maxY} onCommit={geometry("y")} />
          <NumberField id="geom-w" label="Width" value={element.width} min={MIN_ELEMENT_SIZE} max={page.width} onCommit={geometry("width")} />
          <NumberField
            id="geom-h"
            label="Height"
            value={element.height}
            min={MIN_ELEMENT_SIZE}
            max={maxY}
            disabled={heightHint !== undefined}
            onCommit={geometry("height")}
          />
        </div>
        {heightHint && <p className="text-xs text-muted-foreground">{heightHint}</p>}
        <p className="text-xs text-muted-foreground">
          {page.heightMode === "fixed"
            ? "Values snap to the 4 px grid and stay inside the page."
            : "Values snap to the 4 px grid; the page grows to fit."}
        </p>
        <CheckboxField
          id="geom-locked"
          label="Lock position and size"
          checked={element.locked}
          onChange={(locked) => updateElement(element.id, (draft) => { draft.locked = locked; })}
        />
      </Section>

      <Section title="Arrange">
        <div className="flex flex-wrap gap-1">
          <Button type="button" variant="outline" size="xs" disabled={index === count - 1} onClick={() => reorderElement(element.id, "top")}>
            <BringToFront />
            To front
          </Button>
          <Button type="button" variant="outline" size="xs" disabled={index === count - 1} onClick={() => reorderElement(element.id, "up")}>
            <ChevronUp />
            Forward
          </Button>
          <Button type="button" variant="outline" size="xs" disabled={index === 0} onClick={() => reorderElement(element.id, "down")}>
            <ChevronDown />
            Backward
          </Button>
          <Button type="button" variant="outline" size="xs" disabled={index === 0} onClick={() => reorderElement(element.id, "bottom")}>
            <SendToBack />
            To back
          </Button>
        </div>
      </Section>
    </>
  );
};
