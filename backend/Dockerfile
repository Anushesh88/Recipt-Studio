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

# pyproject.toml names README.md as the package readme, so both are needed to
# install. Just the runtime dependencies: the test tools stay out of the image
# (tests run from a local virtualenv, see README.md)
COPY pyproject.toml README.md ./
RUN uv pip install --system -r pyproject.toml

COPY . .

# Run as an ordinary user (uid 1000, which Hugging Face Spaces uses), with
# write access only to the PDF cache. Font caches go to its home folder.
RUN useradd --create-home --uid 1000 app     && mkdir -p /app/storage     && chown -R app:app /app/storage
USER app
ENV HOME=/home/app

# A real deployment: refuses to start without a SECRET_KEY of its own
# (docker-compose.yml switches back to development for local use)
ENV APP_ENV=production

# Bring the database schema up to date, then serve
# on the port the host assigns ($PORT on Render / Koyeb; Hugging Face uses the
# app_port in the Space's README, 8000), trusting its proxy for the visitor's
# address and https
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
