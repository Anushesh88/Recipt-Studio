import React, { useId, useRef, useState } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";

export interface Suggestion {
  key: string;
  label: string; // what goes in the box
  hint?: string; // shown beside it, e.g. the price
}

const MAX_SHOWN = 8;

// A text box with a dropdown of things used before (saved items, customers).
// Focusing it lists the most recent; typing narrows the list; picking one
// (tap, or arrows + Enter) calls onPick. Anything else can still be typed.
export const SuggestInput: React.FC<{
  registration: UseFormRegisterReturn;
  suggestions: Suggestion[] | undefined;
  onPick: (suggestion: Suggestion) => void;
  "aria-label"?: string;
  id?: string;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  listLabel: string; // e.g. "Saved items"
}> = ({ registration, suggestions, onPick, listLabel, ...inputProps }) => {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const q = query.trim().toLowerCase();
  const matches = (suggestions ?? [])
    // Already exactly what's typed: nothing to suggest
    .filter((s) => (q ? s.label.toLowerCase().includes(q) && s.label.toLowerCase() !== q : true))
    .slice(0, MAX_SHOWN);
  const shown = open && matches.length > 0;

  const pick = (suggestion: Suggestion) => {
    onPick(suggestion);
    setQuery(suggestion.label);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % Math.max(matches.length, 1));
    } else if (e.key === "ArrowUp" && shown) {
      e.preventDefault();
      setActive((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter" && shown) {
      e.preventDefault();
      pick(matches[Math.min(active, matches.length - 1)]);
    } else if (e.key === "Escape" && shown) {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <Input
        {...inputProps}
        {...registration}
        ref={(el) => {
          registration.ref(el);
          inputRef.current = el;
        }}
        role="combobox"
        aria-expanded={shown}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        onFocus={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onChange={(e) => {
          void registration.onChange(e);
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onBlur={(e) => {
          void registration.onBlur(e);
          setOpen(false);
        }}
        onKeyDown={onKeyDown}
      />
      {shown && (
        <ul
          id={listId}
          role="listbox"
          aria-label={listLabel}
          className="absolute inset-x-0 top-full z-40 mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-white py-1 shadow-lg"
          data-suggestions=""
        >
          <li role="presentation" className="px-3 pt-1 pb-1.5 text-[11px] font-medium text-muted-foreground">{listLabel}</li>
          {matches.map((s, i) => (
            <li
              key={s.key}
              role="option"
              aria-selected={i === active}
              // Before the input's blur, so the pick isn't lost
              onMouseDown={(e) => {
                e.preventDefault();
                pick(s);
              }}
              onMouseEnter={() => setActive(i)}
              className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm aria-selected:bg-muted"
            >
              <span className="truncate">{s.label}</span>
              {s.hint && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{s.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
