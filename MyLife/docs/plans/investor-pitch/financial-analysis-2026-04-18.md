# MyLife — Financial Analysis & Investor Projection
**Date:** 2026-04-18
**Stage:** Pre-seed / Seed
**Ask:** $3.0M on a $15M post-money SAFE (cap)
**Use:** finish production ship, 18-month runway, launch marketing

---

## 1. Executive Summary

MyLife is a single cross-platform app (iOS, Android, Web) that consolidates **30 privacy-first personal software modules** — mood, health, meds, workouts, nutrition, recipes, budget, habits, books, flashcards, forums, garden, closet, car, pets, homes, notes, journal, voice, words, cycle, fast, trails, surf, stars, presence, mail, market, RSVP, and more — behind a radically simple **$5/year subscription**. Users replace a stack of $200-600/year in single-purpose apps with a single $5/year suite — a price that makes MyLife effectively uncopyable at parity and structurally moats the product from every single-vertical incumbent.

The product is substantially complete: 30 module IDs registered, 28 full modules wired on mobile, 19 on web, TestFlight verified with 306 web + 118 mobile tests green as of 2026-03-25. Phases 1-4 of production-release readiness are done. The remaining work is user acquisition, polish, native GPS/wake-lock integration on mobile, and go-to-market.

The markets we touch collectively represent **over $60B in annual consumer software spend today** growing at 15-20% CAGR. Every single module has a proven $100M-$3B competitor, and in several categories (period tracking, meditation, budgeting, outdoors) there are unicorns that monetize a narrow slice of what MyLife covers.

**The $5/year thesis:** by pricing at 1/15th the industry median, we convert at 5-10x the industry-median conversion rate and never lose a user to price. This is a volume-and-moat play, not a premium-per-user play. The analogue is not Calm or Headspace — it is how Duolingo, Spotify Family, and Amazon Prime used price as a defensive weapon.

**Base-case 5-year projection:** 40M installs → 12M paying subs → **$51M ARR** by year 5 at a 55-60% gross margin. **Bull case:** $140M ARR on 30M paid users. **Bear case:** $12M ARR on 3M paid users. All three cases return capital at seed-stage valuations; the bull and base cases produce category-defining distribution that is acquirer-attractive independent of ARR.

---

## 2. Product and Market Position

### The 30-Module Portfolio

| # | Module | Market | Storage | Status |
|---|--------|--------|---------|--------|
| 1 | Books | Reading/Goodreads | SQLite | Hub canonical |
| 2 | Budget | Personal finance | SQLite | Hub canonical |
| 3 | Car | Vehicle mgmt | SQLite | Active standalone |
| 4 | Closet | Wardrobe/packing | SQLite | Shipped |
| 5 | Cycle | Period/fertility | SQLite | Prediction engine complete |
| 6 | Fast | Intermittent fasting (FREE) | SQLite | Shipped |
| 7 | Flash | Spaced repetition | SQLite | Shipped |
| 8 | Forums | Community | Supabase | Shipped |
| 9 | Garden | Plant care | SQLite | Shipped |
| 10 | Habits | Habit tracking | SQLite | Shipped |
| 11 | Health | Health tracking | SQLite | Shipped |
| 12 | Homes | Home mgmt | Drizzle+tRPC | Active standalone |
| 13 | Journal | Journaling (FREE) | SQLite | Encryption engine |
| 14 | Mail | Email triage | SQLite | Shipped |
| 15 | Market | P2P marketplace | Supabase | Shipped |
| 16 | Meds | Medication | SQLite | 302 tests, shipped |
| 17 | Mood | Mood tracking (FREE) | SQLite | Shipped |
| 18 | Notes | Notes (FREE) | SQLite | Markdown engine |
| 19 | Nutrition | Food logging | SQLite | Shipped |
| 20 | Pets | Pet tracking | SQLite | Shipped |
| 21 | Presence | Digital wellness | SQLite | Shipped |
| 22 | Recipes | Recipes | SQLite | Hub canonical |
| 23 | RSVP | Event invites | SQLite | Shipped |
| 24 | Stars | Astrology | SQLite | Astro engine |
| 25 | Subs | Subscription mgmt | SQLite | Merged into budget |
| 26 | Surf | Surf forecast | Supabase | Consolidated |
| 27 | Trails | Hiking/GPS | SQLite | Geo engine |
| 28 | Voice | Voice notes (FREE) | SQLite | Shipped |
| 29 | Words | Vocabulary | SQLite | Shipped |
| 30 | Workouts | Fitness | Supabase | Hub canonical |

### Strategic Positioning

- **Privacy-first, local-first.** Zero analytics, zero telemetry, SQLite on-device for 26 of 30 modules. That is a defensible wedge against Flo (leaks), MyFitnessPal (Under Armour breach), and the Meta/Google ecosystem.
- **Price-as-moat.** $5/year is below the psychological threshold at which consumers deliberate. No competitor can match our price without dismantling their own $60-100/year revenue base. This is Jeff Bezos' "your margin is my opportunity" applied to consumer lifestyle apps.
- **Suite economics.** The average engaged user today pays for 2-4 lifestyle apps at $180/year. MyLife collapses 8-10 of them into one subscription at **2.8% of the stack cost**, making the decision trivial.
- **Cross-module data flywheel.** Workouts feeding nutrition, mood feeding habits, meds feeding health - none of the incumbents can ship this because they are single-vertical.
- **Category-agnostic growth.** Any one module going viral (as Partiful did for RSVP) pulls users into the full bundle.

---

## 3. Market Sizing — Top-Down TAM/SAM/SOM

### Category TAM (2024-2025 hard market data)

| Market Vertical | TAM (global) | CAGR | Source note |
|-----------------|--------------|------|-------------|
| Wellness/Meditation apps | **$11.3B (2024)** → $26.2B (2030) | 14.9% | Grand View Research 2025 |
| Personal finance apps | **$31.7B (2025)** → $173B (2035) | 20.8% | Business Research Insights 2025 |
| Fitness apps | **$13.6B (2024)** → $25.8B (2030) | 12% | Yahoo Finance / BRI 2025 |
| Recipe & meal-planning apps | **$5.8B (2024)** → $14.3B (2033) | 10.5% | Straits Research |
| Habit tracking apps | **$1.7B (2024)** → $5.5B (2033) | 14.2% | Global Growth Insights |
| Period/fertility tracking | **$2.1B (2024)** → $5.4B (2030) | 16.9% | Estimated |
| Pet care apps | **$1.8B (2024)** → $4.5B (2030) | 14% | Estimated |
| Journaling/notes (consumer) | **$3.2B (2024)** → $7.1B (2030) | 13.2% | Estimated |
| Learning/flashcards (consumer) | **$4.4B (2024)** → $11.2B (2030) | 14.8% | Inferred from Duolingo + Quizlet |
| Home/auto/garden vertical apps | **$2.2B (2024)** → $5.0B (2030) | 12% | Estimated |
| **Total TAM (MyLife footprint)** | **~$77B (2025)** → **$200B (2033)** | ~15% blended | |

