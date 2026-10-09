import { describe, it, expect } from 'vitest';
import { zoomAtPoint } from './zoomUtils';

describe('zoomAtPoint', () => {
  it('correctly calculates new scroll position when zooming in', () => {
    // Zoom in from 1.0 to 2.0 with cursor at (200, 150)
    const result = zoomAtPoint({
      zoom: 1.0,
      newZoom: 2.0,
      cursorX: 200,
      cursorY: 150,
      scrollLeft: 100,
      scrollTop: 50,
      contentOffsetX: 50,
      contentOffsetY: 50,
    });

    // Content point before zoom:
    // X = 200 + 100 - 50 = 250 (in content units)
    // Y = 150 + 50 - 50 = 150 (in content units)
    // At newZoom (2.0):
    // Next scroll coordinate X = 50 + 250 * 2 = 550
    // newScrollLeft = 550 - 200 = 350
    // Next scroll coordinate Y = 50 + 150 * 2 = 350
    // newScrollTop = 350 - 150 = 200
    expect(result.scrollLeft).toBe(350);
    expect(result.scrollTop).toBe(200);
  });

  it('correctly calculates new scroll position when zooming out', () => {
    // Zoom out from 2.0 to 1.0 with cursor at (200, 150)
    const result = zoomAtPoint({
      zoom: 2.0,
      newZoom: 1.0,
      cursorX: 200,
      cursorY: 150,
      scrollLeft: 350,
      scrollTop: 200,
      contentOffsetX: 50,
      contentOffsetY: 50,
    });

    // Inverse of previous: returns to 100, 50
    expect(result.scrollLeft).toBe(100);
    expect(result.scrollTop).toBe(50);
  });

  it('handles zooming at the edges (cursor at 0, 0)', () => {
    const result = zoomAtPoint({
      zoom: 1.0,
      newZoom: 1.5,
      cursorX: 0,
      cursorY: 0,
      scrollLeft: 0,
      scrollTop: 0,
      contentOffsetX: 0,
      contentOffsetY: 0,
    });

    expect(result.scrollLeft).toBe(0);
    expect(result.scrollTop).toBe(0);
  });

  it('clamps scrollLeft and scrollTop to zero when calculation results in negative scroll', () => {
    // Zoom out significantly from 1.0 to 0.5 with scroll at 0 and cursor at 300
    const result = zoomAtPoint({
      zoom: 1.0,
      newZoom: 0.5,
      cursorX: 300,
      cursorY: 300,
      scrollLeft: 0,
      scrollTop: 0,
      contentOffsetX: 100,
      contentOffsetY: 100,
    });

    // relativeContentX = 300 + 0 - 100 = 200
    // nextScrollLeft = 100 + 200 * 0.5 - 300 = 100 + 100 - 300 = -100 -> clamped to 0
    expect(result.scrollLeft).toBe(0);
    expect(result.scrollTop).toBe(0);
  });
});
