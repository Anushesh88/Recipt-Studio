// Loads the 8 curated fonts (FONT_FAMILIES in units.ts) in the weights the
// inspector offers (FONT_WEIGHTS). Bundled via @fontsource, so nothing is fetched
// from Google at runtime. Phase 5's PDF renderer must embed the same font files
// from backend/app/fonts. Imported once, from main.tsx.
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";

import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/600.css";
import "@fontsource/roboto/700.css";

import "@fontsource/open-sans/400.css";
import "@fontsource/open-sans/500.css";
import "@fontsource/open-sans/600.css";
import "@fontsource/open-sans/700.css";

import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/500.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";

// Lato has no 500/600 cuts; the browser falls back to the nearest weight
import "@fontsource/lato/400.css";
import "@fontsource/lato/700.css";

import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";

import "@fontsource/merriweather/400.css";
import "@fontsource/merriweather/500.css";
import "@fontsource/merriweather/600.css";
import "@fontsource/merriweather/700.css";

import "@fontsource/roboto-mono/400.css";
import "@fontsource/roboto-mono/500.css";
import "@fontsource/roboto-mono/600.css";
import "@fontsource/roboto-mono/700.css";