### SAM — The MyLife Beachhead

Not every health-app spender will consolidate into a suite. Our SAM is **adults 22-55 who currently pay for 2+ lifestyle subscriptions and value privacy**. Triangulation:

- App Annie/Sensor Tower consumer subscription studies: **~180M US adults** use at least one subscription app; roughly **40-50M** pay for 2+ lifestyle apps (Headspace + MyFitnessPal, YNAB + Calm, etc.)
- Globally the figure scales to **~250M multi-app subscribers** (US, UK, EU, Canada, Australia, Japan, Nordics).
- Average wallet per multi-app user: **$180/year** across lifestyle categories.
- **SAM = 250M × $180 = $45B** of reachable, willing-to-pay consumer spend.

### SOM — Realistic 5-Year Capture (at $5/year pricing)

At $5/year, the capture dynamics change from "margin per user" to "percentage of SAM users willing to pay any price." Reference data:

- Duolingo Super converts 5% of its 100M MAU base at $84/yr (massive price). At $5 they would easily hit 25%.
- Partiful has 500K MAU with zero paid conversion yet. At $5 across all 30 modules, adoption friction collapses.
- StoryGraph has 3M MAU, ~5% paid at $50/yr. At $5 they'd convert 20%+.
- At $5 the decision is "do I value any of this at all?" rather than "is this worth $80?"

**MyLife base-case SOM:** capture **0.8% of 250M multi-app SAM by Y5** = 2M users if we keep premium-app benchmarks. But $5 pricing is disruptive: we're modeling **4.8% of SAM = 12M paid subs × $4.25 net = $51M ARR**. The implied install base is ~40M (30% free-to-paid conversion at the price point).

**Bull case at 12% of SAM** = 30M paid = $128M ARR. Duolingo-like distribution.
**Bear case at 1.2% of SAM** = 3M paid = $13M ARR. Still acquirer-attractive for user-base acquisition.

---

## 4. Deep Competitive Financial Landscape

For each module market, I profiled the dominant public or private player plus 2 challenger/reference companies. All figures are the most recent publicly available (2023-2026) and are sourced from Business of Apps, Sacra, Crunchbase, PitchBook, CB Insights, Latka, and official investor relations releases.

### 4.1 Meditation / Mindfulness (Mood, Journal, Voice, Presence modules)

| Company | Revenue | Paid Subs | Valuation | Funding Raised | ARPU (paid) |
|---------|---------|-----------|-----------|---------------|-------------|
| **Calm** | $210M (2025) | 3.5M | $2.0B (2024) | $218M | $60/yr |
| **Headspace Health** | $348M (2024) | 2.0M consumer + enterprise | $3.0B (2024) | $215M | ~$174/yr (incl. B2B) |
| **Otter.ai** (voice) | $100M ARR (Mar 2025) | ~1.5M paid est | est $800M | $70M | $67/yr |
| **Day One** (journal) | est $8-12M | est 80-120K paid | Part of Automattic | Acquired 2021 | $49.99-$99/yr |
| **Co-Star** (presence adj.) | est $10M | 30M+ registered | Undisclosed | $6M | Freemium |

**Takeaway:** Calm + Headspace alone generated **$558M in a single vertical** (mindfulness) in 2024-2025 from what is effectively a guided-audio subscription. MyLife's journal, mood, voice, and presence modules collectively target the same jobs-to-be-done with wider coverage.

### 4.2 Physical Health (Health, Meds, Cycle, Fast, Habits modules)

| Company | Revenue | Paid Subs / Users | Valuation | Funding Raised | Notes |
|---------|---------|-------------------|-----------|---------------|-------|
| **Flo Health** | $275M (2025) | 77M MAU / ~5M paid | $1.0B+ (2024) | $280M | Largest period tracker |
| **Noom** | $1.0B ARR (2023) | 1.5M paid at $17-70/mo | $3.66B (2021) | $657M | GLP-1 pivot 2024 |
| **Oura** | $1.0B (2025) | 2M paid + 1.3M rings | $11B (Oct 2025) | $1.4B | Hardware + sub |
| **Clue** | ~$30M est | 12M MAU / ~400K paid | est $200M | $60M | #2 period tracker |
| **Zero (by LifeSum)** | ~$20M est | 700K paid est | Acquired by LifeSum | Undisclosed | Fasting leader |
| **Medisafe** | ~$25M est | 10M+ downloads | Undisclosed | $50M | Medication leader |
| **Habitify/Habitica/Streaks** | $1-10M each | Small subs | Private | Bootstrapped | Fragmented |

**Takeaway:** The health cluster alone (period + fasting + meds + habit) exceeds **$1.5B in annual revenue** across these players. MyLife covers all four markets with a single subscription.

### 4.3 Fitness / Outdoor (Workouts, Trails, Surf, Stars modules)

| Company | Revenue | Users / Paid | Valuation | Funding Raised | ARPU (paid) |
|---------|---------|--------------|-----------|---------------|-------------|
| **Strava** | $415M (2025) | 180M reg / ~8M paid | $2.2B (May 2025) | ~$250M | $80/yr |
| **AllTrails** | $38M (2023, est $80M+ 2025) | 60M reg / ~1M paid | ~$500M (2021) | $232M | $35.99/yr |
| **Strong (workouts)** | est $20M | 20M installs / 500K paid | Private | Bootstrapped | $30-50/yr |
| **Surfline / MagicSeaweed** | ~$35M (incl $10M+ sub) | 1.5M+ MAU / ~180K paid | est $120M | Spectrum Equity-backed | $99.99/yr |
| **Co-Star (astrology)** | ~$10M | 30M+ registered | est $100M | $6M | Freemium |

**Takeaway:** Strava alone generates 10x more revenue than Calm did in 2017. Single-vertical outdoor apps are durable.

### 4.4 Nutrition & Food (Recipes, Nutrition, Market modules)

