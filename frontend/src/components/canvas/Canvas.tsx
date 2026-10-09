import React, { useRef } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useEditorStore } from "../../store/editorStore";
import { CanvasElementNode } from "./CanvasElementNode";

export const Canvas: React.FC = () => {
  const page = useEditorStore((state) => state.page);
  const elements = useEditorStore((state) => state.elements);
  const zoom = useEditorStore((state) => state.zoom);
  const selectElement = useEditorStore((state) => state.selectElement);

  const { setNodeRef } = useDroppable({
    id: "canvas",
  });

  const canvasRef = useRef<HTMLDivElement>(null);

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

  return (
    <div
      className="flex-1 bg-gray-100 overflow-auto flex items-center justify-center p-8 relative"
      onClick={() => selectElement(null)} // fallback for desktop
    >
      <div
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: "center center",
          transition: "transform 0.1s",
        }}
        className="relative shadow-lg flex-shrink-0"
      >
        <div
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
            <div className="absolute top-0 right-[-120px] text-xs text-gray-500 bg-white px-2 py-1 shadow rounded">
              Auto Height Mode
            </div>
          )}
          {elements.map((el) => (
            <CanvasElementNode key={el.id} element={el} />
          ))}
        </div>
      </div>
    </div>
  );
};
