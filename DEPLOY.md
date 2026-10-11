# Putting Receipt Studio online for free

Three free services, each doing one job:

| Piece | Service | Free plan |
|---|---|---|
| Database (accounts, templates, receipts, logos) | **Neon** (Postgres) | 0.5 GB, never expires; sleeps after 5 idle minutes and wakes in about a second |
| Backend (the API and PDF rendering) | **Render** (Docker web service, Singapore) | 512 MB; **sleeps after 15 idle minutes, and the next visit waits about a minute** |
| Website (what users open) | **Cloudflare Pages** | Unlimited traffic, commercial use allowed, 500 builds a month |

Everything stays free, but **Render asks for a card (or a Visa / Mastercard debit
card) to verify you**: a $1 hold that is released, with no charge on the Free
plan. Neon and Cloudflare don't need one. Sign up for each with your GitHub
account. It takes about 30 minutes the first time.

> Hosts checked in October 2026: Koyeb and Oracle Cloud also ask for a card;
> Hugging Face's Docker Spaces now need its paid PRO plan.

> Vercel's free plan is for non-commercial use only, so it isn't used here.
> Render's own free Postgres is deleted after 30 days, so the database lives on Neon.

---

## Step 1: Database on Neon

1. Go to **https://neon.com** and click **Sign up**. Choose **Continue with GitHub**.
2. Create a project:
   - **Project name:** `receipt-studio`
   - **Region:** **AWS Asia Pacific (Singapore)**, close to Render's Singapore servers and to India.
   - Leave the Postgres version as it is, then click **Create project**.
3. On the project dashboard, click **Connect**. Copy the **connection string**. It looks like:
   ```
   postgresql://neondb_owner:AbC123...@ep-cool-name-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```
   Keep it somewhere private, like a note on your PC. It contains the database
   password. Never put it on GitHub or share it.

You don't need to create any tables. The backend does that itself when it starts.

## Step 2: Backend on Render

1. Go to **https://render.com**, click **Get Started**, and sign up with **GitHub**.
2. Click **New +**, then **Blueprint**.
3. Connect your GitHub account if asked, and pick the **Recipt-Studio** repository.
4. Render reads `render.yaml` from the repository and shows one service,
   **receipt-studio-api**. It asks for three values:
   - **DATABASE_URL:** paste the Neon connection string from Step 1.
   - **CORS_ORIGINS:** type `*` for now. You'll change it in Step 4.
   - **GOOGLE_CLIENT_ID:** your Google client ID, the same one as in `backend/.env`.
     Leave it empty if you don't want Google sign-in yet.

   `SECRET_KEY` is generated for you. Don't change it later, or everyone gets
   logged out and all WhatsApp receipt links stop working.
5. Click **Apply**. When Render asks for a card, add it (verification only). The
   first build takes 5 to 10 minutes. Click the service and watch **Logs**; it's
   done when you see `Uvicorn running on http://0.0.0.0:...`.

   **Or set it up by hand** (same result): **+ New > Web Service**, pick the repo,
   then choose **Docker**, branch `main`, region **Singapore**, root directory
   `backend`, instance type **Free**, and under **Advanced** set the health check
   path to `/health`. Add five environment variables: `APP_ENV` = `production`,
   `SECRET_KEY` (make one with
   `.venv/Scripts/python -c "import secrets; print(secrets.token_urlsafe(48))"`
   in `backend/`), `DATABASE_URL`, `CORS_ORIGINS` = `*`, and `GOOGLE_CLIENT_ID`.
6. At the top of the service page, copy its address, for example
   `https://receipt-studio-api.onrender.com`. Yours may have extra letters if the
   name was taken. Check it works: open `https://<your-address>/health`
   in your browser. You should see `{"status":"ok"}`.

## Step 3: Website on Cloudflare Pages

1. Go to **https://dash.cloudflare.com/sign-up** and create a free account.
2. In the left menu, open **Workers & Pages**, then click **Create**. Choose the
   **Pages** tab, then **Connect to Git** (it may say **Import an existing Git repository**).
