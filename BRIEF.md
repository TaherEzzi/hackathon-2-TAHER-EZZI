# BreezePost: Autonomous Social Content Generation & 1-Tap Publishing Engine
## Hackathon Technical Brief & Reference Specification

### Problem Statement
Modern D2C brands (beverages, skincare, perfumes, apparel) and independent creators face constant operational friction maintaining consistent social media channels:
* **Creative Burnout & Repetitive Effort**: Manual daily generation of product photography, on-brand visual compositions, copywriting, and hashtags consumes disproportionate operational bandwidth.
* **Workflow Disruption & Dashboard Fatigue**: Conventional social media management suites force creators into complex desktop dashboards and multi-step manual reviews, pulling founders away from core operations.
* **Inconsistent Posting Schedules**: Absence of automated, low-friction publishing pipelines leads to irregular posting cadences, damaging organic reach and platform algorithmic visibility.

---

### Solution
BreezePost is an autonomous end-to-end social content generation and 1-tap publishing engine engineered to bridge web-based brand configuration with frictionless Telegram chat approvals.
* **Zero-Friction Automated Generation Pipeline**: Automatically triggers multi-modal AI generation based on scheduled time slots or on-demand commands, synthesizing high-resolution product imagery and tailored captions.
* **1-Tap Telegram Review & Iterative Revision**: Dispatches ready-to-publish creatives directly into Telegram with inline action buttons to approve and publish immediately or refine via natural language chat feedback.
* **Centralized Brand & Asset Locker Architecture**: Locks brand colors, visual templates, and uploaded product catalog assets in a unified backend, preserving visual and tonal consistency across all outputs without repeated prompt engineering.

---

### Tech Stack
* **Frontend**: React / Next.js SPA (5-step onboarding workflow, brand color palette picker, visual template studio, asset locker, and bot pairing pipeline).
* **Backend & Bot Worker**: Python (FastAPI RESTful API for onboarding and asset ingestion, APScheduler for cadence automation, and `python-telegram-bot` for interactive review loops).
* **Database**: PostgreSQL (Stores user accounts, brand profiles, product catalog metadata, generation history, scheduling slots, and asset references).
* **AI / Multi-Modal Generation**: OpenRouter API (Multi-modal image synthesis endpoints such as FLUX.1 / DALL-E models; LLMs such as GPT-4o-mini / Claude 3.5 Haiku / Gemini Flash for tone-matched captions and hashtags).
* **Publishing & Messaging**: Telegram Bot API (`@BotFather` integration with inline keyboards and webhook callbacks) and Meta Graph API (Instagram Content Publishing API or mock publishing webhook for live demo execution).

---

### MVP Deliverables (Current Scope)
* **Brand Onboarding & Asset Hub**: 5-step guided web interface covering account signup, posting frequency schedule, product category selection, brand color palette setup, template studio with aesthetic presets, and product asset locker uploads.
* **Telegram Bot Pairing & Delivery Loop**: Instant bot pairing via deep link (`@BreezePostBot`) and scheduled/on-demand delivery of high-resolution product creatives with curated captions and hashtags.
* **1-Tap Publishing & Inline Controls**: Interactive Telegram message action buttons (`[✅ Approve & Post]`, `[✏️ Request Edit]`, `[⏭️ Skip Today]`) with direct dispatch to Instagram Graph API or mock publisher endpoint.
* **Conversational Natural Language Revisions**: In-chat reply handling enabling users to request caption tweaks or aesthetic adjustments with 1–2 automated revision passes per post slot.
* **Pipeline & History Dashboard**: Web dashboard displaying next scheduled post preview, active approval statuses (`Scheduled`, `Awaiting Review`, `Published`), and historical post log.

---

### Future Scope
* **AI Video Generation (Reels & Shorts)**: Automated generation of 5–10s Instagram Reels, YouTube Shorts, and TikTok videos with synthetic audio, music, and kinetic typography.
* **Omnichannel Notification Channels**: Expanding interactive chat approval loops to WhatsApp Business Cloud API, Slack, and Discord.
* **Multi-Platform Publishing**: Direct multi-network dispatch across TikTok, YouTube Shorts, X (Twitter), and Pinterest.
* **Growth & Engagement Analytics**: Historical engagement tracking, audience-peak scheduling algorithms, and post-performance analytics.

---

### Requirements from the Organizers (GitHub repos, AI API keys)
* **GitHub Organization / Repositories**: Provisioned GitHub repository for the frontend web application, FastAPI backend/scheduler, and Telegram bot service with team branch protections.
* **AI API Credentials**: OpenRouter API key with quota allocated for multi-modal generation (image synthesis models and high-throughput LLMs for copywriting).
* **Messaging & Social Sandbox**: Telegram Bot token from `@BotFather` and access to Meta for Developers (Instagram Content Publishing API test account) or public mock publishing webhook.
* **Cloud & Database Infrastructure**: PostgreSQL database instance (local or managed Supabase/Neon) and public webhook tunnel (e.g., ngrok/cloud tunneling) for receiving Telegram callbacks.
