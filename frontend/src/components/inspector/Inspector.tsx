import React from "react";
import { useEditorStore } from "../../store/editorStore";
import { ElementInspector } from "./ElementInspector";
import { PagePanel } from "./PagePanel";

// Right sidebar: the selected element's properties, or the page settings.
// data-inspector lets the editor's keyboard shortcuts ignore keys typed here.
export const InspectorContent: React.FC = () => {
  const selected = useEditorStore((s) => s.elements.find((e) => e.id === s.selectedId));
  // keyed so field drafts reset when the selection changes
  return selected ? <ElementInspector key={selected.id} element={selected} /> : <PagePanel />;
};

export const Inspector: React.FC = () => (
  <aside data-inspector="" aria-label="Inspector" className="w-80 shrink-0 overflow-y-auto border-l border-border bg-white">
    <InspectorContent />
  </aside>
);
