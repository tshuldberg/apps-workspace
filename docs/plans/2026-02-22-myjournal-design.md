# MyJournal — Design Document

**Date:** 2026-02-22
**Status:** Draft
**Author:** MyApps Product Team

---

## Overview

**MyJournal** — Your thoughts never leave your device. Period.

A private, local-first journaling app for iOS, Android, Mac, and web. Rich markdown editor, daily entries with date-based navigation, search, tags, photo attachments, encrypted local storage, and export to Markdown/PDF. Optional voice-to-journal powered by whisper.cpp (same engine as MyVoice). No accounts, no cloud sync, no telemetry.

### Core Differentiators

1. **Truly private** — All data stored locally in an encrypted SQLite database. No server, no sync, no analytics. Your journal never touches a network.
2. **One-time purchase** — $4.99 forever. No subscription fatigue. Day One charges $35/yr, Penzu charges $20/yr, Journey charges $30/yr.
3. **Voice-to-journal** — Whisper.cpp on-device transcription turns voice memos into journal entries. Record your thoughts on a walk, review and edit later.
4. **Source-available** — FSL license means you can audit every line of code. Trust, but verify.
5. **Native quality, cross-platform** — Expo + Next.js delivers native feel on every platform from a single TypeScript codebase.

---

## Problem Statement

Journaling apps have a trust problem. Day One was acquired by Automattic (WordPress parent), shifting its business model toward cloud-first subscriptions. Penzu and Journey store entries on their servers. Users who journal about deeply personal topics — therapy reflections, relationship struggles, health fears, grief — are trusting companies with their most vulnerable thoughts.

The market offers a false choice: either use a polished app that stores your data on someone else's server, or use a plain text file with no structure. MyJournal eliminates this trade-off by delivering a beautiful, feature-rich journaling experience where data physically cannot leave the device.

---

## Target User Persona

### Primary: "Private Reflector"
- **Age:** 25-45
- **Gender:** Skews female (65% of journaling app users)
- **Behavior:** Journals 3-5 times per week, often before bed or during morning routine
- **Pain point:** Wants a structured journaling app but distrusts cloud storage for deeply personal content
- **Willingness to pay:** High — already pays for Day One or has tried free apps and found them lacking
- **Tech savvy:** Moderate — uses iPhone/Android daily, appreciates privacy but isn't a developer
- **Trigger:** Therapist recommended journaling, or a data breach in the news made them reconsider where their private thoughts are stored

### Secondary: "Therapy Journaler"
- **Age:** 20-35
- **Behavior:** Journals as part of therapy homework — CBT thought records, gratitude exercises, mood tracking
- **Pain point:** Needs prompts and mood tracking integrated into the journaling flow
- **Willingness to pay:** Moderate — therapist recommended it, so they'll buy a $4.99 app

### Tertiary: "Voice Thinker"
- **Age:** 25-50
- **Behavior:** Thinks out loud, prefers speaking to typing
- **Pain point:** Existing apps don't offer good voice-to-text journaling without cloud processing
- **Willingness to pay:** High — voice journaling is a killer feature they can't find elsewhere

---

## Competitive Landscape

| App | Price | Est. Users | Est. Revenue | Privacy Stance | Key Weakness |
|-----|-------|-----------|-------------|----------------|-------------|
| **Day One** | $35/yr | 15M+ | ~$50M ARR | Cloud-synced, E2E encryption optional, Automattic-owned | Subscription fatigue, corporate ownership erodes trust, E2E encryption is opt-in not default |
| **Penzu** | $20/yr | 2M+ | ~$5M ARR | Server-stored, encrypted at rest | Dated UI, limited mobile experience, encryption is server-side (they hold keys) |
| **Journey** | $30/yr | 5M+ | ~$15M ARR | Google Drive / own cloud sync | Heavily tied to Google ecosystem, subscription-only for key features |
| **Bear** | $30/yr | 3M+ | ~$10M ARR | iCloud sync (Apple ecosystem) | Not journaling-focused, iOS/Mac only, iCloud dependency |
| **Obsidian** | Free / $50 sync | 4M+ | ~$20M ARR | Local files, optional paid sync | Not journaling-focused, steep learning curve, Markdown purists only |
| **Apple Journal** | Free | Unknown | $0 (bundled) | On-device + iCloud | Extremely basic, no export, no search, no tags, Apple-only |
| **MyJournal** | **$4.99 one-time** | 0 (launch) | TBD | **Local-only, encrypted, source-available** | New entrant, no brand recognition |

