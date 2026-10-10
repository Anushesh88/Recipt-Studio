import React from "react";
import { AlignCenter, AlignLeft, AlignRight, ArrowLeft, ArrowRight, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CanvasElement } from "../../schema/templateSchema";
import {
  COLUMN_MIN_WIDTH_PERCENT,
  COLUMN_WIDTH_PRECISION,
  FONT_SIZE_RANGE,
  ITEM_COLUMN_KEYS,
  LINE_HEIGHT_RANGE,
  PERCENT,
  ROW_PADDING_RANGE,
} from "../../lib/units";
import { CheckboxField, ColorField, NumberField, Section, SegmentedField, SelectField } from "./fields";
import { FONT_OPTIONS } from "./options";
import { usePropUpdater } from "./usePropUpdater";

type TableElement = Extract<CanvasElement, { type: "items_table" }>;
type Column = TableElement["props"]["columns"][number];

const ALIGN_OPTIONS = [
  { value: "left", label: "Left", icon: <AlignLeft /> },
  { value: "center", label: "Center", icon: <AlignCenter /> },
  { value: "right", label: "Right", icon: <AlignRight /> },
] as const;


const round = (width: number) => Math.round(width * COLUMN_WIDTH_PRECISION) / COLUMN_WIDTH_PRECISION;
const totalPercent = (columns: Column[]) => Math.round(columns.reduce((sum, c) => sum + c.width, 0) * PERCENT);

// Rescales widths so they sum to 1 (100%), keeping their proportions
const normalize = (columns: Column[]): Column[] => {
  const sum = columns.reduce((s, c) => s + c.width, 0);
  return columns.map((c) => ({ ...c, width: round(sum > 0 ? c.width / sum : 1 / columns.length) }));
};

export const TablePanel: React.FC<{ element: TableElement }> = ({ element }) => {
  const set = usePropUpdater(element);
  const { props } = element;
  const columns = props.columns;
  const unusedKeys = ITEM_COLUMN_KEYS.filter((k) => !columns.some((c) => c.key === k.key));
  const total = totalPercent(columns);

  const setColumns = (next: Column[]) => set("columns", next);
  const updateColumn = (index: number, patch: Partial<Column>) =>
    setColumns(columns.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  const move = (index: number, delta: number) => {
    const next = [...columns];
    const [col] = next.splice(index, 1);
    next.splice(index + delta, 0, col);
    setColumns(next);
  };
  // New column takes an equal share; the others shrink proportionally
  const addColumn = () => {
    const option = unusedKeys[0];
    if (!option) return;
    const share = 1 / (columns.length + 1);
    setColumns(normalize([
      ...columns.map((c) => ({ ...c, width: c.width * (1 - share) })),
      { key: option.key, label: option.label, width: share, align: "left" },
    ]));
  };
  const removeColumn = (index: number) => setColumns(normalize(columns.filter((_, i) => i !== index)));

  return (
    <>
      <Section title="Columns">
        <p className="text-xs text-muted-foreground">Bound to the receipt's line items. The canvas shows sample rows.</p>
        {columns.map((col, i) => {
          const keyOptions = ITEM_COLUMN_KEYS.filter((k) => k.key === col.key || !columns.some((c) => c.key === k.key))
            .map((k) => ({ value: k.key, label: `Field: ${k.label}` }));
          return (
            <div key={col.key} className="space-y-2 rounded-lg border border-border p-2" data-column={col.key}>
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <label htmlFor={`col-label-${col.key}`} className="text-xs font-medium">Header</label>
                  <Input id={`col-label-${col.key}`} value={col.label} className="h-8" onChange={(e) => updateColumn(i, { label: e.target.value })} />
                </div>
                <div className="w-24">
                  <NumberField
                    id={`col-width-${col.key}`}
                    label="Width %"
                    value={Math.round(col.width * PERCENT)}
                    min={COLUMN_MIN_WIDTH_PERCENT}
                    max={PERCENT}
                    live
                    onCommit={(pct) => updateColumn(i, { width: pct / PERCENT })}
                  />
                </div>
              </div>
              <SelectField id={`col-key-${col.key}`} label="Shows" value={col.key} options={keyOptions} onChange={(key) => updateColumn(i, { key })} />
              <div className="flex items-end justify-between">
                <SegmentedField label="Align" value={col.align} options={ALIGN_OPTIONS} onChange={(align) => updateColumn(i, { align })} />
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="icon-xs" aria-label="Move column left" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowLeft />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-xs" aria-label="Move column right" disabled={i === columns.length - 1} onClick={() => move(i, 1)}>
                    <ArrowRight />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-xs" aria-label="Remove column" disabled={columns.length === 1} onClick={() => removeColumn(i)}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs ${total === PERCENT ? "text-muted-foreground" : "text-destructive"}`}>
            Total width: {total}%
          </span>
          <div className="flex gap-1">
            {total !== PERCENT && (
              <Button type="button" variant="outline" size="xs" onClick={() => setColumns(normalize(columns))}>
                Fit to 100%
              </Button>
            )}
            <Button type="button" variant="outline" size="xs" disabled={unusedKeys.length === 0} onClick={addColumn}>
              <Plus />
              Add column
            </Button>
          </div>
        </div>
      </Section>
      <Section title="Typography">
        <SelectField id="table-font" label="Font" value={props.fontFamily} options={FONT_OPTIONS} onChange={(v) => set("fontFamily", v)} />
        <div className="grid grid-cols-3 gap-2">
          <NumberField id="table-size" label="Size" value={props.fontSize} {...FONT_SIZE_RANGE} live onCommit={(v) => set("fontSize", v)} />
          <NumberField id="table-line-height" label="Line h." value={props.lineHeight} {...LINE_HEIGHT_RANGE} live onCommit={(v) => set("lineHeight", v)} />
          <NumberField id="table-padding" label="Padding" value={props.rowPadding} {...ROW_PADDING_RANGE} live onCommit={(v) => set("rowPadding", v)} />
        </div>
        <p className="text-xs text-muted-foreground">The table's height follows these: header + sample rows.</p>
        <ColorField id="table-color" label="Color" value={props.color} onChange={(v) => set("color", v)} />
        <CheckboxField id="table-header-bold" label="Bold header" checked={props.headerBold} onChange={(v) => set("headerBold", v)} />
        <CheckboxField id="table-row-divider" label="Row dividers" checked={props.rowDivider} onChange={(v) => set("rowDivider", v)} />
      </Section>
    </>
  );
};
