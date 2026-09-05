# MyLife Investor Deck -- March 2026 Snapshot

> Status update (2026-04-23): this deck predates the consolidation pivot and the mesh sync plan. It still reflects March 2026 slide copy, including 29-module assumptions in many sections.
>
> Current source-of-truth docs:
> - `docs/plans/consolidation/README.md`
> - `docs/plans/consolidation/phase-review-report.md`
> - `docs/plans/queue/08-mesh-sync-mission-control.md`
> - `packages/module-registry/src/constants.ts`
> - `apps/mobile/app/_layout.tsx`
> - `apps/web/components/Providers.tsx`
>
> As of 2026-04-23, the registry defines 39 module IDs, mobile wires 38 full module definitions, web wires 29 full module definitions, and expansion is paused while the consolidation spine ships. Revalidate detailed counts, pricing, and market claims before external reuse.
>
> If you are about to use data or claims from this deck in a current deliverable, stop and ask the user to verify that the specific figures or assumptions should still be used.

---

## SLIDE 1: Title

# MyLife

### One App for Your Entire Life

Privacy-first personal life management hub.

**March 2026 fundraising snapshot. Refresh before reuse.**

iOS / Android / Web

---

## SLIDE 2: The Problem

### Your life is scattered across dozens of apps

| Pain Point | Scale |
|---|---|
| Average paid app subscriptions per person | 6.7 |
| Annual cost of managing life across apps | $800+ |
| Cloud services holding your personal data | 10+ |
| Users who forget subscriptions they pay for | 42% |

### Privacy is an afterthought

| Breach / Incident | What Happened |
|---|---|
| **Flo** (menstrual tracking) | Sold intimate health data to Facebook and Google without consent; FTC settlement |
| **MyFitnessPal** (nutrition) | 150 million user accounts breached in 2018 |
| **Strava** (fitness) | Heatmap data exposed military base locations and troop movements |
| **BetterHelp** (mental health) | Shared therapy session data with Facebook for ad targeting; FTC $7.8M fine |

Your most personal data -- health, finances, mood, cycle, medications -- lives on servers you do not control.

---

## SLIDE 3: The Solution

### MyLife replaces the app drawer

- **One app** replaces dozens of paid subscriptions
- **One database** on your device (SQLite, local-first)
- **Enable only what you need** -- modular, not bloated
- **Cross-module intelligence** -- correlations impossible in siloed apps
  - Mood + Meds: does a medication affect your emotional state?
  - Nutrition + Fasting: automated macro tracking across eating windows
  - Cycle + Health: symptoms correlated with cycle phase
  - Habits + Workouts: streak tracking tied to exercise data
- **$5/year** for everything

**Zero analytics. Zero telemetry. Your data never leaves your device.**

---

## SLIDE 4: The Price Shock

### What you pay today vs. MyLife

| App (Category) | Annual Cost |
|---|---|
| YNAB (budgeting) | $109 |
| Fitbod (workouts) | $96 |
| MyFitnessPal (nutrition) | $80 |
| Zero (fasting) | $70 |
| Flo (cycle tracking) | $50 |
| Obsidian Sync (notes) | $48 |
| Medisafe (medications) | $40 |
| Day One (journal) | $35 |
| Anki (flashcards, iOS) | $30 |
| AllTrails+ (trails) | $27 |
| **10 apps total** | **$585/yr** |

| | |
|---|---|
| **MyLife (all 29 modules)** | **$5/yr** |
| **You save** | **$580/yr (99%)** |

MyLife covers 29 categories. The table above only shows 10.

---

## SLIDE 5: Product Overview

### 29 modules across 6 categories

| Category | Modules | Count |
|---|---|---|
| **Health & Wellness** | Health, Meds, Nutrition, Cycle, Mood, Fast, Habits | 7 |
| **Finance & Commerce** | Budget, Market, Subs | 3 |
| **Productivity** | Notes, Journal, Words, Flash, Voice, Mail | 6 |
| **Fitness & Outdoors** | Workouts, Trails, Surf | 3 |
| **Lifestyle** | Books, Recipes, Car, Closet, Garden, Pets, Stars | 7 |
| **Social & Home** | Forums, RSVP, Homes | 3 |

