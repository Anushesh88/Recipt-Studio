# Receipt Studio: product audit and gap analysis

*October 2026. Based on the live app (receipt-studio-5tp.pages.dev) and its
codebase. Effort is in person-weeks.*

**In short:** the hard, defensible part is done:
- GST correctness: rule 46 checks, the CGST/SGST/IGST split, per-financial-year numbering, GSTIN checksums;
- the preview matches the PDF exactly;
- saved customers and items, and a sales report.

What blocks product-market fit now is everything around that: the first five
minutes, the phone, and payment collection. An Indian micro-business owner
does billing on a phone, at the counter, and wants to get paid. Today the
product is desktop-first and stops at "PDF sent".

---

## 1. User journey and main friction points

| Step | Today | Friction / drop-off risk |
|---|---|---|
| **Arrive** | The site root goes straight to the login form | **No landing page.** A stranger sees a login box with no explanation, no example, no reason to sign up. Canva and Excel need no explanation; we do. **Highest drop-off.** |
| **First request** | The free backend sleeps after 15 idle minutes | The first visitor waits about a minute. A "Waking up…" notice exists, but many will leave. |
| **Sign up** | Email/password or Google | **No "forgot password"**, so a locked-out user is gone for good. No email verification. |
| **Welcome** | Receipts / GST / both, plus GSTIN and address | Good, short and well targeted. Users who skip the GSTIN get blocked later with a "GST profile incomplete" error. |
| **Pick a template** | 20 live previews in 2 tabs | Strong. But previews show a grey "logo" box and placeholder text like `D.L. no: 20B-____`, `Bank: / A/c no: / IFSC:` and "Freshly brewed, every day". **Every user must open the editor to fix someone else's details.** That's the "Canva tax" we wanted to remove. |
| **Brand it** | Upload the logo **inside each template** | No account-level logo or brand colour. Change the logo once and 3 templates are out of date. |
| **Generate** | Dynamic form, live preview | Good on desktop. **Not phone friendly.** Template-specific fields like *Table no* and *Stylist* are required every time. Receipts ask for a currency even though 99% are INR. |
| **Share** | PDF/PNG, Share sheet, WhatsApp link | WhatsApp asks for the phone number **every time**, and sends a link, not a file. Some customers distrust links. |
| **Get paid** | Nothing | **The journey ends before the money.** No UPI-with-amount QR, no paid/unpaid status, no reminder. This is where Excel and Canva also fail, and it's our biggest opening. |

**Versus alternatives:**
- **Excel template:** familiar and offline, but does the maths badly and has no compliance checks.
- **Canva:** beautiful, no maths, no numbering.
- **Free billing apps (Vyapar, myBillBook, Zoho Invoice):** fast on phones, but every bill looks the same.

Our position, "your design + correct GST + 30 seconds", only works if the
**design is set up once, automatically** and the **30 seconds happen on a
phone**.

---

## 2. Speed and workflow

**Already have:** auto-calculations, saved customers and items, "Use again",
automatic numbering and date, per-item GST, live preview.

**Today, for a repeat customer:** Templates → Generate → type the customer's
exact name → add items → Create → WhatsApp → type the phone → Open WhatsApp.
That's 8 steps and roughly 60–90 seconds on desktop. It's worse on a phone,
plus a cold start.

**Getting it under 30 seconds:**
1. **A "New bill" button on the home screen.** It opens your default template directly, skipping the template list.
2. **Customer search that fills everything.** One field with fuzzy search over saved customers (name or phone). Picking one fills the GSTIN, address, state and phone, and offers **"Repeat last bill"**: same items, new number and date.
3. **Item chips.** Your 10 most-used items as tap-to-add buttons with +/− quantity, instead of typing descriptions.
4. **Remember the customer's phone** with saved customers, so **WhatsApp is one tap** with no popup.
5. **Remember the last value of template fields** like *Table no* and *Stylist*, or make them optional.
6. **Hide what's always the same:** currency (INR), date (today), number (auto). Show them only under "More".

**Target flow:** New bill → pick customer → Repeat last bill → Create &
WhatsApp. **4 taps, about 15 seconds.**