### Market Opportunity

The journaling app market is valued at ~$1.2B and growing 8% annually. Day One's acquisition by Automattic in 2021 alienated privacy-conscious users. Apple Journal's 2024 launch validated the category but disappointed power users with its minimal feature set. There's a clear gap: **a polished, private, one-time-purchase journaling app**.

---

## Key Features (MVP)

### Core Journaling
1. **Rich markdown editor** — Full markdown support with live preview. Bold, italic, headers, lists, blockquotes, code blocks, horizontal rules. WYSIWYG toolbar for non-technical users.
2. **Daily entries with date-based navigation** — Calendar view to browse entries by date. Today button for quick access. Visual indicators for days with entries.
3. **Full-text search** — FTS5-powered search across all entries. Search by content, tags, or date range. Results highlighted in context.
4. **Tags/labels** — Organize entries with custom tags. Tag suggestions based on usage frequency. Filter entries by tag.
5. **Photo attachments** — Embed photos inline within entries. Photos stored locally alongside the database. Thumbnail grid view in the gallery.

### Privacy & Security
6. **Encrypted local storage** — SQLite database encrypted with SQLCipher (AES-256). User sets a passphrase on first launch. Database is unreadable without the passphrase.
7. **Biometric unlock** — Face ID / Touch ID / fingerprint to unlock the app. Passphrase required on first launch per device.
8. **No network access** — The app requests zero network permissions. No analytics, no crash reporting, no phone-home.
9. **Export to Markdown/PDF** — Export individual entries or full journal to Markdown files or a formatted PDF. Your data, your format, no lock-in.

### Voice & Mood
10. **Voice-to-journal** — Tap the microphone icon to record. Whisper.cpp transcribes on-device. Review and edit the transcription before saving. Audio recording optionally attached to the entry.
11. **Mood tag per entry** — Select a mood from a simple 5-point scale (1-5 with emoji faces). Mood trends visible in a monthly chart.
12. **Writing prompts** — Optional daily prompt shown on the new entry screen. Curated list of 365+ prompts (gratitude, reflection, goals, creative). Prompts can be disabled.

### UX Polish
13. **Night mode optimized** — Dark theme with warm amber tones designed for bedtime journaling. Reduced blue light. Dimmed interface for late-night use.
14. **Streak tracking** — Visual streak counter on the home screen. Gentle encouragement, not gamification. No notifications unless opted in.
15. **Word count & stats** — Per-entry word count. Monthly/yearly writing stats (total entries, total words, longest streak, most common tags, mood average).

---

## Technical Architecture

### Stack

- **Frontend (Mobile):** Expo (React Native) — iOS + Android from single codebase
- **Frontend (Web):** Next.js 15
- **Frontend (Desktop):** Expo for Mac (via Catalyst) or Next.js as desktop webapp
- **Database:** SQLite via `expo-sqlite` (mobile) / `better-sqlite3` (web/desktop)
- **Encryption:** SQLCipher (AES-256-CBC, PBKDF2 key derivation from user passphrase)
- **Voice Transcription:** whisper.cpp (WASM for web, native binary for mobile/desktop)
- **Markdown:** `react-native-markdown-display` (mobile), `@uiw/react-md-editor` (web)
- **Monorepo:** Turborepo
- **Package Manager:** pnpm
- **Language:** TypeScript everywhere
- **License:** FSL-1.1-Apache-2.0

