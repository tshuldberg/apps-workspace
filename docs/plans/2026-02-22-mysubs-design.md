# MySubs — Design Document

**Date:** 2026-02-22
**Status:** Draft
**Author:** MyApps Product Team

---

## Overview

**MySubs** — The ironic app: a non-subscription subscription tracker.

A privacy-first subscription management app that tracks recurring costs entirely on-device. No bank connections, no account creation, no subscription pricing. Just a clean $4.99 one-time purchase that shows you exactly what you're paying for every month — and reminds you before anything renews.

In a world where everything is a subscription, MySubs is the one app that isn't. It tracks Netflix, Spotify, gym memberships, SaaS tools, and everything else you pay for monthly or annually. Pre-populated catalog of 200+ common services for quick add. Widget showing your monthly burn rate. Export to CSV. The entire app costs less than one month of most subscriptions it tracks.

---

## Problem Statement

Subscription fatigue is real and getting worse:

1. **The average American has 12 active subscriptions** totaling $219/month ($2,628/year) according to C+R Research 2025. Most people underestimate their total by 2-3x.
2. **"Set it and forget it" is the business model.** Companies rely on subscribers forgetting to cancel. The FTC's "click-to-cancel" rule (2025) helped, but you still need to know what you're paying for to cancel it.
3. **Rocket Money ($48-99/year) requires bank access** — The leading subscription tracker connects to your bank via Plaid to auto-detect subscriptions. You trade privacy for convenience. And ironically, Rocket Money is itself a subscription.
4. **Bobby (iOS) was the privacy-friendly option, but it's abandoned** — Last meaningful update in 2022. No widgets, no modern iOS features, no active development.
5. **No good "just a list" app exists** — Users end up tracking subscriptions in Notes, Reminders, or spreadsheets because no simple, private, well-designed tracker exists at a reasonable price.

MySubs fills the gap: a beautiful, simple subscription tracker that costs $4.99 once and never asks for your bank password.

---

## Target User Persona

### Primary: "Subscription-Fatigued Professional" (Riley, 25-40)

- **Demographics:** Working professional, $50K-$150K income, 8-20 active subscriptions
- **Behavior:** Has been surprised by a forgotten subscription charge at least once. Occasionally audits subscriptions by scrolling through bank statement. Has considered Rocket Money but didn't want to give bank access.
- **Pain point:** "I know I'm paying for stuff I don't use, but I don't have a clear picture of everything"
- **Motivation:** Wants a simple dashboard of all recurring costs without the overhead of a full budgeting app
- **Willingness to pay:** $5 is an impulse buy. "It costs less than one month of the subscriptions I'll cancel after seeing the total."

### Secondary: "The Optimizer" (Morgan, 22-35)

- **Demographics:** Tech-savvy, tracks personal metrics, probably uses a budgeting app already
- **Behavior:** Wants a dedicated view of subscriptions separate from their full budget. Checks subscription totals monthly.
- **Pain point:** Their budgeting app lumps subscriptions in with other expenses. Wants a focused view.
- **Motivation:** "I want to know my exact monthly subscription burn rate at a glance"

### Tertiary: "Family Plan Manager" (Casey, 30-50)

- **Demographics:** Manages household subscriptions — streaming, utilities, kids' apps, family phone plan
- **Behavior:** Juggles 15-25 subscriptions across multiple family members. Loses track of free trials.
- **Pain point:** "Who signed up for this? Is the Disney+ trial still free?"
- **Motivation:** Centralized view of all family subscriptions with renewal dates

---

## Competitive Landscape

