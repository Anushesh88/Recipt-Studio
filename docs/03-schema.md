# DATA SCHEMA

## Saved Template JSON (`templates.canvas`)
{
  "schemaVersion": 1,
  "page": {
    "preset": "thermal80",        // thermal80 | a5 | a4
    "width": 302,                 // px @96dpi (80mm ~ 302px)
    "height": 640,                // design height; for auto mode = design-time height
    "heightMode": "auto",         // auto (thermal80 default) | fixed (a5, a4)
    "background": "#FFFFFF",
    "margin": 12
  },
  "elements": [
    {
      "id": "el_9f2a1c",
      "type": "image",
      "x": 90, "y": 12, "width": 120, "height": 60,
      "zIndex": 1, "locked": false,
      "props": { "source": "logo", "assetId": "<uuid>", "fit": "contain" }
    },
    {
      "id": "el_b71e04",
      "type": "text",
      "x": 12, "y": 80, "width": 278, "height": 28,
      "zIndex": 2, "locked": false,
      "props": {
        "content": "Receipt {{receipt.number}}",
        "fontFamily": "Inter", "fontSize": 16, "fontWeight": 600,
        "color": "#111111", "align": "center", "lineHeight": 1.3
      }
    },
    {
      "id": "el_c33d90",
      "type": "items_table",
      "x": 12, "y": 130, "width": 278, "height": 100,
      "zIndex": 3, "locked": false,
      "props": {
        "binding": "receipt.items",        // fixed literal in V1
        "columns": [
          { "key": "description", "label": "Item",  "width": 0.45, "align": "left"  },
          { "key": "qty",         "label": "Qty",   "width": 0.15, "align": "right" },
          { "key": "unit_price",  "label": "Price", "width": 0.20, "align": "right" },
          { "key": "line_total",  "label": "Total", "width": 0.20, "align": "right" }
        ],
        "fontFamily": "Inter", "fontSize": 12, "lineHeight": 1.3,
        "rowPadding": 4, "headerBold": true, "rowDivider": true,
        "color": "#111111"
      }
    },
    {
      "id": "el_d02f77",
      "type": "totals",
      "x": 120, "y": 240, "width": 170, "height": 90,
      "zIndex": 4, "locked": false,
      "props": {
        "binding": "receipt.totals",       // fixed literal in V1
        "show": ["subtotal", "tax", "discount", "total"],
        "fontFamily": "Inter", "fontSize": 13, "emphasizeTotal": true,
        "currencySymbol": "$"
      }
    },
    {
      "id": "el_e55a12",
      "type": "qr",
      "x": 100, "y": 350, "width": 100, "height": 100,
      "zIndex": 5, "locked": false,
      "props": { "content": "{{receipt.number}}", "errorCorrection": "M" }
    },
    {
      "id": "el_f10b66",
      "type": "signature",
      "x": 12, "y": 480, "width": 140, "height": 50,
      "zIndex": 6, "locked": false,
      "props": { "label": "Authorized signature", "assetId": null, "lineColor": "#111111" }
    },
    {
      "id": "el_a09c31",
      "type": "divider",
      "x": 12, "y": 118, "width": 278, "height": 2,
      "zIndex": 2, "locked": false,
      "props": { "style": "dashed", "thickness": 1, "color": "#999999" }
    }
  ]
}

### Element types (V1)
text | image | items_table | totals | qr | signature | divider
(There is NO rotation field anywhere.)

### Variables
Pattern: {{namespace.key}}   regex: \{\{\s*([a-z_]+(?:\.[a-z_]+)?)\s*\}\}
Built-in: business.name, customer.name, customer.email, receipt.number,
          receipt.date, receipt.payment_method, receipt.currency, receipt.notes
Custom:   custom.<key>  (a-z and underscore; the regex above does not match digits)
Allowed in: text.props.content, qr.props.content only.

### Validation rules
- id unique within template; x/y >= 0; width/height >= 8
- element must fit within page width; for fixed-height pages also within height
- array order is canonical paint order; zIndex is informational/redundant
- fontSize 6..96; colors are 6-digit hex; fontFamily in the curated 8
- max 1 items_table, max 1 totals; max 100 elements; JSON max 256 KB
- every variable used must be built-in or custom.*
- the page size comes from its preset: thermal80 302 wide, auto height, design
  height 200..3000; a5 559 x 794 and a4 794 x 1123, fixed; margin 0..96
- y and height at most 3000; fontWeight 400/500/600/700; lineHeight 0.8..3;
  table rowPadding 0..24, 1-4 columns, each a distinct line-item field
  (description, qty, unit_price, line_total) with width 0..1; labels at most
  100 characters; currencySymbol at most 4; divider thickness 1..8; asset ids
  are UUIDs; no Infinity / NaN anywhere (the editor's own input ranges, so the
  API accepts exactly what the editor can make)
- QR content must fit a QR code: at most 2953 / 2331 / 1663 / 1273 UTF-8 bytes
  at error correction L / M / Q / H. Checked on the template, and again with
  the values filled in when a receipt is created or rendered