| Company | Revenue | Users / Paid | Valuation | Notes |
|---------|---------|--------------|-----------|-------|
| **MyFitnessPal** | $42.4M (recent) rising | 150M+ installs / ~4M paid | $345M (Francisco Partners, 2020) | Pivoted to hard paywall |
| **Paprika** | est $8-15M | 2M+ paid lifetime | Private | $4.99 one-time, bootstrapped |
| **Cronometer** | est $15M | 7M+ installs | Private | Premium tier $60/yr |
| **Yummly** (RIP) | — | — | $100M (Whirlpool 2017, shut Dec 2024) | Cautionary tale: mass consumer without retention |

**Takeaway:** MyFitnessPal's $345M exit came off a much smaller revenue base than Calm. The food category has consolidation room and poor incumbent UX.

### 4.5 Personal Finance (Budget, Subs modules)

| Company | Revenue | Paid Subs | Valuation | Funding | ARPU |
|---------|---------|-----------|-----------|---------|------|
| **Rocket Money (Truebill)** | $80M+ (2024) | 4.1M premium | Acquired by Rocket Companies $1.275B (2021) | $85M pre-acq | $48/yr |
| **YNAB** | est $45-60M | ~400K paid | Bootstrapped profitable | None | $109/yr |
| **Monarch Money** | est $35M ARR (2025) | ~400K paid est | $850M (May 2025) | $95.5M | $99.99/yr |
| **Copilot Money** | est $6M ARR | ~120K paid est | est $75M | $10.8M | $95/yr |

**Takeaway:** Mint's 2024 shutdown created a $400M+ revenue vacuum that Rocket Money, Monarch, Copilot, and YNAB are still filling. MyLife's budget module is price-competitive and bundles subscription tracking (what used to be a standalone $35/yr Rocket Premium offering) for free.

### 4.6 Learning & Knowledge (Books, Words, Flash modules)

| Company | Revenue | Paid | Valuation | Notes |
|---------|---------|------|-----------|-------|
| **Duolingo** (NASDAQ: DUOL) | $748M TTM (Q3 2025) | 9.5M paid | $9.5B mcap | Flashcard + SRS leader |
| **Quizlet** | $139M (2025) | ~1.5M paid | $1.0B | Has flirted with layoffs |
| **Readwise** | est $12M | 60K paid | Bootstrapped | $8/mo kindle + web highlights |
| **Goodreads** | Part of Amazon | 150M reg | — | Zero innovation, ripe for displacement |
| **StoryGraph** | est $3M | 100K paid | Bootstrapped | Goodreads replacement, organic growth |

**Takeaway:** Goodreads is the single most strategically weak incumbent on this list. It has made no material product improvement in a decade. StoryGraph grew organically to 3M MAU with zero funding.

### 4.7 Home / Lifestyle (Homes, Car, Closet, Pets, Garden modules)

| Company | Revenue | Users / Paid | Valuation | Notes |
|---------|---------|--------------|-----------|-------|
| **Rover** (Blackstone) | $244M (2024) | ~4M users | $2.3B acq (2023) | Pet care marketplace leader |
| **Planta** | est $10-15M | 7M users / ~200K paid | Private | Plant care leader |
| **Stylebook** | $1.4M | 280K MAU | Bootstrapped | Wardrobe leader |
| **CARFAX Car Care** | Part of $1.8B S&P Global seg | 50M users (free) | — | Free loss leader for data |
| **HomeZada** | est $4-6M | 100K paid | Private | Home mgmt leader |

**Takeaway:** These are fragmented, mostly subscale markets. No competitor has all five; most of them sit at $5-50M revenue individually and are acquisition targets.

### 4.8 Productivity / Organization (Notes, Mail, RSVP, Stars, Forums modules)

| Company | Revenue | Paid | Valuation | Notes |
|---------|---------|------|-----------|-------|
| **Notion** | $500M ARR (Sep 2025) | 4M paid / 100M reg | $11B (Jan 2026) | Largest |
| **Superhuman** (email) | $100M+ ARR est | 250K paid | Acquired Grammarly 2025 | Premium mail |
| **Partiful** (RSVP) | est $5-8M | 500K MAU (Q1 2025), mostly free | $120M pre-money | Viral RSVP, monetization early |
| **Co-Star** (astrology) | $10M | 30M reg | $100M est | Content-driven |
| **Reddit** (forums comp) | $1.3B (2024) | 800M MAU / 9M paid | $11B IPO 2024 | Largest community platform |

### 4.9 Category Summary

Across the 8 verticals, the **top 3 competitors per market collectively produce over $10B in annual revenue**. Importantly:

- **No single competitor covers more than 2 of MyLife's 30 modules.** Oura + Noom is the closest overlap (health + coaching), still representing only 3 modules.
- **Average multi-app user spends $180/year on 3-4 lifestyle apps.** MyLife's $79.99/year bundle is a 55% discount.
- **All of the unicorns above exceed MyLife's total SOM target** in individual vertical revenue. The bar to clear is very modest on a relative basis.

---

## 5. Unit Economics Benchmarks

### Industry Benchmarks vs MyLife $5/yr Model

The $5/year price is so far below category norms that the usual benchmarks (which assume $60-120/yr pricing) don't apply cleanly. We model below using both the industry baseline and MyLife's inverted target.

| Metric | Category Median | Top-quartile | **MyLife Target @ $5/yr** | Reasoning |
|--------|----------------|--------------|---------------------------|-----------|
| Install → Free conversion | 90%+ | 95% | **97%** | Almost no friction |
| Free → Paid conversion | 2.18% | 6-8% | **25%** | Price removes deliberation |
| Trial → Paid conversion | 38% | 55%+ | **n/a** | No trial — buy outright at $5 |
| Monthly churn | 6.5% | 3.5% | **1.5%** | Churn is price-sensitive; $5 ≈ un-churnable |
| Annual retention | 38% | 62% | **82%** | Mirrors Amazon Prime ($139), Apple One ($144) |
| Net ARPU per paid sub | — | — | **$4.25/yr** | $5.00 list − 15% store fee |
| Blended ARPU (all installs) | $8.41/yr | $31.12/yr | **$1.28/yr** | Low price × high conversion |
| Paid-user LTV | $85 | $180 | **$24-28** | $4.25 × ~6 yrs avg life |
| CAC (acceptable) | $22-45 | $8-18 | **< $6 blended** | LTV:CAC ≥ 3x at $24 LTV |
| LTV:CAC target | 3x | 8x+ | **4-5x** | Achievable because growth is organic-first |
| iOS revenue share | 67%+ | 80%+ | **65%** | Lower iOS skew because price destroys iOS premium |
| Refund / chargeback rate | 2% | 1% | **< 0.5%** | $5 is below the threshold where people file refunds |

### Why These Targets Are Credible

