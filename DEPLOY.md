# Deploying BreezePost

Target topology:

| Piece | Host | Why |
|---|---|---|
| Next.js web app (`frontend/`) | **Vercel** | static/SSR build, verified clean (`next build`, 11 routes) |
| FastAPI + Telegram bot + APScheduler (`backend/`) | **Render** free web service | needs one always-on process |
| Postgres, Auth, Storage | **Supabase** | managed, both hosts reach it over HTTPS |

The frontend never calls the FastAPI server — it uses Supabase directly
(auth, tables, storage). The backend only serves the bot and the scheduler,
so the two hosts are independent and can be redeployed separately.

---

## 1. Backend → Render

The blueprint lives at the repo root: [`render.yaml`](render.yaml).

**Blueprint route (recommended)**

1. Render Dashboard → **New → Blueprint** → connect this GitHub repo → branch `main`.
2. Render reads `render.yaml` and creates `breezepost-backend`:
   - root directory `backend`, runtime Python (3.12.6 via `backend/.python-version`)
   - build: `pip install -r requirements.txt`
   - start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - health check: `/health`
3. Fill the variables marked `sync: false` when prompted (values live in your
   local `.env`; never commit them).

**Manual route**

New → Web Service → repo → Root Directory `backend` → Runtime Python 3 →
Build `pip install -r requirements.txt` → Start the command above → Health
Check Path `/health` → Plan Free.

### Environment variables to set

Secrets (dashboard only):

| Key | Source |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API |
| `SUPABASE_SECRET_KEY` | same page, service-role key |
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard |
| `GROQ_API_KEY` | Groq console (caption fallback) |
| `TELEGRAM_BOT_TOKEN` | @BotFather |
| `IG_ACCESS_TOKEN` | Instagram Graph (Instagram Login) |
| `IG_USER_ID` | must match the token's `/me` id (`17841421131415022`) |

Pinned by the blueprint (override only if you know why):

`TELEGRAM_POLLING=true`, `TG_BOT_USERNAME=BreezePostBot`, `PUBLISH_MODE=real`,
`IG_API_VERSION=v24.0`, `POST_IMAGE_SIZE=512`, `DEFAULT_TIMEZONE=Asia/Kolkata`,
`CLOUDFLARE_EDIT_MODEL`, `CLOUDFLARE_EDIT_MODEL_FALLBACK`,
`CLOUDFLARE_TEXT_MODEL`, `CLOUDFLARE_TEXT_FALLBACKS`.

Verify after deploy: `https://<service>.onrender.com/health` must return
`{"status":"ok","supabase":true,"telegram_bot":true,"scheduler":true}`.

---

## 2. Frontend → Vercel

1. Vercel → **Add New → Project** → import the same repo.
2. **Root Directory: `frontend`** (important — the repo root is a monorepo).
3. Framework preset: Next.js. Build `npm run build`, output `.next` (defaults are fine).
4. Environment variables (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
5. Deploy, then in Supabase → **Authentication → URL Configuration** set
   **Site URL** to the Vercel domain and add it under **Redirect URLs**.
   Signup confirmation emails point at these values.

No Vercel config file is required; `frontend/.env.example` lists the two keys.

---

## 3. Keep the Render service awake (free plan)

Render free web services **spin down after 15 minutes with no inbound
traffic**, and the next request pays a ~1 minute cold start. While asleep the
Telegram bot and the per-minute scheduler are frozen; when it wakes, polling
starts with `drop_pending_updates=True`, so messages sent during the sleep are
discarded. A heartbeat prevents that.

Pick one (10–14 minute interval; anything under 15 works):

**Option A — uptime monitor (cheapest, recommended)**
- UptimeRobot (free): HTTP(s) monitor → `https://<service>.onrender.com/health`
  → interval 5 minutes.
- or cron-job.org (free): URL above, every 10 minutes.

**Option B — GitHub Actions**
[`.github/workflows/keepalive.yml`](.github/workflows/keepalive.yml) runs every
10 minutes. Add a repository secret `BACKEND_URL` =
`https://<service>.onrender.com` (no trailing slash). Notes:
- works free on public repos; on private repos each run bills ~1 Actions
  minute (~8.6k/month at this cadence).
- GitHub disables scheduled workflows after 60 days of repo inactivity.
- its scheduler is best-effort and can run late — that is why the workflow
  uses 10 minutes, not 14.

**Wake the service yourself after a deploy** (open the `/health` URL or send
the bot any command) — the first request is the slow one.

### Free-tier accounting

- 750 instance hours/month per workspace; one service kept awake 24/7 uses
  ~730, so a single backend fits. Running a second always-on free web service
  would exhaust the pool.
- Free plan supports **web services only** — no background workers or cron
  jobs. The bot (`TELEGRAM_POLLING=true`) and APScheduler are started inside
  the web process by `app/main.py`, so this restriction is already satisfied.
- No persistent disk is needed: product photos and rendered posts live in
  Supabase Storage buckets.

---

## 4. Operational notes

- **Redeploys restart the process.** Pending Telegram updates are dropped and
  scheduler slots that were missed while the process was down are not
  backfilled (the scan only looks at the current minute). Keep deploys outside
  delivery windows; the heartbeat covers idle sleep, not restarts.
- **Only one poller per bot token.** If your laptop's backend is still running
  with the same `TELEGRAM_BOT_TOKEN` when Render comes up, Telegram answers
  `409 Conflict` to both and two schedulers race on the same slots. Stop the
  local process (or run it with `TELEGRAM_POLLING=false`) once the deployed
  service is live.
- **Real publishing is on** (`PUBLISH_MODE=real`). To dry-run on a public
  deployment set `PUBLISH_MODE=mock` — the bot then reports that nothing was
  sent to Instagram.
- **CORS** is already `*` in `backend/app/main.py`, so the web app can call the
  REST endpoints later without a config change.
- **Secrets** never enter git: root `.env` and `frontend/.env.local` are
  ignored, and `render.yaml` only names the keys (`sync: false`).
