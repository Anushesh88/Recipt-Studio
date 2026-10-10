# Receipt Studio Backend

FastAPI + SQLAlchemy (async) + Alembic. PDFs are rendered with WeasyPrint,
PNGs with PyMuPDF.

## Setup

```bash
uv venv .venv
uv pip install -e ".[dev]"
.venv/Scripts/alembic upgrade head      # Linux/macOS: .venv/bin/alembic
.venv/Scripts/uvicorn app.main:app --reload
```

The default database is SQLite (`receipt.db`); set `DATABASE_URL` for Postgres
(see `docker-compose.yml`).

### PDF rendering (WeasyPrint system libraries)

WeasyPrint needs GTK/Pango. The Docker image installs them; locally:

- **Windows:** install [MSYS2](https://www.msys2.org) to `C:\msys64`, then in
  an MSYS2 shell run `pacman -S mingw-w64-x86_64-pango`. The renderer finds
  `C:\msys64\mingw64\bin` automatically; for another location set
  `WEASYPRINT_DLL_DIRECTORIES` in `.env`.
- **macOS:** `brew install pango`
- **Debian/Ubuntu:** `apt install libpango-1.0-0 libpangoft2-1.0-0`

Without them the API still runs; exports answer `503 RENDERER_UNAVAILABLE` and
the PDF tests are skipped.

### Fonts

`app/fonts` holds the 8 curated fonts as TrueType, built from the same
`@fontsource` files the editor uses. After changing fonts in the frontend, run
`npm install` there and regenerate:

```bash
.venv/Scripts/python scripts/sync_fonts.py
```

## Checks

```bash
.venv/Scripts/python -m pytest
.venv/Scripts/python -m ruff check .
.venv/Scripts/python -m mypy app tests
```
