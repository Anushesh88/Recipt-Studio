export function computeDropCoords(
  activeRectLeft: number,
  activeRectTop: number,
  overRectLeft: number,
  overRectTop: number,
  zoom: number,
  gridSize: number
): { x: number; y: number } {
  const unscaledX = (activeRectLeft - overRectLeft) / zoom;
  const unscaledY = (activeRectTop - overRectTop) / zoom;
  return {
    x: Math.max(0, Math.round(unscaledX / gridSize) * gridSize),
    y: Math.max(0, Math.round(unscaledY / gridSize) * gridSize),
  };
}
