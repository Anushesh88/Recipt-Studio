import { useCallback, type RefObject } from "react";

// Returns insert(key): puts {{key}} at the text field's caret (replacing any
// selection), then refocuses the field with the caret after the variable.
export function useVariableInsertion(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  onChange: (next: string) => void,
) {
  return useCallback(
    (key: string) => {
      const field = ref.current;
      const snippet = `{{${key}}}`;
      const start = field?.selectionStart ?? value.length;
      const end = field?.selectionEnd ?? value.length;
      onChange(value.slice(0, start) + snippet + value.slice(end));
      const caret = start + snippet.length;
      requestAnimationFrame(() => {
        field?.focus();
        field?.setSelectionRange(caret, caret);
      });
    },
    [ref, value, onChange],
  );
}
