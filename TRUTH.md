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
| Groq `gsk_…` | free LLM inference — wired as the caption fallback after Cloudflare (`openai/gpt-oss-120b`, 1s, valid JSON) | ✅ verified 2026-10-29 |
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

- **Delivery:** image + caption + hashtags + buttons `[✅ Approve & Post] [✏️ Request Edit] [🔄 Generate New] [⏭️ Skip Today]`
- **Approve** → publish to Instagram → "✅ Published!"
- **Request Edit** (`/alter` semantics, D7): user types feedback → regenerates (image+caption) → budget check vs tier → exhausted = warning, Approve/Skip only
- **Text-command equivalents (2026-10-29):** `/change <natural-language feedback>` revises the latest `awaiting_review` post in place (same budget/rotation as the inline ✏️ button; each edit adds a `revision` row and bumps `revision_count`); `/post` publishes the latest `awaiting_review` post to Instagram without waiting for the inline ✅ button. Typed feedback with no command is also treated as a change request.
- **Publish is retryable:** a failed `/post`/approve leaves the row in `awaiting_review` (never flips it to `failed`), so the user can send `/post` again once the cause is fixed.
- **Live publishing is ON** (`PUBLISH_MODE=real`, account `@information.at.your.tips`). `mock` only marks the row published with a fake `mock_…` id and sends nothing to Instagram.
- **Generate New** (`/new` or 🔄 button): renders a fresh post from a **different product** than the one on the current draft — same theme preset, product swapped — and retires the old draft (`status=skipped`) so only one draft is pending. If the locker holds just that one product, the bot asks for another photo instead of re-rendering the same item.
- **Demo/hero commands:** `/generate [preset#]` (manual gen), `/new` (different product), `/change <feedback>`, `/post`, `/status`, `/skip`, `/link <code>`
- Polling mode for hackathon simplicity

## 5. Database (LIVE — verified 2026-10-28)

8 tables, all RLS-on, owner policies keyed on `auth.uid()`; enums `user_category`, `plan_tier(streak,boost,surge)`, `post_status(awaiting_review,approved,published,skipped,failed)`, `post_frequency(weekly,thrice_weekly,daily,twice_daily,five_daily)`; triggers: `on_auth_user_created`→auto-profile, `updated_at` updaters; FK indexes; buckets `product-images` (owner-write via `/{uid}/`), `generated-posts` (public read, service write).
**`theme_preset` seeded: 90/90 verified (15/category).** IDs: JW=1–15, HB=16–30, BV=31–45, WA=46–60, WT=61–75, TS=76–90.
Key invariant: **`profiles.id == auth.uid()` → every ownership check is `profile_id = auth.uid()`.**
Old unrelated project's data (travel app) was wiped; backup at `archive/old-project-dump-2026-10-28.json`.

## 6. Prompt engine (sources: Pixmind/MIT, JeremyGDM/CC0, YouMind-OpenLab)