3. Connect GitHub and pick **Recipt-Studio**, then **Begin setup**.
4. Fill in:
   - **Project name:** `receipt-studio`. Your site will be `https://receipt-studio.pages.dev`.
   - **Framework preset:** `React (Vite)`, or **None**.
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory (advanced):** `frontend`
   - **Environment variables:** add `VITE_API_URL` = your Render address from Step 2,
     e.g. `https://receipt-studio-api.onrender.com`, with **no `/` at the end**.
5. Click **Save and Deploy**. It takes 1 to 3 minutes. Then click the link,
   e.g. `https://receipt-studio.pages.dev`.

## Step 4: Connect the two

1. **Render:** open **receipt-studio-api**, then **Environment**, and set
   **CORS_ORIGINS** to your Cloudflare address, e.g. `https://receipt-studio.pages.dev`
   (no `/` at the end). Click **Save changes**; Render redeploys in a few minutes.
   From now on only your website can use the API from a browser.
2. **Google sign-in** (if you use it): in the
   [Google Cloud console](https://console.cloud.google.com/apis/credentials), open
   your OAuth client and add your Cloudflare address under **Authorized JavaScript
   origins**, then click **Save**. Then go to **Audience** and click **Publish app**,
   so anyone can sign in, not only your test users.

## Step 5: Try it like a customer

On your phone or another browser, open your `pages.dev` address:

1. Register, answer the welcome question, and pick a template from the gallery.
2. Generate a receipt, download the PDF, and try **WhatsApp**. The link in the
   message should open the PDF on another phone.
3. Upload a logo in the editor and generate again. The logo should still be
   there the next day, after the server has slept.
4. Open **Sales report**.

If the first page load shows **"Waking up the server…"**, that's the free
backend starting after a quiet spell. It's normal and takes about a minute.

## Updating the app later

Push to GitHub (`git push`). Render and Cloudflare both rebuild automatically.
Database changes (migrations) run by themselves when the backend starts.

---

## After launch: alerts, backups, password reset, feedback

Each of these is already in the code and switches on when you add its
settings. Nothing breaks while one is off.

### Keep the backend awake (automatic)
`.github/workflows/keep-awake.yml` visits `/health` every 10 minutes, so
visitors don't wait a minute for the server to wake. Nothing to set up. If
your Render address ever changes, add a repository **variable** `BACKEND_URL`
(GitHub > Settings > Secrets and variables > Actions > Variables). GitHub
pauses scheduled jobs after 60 days without commits; the **Actions** tab shows
a button to turn it back on.

### Forgot password (Brevo, free: 300 emails a day)
Render's free plan blocks normal email (SMTP), so emails go through Brevo's
web API.
1. Sign up at **https://www.brevo.com** (free plan).
2. **Senders, domains & dedicated IPs > Senders > Add a sender**: your name and
   the email you'll send from, e.g. your Gmail. Click the link Brevo emails you.
3. **SMTP & API > API keys > Generate a new API key**, named `receipt-studio`.
   Copy it (it starts with `xkeysib-`).
4. On Render, open **Environment** and add:
   - `BREVO_API_KEY` = the key
   - `EMAIL_FROM` = the sender address from step 2
   - `PUBLIC_APP_URL` = `https://receipt-studio-5tp.pages.dev` (your website; the email links go there)
5. Save; Render redeploys. Try **Forgot password?** on the sign-in page.

Emails sent "from" a Gmail address through Brevo can land in spam. With your
own domain later, authenticate the domain in Brevo, which fixes that.

### Error alerts (Sentry, free)
1. Sign up at **https://sentry.io** and create **two projects**: platform
   **FastAPI** (name `receipt-studio-api`) and platform **React** (name `receipt-studio-web`).
2. Each project shows a **DSN** (Settings > Client Keys), a URL like
   `https://abc123@o456.ingest.sentry.io/789`.
3. On **Render**: add `SENTRY_DSN` = the FastAPI project's DSN.
4. On **Cloudflare Pages**: Settings > Variables and secrets, add
   `VITE_SENTRY_DSN` = the React project's DSN, then **redeploy** the site
   (Deployments > latest > Retry). The website reads it when it's built.

Sentry then emails you when something breaks. No customer details, request
bodies, cookies or IP addresses are sent.

### Read feedback
Users' **Feedback** button saves messages in the database. To read them, add
`ADMIN_EMAILS` = your account's email (comma-separate several) on Render.
Then **Settings > Read feedback** in the app lists them, newest first.

### Nightly database backup (encrypted)
`.github/workflows/backup-database.yml` copies the database every night at
03:00 India time and keeps each copy for 30 days. The repository is public, so
the copy is **encrypted** first; without your passphrase it's unreadable.
1. Make a passphrase (in `backend/`):
   `.venv/Scripts/python -c "import secrets; print(secrets.token_urlsafe(32))"`.
   **Save it in a password manager**: without it, the backups can't be opened.
2. GitHub > your repository > **Settings > Secrets and variables > Actions >
   Secrets > New repository secret**:
   - `BACKUP_DATABASE_URL` = your Neon connection string
   - `BACKUP_PASSPHRASE` = the passphrase
3. **Actions > Back up the database > Run workflow** to try it. It should turn
   green with a file under **Artifacts**.

**Restoring** (only if something goes wrong): download the artifact, then
```bash
gpg -d -o receipt-studio.dump receipt-studio.dump.gpg
pg_restore --no-owner --clean --if-exists -d "<a database connection string>" receipt-studio.dump
```
Restore into a **new** Neon branch or database first and check it, rather than
over the live one.

---

## Good to know

- **Sleeping backend.** The keep-awake job (above) visits it every 10 minutes.
  If GitHub runs it late, the first visitor may still see "Waking up the
  server…" for up to a minute. One always-on service uses about 744 of Render's
  750 free hours a month, so keep only this one service on the free plan.
- **Storage.** 0.5 GB on Neon is roughly 50,000 or more receipts (each keeps a
  copy of its template). Logos and signatures (at most 2 MB each) are stored in
  the database too. Neon's dashboard shows how much is used.
- **Backups.** Set up the nightly encrypted backup (above). Neon's free plan
  itself can only roll back a few hours.
- **Your own domain** (e.g. `receiptstudio.in`, a few hundred rupees a year) can be
  added later in Cloudflare Pages under **Custom domains**. Then add it to
  `CORS_ORIGINS` (comma-separated) and to Google's authorized origins.
- **When you outgrow free:** Render's paid plan (about $7 a month) removes the
  sleep. That is the first upgrade worth paying for.

## If something goes wrong

| What you see | What to check |
|---|---|
| Render build fails | Open **Logs** and read the last red lines. If it mentions `SECRET_KEY`, make sure the variable exists (Blueprint makes it). |
| Render log: `connection refused` or `password authentication failed` | Copy the Neon connection string again, in full, into **DATABASE_URL**. |
| The website loads but every action fails ("Network Error") | `VITE_API_URL` in Cloudflare must be exactly your Render address, with `https` and no `/` at the end. **Redeploy** the site after changing it (Deployments > ... > Retry). Also check **CORS_ORIGINS** on Render matches the site address exactly. |
| Reloading a page like `/reports` shows "404" | Make sure the latest code, with `frontend/public/_redirects`, is deployed. |
| Google: "origin not allowed" | Add the exact `https://...pages.dev` address in Google Cloud; changes can take a few minutes. |
| "Waking up the server…" never goes away | Open the Render dashboard: the service may have failed to start (Logs), or used up the month's free hours. |

## Other free options

- **Backend:** **Koyeb** also runs this Docker image for free. It wakes in seconds
  instead of a minute, but only has servers in Frankfurt and Washington (slower from
  India), and it may ask for a card to verify you. Set the same environment
  variables there.
- **Website:** **Netlify**'s free plan works the same way: base directory
  `frontend`, build `npm run build`, publish `frontend/dist`, and `VITE_API_URL`.
- **Database:** **Supabase** free Postgres works too (use its connection string as
  `DATABASE_URL`), but it pauses projects after a week without use.
