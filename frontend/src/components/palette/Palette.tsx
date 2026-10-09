import React from "react";
import { useDraggable } from "@dnd-kit/core";
import type { CanvasElement } from "../../schema/templateSchema";
import { DEFAULT_ELEMENTS } from "../../lib/units";
import { Type, Image, Table, Calculator, QrCode, PenTool, Minus } from "lucide-react";

const PALETTE_ITEMS: { type: CanvasElement["type"]; label: string; icon: React.ReactNode }[] = [
  { type: "text", label: "Text", icon: <Type size={18} /> },
  { type: "image", label: "Image", icon: <Image size={18} /> },
  { type: "items_table", label: "Table", icon: <Table size={18} /> },
  { type: "totals", label: "Totals", icon: <Calculator size={18} /> },
  { type: "qr", label: "QR Code", icon: <QrCode size={18} /> },
  { type: "signature", label: "Signature", icon: <PenTool size={18} /> },
  { type: "divider", label: "Divider", icon: <Minus size={18} /> },
];

const PaletteItem: React.FC<{ item: typeof PALETTE_ITEMS[0] }> = ({ item }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${item.type}`,
    data: {
      type: item.type,
    },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-2 p-2 mb-2 bg-white border border-gray-200 rounded cursor-grab hover:bg-gray-50 ${isDragging ? "opacity-50" : ""}`}
    >
      {item.icon}
      <span className="text-sm font-medium">{item.label}</span>
    </div>
  );
};

// Ghost that follows the cursor while dragging from the palette. Its top-left is
// where the element will land, drawn at the element's default size and current zoom.
export const PaletteDragPreview: React.FC<{ type: CanvasElement["type"]; zoom: number }> = ({ type, zoom }) => {
  const item = PALETTE_ITEMS.find((i) => i.type === type);
  const { width, height } = DEFAULT_ELEMENTS[type];

  return (
    <div
      style={{ width: `${width * zoom}px`, height: `${height * zoom}px` }}
      className="border-2 border-dashed border-blue-500 bg-blue-500/10 pointer-events-none"
    >
      <div className="flex items-center gap-1 px-1 text-xs font-medium text-blue-700 whitespace-nowrap">
        {item?.icon}
        <span>{item?.label}</span>
      </div>
    </div>
  );
};

export const Palette: React.FC = () => {
  return (
    <div className="w-64 bg-gray-50 border-r border-gray-200 p-4 flex flex-col h-full overflow-y-auto z-10">
      <h2 className="text-lg font-semibold mb-4 text-gray-800">Elements</h2>
      <div className="flex-1">
        {PALETTE_ITEMS.map((item) => (
          <PaletteItem key={item.type} item={item} />
        ))}
      </div>
    </div>
  );
};
