import React, { useRef } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InsertVariableMenu } from "./InsertVariableMenu";
import { useVariableInsertion } from "./useVariableInsertion";
import { findUnknownVariables } from "../../lib/variables";

// Content field for text / QR elements: insert-variable menu plus a warning for
// variables that are neither built-in nor custom.* (those block saving).
export const VariableTextarea: React.FC<{
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  rows?: number;
}> = ({ id, label, value, onChange, rows = 3 }) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const insert = useVariableInsertion(ref, value, onChange);
  const unknown = findUnknownVariables(value);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <InsertVariableMenu onInsert={insert} />
      </div>
      <Textarea
        id={id}
        ref={ref}
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-16 font-mono text-xs"
        aria-invalid={unknown.length > 0}
      />
      {unknown.length > 0 && (
        <p role="alert" className="text-xs text-destructive">
          Unknown variable{unknown.length > 1 ? "s" : ""}{" "}
          {unknown.map((key) => `{{${key}}}`).join(", ")}. Use a built-in variable or custom.&lt;name&gt; —
          templates with unknown variables can't be saved.
        </p>
      )}
    </div>
  );
};
