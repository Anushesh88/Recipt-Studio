import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { CanvasElement, Canvas } from "../schema/templateSchema";
import { DEFAULT_PAGE, GRID_SIZE, MAX_HISTORY, MIN_ELEMENT_SIZE } from "../lib/units";
import { floorToGrid, maxGridPosition, snapToGrid } from "../lib/canvasUtils";

interface EditorSnapshot {
  page: Canvas["page"];
  elements: CanvasElement[];
}

interface EditorState {
  page: Canvas["page"];
  elements: CanvasElement[];
  selectedId: string | null;
  zoom: number;

  past: EditorSnapshot[];
  future: EditorSnapshot[];

  // Actions
  addElement: (el: CanvasElement) => void;
  updateElement: (id: string, updater: (el: CanvasElement) => void) => void;
  moveElement: (id: string, x: number, y: number) => void;
  resizeElement: (id: string, width: number, height: number) => void;
  updateElementGeometry: (id: string, geometry: { x?: number, y?: number, width?: number, height?: number }) => void;
  deleteElement: (id: string) => void;
  reorderElement: (id: string, direction: "up" | "down" | "top" | "bottom") => void;
  loadTemplate: (canvas: Canvas) => void;
  
  setZoom: (zoom: number) => void;
  selectElement: (id: string | null) => void;

  undo: () => void;
  redo: () => void;
}

interface Geometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Snaps only the values being changed, then keeps the box inside the page.
// - Untouched values are kept as-is, so an off-grid size like the 278px table
//   isn't silently resized by a move.
// - Position bounds are floored to the grid, so a snapped position can never land
//   past an edge (page sizes like 302px aren't grid multiples).
// - The bottom edge only applies to fixed-height pages; auto pages grow.
const fitGeometry = (page: Canvas["page"], current: Geometry, change: Partial<Geometry>): Geometry => {
  const snapSize = (v: number) => Math.max(MIN_ELEMENT_SIZE, snapToGrid(v, GRID_SIZE));
  const fixedHeight = page.heightMode === "fixed";

  const width = Math.min(change.width !== undefined ? snapSize(change.width) : current.width, page.width);
  let height = change.height !== undefined ? snapSize(change.height) : current.height;
  if (fixedHeight) height = Math.min(height, page.height);

  let x = Math.max(0, change.x !== undefined ? snapToGrid(change.x, GRID_SIZE) : current.x);
  let y = Math.max(0, change.y !== undefined ? snapToGrid(change.y, GRID_SIZE) : current.y);
  x = Math.min(x, maxGridPosition(page.width, width, GRID_SIZE));
  if (fixedHeight) y = Math.min(y, maxGridPosition(page.height, height, GRID_SIZE));

  return { x, y, width, height };
};

const applyGeometry = (el: CanvasElement, geometry: Geometry) => {
  el.x = geometry.x;
  el.y = geometry.y;
  el.width = geometry.width;
  el.height = geometry.height;
};

// zIndex is informational; keep it mirroring the array (paint) order
const renumberZIndex = (elements: CanvasElement[]) => {
  elements.forEach((e, i) => {
    e.zIndex = i + 1;
  });
};