### Monorepo Structure

```
MyJournal/
├── apps/
│   ├── mobile/                # Expo (React Native) — iOS + Android
│   │   ├── app/               # Expo Router file-based routing
│   │   │   ├── (tabs)/        # Tab navigator
│   │   │   │   ├── index.tsx          # Today / home screen
│   │   │   │   ├── calendar.tsx       # Calendar browser
│   │   │   │   ├── search.tsx         # Full-text search
│   │   │   │   └── settings.tsx       # Settings
│   │   │   ├── entry/
│   │   │   │   ├── [id].tsx           # View/edit entry
│   │   │   │   └── new.tsx            # New entry
│   │   │   └── _layout.tsx
│   │   ├── components/        # Mobile-specific components
│   │   │   ├── editor/        # Markdown editor components
│   │   │   ├── mood/          # Mood picker, mood chart
│   │   │   └── voice/         # Voice recording UI
│   │   └── assets/
│   └── web/                   # Next.js 15 — Web + Desktop
│       ├── app/
│       │   ├── page.tsx               # Today view
│       │   ├── calendar/page.tsx      # Calendar browser
│       │   ├── search/page.tsx        # Search
│       │   ├── entry/[id]/page.tsx    # Entry view/edit
│       │   └── settings/page.tsx      # Settings
│       ├── components/
│       └── public/
├── packages/
│   ├── shared/                # Types, utils, business logic
│   │   ├── src/
│   │   │   ├── types/         # Entry, Tag, Mood, Prompt types
│   │   │   ├── db/            # SQLite schema, migrations, queries
│   │   │   ├── crypto/        # Encryption/decryption helpers
│   │   │   ├── search/        # FTS5 query builder
│   │   │   ├── export/        # Markdown/PDF export logic
│   │   │   ├── prompts/       # Writing prompt database (JSON)
│   │   │   └── stats/         # Word count, streak, mood analytics
│   │   └── package.json
│   ├── ui/                    # Shared component library
│   │   ├── src/
│   │   │   ├── editor/        # Cross-platform markdown editor
│   │   │   ├── calendar/      # Calendar navigation component
│   │   │   ├── mood/          # Mood picker, mood trend chart
│   │   │   ├── tags/          # Tag input, tag pills
│   │   │   └── theme/         # Design tokens, dark/night themes
│   │   └── package.json
│   └── voice/                 # Whisper.cpp integration
│       ├── src/
│       │   ├── recorder.ts    # Audio recording abstraction
│       │   ├── transcriber.ts # Whisper.cpp binding
│       │   └── models/        # Whisper model files (tiny/base)
│       └── package.json
├── turbo.json
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── CLAUDE.md
├── README.md
└── timeline.md
```

### Data Model (SQLite Schema)