| App | Price | Est. Users | Est. Revenue | Privacy Stance | Key Weakness |
|-----|-------|-----------|-------------|----------------|-------------|
| **Rocket Money** | $48-99/yr | 3M+ | $200M+/yr | Requires Plaid bank access; cloud-based; sells "premium" concierge | It's a subscription to manage subscriptions; requires bank credentials; aggressive upselling |
| **Bobby** | $1.99 (iOS) | 500K+ downloads | ~$500K (lifetime) | On-device, no bank access | Abandoned (no updates since 2022); no widgets; no catalog; dated UI |
| **Truebill (now Rocket Money)** | See above | Merged | Merged | See above | Rebranded; same bank-access model |
| **Subscriptions (iOS)** | $1.99/mo or $9.99/yr | 100K+ | ~$500K/yr | iCloud sync; no bank access | It's a subscription to track subscriptions; basic feature set |
| **TrackMySubs** | Free/$3/mo | 50K+ | ~$100K/yr | Web-based; requires account | Web-only; no native app; subscription pricing |
| **Spreadsheet/Notes** | Free | Millions | $0 | Fully private | No reminders, no totals, no visualization, tedious to maintain |

### Opportunity

The subscription tracker market is bizarrely underserved for privacy-conscious users:
- Rocket Money is the market leader but requires bank access and is itself a subscription
- Bobby was the perfect alternative but is abandoned
- No app combines: native design, on-device privacy, pre-populated catalog, widgets, and one-time pricing
- The irony angle ("a non-subscription subscription tracker") is inherently viral and differentiating

---

## Key Features (MVP)

### 1. Subscription Management

- Add subscriptions manually: name, price, billing cycle, category, start date, notes
- Pre-populated catalog of 200+ common subscriptions with logos, default prices, and categories
- Custom subscriptions for anything not in the catalog
- Billing cycle options: weekly, monthly, quarterly, semi-annual, annual, custom (every N days)
- Track subscription status: active, paused, cancelled, free trial
- Free trial tracking with expiration date and countdown
- Edit, pause, resume, or cancel (mark as cancelled) any subscription
- Duplicate detection when adding from catalog

### 2. Cost Dashboard

- Monthly total at the top of the home screen — big, bold, impossible to miss
- Annual total projection
- Breakdown by category (Entertainment, Productivity, Health, Shopping, Finance, Utilities, Other)
- "Cost per day" calculation (monthly total / 30) — makes the number feel real
- Month-over-month change indicator ("+$12 vs last month")
- Currency formatting based on locale

### 3. Renewal Calendar

- Calendar view showing upcoming renewal dates
- List view sorted by next renewal date
- Visual timeline of renewals for the current month
- Tap a date to see all subscriptions renewing that day
- "This week" / "This month" / "Next month" quick filters

### 4. Smart Notifications

- Configurable reminder before renewal: 1 day, 3 days, 7 days, or custom
- Per-subscription reminder settings (important for free trials vs regular subscriptions)
- Free trial expiration alerts with countdown: "Disney+ trial expires in 3 days"
- Monthly summary notification on the 1st: "Your subscriptions this month: $187.42"
- Price increase detection: if user updates a subscription price, note the change

### 5. Spending by Category Chart

- Donut chart showing subscription spending by category
- Tap a category to see the subscriptions in it
- Bar chart comparing category spending month over month
- "Top 3 most expensive subscriptions" callout

### 6. Widget

- Home screen widget (iOS 17+ / Android 12+) showing:
  - Monthly total
  - Next 3 upcoming renewals
  - "Cost per day" figure
- Small widget: just the monthly total
- Medium widget: monthly total + next 3 renewals
- Widget updates daily

### 7. Export

- Export subscription list as CSV (name, price, cycle, category, status, next renewal)
- Share as formatted text (for sending to a partner or roommate)
- Copy monthly summary to clipboard

### 8. Pre-Populated Catalog

200+ common subscriptions organized by category:

**Entertainment (50+):** Netflix, Spotify, Apple Music, YouTube Premium, Disney+, Hulu, HBO Max, Amazon Prime, Paramount+, Peacock, Apple TV+, Crunchyroll, Audible, Kindle Unlimited, Xbox Game Pass, PlayStation Plus, Nintendo Switch Online, Twitch Turbo, etc.

**Productivity (40+):** Microsoft 365, Google Workspace, Notion, Slack, Zoom, Dropbox, iCloud+, Adobe Creative Cloud, Figma, GitHub Copilot, ChatGPT Plus, Claude Pro, Todoist, 1Password, Grammarly, Canva Pro, etc.

