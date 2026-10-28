# Google Stitch prompt — BreezePost Atelier redesign

## How to use
1. Go to stitch.withgoogle.com → choose **Web app** mode.
2. Paste the master prompt below into the prompt box.
3. Attach as reference images (paperclip):
   - a screenshot of the current landing page (`/tmp/opencode/pwcheck/shot_landing.png`) — for structure/flow reference
   - 2–3 of the luxury product previews from `previews/` (e.g. `JW-01.png`, `HB-02.jpg`, `WT-03.jpg`) — for the visual/glamour style target
4. Generate, then iterate screen-by-screen ("refine this screen: …") rather than regenerating everything.

---

## MASTER PROMPT (copy everything below)

Design a premium web app called **BreezePost** — a private "atelier" where small D2C brands
commission AI-generated, luxury-editorial Instagram product posts once per day, approve them
with one tap in Telegram, and auto-publish to Instagram. The visual language must feel like a
high-fashion house's private digital atelier — NOT a generic SaaS dashboard.

**Aesthetic direction (strict):**
- Mood: dark, intimate, editorial luxury. Think Gucci's web editorial, Aesop product pages,
  and a jewelry maison's lookbook — velvet-dark backgrounds, warm gold accents, generous
  negative space, slow-reveal feel.
- Ultra-compact: no card grid spam, no drop-shadow soup, no glassmorphism, no purple-blue
  startup gradients, no rounded-2xl dashboard cards, no sidebar-with-icons layout.
- Details that carry the identity: hairline borders (25% opacity of the accent color),
  letterspaced uppercase micro-labels ("THE ATELIER · EST. TODAY" style), thin gold rules
  as separators, film-grain texture overlays, a single hero 3D moment (glass podium with an
  orbiting gem) on the landing page only.

**Default color theme — "Aubergine Court" (use exactly):**
- Background #241431, Surface #2e1a3e, Text #f3eee4, Accent (buttons/highlights/CTA) #e8a33d,
  Secondary accent #c9c9d1, hairline borders rgba(232,163,61,0.25)
The app ships 4 alternate tokens I'll swap programmatically — design only in Aubergine Court.

**Typography:**
- Display font: Fraunces (high-contrast editorial serif) for H1/H2 and big numerals.
- Body: Manrope, 15–16px, relaxed line height.
- Micro-labels/overlines: Space Grotesk, 11px, +0.18em letter-spacing, uppercase.

**Screens to design (web, desktop-first, 1440px):**

1. **Landing** — split hero: left = oversized serif headline "Your brand, enshrined daily."
   with two-line sub-copy and 4 bullet-value props with gold check glyphs; right = the 3D
   gem podium scene on the dark background. Top bar: wordmark "BreezePost THE ATELIER",
   theme selector labeled "SETTING", Sign in / Create account panel styled as a slim
   parchment-like card with a single gold CTA "Enter the atelier".

2. **Onboarding — I. The Plan** — three pricing tiers as three slim vertical panels
   ("Streak / Boost / Surge"), each with a roman-numeral crown mark, weekly-post frequency,
   and alterations-per-post (2/4/6). Selected tier gets a gold hairline frame, not a fill.

3. **Onboarding — II. The Identity** — form felt like filling a house ledger: brand name,
   craft category (six engraved medallion-style chips: Jewelry, Handbags, Beverages,
   Wallets, Watches, T-shirts), "design DNA" textarea set inside a parchment field.
   Left rail shows the onboarding steps as roman numerals I–V with gold active state.

4. **Onboarding — III. The Themes** — a curated grid of 15 style-preview cards for the
   chosen category (square luxury product images, hover lifts card 6px, selected card gets
   a gold corner seal). User may pick up to 5; a thin "collection tray" docks at the bottom
   showing picks in order.

5. **Onboarding — IV. The Asset Locker** — minimalist uploader: large dashed gold-hairline
   drop zone set inside a velvet suède panel, thumbnails as contact-sheet tiles with roman
   numeral ordering.

6. **Onboarding — V. The Connect** — two "signet seals": Telegram pairing (a 6-character
   A–Z0–9 code displayed like a hallmarked stamp with a live "waiting for the bot…" pulse)
   and Instagram connection status. A rite-of-passage completion screen with the gem
   podium reappearing, headline "Your atelier is open."

7. **Dashboard — The Bench** — editorial pipeline table, not a SaaS list: each row is a
   daily entry ("Day 41 · 9:00 AM"), showing the generated post image (square, small),
   its style name in serif, status as a stamped seal (Awaiting Approval / Approved / Skipped /
   Published), IG media id as a footnote. Slim, elegant vertical rhythm. Top-right: tier
   badge and next-slot countdown in Space Grotesk.

**Interaction polish:** 200–400ms fades only, hairline dividers animate on hover, buttons
are rectangles with a slight 2px radius and gold fill that inverts to dark on hover —
keep it restrained. Respect prefers-reduced-motion everywhere.

Deliver desktop screens first at 1440px with a 12-column grid, then mobile derivatives of
landing and dashboard at 390px.