1. **25% free → paid conversion is not fantasy at $5.** RevenueCat's 2025 State of Subs data shows that low-ASP "tip jar" subscriptions in utility categories (weather apps, meditation mini-subs, tipping-style apps) regularly convert 15-30%. Overcast ($10/yr), Carrot Weather ($5/yr tier), Duolingo Max single-feature tiers are all proof.
2. **82% annual retention is credible at $5.** At this price, the cancel-decision almost never crosses the user's mind. The only meaningful churn vector is payment-method-expiration involuntary churn (~15% of annual subs), not voluntary churn. Apple One sits at 85-90% retention; YNAB at 70%+; Amazon Prime at ~93%.
3. **CAC under $6 forces organic-first growth.** This is a feature, not a bug. AllTrails built to 60M users on near-zero paid CAC by being the best-reviewed app in its category. Partiful hit 500K MAU with $3-5 CAC via Gen Z virality. Our strategy:
   - 70% organic (ASO, PR, creator-led, "privacy-first" positioning, word-of-mouth around "10 apps for $5")
   - 20% ambassador/affiliate (10%-30% rev share on $5 = 50¢-$1.50, sustainable)
   - 10% paid experiments (TikTok/Reels ads at $2-4 installs, only where conversion math works)
4. **LTV of $24-28 per paid user is low, but this is a volume business.** 12M paid users × $24 LTV = $288M total subscription LTV — comparable to the total lifetime revenue any of our $100-500M exit comps have generated.

### The "$5 Moat" in One Sentence

A competitor looking at MyLife cannot ship a $5/yr counter-offer without nuking their $60-100/yr cash cow. The pricing decision is therefore self-reinforcing: the longer we hold $5, the more expensive it becomes for incumbents to respond.

---

## 6. Pricing Strategy

### The $5/Year Flat Bundle

| Plan | Price | What it unlocks |
|------|-------|-----------------|
| **Free** | $0 | 5 modules: fast, journal, mood, notes, voice |
| **MyLife Pro** | **$5 / year** | All 30 modules, all devices, unlimited |
| **MyLife Family** *(optional future)* | **$12 / year** | Up to 4 users, all modules |
| **MyLife Lifetime** *(optional future)* | **$25 one-time** | Early-supporter pricing for first 100K users |

The flagship price is a **single, memorable $5/year SKU**. Family and Lifetime tiers are optional upsells and not required for the base model to work.

### Per-Module Equivalent Value — The Pitch Line

| Replaced subscription | Annual cost |
|----------------------|-------------|
| Calm (mood, breathwork) | $69.99 |
| MyFitnessPal Premium (nutrition) | $79.99 |
| Strava Premium (workouts) | $79.99 |
| AllTrails+ (trails) | $35.99 |
| Flo Premium (cycle) | $49.99 |
| YNAB (budget) | $109.00 |
| Day One Gold (journal) | $99.99 |
| Paprika (recipes) | $4.99 one-time |
| Stylebook (closet) | $3.99 one-time |
| Planta Premium (garden) | $35.99 |
| Medisafe Premium (meds) | $39.99 |
| Habitify (habits) | $39.99 |
| Readwise (books + flash) | $95.88 |
| **Equivalent multi-app stack** | **~$755/year** |
| **MyLife Pro** | **$5/year** |

**Value ratio: 151x.** This is the marketing tagline: **"Every app you're paying for, plus 17 more, for $5 a year. Forever."**

### Why $5 Works Economically

The $5 price is not charity — it is a deliberate commoditization of the lifestyle-app category. Four reasons it works:

1. **Store-fee economics are fine.** $5 × (1 − 15%) = $4.25 net. At 80%+ retention and 6-year average life, LTV per paid user is $24-28.
2. **Impulse-purchase threshold.** Psychology research (Ariely, Kahneman) consistently puts the "decision-free" price ceiling around $5-7. Below this, users do not deliberate; they just tap buy. This is why Overcast, Castro, Carrot Weather, and the entire app-tip-jar market cluster at $5-10.
3. **Gifting and virality.** At $5, giving MyLife as a gift to a friend is trivial. This turns every sub into a potential 2-5x multiplier through organic seeding.
4. **Eliminates refund and chargeback drag.** Users don't dispute $5 charges. Our refund rate should run 80-90% below industry norm, saving support cost and ratings damage.

### Free-Tier Strategy (Unchanged)

The free tier (fast, journal, mood, notes, voice) remains because:
- It establishes sticky daily-use habits (journal + mood especially).
- It seeds top-of-funnel organically; users who love the free tier tell friends.
- $5 is so low that once a user values two free modules and discovers a third locked one, the upgrade decision is reflexive.

### Paywall Strategy

No free trial needed. No freemium complexity. The paywall is literally: **"Unlock all 30 modules forever for $5."** The "forever" language (annual sub that auto-renews but feels like ownership) is the critical framing. This is borrowed from Apple Arcade's messaging playbook.

Expected conversion funnel:
- Install → free-tier active: 80%
- Free-tier active → view paywall within 30 days: 65%
- Paywall view → purchase: 45%
- **Overall install → paid within 90 days: ~23%**

This blended 23-25% conversion is 10x the industry median — achievable specifically because of the price.

### Optional Revenue Expanders (Post-PMF)

Once the $5 base is proven, we can layer:
- **MyLife Family** at $12/yr (up to 4 accounts) — adds ~$1-2 ARPU uplift across 15-20% of paid base.
- **MyLife Lifetime** at $25 one-time — accelerates working capital and locks in super-fans (proven by Paprika, Fastmail, Day One Lifetime).
- **Cloud Sync / Backups** at $2/yr add-on — pure margin, unlocks cross-device for power users.
- **Ad-free forums/market emphasis** — already default, but a future tier could add advanced community tooling.

These are optional; the base plan stands on its own.

---

## 7. Financial Projections (5-Year Base Case at $5/year)

### Install and Conversion Assumptions

The $5 price inverts the typical mobile app funnel: installs are much higher because the app is free to try, and conversion is much higher because the paywall is trivial. The result is a Duolingo-like distribution shape with a Spotify-like price point.

| Metric | Y1 | Y2 | Y3 | Y4 | Y5 |
|--------|----|----|----|----|----|
| Cumulative installs | 250K | 2.0M | 8.0M | 20.0M | **40.0M** |
| MAU (active in last 30 days) | 100K | 750K | 3.0M | 7.5M | **15.0M** |
| Install → paid conversion (90d) | 12% | 17% | 22% | 26% | **30%** |
| Cumulative paid subs | 30K | 340K | 1.76M | 5.20M | **12.0M** |
| Net ARPU per paid sub (after 15% store fee) | $4.25 | $4.25 | $4.25 | $4.25 | $4.25 |
| Annual retention | 70% | 74% | 78% | 80% | **82%** |

