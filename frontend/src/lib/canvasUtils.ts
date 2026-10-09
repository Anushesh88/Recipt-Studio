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
    x: Math.max(0, Math.round(unscaledX / gridSize) * gridSize),
    y: Math.max(0, Math.round(unscaledY / gridSize) * gridSize),
  };
}

// Keeps a box fully inside the page. Max bounds are floored to the grid so a
// snapped position never overshoots the page edge.
export function clampToPage(
  x: number,
  y: number,
  width: number,
  height: number,
  page: { width: number; height: number },
  gridSize: number
): { x: number; y: number } {
  const maxX = Math.max(0, Math.floor((page.width - width) / gridSize) * gridSize);
  const maxY = Math.max(0, Math.floor((page.height - height) / gridSize) * gridSize);
  return {
    x: Math.min(Math.max(0, x), maxX),
    y: Math.min(Math.max(0, y), maxY),
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
