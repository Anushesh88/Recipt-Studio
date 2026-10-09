import React, { useState, useRef, useLayoutEffect } from "react";
import Moveable from "react-moveable";
import { useEditorStore } from "../../store/editorStore";
import { TextEl, ImageEl, TableEl, TotalsEl, QrEl, SignatureEl, DividerEl } from "../elements";
import { GRID_SIZE, MIN_ELEMENT_SIZE } from "../../lib/units";
import { floorToGrid, maxGridPosition, snapToGrid } from "../../lib/canvasUtils";
import { useAssetUrl } from "../../api/assets";
import { InlineTextEditor } from "./InlineTextEditor";

const ALL_DIRECTIONS = ["nw", "n", "ne", "w", "e", "sw", "s", "se"];
// Width-only handles:
// - a divider is only a few px tall, so n/s/corner handles would cover its whole
//   hit area and make it impossible to grab or click;
// - the items table's height is derived from its rows.
const WIDTH_ONLY_DIRECTIONS = ["w", "e"];
const WIDTH_ONLY_TYPES = new Set(["divider", "items_table"]);

export const CanvasElementNode: React.FC<{ id: string }> = React.memo(({ id }) => {
  const element = useEditorStore((state) => state.elements.find((e) => e.id === id));
  const isSelected = useEditorStore((state) => state.selectedId === id);
  const isEditing = useEditorStore((state) => state.editingId === id);
  const selectElement = useEditorStore((state) => state.selectElement);
  const setEditingId = useEditorStore((state) => state.setEditingId);
  const updateElementGeometry = useEditorStore((state) => state.updateElementGeometry);
  const page = useEditorStore((state) => state.page);
  const zoom = useEditorStore((state) => state.zoom);

  // Hold target in React state so Moveable immediately mounts once DOM node exists
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const moveableRef = useRef<Moveable>(null);

  const assetId = element && (element.type === "image" || element.type === "signature") ? element.props.assetId : null;
  const assetSrc = useAssetUrl(assetId);

  // Synchronize Moveable rect on store updates
  useLayoutEffect(() => {
    if (isSelected && moveableRef.current) {
      moveableRef.current.updateRect();
    }
  }, [isSelected, element?.x, element?.y, element?.width, element?.height]);

  if (!element) return null;

  const handleSelect = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    selectElement(element.id);
  };

  const ringClass = !isSelected ? "" : element.locked ? "ring-2 ring-amber-500" : "ring-2 ring-blue-500";
  const commonProps = {
    ref: setTarget,
    // while editing inline, the textarea overlay stands in for the element
    className: isEditing ? "invisible" : ringClass,
    onPointerDown: handleSelect,
    onClick: handleSelect,
  };

  let ElNode: React.ReactNode = null;
  switch (element.type) {
    case "text":
      ElNode = <TextEl element={element} {...commonProps} onDoubleClick={() => setEditingId(element.id)} />;
      break;
    case "image":
      ElNode = <ImageEl element={element} assetSrc={assetSrc} {...commonProps} />;
      break;
    case "items_table":
      ElNode = <TableEl element={element} {...commonProps} />;
      break;
    case "totals":
      ElNode = <TotalsEl element={element} {...commonProps} />;
      break;
    case "qr":
      ElNode = <QrEl element={element} {...commonProps} />;
      break;
    case "signature":
      ElNode = <SignatureEl element={element} assetSrc={assetSrc} {...commonProps} />;
      break;
    case "divider":
      ElNode = <DividerEl element={element} {...commonProps} />;
      break;
  }

  return (
    <>
      {ElNode}
      {isEditing && element.type === "text" && <InlineTextEditor element={element} />}
      {isSelected && target && !isEditing && (
        <Moveable
          key={element.id}
          ref={moveableRef}
          target={target}
          draggable={!element.locked}
          resizable={!element.locked}
          snappable={true}
          bounds={{ left: 0, top: 0, right: page.width, bottom: page.height }}
          zoom={zoom}
          throttleDrag={GRID_SIZE}
          throttleResize={GRID_SIZE}
          keepRatio={false}
          origin={false}
          renderDirections={WIDTH_ONLY_TYPES.has(element.type) ? WIDTH_ONLY_DIRECTIONS : ALL_DIRECTIONS}
          onDrag={(e) => {
            const [rawDx, rawDy] = e.beforeTranslate;
            const snappedX = snapToGrid(element.x + rawDx, GRID_SIZE);
            const snappedY = snapToGrid(element.y + rawDy, GRID_SIZE);

            // Same grid-floored bounds as the store, so nothing jumps on release
            const maxX = maxGridPosition(page.width, element.width, GRID_SIZE);
            const clampedX = Math.max(0, Math.min(snappedX, maxX));

            const maxY = maxGridPosition(page.height, element.height, GRID_SIZE);
            const clampedY = Math.max(0, Math.min(snappedY, maxY));

            const actualDx = clampedX - element.x;
            const actualDy = clampedY - element.y;

            e.target.style.transform = `translate(${actualDx}px, ${actualDy}px)`;
          }}
          onDragEnd={(e) => {
            const style = e.target.style.transform;
            const match = style.match(/translate\((.+?)px,\s*(.+?)px\)/);
            if (match) {
              const dx = parseFloat(match[1]);
              const dy = parseFloat(match[2]);
              if (!isNaN(dx) && !isNaN(dy) && (dx !== 0 || dy !== 0)) {
                updateElementGeometry(element.id, {
                  x: element.x + dx,
                  y: element.y + dy,
                });
              }
            }
            // Only clear the live transform. left/top/width/height belong to React:
            // a plain click fires dragEnd with no movement, the store doesn't change,
            // React doesn't re-render, and wiping them would detach the DOM from the store.
            e.target.style.transform = "";
          }}
          onResize={(e) => {
            const match = e.drag.transform.match(/translate\((.+?)px,\s*(.+?)px\)/);
            let rawDx = 0;
            let rawDy = 0;
            if (match) {
              rawDx = parseFloat(match[1]);
              rawDy = parseFloat(match[2]);
            }

            let snappedX = snapToGrid(element.x + rawDx, GRID_SIZE);
            let snappedY = snapToGrid(element.y + rawDy, GRID_SIZE);
            let snappedW = snapToGrid(Math.max(MIN_ELEMENT_SIZE, e.width), GRID_SIZE);
            let snappedH = snapToGrid(Math.max(MIN_ELEMENT_SIZE, e.height), GRID_SIZE);

            // Caps are floored to the grid (like the store) so the size never runs past the page edge
            if (snappedX < 0) {
              snappedW = Math.max(MIN_ELEMENT_SIZE, snappedW + snappedX);
              snappedX = 0;
            }
            if (snappedX + snappedW > page.width) {
              snappedW = Math.max(MIN_ELEMENT_SIZE, floorToGrid(page.width - snappedX, GRID_SIZE));
            }

            if (snappedY < 0) {
              snappedH = Math.max(MIN_ELEMENT_SIZE, snappedH + snappedY);
              snappedY = 0;
            }
            if (snappedY + snappedH > page.height) {
              snappedH = Math.max(MIN_ELEMENT_SIZE, floorToGrid(page.height - snappedY, GRID_SIZE));
            }

            const actualDx = snappedX - element.x;
            const actualDy = snappedY - element.y;

            e.target.style.width = `${snappedW}px`;
            e.target.style.height = `${snappedH}px`;
            e.target.style.transform = `translate(${actualDx}px, ${actualDy}px)`;
          }}
          onResizeEnd={(e) => {
            const width = parseFloat(e.target.style.width) || element.width;
            const height = parseFloat(e.target.style.height) || element.height;
            const style = e.target.style.transform;
            let dx = 0;
            let dy = 0;
            const match = style.match(/translate\((.+?)px,\s*(.+?)px\)/);
            if (match) {
              dx = parseFloat(match[1]);
              dy = parseFloat(match[2]);
            }

            const changed = dx !== 0 || dy !== 0 || width !== element.width || height !== element.height;
            if (changed) {
              updateElementGeometry(element.id, {
                x: element.x + dx,
                y: element.y + dy,
                width,
                height,
              });
            }

            // Write back the committed size rather than clearing it: if the store
            // value didn't change, React won't re-apply it on its own.
            const committed = useEditorStore.getState().elements.find((el) => el.id === element.id) ?? element;
            e.target.style.transform = "";
            e.target.style.width = `${committed.width}px`;
            e.target.style.height = `${Math.max(committed.height, MIN_ELEMENT_SIZE)}px`;
          }}
        />
      )}
    </>
  );
});