- Style + scene words per preset live in `theme_preset.prompt_template`/`description`
- Runtime composition: `{product from Asset Locker}` + `{preset style/scene}` + `{brand palette/design DNA}` + guardrails (square 1:1, no text, no watermark, label preserved)
- **Asset photo requirements (for a clean product-anchored render):** one product, centred and in focus, filling ≥40% of the frame; plain white/grey backdrop is ideal; long edge ≥800px (the backend downscales to <512 for Klein); no people/faces, no collages, no text overlays or watermarks; a product the brand owns the rights to. Famous trademarks (Coca-Cola, Rolex, Disney, club crests) are refused by Cloudflare's output filter (3030) on every model — the post then falls back to a text-only render, which cannot match the photo.
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
- ✅ Telegram `/generate` repaired 2026-10-29: (a) Klein's reference-image part must be `input_image_0` (was `image` → 400 Bad Request) and uploads are downscaled/re-encoded below 512px with Pillow (Asset Locker photos are 1024px+ JPEG/WebP); (b) caption model `@cf/meta/llama-3.1-8b-instruct` was **deprecated by Cloudflare (410 Gone)** → default now `@cf/meta/llama-3.1-8b-instruct-fp8` with `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, then **Groq `openai/gpt-oss-120b`** as the last fallback (the `.env` key `grok_api_key` is a Groq `gsk_…` key, not xAI); (c) provider errors surface Cloudflare's own `errors[].message`; (d) **3030 "output flagged"** false-positives get 3 prompt-visual retries (safer wording + varied input scale), and if the filter still refuses — **always the case for trademarked packaging such as a Coca-Cola can** — `generate_post` falls back to a text-only Flux-Schnell render so the post is still delivered. Live-verified: 512² product-anchored renders (label preserved) + text-only fallback + caption JSON.
- ✅ On-demand posts + `/change` + `/post` (2026-10-29): (a) `post.slot_index` is **NOT NULL** (schema default 0, but an explicit `None` overrode it) → on-demand `/generate` now stores `slot_index=0` with `slot_date=NULL`, preserving the scheduler's `(profile_id, slot_date, slot_index)` uniqueness; same fix in `insert_failed_slot`; (b) `/change <feedback>` revises the newest `awaiting_review` post — tier budget enforced, revision row recorded, Approve/Skip-only keyboard on the final allowed edit; (c) `/post` publishes the newest `awaiting_review` post to Instagram (PUBLISH_MODE=mock returns a `mock_…` media id) and marks it `published` with `published_at`; (d) the bot's `/` menu is now set via `set_my_commands` (generate/change/post/status/skip/link). Live-verified: on-demand post inserted `slot_index=0`, `slot_date=NULL`, `awaiting_review`; revision round-trip (feedback → Klein render → `revision.seq=1`, `revision_count=1`) applied the requested change; 20/20 backend unit tests green.
- ✅ Image fidelity + real publishing (2026-10-29, second round): (a) **why renders didn't match the asset** — Cloudflare's 3030 output filter flags every Coca-Cola photo on **both** klein models (3/3 attempts each; klein-9b additionally 500s/flags benign photos), so `generate_post` fell back to a **text-only** render; the bot now says so in the Telegram message; (b) edit prompt rewritten: preset text is scoped to *background only* ("A fruity drink bottle…" no longer forces a bottle), the asset title is **no longer injected as prompt text** (it was overwriting the label with "Coco cola"), scene colour grade may not tint the product, identity lock leads *and* trails the prompt; (c) `/change` now **keeps the base post's product** (re-picking a random product swapped the photo under the feedback), and text-only fallback uses a dedicated prompt that names the product; (d) `CLOUDFLARE_EDIT_MODEL` (4b primary, 9b fallback) with one fallback hop on non-policy failures; (e) **real publishing ON**: `PUBLISH_MODE=real`, `IG_USER_ID` corrected to the token's own account (`17841421131415022`; the old id mismatched → every publish would 400), media container is polled until `FINISHED` before `media_publish`; live smoke post published (`media_id 18081018881722711`); (f) mock reply now says "nothing was actually sent to Instagram", and a failed Approve leaves the draft retryable. 25/25 backend tests green. **Open constraint:** for trademarked packaging, Cloudflare cannot re-render the actual product — only a styled composite of the original photo would stay accurate (see §8).
- ✅ Profile `f8825e56…` switched from **beverages → watches** (2026-10-29) so the demo uses a category Cloudflare can render; the three Coca-Cola products were deleted from Asset Locker (their storage objects were left in place) and old post rows detached (`product_id=NULL`) so history stays intact. `pick_preset` now drops saved theme selections from the old category, so a watch never lands in a beverage scene. Watch presets: 61–75.
- ✅ Asset Locker deletion fixed (2026-10-29): `post.product_id` is a plain FK (`post_product_id_fkey`, NO ACTION), so deleting a product that any post referenced raised `violates foreign key constraint`. `removeProduct` now detaches the referencing post rows (`product_id = NULL`) before deleting, and only removes the Storage file after the row is gone. Existing Coke rows were already cleared server-side; refresh the Assets page to see the empty locker, then upload watch photos per the requirements line.
- ✅ Jewelry switch + `/new` (2026-10-29, third round): (a) profile `f8825e56…` moved watches → **jewelry** (unbranded pieces have no trademarked label for Cloudflare's 3030 filter to match); saved theme selections pruned from 12 to the 3 jewelry presets (1 Velvet Vault, 7 Floating Gemfield, 13 Water Lens); the backend has **no** beverage default anywhere (the only comment/fixture references were neutralised); (b) **🔄 Generate New** — `/new` command + inline button on every draft: renders a fresh post from a *different* product than the current draft, keeps the draft's theme preset so the product swap is like-for-like, retires the old draft to `skipped`, and replies "add another photo" when the locker holds only the excluded product (`NoAlternativeProduct`); (c) landing CTA now resumes onboarding/dashboard for signed-in users instead of reopening sign-in; (d) duplicate `_graph_post` removed; (e) `next build` clean for all 11 routes (Vercel-ready frontend); 31/31 backend tests green.
- ✅ Deploy split live (2026-10-29, fourth round): frontend stays Vercel-ready (`frontend/` as root), backend runs on a Render free web service `breezepost-backend` (`srv-dbhf8gom7kps73eot46g`, singapore) built from `render.yaml` → https://breezepost-backend.onrender.com. Deploy `dep-dbhfrf1srm7s73fo5spg` (commit 709d3d2) is **live**; `/health` returns `{"status":"ok","supabase":true,"telegram_bot":true,"scheduler":true}`. Gotcha that cost two failed deploys: a Render **environment group** does nothing until it is linked to the service — the 10 secrets sit in group `breezepost` (`evg-dbhfjudg1s2s739v7lm0`) and are linked from the *service's* Environment page (not the group page). Unlinked, startup dies with `RuntimeError: Missing required configuration: supabase_url, supabase_secret_key` → exit 3 (build itself always succeeded). Keepalive `.github/workflows/keepalive.yml` pings `/health` every 10 min via secret `BACKEND_URL`; verified green against the live URL. Free-plan caveats: 15-min idle spin-down (~60 s cold start), 750 instance-hours/month shared with the two suspended services, and exactly **one** bot poller — do not run local `uvicorn` while Render is up (Telegram 409) and expect two schedulers if you do.
- ⬜ 90 previews in `previews/` (10/90 done: JW-01…JW-10) — rule: **Gemini free route ONLY; Cloudflare neurons NEVER for previews (reserved for demo-day runs); never pay**
## 8. Next actions queue

1. ⬜ User: create Telegram bot → paste token → wire + live `/generate`→`/alter`→`/approve` loop
2. ⬜ User: render 90 previews via **Gemini free route only** (manual AI-Studio UI, OR add `GEMINI_API_KEY` to `.env` and let `scripts/gen_previews.py --provider gemini --wait` auto-run through the 429 reset windows; it skips existing files — compatible with manual progress). Cloudflare neurons NEVER for previews; never pay.
3. ⬜ Instagram real-publish smoke test (one scripted post) → then keep mock for demo unless creds hold
4. ⬜ Frontend build → E2E onboarding run → demo rehearsal
5. 📦 post-hackathon: real Stripe, WhatsApp/Discord channels, Reels/video, analytics
6. ⬜ **Restore img2img render size to 1024² for demo day** (currently 512² dev-mode per user call 2026-10-28 — quadruple render volume while developing; set `POST_IMAGE_SIZE=1024` in `.env`, no code change)
7. ✅ **Fidelity route chosen: demo with non-trademarked products** — profile moved to the watches category and Coke products removed (2026-10-29). Optional later: an "exact product" composite (original photo cut out over a styled backdrop) if a user insists on a famous brand; no free AI provider can edit those photos.
