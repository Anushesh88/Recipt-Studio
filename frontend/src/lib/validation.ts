import type { z } from "zod";
import type { CanvasElement } from "../schema/templateSchema";
import { ELEMENT_LABELS } from "./units";

export interface CanvasIssue {
  message: string;
  // The element the issue is about, so the UI can select it
  elementId?: string;
}

// Turns schema errors into messages a designer can act on, e.g.
// "Text: Unknown variables in content: {{foo.bar}}"
export function describeCanvasIssues(error: z.ZodError, elements: CanvasElement[]): CanvasIssue[] {
  return error.issues.map((issue) => {
    const [root, index] = issue.path;
    const element = root === "elements" && typeof index === "number" ? elements[index] : undefined;
    if (!element) return { message: issue.message };
    const field = issue.path.slice(2).filter((p) => p !== "props").join(".");
    const where = field ? `${ELEMENT_LABELS[element.type]} (${field})` : ELEMENT_LABELS[element.type];
    return { message: `${where}: ${issue.message}`, elementId: element.id };
  });
}
