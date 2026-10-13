// The brand kit (Settings): a colour and a font pairing that templates take on.
// applyBrand() restyles a template: headings (bold text) get the heading font,
// everything else the body font, and the template's own accent colour (any
// clearly coloured text, rule or signature line) becomes the brand colour, with
// pale tints of it becoming pale tints of the brand colour. Greys, black and
// the page background stay as they are, so the design still reads the same.
import type { Canvas, CanvasElement } from "../schema/templateSchema";
import type { FontFamily } from "./units";

export interface FontPair {
  id: string;
  label: string;
  heading: FontFamily;
  body: FontFamily;
}

// Must match backend schemas/auth.py BrandFonts
export const BRAND_FONT_PAIRS: readonly FontPair[] = [
  { id: "inter", label: "Clean (Inter)", heading: "Inter", body: "Inter" },
  { id: "poppins-inter", label: "Friendly (Poppins + Inter)", heading: "Poppins", body: "Inter" },
  { id: "montserrat-open-sans", label: "Bold (Montserrat + Open Sans)", heading: "Montserrat", body: "Open Sans" },
  { id: "merriweather-lato", label: "Classic (Merriweather + Lato)", heading: "Merriweather", body: "Lato" },
  { id: "roboto", label: "Simple (Roboto)", heading: "Roboto", body: "Roboto" },
];

export const fontPair = (id: string | null | undefined) => BRAND_FONT_PAIRS.find((p) => p.id === id);

// A few ready colours for people without a brand colour yet
export const BRAND_COLOR_SWATCHES = ["#4F46E5", "#0F766E", "#B91C1C", "#9D174D", "#C2410C", "#15803D", "#1E3A8A", "#111827"];

export interface Brand {
  color?: string | null; // #RRGGBB
  fonts?: string | null; // a BRAND_FONT_PAIRS id
}

export const hasBrand = (brand: Brand | undefined) => Boolean(brand && (brand.color || fontPair(brand.fonts)));

const HEX = /^#[0-9a-f]{6}$/i;

function hsl(hex: string): { s: number; l: number } {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { s, l };
}

// "accent": a real colour; "tint": a pale wash of one; null: grey, black, white
export function colorRole(hex: string): "accent" | "tint" | null {
  if (!HEX.test(hex)) return null;
  const { s, l } = hsl(hex);
  if (s < 0.25) return null;
  if (l > 0.75) return "tint";
  return l >= 0.12 ? "accent" : null;
}

// `amount` of the way from the colour to white
export function lighten(hex: string, amount: number): string {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16);
    return Math.round(v + (255 - v) * amount).toString(16).padStart(2, "0");
  };
  return `#${channel(1)}${channel(3)}${channel(5)}`.toUpperCase();
}

function recolor(current: string, brand: string): string {
  const role = colorRole(current);
  if (role === "accent") return brand.toUpperCase();
  if (role === "tint") return lighten(brand, 0.8);
  return current;
}

// Monospace text is a deliberate till-roll look; it keeps its font
const keepsFont = (font: FontFamily) => font === "Roboto Mono";

function brandElement(element: CanvasElement, brand: Brand): CanvasElement {
  const pair = fontPair(brand.fonts);
  const color = brand.color && HEX.test(brand.color) ? brand.color : null;
  const font = (current: FontFamily, heading: boolean) => (!pair || keepsFont(current) ? current : heading ? pair.heading : pair.body);
  switch (element.type) {
    case "text":
      return {
        ...element,
        props: {
          ...element.props,
          fontFamily: font(element.props.fontFamily, element.props.fontWeight >= 600),
          color: color ? recolor(element.props.color, color) : element.props.color,
        },
      };
    case "items_table":
      return { ...element, props: { ...element.props, fontFamily: font(element.props.fontFamily, false), color: color ? recolor(element.props.color, color) : element.props.color } };
    case "totals":
      return { ...element, props: { ...element.props, fontFamily: font(element.props.fontFamily, false) } };
    case "divider":
      return color ? { ...element, props: { ...element.props, color: recolor(element.props.color, color) } } : element;
    case "signature":
      return color ? { ...element, props: { ...element.props, lineColor: recolor(element.props.lineColor, color) } } : element;
    default:
      return element;
  }
}

export function applyBrand(canvas: Canvas, brand: Brand | undefined): Canvas {
  if (!brand || !hasBrand(brand)) return canvas;
  return { ...canvas, elements: canvas.elements.map((element) => brandElement(element, brand)) };
}
