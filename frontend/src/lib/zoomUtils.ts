export interface ZoomAtPointParams {
  zoom: number;
  newZoom: number;
  cursorX: number;
  cursorY: number;
  scrollLeft: number;
  scrollTop: number;
  contentOffsetX: number;
  contentOffsetY: number;
}

export interface ZoomAtPointResult {
  scrollLeft: number;
  scrollTop: number;
}

/**
 * Computes new scrollLeft and scrollTop so that the content point under (cursorX, cursorY)
 * remains stationary when scaling from zoom to newZoom.
 */
export function zoomAtPoint({
  zoom,
  newZoom,
  cursorX,
  cursorY,
  scrollLeft,
  scrollTop,
  contentOffsetX,
  contentOffsetY,
}: ZoomAtPointParams): ZoomAtPointResult {
  if (zoom <= 0) {
    return { scrollLeft, scrollTop };
  }

  const relativeContentX = cursorX + scrollLeft - contentOffsetX;
  const relativeContentY = cursorY + scrollTop - contentOffsetY;

  const scaleRatio = newZoom / zoom;

  const nextScrollLeft = contentOffsetX + relativeContentX * scaleRatio - cursorX;
  const nextScrollTop = contentOffsetY + relativeContentY * scaleRatio - cursorY;

  return {
    scrollLeft: Math.max(0, Math.round(nextScrollLeft)),
    scrollTop: Math.max(0, Math.round(nextScrollTop)),
  };
}
