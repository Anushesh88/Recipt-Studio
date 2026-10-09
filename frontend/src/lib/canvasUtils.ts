// Converts a screen-space pointer position into unscaled, grid-snapped page coordinates
export function computeDropCoords(
  pointerX: number,
  pointerY: number,
  canvasLeft: number,
  canvasTop: number,
  zoom: number,
  gridSize: number
): { x: number; y: number } {
  const unscaledX = (pointerX - canvasLeft) / zoom;
  const unscaledY = (pointerY - canvasTop) / zoom;
  return {
    x: Math.max(0, snapToGrid(unscaledX, gridSize)),
    y: Math.max(0, snapToGrid(unscaledY, gridSize)),
  };
}

export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

export const floorToGrid = (value: number, gridSize: number) => Math.floor(value / gridSize) * gridSize;

// Largest on-grid position at which a box of `size` still fits within `extent`.
// Flooring (rather than snapping) matters because page sizes like 302px aren't
// multiples of the grid: snapping 302 - 200 = 102 up to 104 would overshoot.
export const maxGridPosition = (extent: number, size: number, gridSize: number) =>
  Math.max(0, floorToGrid(extent - size, gridSize));

// Keeps an already-snapped box fully inside the page, staying on the grid
export function clampToPage(
  x: number,
  y: number,
  width: number,
  height: number,
  page: { width: number; height: number },
  gridSize: number
): { x: number; y: number } {
  return {
    x: Math.min(Math.max(0, x), maxGridPosition(page.width, width, gridSize)),
    y: Math.min(Math.max(0, y), maxGridPosition(page.height, height, gridSize)),
  };
}

// Client coordinates of a mouse, pointer or touch event (e.g. dnd-kit's activatorEvent)
export function getEventClientCoords(event: Event): { x: number; y: number } | null {
  if ("touches" in event) {
    const touchEvent = event as TouchEvent;
    const touch = touchEvent.touches[0] ?? touchEvent.changedTouches[0];
    return touch ? { x: touch.clientX, y: touch.clientY } : null;
  }
  if ("clientX" in event) {
    const mouseEvent = event as MouseEvent;
    return { x: mouseEvent.clientX, y: mouseEvent.clientY };
  }
  return null;
}
