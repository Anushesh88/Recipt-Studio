import React from "react";
import type { CanvasElement } from "../../schema/templateSchema";
import { CURRENCY_SYMBOL_MAX_LENGTH, FONT_SIZE_RANGE, TOTALS_FIELDS } from "../../lib/units";
import { CheckboxField, Field, NumberField, Section, SelectField, TextField } from "./fields";
import { FONT_OPTIONS } from "./options";
import { usePropUpdater } from "./usePropUpdater";
import { useEditorStore } from "../../store/editorStore";
import { REQUIRED_TOTALS } from "../../lib/gst";

type TotalsElement = Extract<CanvasElement, { type: "totals" }>;
type TotalsLine = TotalsElement["props"]["show"][number];

export const TotalsPanel: React.FC<{ element: TotalsElement }> = ({ element }) => {
  const set = usePropUpdater(element);
  const gstInvoice = useEditorStore((s) => s.documentType === "gst_invoice");
  const { props } = element;
  const required = (line: TotalsLine) => gstInvoice && line in REQUIRED_TOTALS;

  // Keep lines in their canonical order whatever order they're toggled in
  const toggle = (line: TotalsLine, on: boolean) =>
    set("show", TOTALS_FIELDS.map((f) => f.key).filter((key) => (key === line ? on : props.show.includes(key))));

  return (
    <>
      <Section title="Totals">
        <p className="text-xs text-muted-foreground">
          Bound to the receipt's computed totals.{gstInvoice && " Tax prints as CGST + SGST within a state, or IGST between states."}
        </p>
        <Field label="Lines to show">
          <div className="grid grid-cols-2 gap-2">
            {TOTALS_FIELDS.map((f) => (
              <CheckboxField
                key={f.key}
                id={`totals-show-${f.key}`}
                label={f.label}
                checked={props.show.includes(f.key)}
                onChange={(on) => toggle(f.key, on)}
                disabled={required(f.key) && props.show.includes(f.key)}
                title={required(f.key) ? "A GST invoice must show this line" : undefined}
              />
            ))}
          </div>
        </Field>
        <CheckboxField id="totals-emphasize" label="Emphasize the total" checked={props.emphasizeTotal} onChange={(v) => set("emphasizeTotal", v)} />
        <TextField id="totals-currency" label="Currency symbol" value={props.currencySymbol} maxLength={CURRENCY_SYMBOL_MAX_LENGTH} onChange={(v) => set("currencySymbol", v)} />
      </Section>
      <Section title="Typography">
        <SelectField id="totals-font" label="Font" value={props.fontFamily} options={FONT_OPTIONS} onChange={(v) => set("fontFamily", v)} />
        <NumberField id="totals-size" label="Size (px)" value={props.fontSize} {...FONT_SIZE_RANGE} live onCommit={(v) => set("fontSize", v)} />
      </Section>
    </>
  );
};
