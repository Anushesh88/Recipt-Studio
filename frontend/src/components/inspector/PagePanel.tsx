import React from "react";
import { useEditorStore } from "../../store/editorStore";
import {
  DOCUMENT_TYPE_LABELS,
  GRID_SIZE,
  MAX_DESIGN_HEIGHT,
  MIN_DESIGN_HEIGHT,
  PAGE_PRESET_LABELS,
  PAGE_PRESETS,
  type DocumentType,
  type PagePreset,
} from "../../lib/units";
import { ColorField, Field, NumberField, Section, SelectField } from "./fields";
import { GstChecklist } from "./GstChecklist";

const DOCUMENT_OPTIONS = (Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]).map((value) => ({
  value,
  label: DOCUMENT_TYPE_LABELS[value],
}));

const PRESET_OPTIONS = (Object.keys(PAGE_PRESETS) as PagePreset[]).map((preset) => ({
  value: preset,
  label: PAGE_PRESET_LABELS[preset],
}));

// Shown when nothing is selected
export const PagePanel: React.FC = () => {
  const page = useEditorStore((s) => s.page);
  const setPagePreset = useEditorStore((s) => s.setPagePreset);
  const updatePage = useEditorStore((s) => s.updatePage);
  const documentType = useEditorStore((s) => s.documentType);
  const setDocumentType = useEditorStore((s) => s.setDocumentType);

  return (
    <>
      <Section title="Document">
        <SelectField
          id="document-type"
          label="Type"
          value={documentType}
          options={DOCUMENT_OPTIONS}
          onChange={setDocumentType}
          hint={documentType === "receipt"
            ? "A plain receipt. Pick GST tax invoice if you're GST-registered and need rule 46's details."
            : undefined}
        />
        {documentType === "gst_invoice" && <GstChecklist />}
      </Section>
      <Section title="Page">
        <SelectField
          id="page-preset"
          label="Page size"
          value={page.preset}
          options={PRESET_OPTIONS}
          onChange={setPagePreset}
          hint={page.heightMode === "auto"
            ? "Thermal receipts grow with the number of line items."
            : "Fixed size, single page. Content that doesn't fit is an error at export."}
        />
        {page.heightMode === "auto" ? (
          <NumberField
            id="page-height"
            label="Design height (px)"
            value={page.height}
            min={MIN_DESIGN_HEIGHT}
            max={MAX_DESIGN_HEIGHT}
            step={GRID_SIZE}
            onCommit={(height) => updatePage({ height })}
            hint="Room to lay out elements; it can't go below the lowest element."
          />
        ) : (
          <Field label="Size">
            <p className="text-sm">{page.width} × {page.height} px</p>
          </Field>
        )}
        <ColorField id="page-background" label="Background" value={page.background} onChange={(background) => updatePage({ background })} />
      </Section>
      <Section title="Tips">
        <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
          <li>Drag elements from the left onto the page.</li>
          <li>Click an element to edit it here; double-click text to type on the canvas.</li>
          <li>Ctrl+Z / Ctrl+Y undo and redo, Delete removes, Ctrl+[ / Ctrl+] change order.</li>
        </ul>
      </Section>
    </>
  );
};
