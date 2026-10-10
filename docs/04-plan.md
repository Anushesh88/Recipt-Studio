# IMPLEMENTATION PLAN (5 phases, one agent session each)

Status: all five phases are implemented; each phase's "Done when" is covered
by tests (backend pytest, frontend Vitest, Playwright specs in frontend/tests).

Rule for every phase: follow ARCHITECTURE & RULES strictly. Finish with working
code, passing lint/tests, and a short list of what was done.

## Phase 1: Boilerplate & Contracts
- Scaffold repo per directory structure; docker-compose (Postgres + backend).
- Backend: FastAPI app, config, async DB session, Alembic initial migration for
  all four tables (including users.receipt_prefix / numbering_mode /
  receipt_next_seq), /health, JWT register/login.
- Backend: Pydantic canvas models. Ensure the discriminated union uses
  Annotated[Union[...], Field(discriminator="type")] and includes all 7 element
  models. No rotation field. items_table.binding and totals.binding are
  Literal["receipt.items"] / Literal["receipt.totals"]. Enforce max one
  items_table and one totals via a model validator. Validate variables with the
  whitelist regex (built-in or custom.*).
- Frontend: Vite + React + TS + Tailwind + shadcn; routing; API client; Zod
  schema mirroring the Pydantic models.
- Done when: register/login works; empty Templates page loads; schema tests
  pass, including rejection of unknown variables and a second items_table.

## Phase 2: Canvas Interaction
- editorStore with all named actions and zoom.
- Canvas component (fixed-size page, zoom via CSS scale, grid snap, bounds
  clamp, heightMode display).
- Palette with 7 draggable items (dnd-kit) dropping at the cursor position with
  sensible default props (items_table default height = header + 3 sample rows).
- Element components render from props only; react-moveable for move/resize
  (no rotation).
- Selection, delete key, z-order, in-session undo/redo.
- Done when: all 7 types can be dropped, moved, resized, deleted; a second
  items_table/totals drop is blocked with a message.

## Phase 3: Inspector & Content Editing
- Per-type inspector panels (text styling, table columns, totals toggles, QR
  content, divider style).
- Inline text editing on double-click; "Insert variable" dropdown (built-ins +
  "New custom variable...").
- lib/variables.ts: extractVariables() using the shared regex; validation
  message for unknown variables.
- Logo/signature upload: POST /assets, shown in ImageEl/SignatureEl.
- Page preset selector (thermal80 -> heightMode auto; a5/a4 -> fixed).
- Done when: every element's props are editable and reflected live; variables
  render as sample values or highlighted chips on canvas.

## Phase 4: Save, Load, Generate & Numbering  (heaviest phase: split 4a/4b if needed)
- 4a: Templates CRUD (user-scoped, validated); Save / Save As / Load with Zod
  validation; Templates page (list, open, duplicate, delete).
- 4b: Generate page with a form built dynamically from extractVariables() +
  line-items editor + tax/discount; live preview via the same element
  components; lib/layout.ts implementing the Layout Algorithm.
- Backend: numbering_service (sequential atomic increment / nanoid / override
  with 409), GET /receipts/next-number, POST /receipts (variable completeness
  check -> 422, Decimal totals via totals_service, store template_snapshot +
  data).
- Shared fixtures: shared/fixtures/layout_cases.json and variables_cases.json;
  Vitest runs them against layout.ts and variables.ts.
- Done when: save -> reload -> canvas identical; blank number gives R-0001,
  then R-0002; override works; duplicate override returns a clear error; the
  preview pushes elements down as items are added.

## Phase 5: PDF/PNG Export & Polish
- layout_service.py implementing the same Layout Algorithm; pytest runs the
  same shared fixtures. variables_service.resolve() using the whitelist regex.
- render_service: Jinja2 SandboxedEnvironment (autoescape ON); resolved text
  passed as data only. For the receipt.html.j2 generation use ONLY absolute
  positioning (position:absolute; left:{{x}}px; top:{{y}}px;) with the CSS reset
  (* { margin:0; padding:0; box-sizing:border-box; }) and
  @page { size: Wpx Hpx; margin:0 }. No flexbox or grid. Items table is a
  <table> with table-layout: fixed. Fonts are embedded via @font-face from
  backend/app/fonts (same files as the frontend).
- WeasyPrint -> PDF at exact page size (auto height from layout_service);
  segno QR as inline SVG; PyMuPDF -> PNG.
- GET /receipts/{id}/export and POST /preview. CONTENT_OVERFLOW on fixed pages
  returns 422 with a readable message.
- Frontend: Export buttons (PDF/PNG), History page with re-download.
- Parity test: render a sample template with 1, 5 and 30 items; compare element
  positions between the editor DOM and the generated HTML; fix drift.
- Error/loading states, basic rate limiting on exports.
- Done when: exported PDF matches the editor preview for all 7 types, and the
  thermal receipt height tracks item count.