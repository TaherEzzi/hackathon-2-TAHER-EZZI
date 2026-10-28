# BreezePost - Product Requirements Document (PRD)

**Project Name:** BreezePost  
**Tagline:** Effortless Social Posting on Autopilot  
**Document Type:** Product Discovery, Technical Specification & MVP Roadmap  
**Target Event:** Hackathon Prototype  

---

## 1. Product Overview & Core Philosophy

### 1.1 The Core Thesis
Small D2C brands (beverages, skincare, perfumes, apparel) and creators struggle to maintain an active social media presence because manual daily content creation, caption writing, and publishing create significant operational friction.

**BreezePost** is an **effortless, hands-off automation engine**. It eliminates all creative friction: configure your brand once, upload product photos, and receive ready-to-publish posts directly on Telegram. 1 tap publishes; 1 text message iterates.

### 1.2 Value Proposition
* **Zero-Friction Onboarding:** Select your plan and posting cadence, choose your category and brand colors, pick your templates, and upload product images.
* **Effortless Review via Telegram:** No daily web dashboard logins required. Visuals, captions, and hashtags arrive in chat.
* **1-Tap Publishing:** Tap "Approve & Post" to go live directly.

---

## 2. User Journey & Screen Breakdown (Web App)

```
[Screen 1: Account Creation, Plan & Frequency]
                     │
                     ▼
[Screen 2: Category Selector & Brand Identity]
                     │
                     ▼
[Screen 3: Template & Style Studio]
                     │
                     ▼
[Screen 4: Asset Locker (Product Uploads)]
                     │
                     ▼
[Screen 5: Telegram Connect & Pipeline Dashboard]
```

### Screen 1: Account Creation, Plan & Posting Frequency
* **Account Creation**: Email / password signup or single-click Google OAuth.
* **Plan Selection**: Tier selection based on posting frequency 
* **Posting Frequency Setup**:
  * Frequency options: Twice a day, Once a day, 3 times a week, Once a week.
  * Target delivery time slots (e.g., 09:00 AM, 06:00 PM in user's timezone).

### Screen 2: Category Selector & Brand Identity
* **Category Selector**:
  * Product category options: Beverages & Drinks, Skincare & Cosmetics, Fragrances & Perfumes, Fashion & Apparel, Custom/Other.
* **Brand Identity**:
  * Brand Name.
  * Brand Color Schemes (Primary & Secondary Hex color picker / curated palettes).
  * *(Note: Tone of voice is excluded here; tone and aesthetic are determined by chosen templates).*

### Screen 3: Template & Style Studio
* **Visual & Tone Template Picker**:
  * Grid of visual templates (e.g., *Minimalist Luxury*, *Vibrant & Punchy*, *Clean Organic Studio*, *Lifestyle Flatlay*).
  * Selected templates establish visual composition, typography overlays, and copywriting tone.
* **Selection Mode**: Single or multi-template selection (rotates styles across scheduled posts).

### Screen 4: Asset Locker (Product Uploads)
* **Product Catalog Cards**: Upload product photos (clean PNG/JPEG with transparent or neutral backgrounds).
* **Product Metadata**: Product title, key highlights / ingredients / features, and optional price/tagline.selecting if you would like individuual product posts or combining multiple products or a mix of both 

### Screen 5: Telegram Connect & Pipeline Dashboard (for now we will follow an already connected account for all this )
* **Telegram Bot Pairing**: Deep link to `@BreezePostBot` with a unique pairing code to link the Telegram chat ID to the workspace account.
* **Content Pipeline Overview**:
  * Next scheduled post preview.
  * Post status timeline (`Scheduled`, `Awaiting Review`, `Published`).
  * Publishing destination config (Instagram Graph API or Mock Demo endpoint).

---

## 3. Daily Review Workflow (Telegram Bot)

1. **Scheduled Trigger** for the project , a command will be there that will be used to generate the image at demand 
   * At the designated time slot, the BreezePost bot delivers:
     * High-resolution generated product creative.
     * Ready-to-publish caption with curated hashtags.
     * Inline Action Buttons: `[✅ Approve & Post]` | `[✏️ Request Edit]` | `[⏭️ Skip Today]`.
2. **One-Tap Approval**:
   * Tapping `Approve & Post` triggers instant publishing to Instagram.
   * Bot edits the message: *"✅ Published to Instagram! [View Post]"*.
3. **Conversational Revision**:
   * User replies with prompt feedback (e.g., *"Make caption shorter and emphasize the citrus scent"*).
   * System regenerates the creative/caption via OpenRouter (budget: 1–2 revisions per slot).
   * User reviews the revised post and confirms.

---

## 4. Scope Matrix: MVP vs. Future Scope

| Feature Area | Hackathon MVP Scope | Phase 2 / Future Scope |
| :--- | :--- | :--- |
| **Media Format** | Single image posts (1080x1080 / 4:5 portrait) | 5–10s Instagram Reels / Shorts (AI video + audio + typography) |
| **Notification Channel** | Telegram Bot API | WhatsApp Business Cloud API + Discord Bot |
| **Social Target** | Instagram (Business/Creator API) / Mock Webhook | Instagram Reels, YouTube Shorts, TikTok |
| **Revision Budget** | 1–2 revisions per post slot | Dynamic revision quotas per subscription tier |
| **Growth & Analytics** | Posting history & approval rate logging | Engagement attribution, best-time-to-post AI, view analytics |
| **Monetization Hook** | Free tier proving consistency habit | Upsell: "Growth Optimizer" tier using historical analytics |

---

## 5. Technical Architecture & Requirements

### 5.1 Component Stack
* **Backend API & Bot Worker**: Python (FastAPI + `python-telegram-bot` + `APScheduler`).
* **Database**: PostgreSQL (Stores user configs, brand profiles, post schedules, generation history, and image references/BLOBs).
  * *Image Storage Strategy*: Store image metadata and URLs in PostgreSQL with image assets stored in PostgreSQL `BYTEA` or an S3/Supabase storage bucket mapped to PostgreSQL.
* **Frontend**: Next.js or React + Vite (Web onboarding hub).
* **Code Repository**: GitHub.

### 5.2 External APIs & Keys Required
1. **OpenRouter API Key**:
   * **Image Generation**: OpenRouter endpoints supporting image models (e.g., FLUX.1, Midjourney proxy, or DALL-E models via OpenRouter).
   * **Copywriting & Captions**: OpenRouter LLMs (e.g., `openai/gpt-4o-mini`, `anthropic/claude-3.5-haiku`, or `google/gemini-flash-1.5`) for tailored captions, template tone alignment, and hashtags.
2. **Telegram Bot API**:
   * Token from `@BotFather`.
3. **Publishing Destination**:
   * Meta Graph API (Instagram Content Publishing API) or Mock Publisher webhook for hackathon demo.
