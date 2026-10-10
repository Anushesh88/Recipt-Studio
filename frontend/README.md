# Receipt Studio Frontend

React 19 + TypeScript + Vite. Tailwind v4 with shadcn/ui, Zustand for the
editor, TanStack Query for the API, React Hook Form + Zod for forms.

## Setup

```bash
npm install
npm run dev          # http://localhost:5173
```

The app talks to the backend at `http://localhost:8000`. To use another
address, copy `.env.example` to `.env.local` and set `VITE_API_URL`.

## Pages

- `/templates`: your templates (create, duplicate, delete)
- `/editor/:id`: the drag-and-drop template editor
- `/generate/:id`: fill in a receipt from a template, with a live preview
- `/history`: every receipt generated, with PDF/PNG re-download
- `/settings`: business name, receipt number prefix, sequential or random IDs

## Checks

```bash
npx tsc -b           # types
npm run lint         # oxlint
npx vitest run       # unit tests, including the shared fixtures in ../shared
npm run build
```

Browser tests (Playwright, in `tests/*.spec.ts`) run against both dev servers,
so start the backend (see `../backend/README.md`) and `npm run dev` first:

```bash
npx playwright install chromium   # once
npx playwright test
```

They register throwaway `@example.com` accounts in the local dev database.

## Notes

- `src/lib/units.ts` holds every size, limit and layout number; the backend
  renderer mirrors the element layout numbers, so the preview and the PDF
  match.
- Fonts are bundled with `@fontsource`; the backend copies are built from the
  same files by `backend/scripts/sync_fonts.py`.