### Free tier (7 modules, no purchase required)

Fast, Forums, Journal, Market, Mood, Notes, Voice

### Premium tier (22 modules)

$5/year unlocks everything. No per-module upsells. No feature gates within modules.

---

## SLIDE 6: What's Built Today

### This is not a pitch deck for a concept. The product exists.

| Metric | Value |
|---|---|
| Modules defined in registry | 29 |
| Modules wired on mobile (Expo) | 28 |
| Modules wired on web (Next.js 15) | 19 |
| Automated tests | 440+ |
| Database tables | 90+ |
| Mobile screens | 120+ |

### Technical foundation

| Layer | Technology |
|---|---|
| Language | TypeScript (strict, everywhere) |
| Mobile | Expo (React Native) -- iOS + Android from one codebase |
| Web | Next.js 15 (App Router) |
| Database | SQLite (on-device, single file, prefixed tables per module) |
| Cloud (select modules) | Supabase (Surf, Workouts) |
| Design system | Cool Obsidian (dark, glass morphism, iOS-native feel) |
| Monorepo | Turborepo + pnpm |
| Testing | Vitest |

### Launch readiness (by tier)

| Tier | Count | Description |
|---|---|---|
| Launch (85%+) | 17 modules | Production-ready, ships in App Store v1.0 |
| Beta (50-84%) | 7 modules | Core flows working, visible with "Beta" badge |
| Hidden (<50%) | 5 modules | In development, not visible until promoted |

### What's new (March 2026 strategic review)

- **Cross-module AI intelligence** -- on-device analytics correlating data across modules (mood + meds, nutrition + fasting, etc.)
- **Anti-Enshittification Pledge** -- legally binding commitment: no ads, no data selling, data export always available
- **Biometric human verification** -- Face ID / Touch ID gates social features. We never see biometric data.
- **Feature execution pipeline** -- systematic process to build remaining 217 features via AI agents
- **Cool Obsidian design system** -- formalized as DESIGN.md with full token specification

---

## SLIDE 7: Market Opportunity

### Combined TAM across all module categories: $165B+ (2026)

| Category | TAM (2026) | CAGR | Key Competitor Revenue |
|---|---|---|---|
| Health & Wellness Apps | $45B+ | 15.9% | Apple Health dominates ecosystem |
| Personal Finance Apps | $25.8B | 20.6% | YNAB: $49M ARR |
| Mental Health / Wellness | $10-17B | 16.4% | Calm: $100M+ ARR, Headspace: $100M+ ARR |
| Fitness Apps | $13.5B | 13.4% | Strava: $415M revenue |
| Nutrition Tracking | $4.14B | 9.3% | MyFitnessPal: $310M revenue |
| Menstrual Health | $2.49B | 20.3% | Flo: $275M revenue |
| Flashcard / Study Apps | $1.2-2.3B | 8.8% | Quizlet: $96M revenue |
| Habit Tracking | $1.7-1.9B | 14.2% | 118M global users across category |

### MyLife does not need to win any single market

Capturing even 0.01% of the combined TAM = **$16.5M ARR**.

The play is breadth: one subscription replaces 10+ competitors across 6+ categories.

---

## SLIDE 8: Why $5/yr Works

### Local-first architecture = near-zero marginal cost per user

| Cost Driver | MyLife | Typical SaaS |
|---|---|---|
| Server compute per user | ~$0 (SQLite on device) | $2-8/yr |
| Cloud storage per user | ~$0 (data stays local) | $1-5/yr |
| Bandwidth per user | Minimal (app updates only) | $0.50-3/yr |

### Unit economics at $5/yr

| Line Item | Year 1 | Year 2+ |
|---|---|---|
| Gross revenue per user | $5.00 | $5.00 |
| App Store fee (30% Y1, 15% Y2+) | -$1.50 | -$0.75 |
| **Net revenue per user** | **$3.50** | **$4.25** |
| Server cost per user | ~$0.00 | ~$0.00 |
| **Contribution margin** | **$3.50 (70%)** | **$4.25 (85%)** |

### Proven pricing models in the market

