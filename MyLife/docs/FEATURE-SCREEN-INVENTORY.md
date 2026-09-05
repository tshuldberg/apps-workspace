# MyLife Complete Feature & Screen Inventory

> **Purpose:** Comprehensive reference for UI/UX redesign. Every module, every screen, every feature mapped.
> **Generated:** 2026-04-03
> **Source:** Code audit of all 30 modules + hub shell, cross-referenced with COMPETITIVE-MATRIX.md
> **Totals:** 30 modules | 568 mobile screens | 269 web pages | 470+ features built

---

## Table of Contents

1. [Hub Shell](#hub-shell)
2. [MyBooks](#1-mybooks) (40 mobile / 13 web)
3. [MyBudget](#2-mybudget) (53 mobile / 5 web)
4. [MyCar](#3-mycar) (19 mobile / 8 web)
5. [MyCloset](#4-mycloset) (14 mobile / 5 web)
6. [MyCycle](#5-mycycle) (12 mobile / 11 web)
7. [MyFast](#6-myfast) (10 mobile / 6 web)
8. [MyFlash](#7-myflash) (13 mobile / 6 web)
9. [MyForums](#8-myforums) (13 mobile / 17 web)
10. [MyGarden](#9-mygarden) (26 mobile / 15 web)
11. [MyHabits](#10-myhabits) (24 mobile / 13 web)
12. [MyHealth](#11-myhealth) (27 mobile / 8 web)
13. [MyHomes](#12-myhomes) (38 mobile / 10 web)
14. [MyJournal](#13-myjournal) (17 mobile / 4 web)
15. [MyMail](#14-mymail) (21 mobile / 14 web)
16. [MyMarket](#15-mymarket) (17 mobile / 1 web)
17. [MyMeds](#16-mymeds) (38 mobile / 16 web)
18. [MyMood](#17-mymood) (25 mobile / 12 web)
19. [MyNotes](#18-mynotes) (14 mobile / 12 web)
20. [MyNutrition](#19-mynutrition) (14 mobile / 8 web)
21. [MyPets](#20-mypets) (13 mobile / 4 web)
22. [MyPresence](#21-mypresence) (11 mobile / 8 web)
23. [MyRecipes](#22-myrecipes) (15 mobile / 12 web)
24. [MyRSVP](#23-myrsvp) (19 mobile / 2 web)
25. [MyStars](#24-mystars) (23 mobile / 13 web)
26. [MySubs](#25-mysubs) (10 mobile / 8 web)
27. [MySurf](#26-mysurf) (21 mobile / 9 web)
28. [MyTrails](#27-mytrails) (21 mobile / 11 web)
29. [MyVoice](#28-myvoice) (2 mobile / 9 web)
30. [MyWords](#29-mywords) (10 mobile / 9 web)
31. [MyWorkouts](#30-myworkouts) (26 mobile / 6 web)

---

## Hub Shell

**Platforms:** Expo (iOS/Android) + Next.js 15 (Web)
**Design System:** Cool Obsidian (dark glass morphism)

### Mobile Hub Screens (10 screens)

| Screen | File | Features |
|--------|------|----------|
| **Dashboard** | `(hub)/index.tsx` | Dynamic greeting, 4 customizable module summary cards with stats, quick action row (mood/fast/budget/journal/workouts), all-modules 4-column grid, empty state with "Browse Modules" CTA, sticky dock bar (Hub/Search/Discover/Settings) |
| **Discover** | `(hub)/discover.tsx` | 6 category sections (Lifestyle, Health & Fitness, Finance, Home & Auto, Social & Events, Exploration), per-module toggle (enable/disable), release state badges (GA/Beta), premium lock overlay, entitlement enforcement |
| **Settings** | `(hub)/settings.tsx` | Subscription plan display, sync mode (Local/P2P/Cloud), entitlement refresh, version/DB/privacy info, Privacy Dashboard link, Sharing Preferences link, Import Wizard link, Data & Sync link, Backup & Restore link, Export (coming soon), Reset All Data (destructive) |
| **Search** | `(hub)/search.tsx` | Cross-module FTS5 search with 200ms debounce, recent activity feed (15 items), grouped results by module with accent colors and bold highlights, deep link navigation |
| **Data & Sync** | `(hub)/data-sync.tsx` | 5 sync tiers (local/P2P/free_cloud/starter/power), storage usage bar, P2P pairing code, auth (email/password), tier selection cards with pricing |
| **Import Wizard** | `(hub)/import-wizard.tsx` | 4-step flow: app selection (Goodreads/YNAB/MyFitnessPal/Day One), export instructions, progress bar with phase labels, results with error details |
| **Privacy Dashboard** | `(hub)/privacy.tsx` | Per-module data listing (expandable), table row counts from SQLite, cloud/local breakdown, Delete All Data with confirmation |
| **Backup & Restore** | `(hub)/backup.tsx` | SQLite file import/export, cloud backup toggle |
| **Sharing Preferences** | `(hub)/sharing.tsx` | Per-module sharing controls, collaborator toggles |
| **Onboarding** | `(hub)/onboarding-*.tsx` | Privacy consent, mode picker (local/P2P/cloud), self-host setup guide |

### Web Hub Screens

| Screen | Path | Features |
|--------|------|----------|
| **Dashboard** | `/` (page.tsx) | Module grid with enable/disable, summary cards, quick actions |
| **Discover** | `/discover/page.tsx` | Module browser by category, toggle enable, premium gate |
| **Settings** | `/settings/page.tsx` | Account, subscription, sync, backup, export, privacy |
| **Sidebar** | `components/Sidebar.tsx` | Persistent left nav with enabled module icons, accent colors, active state highlighting |
| **Command Palette** | `components/CommandPalette.tsx` | Cmd+K search across modules and screens |
| **Providers** | `components/Providers.tsx` | Database initialization, module registry, auth, entitlements |

### Shared Infrastructure

| Package | Purpose |
|---------|---------|
| `@mylife/ui` | Cool Obsidian tokens, shared components (ModuleCard, Glass, etc.) |
| `@mylife/db` | SQLite adapter, hub schema (hub_enabled_modules, hub_dashboard_cards, hub_settings), migration orchestration |
| `@mylife/module-registry` | 30 ModuleId values, metadata, lifecycle (enable/disable/migrate), tier classification |
| `@mylife/auth` | Auth wrapper (optional Supabase) |
| `@mylife/subscription` | RevenueCat (mobile) + Stripe (web) billing, entitlement resolution |
| `@mylife/search` | Cross-module FTS5 search index |

---

## 1. MyBooks

**Tagline:** Read in peace
**Icon:** 📚 | **Accent:** #C9894D | **Tier:** Premium | **Storage:** SQLite (bk_, v9) | **Tables:** 35+

### Mobile Screens (40)

| Screen | File | Key Features |
|--------|------|-------------|
| Home | `index.tsx` | Currently reading books, year progress ring, reading stats summary, quick actions (add book, view library) |
| Library | `library.tsx` | Book collection by shelf, covers, ratings, author names, sort options |
| Search | `search.tsx` | FTS5 search across titles/authors/subjects with filtering |
| Reader | `reader/index.tsx` | E-reader document library (ePub/PDF uploads) |
| Stats | `stats.tsx` | Annual pages/books/hours, genre distribution, streaks |
| Settings | `settings.tsx` | Privacy controls, cloud sync, notification prefs, data export |
| Book Detail | `book/[id].tsx` | Metadata, cover, half-star ratings, review, reading status (want/reading/finished/dnf), series, mood tags, content warnings, shelf assignment |
| Add Book | `book/add.tsx` | Manual entry, Open Library search, barcode scanner, ISBN lookup |
| Journal List | `journal.tsx` | Encrypted reading journal entries with mood logging |
| Journal Entry | `journal/[id].tsx` | Encrypted entry viewer/editor with markdown |
| New Journal | `journal/new.tsx` | Create encrypted reading journal entry |
| Shelf Detail | `shelf/[id].tsx` | Books in specific shelf |
| Quotes | `quotes.tsx` | Quote collection with FTS search, favorites, source books |
| Add Quote | `quotes/new.tsx` | Save quote with book linkage |
| Challenges | `challenges.tsx` | Active/completed reading challenges, progress rings, goals |
| Clubs List | `clubs.tsx` | Book club list with reading pace progress |
| Club Detail | `club/[id].tsx` | Current book, club notes, reading history, member list |
| Community | `community.tsx` | Community challenges (opt-in), friend challenges, leaderboards |
| Friends Challenge | `friends-challenge.tsx` | Friend reading progress details |
| Discover | `discover.tsx` | Mood-based book discovery (AI suggestions from ratings) |
| Recommendations | `recommendations.tsx` | Author/genre affinity scoring, similar books |
| Badges | `badges.tsx` | 31 badges across 9 categories (streaks, milestones, genres, formats, social) |
| Insights | `insights.tsx` | Reading speed, peak hours, genre evolution, weekend/weekday patterns |
| Year Review | `year-review.tsx` | Interactive year-in-review card |
| Social Feed | `social.tsx` | Opt-in friend activity (ratings, reviews, challenges) |
| Share Stats | `share.tsx` | Generate shareable reading stats cards (5 templates) |
| What's New | `whats-new.tsx` | Feature announcements, onboarding tips |
| Onboarding | `onboarding.tsx` | First-time walkthrough (privacy promise, add first book) |
| Series Detail | `series/[id].tsx` | All books in series, reading order, progress |
| Rate Books | `rate-books.tsx` | Quick rating entry for multiple books |
| Barcode Scan | `scan.tsx` | Barcode/ISBN scanner for fast book addition |

### Web Pages (13)

| Page | Path | Features |
|------|------|----------|
| Hub | `/books` | Library grid, recently added, currently reading shelf |
| Book Detail | `/books/[id]` | Full metadata, reviews, session, series, shelf management |
| Search | `/books/search` | Advanced filters (author, year, ratings, tags, format) |
| Stats | `/books/stats` | Annual reading statistics with charts |
| Import | `/books/import` | Goodreads/StoryGraph CSV import |
| Reader Library | `/books/reader` | ePub/PDF document library |
| Reader View | `/books/reader/[id]` | Document rendering, highlights, notes |

### Engines

- **Discovery Engine** -- Mood-based recommendation algorithm
- **Challenge Engine** -- Challenge lifecycle, auto-progress on completion
- **Insights Engine** -- Reading speed trends, peak hours, genre diversity, streaks
- **Genre Evolution** -- How reading taste changes over years
- **On This Day** -- Historical reading events by date
- **Recommendations Engine** -- Author/genre affinity scoring
- **Badge Engine** -- 31 badges across 9 categories
- **Social Feed Engine** -- Friend connections, feed assembly (Supabase opt-in)
- **Card Renderer** -- Shareable stats card generation
- **Encryption** -- AES-256 journal encryption

---

## 2. MyBudget

**Tagline:** Know where every dollar went, and why
**Icon:** 💰 | **Accent:** #22C55E | **Tier:** Premium | **Storage:** SQLite (bg_, v6) | **Tables:** 30+

### Mobile Screens (53)

| Screen | File | Key Features |
|--------|------|-------------|
| Home | `index.tsx` | Spending pulse (ahead/behind), active alerts, month-at-a-glance |
| Plan Tab | `plan-tab.tsx` | Envelope budgeting dashboard, monthly allocations, remaining balances |
| Transactions | `transactions.tsx` | Transaction list with search, filter by date/envelope/account |
| Subscriptions | `subscriptions.tsx` | Subscription list, renewal calendar, cost summary, ROI scores |
| Accounts | `accounts.tsx` | Account list (checking/savings/credit/cash), balances |
| Envelope Detail | `[id].tsx` | Monthly budget, balance, rollover toggle, transaction history |
| Create Envelope | `create.tsx` | Name, icon, color, monthly budget, rollover enabled |
| Account Detail | `account/[id].tsx` | Balance history, transactions, settings |
| Create Account | `account/create.tsx` | Type, starting balance, currency |
| Transaction Detail | `transaction/[id].tsx` | Merchant, amount, date, envelope, account, notes |
| Create Transaction | `transaction/create.tsx` | Amount, date, envelope, account, merchant, note, direction |
| Subscription Detail | `subscription/[id].tsx` | Cost, billing cycle, renewal dates, ROI estimate |
| Add Subscription | `subscription/add.tsx` | From 215-entry catalog or custom entry |
| Subscription ROI | `subscription-roi.tsx` | Cost per use, frequency analysis, underused detection |
| Renewal Calendar | `renewal-calendar.tsx` | Calendar view of upcoming renewals |
| Goals List | `goals.tsx` | Savings goal list for envelopes |
| Goal Detail | `goal/[id].tsx` | Target amount, date, progress, completion |
| Create Goal | `goal/create.tsx` | Target, deadline per envelope |
| Reports Menu | `reports.tsx` | Cash flow, spending trends, budget vs actual |
| Cash Flow | `cash-flow.tsx` | Income vs expense trends (line chart) |
| Spending Heatmap | `spending-heatmap.tsx` | Calendar heatmap of daily spend intensity |
| No-Spend Streaks | `no-spend-streaks.tsx` | Gamified no-spend days, streak counter |
| Weekly Digest | `weekly-digest.tsx` | Weekly spending summary |
| Age of Money | `age-of-money.tsx` | Avg days to spend money, trend |
| Net Worth | `net-worth.tsx` | Assets - liabilities over time |
| Debt Payoff | `debt-payoff.tsx` | Debt plans (snowball/avalanche) |
| Debt Detail | `debt-payoff/[id].tsx` | Balance, interest rate, payoff timeline |
| Create Debt | `debt-payoff/create.tsx` | Amount, rate, start date, payoff target |
| Investments | `investments.tsx` | Holdings, valuations, performance |
| Loan Planner | `loan-planner.tsx` | Loan calculator (amount, rate, term) |
| Currencies | `currencies.tsx` | Exchange rates, base currency selection |
| Category Targets | `category-target.tsx` | Budget vs actual per envelope |
| Checklist | `checklist.tsx` | Monthly budget prep checklist |
| Rules List | `rules.tsx` | Auto-categorize transactions by merchant/keywords |
| Create Rule | `rules/create.tsx` | If merchant matches, assign to envelope |
| Family Sharing | `family.tsx` | Invite members, shared envelope management |
| Expense Splitting | `splitting.tsx` | Split transaction among people |
| New Split | `splitting/new.tsx` | Participants, amounts, settlement method |
| Bank Connect | `connect-bank.tsx` | Plaid OAuth flow for bank sync |
| Help | `help.tsx` | FAQ, budget mode tutorial |
| CSV Import | `import-csv.tsx` | Transaction CSV import with mapping preview |
| Receipt Scan | `receipt-scan.tsx` | OCR: extract amount, date, merchant |
| Future Months | `future-months.tsx` | Budget planning for upcoming months |
| Review Transactions | `review-transactions.tsx` | Bulk categorization |
| Income | `income.tsx` | Salary, side gigs, one-time income tracking |
| Onboarding | `onboarding.tsx` | First-time setup (add accounts, envelopes, set budget) |
| Alerts | `alerts.tsx` | Budget threshold alert management |
| Alert History | `alert-history.tsx` | Triggered alerts log |

### Web Pages (5)

| Page | Path | Features |
|------|------|----------|
| Hub | `/budget` | Envelope list, recent transactions, alerts, quick add |
| Accounts | `/budget/accounts` | Account management, balances |
| Transactions | `/budget/transactions` | Transaction list with search/filter |
| Catch-all | `/budget/[...slug]` | Sub-routes via ModuleWebFallback |

### Engines

- **Spending Pulse** -- Hero metric: ahead/behind budget this month
- **No-Spend Streak** -- Streak counter, monthly gamification
- **Spending Heatmap** -- Calendar heatmap data (daily intensity)
- **Weekly Digest** -- Weekly spending summary
- **Subscription ROI** -- Usage-based return on investment scoring
- **Recurring Detection** -- Auto-detect recurring transactions
- **Payday Detection** -- Income pattern recognition
- **Age of Money** -- YNAB-style metric
- **Debt Payoff Calculator** -- Snowball/avalanche payoff scheduling
- **Net Worth Tracker** -- Point-in-time net worth snapshots

---

## 3. MyCar

**Tagline:** Your garage, fully tracked
**Icon:** 🚗 | **Accent:** #3B82F6 | **Tier:** Premium | **Storage:** SQLite (cr_) | **Tables:** 15+

### Mobile Screens (19)

| Screen | File | Key Features |
|--------|------|-------------|
| Home | `index.tsx` | Vehicle selector, next due maintenance, fuel economy summary, quick stats |
| Vehicles | `vehicles.tsx` | Multi-vehicle list with make/model/year, mileage |
| Add Vehicle | `vehicle/add.tsx` | Make, model, year, VIN, mileage, fuel type |
| Vehicle Detail | `vehicle/[id].tsx` | Full specs, service history timeline, cost summary |
| Service History | `service-history.tsx` | Chronological service log with type/date/cost/mileage |
| Add Service | `service/add.tsx` | Service type (oil/tires/brakes/etc.), date, cost, mileage, notes |
| Fuel Log | `fuel.tsx` | Fuel fill-ups with MPG calculation, price comparison |
| Add Fuel | `fuel/add.tsx` | Gallons, price, odometer, station |
| Maintenance Schedule | `maintenance.tsx` | Upcoming maintenance items, interval-based reminders |
| Trip Log | `trips.tsx` | Trip list with purpose (business/personal), distance, cost |
| Add Trip | `trip/add.tsx` | Start/end odometer, purpose, date, GPS tracking |
| Documents | `documents.tsx` | Insurance, registration, inspection documents |
| Add Document | `document/add.tsx` | Upload with type classification |
| Tires | `tires.tsx` | Tire tracking (brand, tread, rotation schedule) |
| Parking Saver | `parking.tsx` | GPS parking location with timer |
| Fuel Prices | `fuel-prices.tsx` | Nearby fuel price comparison |
| VIN Decoder | `vin.tsx` | VIN lookup for vehicle specs |
| OBD-II | `obd.tsx` | Diagnostic code reader (Bluetooth) |
| Settings | `settings.tsx` | Units, default vehicle, notification prefs |

### Web Pages (8)

| Page | Path | Features |
|------|------|----------|
| Hub | `/car` | Dashboard with vehicle overview |
| Vehicles | `/car/vehicles` | Vehicle management |
| Service | `/car/service` | Service history and scheduling |
| Fuel | `/car/fuel` | Fuel economy tracking |
| Trips | `/car/trips` | Trip log |
| Documents | `/car/documents` | Document vault |
| Reminders | `/car/reminders` | Maintenance reminders |

### Engines

- **Reminder Engine** -- Interval-based scheduling (mileage OR time), snooze, auto-link to completed actions
- **Fuel Economy Calculator** -- MPG/L per 100km, cost per mile
- **Cost Analysis Engine** -- Total cost of ownership breakdown

---

## 4. MyCloset

**Tagline:** Dress intentionally, waste nothing
**Icon:** 👔 | **Accent:** #EC4899 | **Tier:** Premium | **Storage:** SQLite (cl_, v3) | **Tables:** 12+

### Mobile Screens (14)

| Screen | File | Key Features |
|--------|------|-------------|
| Home | `index.tsx` | Total items, outfits, wardrobe value, 30-day activity, donation count, quick actions |
| Wardrobe | `wardrobe.tsx` | Clothing inventory browser with filter by category/color/season |
| Add Item | `item/add.tsx` | Name, category, color, brand, purchase date, price, size, season, care instructions, photo |
| Item Detail | `item/[id].tsx` | Full item info, wear count, cost-per-wear, laundry status, wears-since-wash |
| Outfits | `outfits.tsx` | Outfit collection browser |
| Create Outfit | `outfit/create.tsx` | Combine items into outfit, name, occasion, season |
| Outfit Detail | `outfit/[id].tsx` | Items in outfit, wear history, rating |
| Laundry | `laundry.tsx` | Dirty items queue, care instructions, auto-dirty after N wears |
| Packing Lists | `packing.tsx` | Trip packing list generator (season-aware from wardrobe) |
| Wishlist | `wishlist.tsx` | Shopping wishlist with priority levels, purchase tracking |
| Capsule Builder | `capsule.tsx` | Capsule wardrobe: versatility scoring, gap analysis, combo estimation |
| Color Analysis | `colors.tsx` | 80+ color names, distribution, harmony pairs, insights |
| Donations | `donations.tsx` | Donation candidates (items unworn > threshold) |
| Settings | `settings.tsx` | Default season, donation threshold, export/import |

### Web Pages (5)

| Page | Path | Features |
|------|------|----------|
| Hub | `/closet` | Dashboard metrics and quick actions |
| Wardrobe | `/closet/wardrobe` | Full inventory browser |
| Outfits | `/closet/outfits` | Outfit management |
| Stats | `/closet/stats` | Wardrobe analytics |

### Engines

- **Cost-Per-Wear** -- Leaderboard, by-category averages, median/summary
- **Seasonal Rotation** -- Season detection, rotation checks, hemisphere support
- **Weather Recommendations** -- 5-range temp scoring, season matching, layer labels
- **AI Outfit Suggestions** -- Color harmony, recency weighting, feedback learning
- **Capsule Builder** -- Versatility scoring, gap analysis, combo estimation
- **Color Palette Analysis** -- 80+ colors mapped, distribution, insights, harmony
- **Packing Generator** -- Season-aware suggestions from wardrobe
- **Donation Detection** -- Configurable unworn threshold (default 365 days)

---

## 5. MyCycle

**Tagline:** Your body, your data, your device
**Icon:** 🌙 | **Accent:** #F472B6 | **Tier:** Premium | **Storage:** SQLite (cy_) | **Tables:** 10+

### Mobile Screens (12)

| Screen | File | Key Features |
|--------|------|-------------|
| Home | `index.tsx` | Current phase indicator, cycle day, next period prediction, fertile window, quick log |
| Calendar | `calendar.tsx` | Monthly calendar with period days, fertile window, symptom markers |
| Log | `log.tsx` | Log flow level (light/medium/heavy/spotting), symptoms (13+), mood |
| History | `history.tsx` | Cycle history list with length, period length, stats |
| Analytics | `analytics.tsx` | Avg cycle length, std dev, shortest/longest, symptom frequency |
| Temperature | `temperature.tsx` | BBT logging, coverline calculation, shift detection |
| Predictions | `predictions.tsx` | Weighted moving average prediction, fertile window estimation |
| Partner Sync | `partner.tsx` | Share codes, granular privacy controls |
| Pregnancy Mode | `pregnancy.tsx` | Week-by-week tracking, 4 due date methods, appointments |
| Symptoms | `symptoms.tsx` | 13+ symptoms across physical/mood, 3 intensity levels |
| Insights | `insights.tsx` | Phase pattern analysis, cycle length trends, regularity scoring |
| Settings | `settings.tsx` | Cycle length default, notification prefs, partner settings |

### Web Pages (11)

Full mirror of mobile functionality across 11 routes.

### Engines

- **Prediction Engine** -- Weighted moving average (last 6 cycles, recency bias)
- **Fertile Window Estimator** -- Based on cycle length and temperature data
- **Phase Calculator** -- Menstrual/follicular/ovulation/luteal tracking
- **Temperature Analysis** -- BBT coverline, thermal shift detection
- **Cycle Trend Detection** -- Lengthening/shortening/stable via linear regression
- **Regularity Scoring** -- Cycle regularity with trend tracking
- **Symptom Phase Patterns** -- Which symptoms cluster in which phases
- **Cross-Module Phase Signal** -- Phase data available to hub for other modules
- **Human-Readable Insights** -- Generated text for predictions, windows, trends

---

## 6. MyFast

**Tagline:** Fasting & hydration, completely private
**Icon:** ⏱️ | **Accent:** #F97316 | **Tier:** Free | **Storage:** SQLite (ft_) | **Tables:** 13

### Mobile Screens (10)

| Screen | File | Key Features |
|--------|------|-------------|
| Timer | `index.tsx` | Active fast timer with zone progression (6 zones), protocol selector, eating window awareness, goal progress, water counter |
| Caffeine | `caffeine.tsx` | Daily caffeine tracking, metabolization timeline, clear-by-time calculator, status (safe/caution/limit) |
| History | `history.tsx` | Completed fasts with protocol, duration, quality score, notes |
| Stats | `stats.tsx` | Streak tracking (current/longest), weekly summary, total hours, quality trends |
| Weight | `weight.tsx` | Weight entries, unit conversion (lbs/kg), HealthKit sync, trend chart |
| Settings | `settings.tsx` | Protocol management, notifications (start/25%/50%/75%/complete), HealthKit sync, Apple Watch, water reminders, CSV export |

### Web Pages (6)

| Page | Path | Features |
|------|------|----------|
| Hub | `/fast` | Timer, active fast display, quick actions |
| History | `/fast/history` | Detailed fast history with analytics |
| Stats | `/fast/stats` | Statistics dashboard (streaks, zones, goals) |
| Settings | `/fast/settings` | All settings |

### Engines

- **Fasting Zone Engine** -- 6 zones (Fed State through Extended Fasting)
- **Quality Score** -- Composite 0-100 (target hit + hydration + caffeine + streak)
- **Protocol Progression** -- Suggest next protocol after sustained adherence
- **Caffeine Metabolism** -- 5.7-hour half-life decay, clear-by-time calculation
- **Smart Water Reminders** -- Personalized targets, configurable intervals
- **Week-in-Review** -- Weekly summary engine
- **HealthKit Sync** -- Weight import, activity context, fast export
- **Apple Watch Sync** -- State transfer, watch commands

---

## 7. MyFlash

**Tagline:** Never forget what matters
**Icon:** 🧠 | **Accent:** #8B5CF6 | **Tier:** Premium | **Storage:** SQLite (fl_, v5) | **Tables:** 20+

### Mobile Screens (13)

| Screen | File | Key Features |
|--------|------|-------------|
| Study | `study.tsx` | FSRS card carousel, 4-grade review (again/hard/good/easy), TTS pronunciation, undo rating, session stats |
| Decks | `decks.tsx` | Deck hierarchy (parent/child), creation, deck stats (new/learning/review/suspended) |
| Browse | `browser.tsx` | Card browser with filters (deck/tags/queue), search, bulk actions (bury/suspend/star) |
| Stats | `stats.tsx` | Streaks, due card count, reviewed today, accuracy trends |
| Settings | `settings.tsx` | Daily limits (new/review), study targets, reminders, Anki .apkg import/export |
| Card Stats | `card-stats.tsx` | Individual card history, retention rate, ease factor trend |
| Forgetting Curve | `forgetting-curve.tsx` | Personal retention curves per ease bucket, half-life estimation |
| Schedule | `schedule.tsx` | Due card forecast (7/14/30-day), optimal study time |
| Session Analytics | `session-analytics.tsx` | Session review with accuracy, duration, lapse counts |
| Cross-Module Signals | `signals.tsx` | Retention/streak/readiness 0-100 for other modules |
| Import/Export | `import-export.tsx` | Anki .apkg import with deck hierarchy, HTML stripping |
| Jump Back In | (card) | Last studied deck, progress bar, Continue button |
| Match Game | (mode) | Pair matching with star ratings and best times |

### Web Pages (6)

Full study interface, deck management, card browser, analytics, settings, import/export.

### Card Types

- Basic (front/back), Reversed (auto-generate back to front), Cloze (fill-in-blank), Image Occlusion (hide regions), Multiple Choice (4 options), Match Game, Custom Templates

### Engines

- **FSRS Scheduler** -- Ease factor clamping (1.3-3.2), interval calculation, queue states
- **Study Analytics** -- Retention rate, review forecast, accuracy trends, difficulty/maturity distribution
- **Forgetting Curve** -- Personal retention curves, half-life estimates, prediction
- **Session Detection** -- Gap-based detection, duration estimates, optimal study time
- **Competitive Leagues** -- 5 tiers, XP system (base + correct bonus + streak multiplier)
- **AI Card Generation** -- From text (on-device + cloud)
- **AI Practice Tests** -- MC, T/F, short answer, fill blank
- **AI Conversation** -- Tutor/quiz/explain/debate modes
- **Anki Import** -- .apkg parser with deck hierarchy, card types, scheduling state

---

## 8. MyForums

**Tagline:** Human-verified community, bot-free by design
**Icon:** 💬 | **Accent:** #7C4DFF | **Tier:** Free | **Storage:** Supabase + SQLite cache | **Tables:** 9 cache + cloud

### Mobile Screens (13)

| Screen | File | Key Features |
|--------|------|-------------|
| Feed | `feed.tsx` | Real-time thread feed, vote counts, reply counts, human verified badge, pinned indicators |
| Communities | `communities.tsx` | Searchable browser, member/thread counts, "Humans Only" badge, join/leave |
| Search | `search.tsx` | Full-text search over threads/replies with relevance ranking |
| Saved | `saved.tsx` | Bookmarked threads by community |
| Profile | `profile.tsx` | Post history, badges, verification status |
| Activity Feed | `activity-feed.tsx` | Activity timeline |
| Thread Detail | `thread-detail.tsx` | Nested replies, voting, bookmarking |
| Create Thread | `create-thread.tsx` | Title, body, community selector |
| Create Community | `create-community.tsx` | Name, description, rules, humans-only toggle |
| Community Detail | `community-detail.tsx` | Info, rules, member list |
| Community Settings | `community-settings.tsx` | Mod controls (rules, tags, templates) |
| Community Health | `community-health.tsx` | % verified, response time, mod frequency |
| Mod Log | `mod-log.tsx` | Public moderation log (transparent) |
| Messages | `messages.tsx` | DM inbox, conversations |
| New Message | `new-message.tsx` | Start new DM |
| Edit Profile | `edit-profile.tsx` | Display name, avatar, bio |
| User Profile | `user-profile.tsx` | View other user's profile |

### Web Pages (17)

Full mirror: main feed, community CRUD, thread CRUD, search, saved, profiles, DMs, mod tools.

### Key Differentiators

- **Binary Human Verification** -- Device attestation (passkey/fingerprint/Face ID)
- **"Humans Only" Mode** -- Guaranteed bot-free communities
- **Cross-Module Content Cards** -- Inline book/recipe/workout previews in threads
- **Community Health Dashboard** -- Trust metrics replace engagement metrics
- **Transparent Mod Log** -- Browsable public log in every community
- **Community Templates** -- Auto-seeded module communities

---

## 9. MyGarden

**Tagline:** Grow with confidence
**Icon:** 🌱 | **Accent:** #84CC16 | **Tier:** Premium | **Storage:** SQLite (gd_) | **Tables:** 15+

### Mobile Screens (26)

| Screen | File | Key Features |
|--------|------|-------------|
| Home | `index.tsx` | Active plant count, overdue watering alerts, harvest ready, garden stats |
| Plants | `plants.tsx` | Plant inventory browser with filter by zone/type/status |
| Add Plant | `plant/add.tsx` | Species, variety, planting date, zone, soil type, photo |
| Plant Detail | `plant/[id].tsx` | Care schedule, growth log, watering history, health status |
| Watering | `watering.tsx` | Today's watering schedule, check-off, overdue items |
| Garden Layout | `layout.tsx` | Visual garden bed planner (drag-and-drop) |
| Harvest | `harvest.tsx` | Harvest log with quantity, date, quality |
| Zones | `zones.tsx` | Garden zone management (raised bed, in-ground, containers, indoor) |
| Companion Planting | `companions.tsx` | Companion planting guide (compatible/incompatible pairs) |
| Tasks | `tasks.tsx` | Garden task list (prune, fertilize, transplant, etc.) |
| Seasonal Calendar | `calendar.tsx` | Region-aware planting calendar |
| Diagnose | `diagnose.tsx` | AI plant disease/pest identification from photo |
| Weather | `weather.tsx` | Local weather overlay for garden planning |
| Wishlist | `wishlist.tsx` | Plants to acquire |
| Seed Library | `seeds.tsx` | Seed inventory with viability tracking |
| Photos | `photos.tsx` | Garden photo journal with before/after |
| Propagation | `propagation.tsx` | Propagation tracking (cuttings, divisions) |
| Light Levels | `light.tsx` | Light level estimation per zone |
| Frost Dates | `frost.tsx` | First/last frost date alerts by region |
| Journal | `journal.tsx` | Garden journal entries |
| Export | `export.tsx` | CSV export of garden data |
| Settings | `settings.tsx` | Climate zone, notification prefs, units |

### Web Pages (15)

Full mirror of mobile screens with desktop-optimized layouts.

### Engines

- **Plant Diagnosis Engine** -- AI photo-based disease/pest identification
- **Light Classification** -- Light level estimation by zone
- **Companion Matrix** -- Compatible/incompatible plant pairing database
- **Watering Scheduler** -- Interval-based watering with weather adjustment
- **Seasonal Calendar** -- Region-aware planting windows

---

## 10. MyHabits

**Tagline:** Build the life you want, one habit at a time
**Icon:** ✅ | **Accent:** #10B981 | **Tier:** Premium | **Storage:** SQLite (hb_, v7) | **Tables:** 29

### Mobile Screens (24)

| Screen | File | Key Features |
|--------|------|-------------|
| Home | `index.tsx` | Today's habits by area, date nav bar, completion toggles, FAB for quick add, undo toast |
| Add Habit | `add-habit.tsx` | 4 types (standard/timed/negative/measurable), frequency, time-of-day, grace period, area picker, template picker, NLP magic fill |
| Habit Detail | `[id].tsx` | Streak, heatmap, completion rate, multiple reminders, start/end dates, sub-tasks |
| Stats | `stats.tsx` | Overall completion rate, daily/time/month breakdowns, GitHub-style heatmap |
| Sobriety | `sobriety.tsx` | Sobriety clock, money saved, daily pledges, lifetime stats |
| Craving Log | `craving.tsx` | Triggers, intensity tracking, coping strategies |
| Timer | `timer.tsx` | Focus timer (Pomodoro: work/break/long-break phases) |
| Time Tracking | `time-tracking.tsx` | Billable project tracking with CSV reports |
| Challenges | `challenges.tsx` | 8 built-in programs (meditation, C25K, morning routine, etc.) |
| Badges | `badges.tsx` | 37 badges across 5 categories |
| Pet/Avatar | `pet.tsx` | 5 species, mood system, wardrobe collection |
| Milestones | `milestones.tsx` | Streak, completion, sobriety, money, custom celebrations |
| Stacking | `stacking.tsx` | Atomic Habits methodology, chain sequencing |
| Areas | `areas.tsx` | 6 area categories with grouping |
| Templates | `templates.tsx` | 24 templates across 6 areas, expandable picker |
| Onboarding | `onboarding.tsx` | 4-step flow with starter habits |
| Action Items | `action-items.tsx` | Ordered checklists per habit |
| Location Reminders | `location.tsx` | Geofence triggers |
| Siri Shortcuts | `siri.tsx` | Voice completion shortcuts |
| HealthKit Auto-Track | `healthkit.tsx` | Steps, sleep, water, exercise auto-logging |
| RPG | `rpg.tsx` | XP, levels, unlockable items |
| Export | `export.tsx` | CSV export |
| Settings | `settings.tsx` | Default frequency, grace period, notification prefs |

### Web Pages (13)

Full mirror with desktop-optimized heatmaps, charts, and program management.

### Engines

- **Streak Engine** -- Grace period + streak freeze/insurance calculation
- **Focus Timer** -- Pomodoro with configurable phases
- **Sobriety Engine** -- Clock, money saved, pledges
- **RPG/Gamification** -- XP, levels, unlockable items
- **HealthKit Auto-Tracking** -- Steps, sleep, water, exercise
- **NLP Magic Fill** -- Regex/heuristic parser for natural language habit input
- **Location Reminders** -- Geofence-based triggers
- **Time Tracking** -- Billable hours with project categorization

---

## 11. MyHealth

**Tagline:** Your health data, on your device, under your control
**Icon:** ❤️ | **Accent:** #EF4444 | **Tier:** Premium | **Storage:** SQLite (hl_, v3) | **Tables:** 21

### Mobile Screens (27)

| Screen | File | Key Features |
|--------|------|-------------|
| Today | `index.tsx` | Active fast, due meds, mood, vitals (steps/HR), sleep quality, goals, quick actions |
| Vitals | `vitals.tsx` | Vitals history by type (10 types: HR, RHR, HRV, O2, BP, temp, steps, energy, RR, VO2) |
| Vital Detail | `vital-detail.tsx` | Trend analysis, baseline comparison |
| Measurement Log | `measurement-log.tsx` | Log new vital with type, value, timestamp |
| Sleep Stages | `sleep-stages.tsx` | Deep/REM/light breakdown, quality score |
| Smart Alarm | `smart-alarm.tsx` | Wake window calculation, sleep-aware alarm |
| Breathing | `breathing.tsx` | 5 patterns (box, 4-7-8, relaxing, energizing, sleep) with mood tracking |
| Body Composition | `body-composition.tsx` | BMI, lean mass, body fat tracking |
| Readiness | `readiness.tsx` | Daily 0-100 score (sleep + HRV + RHR + activity + strain) |
| HRV | `hrv.tsx` | HRV analysis, baseline, percentile rank, insights |
| Activity | `activity.tsx` | Daily rings (energy/exercise/movement), step aggregation, streaks |
| Mood Check-In | `mood-check-in.tsx` | Quick 1-10 mood rating |
| Grounding/SOS | `grounding.tsx` | 5-step sensory grounding, crisis hotlines |
| Vault | `vault.tsx` | Document vault (lab results, prescriptions, insurance, imaging) |
| Document Viewer | `document-viewer.tsx` | View/zoom health documents |
| Add Document | `add-document.tsx` | Upload/scan with type classification |
| Emergency Info | `emergency-info.tsx` | ICE contacts, allergies, blood type, medical conditions |
| Add Goal | `add-goal.tsx` | Health goals (fasting/weight/steps/sleep/adherence/water/vitals/custom) |
| Health Sync | `health-sync-settings.tsx` | HealthKit/Health Connect integration |
| Snore Detection | `snore.tsx` | Session recording, event classification, score |
| Export | `export.tsx` | PDF/CSV for doctors |
| Migration Prompt | `migration-prompt.tsx` | Welcome for absorbed meds/fast/cycle modules |

### Web Pages (8)

Dashboard, vitals, sleep, goals, mood, emergency, export, sync settings.

### Engines

- **Health Score** -- Composite 0-100 from 6 domains (sleep, mood, adherence, activity, readiness, mindfulness)
- **Correlation Engine** -- Pearson correlation between health time series with significance testing
- **Weekly Digest** -- Cross-domain summary with highlights/concerns
- **Doctor Report Generator** -- Comprehensive visit report (vitals, sleep, activity, meds, mood, emergency)
- **Readiness Engine** -- Sleep + HRV + RHR + activity + strain composite
- **Activity Ring Engine** -- 3 rings, progress, streak calculation
- **Sleep Analysis** -- Stage breakdown, efficiency, trends, sleep bank (debt/surplus)
- **Smart Alarm** -- Light sleep wake window
- **Snore Detection** -- Event classification (light/moderate/heavy), session scoring
- **CBT Exercises** -- Thought record, behavioral activation, cognitive restructuring
- **Meditation Engine** -- 8 types (body scan, loving kindness, mindful awareness, etc.)
- **Body Measurements** -- BMI calculation, lean mass, unit conversion

---

## 12. MyHomes

**Tagline:** Real estate, reimagined
**Icon:** 🏠 | **Accent:** #F59E0B | **Tier:** Premium | **Storage:** SQLite (hm_) | **Tables:** 16

### Mobile Screens (38)

| Screen | File | Key Features |
|--------|------|-------------|
| Home | `index.tsx` | Property selector, overdue/due-soon tasks, cost summary, property stats |
| Properties | `properties.tsx` | Property list with type icons (house/condo/apartment/townhouse) |
| Add Property | `property/add.tsx` | Name, address, type, ownership (own/rent), year built, sqft |
| Property Detail | `property/[id].tsx` | Address, specs, linked listings, notes, cost history/graph |
| Maintenance | `maintenance.tsx` | Tasks by status (overdue/due soon/upcoming), urgency sort |
| Add Maintenance | `maintenance/add.tsx` | Task type (50+ presets), interval (months), season, reminders |
| Maintenance Detail | `maintenance/[id].tsx` | Next due, last completed, interval, snooze, mark complete |
| Cost Index | `cost/index.tsx` | Cost history list with filters |
| Add Cost | `cost/add.tsx` | Amount, category, date, linked schedule, notes |
| Cost Detail | `cost/[id].tsx` | Date, amount, category, schedule, notes |
| Cost Predictor | `cost-predictor.tsx` | Project next month/year costs |
| Contractors | `contractor/index.tsx` | Directory with specialties |
| Add Contractor | `contractor/add.tsx` | Name, phone, email, specialties (HVAC/plumbing/roof/etc.) |
| Contractor Detail | `contractor/[id].tsx` | Contact, specialties, past jobs, rating |
| Documents | `document/index.tsx` | Mortgages, deeds, insurance, permits |
| Add Document | `document/add.tsx` | Upload with type and property |
| Document Viewer | `document/[id].tsx` | Document viewer |
| Insurance | `insurance/index.tsx` | Active policies with expiry dates |
| Add Insurance | `insurance/add.tsx` | Type (homeowners/liability/flood), coverage, premium, renewal |
| Insurance Detail | `insurance/[id].tsx` | Coverage limits, deductible, renewal, contact |
| Inventory | `inventory/index.tsx` | Room-based inventory browser |
| Room Detail | `inventory/room/[id].tsx` | Items in room: furniture, appliances, condition, value |
| Add Item | `inventory/item/add.tsx` | Room, category, name, condition, purchase date, value |
| Item Detail | `inventory/item/[id].tsx` | Room, category, condition, value, warranty, serial |
| Appliances | `appliance/index.tsx` | Appliance list with manuals |
| Add Appliance | `appliance/add.tsx` | Model, serial, purchase date, warranty, manual upload |
| Appliance Detail | `appliance/[id].tsx` | Specs, manual, maintenance history |
| Renovation Projects | `renovation/index.tsx` | Project planning with phases/budget |
| Add Project | `renovation/add.tsx` | Name, budget, timeline, contractor |
| Project Detail | `renovation/[id].tsx` | Phase progress, budget tracking, photos |
| Settings | `settings.tsx` | Default property, notification prefs |

### Web Pages (10)

Dashboard, properties, maintenance, costs, contractors, documents, insurance, inventory, projects, settings.

### Engines

- **Maintenance Scheduler** -- Interval-based (by months), season-aware, snooze support
- **Cost Predictor** -- Project future costs from schedule patterns
- **Cost Analysis** -- Spending by category, property comparison

---

## 13. MyJournal

**Tagline:** Write freely, privately, yours forever
**Icon:** 📓 | **Accent:** #A78BFA | **Tier:** Free | **Storage:** SQLite (jl_) | **Tables:** 15+

### Mobile Screens (17)

| Screen | File | Key Features |
|--------|------|-------------|
| Today | `index.tsx` | Dashboard: streak counter, word count, recent entries, daily prompt, quick actions |
| Entries | `entries.tsx` | Entry list with mood indicators, search, filter by notebook/tag |
| New Entry | `new.tsx` | Markdown editor, mood tag (5 levels), custom tags with colors, image attachments |
| Entry Detail | `[id].tsx` | Full entry view with metadata (location, weather, timezone) |
| Search | `search.tsx` | Full-text search across title/body |
| Notebooks | `notebooks.tsx` | Multiple notebooks management |
| On This Day | `on-this-day.tsx` | Historical entries with smart nostalgia ranking |
| Prompts | `prompts.tsx` | Daily prompts (reflection/gratitude/therapy/stoic), AI-powered mood-aware |
| Voice Entry | `voice.tsx` | Voice-to-text with recording management, transcription pipeline |
| Grid/Mandala | `grid.tsx` | Grid/mandala layout with built-in templates |
| Vision Board | `vision-board.tsx` | Image/text/quote/goal items |
| Affirmations | `affirmations.tsx` | 8 categories with streak tracking |
| Philosophy | `philosophy.tsx` | Stoic/philosophy quotes across 5 traditions |
| CBT Records | `cbt.tsx` | Thought records with 15 cognitive distortions, belief tracking |
| Therapy Prep | `therapy.tsx` | Pre/post session templates, crisis plan, progress check-in |
| Book Builder | `book-builder.tsx` | Page layout estimation, cover templates |
| Settings | `settings.tsx` | Default notebook, export bundle, privacy controls |

### Web Pages (4)

| Page | Path | Features |
|------|------|----------|
| Today | `/journal` | Dashboard with daily prompt and recent entries |
| Entries | `/journal/entries` | Full entry browser |
| Search | `/journal/search` | FTS search |
| Settings | `/journal/settings` | Preferences and export |

### Engines

- **Writing Insights** -- Word count trends, vocabulary richness, tag analysis
- **Therapeutic Progress** -- CBT completion rates, belief reduction, distortion ranking
- **Journaling Habit Intelligence** -- Consistency scoring, entry richness, best writing day/time
- **Mood-Writing Correlation** -- Tag-mood analysis, prompt category impact
- **Writing Challenges** -- 6 challenges (gratitude, CBT, stoic, photo, mood, explorer)

---

## 14. MyMail

**Tagline:** Email that respects you
**Icon:** 📧 | **Accent:** #6366F1 | **Tier:** Premium | **Storage:** SQLite (ml_) | **Tables:** 10+

### Mobile Screens (21)

| Screen | File | Key Features |
|--------|------|-------------|
| Inbox | `index.tsx` | Message list with sender, subject, preview, date, read/unread |
| Compose | `compose.tsx` | New message form (to, cc, bcc, subject, body) |
| Message Detail | `[id].tsx` | Full message view with reply/forward actions |
| Accounts | `accounts.tsx` | IMAP account list, connection status |
| Add Account | `account/add.tsx` | IMAP server setup (host, port, credentials) |
| Search | `search.tsx` | Full-text search across messages |
| Folders | `folders.tsx` | Inbox, sent, drafts, trash, custom folders |
| Labels | `labels.tsx` | Label management with colors |
| Filters | `filters.tsx` | Filter rules (from/subject/body match to action) |
| Settings | `settings.tsx` | Sync interval, notification prefs, signature |
| Analytics | `analytics.tsx` | Inbox analytics (volume, response time, top senders) |
| Templates | `templates.tsx` | Email template management |
| Contacts | `contacts.tsx` | Contact directory extracted from emails |
| Blocked | `blocked.tsx` | Blocked senders management |
| Scheduled | `scheduled.tsx` | Send-later queue |
| Signatures | `signatures.tsx` | Email signature editor |
| Threading | `threading.tsx` | Conversation threading view |
| Attachments | `attachments.tsx` | Attachment browser across messages |
| Smart Inbox | `smart.tsx` | Priority sorting (important/other) |
| Calendar | `calendar.tsx` | Calendar events extracted from emails |
| Notifications | `notifications.tsx` | Push notification configuration |

### Web Pages (14)

Full mirror: inbox, compose, message detail, accounts, search, folders, labels, filters, analytics, templates, contacts, settings.

---

## 15. MyMarket

**Tagline:** Buy and sell, human to human
**Icon:** 🏪 | **Accent:** #14B8A6 | **Tier:** Free | **Storage:** Supabase + SQLite cache | **Tables:** 16 cache + cloud

### Mobile Screens (17)

| Screen | File | Key Features |
|--------|------|-------------|
| Home | `index.tsx` | Recent listings, categories, watchlist preview |
| Browse | `browse.tsx` | Listing browser with search, filter by category/price/location |
| Listing Detail | `[id].tsx` | Photos, description, price, seller info, message button |
| Create Listing | `sell.tsx` | 6 types (sell/trade/free/wanted/service_offer/service_request), photos, description, price |
| Watchlist | `watchlist.tsx` | Saved listings with cloud sync |
| Messages | `messages.tsx` | E2E encrypted messaging (Signal-style ECDH) |
| Conversation | `conversation/[id].tsx` | Chat with seller/buyer |
| Profile | `profile.tsx` | Seller profile, ratings, verification tier |
| Reviews | `reviews.tsx` | Seller/buyer reviews |
| Offers | `offers.tsx` | Offers system with counter-offers and expiration |
| Tracking | `tracking.tsx` | Delivery tracking (6 carriers: USPS/UPS/FedEx/DHL/Amazon/other) |
| Disputes | `disputes.tsx` | 7-state dispute machine, auto-timeout, refund |
| Saved Searches | `saved-searches.tsx` | Saved search with match notifications |
| Services | `services.tsx` | Service provider discovery (portfolios, areas, availability) |
| Report | `report.tsx` | Report and block system |
| Settings | `settings.tsx` | Privacy, payment, notification prefs |

### Web Pages (1)

Currently only catch-all page. Backend is 90% complete; UI is the primary gap.

### Key Systems

- **Signal-Style E2E Encryption** -- ECDH + HKDF + AES-256-GCM + safety numbers
- **Stripe Connect** -- Escrow, fee splitting, webhooks
- **Seller Verification** -- 5 tiers (unverified/basic/verified/trusted/top_seller)
- **Dispute Resolution** -- 7-state machine with auto-timeout and refund calculation
- **PostGIS Location Search** -- Radius-based listing discovery

---

## 16. MyMeds

**Tagline:** Your private health command center
**Icon:** 💊 | **Accent:** #06B6D4 | **Tier:** Premium | **Storage:** SQLite (md_, v4) | **Tables:** 22+

### Mobile Screens (38)

| Screen | File | Key Features |
|--------|------|-------------|
| Today | `index.tsx` | Active meds, dose logs, low supply alerts, adherence summary |
| Medications | `medications.tsx` | All meds with status (active/inactive), quick log |
| Add Med | `add-med.tsx` | Dosage, frequency, prescriber, pharmacy |
| Refills | `refills.tsx` | Burn rate, days remaining, low supply alerts |
| Appointments | `appointments.tsx` | Doctor visits, lab tests |
| Adherence | `adherence.tsx` | Rate (%), streaks, calendar view, daily breakdown |
| Diary | `diary.tsx` | Timestamped medication journal |
| History | `history.tsx` | Historical dose log with filtering |
| Mood Check-In | `mood-check-in.tsx` | Mood entry linked to medications |
| Mood History | `mood.tsx` | Mood trends related to med intake |
| Measurement Trends | `measurement-trends.tsx` | Vitals trends with medication markers |
| Log BP | `log-bp.tsx` | Blood pressure (systolic/diastolic/pulse, AHA classification) |
| BP History | `bp-history.tsx` | BP history with classification display |
| BP Trends | `bp-trends.tsx` | Period stats, direction, period comparison |
| Log Glucose | `log-glucose.tsx` | Glucose with meal context (fasting/before/after meal/bedtime) |
| Glucose History | `glucose-history.tsx` | Time-in-range analysis |
| Log Insulin | `log-insulin.tsx` | Type, units, injection site rotation, carbs covered |
| Insulin History | `insulin-history.tsx` | IOB calculation, daily totals |
| A1c | `a1c.tsx` | Estimated A1c from readings, GMI, confidence |
| Interactions | `interactions.tsx` | Drug interaction checker (200+ pairs, severity) |
| Correlation | `correlation.tsx` | Mood-med, symptom-med correlations |
| Pain Map | `pain-map.tsx` | Body zone heatmap, severity, medication correlation |
| Weather | `weather.tsx` | Weather-symptom correlation, trigger profiles, forecast alerts |
| FODMAP | `fodmap.tsx` | Food tracking, FODMAP classification, trigger correlation, Bristol stool |
| CGM | `cgm.tsx` | Stats, trend arrows, time-in-range, AGP |
| Caregivers | `caregivers.tsx` | Alert management, weekly summary delivery |
| Contacts | `contacts.tsx` | Doctor/Pharmacy/Emergency/Insurance/Clinic directory |
| Export | `export.tsx` | Doctor/therapy markdown reports |
| Reports | `reports.tsx` | Pre-generated report templates, share via expo-sharing |
| Wellness | `wellness.tsx` | Composite 0-100 score |
| Notification Settings | `notification-settings.tsx` | Reminder configuration |
| Notification Setup | `notification-setup.tsx` | Initial reminder flow |
| Onboarding | `onboarding.tsx` | First-time setup wizard |
| Passcode Lock | `passcode-lock.tsx` | PIN/biometric access control |
| Home Style | `home-style.tsx` | Customizable home screen layout |
| Settings | `settings.tsx` | Module preferences |

### Web Pages (16)

Dashboard, history, BP (+ trends), glucose, insulin, A1c, measurements, mood, caregivers, CGM, FODMAP, pain, weather, export.

### Engines

- **Medication Insights** -- Weekend/timing patterns, per-med adherence, refill alerts
- **Regimen Summary** -- Daily health briefing, vitals snapshot, alerts
- **Wellness Score** -- Composite 0-100 (adherence + vitals + mood + symptoms)
- **BP Engine** -- AHA classification, averages, category distribution, trend direction
- **Glucose/A1c** -- Glucose classification, time-in-range, A1c estimation, GMI
- **Insulin Engine** -- IOB calculation, injection site rotation, daily totals
- **CGM Engine** -- Trend arrows, time-in-range, AGP stats
- **Pain Map** -- Heatmap by zone, severity, medication correlation
- **Weather Correlation** -- Barometric/humidity/temp vs symptoms, trigger profiles
- **FODMAP** -- Food classification, trigger correlation, Bristol stool scale
- **Caregiver Alerts** -- Alert config, delay, delivery, weekly summary
- **Correlation Engine** -- Mood-med, symptom-med, adherence-mood Pearson analysis

---

## 17. MyMood

**Tagline:** Know your mind. Calm your body.
**Icon:** 🎭 | **Accent:** #FB923C | **Tier:** Free | **Storage:** SQLite (mo_, v3) | **Tables:** 15+

### Mobile Screens (25)

| Screen | File | Key Features |
|--------|------|-------------|
| Today | `index.tsx` | Average mood, suggestions card, pet card, today's activities |
| Log Mood | `log-mood.tsx` | Score 1-10, Plutchik emotions (24 across 8 axes, 3 intensities), activities, photo/voice attachments |
| Day Detail | `day-detail.tsx` | All entries for a single day |
| Breathing | `breathing.tsx` | 5 patterns (box, 4-7-8, relaxing, energizing, sleep) with mood tracking |
| Meditation | `meditation.tsx` | Browse meditation templates by category |
| Meditation Session | `meditation-session.tsx` | Active timer with step progress |
| Focus Sounds | `focus.tsx` | 13 ambient sounds across 3 categories |
| Focus Session | `focus-session.tsx` | Layer mixer, timer, pre/post mood |
| Virtual Pet | `pet.tsx` | 6 species, 6 evolution stages, happiness decay, cross-module feeding |
| SOS/Panic | `sos.tsx` | 4-step flow: breathing, 5-4-3-2-1 grounding, affirmation, exit mood check |
| Emergency Contacts | `emergency-contacts.tsx` | SOS contact management |
| Experiments | `experiments.tsx` | A/B lifestyle experiment list, Pearson analysis results |
| Experiment Designer | `experiment-designer.tsx` | Create with hypothesis, baseline/intervention periods |
| Experiment Results | `experiment-results.tsx` | Correlation strength, significance indicator |
| Lock Screen | `lock-screen.tsx` | PIN/biometric lock entry |
| Lock Settings | `lock-settings.tsx` | Configure PIN with lockout policy |
| Insights | `insights.tsx` | 8 AI pattern detectors dashboard |
| Insights Feed | `insights-feed.tsx` | Detailed insight cards with actions |
| Year in Pixels | `year-pixels.tsx` | Calendar visualization with mood colors |
| Weekly Report | `weekly-report.tsx` | Weekly mood summary |
| Top Emotions | `top-emotions.tsx` | Most frequent emotions analysis |
| History | `history.tsx` | Mood entry timeline |
| Suggestions | `suggestions.tsx` | 26-item self-care catalog across 5 categories |
| Settings | `settings.tsx` | Preferences, notification prefs |

### Web Pages (12)

Dashboard, log mood, history, insights, breathing, meditation, focus, experiments, pet, SOS, year-in-pixels, settings.

### Engines

- **Pearson Correlation** -- Mood-activity correlation with significance testing
- **AI Mood Insights** -- 8 detectors: day-of-week, time-of-day, activity impact, emotion cluster, streak, trend, volatility, best/worst day
- **Custom Experiments** -- A/B lifestyle testing with baseline/intervention phases
- **Self-Care Suggestions** -- 26-item catalog, data-driven + cross-module + catalog sources
- **Virtual Pet** -- Species, evolution, happiness decay, feeding mechanics
- **Guided Meditation** -- Step-based timer, templates, pre/post mood tracking
- **Focus Music** -- 13 sounds, 5 presets, layered mixing, custom presets
- **SOS/Panic** -- 4-step grounding flow + crisis hotlines

---

## 18. MyNotes

**Tagline:** Think in markdown, link everything
**Icon:** 📝 | **Accent:** #64748B | **Tier:** Free | **Storage:** SQLite (nt_, v3) | **Tables:** 20+

### Mobile Screens (14)

| Screen | File | Key Features |
|--------|------|-------------|
| Home | `index.tsx` | Recent notes, pinned notes, folder tree, quick create |
| Editor | `editor.tsx` | Markdown editor with toolbar (bold/italic/heading/link/list/code) |
| Note Detail | `[id].tsx` | Full note view with backlinks, tags, word count |
| Search | `search.tsx` | FTS5 full-text search across all notes |
| Folders | `folders.tsx` | Folder hierarchy with nesting, drag-and-drop |
| Tags | `tags.tsx` | Tag browser with co-occurrence analysis, suggestions |
| Graph View | `graph.tsx` | Visual knowledge graph with filtering, local graph, clustering, density stats |
| Templates | `templates.tsx` | 8 built-in templates with variable expansion |
| Daily Note | `daily.tsx` | Get-or-create daily note with date browsing |
| Canvas | `canvas.tsx` | Whiteboard with 6 node types, 5 shapes, 3 edge styles, grouping |
| Databases | `databases.tsx` | Relational databases (Notion-style) with columns/rows/cells/views |
| Checklists | `checklists.tsx` | Toggle, indent/outdent, auto-sort, progress tracking |
| Web Clipper | `clipper.tsx` | HTML-to-markdown conversion |
| Settings | `settings.tsx` | Default folder, sort order, export, plugins |

### Web Pages (12)

Full mirror: editor, search, folders, tags, graph view, templates, daily, canvas, databases, checklists, clipper, settings.

### Engines

- **Knowledge Discovery** -- Staleness scoring, content similarity, suggested links, knowledge gaps
- **Writing Analytics** -- Creation trends, word count distribution, writing velocity, streaks
- **Link Intelligence** -- Connection strength, hub detection, link density, bridge detection
- **Tag Intelligence** -- Usage analytics, co-occurrence, unused tags, suggestions
- **AI Writing Assistant** -- On-device summarize/grammar/simplify
- **OCR** -- Image text extraction with FTS5 search on OCR text
- **Plugin System** -- Install/enable/disable/settings

---

## 19. MyNutrition

**Tagline:** Eat smarter, your way
**Icon:** 🥗 | **Accent:** #65A30D | **Tier:** Premium | **Storage:** SQLite (nu_) | **Tables:** 15+

### Mobile Screens (14)

| Screen | File | Key Features |
|--------|------|-------------|
| Home | `index.tsx` | Today's calories/macros progress rings, meal breakdown, water intake |
| Log Food | `log.tsx` | Search food database (1000+ items), barcode scan, AI photo recognition, meal type |
| Diary | `diary.tsx` | Daily food diary with meal sections |
| Food Detail | `[id].tsx` | Full nutrition facts (200+ nutrients), serving sizes |
| Search | `search.tsx` | FTS5 food search, recent items, favorites |
| Goals | `goals.tsx` | Daily macro/calorie targets, adjust goals |
| Trends | `trends.tsx` | 7/30-day trend analysis (calories, macros, water) |
| Water | `water.tsx` | Water tracking (daily goals, containers, weekly totals) |
| Restaurant | `restaurant.tsx` | Chain restaurant menus with nutrition data |
| Community | `community.tsx` | Profiles, connections, feed, challenges, leaderboards |
| Food Notes | `notes.tsx` | Tags, prompts, FTS search |
| Barcode | `barcode.tsx` | Barcode scanner with product lookup |
| Export | `export.tsx` | CSV export |
| Settings | `settings.tsx` | Units, macro targets, dietary preferences |

### Web Pages (8)

Dashboard, diary, search, goals, trends, water, restaurants, settings.

### Engines

- **Nutrition Correlation Engine** -- 6 cross-module insight detectors (fast-break quality, meal timing vs energy, gym-day calories, restaurant impact, water-snacking, protein-workout)
- **Macro Tracking** -- Calories, protein, carbs, fat, fiber, sugar, sodium + 200 nutrients
- **Trend Analysis** -- 7/30-day rolling averages
- **Food Database** -- USDA + Open Food Facts + FatSecret integration
- **Barcode Scanning** -- Product lookup from barcode
- **AI Photo Food Logging** -- Photo-based food recognition

---

## 20. MyPets

**Tagline:** Every paw, feather, and fin, cared for
**Icon:** 🐾 | **Accent:** #F97316 | **Tier:** Premium | **Storage:** SQLite (pt_) | **Tables:** 12+

### Mobile Screens (13)

| Screen | File | Key Features |
|--------|------|-------------|
| Home | `index.tsx` | Pet cards with next due items, quick stats |
| Pets List | `pets.tsx` | All pets browser (9 species supported) |
| Add Pet | `pet/add.tsx` | Name, species, breed, birthday, weight, photo |
| Pet Detail | `pet/[id].tsx` | Full profile, upcoming reminders, weight chart |
| Vaccinations | `vaccinations.tsx` | Vaccination records with due dates |
| Vet Visits | `vet-visits.tsx` | Vet visit log with notes |
| Medications | `medications.tsx` | Pet medication scheduling |
| Weight | `weight.tsx` | Weight tracking with trend chart |
| Expenses | `expenses.tsx` | Expense analysis by category |
| Health | `health.tsx` | Health records, dietary info, 7 empty states |
| Emergency | `emergency.tsx` | Emergency vet info and contacts |
| Lost Pet Poster | `poster.tsx` | Generate poster with photo, description, contact |
| Settings | `settings.tsx` | Default pet, notification prefs |

### Web Pages (4)

Dashboard, pets, health, settings.

---

## 21. MyPresence

**Tagline:** Put your phone down. Pick your life up.
**Icon:** 📱 | **Accent:** #0891B2 | **Tier:** Premium | **Storage:** SQLite (pr_) | **Tables:** 9

### Mobile Screens (11)

| Screen | File | Key Features |
|--------|------|-------------|
| Home | `index.tsx` | Daily screen time summary, 30-day trends, top apps, XP level, streak badges |
| Stats | `stats.tsx` | App usage by category, daily graphs, distribution analysis |
| Sessions | `sessions.tsx` | Focus session list (solo/group/beast types), duration, completion |
| Intentions | `intentions.tsx` | Per-app limits (daily opens, per-open time), breathing pause toggle |
| Active Session | `session-active.tsx` | Full-screen timer, rotating motivational messages, no distractions |
| Session Complete | `session-complete.tsx` | Time completed, XP earned, streak status |
| Badges | `badges.tsx` | Grid gallery, unlock criteria, dates |
| Insights | `insights.tsx` | Trend analysis, streak history, weekly summaries |
| Daily Report | `report.tsx` | Comprehensive daily summary, recommendations |
| Settings | `settings.tsx` | Daily goal, measurement system, categories |

### Web Pages (8)

Dashboard, stats, sessions, intentions, badges, insights, settings.

### Engines

- **XP/Leveling** -- Session duration * type multiplier, level progression table
- **Streak Engine** -- Consecutive goal-met days, longest streak
- **Stats Engine** -- Daily/weekly/monthly aggregation, top apps, category breakdown

---

## 22. MyRecipes

**Tagline:** Your kitchen, completely private
**Icon:** 🍳 | **Accent:** #22C55E | **Tier:** Premium | **Storage:** SQLite (rc_, v7) | **Tables:** 17+

### Mobile Screens (15)

| Screen | File | Key Features |
|--------|------|-------------|
| Home | `index.tsx` | Recipe count, favorites, recent recipes, today's meal plan, shopping preview |
| Recipes Tab | `recipes-tab.tsx` | Grid/list view, search, filter (difficulty/cuisine/tags), favorites |
| Recipe Detail | `recipe/[id].tsx` | Full recipe: ingredients (scalable), steps, nutrition, rating, tags, collections, print, share |
| Add Recipe | `add-recipe.tsx` | Title, servings, timings, ingredients with unit parser, steps with timers, tags, image |
| Cooking Mode | `cooking-mode.tsx` | Step-by-step, large text, ingredient checklist, auto-timers, voice commands, keep-awake |
| Collections | `collections.tsx` | Recipe collection browser, CRUD |
| Meal Planner | `meal-plan.tsx` | Weekly grid (breakfast/lunch/dinner), drag-to-assign, nutrition totals |
| Shopping List | `shopping-list.tsx` | Items by aisle (produce/dairy/meat/pantry), checkoff, custom items |
| Shopping Lists | `shopping-lists.tsx` | All lists (active/archived), create/archive |
| Import (URL) | `import-source.tsx` | URL input, barcode, video (YouTube/TikTok/Instagram), photo OCR |
| Import Review | `import-review.tsx` | Review parsed recipe before saving |
| Pantry | `pantry.tsx` | Inventory with expiration tracking, barcode lookup, food recognition |
| Settings | `settings.tsx` | Default servings, units, cuisine, dietary restrictions |

### Web Pages (12)

Hub, library, recipe detail, cooking mode, print preview, create, import (+ review), meal planner, pantry, grocery.

### Engines

- **Ingredient Parser** -- Natural language parsing with unit conversion
- **Recipe Scaling** -- Multiply all quantities by servings ratio
- **Cooking Mode Timers** -- Auto-extract timers from step text ("bake for 20 minutes")
- **URL Import** -- JSON-LD, Microdata, Meta fallback parsing
- **Video Import** -- YouTube/TikTok/Instagram recipe extraction
- **AI Photo OCR** -- Claude Vision for paper/photo recipe extraction
- **Nutrition Calculator** -- Per-recipe nutrition from ingredients
- **Pantry Tracker** -- Expiration alerts, barcode lookup

---

## 23. MyRSVP

**Tagline:** Events without the chaos
**Icon:** 🎉 | **Accent:** #EAB308 | **Tier:** Premium | **Storage:** SQLite (rv_) | **Tables:** 13

### Mobile Screens (19)

| Screen | File | Key Features |
|--------|------|-------------|
| Home | `index.tsx` | Upcoming events, RSVP status summary, quick create |
| Events | `events.tsx` | Event list with status badges |
| Event Detail | `event/[id].tsx` | Full event: date/time/location, description, RSVP count |
| Create Event | `event/create.tsx` | Title, date, time, location, description, capacity |
| Guests | `guests.tsx` | Guest list with RSVP status, plus-ones |
| Add Guest | `guest/add.tsx` | Name, email, phone, dietary preferences |
| Polls | `polls.tsx` | Poll creation and voting |
| Announcements | `announcements.tsx` | Broadcast messages to guests |
| Photo Albums | `photos.tsx` | Event photo gallery |
| Check-In | `checkin.tsx` | Guest check-in at event |
| Analytics | `analytics.tsx` | RSVP rate, headcount, dietary breakdown |
| Waitlist | `waitlist.tsx` | Waitlist management with auto-promote |
| Co-Hosts | `cohosts.tsx` | Co-host permissions management |
| Custom Questions | `questions.tsx` | RSVP form custom questions |
| Feed | `feed.tsx` | Event activity feed |
| Registry | `registry.tsx` | Item registry with claim tracking |
| Settings | `settings.tsx` | Default event settings |
| CSV Export | `export.tsx` | Guest list CSV export |

### Web Pages (2)

Hub page with two-column desktop layout (event sidebar + tabbed detail panel).

---

## 24. MyStars

**Tagline:** The cosmos in your pocket
**Icon:** ⭐ | **Accent:** #A78BFA | **Tier:** Premium | **Storage:** SQLite (st_) | **Tables:** 12+

### Mobile Screens (23)

| Screen | File | Key Features |
|--------|------|-------------|
| Home | `index.tsx` | Daily horoscope, moon phase, retrograde status, planetary positions |
| Birth Chart | `birth-chart.tsx` | Natal chart calculation with house placements |
| Moon Phase | `moon.tsx` | Current moon phase with illumination, zodiac position |
| Moon Calendar | `moon-calendar.tsx` | Monthly moon phase calendar |
| Compatibility | `compatibility.tsx` | Zodiac compatibility scoring between two charts |
| Tarot | `tarot.tsx` | Card of the day with interpretation |
| Tarot Reading | `tarot-reading.tsx` | Multi-card spread readings |
| Readings History | `readings-history.tsx` | Past tarot readings log |
| Transit Timeline | `transit-timeline.tsx` | Current planetary transits with aspects |
| Daily Reading | `daily-reading.tsx` | Daily astrological reading |
| Zodiac Events | `zodiac-events.tsx` | Upcoming zodiac events (equinox, solstice, etc.) |
| Retrograde Tracker | `retrograde.tsx` | Current/upcoming retrogrades with banner severity |
| Journal | `journal.tsx` | Astrology journal entries |
| Add Journal | `journal/add.tsx` | Create journal entry with chart reference |
| Solar Return | `solar-return.tsx` | Solar return chart calculation |
| Progressions | `progressions.tsx` | Progressed chart calculation |
| Friends | `friends.tsx` | Friend compatibility charts |
| Settings | `settings.tsx` | Birth data, display preferences |

### Web Pages (13)

Full mirror of mobile features across 13 routes.

### Engines

- **Birth Chart Calculator** -- Natal chart positions from date/time/location
- **Moon Phase Engine** -- Phase calculation, zodiac position, illumination
- **Compatibility Scoring** -- Element/modality/aspect analysis between charts
- **Transit Engine** -- Current planetary positions and aspects
- **Retrograde Tracker** -- Banner severity (green/yellow/red per simultaneous count)
- **Solar Return** -- Annual chart from birthday return
- **Progressions** -- Progressed chart calculation
- **Tarot Engine** -- Card meanings, spread layouts, reading generation

---

## 25. MySubs

**Tagline:** Track every subscription in one place
**Icon:** 💳 | **Accent:** #8B5CF6 | **Tier:** Premium | **Storage:** SQLite (sb_) | **Tables:** 8+

### Mobile Screens (10)

| Screen | File | Key Features |
|--------|------|-------------|
| Home | `index.tsx` | Total monthly/annual cost, subscription count, next renewals |
| Subscriptions | `subscriptions.tsx` | Full list with cost, cycle, category |
| Add | `add.tsx` | Name, cost, cycle, category, from detection or manual |
| Detail | `[id].tsx` | Full subscription info, renewal history, cancel link |
| Calendar | `calendar.tsx` | Renewal calendar view |
| Detect | `detect.tsx` | Auto-detect subscriptions from bank transactions |
| Analytics | `analytics.tsx` | Cost breakdown by category, trends |
| Catalog | `catalog.tsx` | 215-entry subscription catalog |
| Opportunities | `opportunities.tsx` | Cost-saving suggestions |
| Settings | `settings.tsx` | Notification prefs, currency |

### Web Pages (8)

Dashboard, subscriptions, calendar, analytics, detect, catalog, opportunities, settings.

**Note:** Subs is being absorbed into the Budget module. Web UI exists but mobile is hidden (isUserVisibleModule returns false).

---

## 26. MySurf

**Tagline:** Surf forecasts and spot intel, no ads, no tracking
**Icon:** 🏄 | **Accent:** #3B82F6 | **Tier:** Premium | **Storage:** Supabase + SQLite cache | **Tables:** 22+

### Mobile Screens (21)

| Screen | File | Key Features |
|--------|------|-------------|
| Home | `index.tsx` | Total spots, favorites, avg wave height, session count, top 6 favorites |
| Map | `map.tsx` | Interactive map with spot conditions, filtering |
| Spots | `spots.tsx` | Searchable spot list, difficulty badges, break type, favorites |
| Spot Detail | `spot-detail.tsx` | Full profile: conditions, hazards, skill level, ideal swells, crowd factor |
| Alerts | `alerts.tsx` | Multi-parameter alert rules (AND/OR), notification history |
| Buoys | `buoys.tsx` | Real-time NOAA buoy data (wave height, swell, period, water temp) |
| Tides | `tides.tsx` | Tide charts (high/low times, heights, current status) |
| Sessions | `sessions.tsx` | Surf session log (date, duration, rating, spot, conditions) |
| Regions | `regions.tsx` | Multi-region selector (CA, HI, East Coast, Portugal) |
| Wave Detection | `wave-detect.tsx` | GPS-based ride detection from phone motion |
| Trail | `trail.tsx` | Coastal trail/hike tracking with elevation |
| Crew | `crew.tsx` | Crew management, shared session history |
| Feed | `feed.tsx` | Social feed: shared sessions, comments, likes |
| Rating Detail | `rating-detail.tsx` | Spot rating breakdown (swell 45%, wind 30%, tide 15%, consistency 10%) |
| Settings | `settings.tsx` | Preferences, sync settings |

### Web Pages (9)

Spot explorer, forecast dashboard, swell components, tide predictions, alert management, session journal, crew/social, ratings.

### Engines

- **Spot Rating Engine** -- 1-5 stars from swell energy (45%), wind (30%), tide (15%), consistency (10%)
- **Quick Glance Verdict** -- Go (>=4), Maybe (3), No (<3)
- **Wave Energy Calculator** -- E = rho * g * H^2 * T / 16
- **Wind Scoring** -- Offshore/cross/onshore classification
- **Tide Scoring** -- Spot-type-sensitive (reef > point > beach)
- **Wave Detection** -- GPS speed/duration thresholds
- **Alert Evaluation** -- Multi-rule matching with AND/OR logic
- **Trail Analytics** -- Distance, elevation, pace from waypoints
- **GPX I/O** -- GPX export/import

---

## 27. MyTrails

**Tagline:** Offline hiking and trail guide
**Icon:** 🥾 | **Accent:** #65A30D | **Tier:** Premium | **Storage:** SQLite (tr_) | **Tables:** 20+

### Mobile Screens (21)

| Screen | File | Key Features |
|--------|------|-------------|
| Home | `index.tsx` | Map placeholder, quick stats (recordings, distance, elevation, pace), recent trails |
| Trails | `trails.tsx` | Searchable list, filter (difficulty/activity/region), sort options |
| Recordings | `recordings.tsx` | GPS recording list, filter by activity type |
| Elevation Profile | `elevation-profile.tsx` | Animated elevation graph over distance |
| Offline Regions | `offline-regions.tsx` | Download/manage offline map tiles |
| Alert Settings | `alert-settings.tsx` | Off-trail deviation alerts, audio cues |
| Packing Lists | `packing.tsx` | Packing list management |
| Packing Detail | `packing/[id].tsx` | Items checklist for specific trip |
| Trip Planner | `trip.tsx` | Trip itinerary with waypoints |
| Trip Detail | `trip/[id].tsx` | Day-by-day plan, linked trails |
| Trail Detail | `trail/[id].tsx` | Full trail info: distance, elevation, difficulty, waypoints, photos |
| Trail Reviews | `reviews.tsx` | Community reviews and photos |
| Weather Overlay | `weather.tsx` | Weather forecast for trail location |
| Route Builder | `route.tsx` | Create custom routes on map |
| Segments | `segments.tsx` | Segment tracking (Strava-style) |
| Record | `record.tsx` | Active GPS recording with live stats |
| Photos | `photos.tsx` | Geotagged photo journal |
| Discover | `discover.tsx` | Trail discovery and recommendations |
| Gear | `gear.tsx` | Gear inventory management |
| Export | `export.tsx` | GPX export |
| Settings | `settings.tsx` | Units, map preferences, activity defaults |

### Web Pages (11)

Full mirror: trails, recordings, elevation, packing, trips, reviews, weather, route builder, segments, discover, settings.

### Engines

- **GPS Recording** -- Real-time tracking with haversine distance, pace, elevation
- **Elevation Analysis** -- Gain/loss calculation, profile visualization
- **Trail Rating** -- Difficulty classification (easy/moderate/hard/expert)
- **Packing Generator** -- Season/activity-aware suggestions
- **GPX I/O** -- Standard GPS exchange format
- **Offline Maps** -- Tile download and cache management
- **Weather Integration** -- Trail-location weather forecasts

---

## 28. MyVoice

**Tagline:** Capture every word, privately
**Icon:** 🎙️ | **Accent:** #EF4444 | **Tier:** Free | **Storage:** SQLite (vc_) | **Tables:** 8+

### Mobile Screens (2)

| Screen | File | Key Features |
|--------|------|-------------|
| Home | `index.tsx` | Recording list, quick record button, stats summary |
| Settings | `settings.tsx` | Language, recording quality, storage |

**Note:** Voice has minimal mobile UI (2 screens). Most functionality exists in the module logic and web pages.

### Web Pages (9)

| Page | Path | Features |
|------|------|----------|
| Hub | `/voice` | Dashboard with recent transcriptions, stats |
| Recordings | `/voice/recordings` | Full recording browser |
| Recording Detail | `/voice/recordings/[id]` | Playback, transcription, keywords, edit |
| Search | `/voice/search` | FTS search across transcriptions |
| Commands | `/voice/commands` | Custom voice command management |
| Speakers | `/voice/speakers` | Speaker identification profiles |
| Languages | `/voice/languages` | Multi-language profile management |
| Export | `/voice/export` | Export transcriptions |
| Settings | `/voice/settings` | Preferences, storage, quality |

### Features

- On-device dictation and transcription
- Language detection with confidence scoring
- Keyword extraction (frequency-based)
- Text summarization
- Voice command support with 20 command definitions
- Speaker identification system
- Multi-language profile management
- Tagging, favorites, word counting, reading time estimation

---

## 29. MyWords

**Tagline:** Look up any word, in any language
**Icon:** 📖 | **Accent:** #F59E0B | **Tier:** Premium | **Storage:** SQLite (wd_) | **Tables:** 6+

### Mobile Screens (10)

| Screen | File | Key Features |
|--------|------|-------------|
| Home | `index.tsx` | Search bar, word of the day, recent lookups |
| Search | `search.tsx` | Multi-provider dictionary lookup (270+ languages) |
| Word Detail | `[id].tsx` | Definitions, pronunciations, etymology, word forms, synonyms, antonyms, rhymes |
| Saved Words | `saved.tsx` | Saved/bookmarked words list |
| Word Lists | `lists.tsx` | Custom word list management |
| List Detail | `list/[id].tsx` | Words in list, study mode link |
| Helper | `helper.tsx` | Word helper (crossword solver, anagram finder) |
| Browse | `browse.tsx` | Alphabetical browsing |
| Flash Link | `flash.tsx` | Create flashcards from saved words (links to Flash module) |
| Settings | `settings.tsx` | Default language, providers, cache settings |

### Web Pages (9)

Full mirror: search, word detail, saved, lists, helper, browse, flash link, settings.

### Features

- Multi-provider dictionary API integration
- 270+ language support
- Definitions, pronunciations, etymology, word forms
- Synonyms, antonyms, rhymes
- Contextual meaning suggestions
- LRU caching for offline fallback
- Word lists for vocabulary building
- Flash module integration for study cards

---

## 30. MyWorkouts

**Tagline:** Train smarter, lift heavier, run farther
**Icon:** 💪 | **Accent:** #EF4444 | **Tier:** Premium | **Storage:** SQLite + Supabase (wk_) | **Tables:** 20+

### Mobile Screens (26)

| Screen | File | Key Features |
|--------|------|-------------|
| Home | `index.tsx` | Workout summary, streak counter, upcoming scheduled workout, quick start |
| Exercises | `exercises.tsx` | 50+ exercise library with body map (14 muscle groups) |
| Exercise Detail | `exercise/[id].tsx` | Demo video, instructions, muscle groups, 1RM history |
| Workout Builder | `builder.tsx` | Build custom workout: add exercises, sets, reps, weight, rest time |
| Session | `session.tsx` | Active workout: 13-state machine, rest timer, previous performance ghost text, voice commands |
| History | `history.tsx` | Workout history with volume/duration/PR indicators |
| Programs | `programs.tsx` | Multi-week training plans |
| Program Detail | `program/[id].tsx` | Weekly schedule, workout templates |
| Create Program | `program/create.tsx` | Build training program |
| Progress | `progress.tsx` | PR tracking, volume trends, streaks |
| Body Map | `body-map.tsx` | 14 muscle group recovery heatmap |
| Measurements | `measurements.tsx` | Body measurements (weight, arms, chest, waist, etc.) |
| Photos | `photos.tsx` | Progress photos (4 view types, comparison) |
| 1RM Calculator | `one-rm.tsx` | Epley/Brzycki 1RM tracking |
| Warmup Calculator | `warmup.tsx` | Warmup set suggestions based on working weight |
| Plate Loader | `plate-loader.tsx` | Custom plate inventories, bar presets, unit conversion |
| AI Generator | `ai-workout.tsx` | Rule-based workout generation (goal/muscle/equipment/duration) |
| Overload | `overload.tsx` | Progressive overload automation (weight/rep/set suggestions) |
| GPS Runs | `gps.tsx` | GPS route recording (haversine, pace, elevation, calories) |
| Watch App | `watch.tsx` | Apple Watch sync protocol |
| Social Feed | `social.tsx` | Privacy-first social feed with sharing controls |
| Share Workout | `share.tsx` | Summary card builder with PRs, volume, muscle groups |
| Explore | `explore.tsx` | Discover exercises and programs |
| Superset | `superset.tsx` | Superset configuration |
| Timer | `timer.tsx` | Rest timer with presets |
| Settings | `settings.tsx` | Units, equipment, notification prefs |

### Web Pages (6)

| Page | Path | Features |
|------|------|----------|
| Hub | `/workouts` | Dashboard with recent sessions, progress |
| Exercises | `/workouts/exercises` | Exercise library |
| Progress | `/workouts/progress` | Progress analytics and charts |
| Programs | `/workouts/programs` | Training program management |
| Explore | `/workouts/explore` | Discover content |
| Settings | `/workouts/settings` | Preferences |

### Engines

- **Session State Machine** -- 13 actions controlling workout flow
- **1RM Calculator** -- Epley/Brzycki formulas
- **Warmup Calculator** -- Progressive warmup sets
- **Plate Loader** -- Custom inventories, bar presets
- **Progressive Overload** -- Trigger evaluation, weight/rep/set suggestions
- **Muscle Recovery Heatmap** -- 14 muscle groups, fatigue scoring, training suggestions
- **GPS Recording** -- Haversine distance, pace, elevation, calorie estimation
- **AI Workout Generator** -- Rule-based: goal/muscle/equipment/duration
- **Cross-Module Intelligence** -- 6 detectors: mood-lift, fasting performance, protein-recovery, consistency momentum, time-of-day performance, volume-mood feedback
- **Voice Commands** -- 20 command phrases for hands-free
- **Apple Watch Sync** -- Phone-to-watch + watch-to-phone messages

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| **Total Modules** | 30 |
| **Mobile Screens** | 568 |
| **Web Pages** | 269 |
| **Features Built** | 470+ |
| **SQLite Tables** | 400+ across all modules |
| **Computation Engines** | 100+ |
| **Modules at 90%+ Parity** | 24 |
| **Free Modules** | 5 (Fast, Journal, Mood, Notes, Voice) |
| **Premium Modules** | 25 |
| **Cloud Modules** | 4 (Forums, Market, Surf, Workouts social) |

### Platform Coverage

| Module | Mobile | Web | Status |
|--------|--------|-----|--------|
| Books | 40 screens | 13 pages | Full |
| Budget | 53 screens | 5 pages | Web needs expansion |
| Car | 19 screens | 8 pages | Full |
| Closet | 14 screens | 5 pages | Full |
| Cycle | 12 screens | 11 pages | Full |
| Fast | 10 screens | 6 pages | Full |
| Flash | 13 screens | 6 pages | Full |
| Forums | 13 screens | 17 pages | Full |
| Garden | 26 screens | 15 pages | Full |
| Habits | 24 screens | 13 pages | Full |
| Health | 27 screens | 8 pages | Full |
| Homes | 38 screens | 10 pages | Full |
| Journal | 17 screens | 4 pages | Web minimal |
| Mail | 21 screens | 14 pages | Full |
| Market | 17 screens | 1 page | Web needs build |
| Meds | 38 screens | 16 pages | Full |
| Mood | 25 screens | 12 pages | Full |
| Notes | 14 screens | 12 pages | Full |
| Nutrition | 14 screens | 8 pages | Full |
| Pets | 13 screens | 4 pages | Web minimal |
| Presence | 11 screens | 8 pages | Full |
| Recipes | 15 screens | 12 pages | Full |
| RSVP | 19 screens | 2 pages | Web needs expansion |
| Stars | 23 screens | 13 pages | Full |
| Subs | 10 screens | 8 pages | Being absorbed into Budget |
| Surf | 21 screens | 9 pages | Full |
| Trails | 21 screens | 11 pages | Full |
| Voice | 2 screens | 9 pages | Mobile needs build |
| Words | 10 screens | 9 pages | Full |
| Workouts | 26 screens | 6 pages | Web needs expansion |

### Design System Reference

All modules use the **Cool Obsidian** design system:

| Token | Value | Usage |
|-------|-------|-------|
| background | #0A0A0F | App background |
| surface | #12121A | Card/panel fill |
| surfaceElevated | #1A1A24 | Elevated surfaces |
| text | #F0F0F5 | Primary text |
| textSecondary | rgba(240,240,245,0.65) | Secondary text |
| border | rgba(255,255,255,0.06) | Subtle borders |
| glass | rgba(255,255,255,0.04) | Glass card fill |
| glassStrong | rgba(255,255,255,0.08) | Strong glass fill |
| glassBorder | rgba(255,255,255,0.10) | Glass card border |
| danger | #FF453A | iOS system red |
| success | #30D158 | iOS system green |
| warning | #FBBF24 | Warning states |

Each module has its own accent color used for headers, active states, and highlights.

Glass morphism: expo-blur BlurView on mobile, backdrop-filter on web.
