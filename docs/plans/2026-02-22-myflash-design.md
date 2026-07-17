# MyFlash — Design Document

**Date:** 2026-02-22
**Status:** Draft
**Author:** MyApps Product Team

---

## 1. Overview

**MyFlash** — The flashcard app that respects your brain and your privacy.

A spaced repetition flashcard app built for serious learners who want Anki's proven algorithm wrapped in a modern, beautiful interface — without subscriptions, cloud accounts, or data harvesting. Your decks live on your device. Period.

MyFlash combines the FSRS (Free Spaced Repetition Scheduler) algorithm with a native mobile-first UX, rich card editing, and seamless Anki deck import. One-time purchase. No accounts. No cloud sync. No telemetry.

---

## 2. Problem Statement

Spaced repetition is the most scientifically validated study method, yet the market is broken in three ways:

1. **Anki** — The gold standard algorithm, but the iOS app is $25, the mobile UX is from 2012, and the learning curve is brutal. Power users love it; everyone else bounces. The desktop app is free but the iOS app's price and dated interface drives users to inferior alternatives.

2. **Quizlet** — Beautiful UX but pivoted to $8/month subscriptions, removed free features, and harvests user study data. The 2024-2025 subscription backlash drove millions of users to seek alternatives. Quizlet's spaced repetition implementation is also significantly weaker than SM-2 or FSRS.

3. **Brainscape** — $10/month for "Certified" decks and full features. Locks premium content behind paywalls. Confidence-based repetition is less proven than FSRS/SM-2.

**The gap:** No app offers a modern UX + state-of-the-art spaced repetition + privacy-first architecture + one-time pricing. MyFlash fills this gap.

---

## 3. Target User Persona

### Primary: "Studious Sarah" — Medical/Language Student

- **Age:** 20-30
- **Context:** Medical student, language learner, or graduate student who studies 30-90 minutes daily
- **Current tools:** Anki (desktop) but frustrated with mobile experience; tried Quizlet but hit the paywall
- **Pain points:** Anki's mobile UX is painful for on-the-go review; Quizlet's subscription feels exploitative for flashcards; worried about study data being harvested
- **Willingness to pay:** Happily pays $10 one-time for a tool they use daily. Allergic to subscriptions for study tools.
- **Where they hang out:** r/Anki, r/medicalschool, r/languagelearning, r/MCAT, r/Step1, StudyGram (Instagram), TikTok study communities

### Secondary: "Lifelong Larry" — Professional/Hobbyist Learner

- **Age:** 30-55
- **Context:** Professional learning new skills, hobbyist studying history/science, parent helping kids study
- **Current tools:** Physical flashcards or basic notes apps
- **Pain points:** Doesn't want to learn Anki's complexity; doesn't want another subscription; wants something that "just works"
- **Willingness to pay:** $10 is impulse-buy territory for a useful tool

---

## 4. Competitive Landscape

| App | Price | Est. Users | Est. Revenue | Privacy Stance | Spaced Repetition | Key Weakness |
|-----|-------|-----------|-------------|----------------|-------------------|--------------|
| **Quizlet** | $8/mo ($96/yr) | 60M+ | ~$500M/yr | Harvests study data, serves ads | Basic (inferior to SM-2) | Subscription backlash, weak SR algorithm |
| **Anki** | $25 iOS, free elsewhere | 10M+ | ~$15M/yr (iOS only) | Good (local-first) | SM-2 (gold standard) | Terrible mobile UX, steep learning curve |
| **Brainscape** | $10/mo ($120/yr) | 2M+ | ~$20M/yr | Data collection | Confidence-based (less proven) | Expensive, paywalled content |
| **Memrise** | $9/mo ($108/yr) | 65M+ | ~$30M/yr | Data collection | Proprietary | Language-focused only, subscription |
| **RemNote** | $8/mo ($96/yr) | 500K+ | ~$5M/yr | Cloud-synced | SM-2 variant | Feature bloat, note-taking hybrid |
| **MyFlash** | **$4.99 one-time** | **0 (launch)** | **TBD** | **Local-only, zero telemetry** | **FSRS (state of the art)** | **New, no community decks** |

### Competitive Advantages

