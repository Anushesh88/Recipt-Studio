# Putting Receipt Studio online for free

Three free services, each doing one job, and **none needs a credit card**:

| Piece | Service | Free plan |
|---|---|---|
| Database (accounts, templates, receipts, logos) | **Neon** (Postgres, Singapore) | 0.5 GB, never expires; sleeps after 5 idle minutes and wakes in about a second |
| Backend (the API and PDF rendering) | **Hugging Face Spaces** (Docker) | 2 CPUs, 16 GB RAM; **sleeps after 48 hours without visitors**, and the next visit waits while it starts |
| Website (what users open) | **Cloudflare Pages** | Unlimited traffic, commercial use allowed, 500 builds a month |

Sign up for each with GitHub or email. It takes about 30 minutes the first time.

> Why not the others: Render and Oracle Cloud ask for a card; Vercel's free plan
> is for non-commercial use only; Render's free Postgres is deleted after 30 days.

---

## Step 1: Database on Neon

1. Go to **https://console.neon.tech/signup** in Chrome or Edge and sign up.
2. Create a project:
   - **Project name:** `receipt-studio`
   - **Region:** **AWS Asia Pacific (Singapore)** (`aws-ap-southeast-1`)
   - Leave the rest, then click **Create project**.
3. Click **Connect** and copy the **connection string**. It starts with
   `postgresql://` and contains the database password, so keep it in a private
   note. Never put it on GitHub or share it.

The backend creates the tables itself when it starts.

## Step 2: Backend on Hugging Face Spaces

### 2a. Make a secret key (on your PC)
In a terminal in the `backend` folder:
```bash
.venv/Scripts/python -c "import secrets; print(secrets.token_urlsafe(48))"
```
Copy the long text it prints: that's your **SECRET_KEY**. Keep it private, and
never change it later. Changing it logs everyone out and breaks every WhatsApp
receipt link.

### 2b. Create the Space
1. Sign up at **https://huggingface.co/join** and confirm your email.
2. Go to **https://huggingface.co/new-space** and fill in:
   - **Space name:** `receipt-studio-api`
   - **License:** leave empty, or pick one
   - **Select the Space SDK:** **Docker**, then template **Blank**
   - **Space hardware:** **CPU basic · Free**
   - **Visibility:** **Public**. The website must be able to reach it. The backend
     code becomes readable there, but your keys and passwords stay private (2c).
3. Click **Create Space**. It shows an empty Space; that's expected.
4. Note the Space's address. It's `https://<your-username>-receipt-studio-api.hf.space`,
   all lowercase. For example, user `Anushesh88` gets
   `https://anushesh88-receipt-studio-api.hf.space`.

### 2c. Give the Space its settings
In the Space, open **Settings**, scroll to **Variables and secrets**, and add:

