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
- [ ] **Forgot password:** reset link by email (needs a free email service, e.g. Brevo, and its key on Render)
- [ ] **Feedback button:** a link to a Google Form inside the app
- [ ] **Error alerts:** Sentry free plan, for the backend and the website
- [ ] **Daily database backup:** automated pg_dump of Neon, kept privately
- [ ] **Keep the server awake (optional):** cron-job.org pings /health every 10 minutes (avoids the one-minute wake-up)

## Later
- [ ] Your own domain (e.g. receiptstudio.in), then add it to CORS_ORIGINS and Google's authorized origins
- [ ] Save the customer's phone number for one-tap WhatsApp
- [ ] UPI QR code with the bill amount; mark bills paid / unpaid
- [ ] Hindi; credit notes; GSTR-1 export