| App | Price | Model |
|---|---|---|
| Anki (iOS) | $29.99 | One-time purchase, profitable |
| Streaks | $4.99 | One-time, profitable small team |
| Paprika | $4.99 | One-time, profitable small team |
| Obsidian | $0 (app) / $48 (sync) | $25M ARR, no VC funding |

### The math at scale

| Users | Net ARR (blended) |
|---|---|
| 10,000 | $40K |
| 100,000 | $425K |
| 500,000 | $2.1M |
| 1,000,000 | $4.25M |

---

## SLIDE 9: The Market Capture Model

### 2.17 billion people already use apps MyLife replaces

MyLife does not need to create demand. It needs to capture a tiny fraction of existing demand across 23 competitive spaces.

| Top Spaces | Users in Space | 1/500 Capture |
|---|---|---|
| Cycle Tracking (Flo, Clue) | 453M | 906K |
| Notes (Evernote, Notion, Obsidian) | 352M | 704K |
| Flashcards (Quizlet, Anki) | 310M | 620K |
| Nutrition (MyFitnessPal, Lose It!) | 262M | 524K |
| Workouts (Strava, Hevy, Fitbod) | 214M | 428K |
| Books (Goodreads, StoryGraph) | 155M | 310K |
| Remaining 17 spaces | 424M | 848K |
| **Total (overlap-adjusted 50%)** | **2.17B** | **~2.1M unique users** |

### Revenue at market capture targets

| Capture Rate | Unique Users | Paying (20%) | Net ARR |
|---|---|---|---|
| 1 in 1,000 | 1.05M | 210K | $893K |
| **1 in 500** | **2.1M** | **420K** | **$1.79M** |
| 1 in 250 | 4.2M | 840K | $3.57M |

### Base case timeline (1/500 capture, phased)

| | Year 1 (35% of target) | Year 2 (100%) | Year 3 | Year 5 |
|---|---|---|---|---|
| Unique users | 735K | 2.1M | 3.5M | 5.5M |
| Paying users | 147K | 420K | 700K | 1.1M |
| **Net ARR** | **$515K** | **$1.79M** | **$2.98M** | **$4.68M** |

### Context

Dollar Shave Club captured ~1 in 200 of Gillette's customers in Year 1 with one viral video. MyLife's target of 1 in 500 is more conservative, across a larger addressable pool, with a sharper value proposition ($5/yr vs. $800+/yr combined).

---

## SLIDE 10: Cost Structure

| Cost Item | Year 1 | Year 2 | Year 3 |
|---|---|---|---|
| Founder compensation | $150K | $150K | $175K |
| Engineering (1 hire) | $125K | $125-250K | $200-350K |
| Marketing (viral launch + sustained) | $100K | $75-100K | $100-150K |
| Legal / Compliance (GDPR, privacy, trademark) | $50K | $15K | $20K |
| Design (UX audit, assets) | $25K | $10K | $10K |
| Hosting + Infrastructure | $8K | $11K | $20K |
| **Total Operating Cost** | **$458K** | **$386-536K** | **$525-725K** |

### Key insight: costs are fixed, revenue scales

Because data lives on user devices, server costs remain nearly flat. The primary cost driver is people, not infrastructure. Every new user is nearly free.

| Metric | Year 1 | Year 2 | Year 3 |
|---|---|---|---|
| Net ARR (base case) | $515K | $1.79M | $2.98M |
| Total Cost | $458K | $460K | $625K |
| **Profit** | **+$57K** | **+$1.33M** | **+$2.36M** |
| **Operationally profitable** | **Year 1** | | |

---

## SLIDE 11: Investment Ask

### Seed Round: $750K

**18 months of runway. Operationally profitable in Year 1.**

| Allocation | % | Amount | Use |
|---|---|---|---|
| Founder compensation (18 mo) | 30% | $225K | Below-market salary ($150K/yr vs $160-220K market) |
| Engineering hire (18 mo) | 25% | $187K | 1 senior full-stack TypeScript/React Native engineer |
| Marketing (viral launch) | 17% | $125K | Video production, 50-city social deployment, sustained content |
| Legal + Compliance | 8% | $63K | GDPR audit, privacy policy, trademark |
| Design | 5% | $38K | UI/UX audit, App Store assets |
| Infrastructure + Reserve | 15% | $112K | Hosting, CI/CD, contingency |