1. **Algorithm:** FSRS outperforms SM-2 by 15-20% on retention metrics (peer-reviewed research by Jarrett Ye). No competitor except Anki (via add-on) uses FSRS.
2. **Price:** $4.99 one-time vs $96-120/year. Pays for itself in the first month.
3. **Privacy:** Zero data leaves the device. No accounts. No telemetry. Competitors harvest study patterns.
4. **UX:** Modern native interface vs Anki's 2012-era mobile UI.
5. **Import:** Direct Anki .apkg import captures the largest existing user base.

---

## 5. Key Features (MVP)

### 5.1 Deck & Card Management
- Create, edit, delete decks with name, description, and color tag
- Create cards within decks: Basic (front/back), Cloze deletion (fill-in-the-blank), Image occlusion
- Rich card editor with Markdown support (bold, italic, lists, code blocks, LaTeX math via KaTeX)
- Image attachments on cards (stored locally, referenced by path)
- Audio attachments for pronunciation (language learning use case)
- Deck folders for organization (nested one level deep)
- Card search across all decks (full-text search on local SQLite FTS5)
- Card tags for cross-deck filtering

### 5.2 Spaced Repetition Engine (FSRS)
- FSRS v4 algorithm implementation (Free Spaced Repetition Scheduler)
- Four review ratings: Again, Hard, Good, Easy
- Per-card difficulty, stability, and retrievability tracking
- Automatic interval scheduling based on desired retention rate (default 90%)
- User-configurable target retention (80%-99%)
- New card introduction limits (default 20/day, configurable)
- Review card daily limits (configurable or unlimited)
- Learning steps for new cards (1min, 10min configurable)
- Re-learning steps for lapsed cards

### 5.3 Study Sessions
- Study screen with card flip animation
- Session types: Review due cards, Learn new cards, Custom study (filtered deck)
- Session summary with cards reviewed, accuracy, time spent
- Undo last review (within session)
- Study timer (optional Pomodoro mode)
- End-of-session stats: retention rate, cards mature/young/new breakdown

### 5.4 Anki Import
- Import .apkg files (Anki package format — ZIP containing SQLite + media)
- Parse Anki's `collection.anki2` SQLite database for notes, cards, decks, and models
- Map Anki note types to MyFlash card types (Basic, Cloze, Image Occlusion)
- Import media files (images, audio) from the package
- Preserve deck hierarchy
- Handle Anki's HTML card templates by rendering to clean markdown
- Import progress: show deck count, card count, media count during import
- Conflict resolution: skip duplicates by note GUID

### 5.5 Statistics & Progress
- Daily review count chart (bar chart, last 30 days)
- Card maturity pie chart (new / young / mature)
- Retention rate over time (line chart, last 30 days)
- Current and longest streak (consecutive days studied)
- Forecast: predicted reviews for next 30 days
- Per-deck statistics breakdown
- Heatmap calendar (GitHub-style contribution graph for study days)

### 5.6 Settings & Preferences
- FSRS parameters: target retention, new cards/day, max reviews/day
- Appearance: dark mode (default), light mode, system
- Card display: font size, flip animation speed
- Study: auto-play audio, show timer, Pomodoro duration
- Data: export all decks (.apkg format), import backup, clear all data
- About: version, licenses, privacy policy (local link)

---

## 6. Technical Architecture

### 6.1 Stack

- **Mobile:** Expo (React Native) — iOS + Android from single codebase
- **Web:** Next.js 15 — study on desktop browser
- **Database:** SQLite via `expo-sqlite` (mobile) / `better-sqlite3` (web, via WASM or server-side)
- **Monorepo:** Turborepo
- **Package Manager:** pnpm
- **Language:** TypeScript everywhere
- **Card Rendering:** React Native WebView for rich card content (Markdown + LaTeX)
- **LaTeX:** KaTeX (client-side rendering, no server dependency)
- **Charts:** Victory Native (mobile), Recharts (web)
- **File Handling:** expo-file-system (mobile), File API (web)
- **Animations:** React Native Reanimated (card flip, transitions)

### 6.2 Monorepo Structure

