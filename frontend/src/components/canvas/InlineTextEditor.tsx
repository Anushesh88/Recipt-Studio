import React, { useCallback, useEffect, useRef, useState } from "react";
import { useEditorStore } from "../../store/editorStore";
import type { CanvasElement } from "../../schema/templateSchema";
import { fontStack } from "../../lib/units";
import { InsertVariableMenu } from "../variables/InsertVariableMenu";
import { useVariableInsertion } from "../variables/useVariableInsertion";

type TextElement = Extract<CanvasElement, { type: "text" }>;

const TOOLBAR_GAP_PX = 4;

// Textarea laid exactly over a text element (same box and typography), shown on
// double-click. Edits go straight to the store as one undo step per session.
// Escape / Ctrl+Enter or pressing outside ends it; the variable menu's popover
// counts as inside.
export const InlineTextEditor: React.FC<{ element: TextElement }> = ({ element }) => {
  const updateElement = useEditorStore((s) => s.updateElement);
  const setEditingId = useEditorStore((s) => s.setEditingId);
  const zoom = useEditorStore((s) => s.zoom);
  const ref = useRef<HTMLTextAreaElement>(null);
  const [sessionKey] = useState(() => `${element.id}:inline:${Date.now()}`);
  const { props } = element;

  const setContent = useCallback(
    (content: string) =>
      updateElement(element.id, (draft) => {
        if (draft.type === "text") draft.props.content = content;
      }, { coalesceKey: sessionKey }),
    [element.id, sessionKey, updateElement],
  );
  const insert = useVariableInsertion(ref, props.content, setContent);
  const finish = useCallback(() => setEditingId(null), [setEditingId]);

  useEffect(() => {
    const field = ref.current;
    field?.focus();
    field?.setSelectionRange(field.value.length, field.value.length);
  }, []);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!target?.closest("[data-inline-editor], [data-variable-menu]")) finish();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [finish]);

  return (
    <div
      data-inline-editor=""
      style={{ position: "absolute", left: element.x, top: element.y, width: element.width, height: element.height }}
    >
      {/* counter-scaled so the toolbar stays a usable size at any zoom */}
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: `calc(100% + ${TOOLBAR_GAP_PX}px)`,
          transform: `scale(${1 / zoom})`,
          transformOrigin: "bottom left",
        }}
      >
        <InsertVariableMenu onInsert={insert} />
      </div>
      <textarea
        ref={ref}
        aria-label="Edit text"
        value={props.content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
            e.preventDefault();
            finish();
          }
        }}
        spellCheck={false}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          margin: 0,
          padding: 0,
          border: 0,
          resize: "none",
          overflow: "hidden",
          background: "transparent",
          outline: "2px solid #3b82f6",
          fontFamily: fontStack(props.fontFamily),
          fontSize: `${props.fontSize}px`,
          fontWeight: props.fontWeight,
          color: props.color,
          textAlign: props.align,
          lineHeight: props.lineHeight,
          whiteSpace: "pre-wrap",
          overflowWrap: "break-word",
        }}
      />
    </div>
  );
};