---

## 3. Indian tax defaults (under ₹5 crore)

**Already correct:**
- GSTIN with checksum and state.
- CGST+SGST within a state, IGST between states, and UTGST.
- 4/6/8-digit HSN required for registered (B2B) buyers, optional for B2C.
- Buyer name and address required from ₹50,000 for unregistered buyers.
- Consecutive numbering per financial year, at most 16 characters.
- Reverse charge flag, the signature, and the delete-guard / save-block checklist.
- Rate shortcuts match the post-2025 slabs (0, 5, 18, 40, plus 3 and 0.25).

**Schema and UI changes needed:**

| Change | Why | How, without clutter |
|---|---|---|
| **Business profile fields:** phone, email, **UPI ID**, bank details, PAN, licence numbers (FSSAI, drug licence…) | Templates print static placeholders like `D.L. no: ____` today | Settings fields that become variables (`{{business.upi_id}}`…). Starter templates fill in automatically, and empty ones don't print. |
| **UPI QR with the exact amount** | The biggest "get paid" lever in India | A **"Pay by UPI" QR preset** that reads `upi://pay?pa={UPI ID}&pn={name}&am={total}&cu=INR&tn={invoice no}`. Needs a total variable for QR content, which doesn't exist yet. |
| **Round-off line + amount in words** | Expected on Indian invoices ("Rupees One Thousand Fifty Only"); not in rule 46 but people look for it | Two optional totals lines, switched on in GST starters. |
| **Delivery ("ship to") address** | Rule 46 needs it when it differs from the billing address | Hidden behind "Ship to a different address" in the form. |
| **Rate-wise tax summary** | Clear when one invoice has 5% and 18% items, and CAs like it | An optional block under totals. |
| **Customer phone** | For WhatsApp and reminders | Added to saved customers. |
| **Bill of supply** (composition dealers) | A common segment under ₹1.5 crore that can't charge GST | A third document type later (P2). |

**Making the canvas stop invalid invoices:**
- **Turn the required details into "smart blocks"** (Supplier, Buyer, Invoice details, Tax summary) that can be moved and styled but whose required lines can't be deleted or retyped. Today we warn and refuse deletes element by element; smart blocks make mistakes impossible instead of just flagged.
- **Show the GST checklist as a progress bar in the editor header** ("8 of 10 required"), not only in the inspector.
- **In the form, tell people why.** For example: "HSN needed because the buyer has a GSTIN", "Buyer address needed above ₹50,000". This is partly done; make it consistent.
- **Block issuing, not designing.** Let users save draft GST templates, but block **Create invoice** until complete. That's less blocking in the editor and still never produces a bad invoice.

---

## 4. Canvas and export: keep, tweak or cut

| Keep | Tweak | Cut or hide |
|---|---|---|
| 3 page sizes (thermal / A5 / A4) | **Mobile:** make Generate, History, Report and Share fully phone-first. On phones, offer a **simple editor** (logo, business name, colour, font) and say "full editor on desktop". | **Random-ID numbering** in Settings. GST invoices must be consecutive, and it confuses people. |
| Preview identical to the PDF | **Inspector:** "Basic" vs "Advanced". Line height, row padding, design height and pixel positions go under Advanced. | **The free-text QR content field.** Replace it with presets: *UPI pay*, *Review us on Google*, *Visit website*. |
| 20 starters by niche | **Starters use the account's logo, colour and details** when created, so there's no placeholder text. | **Currency** field on receipts. Default to INR; show it only in Settings. |
| GST checklist + delete guard | **Logo:** keep the aspect ratio when resizing, and add a "fit width / fit height" toggle. | **Thermal design height** setting. It's auto anyway, so hide it. |
| PDF + PNG + Share sheet | **Share PNG** through the phone share sheet too. A WhatsApp image displays inline and builds more trust than a link. | |

**Missing design flexibility for brand-conscious users:**
1. **A one-time brand kit:** logo, 1–2 brand colours, and a font pairing from 4 presets, e.g. Poppins+Inter or Merriweather+Lato. All starters adopt it.
2. **Colour blocks and shapes,** like a coloured header band or a rounded panel behind the totals. Today all colour has to come from text and dividers.
3. **Palette swatches** in the colour pickers, taken from the brand kit, instead of raw hex codes.

