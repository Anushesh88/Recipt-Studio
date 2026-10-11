# Receipt Studio

Design receipt templates in a drag-and-drop editor, fill them in, and export
pixel-matched PDFs and PNGs.

Templates are plain receipts or GST tax invoices (CGST rule 46: GSTINs, HSN
codes, CGST / SGST / IGST, per-financial-year numbering) whose required fields
can't be deleted by accident. Saved customers and items, "Use again", starter
templates and Share make repeat invoices quick; see
[docs/05-gst-and-speed.md](docs/05-gst-and-speed.md). The Templates page has
20 ready-made templates (10 receipts, 10 GST invoices) for different kinds of
business, each previewed with sample data.

Sign in with an email and password, or with Google (see
[Sign in with Google](#sign-in-with-google)).

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

## Hosting it for free

[DEPLOY.md](DEPLOY.md) walks through putting it online at no cost: Neon
(database), Render (backend, from `render.yaml`) and Cloudflare Pages (website).

## Sign in with Google

The Google button appears on the login page once the backend has a client ID:

1. In the [Google Cloud console](https://console.cloud.google.com/apis/credentials),
   create a project, set up the OAuth consent screen (External), then
   **Create credentials > OAuth client ID > Web application**.
2. Under **Authorized JavaScript origins** add `http://localhost:5173` and
   your hosted frontend's address (e.g. `https://your-app.vercel.app`). No
   redirect URIs are needed.
3. Put the client ID in `backend/.env` (and the host's environment variables):
   `GOOGLE_CLIENT_ID=1234-abc.apps.googleusercontent.com`, then restart the
   backend.

The backend checks each Google ID token (signature, expiry, audience) and
only accepts addresses Google has verified. A first Google sign-in creates the
account, or joins the existing account with that email; that account's
password then stops working, since emails aren't verified at registration.

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
