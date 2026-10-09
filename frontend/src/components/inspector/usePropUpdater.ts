import { useCallback } from "react";
import { useEditorStore } from "../../store/editorStore";
import type { CanvasElement } from "../../schema/templateSchema";

type PropsOf<T extends CanvasElement["type"]> = Extract<CanvasElement, { type: T }>["props"];

// set(key, value) for one element's props. Repeated changes to the same prop
// (typing, dragging a color picker) coalesce into a single undo step.
export function usePropUpdater<T extends CanvasElement["type"]>(element: Extract<CanvasElement, { type: T }>) {
  const updateElement = useEditorStore((s) => s.updateElement);
  return useCallback(
    <K extends keyof PropsOf<T>>(key: K, value: PropsOf<T>[K]) => {
      updateElement(
        element.id,
        (draft) => {
          (draft.props as PropsOf<T>)[key] = value;
        },
        { coalesceKey: `${element.id}:props.${String(key)}` },
      );
    },
    [element.id, updateElement],
  );
}
