# BreezePost — Autonomous Social Content Engine

End-to-end hackathon project: AI product-content generation with 1-tap publishing via Telegram.

Brand configuration on the web → scheduled/on-demand AI generation of product imagery + captions → ready-to-publish creatives delivered to Telegram with inline action buttons → publish to Instagram (real or mock) → history dashboard.

## Monorepo layout

```
.
├── backend/    FastAPI REST API + Telegram bot worker + APScheduler
├── frontend/   Next.js SPA (5-step onboarding, template studio, dashboard)
├── scripts/    Preview-generation utilities
├── previews/   Generated product preview images
├── assets/     Sample product assets
├── PRD.md      Product requirements
└── BRIEF.md    Technical brief & reference specification
```

## Quickstart

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # fill in values (never commit .env)
uvicorn app.main:app --reload
```

Verify live services with:

```bash
python scripts/selftest.py
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Configuration

All secrets live in `.env` (repo root) and `frontend/.env.local` — both are
git-ignored. See `backend/.env.example` for the full list of variable names
(Supabase, Cloudflare Workers AI, OpenRouter, Telegram, Instagram, publish mode).

## Safety

`PUBLISH_MODE=mock` keeps publishing demos safe (fake media id, no real posts).
