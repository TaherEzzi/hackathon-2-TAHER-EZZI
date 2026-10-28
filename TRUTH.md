# BreezePost — TRUTH Document (Single Source of Everything)

> **This is the ONLY reference document for BreezePost.** Supersedes `PRD.md` and `BRIEF.md` (kept for history only).
> Any session, human, or agent asking "what is BreezePost / what's built / what's next" reads this file.
> Last updated: 2026-10-28. Status legend: ✅ done&verified · 🔨 in progress · ⬜ blocked on user · 📦 backlog

---

## 0. One-liner

BreezePost turns a small D2C brand's product photos into branded, AI-generated Instagram posts — generated on a schedule, delivered to Telegram for 1-tap approval, and published straight to Instagram. *Effortless social posting on autopilot.*

## 1. Locked product decisions (decided — do not re-litigate)

| # | Decision | Value |
|---|---|---|
| D1 | Product name / tagline | **BreezePost** — "Effortless Social Posting on Autopilot" |
| D2 | Categories (6) | Jewelry, Handbags, Beverages/Drinks, Wallets, Watches, T-shirts |
| D3 | Themes | **90 static presets** (6 × 15), unique art style per category, seeded from awesome-prompt repos + self-authored. AI variation applied per post at runtime |
| D4 | Stack | FastAPI + python-telegram-bot + APScheduler · React/Next.js frontend · Supabase (Postgres + Auth + Storage) |
| D5 | Publishing | **Real Instagram first** (Creator account, IG-Login flow), **mock fallback** so demo never breaks |
| D6 | Pricing | Demo-only (no Stripe): tiers flip a DB flag — Streak / Boost / Surge |
| D7 | Alterations | **Per-post budget**: Streak 2, Boost 4, Surge 6. Exhausted → bot tells user, Approve/Skip only |
| D8 | Brand theme input | 3 modes (upload design file · upload/type MD free-text) → LLM normalizes ALL into one canonical **Design-DNA MD** stored in `profiles.design_dna_md`, injected into every prompt |
| D9 | Image gen | Cloudflare Workers AI FLUX.1-schnell ($0, ~25 imgs/day) primary · OpenRouter Nano Banana quality path if credits added |
| D10 | Text gen | OpenRouter free text models (50/day) via the free-tier key |
| D11 | Scheduling | Simple cron (APScheduler), no AI-optimized slotting for MVP |

## 2. Verified external credentials (all live-tested)

