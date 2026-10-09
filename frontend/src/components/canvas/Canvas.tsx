import React, { useRef, useEffect, useCallback } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useEditorStore } from "../../store/editorStore";
import { CanvasElementNode } from "./CanvasElementNode";

export const Canvas: React.FC = () => {
  const page = useEditorStore((state) => state.page);
  // Only re-render Canvas if the list of IDs changes
  const elementIds = useEditorStore((state) => state.elements.map((el) => el.id).join(","));
  const zoom = useEditorStore((state) => state.zoom);
  const setZoom = useEditorStore((state) => state.setZoom);
  const selectElement = useEditorStore((state) => state.selectElement);

  const { setNodeRef } = useDroppable({
    id: "canvas",
  });

  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Combine drop ref and local ref
  const setRefs = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    (canvasRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.target === canvasRef.current) {
      selectElement(null);
    }
  };

  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
      let newZoom = zoom + zoomDelta;
      newZoom = Math.max(0.1, Math.min(newZoom, 5));
      setZoom(newZoom);
    }
  }, [zoom, setZoom]);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener("wheel", handleWheel, { passive: false });
      return () => container.removeEventListener("wheel", handleWheel);
    }
  }, [handleWheel]);

  return (
    <div
      ref={containerRef}
      className="flex-1 bg-gray-100 overflow-auto flex items-center justify-center p-8 relative"
      onClick={() => selectElement(null)} // fallback for desktop
    >
      <div className="absolute top-4 right-4 z-10 bg-white shadow rounded flex items-center px-2 py-1">
        <span className="text-sm font-medium mr-2">{Math.round(zoom * 100)}%</span>
        <button
          onClick={(e) => { e.stopPropagation(); setZoom(1); }}
          className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded focus:outline-none"
        >
          Reset
        </button>
      </div>
      <div
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: "top left",
          transition: "transform 0.1s",
        }}
        className="relative shadow-lg flex-shrink-0"
      >
        <div
          id="canvas"
          ref={setRefs}
          onPointerDown={handlePointerDown}
          style={{
            width: `${page.width}px`,
            height: `${page.height}px`,
            backgroundColor: page.background,
            position: "relative",
            overflow: "hidden", // bounds
          }}
          className="border border-gray-200"
        >
          {page.heightMode === "auto" && (
            <div className="absolute bottom-0 left-0 w-full bg-blue-100 text-blue-800 text-xs font-bold text-center py-1 border-t-2 border-dashed border-blue-400 pointer-events-none opacity-80 z-50">
              Auto-Height Mode
            </div>
          )}
          {elementIds ? elementIds.split(",").map((id) => (
            <CanvasElementNode key={id} id={id} />
          )) : null}
        </div>
      </div>
    </div>
  );
};