**Health & Fitness (20+):** Gym membership (generic), Peloton, Strava, MyFitnessPal, Headspace, Calm, Noom, Apple Fitness+, Whoop, etc.

**Shopping & Delivery (15+):** Amazon Prime, Costco, Walmart+, Instacart+, DoorDash DashPass, Uber One, Shipt, etc.

**News & Media (20+):** NYT, Washington Post, Wall Street Journal, The Athletic, Substack (generic), Medium, etc.

**Finance & Insurance (15+):** Credit monitoring, identity theft protection, car insurance, renters insurance, etc.

**Utilities (15+):** Phone plan, internet, cloud storage, VPN, domain registration, web hosting, etc.

**Other (25+):** Parking, pet insurance, meal kit, wine club, etc.

Each catalog entry includes:
- Service name
- Default logo/icon (bundled, not fetched from network)
- Default price (user can override)
- Default billing cycle
- Category
- URL (for the user's reference, not opened automatically)

---

## Technical Architecture

### Stack

- **Mobile:** Expo (React Native) — iOS + Android from single codebase
- **Web:** Next.js 15 — Desktop access
- **Database:** SQLite via `expo-sqlite` (mobile) / `better-sqlite3` (web)
- **Monorepo:** Turborepo
- **Package Manager:** pnpm
- **Language:** TypeScript everywhere
- **Charts:** `react-native-svg` + `victory-native` (mobile), `recharts` (web)
- **Notifications:** `expo-notifications` (local only — no push server)
- **Widgets:** `react-native-android-widget` + iOS WidgetKit via Expo config plugin
- **Payments:** RevenueCat (App Store IAP), Lemon Squeezy (direct)

### Monorepo Structure

```
MySubs/
├── apps/
│   ├── mobile/                # Expo (React Native) — iOS + Android
│   │   ├── app/               # Expo Router file-based routing
│   │   │   ├── (tabs)/        # Tab navigation
│   │   │   │   ├── index.tsx          # Dashboard (home)
│   │   │   │   ├── calendar.tsx       # Renewal calendar
│   │   │   │   └── insights.tsx       # Charts and spending breakdown
│   │   │   ├── add.tsx                # Add subscription (catalog + manual)
│   │   │   ├── subscription/[id].tsx  # Subscription detail/edit
│   │   │   ├── catalog.tsx            # Browse full catalog
│   │   │   └── settings.tsx           # App settings
│   │   ├── components/        # Mobile-specific components
│   │   ├── hooks/             # Mobile-specific hooks
│   │   ├── widgets/           # iOS/Android widget definitions
│   │   └── assets/            # Icons, logos, fonts
│   └── web/                   # Next.js 15 — Web/desktop
│       ├── app/
│       └── components/
├── packages/
│   ├── shared/                # Shared business logic
│   │   ├── src/
│   │   │   ├── db/            # Database layer (SQLite operations)
│   │   │   ├── models/        # TypeScript types and Zod schemas
│   │   │   ├── catalog/       # Pre-populated subscription catalog
│   │   │   │   ├── data.ts    # Catalog entries (200+ items)
│   │   │   │   └── types.ts   # CatalogEntry schema
│   │   │   ├── engine/        # Cost calculation, renewal scheduling
│   │   │   └── utils/         # Date helpers, currency formatting
│   │   └── package.json
│   ├── ui/                    # Shared UI components
│   │   ├── src/
│   │   │   ├── tokens/        # Design tokens
│   │   │   ├── components/    # Cross-platform UI primitives
│   │   │   └── icons/         # Icon set + subscription logos
│   │   └── package.json
│   ├── eslint-config/
│   └── typescript-config/
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── CLAUDE.md
├── timeline.md
└── README.md
```

### Data Model (SQLite Schema)

```sql
-- Subscriptions — the core entity
CREATE TABLE subscriptions (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name            TEXT NOT NULL,
    price           INTEGER NOT NULL,  -- cents
    currency        TEXT NOT NULL DEFAULT 'USD',
    billing_cycle   TEXT NOT NULL CHECK (billing_cycle IN (
        'weekly', 'monthly', 'quarterly', 'semi_annual', 'annual', 'custom'
    )),
    custom_days     INTEGER,  -- only used when billing_cycle = 'custom'
    category        TEXT NOT NULL DEFAULT 'other' CHECK (category IN (
        'entertainment', 'productivity', 'health', 'shopping',
        'news', 'finance', 'utilities', 'other'
    )),
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
        'active', 'paused', 'cancelled', 'trial'
    )),
    start_date      TEXT NOT NULL,  -- 'YYYY-MM-DD'
    next_renewal    TEXT NOT NULL,  -- 'YYYY-MM-DD'; computed and stored
    trial_end_date  TEXT,  -- 'YYYY-MM-DD'; only for status = 'trial'
    cancelled_date  TEXT,  -- 'YYYY-MM-DD'; when user marked as cancelled
    notes           TEXT,
    url             TEXT,  -- service URL for user reference
    icon            TEXT,  -- catalog icon key or custom emoji
    color           TEXT,  -- hex color for visual identification
    notify_days     INTEGER NOT NULL DEFAULT 1,  -- days before renewal to notify
    catalog_id      TEXT,  -- references catalog entry if added from catalog
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Price History — track price changes over time
CREATE TABLE price_history (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    price           INTEGER NOT NULL,  -- cents
    effective_date  TEXT NOT NULL,  -- 'YYYY-MM-DD'
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Notification Log — record of sent notifications (for dedup)
CREATE TABLE notification_log (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    type            TEXT NOT NULL CHECK (type IN ('renewal', 'trial_expiry', 'monthly_summary')),
    scheduled_for   TEXT NOT NULL,  -- 'YYYY-MM-DD'
    sent_at         TEXT,
    UNIQUE(subscription_id, type, scheduled_for)
);

-- User Preferences
CREATE TABLE preferences (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL
);

-- Indexes
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_next_renewal ON subscriptions(next_renewal) WHERE status IN ('active', 'trial');
CREATE INDEX idx_subscriptions_category ON subscriptions(category);
CREATE INDEX idx_price_history_sub ON price_history(subscription_id);
CREATE INDEX idx_notification_log_sub ON notification_log(subscription_id);
```

### Renewal Calculation Engine

Lives in `packages/shared/src/engine/`:

```typescript
interface SubscriptionSummary {
  monthlyTotal: number;          // cents — all active subscriptions normalized to monthly
  annualTotal: number;           // cents — monthlyTotal * 12
  dailyCost: number;             // cents — monthlyTotal / 30
  byCategory: Record<Category, number>;  // cents per category (monthly)
  upcomingRenewals: Renewal[];   // sorted by date, next 30 days
  trialExpirations: Renewal[];   // trials expiring in next 14 days
  activeCount: number;
  totalCount: number;
}

interface Renewal {
  subscriptionId: string;
  name: string;
  price: number;          // cents
  date: string;           // 'YYYY-MM-DD'
  isTrialEnd: boolean;
}
```

Normalization rules for monthly total:
- Weekly → price * 52 / 12
- Monthly → price
- Quarterly → price / 3
- Semi-annual → price / 6
- Annual → price / 12
- Custom (N days) → price * (365 / N) / 12

Next renewal date calculation:
- From `start_date`, advance by billing cycle until the result is in the future
- Store the computed `next_renewal` date for efficient querying
- After each renewal date passes, automatically advance to the next one (computed on app open)

### Privacy Architecture

- **Zero network calls.** The app bundles all catalog data (logos, names, prices) at build time. No API calls to fetch subscription info.
- **Local notifications only.** Uses `expo-notifications` scheduled locally. No push notification server. No APNs/FCM token ever generated.
- **No analytics.** No Firebase, no Mixpanel, no telemetry. The app doesn't know how many users it has (App Store Connect provides aggregate download data only).
- **No account.** No email, no sign-up, no authentication.
- **SQLite on-device.** Data stays in the app sandbox. No iCloud sync, no cloud backup.
- **Logos bundled as static assets.** Subscription service logos are included in the app bundle at build time. No network fetch for images.
- **Export is explicit.** User chooses to export CSV or share text. Only time data leaves the device.

---

## UI/UX Direction

### Design Language

- **Dark mode native** — Deep charcoal (#1A1A2E) background
- **Warm accent palette:**
  - Amber (#F5A623) — monthly total, cost highlights, active states
  - Coral (#FF6B6B) — trial expiration warnings, price increases
  - Teal (#4ECDC4) — savings (cancelled subs), calendar highlights
  - Muted lavender (#A0A0C8) — secondary text, borders, inactive items
- **Typography:** Inter for all text, SF Mono / JetBrains Mono for currency amounts
- **Cards:** Subscription cards with rounded corners (12px), subtle inner shadow on dark background
- **Subscription colors:** Each subscription gets a color (from catalog or user-chosen) shown as a left border accent on its card
- **No shield icons.** Privacy communicated through behavior and copy, not iconography.

### Screen Flow

#### 1. Dashboard (Home Tab)

The primary view. Monthly burn rate front and center.

```
┌─────────────────────────────────────┐
│ MySubs                    [+ Add]   │
│─────────────────────────────────────│
│                                     │
│         $187.42/month               │
│         $2,249.04/year              │
│         $6.25/day                   │
│                                     │
│ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │
│ Ent $72 | Prod $55 | Health $30 |..│
│─────────────────────────────────────│
│ RENEWING SOON                       │
│ ┌─ Netflix ──────── Feb 25 $15.49 ┐│
│ │  Entertainment      in 3 days    ││
│ └─────────────────────────────────┘│
│ ┌─ Spotify ──────── Mar 1  $10.99 ┐│
│ │  Entertainment      in 7 days    ││
│ └─────────────────────────────────┘│
│                                     │
│ ALL SUBSCRIPTIONS (14 active)       │
│ ┌─ Netflix ──────────────── $15.49 ┐│
│ ┌─ Spotify ──────────────── $10.99 ┐│
│ ┌─ iCloud+ ─────────────────$2.99 ┐│
│ ┌─ ChatGPT Plus ──────────$20.00 ┐│
│ ...                                 │
│─────────────────────────────────────│
│  [Dashboard]  [Calendar]  [Insights]│
└─────────────────────────────────────┘
```

- Monthly/annual/daily toggle at the top
- Category spending bar (horizontal stacked bar)
- "Renewing Soon" section shows next 7 days of renewals
- Full subscription list below, sorted by price (descending) or name
- Each card shows: icon, name, category, price, next renewal
- Tap a subscription to view/edit details
- Cancelled subscriptions in a collapsible "Cancelled" section at the bottom

#### 2. Add Subscription

Two modes: Catalog and Manual.

```
┌─────────────────────────────────────┐
│ Add Subscription             Cancel │
│─────────────────────────────────────│
│ 🔍 Search services...              │
│                                     │
│ POPULAR                             │
│ [Netflix] [Spotify] [Apple Music]   │
│ [Disney+] [YouTube] [ChatGPT]      │
│ [Amazon Prime] [iCloud+] [Hulu]    │
│                                     │
│ ENTERTAINMENT                       │
│ ┌─ Netflix ──────────────── $15.49 ┐│
│ ┌─ Spotify ──────────────── $10.99 ┐│
│ ┌─ Apple Music ─────────── $10.99 ┐│
│ ...                                 │
│                                     │
│ PRODUCTIVITY                        │
│ ┌─ Microsoft 365 ─────────  $9.99 ┐│
│ ...                                 │
│                                     │
│ [ + Add Custom Subscription ]       │
└─────────────────────────────────────┘
```

- Search bar filters catalog in real-time
- Tapping a catalog entry opens a pre-filled form (user can override price, cycle, start date)
- "Add Custom" opens a blank form
- Category chips for quick filtering

#### 3. Subscription Detail / Edit

```
┌─────────────────────────────────────┐
│ ← Netflix                   [Edit] │
│─────────────────────────────────────│
│                                     │
│     [Netflix Logo]                  │
│     $15.49/month                    │
│     Entertainment                   │
│                                     │
│ Status:       ● Active              │
│ Started:      Jan 15, 2024          │
│ Next renewal: Feb 25, 2026          │
│ Notify:       1 day before          │
│ Lifetime cost: ~$390                │
│                                     │
│ PRICE HISTORY                       │
│ $15.49 ─── since Oct 2024          │
│ $13.99 ─── Jan 2024 - Oct 2024     │
│                                     │
│ Notes: Family plan, shared with...  │
│                                     │
│ [ Pause ]  [ Cancel ]  [ Delete ]   │
└─────────────────────────────────────┘
```

- Lifetime cost calculated from start date to now
- Price history shows all recorded changes
- Pause keeps the subscription in the list but stops renewal reminders and excludes from totals
- Cancel marks as cancelled with date, keeps in history
- Delete permanently removes (with confirmation)

#### 4. Renewal Calendar (Tab)

```
┌─────────────────────────────────────┐
│ Calendar                            │
│─────────────────────────────────────│
│       February 2026                 │
│ Su Mo Tu We Th Fr Sa                │
│                          1         │
│  2  3  4  5  6  7  8              │
│  9 10 11 12 13 14 15              │
│ 16 17 18 19 20 21 [22]            │
│ 23 24 ◉25 26 27 28                │
│                                     │
│ Feb 25                              │
│ ┌─ Netflix ──────────────── $15.49 ┐│
│ ┌─ Adobe CC ─────────────── $54.99 ┐│
│                                     │
│ Feb 28                              │
│ ┌─ Gym Membership ─────── $49.99 ┐│
│─────────────────────────────────────│
│  [Dashboard]  [Calendar]  [Insights]│
└─────────────────────────────────────┘
```

- Dots on calendar dates indicate renewals
- Tapping a date shows subscriptions renewing that day
- Color-coded dots match subscription categories
- Swipe left/right to navigate months

#### 5. Insights (Tab)

- **Spending by Category** — Donut chart with category breakdown
- **Monthly trend** — Line chart showing total subscription cost over last 12 months
- **Price changes** — List of subscriptions whose price increased, with before/after
- **Cancelled savings** — "You're saving $43.98/month from cancelled subscriptions"
- **Lifetime spending** — Total amount spent on all subscriptions since tracking began

### Onboarding Flow (First Launch)

1. **Welcome** — "Track every subscription. A non-subscription subscription tracker." CTA: "Get Started"
2. **Quick Add** — "Add your subscriptions. Start with the ones you know." Shows a curated grid of the 20 most popular services. User taps to toggle. "You can always add more later."
3. **Confirm Prices** — For each selected subscription, show the default price with an edit option. Batch confirmation screen.
4. **Set Start Dates** — Optional. "When did each subscription start? This helps calculate lifetime cost. Skip if you're not sure."
5. **Done** — "You're tracking N subscriptions at $X/month. We'll remind you before renewals." Shows the dashboard.

Total onboarding time: under 90 seconds for 5-10 subscriptions.

---

## Monetization

### Pricing Model

**One-time purchase: $4.99**

No subscriptions. No ads. No premium tier. Pay once, done forever.

### Revenue Projections (Conservative)

| Metric | Year 1 | Year 2 | Year 3 |
|--------|--------|--------|--------|
| Downloads (free trial) | 80,000 | 200,000 | 350,000 |
| Conversion rate | 12% | 15% | 18% |
| Paid users | 9,600 | 30,000 | 63,000 |
| Revenue (after 30% App Store cut) | $33,600 | $105,000 | $220,500 |
| Cumulative paid users | 9,600 | 39,600 | 102,600 |

### Purchase Structure

- **Free trial:** Full functionality for 14 days. After trial, limited to 3 subscriptions. Upgrading unlocks unlimited subscriptions + widget + export. This keeps the app useful enough for the trial period to hook users.
- **App Store IAP:** $4.99 via RevenueCat
- **Direct purchase:** $4.99 via Lemon Squeezy (web version)

### Why $4.99 Works

1. **Impulse buy territory.** $4.99 is less than one month of nearly every subscription the app tracks. The value prop is self-evident.
2. **Zero marginal cost.** No server, no API, no cloud storage. Every sale is pure margin (minus App Store cut).
3. **Anti-subscription positioning is the brand.** Charging a subscription would destroy the core marketing angle.
4. **Bobby proved the market at $1.99.** 500K+ downloads at $1.99 with an abandoned app. A well-maintained $4.99 app with modern features should exceed that.
5. **Higher conversion than free-with-ads.** The target user is already skeptical of "free" apps. A clear, low price builds trust.

---

## Marketing Angle

### Core Message

**"A non-subscription app that tracks your subscriptions."**

Secondary messages:
- "Know what you're paying for. $4.99, once."
- "Your subscriptions, your device. No bank password required."
- "$4.99 is less than one month of the subscriptions you'll cancel."

### The Irony Angle

The inherent irony of a non-subscription subscription tracker is the primary viral hook. It's:
- **Memeable** — "Wait, a subscription tracker that ISN'T a subscription?"
- **Self-recommending** — People share it because the concept is amusing and useful
- **Contrarian** — Positions against the entire subscription economy
- **Quotable** — Every review will mention the irony, which is free marketing

### Launch Channels

#### Reddit (Primary — organic)
- **r/personalfinance** (18M) — "I built a $5 app that shows you exactly what you're paying for each month" (show-and-tell post with screenshots)
- **r/LifeProTips** — "LPT: Track all your subscriptions in one place and you'll be shocked at the total"
- **r/frugal** (2.5M) — "A $4.99 app that helps you cancel subscriptions you forgot about"
- **r/privacy** (1.8M) — "A subscription tracker that doesn't require bank access"
- **r/apple** / **r/iphone** — App showcase with focus on widget and design quality

#### Twitter/X Viral Play
- Launch tweet: "I built a non-subscription subscription tracker. $4.99 once. Tracks Netflix, Spotify, and everything else you're paying for each month. No bank connections, no account, no ads. Just a list of what you're paying and when."
- Screenshot of the dashboard showing a realistic $200+/month total
- Thread: "The average American pays $219/month in subscriptions. Most people underestimate by 2-3x. Here's what happens when you actually add them all up."

#### Product Hunt
- Category: Finance, Productivity
- Tagline: "A non-subscription subscription tracker"
- First comment explains the irony and privacy angle

#### App Store Optimization
- Keywords: subscription tracker, subscription manager, recurring payments, cancel subscriptions, monthly bills
- Subtitle: "Track Subscriptions. No Subscription."
- Screenshots: dashboard with total, calendar view, widget, catalog quick-add

#### Press/Blog Coverage
- "Bobby alternative" angle for tech blogs that reviewed Bobby
- "Post-Mint privacy" angle for privacy-focused publications
- "Subscription fatigue" angle for mainstream finance publications (CNBC, The Verge, Wirecutter)

---

## MVP Timeline

### Pre-Development (Week 0)
- Finalize design tokens and component library spec
- Set up Turborepo monorepo with pnpm
- Configure shared TypeScript, ESLint, Prettier configs
- Create SQLite schema and migration system
- Curate and enter catalog data (200+ subscriptions with names, prices, categories, icons)

### Phase 1: Foundation (Weeks 1-2)
- Implement SQLite database layer with all tables
- Build subscription CRUD operations in `packages/shared`
- Create design token system and base UI components in `packages/ui`
- Build the subscription catalog data structure and search
- Implement renewal date calculation engine
- Implement monthly/annual/daily cost normalization
- Unit tests for renewal calculation and cost normalization

### Phase 2: Core UI (Weeks 3-4)
- Build Dashboard tab with monthly total, category bar, and subscription list
- Build Add Subscription screen (catalog browse + search + manual entry)
- Build Subscription Detail/Edit screen
- Implement subscription status transitions (active/paused/cancelled)
- Build price history tracking
- Implement sort and filter on subscription list
- Wire all screens to SQLite database

### Phase 3: Calendar & Notifications (Weeks 5-6)
- Build Calendar tab with renewal date indicators
- Implement calendar navigation (month swipe)
- Build renewal list view per date
- Set up `expo-notifications` for local scheduling
- Implement per-subscription notification preferences
- Build free trial countdown and expiration alerts
- Implement monthly summary notification
- Test notification scheduling across timezone changes and app restarts

### Phase 4: Insights, Widget & Polish (Weeks 7-8)
- Build Insights tab (donut chart, trend line, cancelled savings)
- Implement lifetime cost calculation
- Build iOS widget (small + medium sizes) via WidgetKit config plugin
- Build Android widget via `react-native-android-widget`
- Build onboarding flow (5-step wizard)
- Implement CSV export
- Implement "share as text" feature
- Build settings screen
- Polish animations and transitions

### Phase 5: Launch Prep (Week 9)
- App Store screenshots and metadata
- Write App Store description and keywords
- Set up RevenueCat for IAP
- Set up Lemon Squeezy for direct sales
- Build simple marketing landing page
- Prepare Product Hunt launch materials
- Beta test with 20+ users
- Fix bugs from beta feedback
- Submit to App Store review

### Phase 6: Launch (Week 10)
- App Store release
- Product Hunt launch
- Reddit posts (r/personalfinance, r/frugal, r/privacy, r/apple)
- Twitter/X launch thread
- Begin content marketing cadence

### Post-MVP Roadmap (Not in scope for MVP)
- iPad-optimized layout
- Mac App Store release
- Apple Watch complication (monthly total)
- Shared household tracking (local only — no accounts, just multiple profiles)
- Budget integration tips (export format compatible with YNAB CSV import)
- Dark/light theme toggle (MVP is dark-only)
- Localization (10+ languages)
- Notification grouping (combine multiple renewals on the same day)
- Subscription deal alerts (bundled as static tips, not network-fetched)

---

## Acceptance Criteria

### Functional Requirements

1. **Add from catalog:** User can search the 200+ subscription catalog and add a subscription with pre-filled name, price, category, and icon. User can override any pre-filled value.
2. **Add manually:** User can create a custom subscription with name, price, billing cycle, category, start date, and notes.
3. **Dashboard:** Home screen shows monthly total (bold, prominent), annual projection, daily cost, category breakdown bar, upcoming renewals, and full subscription list.
4. **Renewal calendar:** Calendar view shows dot indicators on renewal dates. Tapping a date shows subscriptions renewing that day.
5. **Notifications:** User receives a local notification N days before each subscription renewal (configurable per subscription). Free trial expiration alerts work correctly.
6. **Status management:** User can mark subscriptions as active, paused, cancelled, or trial. Only active and trial subscriptions count toward totals.
7. **Price history:** When a user updates a subscription's price, the old price is recorded in price history with the effective date.
8. **Insights:** Spending by category chart, monthly trend chart, cancelled savings callout, and lifetime spending figure all display correct data.
9. **Widget:** iOS and Android home screen widgets show the monthly total and next 3 renewals. Widget updates daily.
10. **Export:** User can export subscription list as CSV or shareable text.

### Non-Functional Requirements

11. **Privacy:** App makes zero network requests. Verified by proxy monitoring during a full test session.
12. **Performance:** Dashboard loads in <200ms with 50+ subscriptions. Catalog search returns results in <50ms.
13. **Offline:** App works identically with no network connection (it should — there are no network dependencies).
14. **Data integrity:** All prices stored as integer cents. Renewal calculations handle month-end edge cases (e.g., subscription starting Jan 31, next renewal Feb 28).
15. **Notifications reliability:** Local notifications fire correctly even after device restart and timezone changes.
16. **Platform:** Runs on iOS 16+ and Android 13+.

### Launch Requirements

17. **App Store approval:** App passes review on first submission.
18. **Payment flow:** RevenueCat IAP purchase, restore, and free trial all work end-to-end.
19. **Onboarding:** New user can add 5 subscriptions from the catalog in under 60 seconds.
20. **Catalog completeness:** At least 200 subscriptions in the pre-populated catalog with accurate default prices as of launch date.
21. **Beta validation:** At least 15 beta testers have used the app for 1+ week, confirming notifications work and totals are accurate.