### What the investment buys

| Milestone | Timeline |
|---|---|
| Hire engineer, begin UX audit | Month 1-2 |
| Top 15 modules at 90%+ quality | Month 3-4 |
| App Store + Play Store launch | Month 5 |
| Viral launch bomb (50-city simultaneous) | Month 6 |
| 100K users | Month 7-9 |
| 500K users, operationally profitable | Month 12 |
| Approach 1/500 capture (2.1M users) | Month 18 |

---

## SLIDE 12: Go-to-Market

### The Viral Launch Bomb

**One polished video. 50 cities. Simultaneous deployment.**

| Phase | Timeline | Strategy |
|---|---|---|
| 0. Polish | Month 1-4 | Top 15 modules to 90%+, TestFlight beta, UX audit |
| 1. The Video | Month 4-5 | Dollar Shave Club-style launch video ($35-48K production) |
| 2. The Bomb | Month 5-6 | 100 localized social accounts (50 IG + 50 TikTok) deploy video simultaneously across 50 US cities |
| 3. Sustained | Month 6-12 | Module comparison reels, privacy content, price reveal hooks |
| 4. Community | Month 6-18 | Reddit, HN, self-host, SEO competitor comparison pages |
| 5. Featuring | Month 12+ | App Store editorial push |

### Why this works

- **$5/yr is the hook.** It triggers disbelief, which triggers sharing.
- **50-city simultaneous launch** creates the appearance of organic, nationwide discovery.
- **Each module is a separate marketing angle.** 29 modules = 29 reasons to click.
- **Localized content** hits harder: "San Diego, stop paying $70/yr for Surfline."

### Acquisition funnel

```
Viral video --> App Store --> Free tier (7 modules) --> Daily use --> $5/yr upgrade
```

No credit card required. No trial expiration. No feature nag screens.

---

## SLIDE 13: Competitive Moat

### Five layers of defensibility

| Moat | Why It Holds |
|---|---|
| **1. Privacy architecture** | Local-first SQLite with zero telemetry. Competitors built on cloud-first architectures cannot retrofit this without rewriting their entire stack. |
| **2. Cross-module intelligence** | Correlating mood with medications, nutrition with fasting, habits with workouts -- this is impossible when data lives in separate apps from separate companies. |
| **3. Price floor** | $5/yr is below the customer acquisition cost for most competitors. They cannot profitably match this price on cloud infrastructure. |
| **4. Breadth** | No single competitor covers even 5 of these 29 categories. Building this breadth takes years. MyLife has a significant head start with a working product across all 29 categories. |
| **5. Self-host option** | Appeals to privacy maximalists, enterprise IT, and the degoogle/decloud movement. Creates a community moat similar to Obsidian. |

---

## SLIDE 14: Why Now

### Six market forces converging in 2026

| Force | Detail |
|---|---|
| **Subscription fatigue** | 42% of consumers forget subscriptions they pay for. Average household spends $219/month on subscriptions (2025 C+R Research). Backlash is building. |
| **Post-Mint shutdown** | Intuit shut down Mint in March 2024, displacing 3.6M users. Many still seeking alternatives. Credit Karma absorption was poorly received. |
| **Medisafe paywall** | Medisafe moved core features behind a paywall in January 2026. Users actively searching for free/cheap medication tracking. |
| **MyFitnessPal aggression** | Free tier limited to logging 5 foods per day. Premium pushed at $80/yr. Users frustrated and looking for alternatives. |
| **Post-Dobbs privacy** | Cycle tracking privacy became a national concern after the Dobbs decision. Local-first cycle tracking is not a feature -- it is a safety requirement. |
| **Product already built** | 29 modules, 440+ tests, and 3 platform targets are live and functional today. This is not a pitch deck -- it is a working product seeking growth capital. |

---

## SLIDE 15: Team

### Small team. Big output. Ready to scale.

| | Current State |
|---|---|
| **Founder/Developer** | Technical founder with full-stack expertise |
| **Product** | 29 modules, 440+ automated tests, 3 platforms (iOS, Android, Web) |
| **Architecture** | Production-grade monorepo (Turborepo, strict TypeScript, CI/CD) |
| **Code quality** | Comprehensive test coverage, automated parity enforcement, function quality gates |