export const useEditorStore = create<EditorState>()(
  immer((set) => {
    const saveSnapshot = (draft: EditorState) => {
      draft.past.push({
        page: JSON.parse(JSON.stringify(draft.page)),
        elements: JSON.parse(JSON.stringify(draft.elements)),
      });
      if (draft.past.length > MAX_HISTORY) {
        draft.past.shift();
      }
      draft.future = [];
    };

    return {
      page: DEFAULT_PAGE,
      elements: [],
      selectedId: null,
      zoom: 1,

      past: [],
      future: [],

      addElement: (el) =>
        set((draft) => {
          saveSnapshot(draft);
          draft.elements.push(el);
          renumberZIndex(draft.elements);
          draft.selectedId = el.id;
        }),

      updateElement: (id, updater) =>
        set((draft) => {
          saveSnapshot(draft);
          const el = draft.elements.find((e) => e.id === id);
          if (el) {
            updater(el as unknown as CanvasElement);
          }
        }),

      moveElement: (id, x, y) =>
        set((draft) => {
          const el = draft.elements.find((e) => e.id === id);
          if (el) {
            saveSnapshot(draft);
            applyGeometry(el, fitGeometry(draft.page, el, { x, y }));
          }
        }),

      resizeElement: (id, width, height) =>
        set((draft) => {
          const el = draft.elements.find((e) => e.id === id);
          if (el) {
            saveSnapshot(draft);
            // A resize keeps the position and caps the size at the page edge
            const page = draft.page;
            const maxWidth = floorToGrid(page.width - el.x, GRID_SIZE);
            const maxHeight = page.heightMode === "fixed" ? floorToGrid(page.height - el.y, GRID_SIZE) : Infinity;
            applyGeometry(el, fitGeometry(page, el, {
              width: Math.min(width, maxWidth),
              height: Math.min(height, maxHeight),
            }));
          }
        }),

      updateElementGeometry: (id, geometry) =>
        set((draft) => {
          const el = draft.elements.find((e) => e.id === id);
          if (el) {
            saveSnapshot(draft);
            applyGeometry(el, fitGeometry(draft.page, el, geometry));
          }
        }),

      deleteElement: (id) =>
        set((draft) => {
          saveSnapshot(draft);
          draft.elements = draft.elements.filter((e) => e.id !== id);
          renumberZIndex(draft.elements);
          if (draft.selectedId === id) {
            draft.selectedId = null;
          }
        }),

      reorderElement: (id, direction) =>
        set((draft) => {
          const index = draft.elements.findIndex((e) => e.id === id);
          if (index < 0) return;
          
          saveSnapshot(draft);
          const elements = draft.elements;
          const el = elements[index];
          
          elements.splice(index, 1);
          
          if (direction === "up") {
            elements.splice(Math.min(elements.length, index + 1), 0, el);
          } else if (direction === "down") {
            elements.splice(Math.max(0, index - 1), 0, el);
          } else if (direction === "top") {
            elements.push(el);
          } else if (direction === "bottom") {
            elements.unshift(el);
          }
          
          renumberZIndex(elements);
        }),

      loadTemplate: (canvas) =>
        set((draft) => {
          draft.past = [];
          draft.future = [];
          draft.page = canvas.page;
          draft.elements = canvas.elements;
          draft.selectedId = null;
        }),

      setZoom: (zoom) =>
        set((draft) => {
          draft.zoom = zoom;
        }),

      selectElement: (id) =>
        set((draft) => {
          draft.selectedId = id;
        }),

      undo: () =>
        set((draft) => {
          if (draft.past.length === 0) return;
          
          const currentSnapshot: EditorSnapshot = {
            page: JSON.parse(JSON.stringify(draft.page)),
            elements: JSON.parse(JSON.stringify(draft.elements)),
          };
          
          draft.future.push(currentSnapshot);
          
          const previous = draft.past.pop()!;
          draft.page = previous.page;
          draft.elements = previous.elements;
          // Selection might be invalid if element was deleted, we'll just clear it if not found
          if (draft.selectedId && !draft.elements.find(e => e.id === draft.selectedId)) {
            draft.selectedId = null;
          }
        }),

      redo: () =>
        set((draft) => {
          if (draft.future.length === 0) return;
          
          const currentSnapshot: EditorSnapshot = {
            page: JSON.parse(JSON.stringify(draft.page)),
            elements: JSON.parse(JSON.stringify(draft.elements)),
          };
          
          draft.past.push(currentSnapshot);
          
          const next = draft.future.pop()!;
          draft.page = next.page;
          draft.elements = next.elements;
        }),
    };
  })
);
