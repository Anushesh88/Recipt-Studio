import React, { useEffect, useCallback, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  type DragEndEvent,
  type DragStartEvent,
  type Modifier,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Palette, PaletteDragPreview } from "../components/palette/Palette";
import { Canvas } from "../components/canvas/Canvas";
import { Inspector } from "../components/inspector/Inspector";
import { useEditorStore } from "../store/editorStore";
import { DEFAULT_ELEMENTS, GRID_SIZE, TOAST_DURATION_MS } from "../lib/units";
import { clampToPage, computeDropCoords, getEventClientCoords } from "../lib/canvasUtils";
import { generateId } from "../lib/ids";
import type { CanvasElement } from "../schema/templateSchema";

if (typeof window !== "undefined") {
  (window as unknown as Window & { __editorStore?: typeof useEditorStore }).__editorStore = useEditorStore;
}

// Focus targets where the editor's keyboard shortcuts don't apply: form fields,
// the inspector, and popover / dropdown content (rendered in portals)
const SHORTCUT_EXEMPT_SELECTOR =
  "input, textarea, select, [contenteditable='true'], [data-inspector], [data-variable-menu], [role='listbox'], [role='dialog']";

// Pins the drag preview's top-left to the cursor, which is exactly where the
// element lands on drop (instead of wherever the palette tile was grabbed).
const snapTopLeftToCursor: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
  if (!activatorEvent || !draggingNodeRect) return transform;
  const pointer = getEventClientCoords(activatorEvent);
  if (!pointer) return transform;
  return {
    ...transform,
    x: transform.x + pointer.x - draggingNodeRect.left,
    y: transform.y + pointer.y - draggingNodeRect.top,
  };
};

export const Editor: React.FC = () => {
  const addElement = useEditorStore((state) => state.addElement);
  const elements = useEditorStore((state) => state.elements);
  const page = useEditorStore((state) => state.page);
  const zoom = useEditorStore((state) => state.zoom);
  const setZoom = useEditorStore((state) => state.setZoom);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const deleteElement = useEditorStore((state) => state.deleteElement);
  const selectedId = useEditorStore((state) => state.selectedId);
  const reorderElement = useEditorStore((state) => state.reorderElement);

  const [toast, setToast] = useState<string | null>(null);
  const [draggingType, setDraggingType] = useState<CanvasElement["type"] | null>(null);
  // Live pointer position during a palette drag. DragEndEvent.delta can't be used:
  // dnd-kit folds the canvas scroll container's offsets into it, which threw drops
  // hundreds of px away from the cursor.
  const pointerRef = useRef<{ x: number; y: number } | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  useEffect(() => {
    if (!draggingType) return;
    const trackPointer = (ev: Event) => {
      const coords = getEventClientCoords(ev);
      if (coords) pointerRef.current = coords;
    };
    window.addEventListener("pointermove", trackPointer);
    window.addEventListener("touchmove", trackPointer);
    return () => {
      window.removeEventListener("pointermove", trackPointer);
      window.removeEventListener("touchmove", trackPointer);
    };
  }, [draggingType]);

  const handleDragStart = (e: DragStartEvent) => {
    const type = e.active.data.current?.type as CanvasElement["type"] | undefined;
    pointerRef.current = getEventClientCoords(e.activatorEvent);
    setDraggingType(type ?? null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setDraggingType(null);
    const pointer = pointerRef.current;
    pointerRef.current = null;
    const { active, over } = e;
    if (!over || over.id !== "canvas") return;

    const type = active.data.current?.type as CanvasElement["type"];
    if (!type) return;

    if (type === "items_table" && elements.some((el) => el.type === "items_table")) {
      setToast("Only one items table is allowed.");
      setTimeout(() => setToast(null), TOAST_DURATION_MS);
      return;
    }
    if (type === "totals" && elements.some((el) => el.type === "totals")) {
      setToast("Only one totals element is allowed.");
      setTimeout(() => setToast(null), TOAST_DURATION_MS);
      return;
    }

    // Drop point = where the pointer was released
    if (!pointer || !over.rect) return;

    const dropped = computeDropCoords(
      pointer.x,
      pointer.y,
      over.rect.left,
      over.rect.top,
      zoom,
      GRID_SIZE
    );

    const defaults = DEFAULT_ELEMENTS[type];
    const { x, y } = clampToPage(dropped.x, dropped.y, defaults.width, defaults.height, page, GRID_SIZE);
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
    // Leave keys alone while typing or using the inspector / menus, so e.g.
    // Backspace in a field or on a dropdown never deletes the selected element
    if (e.target instanceof Element && e.target.closest(SHORTCUT_EXEMPT_SELECTOR)) {
      return;
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
    <DndContext
      sensors={sensors}
      // Drops are positioned at the pointer, so "over the canvas" must mean the pointer is over it
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setDraggingType(null);
        pointerRef.current = null;
      }}
    >
      <div className="flex h-screen w-full flex-col overflow-hidden">
        <header className="h-14 border-b border-gray-200 bg-white flex items-center px-4 justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Link to="/templates" className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
              <ChevronLeft className="size-4" />
              Templates
            </Link>
            <div className="w-px h-6 bg-gray-300" />
            <h1 className="font-bold text-lg">Receipt Studio · Editor</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(1)}
              className="px-2 py-1 text-xs border rounded bg-gray-50 hover:bg-gray-100 font-medium"
            >
              100%
            </button>
            <div className="w-px h-6 bg-gray-300 mx-2" />
            <button onClick={undo} className="px-3 py-1 border rounded">Undo</button>
            <button onClick={redo} className="px-3 py-1 border rounded">Redo</button>
          </div>
        </header>
        
        <div className="flex flex-1 overflow-hidden">
          <Palette />
          <Canvas />
          <Inspector />
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

      <DragOverlay dropAnimation={null} modifiers={[snapTopLeftToCursor]}>
        {draggingType ? <PaletteDragPreview type={draggingType} zoom={zoom} /> : null}
      </DragOverlay>
    </DndContext>
  );
};