| Service | Detail | Status |
|---|---|---|
| Supabase `culmpmgyplcuromnewrt` | URL + publishable key + secret key + mgmt token in `.env` | ✅ schema built & verified |
| OpenRouter key `sk-or-v1-97dc…` | $0 balance, free tier, 50 free text req/day, expires **2026-11-27** | ✅ works (image models require top-up) |
| OpenRouter key `sk-or-v1-c632…` | same account, older, expires 2026-11-04 — use the newer one | ✅ |
| Instagram `information.at.your.tips` | IG User **27568940546118261**, `MEDIA_CREATOR`, token refreshable 60d | ✅ /me, /media, refresh verified |
| Cloudflare | token `cfut_…75a` (NEVER truncate/extend — paste corruption cost us an hour), account `92dc58f…` | ✅ **FLUX generated a real image in 3.6s** |
| Groq `gsk_…` | free LLM inference — bonus fallback for text | ✅ present in `.env` |
| GitHub PAT | exists in `.env` | ✅ |
| Telegram bot | **created at @BotFather → /newbot; each bot has its OWN unique token** | ⬜ awaiting token |
| Gemini (user's) | user generates 90 preview images for FREE from `THEME_PRESETS.md` | ⬜ user task |

## 3. Screens (web app flow)

1. **Login / Home** — Supabase Auth (email+password, Google OAuth later) → tier selection **Streak/Boost/Surge** (demo pricing page) → posting frequency + delivery time slots (tier-gated: 1/week → 1/day → 5/day)
2. **Brand Identity** — category (6 options) + brand name + upload brand theme (file / MD / typed text) → **Design-DNA MD conversion** (D8)
3. **Theme Studio** — 15 style presets for the chosen category shown as preview-image cards (from Gemini-generated previews); multi-select, ordered for rotation → saved to `theme_selection`
4. **Asset Locker** — product uploads (title, highlight, price, image → `product-images/{uid}/`), single-product vs combined-posts choice
5. **Telegram Connect + Pipeline** — pairing code → `@BreezePostBot` `/link <code>`; dashboard: next scheduled post, status timeline (`Scheduled → Awaiting Review → Published`), history log

## 4. Telegram bot (the daily UX)

- **Delivery:** image + caption + hashtags + buttons `[✅ Approve & Post] [✏️ Request Edit] [⏭️ Skip Today]`
- **Approve** → publish to Instagram → "✅ Published!"
- **Request Edit** (`/alter` semantics, D7): user types feedback → regenerates (image+caption) → budget check vs tier → exhausted = warning, Approve/Skip only
- **Demo/hero commands:** `/generate [preset#]` (manual gen), `/status`, `/skip`, `/link <code>`
- Polling mode for hackathon simplicity

## 5. Database (LIVE — verified 2026-10-28)

8 tables, all RLS-on, owner policies keyed on `auth.uid()`; enums `user_category`, `plan_tier(streak,boost,surge)`, `post_status(awaiting_review,approved,published,skipped,failed)`, `post_frequency(weekly,thrice_weekly,daily,twice_daily,five_daily)`; triggers: `on_auth_user_created`→auto-profile, `updated_at` updaters; FK indexes; buckets `product-images` (owner-write via `/{uid}/`), `generated-posts` (public read, service write).
**`theme_preset` seeded: 90/90 verified (15/category).** IDs: JW=1–15, HB=16–30, BV=31–45, WA=46–60, WT=61–75, TS=76–90.
Key invariant: **`profiles.id == auth.uid()` → every ownership check is `profile_id = auth.uid()`.**
Old unrelated project's data (travel app) was wiped; backup at `archive/old-project-dump-2026-10-28.json`.

## 6. Prompt engine (sources: Pixmind/MIT, JeremyGDM/CC0, YouMind-OpenLab)

- Style + scene words per preset live in `theme_preset.prompt_template`/`description`
- Runtime composition: `{product from Asset Locker}` + `{preset style/scene}` + `{brand palette/design DNA}` + guardrails (square 1:1, no text, no watermark, label preserved)
- 90 preview-hero prompts for the user to render free in Gemini → `THEME_PRESETS.md` → files named `JW-01.png … TS-15.png`

## 7. Build status

- ✅ Schema + 90 presets seeded; credentials verified; `THEME_PRESETS.md`
- 🔨 `backend/` scaffold (FastAPI · services/images|text|instagram|storage · bot handlers · scheduler · selftest) — background agent running
- ⬜ frontend (5 screens) — starts after backend lands
- ✅ Backend selftest infra live: supabase ✅ (after supabase-py 2.33.0 upgrade; grants re-fixed), openrouter ✅, telegram ✅; full 5/5 re-run pending
- ✅ `scripts/gen_previews.py` — automated 90-preview renderer (gemini/cloudflare providers, resume-safe). Dry-run proof: JW-11 rendered end-to-end from DB pull → saved file, style-match verified ("Neon Aurora")
- ✅ Sign-in bug fixed & verified (backfilled missing `profiles` row for `tahere442@gmail.com`; `mailer_autoconfirm=true`; trigger healthy)
- ✅ UI screen-flow aligned to the locked plan (user-requested fix): AtelierNavbar now I. PLAN → II. IDENTITY → III. THEMES → IV. ASSETS → V. CONNECT (+ VI. THE BENCH); screen eyebrows renumbered to match (PlanStage→I, IdentityForm→II, ThemeStudio→III); ThemeStudio renders ALL 15 real generated previews per category from DB `preview_path` (`/storage/v1/object/public/generated-posts/theme-previews/…`) instead of hardcoded STITCH images, `slice(0,6)` removed; theme confirm now advances to ASSETS (was skipping it); Playwright-verified sign-in → plan → identity → themes (15 tiles) → assets → connect, zero console errors; `npm run build` green (user's other agent's black/gold redesign preserved)
- ✅ Identity craft-domain picker now uses REAL generated preview images (rounded medallions, gold ring + check when selected; per-category file from `generated-posts/theme-previews/`: WT-02/TS-02/BV-02/JW-01/HB-02/WA-02) instead of icon circles; Assets screen rewritten as a SIMPLE TABLE (Image | Name | Description | delete) with "ADD NEW PRODUCT" creating an inline editable row with an upload icon — all "hang the piece / locker" copy removed; `image_path` normalizer added (rows seeded with bare storage paths now resolve to public URLs); Playwright-verified incl. draft-row add/discard, zero console errors
- ✅ Flavor-text purge + nav font fix (user-requested): navbar/nav links re-set in thick Cinzel serif 800 (matches BREEZEPOST wordmark, whitespace-nowrap); decorative copy removed everywhere — "THE MAISON LEDGER"→"BRAND IDENTITY", "MAISON NAME"→"BRAND NAME" (no more ATELIER VANEAU default), "AESTHETIC KEYWORDS & DESIGN DNA"→"DESIGN KEYWORDS", "VAULT SYNCHRONIZATION ARMED" deleted, "CURATE AESTHETICS"→"POST STYLES", "SELECT YOUR RHYTHM"→"CHOOSE YOUR PLAN", "THE SOVEREIGN HANDSHAKE"→"CONNECT TELEGRAM", connect card labels→PAIRING CODE/ACCOUNT/LINKED ✓/"CLICK TO COPY CODE", footer→"BREEZEPOST © 2026 / Instagram posts, on your brand's clock"; Identity category medallions sized to user taste after two iterations (203px final, grid-cols-2/sm:3), "BRAND IDENTITY" heading kept small (20px), brand-name field clarified (placeholder "e.g. Velvet Ember — your brand as it appears on Instagram" + helper line); selection check-badge moved outside the medallion's overflow-hidden span (was clipped to a sliver by the circle edge — geometry-verified unclipped); ThemeStudio phantom-selection bug fixed: saved selections are filtered to the current category's preset ids before counting (cross-category rows no longer show as phantom "selected" counts) and CONFIRM only replaces the current category's rows instead of wiping all selections; build green, Playwright-verified zero console errors
- ✅ Sketch render + img2img anchor infrastructure verified: Cloudflare `flux-2-klein-4b` multipart img2img works (1 test fire used of the user's remaining budget); provider wired into ladder (`generate_image_edit`), product photos now anchor generation; **IMAGE GENERATION PAUSED by user rule — no renders of any kind unless the user explicitly approves; scheduler slots deactivated until then**
- ⬜ img2img identity preservation needs tuning (test fire showed setting transform OK but product label was lost — klein-9b / prompt-strength options queued for the user's final 5-6 test fires)
- ⬜ 90 previews in `previews/` (10/90 done: JW-01…JW-10) — rule: **Gemini free route ONLY; Cloudflare neurons NEVER for previews (reserved for demo-day runs); never pay**
## 8. Next actions queue

1. ⬜ User: create Telegram bot → paste token → wire + live `/generate`→`/alter`→`/approve` loop
2. ⬜ User: render 90 previews via **Gemini free route only** (manual AI-Studio UI, OR add `GEMINI_API_KEY` to `.env` and let `scripts/gen_previews.py --provider gemini --wait` auto-run through the 429 reset windows; it skips existing files — compatible with manual progress). Cloudflare neurons NEVER for previews; never pay.
3. ⬜ Instagram real-publish smoke test (one scripted post) → then keep mock for demo unless creds hold
4. ⬜ Frontend build → E2E onboarding run → demo rehearsal
5. 📦 post-hackathon: real Stripe, WhatsApp/Discord channels, Reels/video, analytics
6. ⬜ **Restore img2img render size to 1024² for demo day** (currently 512² dev-mode per user call 2026-10-28 — quadruple render volume while developing; `backend/app/bot/tasks.py` size=512 → 1024)
