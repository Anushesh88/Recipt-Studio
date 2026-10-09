import React, { useRef } from "react";
import Moveable from "react-moveable";
import { useEditorStore } from "../../store/editorStore";
import { TextEl, ImageEl, TableEl, TotalsEl, QrEl, SignatureEl, DividerEl } from "../elements";

export const CanvasElementNode: React.FC<{ id: string }> = React.memo(({ id }) => {
  const element = useEditorStore((state) => state.elements.find((e) => e.id === id));
  const isSelected = useEditorStore((state) => state.selectedId === id);
  const selectElement = useEditorStore((state) => state.selectElement);
  const moveElement = useEditorStore((state) => state.moveElement);
  const updateElementGeometry = useEditorStore((state) => state.updateElementGeometry);
  const zoom = useEditorStore((state) => state.zoom);
  
  const targetRef = useRef<HTMLDivElement>(null);

  if (!element) return null;

  let ElNode: React.ReactNode = null;
  const props = { 
    element: element as never, 
    ref: targetRef, 
    className: isSelected ? "ring-2 ring-blue-500" : "",
    onPointerDown: (e: React.PointerEvent) => {
      e.stopPropagation();
      selectElement(element.id);
    },
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
    }
  };

  switch (element.type) {
    case "text":
      ElNode = <TextEl {...props} />;
      break;
    case "image":
      ElNode = <ImageEl {...props} />;
      break;
    case "items_table":
      ElNode = <TableEl {...props} />;
      break;
    case "totals":
      ElNode = <TotalsEl {...props} />;
      break;
    case "qr":
      ElNode = <QrEl {...props} />;
      break;
    case "signature":
      ElNode = <SignatureEl {...props} />;
      break;
    case "divider":
      ElNode = <DividerEl {...props} />;
      break;
  }

  return (
    <>
      {ElNode}
      {isSelected && (
        <Moveable
          target={targetRef.current}
          draggable={true}
          resizable={true}
          snappable={true}
          zoom={zoom}
          // react-moveable modifies the DOM directly; we want to catch the end event and sync to store
          // Alternatively, we can use onDrag/onResize to sync live, but zustand updates might be fast enough.
          onDrag={(e) => {
            e.target.style.transform = e.transform; // visual feedback during drag
          }}
          onDragEnd={(e) => {
            // Extract translate from transform
            const style = e.target.style.transform;
            const match = style.match(/translate\((.+?)px,\s*(.+?)px\)/);
            if (match) {
              const dx = parseFloat(match[1]);
              const dy = parseFloat(match[2]);
              moveElement(element.id, element.x + dx, element.y + dy);
              e.target.style.transform = "none";
            }
          }}
          onResize={(e) => {
            e.target.style.width = `${e.width}px`;
            e.target.style.height = `${e.height}px`;
            e.target.style.transform = e.drag.transform;
          }}
          onResizeEnd={(e) => {
            const width = parseFloat(e.target.style.width);
            const height = parseFloat(e.target.style.height);
            // Also need to move if resized from top/left
            const style = e.target.style.transform;
            let dx = 0, dy = 0;
            const match = style.match(/translate\((.+?)px,\s*(.+?)px\)/);
            if (match) {
              dx = parseFloat(match[1]);
              dy = parseFloat(match[2]);
            }
            
            const newX = element.x + dx;
            const newY = element.y + dy;
            
            updateElementGeometry(element.id, { x: newX, y: newY, width, height });
            e.target.style.transform = "none";
          }}
          keepRatio={false}
          throttleDrag={0}
          throttleResize={0}
          origin={false}
          renderDirections={["nw", "n", "ne", "w", "e", "sw", "s", "se"]}
        />
      )}
    </>
  );
});
