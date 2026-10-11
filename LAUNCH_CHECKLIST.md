# Launch checklist

What's left before inviting real users, and what's done. Live app:
https://receipt-studio-5tp.pages.dev (backend: https://recipt-studio.onrender.com).

## Done
- [x] Hosting: Neon (database, Singapore), Render (backend, free, Singapore), Cloudflare Pages (website); see DEPLOY.md
- [x] Backend limited to the website (CORS_ORIGINS)
- [x] Privacy Policy and Terms pages (/privacy, /terms)
- [x] Google sign-in published (Branding filled in, app in production)

## Checks for you (not code)
- [ ] **CA review:** print one A4 and one thermal GST invoice and ask a chartered accountant whether anything is missing or wrong (rule 46 particulars, tax split, numbering)
- [ ] **Legal review:** have someone qualified read /privacy and /terms before taking payments
- [ ] **Try it on a phone** end to end: register, template, logo, receipts, WhatsApp, sales report. Note every screen that's hard to use

## To build next
- [ ] **Phone-friendly screens:** go through every page on a phone and fix layout (the editor especially)
- [x] **Forgot password:** built. **To switch on:** Brevo key on Render (DEPLOY.md, "Forgot password")
- [x] **Feedback button:** built (saved in the database). **To read it:** `ADMIN_EMAILS` on Render
- [x] **Error alerts:** built. **To switch on:** Sentry DSNs on Render and Cloudflare (DEPLOY.md, "Error alerts")
- [x] **Daily database backup:** built (encrypted, nightly). **To switch on:** two GitHub secrets (DEPLOY.md, "Nightly database backup")
- [x] **Keep the server awake:** a GitHub job visits /health every 10 minutes (automatic)
- [ ] **UPI QR code with the bill amount:** a QR on receipts / invoices that opens any UPI app with your UPI ID and the exact total filled in (upi://pay?pa=...&am=...&cu=INR)

## Later
- [ ] Your own domain (e.g. receiptstudio.in), then add it to CORS_ORIGINS and Google's authorized origins
- [ ] Save the customer's phone number for one-tap WhatsApp
- [ ] Mark bills paid / unpaid
- [ ] Hindi; credit notes; GSTR-1 export