```sql
-- Journal entries
CREATE TABLE entries (
    id TEXT PRIMARY KEY,                          -- UUID v4
    date TEXT NOT NULL,                            -- ISO date 'YYYY-MM-DD'
    title TEXT,                                    -- Optional title (first line or explicit)
    body TEXT NOT NULL DEFAULT '',                 -- Markdown content
    body_plain TEXT NOT NULL DEFAULT '',           -- Plaintext for FTS (stripped markdown)
    mood INTEGER CHECK (mood BETWEEN 1 AND 5),    -- 1=awful, 2=bad, 3=okay, 4=good, 5=great
    word_count INTEGER NOT NULL DEFAULT 0,
    has_audio INTEGER NOT NULL DEFAULT 0,          -- Boolean: voice recording attached
    is_pinned INTEGER NOT NULL DEFAULT 0,          -- Boolean: pinned to top
    is_archived INTEGER NOT NULL DEFAULT 0,        -- Boolean: soft archive
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX entries_date_idx ON entries(date);
CREATE INDEX entries_mood_idx ON entries(mood);
CREATE INDEX entries_pinned_idx ON entries(is_pinned) WHERE is_pinned = 1;

-- Full-text search virtual table
CREATE VIRTUAL TABLE entries_fts USING fts5(
    title,
    body_plain,
    content='entries',
    content_rowid='rowid',
    tokenize='porter unicode61'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER entries_ai AFTER INSERT ON entries BEGIN
    INSERT INTO entries_fts(rowid, title, body_plain)
    VALUES (new.rowid, new.title, new.body_plain);
END;

CREATE TRIGGER entries_ad AFTER DELETE ON entries BEGIN
    INSERT INTO entries_fts(entries_fts, rowid, title, body_plain)
    VALUES ('delete', old.rowid, old.title, old.body_plain);
END;

CREATE TRIGGER entries_au AFTER UPDATE ON entries BEGIN
    INSERT INTO entries_fts(entries_fts, rowid, title, body_plain)
    VALUES ('delete', old.rowid, old.title, old.body_plain);
    INSERT INTO entries_fts(rowid, title, body_plain)
    VALUES (new.rowid, new.title, new.body_plain);
END;

-- Tags
CREATE TABLE tags (
    id TEXT PRIMARY KEY,                          -- UUID v4
    name TEXT NOT NULL UNIQUE,
    color TEXT,                                    -- Hex color for tag pill
    usage_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX tags_name_idx ON tags(name);
CREATE INDEX tags_usage_idx ON tags(usage_count DESC);

-- Many-to-many: entries <-> tags
CREATE TABLE entry_tags (
    entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (entry_id, tag_id)
);

CREATE INDEX entry_tags_tag_idx ON entry_tags(tag_id);

-- Photo attachments
CREATE TABLE photos (
    id TEXT PRIMARY KEY,                          -- UUID v4
    entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,                        -- Local filename in app storage
    width INTEGER,
    height INTEGER,
    size_bytes INTEGER,
    position INTEGER NOT NULL DEFAULT 0,          -- Order within entry
    caption TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX photos_entry_idx ON photos(entry_id);

-- Voice recordings
CREATE TABLE recordings (
    id TEXT PRIMARY KEY,                          -- UUID v4
    entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,                        -- Local filename in app storage
    duration_seconds REAL NOT NULL,
    transcript TEXT,                               -- Whisper output
    size_bytes INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX recordings_entry_idx ON recordings(entry_id);

-- Writing prompts (seeded, read-only)
CREATE TABLE prompts (
    id INTEGER PRIMARY KEY,
    category TEXT NOT NULL,                        -- 'gratitude', 'reflection', 'goals', 'creative', 'therapy'
    text TEXT NOT NULL,
    day_of_year INTEGER                            -- Optional: assign to specific day (1-366)
);

CREATE INDEX prompts_category_idx ON prompts(category);
CREATE INDEX prompts_day_idx ON prompts(day_of_year);

-- App settings (key-value store)
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Schema version tracking
CREATE TABLE schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Privacy Architecture

```
┌─────────────────────────────────────────────────┐
│                   MyJournal App                  │
│                                                  │
│  ┌───────────────┐  ┌────────────────────────┐  │
│  │  UI Layer      │  │  Whisper.cpp Engine     │  │
│  │  (React Native │  │  (on-device, no network)│  │
│  │   / Next.js)   │  │                        │  │
│  └───────┬────────┘  └───────────┬────────────┘  │
│          │                       │               │
│  ┌───────▼───────────────────────▼────────────┐  │
│  │             Business Logic Layer            │  │
│  │  (packages/shared)                         │  │
│  │  - Entry CRUD                              │  │
│  │  - FTS5 search                             │  │
│  │  - Tag management                          │  │
│  │  - Export (MD/PDF)                         │  │
│  │  - Stats computation                       │  │
│  └───────────────────┬────────────────────────┘  │
│                      │                           │
│  ┌───────────────────▼────────────────────────┐  │
│  │          Encrypted SQLite (SQLCipher)       │  │
│  │  AES-256-CBC | PBKDF2 (256K iterations)    │  │
│  │  Key derived from user passphrase          │  │
│  │  + device-specific salt                    │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │          Local File Storage                 │  │
│  │  - Photos (JPEG/HEIC, resized)             │  │
│  │  - Voice recordings (m4a/opus)             │  │
│  │  - Whisper model (tiny.bin, ~75MB)         │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ❌ ZERO network permissions requested           │
│  ❌ No analytics SDK                             │
│  ❌ No crash reporting SDK                       │
│  ❌ No ad SDK                                    │
│  ❌ No third-party dependencies with network     │
└─────────────────────────────────────────────────┘
```

**Key privacy decisions:**
- The app manifest/Info.plist requests NO network entitlements. On iOS, this means the system will block any accidental network access.
- SQLCipher encryption uses PBKDF2 with 256,000 iterations to derive the database key from the user's passphrase. Even if someone extracts the .sqlite file, they cannot read it without the passphrase.
- Photos are stored in the app's sandboxed documents directory, not in the shared photo library. They are not accessible to other apps.
- Voice recordings are processed entirely on-device using whisper.cpp. The audio never leaves the device.
- The Whisper model file (tiny.bin, ~75MB) is bundled with the app or downloaded on first launch (the one network operation, clearly disclosed to the user during setup).

### Encryption Flow

```
User enters passphrase
        │
        ▼
