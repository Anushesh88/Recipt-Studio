import React, { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { HEX_COLOR_LENGTH } from "../../lib/units";

export const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-3 border-b border-border px-4 py-3">
    <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
    {children}
  </section>
);

export const Field: React.FC<{ label: string; htmlFor?: string; hint?: React.ReactNode; children: React.ReactNode }> = ({
  label,
  htmlFor,
  hint,
  children,
}) => (
  <div className="space-y-1.5">
    <Label htmlFor={htmlFor} className="text-xs">{label}</Label>
    {children}
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
);

// Number input that keeps what's being typed. With `live`, every valid in-range
// value is applied as you type or step; otherwise only on blur / Enter. Out-of-range
// input is clamped on blur.
export const NumberField: React.FC<{
  id: string;
  label: string;
  value: number;
  onCommit: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  live?: boolean;
  disabled?: boolean;
  hint?: React.ReactNode;
}> = ({ id, label, value, onCommit, min, max, step = 1, live = false, disabled, hint }) => {
  // What's being typed; null when not editing, so the field follows the store
  // (undo, canvas drags) without an effect
  const [draft, setDraft] = useState<string | null>(null);

  const parse = (raw: string) => (raw.trim() === "" ? NaN : Number(raw));

  const commit = () => {
    const n = draft === null ? NaN : parse(draft);
    if (Number.isFinite(n)) {
      const clamped = Math.min(max, Math.max(min, n));
      if (clamped !== value) onCommit(clamped);
    }
    setDraft(null);
  };

  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={draft ?? String(value)}
        disabled={disabled}
        className="h-8"
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = parse(e.target.value);
          if (live && Number.isFinite(n) && n >= min && n <= max && n !== value) onCommit(n);
        }}
      />
    </Field>
  );
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export const ColorField: React.FC<{ id: string; label: string; value: string; onChange: (hex: string) => void }> = ({
  id,
  label,
  value,
  onChange,
}) => {
  // Hex being typed; null when not editing, so the field follows the store
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value;

  return (
    <Field label={label} htmlFor={id}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={value.toLowerCase()}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-8 w-10 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
        />
        <Input
          id={id}
          value={shown}
          maxLength={HEX_COLOR_LENGTH}
          className="h-8 font-mono text-xs uppercase"
          aria-invalid={!HEX_COLOR.test(shown)}
          onChange={(e) => {
            setDraft(e.target.value);
            if (HEX_COLOR.test(e.target.value)) onChange(e.target.value.toUpperCase());
          }}
          onBlur={() => setDraft(null)}
        />
      </div>
    </Field>
  );
};

export interface SelectOption<V extends string> {
  value: V;
  label: string;
  style?: React.CSSProperties;
}

export function SelectField<V extends string>({
  id,
  label,
  value,
  options,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: V;
  options: readonly SelectOption<V>[];
  onChange: (value: V) => void;
  hint?: React.ReactNode;
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <Select value={value} onValueChange={(v) => onChange(v as V)}>
        <SelectTrigger id={id} size="sm" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} style={o.style}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

// Single-choice button row (alignment, line style, ...)
export function SegmentedField<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: V;
  options: readonly { value: V; label: string; icon?: React.ReactNode }[];
  onChange: (value: V) => void;
}) {
  return (
    <Field label={label}>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        spacing={0}
        value={value}
        // Clicking the active option would clear it; keep a value selected
        onValueChange={(v) => v && onChange(v as V)}
        aria-label={label}
      >
        {options.map((o) => (
          <ToggleGroupItem key={o.value} value={o.value} aria-label={o.label} title={o.label}>
            {o.icon ?? o.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </Field>
  );
}

export const CheckboxField: React.FC<{ id: string; label: string; checked: boolean; onChange: (checked: boolean) => void }> = ({
  id,
  label,
  checked,
  onChange,
}) => (
  <div className="flex items-center gap-2">
    <Checkbox id={id} checked={checked} onCheckedChange={(c) => onChange(c === true)} />
    <Label htmlFor={id} className="text-sm font-normal">{label}</Label>
  </div>
);

export const TextField: React.FC<{
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  hint?: React.ReactNode;
}> = ({ id, label, value, onChange, maxLength, hint }) => (
  <Field label={label} htmlFor={id} hint={hint}>
    <Input id={id} value={value} maxLength={maxLength} className="h-8" onChange={(e) => onChange(e.target.value)} />
  </Field>
);
