import { FONT_FAMILIES, FONT_WEIGHTS, fontStack, type FontFamily } from "../../lib/units";
import type { SelectOption } from "./fields";

// Each option is previewed in its own font
export const FONT_OPTIONS: SelectOption<FontFamily>[] = FONT_FAMILIES.map((family) => ({
  value: family,
  label: family,
  style: { fontFamily: fontStack(family) },
}));

export const FONT_WEIGHT_OPTIONS: SelectOption<string>[] = FONT_WEIGHTS.map((w) => ({
  value: String(w.value),
  label: `${w.label} (${w.value})`,
}));

