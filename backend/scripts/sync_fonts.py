"""Copies the curated fonts into app/fonts for the PDF renderer.

The editor loads these fonts from @fontsource (frontend/src/lib/fonts.ts); the
PDF must use the very same files (Architecture parity rule), so this takes
those exact woff2 subset files, converts them to TrueType and merges each
weight's subsets into one font, then writes app/fonts/fonts.json.

Why merge: browsers pick the right subset per character via unicode-range, but
WeasyPrint (Pango) keeps using the first subset's file for the rest of a text
run, so e.g. "Total ₹" lost the rupee sign. One font per weight with every
glyph avoids that; the glyphs are identical because the subsets come from the
same source font.

Run from backend/ after `npm install` in frontend/:
    .venv/Scripts/python scripts/sync_fonts.py
"""
import json
import shutil
import tempfile
from pathlib import Path

from fontTools.merge import Merger
from fontTools.ttLib import TTFont

BACKEND = Path(__file__).resolve().parents[1]
FONTSOURCE = BACKEND.parent / "frontend" / "node_modules" / "@fontsource"
OUT = BACKEND / "app" / "fonts"

# Keep in step with FONT_FAMILIES (lib/units.ts) and the weights in lib/fonts.ts
FAMILIES: dict[str, tuple[str, tuple[int, ...]]] = {
    "Inter": ("inter", (400, 500, 600, 700)),
    "Roboto": ("roboto", (400, 500, 600, 700)),
    "Open Sans": ("open-sans", (400, 500, 600, 700)),
    "Montserrat": ("montserrat", (400, 500, 600, 700)),
    "Lato": ("lato", (400, 700)),
    "Poppins": ("poppins", (400, 500, 600, 700)),
    "Merriweather": ("merriweather", (400, 500, 600, 700)),
    "Roboto Mono": ("roboto-mono", (400, 500, 600, 700)),
}
# Latin covers English and most of Western Europe, latin-ext the rest of
# Europe plus currency signs such as the rupee (U+20B9)
SUBSETS = ("latin", "latin-ext")

def merged_font(package: Path, slug: str, weight: int, target: Path) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        parts = []
        for subset in SUBSETS:
            font = TTFont(package / "files" / f"{slug}-{subset}-{weight}-normal.woff2")
            font.flavor = None  # woff2 -> plain TrueType
            part = Path(tmp) / f"{subset}.ttf"
            font.save(part)
            parts.append(str(part))
        Merger().merge(parts).save(target)


def main() -> None:
    if not FONTSOURCE.exists():
        raise SystemExit(f"{FONTSOURCE} not found: run `npm install` in frontend/ first")
    OUT.mkdir(parents=True, exist_ok=True)
    for stale in OUT.glob("*.ttf"):
        stale.unlink()
    (OUT / "licenses").mkdir(exist_ok=True)
    manifest = []
    for family, (slug, weights) in FAMILIES.items():
        package = FONTSOURCE / slug
        shutil.copyfile(package / "LICENSE", OUT / "licenses" / f"{slug}.txt")
        for weight in weights:
            target = OUT / f"{slug}-{weight}.ttf"
            merged_font(package, slug, weight, target)
            manifest.append({"family": family, "weight": weight, "file": target.name})
    (OUT / "fonts.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(manifest)} fonts to {OUT}")


if __name__ == "__main__":
    main()
