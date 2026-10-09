import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { CanvasElement, Canvas } from "../schema/templateSchema";
import { DEFAULT_PAGE, GRID_SIZE, MAX_HISTORY } from "../lib/units";

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

const snapToGrid = (val: number) => Math.round(val / GRID_SIZE) * GRID_SIZE;

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
            
            // Clamp within bounds
            const page = draft.page;
            const rightBound = page.width - el.width;
            let clampedX = Math.max(0, Math.min(x, rightBound));
            
            // For fixed height, clamp y as well
            let clampedY = Math.max(0, y);
            if (page.heightMode === "fixed") {
              const bottomBound = page.height - el.height;
              clampedY = Math.min(clampedY, bottomBound);
            }

            el.x = snapToGrid(clampedX);
            el.y = snapToGrid(clampedY);
          }
        }),

      resizeElement: (id, width, height) =>
        set((draft) => {
          const el = draft.elements.find((e) => e.id === id);
          if (el) {
            saveSnapshot(draft);
            
            // Minimum size constraint
            let newWidth = Math.max(8, width);
            let newHeight = Math.max(8, height);
            
            // Clamp within bounds
            const page = draft.page;
            if (el.x + newWidth > page.width) {
              newWidth = page.width - el.x;
            }
            if (page.heightMode === "fixed" && el.y + newHeight > page.height) {
              newHeight = page.height - el.y;
            }

            el.width = snapToGrid(newWidth);
            el.height = snapToGrid(newHeight);
          }
        }),

      updateElementGeometry: (id, geometry) =>
        set((draft) => {
          const el = draft.elements.find((e) => e.id === id);
          if (el) {
            saveSnapshot(draft);
            
            let newWidth = geometry.width !== undefined ? Math.max(8, geometry.width) : el.width;
            let newHeight = geometry.height !== undefined ? Math.max(8, geometry.height) : el.height;
            let newX = geometry.x !== undefined ? geometry.x : el.x;
            let newY = geometry.y !== undefined ? geometry.y : el.y;

            const page = draft.page;
            
            // clamp width and x
            const rightBound = page.width - newWidth;
            newX = Math.max(0, Math.min(newX, rightBound));
            
            if (newX + newWidth > page.width) {
              newWidth = page.width - newX;
            }

            // clamp height and y (if fixed)
            if (page.heightMode === "fixed") {
              const bottomBound = page.height - newHeight;
              newY = Math.max(0, Math.min(newY, bottomBound));
              if (newY + newHeight > page.height) {
                newHeight = page.height - newY;
              }
            } else {
              newY = Math.max(0, newY);
            }

            el.x = snapToGrid(newX);
            el.y = snapToGrid(newY);
            el.width = snapToGrid(newWidth);
            el.height = snapToGrid(newHeight);
          }
        }),

      deleteElement: (id) =>
        set((draft) => {
          saveSnapshot(draft);
          draft.elements = draft.elements.filter((e) => e.id !== id);
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
          
          // Reassign zIndex informatively based on array order
          elements.forEach((e, i) => {
            e.zIndex = i + 1;
          });
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
