# Claude Design -- Step-by-Step Guide for MyLife Assets

**For:** Trey Shuldberg (first-time user)
**What you'll create:** 12-slide investor deck, 1-page investor brief, manifesto page layout, Kickstarter hero assets, 8-year projection chart
**Time estimate:** 60-90 minutes for all 5 assets
**Prerequisite:** Claude Pro, Max, Team, or Enterprise subscription

---

## Part 1: Getting Into Claude Design

### Step 1: Open Claude Design
1. Go to **[claude.ai/design](https://claude.ai/design)** in your browser
2. Sign in with your Claude account (same login as regular claude.ai)
3. You'll see a project picker on the left and a blank canvas

### Step 2: Create a New Project
1. Click **"New Project"** (or the + button)
2. Name it: **"MyLife Investor Assets"**
3. You'll see two panels: **chat on the left**, **canvas on the right**

### Step 3: Set Up Your Design System First
This is the most important step. It teaches Claude Design your Cool Obsidian theme so every asset matches your brand automatically.

1. In the chat panel, paste the **Brand Context Block** below (Prompt 0)
2. Wait for Claude to confirm it absorbed the design system
3. Every prompt after this will use your colors, typography, and voice automatically

---

## Part 2: The Prompts (Paste These In Order)

### Prompt 0 -- Brand Context Block (PASTE THIS FIRST)

Copy and paste this entire block as your first message in the project:

```
You are designing visual assets for MyLife, a privacy-first cross-platform consumer
application that bundles 30 lifestyle modules (mood, meds, cycle, fast, habits,
health, workouts, recipes, nutrition, market, books, words, flash, journal, notes,
voice, mail, RSVP, forums, garden, closet, car, pets, homes, presence, budget,
trails, surf, stars) for $12/year.

DESIGN SYSTEM -- "Cool Obsidian" dark theme:
- Background: #131318 (true app background)
- Surface: #131318 (card/panel fill)
- Surface elevated: #2A292F
- Text primary: #E4E1E9
- Text secondary: #D6C3B5
- Border: rgba(255,255,255,0.06)
- Primary accent: #FFB877 (warm orange -- use sparingly, hero callouts only)
- Primary container: #C9894D
- Tertiary accent: #8BCFF0 (cool blue -- health/info contexts)
- Glass fill: rgba(255,255,255,0.03)
- Glass border: rgba(255,255,255,0.10)
- Success: #30D158 · Danger: #FFB4AB
- Surface tiers (lowest to highest): #0E0E13, #1B1B20, #1F1F25, #2A292F, #35343A

TYPOGRAPHY:
- Headings: Inter or SF Pro Display, weight 600-700, tight letter-spacing
- Body: Inter or SF Pro Text, weight 400-500
- Numerals (financial figures): tabular figures, weight 600
- All sizes paired with explicit line-heights (e.g. 36pt/44pt)

LAYOUT GRID:
- 12-column grid for slides
- 8pt baseline grid for spacing
- Generous padding: 64pt minimum on slide edges
- Glass-morphism cards with 1px borders, 12pt radius, subtle backdrop blur

VOICE / TONE:
- Plainspoken, anti-cynical, thoughtful
- Confident without hype
- Specific numbers preferred over adjectives
- No em dashes
- No exclamation points except in headlines where genuinely warranted
- Sentence-case titles (not title case)

OBJECT LANGUAGE:
- Module icons: simple line-style emoji or SF Symbol-style glyphs
- Charts: minimal axes, single accent color emphasis, generous whitespace
- Avoid decorative gradients; use solid fills and one-color highlights

Confirm you have absorbed this design system, then I will send you the content for
each slide individually.
```

**Wait for Claude to confirm.** Then proceed to Prompt 1.

---

### Prompt 1 -- 12-Slide Investor Deck

After Claude confirms, paste this:

```
Generate a 12-slide investor pitch deck for MyLife in the Cool Obsidian design
system you just absorbed. The output should be a self-contained presentation
exportable to PDF and PPTX.

Audience: aligned individual angel investors and mission-driven funds (Obvious
Ventures, Collab Fund, Kapor Capital, Omidyar Network type). They have read our
manifesto already and are pre-qualified on values fit.

Tone: confident, specific, plainspoken. Numbers over adjectives. No em dashes.

Slide content follows. Each slide should occupy a single landscape 16:9 page.
Use generous whitespace. Reserve the warm orange accent (#FFB877) for headlines
and one bold callout per slide; use cool blue (#8BCFF0) for secondary emphasis.

SLIDE 1 -- TITLE + TAGLINE
- Headline: MyLife
- Sub-headline: Thirty privacy-first lifestyle apps. One $12/year subscription. Forever.
- Footer: Trey Shuldberg · 2026
- Visual: Dark Cool Obsidian background. Bold MyLife wordmark centered. Subtle module icons floating in periphery at 15% opacity. Single accent color: warm orange #FFB877.

SLIDE 2 -- THE PROBLEM
- Headline: People are paying $500+ a year for a lifestyle stack that watches them.
- Body: Calm $70 · Strava $80 · YNAB $109 · MyFitnessPal $80 · Flo $50 · Day One $100 · Paprika $5 · Stylebook $4 · Planta $36 · Habitify $40 · Readwise $96. Average user pays $500-700/year across 6-10 lifestyle apps. Each app sells, leaks, or shares data to ad networks. Industry trust crisis: Flo FTC settlement (2021), Mint shutdown (2024), Headspace 20% price hike (2025).
- Visual: Grid of 11 competitor app icons with their annual prices in white. Total at bottom in red: $755/year.

SLIDE 3 -- THE MISSION
- Headline: We are building this to be uncopyable.
- Body: Public Benefit Corp structure. $12/year price-locked in bylaws. Founder supermajority shares. Six written promises: never sell data, never raise prices on existing users, never run ads, never use dark patterns, never sell to private equity, never break the manifesto. Pursuing B Corp certification within 12 months.
- Visual: Six icons in a 3x2 grid, each representing a "never" promise with crossed-out symbols.

SLIDE 4 -- THE PRODUCT
- Headline: Thirty modules. One app. One subscription.
- Body: 30 modules listed. Free forever: fast, journal, mood, notes, voice. 26 of 30 modules are local-first (zero per-user infrastructure cost). 28 wired on iOS/Android, 19 on web. One unified design system (Cool Obsidian dark theme).
- Visual: Phone frame mockup showing dashboard with 30 module icons in a grid.

SLIDE 5 -- WHY NOW
- Headline: This is the first year this could be built.
- Body: AI compresses solo-founder production 10x. Cultural readiness peaks now (Cambridge Analytica 2018, Flo 2021, Mint 2024, Dobbs 2022). Algorithmic virality is mature (TikTok/Reels/Shorts). Creator economy is aligned (200+ privacy creators). Subscription bundle fatigue at all-time high (67% want consolidation).
- Visual: Timeline with five labeled inflection points 2018-2026, final marker: "MyLife -- 2026."

SLIDE 6 -- TRACTION
- Headline: Built. Tested. Funded by users.
- Body: 30 modules shipped (28 mobile, 19 web), 18-month solo build. TestFlight: 118 active testers, NPS 64. Test coverage: 306 web + 118 mobile tests passing. [Kickstarter, pre-launch list, press, GitHub stars to be inserted post-launch.]
- Visual: Four large stat tiles on dark background. Each stat in 80pt orange numerals.

SLIDE 7 -- BUSINESS MODEL
- Headline: $12/year that compounds, not extracts.
- Body: $1.49/mo or $12/yr. Free tier (5 modules). Family plan ($24/yr, 4 accounts). Lifetime Pass ($89-149). Unit economics: $10.88 net ARPU, 18-22% conversion, 78% retention, $49 LTV. Why it works: local-first = $0 marginal infra, solo build = no sunk dev cost, mission positioning = organic growth engine. Why incumbents can't match: $300-2000 paid CAC per sub.
- Visual: Side-by-side. Left: eleven competitor logos summing to $755. Right: MyLife logo with $12. Conclusion: 63x value.

SLIDE 8 -- COMPETITION + MOAT
- Headline: No competitor covers more than 2 of our 30 modules.
- Body: Calm/Headspace $558M (mood only); Flo $275M (cycle only); Strava $415M (workouts only); MyFitnessPal $42M (nutrition only); Notion $500M ARR (notes only); YNAB/Monarch $85M (budget only); Duolingo $748M (learning only). TAM: $77B. Five moats: price-as-moat, data locality, cross-module flywheel, mission lock, 30-module breadth.
- Visual: Quadrant chart. X: modules covered. Y: privacy orientation. Competitors clustered bottom-left. MyLife alone top-right.

SLIDE 9 -- GROWTH STRATEGY
- Headline: Organic by design. Not by accident.
- Body: Founder-led AI-amplified content. Press cycle leverage (4-6 placements/yr). Aligned creator partnerships (200-target list). Subreddit/Mastodon community. Lifetime gifting virality. ASO across 30 module-specific terms. In-product community (Forums). Open-source halo (encryption engine).
- Visual: Eight rounded squares with icon + one-line strategy, connected by light lines.

SLIDE 10 -- 8-YEAR FINANCIAL PROJECTION
- Headline: A decade-long compounding institution, profitable from year 4.
- Body table: Y1: 80K installs / 8K paid / $85K. Y2: 400K / 55K / $600K. Y3: 1.5M / 250K / $2.7M. Y4: 4M / 800K / $8.7M. Y5: 10M / 2.3M / $25M. Y6: 22M / 5.5M / $60M. Y7: 40M / 10M / $109M. Y8: 60M / 15M / $163M. Assumes $12/yr, organic-only, 78% retention, 80% gross margin at scale.
- Visual: Line graph with paid subs (orange) and ARR (blue) over 8 years. Shaded confidence band. Bold Y4 marker: "Cash-flow positive."

SLIDE 11 -- USE OF FUNDS + MILESTONES
- Headline: $1.1-1.6M total raise. 18 months. Specific milestones.
- Sources: Kickstarter $150-500K (Month 5). Angel round $500-750K (Months 6-11). Grants $150-400K (rolling). Revenue-based financing $200-500K (Months 14-16). Use: 35% engineering, 25% marketing/growth, 15% cloud infra, 10% legal/compliance, 10% design/brand, 5% reserve. Milestones: M+5 Kickstarter funded, M+11 angel closed, M+12 public launch, M+15 1M installs, M+18 2M installs + $80K MRR.
- Visual: Pie chart left (use of funds). Vertical timeline right (4 funding sources stacked).

SLIDE 12 -- ASK + TEAM + TERMS
- Headline: Aligned capital. Patient horizon. Founder-controlled forever.
- Body: Ask: $500-750K angel round. Instrument: Post-money SAFE, $6-9M cap, PBC mission-lock side letter. Founder: Trey Shuldberg, solo builder, 18 months to ship 30 modules. Team plan: 2 engineering hires Y1, 1 community manager Y1, 1 designer Y2. Return profile: 3-5x patient capital over 7-10 years. Not a unicorn play.
- Visual: Founder photo placeholder (large, warm). Headline quote in pull-out style. Contact info bottom.

Additional requirements:
- Slide 1 should be the most visually striking; treat it like a movie poster
- Slide 4 should draw a clean wireframe of an iPhone showing a 6-icon dashboard
- Slide 8 quadrant chart should plot the named competitors
- Slide 10 line graph should use tabular numerals and a shaded confidence band
- Slide 11 pie chart and timeline should sit side-by-side
- Slide 12 should feel warm and human, not corporate

Generate the deck. Then share the URL and PPTX export link.
```

**After it generates:** Click any slide to add inline comments for refinements. Then export:
- Click **Export** (upper right) > **PPTX** for presentations
- Click **Export** > **PDF** for email attachments

---

### Prompt 2 -- 1-Page Investor Brief

Start a **new message** in the same project (the design system carries over):

```
Generate a 1-page investor brief PDF for MyLife in the Cool Obsidian design
system. US Letter size, two-column layout, single page (it MUST fit on one
page), 11-12pt body type with 1.4 line height.

Use a small founder headshot in the top right corner (placeholder circle with
"TS" initials for now; I'll swap in the real image).

Use the warm orange accent (#FFB877) for the brand wordmark and one section
heading style. Use a single accent rule (1pt warm orange) under the wordmark.

A QR code bottom right links to the manifesto page (use a placeholder QR
code for now).

Content follows -- render exactly as written, preserving paragraph structure
and bold emphasis:

# MyLife
## Thirty privacy-first lifestyle apps. One $12/year subscription. Forever.

**The problem.** The average engaged adult pays $500-700/year for 6-10 lifestyle subscription apps (Calm, Strava, MyFitnessPal, YNAB, Day One, Flo, etc). Each app sells, leaks, or shares personal data. Industry trust is in crisis: Flo FTC settlement (2021), Mint shutdown (2024), Headspace's 20% price hikes (2025). Subscription fatigue is at an all-time high.

**The solution.** MyLife is a single cross-platform app (iOS, Android, web) that consolidates 30 privacy-first modules for $12/year. Five modules free forever. Locked at $12/year for life, written into corporate bylaws.

**The mission lock.** Delaware Public Benefit Corporation. Founder supermajority shares. Six written promises: never sell data, never raise prices on existing users, never run ads, never use dark patterns, never sell to private equity, never take capital that requires breaking the manifesto. B Corp certification in progress.

**Why $12/year works.** 26 of 30 modules are local-first (zero per-user infra cost). Solo founder + AI = no team overhead. Organic-only acquisition means no $30 install cost. Net ARPU $10.88 after store fees. LTV $49. 78% annual retention. 18-22% paid conversion. Incumbents cannot match: their $300-2000 paid CAC structurally requires $70+ pricing.

**Traction.** 30 modules built solo in 18 months. 28 on mobile, 19 on web. 306 web + 118 mobile tests passing. TestFlight: 118 active testers, NPS 64.

**Market.** $77B global TAM across 8 verticals. No competitor covers more than 2 of our 30 modules.

**Growth strategy.** 100% organic. Founder-led AI-amplified content. Aligned creator program. Press cycle leverage. Lifetime gifting. Open-source encryption engine.

**8-year projection.** Y1: 80K / $85K. Y3: 1.5M / $2.7M. Y5: 10M / $25M. Y8: 60M installs / 15M paid / $163M ARR. Profitable from Y4. EBITDA 39% at scale.

**Capital ask.** $500-750K aligned angel round on post-money SAFE, $6-9M cap, plus PBC mission-lock side letter. Total stack: $1.1-1.6M over 18 months. ~7-10% dilution. Patient capital. 3-5x over 7-10 years.

**Founder.** Trey Shuldberg · [email] · [website]

Additional requirements:
- The financial projection should be inline comma-separated (not a table)
- Bold the main subhead
- The "Why $12/year works" bullets should be a tight bullet list
- Export as PDF with embedded fonts
```

**Export:** Click **Export** > **PDF**

---

### Prompt 3 -- Manifesto Page Layout

New message in the same project:

```
Generate a single-page web layout mockup for MyLife's public manifesto page,
which will live at the /values route.

Audience: prospective users, investors, employees, and journalists.

Tone: serious, confident, intimate. This is a values document, not marketing.

Design direction:
- Single-column, generous left/right margins (60% max width on desktop)
- Body text Inter 18-19pt with 1.6 line-height for readability
- Warm orange accent (#FFB877) only for the "what we will never do" section
- Headings sentence-case, not title-case
- Founder photo placeholder and signature at the bottom
- Last-updated date and version number at the very bottom
- Small footer linking to: open-source repo, security architecture doc, PBC
  certificate, B Corp progress

Content follows -- render exactly:

# What we believe.

You are reading this because you want to know what kind of company we are. Here it is, in writing, so you can hold us to it.

## The problem we exist to solve

You wake up and you have eleven apps watching you. They count your steps, track your cycle, log your meals, score your sleep, archive your journals, and price your insurance. Every one of them was free or cheap when you signed up. Every one of them is now selling pieces of you to a pipeline you can't see.

You pay for some of them. Calm wants $70. Strava wants $80. Flo wants $50. MyFitnessPal wants $80. YNAB wants $109. Day One wants $100. Together your lifestyle subscription stack costs you somewhere north of five hundred dollars a year, and that number rises every twelve months because the people who own these apps need it to.

This is not normal. This is the specific shape that consumer software took when it was financed by people who needed prices to keep going up. It is not the only shape it could take. We are building a different one.

## What MyLife is

MyLife is thirty applications you would otherwise be paying for, in one app, on every device you own, for twelve dollars a year, forever.

## What we will never do

1. We will never sell, share, or aggregate your personal data.
2. We will never raise the price for existing subscribers.
3. We will never run advertising in this app.
4. We will never use dark patterns to keep you subscribed.
5. We will never sell this company to private equity, an ad-tech firm, or a data broker.
6. We will never take venture capital that requires us to break these promises.

## How we make money

We charge twelve dollars a year for full access to all thirty modules.

## How we are structured

We are incorporated as a Delaware Public Benefit Corporation.

## What we are asking you to trust

We are asking you to put your most personal data into one app. We know what we are asking.

## Who we are building this for

People who are tired of being the product.

-- Trey Shuldberg, April 2026

Requirements:
- The "What we will never do" list should be visually distinct (boxed, numbered,
  heavier weight) to signal "this is the binding part"
- Add subtle anchor links from a small TOC sidebar on desktop, hidden on mobile
- Mobile layout collapses to single column with proportional padding
- Export as standalone HTML file
```

**Export:** Click **Export** > **HTML** to get a drop-in file for your static site

---

### Prompt 4 -- Kickstarter Hero Assets

New message:

```
Generate three Kickstarter campaign visual assets for MyLife in the Cool
Obsidian design system:

1. CAMPAIGN HEADER IMAGE -- 1024x576 (Kickstarter required ratio)
   - Centered MyLife wordmark with thirty module icons floating in a halo
   - Tagline: "Thirty privacy-first apps. One subscription. One dollar a
     month. Forever."
   - Dark background (#131318)
   - Warm orange accent on the wordmark only

2. REWARD TIER GRAPHIC -- 1200x800
   - Six tiers as a vertical stack of cards:
     "Hello" $15 · "Five Years" $49 · "Lifetime Pass" $89 ·
     "Lifetime + Family" $149 · "Founder's Circle" $499 ·
     "Forever Backer" $2,500
   - Each card uses a subtly different surface elevation
   - Warm orange accent on the Lifetime Pass card

3. STRETCH GOALS GRAPHIC -- 1200x600
   - Horizontal milestone bar with four goals:
     $100K (community manager) · $250K (open-source sync engine) ·
     $500K (Android engineer) · $1M (third-party security audit)
   - Cool blue accent (#8BCFF0) for the milestone markers

Export each as PNG.
```

---

### Prompt 5 -- 8-Year Projection Chart

New message:

```
Generate a single high-resolution chart visualizing MyLife's 8-year financial
projection.

Two stacked y-axes:
- Left axis: cumulative paid subscribers (0 to 15M)
- Right axis: net annual recurring revenue ($0 to $170M)
- X axis: Year 1 through Year 8

Line 1: Paid subs in warm orange (#FFB877), thicker stroke
Line 2: Net ARR in cool blue (#8BCFF0), thinner stroke

Data points:
Y1: 8K subs, $85K ARR
Y2: 55K subs, $600K ARR
Y3: 250K subs, $2.7M ARR
Y4: 800K subs, $8.7M ARR (mark: "Cash-flow positive")
Y5: 2.3M subs, $25M ARR
Y6: 5.5M subs, $60M ARR
Y7: 10M subs, $109M ARR
Y8: 15M subs, $163M ARR

Background: #131318
Grid lines: rgba(255,255,255,0.06)
Axis labels: tabular figures, #D6C3B5, 11pt
Title: "Eight years. Organic-only. Mission-locked."
Subtitle: "MyLife base-case projection at $12/year, no paid acquisition."

Mark Y4 with a vertical dashed line and "Cash-flow positive" label in orange.

Export as SVG and 2400x1600 PNG.
```

---

## Part 3: Iteration Tips

Once Claude generates a first version, you can refine:

- **Click any element on the canvas** to leave an inline comment ("make this bolder", "shift down 8pt", "change this to cool blue")
- **Ask in chat** for broad changes ("make all slides darker", "increase whitespace throughout")
- **Say "Show 2-3 alternative layouts"** when you're unsure about a direction
- **Say "Save what we have and try a completely different approach"** to preserve the current version while exploring new directions
- **Generate slides one at a time** if quality is uneven on bulk generation. Do bulk first, then iterate slide-by-slide.

## Part 4: Exporting Everything

When you're happy with each asset:

| Asset | Export as | How |
|-------|----------|-----|
| 12-slide deck | PPTX + PDF | Export button (upper right) > PPTX, then again > PDF |
| 1-page brief | PDF | Export > PDF |
| Manifesto page | HTML | Export > HTML (drop into your static site) |
| Kickstarter assets | PNG | Export > Download as .zip (contains PNGs) |
| Projection chart | SVG + PNG | Export > Download as .zip |

To send to **Canva** for final hand-tuning: Export > Send to Canva.

## Part 5: After Export

- Save the Claude Design **project URL** -- it persists, so you can come back to update content as numbers evolve (post-Kickstarter actuals, press hits, etc.)
- All exported assets should go into `docs/plans/investor-pitch/assets/` in the repo
- Update `live-metrics.md` with any numbers that change

---

## Quick Reference

| Step | What to do |
|------|-----------|
| 1 | Go to [claude.ai/design](https://claude.ai/design) |
| 2 | Create project "MyLife Investor Assets" |
| 3 | Paste Prompt 0 (brand context block) |
| 4 | Wait for confirmation |
| 5 | Paste Prompt 1 (12-slide deck) |
| 6 | Iterate with inline comments |
| 7 | Export as PPTX + PDF |
| 8 | Paste Prompt 2 (1-page brief), export PDF |
| 9 | Paste Prompt 3 (manifesto layout), export HTML |
| 10 | Paste Prompt 4 (Kickstarter assets), export PNGs |
| 11 | Paste Prompt 5 (projection chart), export SVG + PNG |

Sources:
- [Get started with Claude Design](https://support.claude.com/en/articles/14604416-get-started-with-claude-design)
- [Set up your design system](https://support.claude.com/en/articles/14604397-set-up-your-design-system-in-claude-design)
- [Introducing Claude Design](https://www.anthropic.com/news/claude-design-anthropic-labs)