```
MyFlash/
├── apps/
│   ├── mobile/                # Expo (React Native)
│   │   ├── app/               # Expo Router (tab-based navigation)
│   │   │   ├── (tabs)/
│   │   │   │   ├── decks/     # Deck list, deck detail, card editor
│   │   │   │   ├── study/     # Study session screen
│   │   │   │   ├── stats/     # Statistics dashboard
│   │   │   │   └── settings/  # App settings
│   │   │   └── _layout.tsx
│   │   ├── components/        # Mobile-specific components
│   │   │   ├── CardFlip.tsx
│   │   │   ├── DeckCard.tsx
│   │   │   ├── StudyControls.tsx
│   │   │   └── RichCardView.tsx
│   │   └── assets/
│   └── web/                   # Next.js 15
│       ├── app/
│       │   ├── decks/
│       │   ├── study/
│       │   ├── stats/
│       │   └── settings/
│       └── components/
├── packages/
│   ├── shared/                # Shared business logic
│   │   ├── src/
│   │   │   ├── fsrs/          # FSRS algorithm implementation
│   │   │   │   ├── algorithm.ts
│   │   │   │   ├── scheduler.ts
│   │   │   │   └── types.ts
│   │   │   ├── db/            # Database schema and queries
│   │   │   │   ├── schema.ts
│   │   │   │   ├── migrations.ts
│   │   │   │   └── queries.ts
│   │   │   ├── import/        # Anki import logic
│   │   │   │   ├── apkg-parser.ts
│   │   │   │   ├── card-mapper.ts
│   │   │   │   └── media-extractor.ts
│   │   │   ├── models/        # TypeScript types and Zod schemas
│   │   │   └── stats/         # Statistics computation
│   │   └── package.json
│   ├── ui/                    # Shared UI components
│   │   ├── src/
│   │   │   ├── theme.ts       # Dark mode tokens, colors, typography
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   └── ...
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

### 6.3 Data Model (SQLite Schema)

```sql
-- Deck organization
CREATE TABLE decks (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name            TEXT NOT NULL,
    description     TEXT DEFAULT '',
    color           TEXT DEFAULT '#F59E0B',  -- amber-500
    parent_deck_id  TEXT REFERENCES decks(id) ON DELETE SET NULL,
    card_count      INTEGER DEFAULT 0,       -- denormalized for performance
    position        INTEGER DEFAULT 0,       -- sort order within parent
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Card content (note-based, like Anki)
CREATE TABLE notes (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    guid            TEXT UNIQUE,             -- for Anki import dedup
    deck_id         TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    note_type       TEXT NOT NULL CHECK (note_type IN ('basic', 'cloze', 'image_occlusion')),
    front           TEXT NOT NULL DEFAULT '', -- Markdown content
    back            TEXT NOT NULL DEFAULT '', -- Markdown content
    extra           TEXT DEFAULT '',          -- Additional fields (cloze source, etc.)
    tags            TEXT DEFAULT '[]',        -- JSON array of tag strings
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Card scheduling (one card per note for basic, multiple for cloze)
CREATE TABLE cards (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    note_id         TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    deck_id         TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    ordinal         INTEGER NOT NULL DEFAULT 0,  -- for cloze: which deletion
    -- FSRS state
    state           TEXT NOT NULL DEFAULT 'new' CHECK (state IN ('new', 'learning', 'review', 'relearning')),
    difficulty      REAL NOT NULL DEFAULT 0.0,
    stability       REAL NOT NULL DEFAULT 0.0,
    retrievability  REAL NOT NULL DEFAULT 1.0,
    elapsed_days    INTEGER NOT NULL DEFAULT 0,
    scheduled_days  INTEGER NOT NULL DEFAULT 0,
    reps            INTEGER NOT NULL DEFAULT 0,
    lapses          INTEGER NOT NULL DEFAULT 0,
    due             TEXT NOT NULL DEFAULT (datetime('now')),
    last_review     TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Review history (for FSRS optimization and statistics)
CREATE TABLE review_log (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    card_id         TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    rating          INTEGER NOT NULL CHECK (rating IN (1, 2, 3, 4)), -- Again=1, Hard=2, Good=3, Easy=4
    state           TEXT NOT NULL,            -- card state before review
    elapsed_days    INTEGER NOT NULL,
    scheduled_days  INTEGER NOT NULL,
    duration_ms     INTEGER DEFAULT 0,        -- time spent on card
    reviewed_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Media attachments
CREATE TABLE media (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    note_id         TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    filename        TEXT NOT NULL,
    mime_type       TEXT NOT NULL,
    size_bytes      INTEGER NOT NULL,
    local_path      TEXT NOT NULL,            -- relative path in app's document directory
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Study streaks
CREATE TABLE study_days (
    date            TEXT PRIMARY KEY,         -- YYYY-MM-DD
    cards_reviewed  INTEGER NOT NULL DEFAULT 0,
    time_spent_ms   INTEGER NOT NULL DEFAULT 0,
    new_cards       INTEGER NOT NULL DEFAULT 0,
    retention_rate  REAL DEFAULT NULL         -- % correct on review cards
);

-- App settings (key-value)
CREATE TABLE settings (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL
);

-- Full-text search
CREATE VIRTUAL TABLE notes_fts USING fts5(
    front, back, extra, tags,
    content='notes',
    content_rowid='rowid'
);

-- Indexes
CREATE INDEX idx_cards_due ON cards(due);
CREATE INDEX idx_cards_deck ON cards(deck_id);
CREATE INDEX idx_cards_state ON cards(state);
CREATE INDEX idx_notes_deck ON notes(deck_id);
CREATE INDEX idx_review_log_card ON review_log(card_id);
CREATE INDEX idx_review_log_date ON review_log(reviewed_at);
CREATE INDEX idx_media_note ON media(note_id);
```

### 6.4 FSRS Algorithm Implementation

The FSRS (Free Spaced Repetition Scheduler) v4 algorithm is the core engine. Key parameters:

```typescript
interface FSRSParameters {
  requestRetention: number;  // target retention rate (default 0.9)
  maximumInterval: number;   // max days between reviews (default 36500)
  w: number[];               // 17 optimizable weights (default values from FSRS research)
}

interface CardState {
  difficulty: number;     // 0-10 scale
  stability: number;      // days until retrievability drops to 90%
  retrievability: number; // current probability of recall (0-1)
  state: 'new' | 'learning' | 'review' | 'relearning';
  reps: number;
  lapses: number;
  elapsedDays: number;
  scheduledDays: number;
  due: Date;
  lastReview: Date | null;
}

type Rating = 'again' | 'hard' | 'good' | 'easy'; // maps to 1-4

interface SchedulingResult {
  again: { card: CardState; interval: number };
  hard:  { card: CardState; interval: number };
  good:  { card: CardState; interval: number };
  easy:  { card: CardState; interval: number };
}
```

**Algorithm flow:**
1. Given current card state, compute new difficulty and stability for each possible rating
2. Compute next interval from stability and target retention: `interval = stability * (requestRetention^(1/decay) - 1)`
3. Return all four scheduling options; UI shows the intervals to the user
4. After user rates, update card state and log the review

We use the open-source `ts-fsrs` package (MIT licensed, maintained by the FSRS community) rather than reimplementing from scratch. This gives us battle-tested weights and the parameter optimization routine.

### 6.5 Anki Import Architecture

```
.apkg file (ZIP archive)
├── collection.anki2      # SQLite database (notes, cards, decks, models)
├── collection.anki21     # (newer format, same structure)
├── media                 # JSON mapping: {"0": "image.jpg", "1": "audio.mp3"}
├── 0                     # media file (renamed by index)
├── 1                     # media file
└── ...
```

**Import pipeline:**
1. Unzip .apkg to temp directory
2. Open `collection.anki2` SQLite database
3. Read `col` table for deck config and note types (models)
4. Read `notes` table: map each note to MyFlash `notes` table
   - Parse Anki HTML fields to Markdown
   - Detect cloze deletions (`{{c1::text}}`) and create appropriate card type
   - Extract media references (`<img src="...">`, `[sound:...]`)
5. Read `cards` table: create MyFlash `cards` with reset scheduling (start fresh with FSRS)
6. Copy media files to app's document directory
7. Create deck hierarchy from Anki's `::` separated deck names
8. Report import summary: decks, cards, media imported, skipped duplicates

### 6.6 Privacy Architecture

- **Zero network requests:** The app makes no HTTP calls. No analytics, no crash reporting, no telemetry.
- **Local SQLite only:** All data stored in the app's sandboxed document directory.
- **No accounts:** No user registration, no login, no cloud sync.
- **Export is explicit:** User must manually trigger export to create an .apkg file. The file goes wherever they choose (AirDrop, Files, email).
- **No clipboard snooping:** App does not read clipboard.
- **No background activity:** App does not run background tasks or fetch data.
- **App Transport Security:** iOS ATS is fully enabled (irrelevant since we make no network calls, but belt-and-suspenders).

---

## 7. UI/UX Direction

### 7.1 Design Language

- **Theme:** Dark mode default, warm accent colors (amber primary, coral for streaks, teal for stats)
- **Typography:** Inter (humanist sans-serif), 16pt base, SF Mono for code blocks on cards
- **Colors:**
  - Background: `#0F0F0F` (near-black)
  - Surface: `#1A1A1A` (card backgrounds)
  - Surface elevated: `#242424` (modals, sheets)
  - Primary: `#F59E0B` (amber-500)
  - Accent: `#F97316` (orange-500, for streaks/fire)
  - Success: `#14B8A6` (teal-500, for correct/mature)
  - Error: `#EF4444` (red-500, for Again/lapses)
  - Text primary: `#F5F5F5`
  - Text secondary: `#A3A3A3`
- **Iconography:** Lucide icons (consistent, clean, MIT licensed)
- **Animations:** Reanimated 3 — card flip (0.3s spring), button press feedback, streak fire animation
- **No shield icons, no lock icons** — privacy is the default, not a selling point to visualize with security metaphors

### 7.2 Screen Flow

```
App Launch
├── Decks Tab (default)
│   ├── Deck List (grid or list view)
│   │   ├── [+ New Deck] → Create Deck Sheet
│   │   ├── [Deck] → Deck Detail
│   │   │   ├── Card List (sortable, searchable)
│   │   │   ├── [+ New Card] → Card Editor
│   │   │   │   ├── Card Type Selector (Basic / Cloze / Image Occlusion)
│   │   │   │   ├── Front Editor (Markdown + media)
│   │   │   │   ├── Back Editor (Markdown + media)
│   │   │   │   ├── Tags Input
│   │   │   │   └── [Save]
│   │   │   ├── [Study] → Study Session
│   │   │   └── [Edit Deck] → Edit Deck Sheet
│   │   └── [Import] → File Picker (.apkg) → Import Progress → Import Summary
│   └── Search Bar → Full-text search across all cards
├── Study Tab
│   ├── Today's Overview (due cards, new cards, forecast)
│   ├── [Start Study] → Study Session
│   │   ├── Card Display (front)
│   │   ├── [Show Answer] → Card Display (front + back)
│   │   ├── Rating Buttons: Again | Hard | Good | Easy (with next intervals shown)
│   │   ├── [Undo] → Revert last rating
│   │   └── Session Complete → Session Summary
│   └── Custom Study → Filtered Deck Builder
├── Stats Tab
│   ├── Streak Counter (current + longest)
│   ├── Today's Stats (reviewed, accuracy, time)
│   ├── Charts
│   │   ├── Reviews per Day (bar, 30d)
│   │   ├── Retention Rate (line, 30d)
│   │   ├── Card Maturity (pie)
│   │   └── Forecast (bar, next 30d)
│   ├── Heatmap Calendar (365 days)
│   └── Per-Deck Breakdown
└── Settings Tab
    ├── Study Settings (new cards/day, max reviews, target retention)
    ├── Appearance (dark/light/system, font size)
    ├── Data (export, import backup, clear data)
    └── About
```

### 7.3 Key Interaction Patterns

**Card Flip:** Tap "Show Answer" — card rotates on Y-axis (3D perspective transform) to reveal the back. The flip feels physical and satisfying. Spring animation (damping: 15, stiffness: 150).

**Rating Buttons:** Four buttons along the bottom — Again (red), Hard (orange), Good (teal), Easy (blue). Each button shows the computed next interval ("10m", "1d", "4d", "9d"). Buttons use haptic feedback on press.

**Streak Fire:** When the user maintains a streak of 3+ days, a subtle flame animation appears next to the streak counter. Not gamification — just warm encouragement.

**Swipe Gestures:** In the deck list, swipe left to delete, swipe right to start studying. In the card list, swipe to edit or delete.

---

## 8. Monetization

### 8.1 Pricing Model

- **$4.99 one-time purchase** via App Store (iOS/Android) and Mac App Store
- **Direct purchase option** via Lemon Squeezy for users who prefer to avoid the App Store
- **No free tier limitations** — the full app is the paid app. No feature gating, no ads, no trials.
- **No subscriptions.** Ever. This is a core brand promise.

### 8.2 Revenue Projections (Conservative)

| Metric | Month 1 | Month 6 | Month 12 |
|--------|---------|---------|----------|
| Downloads | 500 | 3,000/mo | 5,000/mo |
| Revenue (gross) | $2,495 | $14,970/mo | $24,950/mo |
| Revenue (net, after Apple 15%) | $2,121 | $12,725/mo | $21,208/mo |

**Revenue channels:**
- RevenueCat for App Store IAP management (handles Apple/Google receipts)
- Lemon Squeezy for direct sales (higher margin, ~5% vs Apple's 15-30%)

### 8.3 Cost Structure

- **Hosting:** $0 (no backend, local-only)
- **App Store fees:** Apple 15% (small business program), Google 15%
- **Development:** Time investment only
- **Marketing:** Organic + targeted Reddit/community posts

---

## 9. Marketing Angle

### 9.1 Core Messaging

**Tagline:** "The flashcard app that respects your brain and your privacy."

**Positioning statements:**
- "Anki's algorithm, modern UX, one-time purchase."
- "Your decks stay on your device. No accounts. No cloud. No subscriptions."
- "Import your Anki decks in one tap. Better UX, same science."
- "FSRS: the algorithm that outperforms Anki's SM-2 by 15%."

### 9.2 Launch Channels

| Channel | Strategy | Expected Impact |
|---------|----------|-----------------|
| **r/Anki** (170K members) | "I built a modern Anki alternative" post with comparison screenshots | High — direct competitor audience |
| **r/medicalschool** (430K) | "Med student here, built the flashcard app I wished existed" | High — heavy Anki users, price-sensitive |
| **r/languagelearning** (2.2M) | Feature post on FSRS + privacy for language decks | Medium — large audience, varied tools |
| **r/MCAT** (190K), **r/Step1** (110K) | Targeted posts comparing to Quizlet/Anki for exam prep | High — intense study needs |
| **Product Hunt** | Launch with demo video, "Anki Killer" angle | Medium — tech-savvy early adopters |
| **Hacker News** | "Show HN: Local-first flashcards with FSRS" — privacy angle resonates | Medium — developer/privacy audience |
| **StudyTube / StudyGram** | Partner with 2-3 study influencers for honest reviews | Medium — visual, aspirational study content |

### 9.3 Content Strategy

- **Blog posts:** "Why FSRS Beats SM-2", "How to Migrate from Anki to MyFlash", "The Problem with Quizlet's Privacy Policy"
- **Comparison pages:** MyFlash vs Anki, MyFlash vs Quizlet, MyFlash vs Brainscape (SEO-optimized)
- **App Store optimization:** Keywords targeting "anki alternative", "flashcards offline", "spaced repetition private"

### 9.4 Anki Migration as Growth Engine

The single most important growth lever: **frictionless Anki import.** Anki has 10M+ users and a massive library of shared decks. By importing .apkg files, MyFlash can:
1. Capture frustrated Anki mobile users immediately (their existing decks work on day one)
2. Benefit from the Anki shared deck ecosystem without building one ourselves
3. Position as an "upgrade" rather than a "replacement" — users keep their content

---

## 10. MVP Timeline

### Week 1-2: Foundation
- [ ] Initialize Turborepo monorepo with Expo + Next.js + shared packages
- [ ] Set up SQLite database layer with schema and migrations
- [ ] Implement FSRS algorithm in `packages/shared/` (wrap `ts-fsrs`)
- [ ] Basic deck CRUD (create, read, update, delete)
- [ ] Basic note/card CRUD (basic card type only)
- [ ] Tab navigation scaffold (Decks, Study, Stats, Settings)

### Week 3-4: Core Study Experience
- [ ] Study session screen with card display and flip animation
- [ ] FSRS scheduling integration (compute intervals, update card state)
- [ ] Rating buttons with next-interval preview
- [ ] Session summary screen
- [ ] Review log recording
- [ ] Due card queue computation (today's reviews + new cards)
- [ ] Undo last review within session

### Week 5-6: Card Editor & Types
- [ ] Rich card editor with Markdown support
- [ ] Cloze deletion card type ({{c1::text}} syntax)
- [ ] Image occlusion card type
- [ ] Image attachment support (pick from camera roll, store locally)
- [ ] Audio attachment support (record or pick file)
- [ ] LaTeX rendering via KaTeX in card display
- [ ] Card tags and tag-based filtering

### Week 7-8: Anki Import
- [ ] .apkg file picker and unzip
- [ ] Anki SQLite database parser (notes, cards, decks, models)
- [ ] HTML-to-Markdown converter for Anki card fields
- [ ] Cloze detection and mapping
- [ ] Media file extraction and local storage
- [ ] Deck hierarchy reconstruction
- [ ] Import progress UI and summary
- [ ] Duplicate detection (GUID-based)

### Week 9-10: Statistics & Polish
- [ ] Streak tracking (study_days table population)
- [ ] Statistics dashboard: review chart, retention chart, maturity pie
- [ ] Heatmap calendar component
- [ ] Forecast chart (predicted reviews for next 30 days)
- [ ] Settings screen (study parameters, appearance, data export)
- [ ] Full-text search across all cards
- [ ] Custom study / filtered deck builder
- [ ] App icon, splash screen, App Store screenshots

### Week 11-12: Launch Prep
- [ ] Next.js web app (study + deck management)
- [ ] Cross-platform testing (iOS, Android, web)
- [ ] App Store metadata, description, screenshots, preview video
- [ ] Privacy policy and App Store compliance
- [ ] RevenueCat integration (one-time purchase)
- [ ] Lemon Squeezy storefront for direct sales
- [ ] Beta testing with 10-20 Anki users from Reddit
- [ ] Launch day: App Store + Product Hunt + Reddit posts

---

## 11. Acceptance Criteria

The MVP is complete when all of the following are true:

### Functional
- [ ] User can create decks with name, description, and color
- [ ] User can create Basic, Cloze, and Image Occlusion cards with Markdown support
- [ ] User can attach images and audio to cards
- [ ] FSRS algorithm correctly schedules reviews with configurable target retention
- [ ] Study session presents due cards, accepts ratings, updates scheduling
- [ ] User can undo the last review within a session
- [ ] Anki .apkg files import successfully (decks, cards, media preserved)
- [ ] Statistics display streak, review charts, retention rate, card maturity
- [ ] Full-text search returns relevant cards across all decks
- [ ] Settings allow customization of study parameters and appearance
- [ ] Export produces a valid backup that can be re-imported
- [ ] App works fully offline on iOS, Android, and web

### Non-Functional
- [ ] Cold launch to deck list < 1 second
- [ ] Card flip animation runs at 60fps
- [ ] Database handles 50,000+ cards without perceptible lag
- [ ] Anki import of 10,000-card deck completes in < 30 seconds
- [ ] App size < 30MB (before user content)
- [ ] Zero network requests (verified via network inspector)
- [ ] All data stored in app sandbox / document directory

### Business
- [ ] App Store listing live on iOS and Android
- [ ] One-time purchase flow works via RevenueCat
- [ ] Direct purchase flow works via Lemon Squeezy
- [ ] Privacy policy published (emphasizes local-only data)
- [ ] Launch posts prepared for r/Anki, r/medicalschool, r/languagelearning, Product Hunt

---

## 12. Future Roadmap (Post-MVP)

These are explicitly **not** in the MVP but planned for future releases:

1. **Shared deck marketplace** — Community-contributed decks hosted on a CDN (download once, stored locally). No accounts required to download; optional account to publish.
2. **FSRS parameter optimization** — Use the review_log to compute personalized FSRS weights per user (the algorithm supports this; it just needs enough review data).
3. **Collaborative deck editing** — Share a deck via link; recipient gets a copy. No real-time sync (stays local-first).
4. **Widgets** — iOS/Android home screen widgets showing due card count and streak.
5. **Apple Watch companion** — Quick review of basic cards from the wrist.
6. **PDF/textbook scan** — OCR a textbook page, auto-generate flashcards with AI (optional, on-device or one-shot API call with user consent).
7. **Keyboard shortcuts** — Full keyboard navigation for web and tablet users.
8. **Accessibility** — VoiceOver/TalkBack full support, high contrast mode, reduced motion option.
