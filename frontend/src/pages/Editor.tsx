import React, { useEffect, useCallback, useState } from "react";
import { DndContext, type DragEndEvent, MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Palette } from "../components/palette/Palette";
import { Canvas } from "../components/canvas/Canvas";
import { useEditorStore } from "../store/editorStore";
import { DEFAULT_ELEMENTS, GRID_SIZE } from "../lib/units";
import { computeDropCoords } from "../lib/canvasUtils";
import { generateId } from "../lib/ids";
import type { CanvasElement } from "../schema/templateSchema";

export const Editor: React.FC = () => {
  const addElement = useEditorStore((state) => state.addElement);
  const elements = useEditorStore((state) => state.elements);
  const zoom = useEditorStore((state) => state.zoom);
  const setZoom = useEditorStore((state) => state.setZoom);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const deleteElement = useEditorStore((state) => state.deleteElement);
  const selectedId = useEditorStore((state) => state.selectedId);
  const reorderElement = useEditorStore((state) => state.reorderElement);

  const [toast, setToast] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || over.id !== "canvas") return;

    const type = active.data.current?.type as CanvasElement["type"];
    if (!type) return;

    if (type === "items_table" && elements.some((el) => el.type === "items_table")) {
      setToast("Only one items table is allowed.");
      setTimeout(() => setToast(null), 3000);
      return;
    }
    if (type === "totals" && elements.some((el) => el.type === "totals")) {
      setToast("Only one totals element is allowed.");
      setTimeout(() => setToast(null), 3000);
      return;
    }

    if (!active.rect.current.translated || !over.rect) return;

    const { x, y } = computeDropCoords(
      active.rect.current.translated.left,
      active.rect.current.translated.top,
      over.rect.left,
      over.rect.top,
      zoom,
      GRID_SIZE
    );

    const defaults = DEFAULT_ELEMENTS[type];
    const newElement: CanvasElement = {
      id: generateId(),
      type,
      x,
      y,
      zIndex: elements.length + 1,
      ...defaults,
    } as CanvasElement;

    addElement(newElement);
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return; // Do not intercept if typing in an input
    }
    
    if (e.key === "Delete" || e.key === "Backspace") {
      if (selectedId) {
        deleteElement(selectedId);
      }
    } else if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
    } else if (e.key === "y" && (e.ctrlKey || e.metaKey)) {
      redo();
    } else if (e.key === "]" && (e.ctrlKey || e.metaKey)) {
      if (selectedId) reorderElement(selectedId, "up");
    } else if (e.key === "[" && (e.ctrlKey || e.metaKey)) {
      if (selectedId) reorderElement(selectedId, "down");
    }
  }, [selectedId, deleteElement, undo, redo, reorderElement]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex h-screen w-full flex-col overflow-hidden">
        <header className="h-14 border-b border-gray-200 bg-white flex items-center px-4 justify-between shrink-0">
          <h1 className="font-bold text-lg">Receipt Studio - Editor (Phase 2)</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => setZoom(Math.max(0.5, zoom - 0.1))} className="px-2 py-1 border rounded">-</button>
            <span className="text-sm">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(Math.min(2, zoom + 0.1))} className="px-2 py-1 border rounded">+</button>
            <div className="w-px h-6 bg-gray-300 mx-2" />
            <button onClick={undo} className="px-3 py-1 border rounded">Undo</button>
            <button onClick={redo} className="px-3 py-1 border rounded">Redo</button>
          </div>
        </header>
        
        <div className="flex flex-1 overflow-hidden">
          <Palette />
          <Canvas />
          {/* Phase 3 Inspector will go on the right */}
        </div>

        {toast && (
          <div className="fixed bottom-12 left-1/2 transform -translate-x-1/2 bg-red-600 text-white font-bold text-lg px-6 py-4 rounded-lg shadow-2xl z-[100] flex items-center justify-between min-w-[300px] pointer-events-auto animate-bounce border-2 border-red-800">
            <span>{toast}</span>
            <button onClick={() => setToast(null)} className="ml-4 text-white hover:text-red-200 focus:outline-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </DndContext>
  );
};