PBKDF2(passphrase, device_salt, 256K iterations)
        │
        ▼
256-bit AES key
        │
        ▼
SQLCipher opens database with key
        │
        ▼
All reads/writes are transparent — SQLCipher handles encryption/decryption
        │
        ▼
On app close: key wiped from memory
On biometric unlock: key retrieved from Keychain/Keystore (encrypted by Secure Enclave)
```

---

## UI/UX Direction

### Design Philosophy
- **Calm, warm, private** — The app should feel like opening a leather journal, not a social media feed
- **Night-optimized** — Most journaling happens in the evening. The default theme uses warm amber accents on deep charcoal backgrounds to minimize blue light
- **Minimal chrome** — The editor takes center stage. Navigation is minimal. No badges, no notifications by default, no gamification pressure
- **Typography-first** — Beautiful, readable text rendering. Inter for UI, a gentle serif option (like Literata) for the writing surface

### Design Tokens (Dark Theme — Night Mode)

```typescript
const theme = {
  colors: {
    background: '#0F0D0A',          // Warm near-black
    surface: '#1A1714',             // Warm dark surface
    surfaceElevated: '#242019',     // Elevated card
    text: '#F5F0E8',               // Warm white
    textSecondary: '#A89F8F',      // Warm grey
    textTertiary: '#6B6358',       // Dim warm grey
    accent: '#D4915E',             // Warm amber — primary action color
    accentLight: '#E8B98A',        // Light amber for highlights
    accentDim: '#8B5E3C',          // Dimmed amber for subtle accents
    mood1: '#EF4444',              // Awful — red
    mood2: '#F97316',              // Bad — orange
    mood3: '#EAB308',              // Okay — yellow
    mood4: '#22C55E',              // Good — green
    mood5: '#14B8A6',              // Great — teal
    tagDefault: '#3B82F6',         // Blue tag
    editorBg: '#12100D',           // Slightly darker than background for editor focus
    border: '#2A2520',             // Subtle warm border
    danger: '#EF4444',             // Delete actions
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  borderRadius: { sm: 8, md: 12, lg: 16, xl: 24 },
  typography: {
    heading: { fontFamily: 'Inter', fontSize: 24, fontWeight: '700' },
    subheading: { fontFamily: 'Inter', fontSize: 18, fontWeight: '600' },
    body: { fontFamily: 'Inter', fontSize: 16, fontWeight: '400', lineHeight: 26 },
    editor: { fontFamily: 'Literata', fontSize: 17, fontWeight: '400', lineHeight: 28 },
    editorBold: { fontFamily: 'Literata', fontSize: 17, fontWeight: '700', lineHeight: 28 },
    caption: { fontFamily: 'Inter', fontSize: 13, fontWeight: '500' },
    label: { fontFamily: 'Inter', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
    stat: { fontFamily: 'Inter', fontSize: 36, fontWeight: '700' },
  }
};
```

### Navigation (Bottom Tabs)

| Tab | Icon | Screen |
|-----|------|--------|
| Today | Pen nib | Today's entry / quick write |
| Calendar | Grid | Browse entries by date |
| Search | Magnifying glass | Full-text search |
| Stats | Bar chart | Writing stats & mood trends |
| Settings | Gear | Preferences, export, security |

### Screen Flows

#### 1. First Launch / Onboarding
1. Welcome screen: "Your private journal." App name, tagline, warm illustration
2. Set passphrase: "Choose a passphrase to encrypt your journal. This cannot be recovered." Two input fields (enter + confirm). Password strength indicator.
3. Biometric opt-in: "Use Face ID to unlock?" Toggle. Explanation: "Your passphrase is stored securely in the Secure Enclave."
4. Whisper model: "Enable voice journaling?" If yes: "Downloading speech model (75MB). This is the only network request MyJournal will ever make." Progress bar.
5. Done: "Start journaling." Arrow to editor.

#### 2. Today Screen (Home)
- **Top bar:** Date (e.g., "Saturday, February 22"), streak badge (flame icon + number)
- **Prompt card** (collapsible): Daily writing prompt in italic. "What made you smile today?" Tap to dismiss or use as starting point.
- **Editor area:** If no entry exists for today, shows empty editor with blinking cursor. If entry exists, shows the entry in view mode with an edit button.
- **Mood picker:** Row of 5 emoji faces below the editor. Tap to set mood. Already-set mood is highlighted.
- **Quick actions:** Microphone button (voice record), camera button (photo), tag button (add tags)
- **Bottom:** Word count for today's entry

#### 3. Calendar Screen
- **Month grid:** Days with entries have a warm amber dot. Days with no entry are dim. Today is circled.
- **Navigation:** Swipe left/right to change months. Year label at top.
- **Day detail:** Tap a day to see entry preview (first 2 lines + mood + tags). Tap preview to open full entry.
- **Entry list mode:** Toggle from grid to chronological list (useful for months with many entries)

#### 4. Entry Editor
- **Top bar:** Back arrow, date, more menu (delete, archive, pin, export)
- **Title field:** Optional, placeholder "Title (optional)"
- **Body:** Full markdown editor. Toolbar at bottom: **B** *I* ~~S~~ H1 H2 List Quote Code Image Mic
- **Mood row:** 5-face picker, persistent above keyboard
- **Tag bar:** Horizontal scroll of tag pills. "+" button to add new tag. Autocomplete from existing tags.
- **Photo strip:** Horizontal scroll of attached photos below the editor. Tap to view full-screen. Long-press to reorder or delete.
- **Auto-save:** Entries save automatically every 3 seconds after a pause in typing. No explicit save button.

#### 5. Search Screen
- **Search bar:** Full-text search input with filter chips: All | Tags | Date Range | Mood
- **Results:** List of matching entries with highlighted search terms in context. Shows date, mood, first match snippet, tag pills.
- **Tag browser:** Below search, grid of all tags sorted by usage count. Tap a tag to filter.

#### 6. Stats Screen
- **Header:** Total entries, total words, current streak, longest streak
- **Mood chart:** Line chart showing daily mood over the past 30 days (with 7-day moving average)
- **Writing frequency:** Heatmap calendar (GitHub contribution-style) showing days with entries over the past year
- **Top tags:** Horizontal bar chart of most-used tags
- **Monthly summary card:** "In February, you wrote 18 entries totaling 4,230 words. Average mood: 3.8/5."

#### 7. Settings Screen
- **Security:** Change passphrase, toggle biometric unlock, auto-lock timeout (immediately, 1 min, 5 min, 15 min)
- **Appearance:** Theme (Night / Dark / Light), font size, editor font (Inter / Literata / System)
- **Prompts:** Enable/disable daily prompts, select prompt categories
- **Voice:** Enable/disable voice journaling, Whisper model size (tiny/base), keep audio recordings toggle
- **Export:** Export all entries (Markdown zip / PDF), export date range, export single entry
- **Data:** Database size, photo storage size, total entries, "Erase all data" (danger zone with double confirmation)
- **About:** Version, license (FSL), source code link, privacy statement

---

## Monetization

### Pricing Model
- **$4.99 one-time purchase** — Full app, all features, forever
- No free tier, no trial, no subscriptions, no ads, no IAP upsells
- The App Store listing price IS the price. What you see is what you pay.

### Revenue Projections (Conservative)

| Metric | Month 1 | Month 6 | Year 1 | Year 2 |
|--------|---------|---------|--------|--------|
| Downloads | 2,000 | 5,000/mo | 40,000 | 100,000 |
| Revenue (gross) | $9,980 | $24,950/mo | $199,600 | $499,000 |
| Apple/Google cut (30%→15%) | $2,994 | $7,485/mo | $49,900 | $74,850 |
| Net revenue | $6,986 | $17,465/mo | $149,700 | $424,150 |

### Why One-Time Works
- Zero server costs (no cloud, no sync)
- Zero ongoing data costs (no AI, no API calls beyond optional Whisper download)
- The marginal cost of each additional user is effectively $0
- One-time pricing creates word-of-mouth: "I paid $5 and I'm done forever" is a shareable statement
- Competitor fatigue: Day One's $35/yr renewal creates a yearly decision point where users reconsider alternatives

### Mac App Store + Direct Sales
- Mac version sold separately at $9.99 (Mac App Store) or $4.99 (Lemon Squeezy direct)
- Lemon Squeezy avoids Apple's 30% cut for direct sales
- RevenueCat handles IAP receipt validation on iOS/Android

---

## Marketing Angle

### Tagline
**"Your diary. Not their data."**

### Positioning Statement
MyJournal is for people who want a beautiful journaling app without trusting a corporation with their most private thoughts. One-time purchase. No accounts. No cloud. Your journal lives on your device and nowhere else.

### Launch Channels

| Channel | Approach | Expected Impact |
|---------|----------|----------------|
| **r/journaling** (400K+) | "I built a journaling app that never connects to the internet" — founder story post | High — privacy resonates here |
| **r/Anxiety, r/therapy** (500K+ combined) | "My therapist told me to journal. I didn't trust Day One with my therapy homework." | High — emotional pain point |
| **r/privacy** (1.8M) | Technical deep-dive: "How MyJournal achieves zero network access" with architecture diagram | Medium — tech-savvy privacy advocates |
| **r/degoogle** (300K+) | "Private journaling without Google Drive dependency" | Medium — Journey alternative seekers |
| **Product Hunt** | "Your thoughts never leave your device. Period." — launch day feature | High — one-time pricing is PH catnip |
| **Hacker News** | "Show HN: I built a source-available journaling app with zero network permissions" | High — technical credibility |
| **Privacy-focused blogs** | PrivacyGuides, The Markup, EFF newsletter outreach | Medium — endorsement from trusted sources |
| **Therapy influencers** | TikTok/Instagram therapists who recommend journaling as homework | High — warm audience, genuine use case |

### Content Marketing
- Blog post: "Why your journal shouldn't have a Terms of Service"
- Blog post: "How SQLCipher encryption works (and why it matters for your journal)"
- Blog post: "Day One vs MyJournal: a privacy comparison"
- Video: 60-second demo of voice-to-journal workflow

### PR Angle
- "In a world of subscription apps, MyJournal charges once and never again"
- Pitch to The Verge, TechCrunch, Ars Technica privacy beat reporters
- Position against Day One's Automattic acquisition narrative

---

## MVP Timeline (Week-by-Week)

### Week 1: Foundation
- [ ] Initialize Turborepo monorepo with pnpm
- [ ] Set up Expo app with file-based routing (Expo Router)
- [ ] Set up Next.js 15 web app with App Router
- [ ] Configure shared TypeScript config, ESLint, Prettier
- [ ] Implement SQLite schema with SQLCipher encryption (mobile)
- [ ] Build passphrase setup + biometric unlock flow
- [ ] Write migration system (versioned schema changes)

### Week 2: Core Editor
- [ ] Build markdown editor component (mobile + web)
- [ ] Implement entry CRUD operations in shared package
- [ ] Build Today screen with editor
- [ ] Implement auto-save (3-second debounce)
- [ ] Add mood picker component
- [ ] Add tag input with autocomplete
- [ ] Implement title extraction (first heading or first line)

### Week 3: Navigation & Search
- [ ] Build calendar screen with month grid
- [ ] Implement date-based entry navigation
- [ ] Set up FTS5 virtual table and sync triggers
- [ ] Build search screen with highlighted results
- [ ] Implement tag filtering and browsing
- [ ] Add entry pinning and archiving

### Week 4: Media & Voice
- [ ] Build photo attachment system (camera + library picker)
- [ ] Implement local photo storage with thumbnail generation
- [ ] Integrate whisper.cpp (mobile: native module, web: WASM)
- [ ] Build voice recording UI (waveform, timer, stop/start)
- [ ] Implement transcription review flow (edit before save)
- [ ] Add audio playback in entry view

### Week 5: Stats & Export
- [ ] Build stats screen (totals, streak, mood chart, writing heatmap)
- [ ] Implement export to Markdown (single entry + full journal ZIP)
- [ ] Implement export to PDF (formatted with photos)
- [ ] Build writing prompts system (365+ curated prompts)
- [ ] Add streak tracking logic
- [ ] Build settings screen

### Week 6: Polish & Launch
- [ ] Night mode theme refinement (warm amber accents)
- [ ] Onboarding flow (passphrase setup, biometric, Whisper download)
- [ ] App icon and splash screen design
- [ ] App Store screenshots and description
- [ ] Privacy policy page (one paragraph: "We collect nothing.")
- [ ] Beta testing (TestFlight + internal)
- [ ] Submit to App Store and Google Play
- [ ] Prepare Product Hunt and Reddit launch posts

---

## Acceptance Criteria

### Must pass before launch:
1. **Privacy audit:** App requests zero network entitlements. Verified via iOS privacy report and Android network inspector. No DNS queries after Whisper model download.
2. **Encryption verification:** Database file is unreadable without passphrase. Verified by attempting to open with standard SQLite tools (must fail).
3. **CRUD completeness:** Create, read, update, delete entries. All operations persist across app restart.
4. **Search accuracy:** FTS5 search returns relevant results for partial words, exact phrases, and tag filters.
5. **Photo persistence:** Photos attached to entries survive app restart and are displayed correctly.
6. **Voice transcription:** whisper.cpp successfully transcribes 30-second voice memos in <5 seconds on iPhone 13+.
7. **Export fidelity:** Exported Markdown files are valid Markdown. Exported PDFs render with photos and formatting.
8. **Biometric unlock:** Face ID / Touch ID correctly unlocks the app. Passphrase fallback works.
9. **Performance:** App launches in <1 second. Entry list scrolls at 60fps with 1,000+ entries.
10. **Cross-platform parity:** Core features work identically on iOS, Android, and web.

### Quality gates:
- Zero crashes in 24-hour soak test
- Accessibility: VoiceOver/TalkBack can navigate all screens
- Dark mode: no white flashes on any screen transition
- Supports iOS 16+, Android 10+, Chrome/Safari/Firefox (latest 2 versions)
