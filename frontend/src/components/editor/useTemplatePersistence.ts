import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useEditorStore } from "../../store/editorStore";
import { canvasSchema, type Canvas } from "../../schema/templateSchema";
import { createTemplate, templateKeys, updateTemplate } from "../../api/templates";
import { apiErrorMessage } from "../../api/client";
import { stableStringify } from "../../lib/json";
import { describeCanvasIssues, type CanvasIssue } from "../../lib/validation";
import { UNTITLED_TEMPLATE } from "../../lib/units";

export interface SaveProblem {
  message: string;
  issues: CanvasIssue[];
}

const currentCanvas = (): Canvas => {
  const { page, elements } = useEditorStore.getState();
  return { schemaVersion: 1, page, elements };
};

// Save / Save As for the template open in the editor, plus "unsaved changes".
// The canvas is validated with the shared Zod schema first, so e.g. unknown
// variables block saving with a message naming the element.
export function useTemplatePersistence({
  templateId,
  workspaceKey,
  initialName,
  initialCanvas,
}: {
  templateId: string | undefined;
  workspaceKey: string;
  initialName: string;
  initialCanvas: Canvas;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState(initialName);
  const [savedName, setSavedName] = useState(initialName);
  const [savedSnapshot, setSavedSnapshot] = useState(() => stableStringify(initialCanvas));
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<SaveProblem | null>(null);

  const page = useEditorStore((s) => s.page);
  const elements = useEditorStore((s) => s.elements);
  const canvasDirty = useMemo(
    () => stableStringify({ schemaVersion: 1, page, elements }) !== savedSnapshot,
    [page, elements, savedSnapshot],
  );
  const dirty = canvasDirty || name.trim() !== savedName;

  const save = useCallback(
    async (asNew?: { name: string }) => {
      const canvas = currentCanvas();
      const parsed = canvasSchema.safeParse(canvas);
      if (!parsed.success) {
        setProblem({ message: "Fix these before saving:", issues: describeCanvasIssues(parsed.error, canvas.elements) });
        return;
      }
      const finalName = (asNew?.name ?? name).trim() || UNTITLED_TEMPLATE;
      setSaving(true);
      setProblem(null);
      try {
        const record = templateId && !asNew
          ? await updateTemplate(templateId, { name: finalName, canvas: parsed.data })
          : await createTemplate(finalName, parsed.data);
        // Seed the cache so the route change below doesn't refetch or remount
        queryClient.setQueryData(templateKeys.detail(record.id), record);
        void queryClient.invalidateQueries({ queryKey: templateKeys.all, exact: true });
        setName(record.name);
        setSavedName(record.name);
        setSavedSnapshot(stableStringify(parsed.data));
        if (record.id !== templateId) {
          navigate(`/editor/${record.id}`, { replace: !templateId, state: { workspaceKey } });
        }
      } catch (e) {
        setProblem({ message: apiErrorMessage(e, "Couldn't save the template. Please try again."), issues: [] });
      } finally {
        setSaving(false);
      }
    },
    [name, navigate, queryClient, templateId, workspaceKey],
  );

  // Warn before closing / reloading the tab with unsaved work
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return {
    name,
    setName,
    dirty,
    saving,
    problem,
    dismissProblem: () => setProblem(null),
    save,
  };
}
