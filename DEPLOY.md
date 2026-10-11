# Putting Receipt Studio online for free

Three free services, each doing one job:

| Piece | Service | Free plan |
|---|---|---|
| Database (accounts, templates, receipts, logos) | **Neon** (Postgres) | 0.5 GB, never expires; sleeps after 5 idle minutes and wakes in about a second |
| Backend (the API and PDF rendering) | **Render** (Docker web service, Singapore) | 512 MB; **sleeps after 15 idle minutes, and the next visit waits about a minute** |
| Website (what users open) | **Cloudflare Pages** | Unlimited traffic, commercial use allowed, 500 builds a month |

No credit card is needed. Sign up for each with your GitHub account. It
takes about 30 minutes the first time.

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
5. Click **Apply**. The first build takes 5 to 10 minutes. Click the service and
   watch **Logs**; it's done when you see `Uvicorn running on http://0.0.0.0:...`.
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

## Good to know

- **Sleeping backend.** After 15 minutes with no visitors, the first person waits
  about a minute. If you'd rather it stayed awake while you have testers, a free
  service like **cron-job.org** can open `https://<your-render-address>/health`
  every 10 minutes. One always-on service uses about 744 of Render's 750 free
  hours a month, so keep only this one service on the free plan.
- **Storage.** 0.5 GB on Neon is roughly 50,000 or more receipts (each keeps a
  copy of its template). Logos and signatures (at most 2 MB each) are stored in
  the database too. Neon's dashboard shows how much is used.
- **Backups.** Neon's free plan can only roll back a few hours. For a full copy of
  your data, run `pg_dump "<your Neon connection string>" > backup.sql` now and
  then (it comes with PostgreSQL), or ask for a small backup script.
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