### What investment enables

| Hire | Role | Impact |
|---|---|---|
| Engineer #1 | Full-stack (React Native + Next.js) | Doubles module completion velocity |
| Engineer #2 | Backend + infrastructure | Supabase modules, self-host packaging, CI hardening |
| Contract designer | UI/UX audit + marketing assets | Professional polish for App Store launch |

### Why a small team works

The modular architecture means each engineer owns specific modules without needing to understand the entire system. The monorepo, strict TypeScript, and 440+ tests ensure new engineers can ship confidently from week one. A team of 3 can maintain and improve all 29 modules effectively.

---

## SLIDE 16: Risks and Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Apple/Google platform changes | Medium | Self-host option eliminates platform dependency. Web version provides fallback distribution. |
| $5/yr may be too cheap to sustain | Low | Local-first = near-zero marginal cost. 85% contribution margin at Year 2+. Price can be raised later with grandfathering. |
| Feature depth vs. point solutions | Medium | Focus top 10 modules by market size to best-in-class quality. Remaining modules are bonus value that increases perceived deal. |
| Small team scaling | Medium | Investment directly solves this. Codebase is well-structured (monorepo, strict types, tests) for fast onboarding. |
| User acquisition at low price point | Medium | Free tier (7 modules) drives zero-cost acquisition. $5/yr pricing generates organic word-of-mouth and press coverage. |
| Competitor bundling response | Low | No single competitor has the breadth. Apple/Google could theoretically bundle but have shown no interest in unified personal management. |

---

## SLIDE 17: The Vision

### Three horizons

| Horizon | Timeline | Goal |
|---|---|---|
| **Short term** | 2026-2027 | Best-in-class personal app suite at 99% less than buying separately. Ship all 29 modules to production quality. Reach 200K users. |
| **Medium term** | 2027-2028 | Cross-module AI insights: correlations, predictions, and recommendations that are only possible when all your personal data lives in one place. On-device ML, no cloud required. |
| **Long term** | 2028-2030 | The operating system for your personal life. Family sharing. Enterprise/team tier for companies that want privacy-first employee wellness tools. |

### Comparable exits and valuations

| Company | Model | Revenue | Valuation | Note |
|---|---|---|---|---|
| Notion | All-in-one workspace | $400M ARR | $10B+ | Proved bundling wins in productivity |
| Obsidian | Local-first notes | $25M ARR | Private, no VC | Proved local-first + solo team works |
| Calm | Single wellness app | $100M+ ARR | $2B | Single category, cloud-dependent |
| YNAB | Single finance app | $49M ARR | Private | Single category at $109/yr |
| Strava | Single fitness app | $415M rev | $1.5B+ | Single category with network effects |

MyLife's thesis: if single-category apps can reach $50M-400M ARR, a 29-category bundle at a fraction of the price has asymmetric upside.

---

## SLIDE 18: Next Steps

### The ask

| Item | Detail |
|---|---|
| **Round** | Seed |
| **Amount** | $750K |
| **Use** | 18 months: founder salary, 1 engineering hire, viral launch, legal, design |
| **Structure** | Open to SAFE, convertible note, or equity |

### What $750K delivers

| Month | Milestone |
|---|---|
| 1-4 | Hire engineer, polish product, UX audit, legal |
| 5-6 | App Store launch + viral video deployment across 50 US cities |
| 7-9 | First 100K users, sustained content campaign |
| 10-12 | 735K users, $515K net ARR, operationally profitable |
| 13-18 | Approach 2.1M users (1/500 capture), $1.79M net ARR |

### The bottom line

2.17 billion people already pay for apps MyLife replaces. Capturing 1 in 500 of them generates $1.79M in annual revenue with 85% contribution margins. The product is built. The market exists. This capital funds the launch.
| 13-18 | Scale to 50K users, cross-module AI v1 |

### Contact

| | |
|---|---|
| **Product** | mylife.app |
| **Code** | github.com/mylife |
| **Email** | [founder email] |

---

*Built with privacy as the foundation, not the afterthought.*

*29 modules. $5/year. Zero telemetry. Your data stays yours.*
