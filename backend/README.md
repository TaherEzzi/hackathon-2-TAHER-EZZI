# BreezePost Backend

Autonomous social-content engine for small D2C brands: brand config → AI
product creatives (image + caption) → 1-tap review in Telegram → publish to
Instagram. FastAPI REST + python-telegram-bot + APScheduler, one process.

## Layout

```
backend/
├── app/
│   ├── main.py          FastAPI REST (web-app surface) + lifespan wiring
│   ├── config.py        env config (reads repo-root .env; names never logged)
│   ├── db.py            Supabase service-role client + row helpers
│   ├── state.py         shared runtime (config, client, bot handle)
│   ├── scheduler.py     APScheduler cadence worker (due-slot scan each minute)
│   ├── services/
│   │   ├── images.py    provider ladder: Cloudflare FLUX.1-schnell → OpenRouter gemini-image
│   │   ├── text.py      caption/hashtags: OpenRouter :free → xAI fallback
│   │   ├── instagram.py two-step IG publish (real|mock via PUBLISH_MODE)
│   │   ├── storage.py   Supabase Storage upload + public URLs
│   │   └── quotas.py    tier alteration budgets and daily caps
│   └── bot/
│       ├── handlers.py  /start /link /generate /status /skip + inline callbacks
│       └── tasks.py     generate-and-deliver pipeline (shared bot ↔ scheduler)
├── scripts/selftest.py  PASS/FAIL/SKIP probe for every live service
├── requirements.txt     pinned deps
└── .env.example         env var names + placeholders (never commit .env)
```

## Setup

```bash
cd "backend"
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # fill values (repo-root .env already has most)
```

Credentials are read from `backend/.env` and the repo-root `.env`.
Canonical names are preferred; `NEXT_PUBLIC_SUPABASE_URL`, `supabase_secret_key`
and `grok_api_key` are honored as fallbacks so the existing root `.env`
just works. Never log or commit secret values.

## Run (uvicorn + Telegram polling)

```bash
uvicorn app.main:app --reload --port 8000
```

- REST: http://localhost:8000 — `/health`, `/me`, `/posts`, `/onboarding`,
  `/onboarding/schedule`, `/pairing/telegram`
- Telegram: polling mode (`TELEGRAM_POLLING=true`) — no tunnel needed
- Scheduler: due-slot scan runs every minute in the same process

Without `TELEGRAM_BOT_TOKEN` the API + scheduler still start; the bot logs
"WAITING for token" once and stops. `PUBLISH_MODE=mock` (default) makes the
Approve flow return a fake `ig_media_id` so demos never break.

## Web-app → backend contract

Send the user's Supabase JWT: `Authorization: Bearer <jwt>`. The backend
verifies via Supabase auth and maps auth.uid → `profiles.id` (auth uid is
the profile PK, so there is no guest access to anyone's config).

- `POST /onboarding` — `{brand_name?, category?, design_dna_md?, timezone?, onboarding_step?}`
- `POST /onboarding/schedule` — `{frequency: 'weekly'|'thrice_weekly'|'daily'|'twice_daily'|'five_daily', delivery_times?: ['09:00','18:00'], active?}`
- `GET /me` — `{profile, schedule, telegram_link}`
- `GET /posts?limit=20` — recent posts with `image_url` to the `generated-posts` bucket
- `POST /pairing/telegram` — `{pairing_code, bot_username, deep_link}`

## Telegram bot

| command | effect |
|---|---|
| `/start <code>` / `/link <code>` | pairs chat ↔ profile via `tg_link.pairing_code` |
| `/generate [preset#]` | instant demo post (random preset, random product) |
| `/status` | tier, schedule, last 5 posts |
| `/skip` | mark today's awaiting posts skipped |

Inline buttons per post: **✅ Approve & Post** (publish → edit message),
**✏️ Request Edit** (next text = revision feedback; budget 2/4/6 by tier
streak/boost/surge), **⏭️ Skip Today**.

## Self-test

```bash
python scripts/selftest.py
```

Prints `[PASS]/[FAIL]/[SKIP]` for supabase db/storage, Cloudflare FLUX,
OpenRouter, Telegram, Instagram. Missing config is SKIP, not failure.

## Things we codified (assumptions)

- `delivery_times` is `time[]` in the DB; the REST layer accepts plain
  `HH:MM` strings and the scheduler sorts/copies them (`sorted(str(t)[:5])`).
- Slot idempotency: `(profile_id, slot_date, slot_index)` uniqueness is
  checked per tick; failed picks are recorded as `status='failed'` rows.
- The scheduler time rows follow the *frequency* — weekly → Monday,
  thrice-weekly → Mon/Wed/Fri, times-per-day from the frequency map — and
  the tier daily cap is an additional guard.
- Revision regeneration keeps `preset_id` from the base post (style stays
  consistent while only the feedback changes).
- OpenRouter quota is only ~50 free text calls/day; every ladder failure is
  logged, never crashes the tick, and degrades to the next provider.
