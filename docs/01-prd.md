# PRD: Receipt Studio (V1)

## Problem
Small businesses and freelancers need branded payment receipts but don't want a
rigid invoicing tool or a full design suite.

## Core User Loop
1. Sign in -> "My Templates" (or "New blank receipt").
2. Open canvas: choose page size (80mm thermal / A5 / A4).
3. Drag elements from the palette onto the canvas (logo, text, itemized table,
   totals, QR code, signature line, divider).
4. Select an element -> edit position, size, text, font, color in the inspector.
5. Make content dynamic with VARIABLE PLACEHOLDERS: type or insert
   {{customer.name}}, {{receipt.date}}, {{custom.table_no}} etc. into text/QR
   elements. The items table and totals auto-bind to the line items.
6. "Save as Template".
7. Later: pick a template -> "Generate Receipt". The form is AUTO-GENERATED from
   the template (only fields the template uses, plus the line items editor).
   Receipt number is pre-filled automatically and can be overridden.
8. Live preview updates as the user types.
9. "Export" -> PDF or PNG, rendered SERVER-SIDE. Receipt is stored in history.

## Variable Binding (core concept)
- Text and QR elements support mustache placeholders: {{namespace.key}}.
- Built-in variables: business.name, customer.name, customer.email,
  receipt.number, receipt.date, receipt.payment_method, receipt.currency,
  receipt.notes.
- Custom variables: {{custom.<key>}} (lowercase, digits, underscore). Each one
  becomes a required text field in the Generate form.
- Unknown variables are rejected when saving a template.
- items_table binds to the line items; totals binds to computed totals.
  Each template may contain at most ONE items_table and ONE totals element.

## Inputs
- Account: email + password
- Assets: logo / signature upload (PNG/JPG, <=2 MB; SVG not accepted in V1)
- Design: element placement, size, text, styling, page preset
- Receipt data: values for variables used, line items (description, qty,
  unit price), tax rate, discount, currency, payment method,
  optional receipt-number override

## Receipt Numbering
- Auto-generated on creation. Default: per-user sequential with a prefix
  (e.g. R-0001, R-0002). Optional per-user mode: short NanoID.
- User may override with a custom number in the form; must be unique per user
  (conflict -> clear error). Auto-numbering is only consumed when the field is
  left blank.

## Outputs
- Saved template (JSON)
- PDF (primary) and PNG (secondary), generated SERVER-SIDE by FastAPI
  (WeasyPrint -> PDF, PyMuPDF -> PNG). No client-side html2canvas/jsPDF.
- Receipt history entry (data snapshot + template snapshot)

## Page Sizes & Height
- A5 / A4: fixed height, single page. If content overflows, show an error.
- Thermal 80mm: fixed width, AUTO height. Page grows/shrinks with the number
  of line items; elements below the items table are pushed down accordingly.

## Success Metrics
- New user exports first receipt in < 5 minutes.
- Reloaded template is identical to when saved.
- Exported PDF matches the editor preview (positions within 1px).

## GST tax invoices and speed features (Phases 6-7)
See 05-gst-and-speed.md. A template is either a plain receipt or a GST tax
invoice (CGST rule 46, turnover up to Rs 5 crore) whose required fields can't
be removed by accident. Saved customers and items, "Use again", starter
templates and sharing via the phone's share sheet make repeat invoices quick.

## Out of Scope (V1)
- Element rotation (removed entirely)
- Real-time collaboration / multi-user editing
- Payment processing or gateway integration
- Sending receipts from the server (email, WhatsApp, SMS); the Share button
  only hands the PDF to the device's share sheet
- Public receipt verification page / verify URLs
- Quotes, recurring billing, accounting features; GST e-invoicing (IRN),
  bills of supply, cess, credit / debit notes
- Template marketplace or pre-made templates imitating real brands
- Multi-page receipts
- Persistent undo history (in-session undo/redo only)
- Custom font upload (curated list of 8 fonts only)
- Text auto-grow / multi-line wrapping inside table cells (cells are single-line)
- Mobile-optimized editor (desktop-first; generate form responsive)
- Currency conversion, localization, tax compliance beyond GST rule 46
- Teams/roles, API keys, webhooks
- SVG uploads, gradients, filters, freehand drawing