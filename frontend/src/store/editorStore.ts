import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { CanvasElement, Canvas } from "../schema/templateSchema";
import {
  DEFAULT_PAGE,
  GRID_SIZE,
  ITEMS_TABLE_SAMPLE_ROWS,
  MAX_DESIGN_HEIGHT,
  MAX_HISTORY,
  MIN_DESIGN_HEIGHT,
  MIN_ELEMENT_SIZE,
  PAGE_PRESETS,
  type PagePreset,
} from "../lib/units";
import { floorToGrid, maxGridPosition, snapToGrid } from "../lib/canvasUtils";
import { tableHeight } from "../lib/layout";

interface EditorSnapshot {
  page: Canvas["page"];
  elements: CanvasElement[];
}

interface EditorState {
  page: Canvas["page"];
  elements: CanvasElement[];
  selectedId: string | null;
  // Text element being edited inline on the canvas (double-click)
  editingId: string | null;
  zoom: number;

  past: EditorSnapshot[];
  future: EditorSnapshot[];
  // See saveSnapshot: consecutive edits with this key share one undo step
  lastCoalesceKey: string | null;

  // Actions
  addElement: (el: CanvasElement) => void;
  updateElement: (id: string, updater: (el: CanvasElement) => void, options?: { coalesceKey?: string }) => void;
  moveElement: (id: string, x: number, y: number) => void;
  resizeElement: (id: string, width: number, height: number) => void;
  updateElementGeometry: (id: string, geometry: { x?: number, y?: number, width?: number, height?: number }) => void;
  deleteElement: (id: string) => void;
  reorderElement: (id: string, direction: "up" | "down" | "top" | "bottom") => void;
  loadTemplate: (canvas: Canvas) => void;
  setPagePreset: (preset: PagePreset) => void;
  updatePage: (changes: { background?: string; height?: number }) => void;

