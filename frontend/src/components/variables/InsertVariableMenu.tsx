import React, { useId, useMemo, useState } from "react";
import { Braces, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useEditorStore } from "../../store/editorStore";
import {
  BUILTIN_VARIABLES,
  CUSTOM_KEY_PATTERN,
  CUSTOM_PREFIX,
  extractVariables,
  variableKind,
  variableLabel,
} from "../../lib/variables";

// Built-ins for GST tax invoices, listed under their own heading
const GST_VARIABLES = new Set([
  "business.address", "business.gstin", "customer.address", "customer.gstin", "receipt.place_of_supply", "receipt.reverse_charge",
]);

const MenuHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="px-2 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">{children}</div>
);

const MenuItem: React.FC<{ varKey: string; label: string; onSelect: (key: string) => void }> = ({ varKey, label, onSelect }) => (
  <button
    type="button"
    onClick={() => onSelect(varKey)}
    className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
  >
    <span>{label}</span>
    <code className="font-mono text-[11px] text-muted-foreground">{varKey}</code>
  </button>
);

// Built-in variables, the template's custom variables, and a "new custom variable"
// form. The popover is tagged data-variable-menu so the inline text editor treats
// clicks inside it as part of the editing session.
export const InsertVariableMenu: React.FC<{ onInsert: (key: string) => void }> = ({ onInsert }) => {
  const [open, setOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const inputId = useId();
  const elements = useEditorStore((s) => s.elements);
  const customKeys = useMemo(
    () => extractVariables({ elements }).filter((key) => variableKind(key) === "custom"),
    [elements],
  );
  const nameValid = CUSTOM_KEY_PATTERN.test(customName);

  const insert = (key: string) => {
    setOpen(false);
    setCustomName("");
    onInsert(key);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="xs">
          <Braces />
          Insert variable
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={8}
        // Scrolls rather than running off the screen
        className="max-h-(--radix-popover-content-available-height) w-72 gap-0 overflow-y-auto p-1"
        data-variable-menu=""
        // the caller puts focus back in its text field, at the inserted variable
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <MenuHeading>Built-in</MenuHeading>
        {BUILTIN_VARIABLES.filter((v) => !GST_VARIABLES.has(v.key)).map((v) => (
          <MenuItem key={v.key} varKey={v.key} label={v.label} onSelect={insert} />
        ))}
        <Separator className="my-1" />
        <MenuHeading>GST invoice</MenuHeading>
        {BUILTIN_VARIABLES.filter((v) => GST_VARIABLES.has(v.key)).map((v) => (
          <MenuItem key={v.key} varKey={v.key} label={v.label} onSelect={insert} />
        ))}
        {customKeys.length > 0 && (
          <>
            <Separator className="my-1" />
            <MenuHeading>Custom (used in this template)</MenuHeading>
            {customKeys.map((key) => (
              <MenuItem key={key} varKey={key} label={variableLabel(key)} onSelect={insert} />
            ))}
          </>
        )}
        <Separator className="my-1" />
        <form
          className="space-y-1.5 p-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (nameValid) insert(CUSTOM_PREFIX + customName);
          }}
        >
          <label htmlFor={inputId} className="text-xs font-medium">New custom variable…</label>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs text-muted-foreground">{CUSTOM_PREFIX}</span>
            <Input
              id={inputId}
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="table_no"
              className="h-7 font-mono text-xs"
              aria-invalid={customName !== "" && !nameValid}
              autoComplete="off"
            />
            <Button type="submit" size="xs" disabled={!nameValid}>
              <Plus />
              Add
            </Button>
          </div>
          {customName !== "" && !nameValid && (
            <p className="text-xs text-destructive">Use lowercase letters and underscores only.</p>
          )}
          <p className="text-xs text-muted-foreground">Each custom variable becomes a field in the Generate form.</p>
        </form>
      </PopoverContent>
    </Popover>
  );
};
