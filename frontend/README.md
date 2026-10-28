# BreezePost — Frontend («The Atelier»)

A premium, royal atelier-themed Next.js app: small D2C brands configure their
identity once and get AI-generated Instagram product posts daily.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (passes clean: TS strict, zero `any`)
```

`.env.local` carries the **publishable** Supabase URL + key only — they are
browser-safe. No service keys live in, or are read by, this app.

## What is genuinely wired (supabase-js v2, RLS-protected; no backend REST dependency)

- **Auth** — email+password sign in / sign up, session persistence, live
  `onAuthStateChange`; routing by `profiles.onboarding_step` after entry.
- **Stage I (Plan)** — `profiles.tier` update + `onboarding_step`, plus the
  `schedule` row upsert (tier-gated frequency, `delivery_times time[]` mult-pick,
  timezone stamped from the browser).
- **Stage II (Identity)** — `brand_name`, `category`, and raw
  `design_dna_md` stored verbatim on the profile (see the file header note:
  DNA normalization is a backend-agent job; no LLM keys here by design).
- **Stage III (Themes)** — live read of `theme_preset` per category with the
  bundled 90-preset library as fallback; `theme_selection` insert/upsert/delete
  in pick order (max 5).
- **Stage IV (Assets)** — full product CRUD + `product-images` Storage upload
  (`{uid}/{uuid}.jpg` → public URL → `products.image_path`).
- **Stage V (Connect)** — `tg_link` row with a 6-char pairing code, 3-second
  poll for `linked_at`, pipeline `post` ledger reads, next-slot estimate from
  the schedule.

## What deliberately stays a stub (honoring the split of labor)

- **Design-DNA normalization** — backend agent's LLM pass; frontend stores raw.
- **Preview art** — `theme_preset.preview_path` renders when the Gemini images
  are uploaded; until then cards show derived gradient placeholders.
- **Post rows** — created by the backend agent (scheduler/generator/bot); the
  client only reads and displays.
- **Publishing badge** — static `Mock` unless `NEXT_PUBLIC_PUBLISHING_MODE=instagram`.

## Structure

```
app/            root layout (fonts+providers), 5 screens, onboarding shell
components/     GemPodium (r3f), StepRail, ThemeStudio, AssetLocker, ...
lib/supabase.ts lib/schedule.ts  lib/theme-data.ts (90 presets)  lib/tokens.ts
app/globals.css five [data-theme] token sets, grain, primitives, reduced-motion
```

Five atelier settings (themes) live on `[data-theme]` atop `<html>`, persisted
in localStorage, switcher in the top bar. All color flows through CSS custom
properties — no component hardcodes a hex.
