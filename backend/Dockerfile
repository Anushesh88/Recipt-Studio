FROM python:3.12-slim

WORKDIR /app

# WeasyPrint's system libraries (Pango for text layout, HarfBuzz subsetting for
# embedding fonts in PDFs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libharfbuzz-subset0 \
    libffi-dev \
    shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast resolution/installation
RUN pip install uv

# pyproject.toml names README.md as the package readme, so both are needed to install
COPY pyproject.toml README.md ./
RUN uv pip install --system -e .[dev]

COPY . .

# A real deployment: refuses to start without a SECRET_KEY of its own
# (docker-compose.yml switches back to development for local use)
ENV APP_ENV=production

# Bring the database schema up to date, then serve
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