| Type | Name | Value |
|---|---|---|
| **New secret** | `SECRET_KEY` | the text from 2a |
| **New secret** | `DATABASE_URL` | your Neon connection string |
| **New variable** | `APP_ENV` | `production` |
| **New variable** | `CORS_ORIGINS` | `*` (you'll change it in Step 4) |
| **New variable** | `GOOGLE_CLIENT_ID` | your Google client ID (the one in `backend/.env`) |

Secrets are hidden after you save them; variables stay visible.

### 2d. Let GitHub send the backend to the Space
Every push to `main` uploads `backend/` to the Space, using
`.github/workflows/deploy-backend.yml`. GitHub needs permission to do that:

1. **A Hugging Face token:** go to **https://huggingface.co/settings/tokens**, then
   **Create new token**. Choose **Write**, name it `github-deploy`, and create it.
   Copy it (it starts with `hf_`).
2. **Put it in GitHub:** open your repository on GitHub, then **Settings > Secrets
   and variables > Actions**.
   - **Secrets** tab: **New repository secret**. Name `HF_TOKEN`, value: the token.
   - **Variables** tab: **New repository variable**. Name `HF_SPACE`, value:
     `<your-username>/receipt-studio-api` (e.g. `Anushesh88/receipt-studio-api`).
3. **First deploy:** on GitHub, open **Actions > Deploy backend to Hugging Face**
   and click **Run workflow**. It turns green in about a minute.
4. In the Space, the **Logs** button shows the Docker build. It takes 5 to 10 minutes,
   and the status turns **Running**.
5. Check it: open `https://<your-space-address>/health`. You should see `{"status":"ok"}`.

## Step 3: Website on Cloudflare Pages

1. Go to **https://dash.cloudflare.com/sign-up** and create a free account.
2. Open **Workers & Pages**, click **Create**, choose the **Pages** tab, then
   **Connect to Git** (or **Import an existing Git repository**).
3. Connect GitHub, pick **Recipt-Studio**, then **Begin setup**.
4. Fill in:
   - **Project name:** `receipt-studio`. Your site will be `https://receipt-studio.pages.dev`.
   - **Framework preset:** `React (Vite)`, or **None**
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory (advanced):** `frontend`
   - **Environment variables:** `VITE_API_URL` = your Space address from 2b,
     e.g. `https://anushesh88-receipt-studio-api.hf.space`, with **no `/` at the end**.
5. Click **Save and Deploy** (1 to 3 minutes), then open the link.

## Step 4: Connect them

1. **Hugging Face:** in the Space's **Settings > Variables and secrets**, change
   **CORS_ORIGINS** to your Cloudflare address, e.g. `https://receipt-studio.pages.dev`
   (no `/` at the end). The Space restarts by itself.
2. **Google sign-in:** in the
   [Google Cloud console](https://console.cloud.google.com/apis/credentials), open
   your OAuth client and add the Cloudflare address under **Authorized JavaScript
   origins**, then **Save**. Then go to **Audience** and click **Publish app**,
   so anyone can sign in.

## Step 5: Try it like a customer

On your phone, open your `pages.dev` address:

1. Register, answer the welcome question, and pick a template from the gallery.
2. Generate a receipt, download the PDF, and send it with **WhatsApp**. The link
   in the message should open the PDF on another phone.
3. Upload a logo, then generate again tomorrow. The logo should still be there.
4. Open **Sales report**.

## Updating the app later

Push to GitHub (`git push`). Cloudflare rebuilds the website, and the GitHub
Action sends `backend/` to Hugging Face, which rebuilds it. Database changes
(migrations) run by themselves when the backend starts.

---

## Good to know

- **Sleeping.** After 48 hours with no visitors the Space pauses. The next visit
  starts it again, and the app shows "Waking up the server…" meanwhile. If it
  doesn't come back, open the Space page on huggingface.co (that wakes it) or
  click **Restart** there.
- **Public code.** Free Spaces are public, so anyone can read the backend code on
  Hugging Face. That's fine: the secrets (key, database password) are kept
  separately and never shown.
- **Storage.** 0.5 GB on Neon is roughly 50,000 or more receipts. Logos and
  signatures (at most 2 MB each) are stored in the database too.
- **Backups.** Neon's free plan can only roll back a few hours. For a full copy,
  run `pg_dump "<your Neon connection string>" > backup.sql` now and then (it comes
  with PostgreSQL).
- **Your own domain** (e.g. `receiptstudio.in`) can be added later in Cloudflare
  Pages under **Custom domains**. Then add it to `CORS_ORIGINS` (comma-separated)
  and to Google's authorized origins.
- **Spaces are made for demos.** Hugging Face may restart a Space for maintenance
  now and then. When you have paying customers, move the backend to a paid host:
  Render's $7 plan uses the same Docker image and `render.yaml`.

## If something goes wrong

| What you see | What to check |
|---|---|
| GitHub Action fails: "Set the HF_TOKEN secret…" | Add `HF_TOKEN` (secret) and `HF_SPACE` (variable) exactly as in 2d. |
| GitHub Action fails: 401 / 403 / "Repository not found" | The token must be **Write**, and `HF_SPACE` must be `username/receipt-studio-api` with your exact username. |
| Space status **Build error** | Click **Logs** and read the last red lines. |
| Space **Runtime error**, log mentions `SECRET_KEY` | Add the `SECRET_KEY` secret (2c). It must be at least 32 characters. |
| Space log: `password authentication failed` or `connection refused` | Copy the Neon connection string again, in full, into the `DATABASE_URL` secret. |
| The website loads but every action fails ("Network Error") | `VITE_API_URL` in Cloudflare must be exactly the Space address (`https`, no `/` at the end). Redeploy the site after changing it (Deployments > ... > Retry). Also check `CORS_ORIGINS` matches the site address. |
| Reloading a page like `/reports` shows "404" | Make sure the latest code, with `frontend/public/_redirects`, is deployed. |
| Google: "origin not allowed" | Add the exact `https://...pages.dev` address in Google Cloud; it can take a few minutes. |

## Other options

- **Render** (needs a card to verify; the free plan stays $0, sleeps after 15
  idle minutes): New > Blueprint picks up `render.yaml`. Set the same variables.
- **Koyeb** (may ask for a card; servers in Frankfurt / Washington): deploy
  `backend/` with its Dockerfile and the same variables.
- **Netlify** instead of Cloudflare Pages: base directory `frontend`, build
  `npm run build`, publish `frontend/dist`, and `VITE_API_URL`.