**Conversion ramp rationale:** 12% in Y1 is a conservative starting figure as we tune the paywall UX; 30% by Y5 matches what Overcast, Pocket Casts, and Carrot Weather achieve at the $5-10 price tier once momentum compounds.

### Revenue Build

| Line item | Y1 | Y2 | Y3 | Y4 | Y5 |
|-----------|----|----|----|----|----|
| Paid subs (year-end) | 30,000 | 340,000 | 1,760,000 | 5,200,000 | 12,000,000 |
| Mid-year avg paid subs | 15,000 | 185,000 | 1,050,000 | 3,480,000 | 8,600,000 |
| Gross subscription revenue ($) | $75,000 | $925,000 | $5,250,000 | $17,400,000 | **$43,000,000** |
| Store fees (15% weighted) | ($11,250) | ($138,750) | ($787,500) | ($2,610,000) | ($6,450,000) |
| **Net revenue ($)** | **$63,750** | **$786,250** | **$4,462,500** | **$14,790,000** | **$36,550,000** |
| Optional Family/Lifetime uplift (est 10%) | — | $78,000 | $446,000 | $1,480,000 | $3,655,000 |
| **Total net revenue** | **$64K** | **$864K** | **$4.9M** | **$16.3M** | **$40.2M** |
| Y5 exit ARR (annualized) | — | — | — | — | **$51M** |

### 5-Year P&L (Base Case)

| $ in thousands | Y1 | Y2 | Y3 | Y4 | Y5 |
|----------------|----|----|----|----|----|
| **Net revenue** | $64 | $864 | $4,900 | $16,300 | **$40,200** |
| Cloud infra (Supabase, maps, push, backups) | ($40) | ($280) | ($1,150) | ($3,000) | ($6,500) |
| Customer support & moderation (forums/market) | ($25) | ($150) | ($600) | ($1,800) | ($4,200) |
| Payment processing & fraud | ($3) | ($35) | ($200) | ($650) | ($1,600) |
| **Gross profit** | ($4) | $399 | $2,950 | $10,850 | **$27,900** |
| **Gross margin** | (6%) | 46% | 60% | 67% | **69%** |
| | | | | | |
| Marketing (organic-first: ASO, PR, creator, ambassador) | ($250) | ($800) | ($2,400) | ($5,000) | ($8,500) |
| R&D (engineers + design) | ($950) | ($1,500) | ($2,400) | ($4,000) | ($6,200) |
| G&A (legal, accounting, compliance) | ($180) | ($260) | ($450) | ($800) | ($1,200) |
| **EBITDA** | **($1,384)** | **($2,161)** | **($2,300)** | **$1,050** | **$12,000** |
| **EBITDA margin** | — | — | — | 6% | **30%** |

### Y5 Steady-State Economics

- 15M MAU, 12M paid subs (80% of MAU paying — the "$5 forever" bundle).
- $51M run-rate ARR, $40M recognized revenue.
- 69% gross margin, 30% EBITDA margin. Comparable to a mature SaaS profile, and better than where Calm or Duolingo were at $50M ARR.
- **Cumulative 5-year revenue: ~$62M. Cumulative burn: ~$4.8M before self-funding kicks in (mid-Y4).**

### ARR Exit Trajectory (at $5/yr)

| End of | Paying subs | ARR | Valuation @ 6x ARR | Valuation @ 12x ARR |
|--------|-------------|-----|--------------------|--------------------|
| Y1 | 30,000 | $127K | $1M | $2M |
| Y2 | 340,000 | $1.4M | $9M | $17M |
| Y3 | 1,760,000 | $7.5M | $45M | $90M |
| Y4 | 5,200,000 | $22M | $132M | $264M |
| Y5 | 12,000,000 | **$51M** | **$306M** | **$612M** |

**Valuation premium for user base:** Acquirers often pay more than ARR multiples for user bases with this scale. 12M paid subs + 15M MAU is Duolingo-2018 territory (55M MAU → $1.5B val) and Spotify-2009 territory (10M users → $250M val). A $5 MAU is worth ~$10-20 to a strategic acquirer (Apple, Google, Microsoft, Meta) pursuing ecosystem lock-in.

---

## 8. Scenario Analysis (at $5/year)

### Bear Case (30% probability)

- Adoption slower than expected; suite fails to hit network effects.
- Year 5: 10M installs, 15% conversion = 1.5M paid, **$7M ARR**, lifestyle business.
- Acquirer-attractive for user base ($50-80M acquihire) but no venture-return outcome.
- Seed investors recover 1.5-2.5x via strategic sale.

### Base Case (50% probability)

- $5 pricing produces the designed moat; product-market fit in year 2.
- Year 5: 40M installs, 30% conversion = 12M paid, **$51M ARR**.
- EBITDA: $12M, 30% margin. Cash-flow positive from mid-Y4.
- Series A in Y2-Y3 at ~$40-60M post-money. Series B optional at ~$200M post.
- Exit at Y5-Y7: **$300-600M** strategic to Apple / Google / Microsoft / Spotify / Match / NortonLifeLock / Amazon (Prime bundle) / Meta.

### Bull Case (20% probability)

- One or two modules go viral (RSVP + flash most likely based on existing playbook); $5 price amplifies spread.
- Year 5: 80M installs, 35% conversion = **28M paid, $120M ARR**.
- Distribution profile becomes Duolingo-like. Public-market-ready.
- Comparable: Duolingo IPO 2021 at $6.5B on $200M rev; our $120M ARR + 28M paid would price **$1.5-3.0B** in a favorable window.

### Expected Value

| Scenario | Probability | Exit value | Probability-weighted |
|----------|-------------|-----------|---------------------|
| Bear | 30% | $65M | $19.5M |
| Base | 50% | $450M | $225M |
| Bull | 20% | $2.25B | $450M |
| **Expected exit value** | — | — | **~$695M** |

At $15M post-money seed (15% founder + 20% option pool dilution across life cycle), seed investors likely own ~12-14% at exit.

**Expected seed return: ~$90M on $3M ask = 30x gross.** Time-adjusted at 6 years: **~70% IRR**.

### Why the Bull Case Probability Is Reasonable

At $5/yr, the marketing math flips: a user saving $180/yr of competitor subscriptions pays back the price in 10 days. Word-of-mouth loops compound. The closest historical analog is how Spotify Free → $9.99 destroyed iTunes's $0.99/song model: a price so low relative to the incumbent stack that the incumbent cannot match without self-harm.

