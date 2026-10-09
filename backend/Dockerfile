FROM python:3.12-slim

WORKDIR /app

# Install system dependencies (WeasyPrint needs these)
RUN apt-get update && apt-get install -y \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libjpeg-dev \
    libopenjp2-7-dev \
    libffi-dev \
    shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast resolution/installation
RUN pip install uv

COPY pyproject.toml ./
RUN uv pip install --system -e .[dev]

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
