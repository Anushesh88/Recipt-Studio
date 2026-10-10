# ARCHITECTURE & RULES

## Tech Stack
### Frontend
- React 19 + TypeScript (strict) + Vite
- @dnd-kit/core: palette -> canvas drops ONLY
- react-moveable: drag + resize of elements already on canvas (NO rotation)
- Zustand + immer: editor state
- TanStack Query: server state
- React Hook Form + Zod: forms
- Tailwind CSS + shadcn/ui
- qrcode.react (QR rendering)
- @fontsource/* packages for the 8 curated fonts
- Vitest (unit tests) + Playwright (browser tests against the dev servers)

### Backend
- Python 3.12, FastAPI, Uvicorn
- Pydantic v2 (all request/response/template validation)
- SQLAlchemy 2.0 (typed, async) + Alembic
- PostgreSQL (SQLite for local dev)
- Auth: JWT via python-jose + passlib[bcrypt]
- PDF: WeasyPrint + Jinja2 (SandboxedEnvironment, autoescape ON)
- PNG: PyMuPDF (rasterize the PDF)
- QR: segno (SVG output)
- Tooling: ruff, mypy, pytest, httpx

## Directory Structure
receipt-studio/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/            # config.py, security.py, db.py
│   │   ├── models/          # SQLAlchemy ORM
│   │   ├── schemas/         # Pydantic: auth, template, receipt, canvas
│   │   ├── api/             # routers: auth, templates, receipts, assets
│   │   ├── services/        # render_service, totals_service, asset_service,
│   │   │                    # layout_service, variables_service, numbering_service
│   │   ├── fonts/           # bundled .ttf/.woff2 for the 8 fonts
│   │   └── templates_html/  # receipt.html.j2
│   ├── alembic/
│   ├── tests/
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── api/             # typed client + TanStack Query hooks
│   │   ├── components/
│   │   │   ├── canvas/      # Canvas, CanvasElement, SelectionBox
│   │   │   ├── elements/    # TextEl, ImageEl, TableEl, TotalsEl, QrEl,
│   │   │   │                # SignatureEl, DividerEl
│   │   │   ├── palette/
│   │   │   ├── inspector/
│   │   │   └── ui/
│   │   ├── store/           # editorStore.ts
│   │   ├── schema/          # templateSchema.ts (Zod, mirrors backend)
│   │   ├── pages/           # Login, Templates, Editor, Generate, History
│   │   └── lib/             # units.ts, ids.ts, variables.ts, layout.ts
│   └── package.json
├── shared/fixtures/         # layout_cases.json, variables_cases.json
│                            # (tested by BOTH frontend and backend)
├── docs/
└── docker-compose.yml

## Backend Rules
1. Every endpoint has a Pydantic request AND response model. No raw dicts.
2. Template `canvas` is validated by a Pydantic discriminated union:
   Annotated[Union[...7 models...], Field(discriminator="type")].
   Reject unknown types and out-of-range values.
3. Routers contain no business logic; call `services/`.
4. All DB access is async; scope every query by `user_id`.
5. Money: computed server-side with Decimal only (subtotal, line totals, tax,
   discount, total). Never trust client-computed money. Store as strings in
   JSON and NUMERIC in columns.
6. Uploads: validate MIME + size, store under uuid filename, ignore original
   filename. PNG/JPG only.
7. IDs: UUID4 for all database primary keys. `receipt_number` is a separate
   customer-facing string produced by `numbering_service`:
   - sequential mode: atomic `UPDATE users SET receipt_next_seq = receipt_next_seq + 1
     ... RETURNING` -> f"{prefix}{seq:04d}"
   - nanoid mode: 10-char NanoID, uppercase alphanumeric
   - if the client supplies a number, use it as-is after uniqueness check
     (409 on conflict); do not consume the sequence.
8. Variables: resolve placeholders with `variables_service.resolve()` using a
   whitelist regex: \{\{\s*([a-z_]+(?:\.[a-z_]+)?)\s*\}\}
   NEVER pass user text to Jinja as template source or use Template(user_string).
   Resolved strings are passed to Jinja only as DATA, with autoescape ON.
9. On POST /receipts, extract the variables used in the template and reject the
   request if any required variable has no value (422 with field names).
10. Layout (auto-height / push-down) is computed in `layout_service` before
    rendering, using the algorithm in the Data Schema doc. WeasyPrint / PyMuPDF
    are synchronous, so they run on a worker thread (render_service
    render_pdf_async / pdf_to_png_async), never on the event loop.
11. Type hints required; ruff + mypy must pass.
12. SECRET_KEY: the built-in dev key is public, so it's only accepted with
    APP_ENV=development (the default). The Docker image runs as production and
    refuses to start without a key of at least 32 characters.

## Frontend Rules
1. Canvas state lives ONLY in `editorStore`. Components never hold element
   geometry in local state.
2. Store shape: { page, elements: Element[], selectedId, zoom }.
   Flat array ordered by paint order. No nested trees.
3. All mutations go through named actions: addElement, updateElement,
   moveElement, resizeElement, deleteElement, reorderElement, loadTemplate.
4. Geometry is stored in CSS px at 96 DPI, unscaled. Zoom is a view transform
   only (CSS scale).
5. dnd-kit = palette -> canvas drops. react-moveable = move/resize on canvas.
   Do not mix the two on one element. Rotation is NOT supported.
6. Snap to a 4px grid; clamp elements inside page bounds.
7. Each element type has one pure component (props in, DOM out, no store
   access) reused by editor, generate preview and tests.
8. Validate loaded templates with Zod before putting them in the store.
9. Undo/redo: snapshot stack of `elements` (max 50), in-memory.
10. No `any`. No magic numbers: constants live in `lib/units.ts`.
11. Variables: text/QR content uses mustache placeholders. `lib/variables.ts`
    exposes extractVariables(template) using the SAME regex as the backend.
    The Generate form is built dynamically from that list (built-ins ->
    named fields, custom.* -> text inputs labeled from the key), plus the
    line-items editor. Unknown variables block saving.
12. Layout: `lib/layout.ts` implements the same push-down algorithm as
    `layout_service.py` and is verified against shared/fixtures.
13. Receipt-number field in the form is optional; show the next auto number as
    placeholder text. Blank = auto.

## Parity Rule (critical)
Editor, live preview and PDF must render element x/y/width/height as
`position:absolute` in px inside a fixed-size page container.
Rendering rules for `receipt.html.j2`:
- CSS reset: * { margin:0; padding:0; box-sizing:border-box; }
- @page { size: {{page_w}}px {{page_h}}px; margin: 0; }
- html, body { width: {{page_w}}px; height: {{page_h}}px; }
- ONLY absolute positioning for elements. NO flexbox, NO grid.
- Inside items_table use a real <table> with table-layout: fixed; fixed row
  height; single-line cells with overflow hidden + text-overflow: ellipsis.
- Every element sets explicit width, height, line-height, overflow: hidden.
- Fonts: the same 8 fonts are bundled in backend/app/fonts (loaded via
  @font-face with local file paths) and in the frontend via @fontsource.
  No runtime Google Fonts requests. backend/scripts/sync_fonts.py builds the
  backend copies from the frontend's @fontsource files: TrueType, with each
  weight's latin + latin-ext subsets merged into one file (WeasyPrint does not
  switch subset files mid-run, so e.g. "Total ₹" would lose the rupee sign).
- Multi-part elements (totals, signature, divider) place their parts at
  explicit offsets from frontend/src/lib/elementLayout.ts (numbers in
  lib/units.ts), mirrored by backend render_service.py.
- Any change to element rendering must be made in BOTH the React component and
  receipt.html.j2.