---

## 9. Funding Ask & Use of Funds

### Ask: $3.0M SAFE on $15M post-money cap

### 18-Month Runway Deployment

| Category | % | $ | What it buys |
|----------|---|---|-------------|
| Product engineering | 35% | $1.05M | 3 senior TS engineers ($180K each) + 1 mobile specialist for native GPS, wake-lock, in-app purchases ship |
| Marketing & growth | 30% | $0.90M | ASO ($80K), PR + launch ($120K), creator/ambassador program seeded at $5-rev-share ($250K), content studio ($150K), TikTok/Reels paid experiments ($200K), referral infra ($100K) |
| Design & brand | 10% | $0.30M | 1 senior product designer ($180K) + brand refresh + motion system |
| Cloud & infra | 8% | $0.24M | Supabase (forums, market, workouts), Mapbox, push, backups; sized for 5M MAU target in yr 2 |
| Legal & compliance | 7% | $0.21M | HIPAA posture review (meds, cycle), GDPR, Apple/Google enterprise, trademark, ToS |
| Founder comp & ops | 6% | $0.18M | Below-market founder salaries ($120K each for 2 founders for 9 months) |
| Reserve / opportunistic | 4% | $0.12M | Acquisition opportunities (single-module apps at $50-200K), legal contingency |
| **Total** | **100%** | **$3.00M** | |

### Milestones to Series A ($8-12M in Y2)

At $5 pricing, milestones are user-count-led rather than ARR-led, because strategic value accrues disproportionately to distribution.

1. **M+3:** Public launch on iOS and Android App Stores, all 30 modules live.
2. **M+6:** 150K installs, 18K paid ($76K ARR), 12% conversion proven.
3. **M+9:** 400K installs, 60K paid ($255K ARR), retention >72% on first annual renewals.
4. **M+12:** 1M installs, 180K paid ($765K ARR) — Series A signal on scale trajectory.
5. **M+15:** Android parity, 2 viral growth loops proven (likely RSVP + flash).
6. **M+18:** 2M installs, 400K paid (**$1.7M ARR, run-rate $2.5M**), ready to raise Series A at $60-100M post on scale story (not ARR alone).

---

## 10. Comparable Exits & Valuation Framework

### Consumer Subscription App Exits (Relevant Comps)

| Exit | Acquirer | Year | Price | ARR at exit | Multiple |
|------|----------|------|-------|-------------|----------|
| MyFitnessPal | Francisco Partners | 2020 | $345M | ~$50M | 7x |
| Truebill (→ Rocket Money) | Rocket Companies | 2021 | $1.275B | ~$80M | 16x |
| Yummly | Whirlpool | 2017 | $100M | ~$15M | 7x |
| Rover | Blackstone (take-private) | 2023 | $2.3B | $244M | 9.5x |
| MagicSeaweed | Surfline | 2023 | Undisclosed | ~$5M est | — |
| Simplifi / Quicken | Aquiline Capital | 2021 | $600M (est) | ~$80M | 7x |
| Duolingo | IPO | 2021 | $6.5B | $200M | 32x |

### Private Market Revenue Multiples (2024-2025)

- Consumer subscription apps (Rule of 40+): **8-15x ARR**
- Categorically leading consumer apps (Strava, Notion): **15-25x ARR**
- Profitable subscription apps (Calm, Headspace): **6-10x ARR** in current market

### MyLife Exit Range (at $5/yr base model)

At $51M Y5 ARR and 30% EBITDA margin, but with 12M paid subs + 15M MAU:

| Valuation method | Input | Exit value |
|------------------|-------|-----------|
| ARR multiple (conservative, 6x) | $51M ARR | **$306M** |
| ARR multiple (strategic, 10x) | $51M ARR | **$510M** |
| Per-paid-user (Duolingo 2021 IPO: $105/paid sub) | 12M × $105 | **$1.26B** |
| Per-MAU (Spotify acquisition math: $30/MAU) | 15M × $30 | **$450M** |
| Blended strategic premium | — | **$450-600M (base)** / **$1.2-2.5B (bull)** |

**Strategic buyer thesis:** Apple, Google, and Microsoft have each paid $1-3B historically to acquire ecosystem-lock-in consumer apps (Fitbit for Google at $2.1B; Shazam for Apple at $400M on 100M users; Beats for Apple at $3B). 12M paying iOS/Android subs is a meaningful moat against their rivals — particularly if framed as a privacy halo asset.

---

## 11. Competitive Moats & Defensibility

1. **Price-as-moat.** $5/yr is our primary strategic weapon. No $60-120/yr incumbent can counter without cannibalizing their existing revenue. A $5 bundle from an entrenched player like Calm or Duolingo would wipe out hundreds of millions in annual revenue overnight; they are structurally unable to respond. This is the same dynamic Spotify used against iTunes (all-you-can-listen vs pay-per-song).
2. **Data locality.** 26 of 30 modules store data on-device. A single MyLife user cannot be bought for surveillance advertising, which is a durable moat against MyFitnessPal/Meta-style acquisitions and a growing post-Dobbs, post-GDPR consumer concern.
3. **Cross-module data network effect.** Workouts → nutrition → mood → habits. No single-vertical incumbent can ship this without buying 4+ more companies.
4. **30-module breadth.** Any single-vertical competitor would need to replicate 29 more products to catch up. Our engineering head start is ~5 person-years of consolidated work.
5. **Suite pricing compression.** Once a user pays $5 once, the marginal friction to keep paying is near zero. This is the Amazon Prime / Apple One dynamic at 1/30th the price.
6. **Trust dividend.** Privacy-first positioning wins with 25-40 year old knowledge workers (our core demographic) at a time when every incumbent is in a trust crisis (Flo settlements, MyFitnessPal breaches, Mint shutdown).
7. **Gift-and-seed loop.** At $5, gifting MyLife to a friend is trivial. Every sub becomes a micro-influencer for free. This is unique to ultra-low pricing and structurally impossible for premium competitors to replicate.

---

## 12. Risks & Mitigations

