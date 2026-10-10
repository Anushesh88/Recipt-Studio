# Receipt Studio

Design receipt templates in a drag-and-drop editor, fill them in, and export
pixel-matched PDFs and PNGs.

- `frontend/`: React + Vite app (editor, generate form, history, settings)
- `backend/`: FastAPI API, numbering, totals, and the WeasyPrint renderer
- `shared/fixtures/`: layout, variable and totals cases that both test suites run
- `docs/`: product spec, architecture, schema and the implementation plan

## Quick start

Backend (Python 3.12+, [uv](https://docs.astral.sh/uv/)):

```bash
cd backend
uv venv .venv
uv pip install -e ".[dev]"
cp .env.example .env
.venv/Scripts/alembic upgrade head      # Linux/macOS: .venv/bin/alembic
.venv/Scripts/uvicorn app.main:app --reload
```

PDF export needs Pango; see [backend/README.md](backend/README.md) for each OS.

Frontend (Node 20.19+ or 22.12+, as Vite requires):

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173, register, and create a template.

## Docker

```bash
docker compose up --build
```

This starts Postgres, runs the migrations, and serves the API on port 8000.
Run the frontend with `npm run dev` as above.

The compose file is for local development (it uses the public dev
`SECRET_KEY`). The backend image on its own runs as production and needs a real
`SECRET_KEY`; see [backend/README.md](backend/README.md#setup).

## Tests

See [backend/README.md](backend/README.md#checks) and
[frontend/README.md](frontend/README.md#checks).
