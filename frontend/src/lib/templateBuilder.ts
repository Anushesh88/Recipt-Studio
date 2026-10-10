// Lays out a template top to bottom, so ready-made templates never overlap and
// every box is as tall as its content: text by its line count, tables by header
// + sample rows (the Layout Algorithm), totals by their printed lines. Everything
// lands on the editor grid. Used by lib/starterTemplates.ts.
import type { Canvas, CanvasElement } from "../schema/templateSchema";
import { tableHeight } from "./layout";
import { signatureLayout, totalsRows } from "./elementLayout";
import { SAMPLE_GST_TAX_ROWS } from "./gstTemplate";
import { GRID_SIZE, ITEMS_TABLE_SAMPLE_ROWS, MIN_DESIGN_HEIGHT, PAGE_PRESETS, type FontFamily, type PagePreset, type TotalsLine } from "./units";

type El<T extends CanvasElement["type"]> = Extract<CanvasElement, { type: T }>;
type TextStyle = Partial<El<"text">["props"]>;
type TableProps = El<"items_table">["props"];
type Column = TableProps["columns"][number];
type Align = "left" | "center" | "right";

const snap = (v: number) => Math.ceil(v / GRID_SIZE) * GRID_SIZE;

interface Theme {
  font: FontFamily;
  color: string;
  currency: string;
  gst: boolean;
}

export class Sheet {
  private readonly elements: CanvasElement[];
  private readonly theme: Theme;
  readonly x: number;
  readonly width: number;
  y: number;

  constructor(elements: CanvasElement[], theme: Theme, x: number, width: number, y: number) {
    this.elements = elements;
    this.theme = theme;
    this.x = x;
    this.width = width;
    this.y = y;
  }

  gap(px = 8): this {
    this.y = snap(this.y + px);
    return this;
  }

  private left(width: number, align: Align) {
    if (align === "right") return this.x + this.width - width;
    if (align === "center") return this.x + Math.floor((this.width - width) / 2 / GRID_SIZE) * GRID_SIZE;
    return this.x;
  }

  private add<T extends CanvasElement["type"]>(element: Omit<El<T>, "zIndex" | "locked">): this {
    this.elements.push({ ...element, zIndex: this.elements.length + 1, locked: false } as CanvasElement);
    this.y = snap(element.y + element.height);
    return this;
  }

  // `lines` reserves room for wrapping (an address, say); defaults to the line breaks
  text(id: string, content: string, style: TextStyle = {}, lines = content.split("\n").length): this {
    const props = {
      content, fontFamily: this.theme.font, fontSize: 12, fontWeight: 400, color: this.theme.color, align: "left" as const, lineHeight: 1.3,
      ...style,
    };
    const height = snap(lines * Math.ceil(props.fontSize * props.lineHeight) + 2);
    return this.add<"text">({ id, type: "text", x: this.x, y: this.y, width: this.width, height, props });
  }

  divider(id: string, style: El<"divider">["props"]["style"] = "dashed", color = "#999999", thickness = 1): this {
    return this.add<"divider">({ id, type: "divider", x: this.x, y: this.y, width: this.width, height: 8, props: { style, thickness, color } });
  }

  table(id: string, columns: Column[], style: Partial<Omit<TableProps, "binding" | "columns">> = {}): this {
    const props: TableProps = {
      binding: "receipt.items", columns, fontFamily: this.theme.font, fontSize: 12, lineHeight: 1.3, rowPadding: 4,
      headerBold: true, rowDivider: true, color: this.theme.color, ...style,
    };
    return this.add<"items_table">({ id, type: "items_table", x: this.x, y: this.y, width: this.width, height: tableHeight(props, ITEMS_TABLE_SAMPLE_ROWS), props });
  }

  totals(id: string, show: TotalsLine[], opts: { width?: number; fontSize?: number; align?: Align; emphasizeTotal?: boolean } = {}): this {
    const width = Math.min(opts.width ?? 200, this.width);
    const props: El<"totals">["props"] = {
      binding: "receipt.totals", show, fontFamily: this.theme.font, fontSize: opts.fontSize ?? 13,
      emphasizeTotal: opts.emphasizeTotal ?? true, currencySymbol: this.theme.currency,
    };
    const rows = totalsRows(props, this.theme.gst ? SAMPLE_GST_TAX_ROWS : undefined);
    const last = rows[rows.length - 1];
    const height = snap(last.top + last.height);
    return this.add<"totals">({ id, type: "totals", x: this.left(width, opts.align ?? "right"), y: this.y, width, height, props });
  }

  signature(id: string, label: string, opts: { width?: number; height?: number; align?: Align; color?: string } = {}): this {
    const width = Math.min(opts.width ?? 180, this.width);
    const height = opts.height ?? 60;
    if (signatureLayout(height).imageHeight < 8) throw new Error(`${id}: too short for a signature`);
    return this.add<"signature">({
      id, type: "signature", x: this.left(width, opts.align ?? "right"), y: this.y, width, height,
      props: { label, assetId: null, lineColor: opts.color ?? this.theme.color },
    });
  }

  qr(id: string, content: string, size = 96, align: Align = "center"): this {
    return this.add<"qr">({ id, type: "qr", x: this.left(size, align), y: this.y, width: size, height: size, props: { content, errorCorrection: "M" } });
  }

  logo(id: string, width: number, height: number, align: Align = "center"): this {
    return this.add<"image">({ id, type: "image", x: this.left(width, align), y: this.y, width, height, props: { source: "logo", assetId: null, fit: "contain" } });
  }

  // Side-by-side blocks starting at the current y, each a fraction of the width;
  // the sheet carries on below the tallest
  columns(specs: [number, (column: Sheet) => void][], gutter = 16): this {
    const available = this.width - gutter * (specs.length - 1);
    let x = this.x;
    let bottom = this.y;
    specs.forEach(([fraction, fill], i) => {
      const width = i === specs.length - 1 ? this.x + this.width - x : Math.floor((available * fraction) / GRID_SIZE) * GRID_SIZE;
      const column = new Sheet(this.elements, this.theme, x, width, this.y);
      fill(column);
      bottom = Math.max(bottom, column.y);
      x += width + gutter;
    });
    this.y = bottom;
    return this;
  }
}

export interface DesignOptions {
  preset: PagePreset;
  documentType?: Canvas["documentType"];
  font?: FontFamily;
  color?: string;
  background?: string;
  currency?: string;
}

// Builds a canvas: `draw` fills the page from the top margin down. Thermal pages
// get a design height that fits the content; fixed pages must already fit.
export function design(options: DesignOptions, draw: (sheet: Sheet) => void): Canvas {
  const documentType = options.documentType ?? "receipt";
  const base = PAGE_PRESETS[options.preset];
  const elements: CanvasElement[] = [];
  const sheet = new Sheet(
    elements,
    { font: options.font ?? "Inter", color: options.color ?? "#111111", currency: options.currency ?? "₹", gst: documentType === "gst_invoice" },
    base.margin, base.width - 2 * base.margin, base.margin,
  );
  draw(sheet);
  const contentBottom = snap(sheet.y + base.margin);
  const page = { ...base, background: options.background ?? base.background };
  if (page.heightMode === "auto") page.height = Math.max(MIN_DESIGN_HEIGHT, contentBottom);
  else if (contentBottom > page.height) throw new Error(`Content runs past the ${options.preset} page`);
  return { schemaVersion: 1, documentType, page, elements };
}

export const col = (key: Column["key"], label: string, width: number, align: Column["align"] = key === "description" || key === "hsn" ? "left" : "right"): Column =>
  ({ key, label, width, align });