| Risk | Probability | Severity | Mitigation |
|------|-------------|----------|------------|
| **Infra cost swamps $5 ARPU at scale** | Medium | High | Local-first architecture: 26/30 modules have ~$0 per-user server cost. Cloud modules (forums, market, workouts, surf) are gated into Pro. Projected Y5 infra/user: $0.42. |
| Apple sherlocks 2-3 modules (likely Journal, Health, Fitness+) | High | Medium | 27 modules remain; suite still differentiated. |
| CAC math breaks if organic growth stalls | Medium | High | At $5, paid acquisition is constrained to $4-6 CAC. If organic stalls we cap paid spend; lower growth but preserved unit economics. |
| Store policy change on subscriptions | Low | High | Diversified web checkout via Stripe (already built); Apple small-biz program hedges commission. |
| Investors undervalue low-ARPU model | High | Medium | This analysis leads with user count and strategic buyer comps (per-MAU, per-paid-sub), not just ARR multiples. Education is part of the raise. |
| Single module launch flops | High | Low | 30-module breadth insulates against any single failure. |
| Privacy stance becomes noise | Low | High | Backup positioning: all-in-one convenience is equally strong ("replace 10 apps with one for $5"). |
| $5 price signals low quality | Medium | Medium | Design/brand investment ($300K) emphasizes premium feel; positioning says "radical generosity," not "cheap." |
| Support load scales faster than revenue | Medium | Medium | Community-driven support via forums module; self-serve docs; AI-assisted triage. Support cost capped at 12% of revenue. |
| Refund/chargeback fraud at $5 scale | Low | Low | Below chargeback threshold for most consumers. |
| Team scaling / burnout | Medium | Medium | $3M ask funds 3 hires; founder vesting + option pool. |

---

## 13. Why Now

1. **Mint shutdown (Jan 2024)** left $400M+ of subscription revenue up for grabs; Monarch, Copilot, Rocket all raised on the back of it. MyLife budget + subs is entering a vacuum.
2. **Flo Health regulatory scrutiny** (FTC 2021, UK ICO 2024) is an opening for a privacy-first alternative.
3. **Yummly (2024) and Under Armour's MyFitnessPal divestiture (2020)** signal that single-vertical lifestyle apps are hitting ceiling economics. Consolidation is the next chapter.
4. **Partiful's 400% YoY growth in 2025** proved that Gen Z will adopt new social-adjacent utilities rapidly when the design is right. Our RSVP and forums modules benefit directly.
5. **Consumer subscription fatigue is real but asymmetric.** Users don't cancel because they pay too much; they cancel because they use too few features per sub. Our bundle is literally the fix.
6. **Apple Intelligence and on-device AI make privacy-first positioning cheap to deliver.** MyLife's architecture is already local-first; we get the AI wave without rebuilding our data model.

---

## 14. The Ask

**$3.0M** on a post-money SAFE with a **$15M valuation cap** and **20% discount**.

- Lead: Pre-seed / seed focused on consumer subscription and price-disruption theses (Forerunner, Index, Founders Fund Seed, a16z Speedrun, GV, Emerson Collective, Kindred, First Round).
- Follow-on rights at Series A pro rata.
- Target close: 60 days.

**What this buys the investor:** a shot at a category-defining, profitable-by-Y4, privacy-first consumer suite in a $60B+ TAM — priced at a level that is structurally uncopyable by any single-vertical incumbent. The closest historical analog is Spotify's $9.99 unlimited music subscription against iTunes's $0.99/song; the incumbents could not match without destroying their own cash cow, and the challenger captured the market. The seed valuation of $15M is comparable to Copilot Money's pre-Series A raise ($10.8M total raised for a single budget module) for what is effectively 30 Copilots bundled at 1/20th the price.

---

## 15. Appendix — Key Data Sources

- **Business of Apps** — Calm, Headspace, Strava, Flo, Duolingo, Notion usage statistics (2024-2026 reports).
- **RevenueCat State of Subscription Apps 2025** — ARPU, LTV, CAC, conversion benchmarks.
- **Adapty In-App Subscription Benchmarks 2026** — paywall + trial conversion data.
- **Sacra.com** — Oura, Otter, Noom, Partiful valuation & ARR.
- **PitchBook, Crunchbase, CB Insights** — private company funding and valuation data.
- **Grand View Research, Straits Research, Fortune Business Insights, Global Growth Insights** — TAM by vertical.
- **Latka (getlatka.com)** — Strava, Notion, Calm, Headspace, AllTrails, Noom revenue snapshots.
- **Official IR releases** — Duolingo shareholder letters, Rocket Companies 10-K (2024).
- **TechCrunch, CNBC, PYMNTS, MobiHealthNews** — funding announcements for Monarch, Flo, Oura, Copilot.

---

## 16. Appendix — Detailed Module-to-Market Mapping

Each module is mapped to its primary competitor, secondary competitors, market size, and MyLife differentiator. This is the backup detail behind Section 4.

### Books → Goodreads / StoryGraph / Readwise
- **Primary:** Goodreads (Amazon, 150M reg, stagnant).
- **#2:** StoryGraph (bootstrapped, 3M MAU, growing ~60% YoY).
- **#3:** Readwise (~$12M revenue, 60K paid).
- **MyLife differentiator:** Privacy-first, offline, cross-syncs with highlights + flash module.

### Budget → YNAB / Monarch / Copilot / Rocket Money
- **Primary:** Monarch ($35M ARR, $850M val post-Series B).
- **#2:** YNAB (~$50M, bootstrapped).
- **#3:** Rocket Money (4.1M premium subs, $80M+ revenue).
- **MyLife differentiator:** Subscription tracker bundled free; local envelope budgeting + Plaid-free option.

### Car → CARFAX Car Care / Road Trip / Fuelio
- **Primary:** CARFAX (50M users, free, data model).
- **MyLife differentiator:** Full maintenance history, no data resale, cross-module expense tracking.

### Closet → Stylebook / Whering / Cladwell
- **Primary:** Stylebook ($1.4M, iOS only).
- **#2:** Whering (UK-based, ~$5M).
- **MyLife differentiator:** Packing list + laundry cycle integration with travel.

### Cycle → Flo / Clue / Natural Cycles
- **Primary:** Flo ($275M, 77M MAU, $1B val).
- **#2:** Clue (~$30M, 12M MAU).
- **#3:** Natural Cycles (FDA-approved, ~$30M).
- **MyLife differentiator:** Local-only prediction engine; no cloud, no third-party sharing. Critical post-Dobbs.

### Fast → Zero (LifeSum) / Fastic / Fastient
- **Primary:** Zero, acquired by LifeSum (~$20M, leader).
- **MyLife differentiator:** Free tier full-featured; ties to nutrition module.

### Flash → Anki / Quizlet / RemNote
- **Primary:** Quizlet ($139M, $1B val).
- **#2:** Anki (open source, 20M+ users).
- **#3:** RemNote (~$8M ARR).
- **MyLife differentiator:** SRS scheduler with native integrations to books, words, nutrition (food vocabulary).

