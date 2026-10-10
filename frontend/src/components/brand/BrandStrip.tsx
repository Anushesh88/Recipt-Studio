import React from "react";
import { BRAND_STRIP_HEIGHT } from "../../lib/layout";
import { fontStack } from "../../lib/units";

export const BRAND_TEXT = "Made with Receipt Studio";

// The line every receipt carries along its bottom edge. Mirrors the data-brand
// strip in backend app/templates_html/receipt.html.j2 (same size, font, colour).
export const BrandStrip: React.FC<{ top: number; width: number; background?: string }> = ({ top, width, background }) => (
  <div
    data-brand=""
    aria-hidden="true"
    style={{
      position: "absolute", left: 0, top, width, height: BRAND_STRIP_HEIGHT, lineHeight: `${BRAND_STRIP_HEIGHT}px`,
      fontFamily: fontStack("Inter"), fontSize: 8, fontWeight: 500, color: "#9CA3AF",
      textAlign: "center", whiteSpace: "nowrap", pointerEvents: "none", backgroundColor: background,
    }}
  >
    {BRAND_TEXT}
  </div>
);
