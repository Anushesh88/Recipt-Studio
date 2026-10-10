import React, { useRef, useEffect, useCallback } from "react";
import { BrandStrip } from "../brand/BrandStrip";
import { BRAND_STRIP_HEIGHT } from "../../lib/layout";
import { useDroppable } from "@dnd-kit/core";
import { useEditorStore } from "../../store/editorStore";
import { CanvasElementNode } from "./CanvasElementNode";
import {
  ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_SENSITIVITY,
  ZOOM_EPSILON,
  WORKSPACE_SIZE,
  WORKSPACE_PAGE_ORIGIN,
} from "../../lib/units";
import { zoomAtPoint } from "../../lib/zoomUtils";

export const Canvas: React.FC = () => {
  const page = useEditorStore((state) => state.page);
  const elementIds = useEditorStore((state) => state.elements.map((el) => el.id).join(","));
  const zoom = useEditorStore((state) => state.zoom);
  const setZoom = useEditorStore((state) => state.setZoom);
  const selectElement = useEditorStore((state) => state.selectElement);

  const { setNodeRef } = useDroppable({
    id: "canvas",
  });

  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const contentWrapperRef = useRef<HTMLDivElement>(null);
  const rafId = useRef<number | null>(null);

  // Combine drop ref and local ref
  const setRefs = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    (canvasRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  };

  // Center page on 100% reset
  const resetZoomAndCenter = useCallback(() => {
    setZoom(1);
    if (containerRef.current && contentWrapperRef.current) {
      const container = containerRef.current;
      const content = contentWrapperRef.current;
      const scrollX = Math.round(content.offsetLeft + (page.width / 2) - (container.clientWidth / 2));
      const scrollY = Math.round(content.offsetTop + (page.height / 2) - (container.clientHeight / 2));
      container.scrollTo({ left: scrollX, top: scrollY, behavior: "smooth" });
    }
  }, [setZoom, page.width, page.height]);

  // Center on mount
  useEffect(() => {
    if (containerRef.current && contentWrapperRef.current) {
      const container = containerRef.current;
      const content = contentWrapperRef.current;
      const scrollX = Math.round(content.offsetLeft + (page.width / 2) - (container.clientWidth / 2));
      const scrollY = Math.round(content.offsetTop + (page.height / 2) - (container.clientHeight / 2));
      container.scrollLeft = scrollX;
      container.scrollTop = scrollY;
    }
  }, [page.width, page.height]);

  // Non-passive wheel listener: zooms centered at cursor position
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let pendingDeltaY = 0;
    let lastClientX = 0;
    let lastClientY = 0;

    const handleWheel = (e: WheelEvent) => {
      // If Shift key is held down without Ctrl, let browser perform horizontal scrolling
      if (e.shiftKey && !e.ctrlKey) {
        return;
      }

      e.preventDefault();

      pendingDeltaY += e.deltaY;
      lastClientX = e.clientX;
      lastClientY = e.clientY;

      if (rafId.current === null) {
        rafId.current = requestAnimationFrame(() => {
          rafId.current = null;
          const currentZoom = useEditorStore.getState().zoom;
          const rawNewZoom = currentZoom * Math.exp(-pendingDeltaY * ZOOM_SENSITIVITY);
          const nextZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, rawNewZoom));
          pendingDeltaY = 0;

          if (Math.abs(nextZoom - currentZoom) > ZOOM_EPSILON) {
            const containerRect = container.getBoundingClientRect();
            const content = contentWrapperRef.current;
            if (content) {
              const cursorX = lastClientX - containerRect.left;
              const cursorY = lastClientY - containerRect.top;
              const contentOffsetX = content.offsetLeft;
              const contentOffsetY = content.offsetTop;

              const { scrollLeft: nextScrollLeft, scrollTop: nextScrollTop } = zoomAtPoint({
                zoom: currentZoom,
                newZoom: nextZoom,
                cursorX,
                cursorY,
                scrollLeft: container.scrollLeft,
                scrollTop: container.scrollTop,
                contentOffsetX,
                contentOffsetY,
              });

              setZoom(nextZoom);
              container.scrollLeft = nextScrollLeft;
              container.scrollTop = nextScrollTop;
            } else {
              setZoom(nextZoom);
            }
          }
        });
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, [setZoom]);

  // Middle-mouse drag to pan, or background deselect
  const handlePointerDownContainer = (e: React.PointerEvent<HTMLDivElement>) => {
    // Deselect only when pressing empty space: the gray workspace (which fully covers
    // the container) or the bare page. Elements stop propagation themselves, and
    // Moveable handles / the zoom controls are not background nodes.
    const backgroundNodes = [containerRef.current, workspaceRef.current, contentWrapperRef.current, canvasRef.current];
    if (e.button === 0 && backgroundNodes.includes(e.target as HTMLDivElement)) {
      selectElement(null);
    }
    if (e.button === 1) {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;

      const startX = e.clientX;
      const startY = e.clientY;
      const startScrollLeft = container.scrollLeft;
      const startScrollTop = container.scrollTop;

      const onPointerMove = (moveEvent: PointerEvent) => {
        container.scrollLeft = startScrollLeft - (moveEvent.clientX - startX);
        container.scrollTop = startScrollTop - (moveEvent.clientY - startY);
      };

      const onPointerUp = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    }
  };

  return (
    <div className="relative min-w-0 flex-1">
      {/* Zoom readout and 100% reset, floating over the top-right of the canvas area */}
      <div className="absolute top-3 right-3 z-20 bg-white/90 backdrop-blur shadow border border-gray-200 rounded px-2.5 py-1.5 flex items-center gap-2 pointer-events-auto">
        <span className="text-xs font-semibold text-gray-700">{Math.round(zoom * 100)}%</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            resetZoomAndCenter();
          }}
          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium px-2 py-0.5 rounded border border-gray-300 transition-colors"
        >
          100%
        </button>
      </div>

      <div
        ref={containerRef}
        onPointerDown={handlePointerDownContainer}
        className="absolute inset-0 bg-gray-100 overflow-auto select-none"
      >
        {/* Spacious scrollable workspace allowing smooth cursor-centered zoom in all directions */}
        <div
          ref={workspaceRef}
          style={{
            width: `${WORKSPACE_SIZE}px`,
            height: `${WORKSPACE_SIZE}px`,
            position: "relative",
          }}
        >
          <div
            ref={contentWrapperRef}
            style={{
              position: "absolute",
              left: `${WORKSPACE_PAGE_ORIGIN}px`,
              top: `${WORKSPACE_PAGE_ORIGIN}px`,
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
            }}
            className="shadow-lg"
          >
            <div
              id="canvas"
              ref={setRefs}
              // Outline, not border: a border would eat 2px of the page's exact px size.
              // No overflow clipping: elements are clamped to the page, and clipping
              // would cut off Moveable's resize handles on elements touching an edge.
              style={{
                width: `${page.width}px`,
                height: `${page.height}px`,
                backgroundColor: page.background,
                position: "relative",
              }}
              className="outline outline-gray-200"
            >
              {page.heightMode === "auto" && (
                <div className="absolute bottom-0 left-0 w-full bg-blue-100 text-blue-800 text-xs font-bold text-center py-1 border-t-2 border-dashed border-blue-400 pointer-events-none opacity-80 z-50">
                  Auto-Height Mode
                </div>
              )}
              {elementIds ? elementIds.split(",").map((id) => (
                <CanvasElementNode key={id} id={id} />
              )) : null}
              {/* Printed on every receipt: below a thermal page, in a fixed page's bottom margin */}
              <BrandStrip
                top={page.heightMode === "auto" ? page.height : page.height - BRAND_STRIP_HEIGHT}
                width={page.width}
                background={page.heightMode === "auto" ? page.background : undefined}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
