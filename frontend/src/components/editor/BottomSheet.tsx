import React from "react";
import { X } from "lucide-react";

// A panel sliding up from the bottom of the screen (the editor on phones). It
// leaves the top of the canvas visible, so changes show as they're made.
export const BottomSheet: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; name: string }> = ({
  title, onClose, children, name,
}) => (
  <div
    role="dialog"
    aria-label={title}
    data-sheet={name}
    className="fixed inset-x-0 bottom-0 z-50 flex max-h-[60vh] flex-col rounded-t-2xl border-t border-border bg-white shadow-[0_-8px_24px_rgba(0,0,0,0.12)]"
  >
    <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100">
        <X className="size-5" />
      </button>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">{children}</div>
  </div>
);