### Forums → Reddit / Discord (adj) / Mighty Networks
- **Primary:** Reddit ($1.3B, public).
- **#2:** Mighty Networks (~$20M, creator-focused).
- **MyLife differentiator:** Private, per-module communities tied to user interests already in the suite.

### Garden → Planta / PlantIn / PictureThis
- **Primary:** Planta (7M users, ~$10-15M).
- **#2:** PlantIn (~$30M est).
- **#3:** PictureThis (~$100M est, ID-driven).
- **MyLife differentiator:** Harvest journal ties to recipes and nutrition.

### Habits → Habitify / Streaks / Habitica / Daylio
- **Primary:** Habitify (~$5M).
- **#2:** Streaks (~$8M).
- **#3:** Daylio (~$12M, habit + mood combo).
- **MyLife differentiator:** Habit data feeds mood, meds, workouts directly.

### Health → Apple Health (substrate, not competitor) / Google Fit / Samsung Health
- **Primary:** Apple Health (first-party, free).
- **MyLife differentiator:** Cross-device (iOS + Android + Web), clinical data import, medication + cycle unified view.

### Homes → HomeZada / Home Wizard / Centriq
- **Primary:** HomeZada (~$5M).
- **MyLife differentiator:** Unified with car, pets, and garden.

### Journal → Day One / Journey / Reflect / Finch
- **Primary:** Day One ($8-12M est, Automattic-owned).
- **#2:** Reflect (~$3M, AI-native).
- **#3:** Finch (~$20M, gamified wellness journal).
- **MyLife differentiator:** Encryption engine; tied to mood + voice modules.

### Mail → Superhuman / Hey / Shortwave
- **Primary:** Superhuman ($100M+ ARR, Grammarly acquired 2025).
- **#2:** Hey (~$30M, Basecamp).
- **MyLife differentiator:** Triage-first, private, ties to RSVP.

### Market → OfferUp / Poshmark / Facebook Marketplace
- **Primary:** Poshmark (~$385M revenue, acquired by Naver 2023 $1.6B).
- **#2:** OfferUp ($250M est).
- **MyLife differentiator:** Trusted intra-suite marketplace; ties to closet.

### Meds → Medisafe / MyTherapy / Pill Reminder
- **Primary:** Medisafe (~$25M, 10M downloads).
- **#2:** MyTherapy (~$8M).
- **MyLife differentiator:** Integrated with health, cycle, mood; family sharing.

### Mood → Daylio / Moodfit / Finch
- **Primary:** Daylio (~$12M).
- **#2:** Finch (~$20M).
- **MyLife differentiator:** Free tier full; breathing engine, ties to journal and habits.

### Notes → Notion / Apple Notes / Obsidian / Bear
- **Primary:** Notion ($500M ARR, $11B val).
- **#2:** Bear (~$8M).
- **#3:** Obsidian (~$5M, local-first).
- **MyLife differentiator:** Local-first, markdown, free tier.

### Nutrition → MyFitnessPal / Cronometer / Lose It!
- **Primary:** MyFitnessPal ($42M, $345M exit).
- **#2:** Cronometer (~$15M).
- **#3:** Lose It! (~$20M).
- **MyLife differentiator:** Ties to recipes, market, workouts, cycle for complete loop.

### Pets → Rover (service) / 11pets (mgmt) / Pet First Aid
- **Primary:** 11pets (~$3M, pet health leader).
- **#2:** Rover (not direct, $244M services marketplace).
- **MyLife differentiator:** Weight + reminders + vet records.

### Presence → Opal / Forest / One Sec
- **Primary:** Opal (~$15M).
- **#2:** One Sec (~$5M).
- **MyLife differentiator:** Tied to mood, journal, habits for root-cause analysis.

### Recipes → Paprika / Yummly (dead) / Mealime / SideChef
- **Primary:** Paprika ($8-15M, bootstrapped profitable).
- **#2:** Mealime (~$10M).
- **MyLife differentiator:** Ties to market shopping list + nutrition; private.

### RSVP → Partiful / Evite / Punchbowl
- **Primary:** Partiful (~$5-8M, $120M val).
- **#2:** Evite ($25M est, waning).
- **MyLife differentiator:** Ties to mail, notes, forums for event ecosystem.

### Stars → Co-Star / The Pattern / Sanctuary
- **Primary:** Co-Star ($10M, 30M reg).
- **#2:** The Pattern (~$8M, celebrity-adjacent).
- **MyLife differentiator:** Daily astro tied to mood and journal.

### Surf → Surfline / MagicSeaweed (merged) / Surf-forecast.com
- **Primary:** Surfline/MSW (~$35M).
- **MyLife differentiator:** Ties to workouts, trails, weather.

### Trails → AllTrails / Gaia GPS / Komoot
- **Primary:** AllTrails ($80M+ est 2025).
- **#2:** Gaia GPS (~$30M, Outside-owned).
- **#3:** Komoot (~$65M European leader).
- **MyLife differentiator:** Ties to workouts, weather, mood; fully offline.

### Voice → Otter.ai / Voice Memos / Descript
- **Primary:** Otter ($100M ARR, 25M users).
- **#2:** Descript (~$80M ARR).
- **MyLife differentiator:** Free tier full; ties to journal and notes.

### Words → Vocabulary.com / WordUp / Magoosh
- **Primary:** Vocabulary.com (~$12M).
- **#2:** WordUp (~$5M).
- **MyLife differentiator:** Ties to flash + books (highlights become flashcards).

### Workouts → Strava / Strong / Hevy
- **Primary:** Strava ($415M, $2.2B val).
- **#2:** Strong (~$20M).
- **#3:** Hevy (~$15M, fast-growing).
- **MyLife differentiator:** Ties to nutrition, cycle, mood, meds for holistic fitness.

---

## 17. Summary for Investor One-Pager

> **MyLife bundles 30 privacy-first personal software products — meditation, health, budget, fitness, nutrition, journaling, habits, pets, and more — into a single $5/year subscription on iOS, Android, and web.** The product is built, tested, and TestFlight-ready. Every module has a proven single-vertical competitor ranging from $10M to $3B in revenue; users today pay $200-700 a year for a stack that MyLife collapses for $5. At that price, the decision-to-buy becomes reflexive, conversion climbs to 25-30%, and no $60-120/yr incumbent can counter without destroying their own revenue. Base case: **12M paying subs at $51M ARR by Y5, 30% EBITDA margin, $450-600M strategic exit**. Bull case: Duolingo-like distribution and a $1.5-3B outcome. We're raising **$3M on a $15M cap** to finish the native GPS/IAP polish, launch marketing, and hit 1M installs + $800K ARR in 18 months.