## Layout Algorithm (shared by layout.ts and layout_service.py)
Inputs: template, n_rows (number of line items)
  row_h     = ceil(fontSize * lineHeight) + 2 * rowPadding
  header_h  = row_h
  actual_h  = header_h + n_rows * row_h
  designed_h = table.height          // editor default = header + 3 sample rows
  delta     = actual_h - designed_h  // may be negative
  if page.heightMode == "fixed":  delta = max(0, delta)
  for each element e != table with e.y >= table.y + table.height:
      e.y += delta
  table.height = designed_h + delta
  if heightMode == "auto":  final_page_height = page.height + delta
  else: if any element bottom > page.height - margin -> error CONTENT_OVERFLOW
If no items_table exists, delta = 0.
Both implementations must pass shared/fixtures/layout_cases.json.

## Receipt Data JSON (`receipts.data`)
{
  "business": { "name": "Acme Cafe" },
  "customer": { "name": "Jane Doe", "email": null },
  "receipt": {
    "number": null,                  // null/empty on input = auto-generate
    "date": "2026-10-09",
    "payment_method": "Card",
    "currency": "USD",
    "notes": null
  },
  "custom": { "table_no": "12" },
  "items": [
    { "description": "Latte", "qty": "2", "unit_price": "4.50" }
  ],
  "tax_rate": "0.08",
  "discount": "0.00"
}

Server adds on save (client values ignored):
  "items[].line_total", and
  "computed": { "subtotal": "9.00", "tax": "0.72", "discount": "0.00", "total": "9.72" },
  "receipt.number" (final assigned value)
Money is always a string (Decimal), never a float.

## Database Schema (PostgreSQL)

users
  id                 UUID PK (uuid4)
  email              TEXT UNIQUE NOT NULL
  password_hash      TEXT NOT NULL
  business_name      TEXT
  receipt_prefix     TEXT NOT NULL DEFAULT 'R-'
  numbering_mode     TEXT NOT NULL DEFAULT 'sequential'
                     CHECK (numbering_mode IN ('sequential','nanoid'))
  receipt_next_seq   INT NOT NULL DEFAULT 1
  created_at         TIMESTAMPTZ DEFAULT now()

assets
  id            UUID PK
  user_id       UUID FK -> users.id ON DELETE CASCADE
  kind          TEXT CHECK (kind IN ('logo','signature','image'))
  storage_path  TEXT NOT NULL
  mime_type     TEXT NOT NULL
  size_bytes    INT NOT NULL
  created_at    TIMESTAMPTZ DEFAULT now()

templates
  id              UUID PK
  user_id         UUID FK -> users.id ON DELETE CASCADE
  name            TEXT NOT NULL
  canvas          JSONB NOT NULL
  schema_version  INT NOT NULL DEFAULT 1
  thumbnail_path  TEXT NULL
  created_at      TIMESTAMPTZ DEFAULT now()
  updated_at      TIMESTAMPTZ DEFAULT now()
  INDEX (user_id, updated_at DESC)

receipts
  id                 UUID PK
  user_id            UUID FK -> users.id ON DELETE CASCADE
  template_id        UUID FK -> templates.id ON DELETE SET NULL
  template_snapshot  JSONB NOT NULL     -- canvas copy at generation time
  data               JSONB NOT NULL
  receipt_number     TEXT NOT NULL      -- customer-facing
  total_amount       NUMERIC(12,2) NOT NULL
  currency           CHAR(3) NOT NULL
  pdf_path           TEXT NULL
  created_at         TIMESTAMPTZ DEFAULT now()
  UNIQUE (user_id, receipt_number)
  INDEX (user_id, created_at DESC)

## Key API Endpoints
POST   /auth/register, /auth/login   (passwords: at least 8 characters, at most
                                   72 bytes; emails are case-insensitive)
GET    /auth/me            PATCH /auth/me   (business name, receipt prefix,
                                             numbering mode: sequential | nanoid)
GET    /templates          POST /templates
GET    /templates/{id}     PUT  /templates/{id}     DELETE /templates/{id}
POST   /assets             (multipart)     GET /assets/{id} (the owner's file)
GET    /receipts/next-number    (preview only; does not consume the sequence)
POST   /receipts           (template_id + data -> validate variables, number,
                            totals, store snapshot)
GET    /receipts           GET /receipts/{id}
GET    /receipts/{id}/export?format=pdf|png
POST   /preview            (canvas + data -> PDF/PNG/HTML without saving or
                            consuming a number)

Errors that point at fields use detail = {code, message, fields}:
  MISSING_VARIABLES (422), DISCOUNT_TOO_LARGE (422), RECEIPT_NUMBER_TAKEN (409),
  QR_CONTENT_TOO_LONG (422; fields = the variables that QR code uses),
  AMOUNT_TOO_LARGE (422; subtotal or total above 9999999999.99, NUMERIC(12,2)),
  CONTENT_OVERFLOW (422; also refused at POST /receipts), RATE_LIMITED (429,
  30 renders / minute / user), RENDERER_UNAVAILABLE (503).