---

## 5. Prioritised action plan (RICE)

RICE score = Reach × Impact × Confidence ÷ Effort:
- **Reach:** % of active users affected in a quarter.
- **Impact:** 0.25 to 3.
- **Effort:** person-weeks.

| Pri | Change | Reach | Impact | Conf. | Effort | **RICE** |
|---|---|---|---|---|---|---|
| **P0** | Keep the server awake (ping `/health`), no cold starts | 60 | 1 | 90% | 0.1 | **540** |
| **P0** | Landing page: what it is, a 20-second demo, sample invoices, "Start free" | 100 | 2 | 80% | 1 | **160** |
| **P0** | Phone-first Generate / History / Share / Report, plus a simple editor on phones | 90 | 3 | 90% | 2 | **122** |
| **P0** | UPI QR with the bill amount (UPI ID in Settings, total variable) | 70 | 2 | 80% | 1 | **112** |
| **P0** | Business profile variables (phone, UPI, bank, PAN, licences) filled into starters | 90 | 2 | 80% | 1.5 | **96** |
| **P0** | Brand kit (account logo + colours) applied to all templates | 80 | 2 | 80% | 1.5 | **85** |
| **P0** | Forgot password + email verification | 40 | 2 | 100% | 1 | **80** |
| **P0** | Ops basics: error alerts (Sentry), daily database backup, feedback button | (all) | (risk) | — | 1 | must-do |
| **P1** | Amount in words + round-off line | 70 | 1 | 90% | 0.5 | **126** |
| **P1** | Share PNG through the phone share sheet | 60 | 1 | 80% | 0.5 | **96** |
| **P1** | "New bill" + customer search + "Repeat last bill" + saved phone with one-tap WhatsApp | 80 | 1.5 | 80% | 1.5 | **64** |
| **P1** | Item chips + remembered template fields | 70 | 1 | 80% | 1 | **56** |
| **P1** | Inspector Basic/Advanced, palette swatches, QR presets | 60 | 1 | 70% | 1 | **42** |
| **P1** | Paid/unpaid, due date, WhatsApp payment reminder | 50 | 2 | 70% | 2 | **35** |
| **P1** | Smart GST blocks + checklist progress bar + block issuing (not saving) | 40 | 1.5 | 70% | 2 | **21** |
| **P1** | Self-serve data export + account deletion (DPDP Act) | 20 | 1 | 90% | 1 | **18** |
| **P2** | Try without signing up (guest bill, sign up to save) | 100 | 1 | 50% | 2 | 25 |
| **P2** | GSTR-1 export for the CA (also a CA referral channel) | 30 | 2 | 60% | 3 | 12 |
| **P2** | Colour blocks / shapes on the canvas | 30 | 1 | 70% | 2 | 11 |
| **P2** | Credit/debit notes, bill of supply (composition dealers) | 20 | 2 | 70% | 3 | 9 |
| **P2** | Hindi + one regional language | 40 | 1 | 60% | 3 | 8 |
| **P2** | Bluetooth thermal printer (Android, ESC/POS) | 20 | 2 | 50% | 4 | 5 |
| **P2** | Staff accounts / multiple businesses | 15 | 1 | 70% | 4 | 3 |
| Out | E-invoicing (IRN) for over ₹5 crore | — | — | — | — | out of scope |

**Order of attack:**
1. **Days 1–2:** keep-awake ping, ops basics, forgot password.
2. **Weeks 1–2:** phone-first screens.
3. **Weeks 2–3:** business profile + brand kit, so starters fill themselves.
4. **Week 3:** UPI QR with the amount.
5. **Week 4:** landing page.

Only then invite strangers. Your first 10 hand-held users can start after week 2.

**Three metrics show whether this is working:**
- **time to first invoice** after sign-up, target under 3 minutes;
- **median time for a repeat bill**, target under 30 seconds;
- **% of businesses issuing 5 or more bills a week, four weeks in.**