  setZoom: (zoom: number) => void;
  selectElement: (id: string | null) => void;
  setEditingId: (id: string | null) => void;

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
// - Fixed pages end at their height. Auto-height pages end at the largest design
//   height, and their design height grows to fit (fitAutoPage).
const fitGeometry = (page: Canvas["page"], current: Geometry, change: Partial<Geometry>): Geometry => {
  const snapSize = (v: number) => Math.max(MIN_ELEMENT_SIZE, snapToGrid(v, GRID_SIZE));
  const bottom = pageBottomLimit(page);

  const width = Math.min(change.width !== undefined ? snapSize(change.width) : current.width, page.width);
  const height = Math.min(change.height !== undefined ? snapSize(change.height) : current.height, bottom);

  let x = Math.max(0, change.x !== undefined ? snapToGrid(change.x, GRID_SIZE) : current.x);
  let y = Math.max(0, change.y !== undefined ? snapToGrid(change.y, GRID_SIZE) : current.y);
  x = Math.min(x, maxGridPosition(page.width, width, GRID_SIZE));
  y = Math.min(y, maxGridPosition(bottom, height, GRID_SIZE));

  return { x, y, width, height };
};

const applyGeometry = (el: CanvasElement, geometry: Geometry) => {
  el.x = geometry.x;
  el.y = geometry.y;
  el.width = geometry.width;
  el.height = geometry.height;
};

// Keeps derived geometry in step with props, and the element inside the page.
// The items table's height is always header + sample rows (the Layout Algorithm's
// designed_h), so it follows font size / line height / row padding changes.
const normalizeElement = (page: Canvas["page"], el: CanvasElement) => {
  if (el.type === "items_table") {
    el.height = tableHeight(el.props, ITEMS_TABLE_SAMPLE_ROWS);
  }
  applyGeometry(el, fitGeometry(page, el, {}));
};

// Lowest element edge, rounded up to the grid
const contentBottom = (elements: CanvasElement[]) =>
  Math.ceil(Math.max(0, ...elements.map((e) => e.y + e.height)) / GRID_SIZE) * GRID_SIZE;

// How far down elements may go
const pageBottomLimit = (page: Canvas["page"]) => (page.heightMode === "fixed" ? page.height : MAX_DESIGN_HEIGHT);

// An auto-height page's design height, grown to fit its elements: anything below
// it would be cut off in the preview and the PDF
const fittedPageHeight = (page: Canvas["page"], elements: CanvasElement[]) =>
  page.heightMode === "auto"
    ? Math.max(page.height, Math.min(MAX_DESIGN_HEIGHT, contentBottom(elements)))
    : page.height;

const fitAutoPage = (draft: { page: Canvas["page"]; elements: CanvasElement[] }) => {
  const height = fittedPageHeight(draft.page, draft.elements);
  if (height !== draft.page.height) draft.page.height = height;
};

// zIndex is informational; keep it mirroring the array (paint) order
const renumberZIndex = (elements: CanvasElement[]) => {
  elements.forEach((e, i) => {
    e.zIndex = i + 1;
  });
};

// After undo/redo the selected / edited element may no longer exist
const clearMissingSelection = (draft: EditorState) => {
  const exists = (id: string | null) => id !== null && draft.elements.some((e) => e.id === id);
  if (!exists(draft.selectedId)) draft.selectedId = null;
  if (!exists(draft.editingId)) draft.editingId = null;
};

export const useEditorStore = create<EditorState>()(
  immer((set) => {
    // Consecutive edits with the same coalesceKey (typing in one inspector field,
    // or one inline-editing session) share a single undo step.
    const saveSnapshot = (draft: EditorState, coalesceKey?: string) => {
      if (coalesceKey !== undefined && draft.lastCoalesceKey === coalesceKey) return;
      draft.lastCoalesceKey = coalesceKey ?? null;
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
      editingId: null,
      zoom: 1,

      past: [],
      future: [],
      lastCoalesceKey: null,

      addElement: (el) =>
        set((draft) => {
          saveSnapshot(draft);
          draft.elements.push(el);
          renumberZIndex(draft.elements);
          fitAutoPage(draft);
          draft.selectedId = el.id;
        }),

      updateElement: (id, updater, options) =>
        set((draft) => {
          const el = draft.elements.find((e) => e.id === id);
          if (el) {
            saveSnapshot(draft, options?.coalesceKey);
            updater(el);
            normalizeElement(draft.page, el);
            fitAutoPage(draft);
          }
        }),

      moveElement: (id, x, y) =>
        set((draft) => {
          const el = draft.elements.find((e) => e.id === id);
          if (el) {
            saveSnapshot(draft);
            applyGeometry(el, fitGeometry(draft.page, el, { x, y }));
            fitAutoPage(draft);
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
            const maxHeight = floorToGrid(pageBottomLimit(page) - el.y, GRID_SIZE);
            applyGeometry(el, fitGeometry(page, el, {
              width: Math.min(width, maxWidth),
              // the items table's height is derived from its rows
              height: el.type === "items_table" ? undefined : Math.min(height, maxHeight),
            }));
            fitAutoPage(draft);
          }
        }),

      updateElementGeometry: (id, geometry) =>
        set((draft) => {
          const el = draft.elements.find((e) => e.id === id);
          if (el) {
            saveSnapshot(draft);
            // the items table's height is derived from its rows
            const change = el.type === "items_table" ? { ...geometry, height: undefined } : geometry;
            applyGeometry(el, fitGeometry(draft.page, el, change));
            fitAutoPage(draft);
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
          if (draft.editingId === id) {
            draft.editingId = null;
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
          draft.lastCoalesceKey = null;
          // Templates saved before pages grew to fit could have elements below the page
          const height = fittedPageHeight(canvas.page, canvas.elements);
          draft.page = height === canvas.page.height ? canvas.page : { ...canvas.page, height };
          draft.elements = canvas.elements;
          draft.selectedId = null;
          draft.editingId = null;
        }),

      setPagePreset: (preset) =>
        set((draft) => {
          if (draft.page.preset === preset) return;
          saveSnapshot(draft);
          const next: Canvas["page"] = { ...PAGE_PRESETS[preset], background: draft.page.background };
          draft.page = next;
          // Fixed pages pull elements back inside; narrower pages cap widths.
          // Thermal pages grow instead, keeping every element rather than squashing them
          draft.elements.forEach((el) => normalizeElement(next, el));
          fitAutoPage(draft);
        }),

      updatePage: (changes) =>
        set((draft) => {
          saveSnapshot(draft, "page:" + Object.keys(changes).sort().join(","));
          if (changes.background !== undefined) {
            draft.page.background = changes.background;
          }
          // Only an auto-height page's design height is editable, and never below its content
          if (changes.height !== undefined && draft.page.heightMode === "auto") {
            const min = Math.max(MIN_DESIGN_HEIGHT, contentBottom(draft.elements));
            draft.page.height = Math.min(MAX_DESIGN_HEIGHT, Math.max(min, snapToGrid(changes.height, GRID_SIZE)));
          }
        }),

      setZoom: (zoom) =>
        set((draft) => {
          draft.zoom = zoom;
        }),

      selectElement: (id) =>
        set((draft) => {
          draft.selectedId = id;
          if (draft.editingId !== id) {
            draft.editingId = null;
          }
        }),

      setEditingId: (id) =>
        set((draft) => {
          draft.editingId = id;
          if (id) {
            draft.selectedId = id;
          }
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
          draft.lastCoalesceKey = null;
          clearMissingSelection(draft);
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
          draft.lastCoalesceKey = null;
          clearMissingSelection(draft);
        }),
    };
  })
);
