# GST TAX INVOICES & SPEED FEATURES (Phases 6-7)

Two hurdles for Indian small businesses, and what the app does about each.

## 1. Compliance vs. freeform design

GST-registered sellers must issue tax invoices with the particulars of CGST
Rules 2017, rule 46. A drag-and-drop editor must not let a user drop one by
accident.

Scope: regular taxpayers with an aggregate turnover up to Rs 5 crore, where
B2B invoices don't need an e-invoice IRN. Not legal advice: this is the
commonly applied reading of rule 46 and notification 78/2020; confirm
specifics with a CA.

### What a GST invoice template must show (checked on save, both sides)
Printed text (a QR code doesn't count):
- business.name, business.address, business.gstin (from Settings)
- receipt.number, receipt.date
- customer.name, customer.address, customer.gstin ("Unregistered" if blank)
- receipt.place_of_supply (state name and code), receipt.reverse_charge (Yes/No)

Plus an items table with description, HSN/SAC, quantity (with unit), GST rate
and taxable value columns; a totals element with taxable value, tax and total
lines; and a signature.

The editor:
- Document > Type: Receipt or GST tax invoice. A GST invoice shows a live
  checklist of the particulars above.
- "Add missing fields" places whatever is missing below the content (a details
  text block, the GST table columns, the totals lines, a signature).
- Deleting an element that holds a required particular is refused with the
  reason; required table columns and totals lines can't be removed.
- Saving is refused (server and client) until every particular is there.
- Starter templates: GST tax invoice (A4), GST invoice (thermal 80 mm), shop
  receipt.

### Rules applied when an invoice is issued (POST /receipts)
- The supplier's name, address and GSTIN come from Settings (all three
  required: GST_PROFILE_INCOMPLETE) and are frozen into the receipt.
- GSTINs: 15 characters, state code + PAN + entity + Z + mod-36 check
  character; the check character catches most typos.
- Currency is INR; GST rate (0-40%, any of the slabs) and an optional
  discount are per item.
- Within one state (supplier state == place of supply): CGST + SGST at half the
  rate each; UTGST instead of SGST in Union territories without a legislature
  (04, 26, 31, 35, 38). Between states: IGST. Each tax is rounded half-up to
  the paisa per line.
- Place of supply defaults to the buyer's GSTIN state, else the supplier's.
- Registered buyer (GSTIN given): name, address and an HSN/SAC code (4, 6 or 8
  digits) on every line are required. Unregistered buyer with a taxable value
  of Rs 50,000 or more: name and address (also the delivery address) and state.
  Otherwise B2C invoices may leave HSN out.
- Invoice numbers: their own series, consecutive and unique per financial year
  (April-March), f"{invoice_prefix}{FY}/{seq:04d}", e.g. INV/26-27/0001, at
  most 16 characters of letters, digits, - and /. A refused invoice doesn't use
  a number. Overrides must follow the same character rules.

Error codes (422 unless noted): GST_PROFILE_INCOMPLETE, GST_CURRENCY,
GST_PER_ITEM (invoice-level tax or discount sent), GST_DETAILS_REQUIRED
(fields = what's missing), INVOICE_NUMBER_INVALID, DISCOUNT_TOO_LARGE
(fields = items.N.discount), RECEIPT_NUMBER_TAKEN (409).

### Not covered (yet)
- e-invoicing (IRN + signed QR) for B2B above Rs 5 crore: needs a GSP / IRP
  integration; the editor says so.
- Bill of supply for composition dealers / exempt supplies, compensation cess,
  exports / SEZ, credit and debit notes, reverse-charge tax computed for the
  recipient (the flag is printed; amounts are computed as usual).

### Asked once after sign-up
/welcome asks what the user mostly creates: simple receipts, GST tax invoices,
or both (users.invoicing_mode; NULL until answered, so Templates sends anyone
not asked yet there; "Skip for now" means both). GST users can enter their
GSTIN and address right there, see the GST starters first, and get "New blank
GST invoice", which opens with every required field in place. It only sets
defaults: Settings can change it, and any template can be either kind.

## 2. Willingness to pay: faster than editing a Canva template

Code can't set a price, but it can make every invoice after the first a
matter of seconds:
- Saved customers and items: every receipt remembers its customer (GSTIN,
  address, state, email) and items (HSN, unit, price, GST rate). Typing a saved
  name in the Generate form fills in the rest (case-insensitive). Manage them
  in Settings (GET/DELETE /customers, /items).
- "Use again" in History opens Generate pre-filled from that receipt (new
  number and date).
- Starter templates: a compliant GST invoice in one click.
- Share: on phones (and browsers with the Web Share API), Share hands the PDF
  to the system share sheet (WhatsApp, email...). Nothing is sent by the app.
- Automatic, compliant numbering and tax split, which a static template can't do.
