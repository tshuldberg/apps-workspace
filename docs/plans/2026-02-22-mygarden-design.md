# MyGarden — Design Document

**Date:** 2026-02-22
**Status:** Draft
**Author:** MyApps Product Team

---

## 1. Overview

**MyGarden** — Your garden diary. No ads, no trackers, no cloud.

A privacy-first plant care and garden planner for iOS, Android, Mac, and web. Track your plants, set watering reminders, identify species with on-device ML, and keep a garden journal — all without a single byte leaving your device. Part of the My* app family.

### Primary Differentiator

> "Plant apps use 16 ad trackers. MyGarden uses zero."

Planta, Greg, and PictureThis monetize through subscriptions *and* harvest user data — location, photos, browsing habits, and device identifiers. PictureThis alone embeds 16 third-party SDKs including Meta Pixel, Adjust, Firebase Analytics, and AppsFlyer. MyGarden stores everything locally in SQLite. No accounts, no telemetry, no cloud dependency. One-time purchase, yours forever.

---

## 2. Problem Statement

Plant care apps have become subscription-extraction machines wrapped around basic reminder functionality. Users pay $30-36/year for features that could run entirely on-device:

1. **Privacy abuse** — Photo-based plant identification sends images to remote servers. Plant parent communities on Reddit regularly flag these apps for excessive data collection and dark-pattern upsells.
2. **Subscription fatigue** — Watering reminders and care instructions don't require ongoing server costs, yet every competitor charges annually.
3. **Cloud dependency** — When servers go down or companies shut down, users lose their plant history. There's no data portability.
4. **Feature bloat** — Social feeds, gamification, and e-commerce clutter the core experience. Users want a simple tool, not a social network for plants.

MyGarden solves all four problems by keeping data local, charging once, running ML on-device, and focusing exclusively on plant care utility.

---

## 3. Target User Persona

### Primary: "The Casual Plant Parent"

- **Age:** 25-45
- **Archetype:** Has 5-25 houseplants. Uses phone reminders or sticky notes to track watering. Has killed plants from neglect or overwatering. Browses r/houseplants and r/gardening casually.
- **Pain:** Tried Planta or Greg, got annoyed by subscription paywalls and notification spam. Doesn't want another app tracking their location.
- **Motivation:** Wants a simple, beautiful tool to remember when to water and track plant health over time.
- **Willingness to pay:** $5-10 one-time, absolutely not another subscription.

### Secondary: "The Serious Gardener"

- **Age:** 35-65
- **Archetype:** Maintains an outdoor garden (vegetables, herbs, flowers). Tracks seasonal planting schedules. Keeps a paper garden journal or spreadsheet.
- **Pain:** No good digital garden journal exists that doesn't require an account and internet connection.
- **Motivation:** Wants to log planting dates, harvest yields, and seasonal observations in a structured format.

---

## 4. Competitive Landscape

| App | Price | Est. Users | Est. Revenue | Privacy Stance | Key Weakness |
|-----|-------|-----------|-------------|----------------|--------------|
| **Planta** | $36/yr ($7/mo) | 5M+ downloads | ~$50M ARR | 16 trackers, sends photos to cloud, location tracking | Aggressive upsells, basic features paywalled |
| **Greg** | $30/yr ($8/mo) | 2M+ downloads | ~$15M ARR | Cloud-dependent, analytics SDKs | Gamification over utility, social features nobody asked for |
| **PictureThis** | $30/yr ($5/mo) | 100M+ downloads | ~$100M ARR | **Privacy nightmare** — 16 ad SDKs, sells data to brokers, excessive permissions | FTC complaint-worthy data practices, subscription dark patterns |
| **Planter** | $5 one-time | 500K+ downloads | ~$2M total | Minimal tracking | Garden-only (no houseplants), no plant ID |
| **Flower Care (Xiaomi)** | Free + hardware | 1M+ devices | Hardware sales | Sends sensor data to Xiaomi cloud | Requires proprietary hardware sensors |
| **MyGarden** | **$4.99 one-time** | — | — | **Zero trackers. Zero cloud. Zero accounts.** | New entrant, smaller care database than Planta |

### Opportunity

The plant care app market is estimated at $500M+ annually and growing 20% YoY, driven by the houseplant boom among millennials and Gen Z. Every major player uses the subscription model. A one-time-purchase, privacy-first alternative has no direct competitor.

---

## 5. Key Features (MVP)

### P0 — Must Have (Launch)

- [ ] **Plant Profiles** — Name, species, photo (from camera or library), location (room/zone), acquisition date
- [ ] **Watering Schedule & Reminders** — Per-plant watering frequency with local push notifications
- [ ] **Care Instructions Database** — 500+ pre-loaded species with light, water, soil, temperature, humidity, and toxicity info
- [ ] **Plant Health Log** — Timestamped entries per plant: watered, fertilized, repotted, pruned, pest treatment, photo update
- [ ] **On-Device Plant Identification** — Camera photo analyzed by Core ML (iOS) / TensorFlow Lite (Android) model. Photo never leaves device.
- [ ] **Garden Journal** — Free-form daily/weekly entries with optional photos. Markdown-like formatting.
- [ ] **Dashboard** — Today's tasks (what needs watering), upcoming schedule, plant health overview
- [ ] **Dark mode** — Default, matching My* brand (warm amber/coral/teal on dark background)

### P1 — Should Have (v1.1)

- [ ] Sunlight tracker — Log which rooms get direct/indirect/low light
- [ ] Seasonal planting calendar (outdoor gardens)
- [ ] Batch watering — Water all plants in a room/zone at once
- [ ] Widget — iOS/Android home screen widget showing today's watering tasks
- [ ] Quick capture — Long-press app icon to log a watering or take a plant photo

### P2 — Nice to Have (v2.0)

- [ ] Export data as JSON/CSV
- [ ] iCloud Drive backup (encrypted SQLite file, user-initiated only)
- [ ] Garden map — Drag-and-drop visual layout of garden beds
- [ ] Pest/disease identification (on-device ML model)
- [ ] Harvest tracking for vegetable gardens

---

## 6. Technical Architecture

### Stack

- **Frontend (Mobile):** Expo (React Native) — iOS + Android from single codebase
- **Frontend (Web):** Next.js 15
- **Database:** SQLite via expo-sqlite (mobile) / better-sqlite3 (web/Mac)
- **ML (iOS):** Core ML with plant identification model (~50MB, bundled or downloaded on first use)
- **ML (Android):** TensorFlow Lite with same model architecture
- **Monorepo:** Turborepo
- **Package Manager:** pnpm
- **Language:** TypeScript everywhere
- **Notifications:** expo-notifications (local only, no push server)
- **Payments:** RevenueCat (App Store IAP) + Lemon Squeezy (direct sales)
- **License:** FSL → Apache 2.0 after 2 years

### Monorepo Structure

```
MyGarden/
├── apps/
│   ├── mobile/                # Expo (React Native) — iOS + Android
│   │   ├── app/               # Expo Router file-based routing
│   │   ├── components/        # Mobile-specific components
│   │   ├── hooks/             # Mobile-specific hooks
│   │   ├── assets/            # Icons, images, fonts, ML model
│   │   └── plugins/           # Expo config plugins (notifications, camera)
│   ├── web/                   # Next.js 15 — Web + Mac (Electron or PWA)
│   │   ├── app/               # App Router
│   │   ├── components/        # Web-specific components
│   │   └── public/            # Static assets
│   └── mac/                   # Mac App Store target (if needed beyond web PWA)
├── packages/
│   ├── shared/                # Types, utils, business logic
│   │   ├── src/
│   │   │   ├── types/         # Plant, CareLog, Species, Garden types
│   │   │   ├── models/        # Watering scheduler, reminder engine
│   │   │   ├── utils/         # Date helpers, photo utils
│   │   │   ├── constants/     # Species database, care defaults
│   │   │   └── db/            # SQLite schema, migrations, queries
│   │   └── package.json
│   ├── ui/                    # Shared component library
│   │   ├── src/
│   │   │   ├── cards/         # PlantCard, TaskCard, JournalEntryCard
│   │   │   ├── forms/         # PlantForm, CareLogForm, JournalForm
│   │   │   ├── charts/        # WateringCalendar, HealthTimeline
│   │   │   └── layout/        # TabBar, Header, Modal, EmptyState
│   │   └── package.json
│   ├── plant-db/              # Plant care database (500+ species)
│   │   ├── src/
│   │   │   ├── species/       # JSON species definitions
│   │   │   ├── search.ts      # Fuzzy search over species
│   │   │   └── index.ts       # Typed exports
│   │   └── package.json
│   └── ml/                    # Plant identification wrapper
│       ├── src/
│       │   ├── ios.ts         # Core ML bridge
│       │   ├── android.ts     # TFLite bridge
│       │   └── types.ts       # Prediction types
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
-- Plants owned by the user
CREATE TABLE plants (
    id TEXT PRIMARY KEY,                          -- UUID
    name TEXT NOT NULL,                            -- User-given name ("Mr. Fern")
    species_id TEXT,                               -- FK to species database
    species_name TEXT,                             -- Cached species display name
    photo_uri TEXT,                                -- Local file path to photo
    location TEXT,                                 -- Room or garden zone
    acquired_date TEXT,                            -- ISO date
    notes TEXT,                                    -- Free-form notes
    watering_frequency_days INTEGER DEFAULT 7,     -- Days between waterings
    last_watered TEXT,                             -- ISO datetime
    next_watering TEXT,                            -- ISO datetime (computed)
    sunlight_level TEXT DEFAULT 'indirect',        -- 'direct', 'indirect', 'low', 'shade'
    is_outdoor INTEGER DEFAULT 0,                  -- Boolean
    is_archived INTEGER DEFAULT 0,                 -- Soft delete
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_plants_next_watering ON plants(next_watering);
CREATE INDEX idx_plants_location ON plants(location);

-- Care activity log per plant
CREATE TABLE care_logs (
    id TEXT PRIMARY KEY,                           -- UUID
    plant_id TEXT NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    activity TEXT NOT NULL,                         -- 'watered', 'fertilized', 'repotted', 'pruned', 'pest_treatment', 'photo', 'note'
    notes TEXT,
    photo_uri TEXT,                                 -- Optional photo for this log entry
    logged_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_care_logs_plant ON care_logs(plant_id, logged_at DESC);

-- Garden journal entries (free-form)
CREATE TABLE journal_entries (
    id TEXT PRIMARY KEY,                           -- UUID
    title TEXT,
    body TEXT NOT NULL,                             -- Markdown-formatted text
    photo_uris TEXT,                                -- JSON array of local file paths
    weather TEXT,                                   -- Optional weather note
    tags TEXT,                                      -- JSON array of tags
    entry_date TEXT NOT NULL,                       -- ISO date
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_journal_date ON journal_entries(entry_date DESC);

-- Reminder schedule (local notifications)
CREATE TABLE reminders (
    id TEXT PRIMARY KEY,                           -- UUID
    plant_id TEXT NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    reminder_type TEXT NOT NULL DEFAULT 'watering', -- 'watering', 'fertilizing', 'repotting', 'custom'
    frequency_days INTEGER NOT NULL,
    next_fire TEXT NOT NULL,                        -- ISO datetime
    notification_id TEXT,                           -- OS notification identifier
    is_enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_reminders_next ON reminders(next_fire) WHERE is_enabled = 1;

-- Plant identification history
CREATE TABLE identifications (
    id TEXT PRIMARY KEY,                           -- UUID
    photo_uri TEXT NOT NULL,
    top_result TEXT NOT NULL,                       -- Species name
    confidence REAL NOT NULL,                       -- 0.0-1.0
    alternatives TEXT,                              -- JSON array of {species, confidence}
    identified_at TEXT DEFAULT (datetime('now')),
    accepted_species_id TEXT                        -- If user confirmed, link to species DB
);

-- User preferences (key-value store)
CREATE TABLE preferences (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

### Privacy Architecture

- **Zero network calls** — The app makes no HTTP requests. All data is in local SQLite. The plant care database is bundled with the app. The ML model is bundled or downloaded once from Apple/Google CDN (not our servers).
- **No accounts** — No sign-up, no login, no user IDs. The app works immediately on first launch.
- **No telemetry** — No analytics SDKs, no crash reporting services, no event tracking. If we add opt-in crash reporting later, it will be a separate explicit toggle.
- **Photos stay local** — Plant identification runs on-device via Core ML / TFLite. Photos are stored as local files referenced by URI in SQLite. Never uploaded anywhere.
- **Export is user-initiated** — Users can export their data as JSON/CSV. iCloud backup (future) copies the encrypted SQLite file via standard file sync — not a proprietary protocol.
- **Permissions are minimal** — Camera (for plant photos/ID), Notifications (for reminders). No location, no contacts, no microphone, no health data.

### On-Device Plant Identification

The ML pipeline uses a classification model trained on PlantCLEF / iNaturalist open datasets:

1. User takes photo or selects from library
2. Image is preprocessed (resized to 224x224, normalized)
3. Core ML (iOS) or TFLite (Android) runs inference locally
4. Top-5 predictions returned with confidence scores
5. User confirms or corrects the species
6. Accepted species links to the care database

**Model details:**
- Architecture: MobileNetV3 fine-tuned on 2,000+ species
- Size: ~40MB (quantized INT8)
- Inference time: <500ms on iPhone 12+, <800ms on mid-range Android
- Accuracy: ~85% top-1, ~95% top-5 on common houseplants
- Bundled with app (no download required)

---

## 7. UI/UX Direction

### Design Language

- **Theme:** Dark mode default (matching My* brand)
- **Palette:** Dark background (#0D0D0D), warm surface (#1A1A1A), amber accents (#F59E0B) for watering, green (#22C55E) for healthy, coral (#F97316) for attention-needed, teal (#14B8A6) for secondary actions
- **Typography:** Inter (humanist sans-serif), same weight scale as other My* apps
- **Iconography:** Outlined icons, organic/botanical feel. No shield icons (brand rule).
- **Photography:** Plant photos are the hero content. Full-bleed photos on plant detail cards.
- **Animations:** Subtle — watering drop animation on task completion, gentle fade transitions.

### Navigation (Bottom Tabs)

| Tab | Label | Screen |
|-----|-------|--------|
| Home | Today | Dashboard with today's tasks and plant overview |
| Plants | Plants | Grid/list of all plants with search and filter |
| Identify | ID | Camera viewfinder for plant identification |
| Journal | Journal | Chronological garden journal entries |
| Settings | Settings | Preferences, export, about |

### Screen Flows

#### 7.1 Today Screen (Home)

- **Header:** "Good morning" greeting with date
- **Watering Tasks:** Card list of plants due today, swipeable to mark as watered
- **Upcoming:** Next 3 days of scheduled tasks (collapsible)
- **Plant Health Summary:** Count of healthy / needs-attention / overdue plants
- **Quick Actions:** "Add Plant" and "Journal Entry" floating buttons

#### 7.2 Plants Screen

- **View Toggle:** Grid (photo thumbnails) / List (compact rows)
- **Search Bar:** Fuzzy search by plant name or species
- **Filter:** By location, sunlight level, watering status
- **Sort:** By name, next watering, date added
- **Plant Card (Grid):** Photo, name, species, watering status indicator (green dot = ok, amber = due soon, red = overdue)
- **Empty State:** Illustration + "Add your first plant" CTA

#### 7.3 Plant Detail Screen

- **Hero:** Full-width plant photo with name overlay
- **Quick Actions:** Water, Fertilize, Log Note, Take Photo
- **Info Section:** Species, location, acquired date, sunlight, watering frequency
- **Care Guide:** Pulled from species database — light, water, soil, temperature, humidity, toxicity (pets)
- **Activity Timeline:** Scrollable care log entries (most recent first) with icons per activity type
- **Edit Button:** Modify plant details
- **Archive Button:** Soft-delete (moves to archived plants)

#### 7.4 Identify Screen

- **Camera Viewfinder:** Full-screen camera with capture button
- **Gallery Button:** Select from photo library
- **Results Screen:** Top-5 species matches with confidence percentages and thumbnail photos from the species database
- **Confirm Action:** "This is my plant" → creates a new plant profile pre-filled with species data
- **Not Listed:** "None of these" → manual species search

#### 7.5 Journal Screen

- **Entry List:** Reverse-chronological cards with date, title preview, thumbnail
- **New Entry:** Title (optional), body (markdown), attach photos, add tags, weather note
- **Entry Detail:** Full entry with photos, tags, linked plants
- **Search:** Full-text search across journal entries

#### 7.6 Settings Screen

- **Notification Preferences:** Default reminder time, snooze duration
- **Display:** Theme (dark/light/system), temperature units (F/C)
- **Data:** Export (JSON/CSV), backup info
- **About:** Version, licenses, privacy policy, My* family links
- **Source Code:** Link to GitHub repository

---

## 8. Monetization

### Pricing Model

- **Price:** $4.99 one-time (USD)
- **No subscription.** No recurring revenue extraction.
- **No ads.** No ad SDKs, no sponsored content, no affiliate links.
- **No in-app purchases beyond the initial unlock.** (Unless we add a "tip jar" later.)

### Revenue Channels

| Channel | Platform | Provider | Cut |
|---------|----------|----------|-----|
| iOS App Store | iPhone, iPad, Mac (Catalyst) | Apple IAP via RevenueCat | 70/30 (year 1), 85/15 (year 2+) |
| Google Play Store | Android | Google IAP via RevenueCat | 70/30 (year 1), 85/15 (year 2+) |
| Mac App Store | macOS native | Apple IAP via RevenueCat | 70/30 |
| Direct sales | Web, GitHub | Lemon Squeezy | 95/5 |

### Revenue Projections (Conservative)

| Scenario | Downloads/mo | Conversion | Revenue/mo |
|----------|-------------|-----------|-----------|
| Baseline (Month 1-3) | 5,000 | 5% | $1,250 |
| Growing (Month 4-8) | 15,000 | 8% | $5,990 |
| Established (Month 9-12) | 30,000 | 10% | $14,970 |

### Why One-Time Works

- **Zero server costs** — No cloud infrastructure to maintain
- **No ongoing data costs** — Plant database is bundled, ML model is bundled
- **Low support burden** — Local-first means fewer failure modes
- **Long tail** — App Store discovery compounds over years. Planter ($5 one-time) has generated $2M+ from steady organic downloads.

---

## 9. Marketing Angle

### Positioning

**Tagline:** "Your garden diary. No ads, no trackers, no cloud."

**Elevator pitch:** MyGarden is a plant care app that respects your privacy. Track your plants, set watering reminders, identify species with your camera — all on-device, no account required. $4.99 once, yours forever.

### Launch Strategy

1. **Reddit (organic):** Post in r/houseplants (2.3M), r/gardening (6.1M), r/IndoorGarden (800K), r/plantclinic (500K). Lead with the privacy angle: "I built a plant app because Planta has 16 trackers."
2. **Privacy communities:** r/privacy (2M), r/degoogle (300K), r/PrivacyGuides. Cross-promote with other My* apps.
3. **Plant parent influencers:** Partner with 5-10 micro-influencers (10K-100K followers) on Instagram/TikTok who care about sustainability and ethical tech.
4. **Product Hunt launch:** Time for spring planting season (March-April).
5. **Content marketing:** Blog posts comparing tracker counts across plant apps. "We ran Planta through a traffic analyzer — here's what it sends home."

### Key Messages

- "Your plants. Your data. Your device."
- "$4.99 once. Not $36/year."
- "Identifies plants with your camera — and the photo never leaves your phone."
- "500+ plant care guides, zero internet required."

---

## 10. MVP Timeline (Week-by-Week)

### Phase 1: Foundation (Weeks 1-2)

- [ ] Monorepo scaffold (Turborepo + pnpm + Expo + Next.js)
- [ ] SQLite schema implementation with migrations
- [ ] Core types and shared business logic package
- [ ] Design tokens and UI component library foundation
- [ ] Bottom tab navigation shell

### Phase 2: Core Plant Management (Weeks 3-4)

- [ ] Plant profile CRUD (create, read, update, archive)
- [ ] Plant photo capture and storage (local filesystem)
- [ ] Species database package (500+ species JSON files)
- [ ] Species search (fuzzy matching)
- [ ] Plant detail screen with care guide from species DB
- [ ] Plants grid/list view with search and filter

### Phase 3: Watering & Reminders (Weeks 5-6)

- [ ] Watering scheduler engine (shared package)
- [ ] Local push notifications via expo-notifications
- [ ] Reminder CRUD per plant
- [ ] Today screen with due/upcoming tasks
- [ ] Swipe-to-complete watering task
- [ ] Care activity logging (water, fertilize, repot, prune, pest)
- [ ] Activity timeline on plant detail

### Phase 4: Plant Identification (Weeks 7-8)

- [ ] ML model integration (Core ML iOS, TFLite Android)
- [ ] Camera capture screen with viewfinder
- [ ] Photo library picker
- [ ] Inference pipeline (preprocess → predict → top-5 results)
- [ ] Results screen with confidence scores
- [ ] Confirm → create plant profile flow

### Phase 5: Journal & Polish (Weeks 9-10)

- [ ] Garden journal CRUD
- [ ] Full-text search across plants and journal
- [ ] Settings screen (notifications, display, export)
- [ ] JSON/CSV export
- [ ] Empty states, onboarding flow
- [ ] App icon, splash screen, store screenshots
- [ ] Performance optimization and testing

### Phase 6: Launch Prep (Weeks 11-12)

- [ ] App Store / Play Store listing preparation
- [ ] RevenueCat integration (one-time IAP)
- [ ] Lemon Squeezy integration (direct sales)
- [ ] Privacy policy and terms
- [ ] Beta testing (TestFlight + Google Play internal)
- [ ] Web app deployment (Next.js on Vercel)
- [ ] Marketing materials and launch posts

---

## 11. Acceptance Criteria

The MVP is complete when:

1. **Plant Management** — User can create a plant profile with name, species (from database or custom), photo, location, and watering frequency. User can view, edit, and archive plants.
2. **Watering Reminders** — App sends local push notifications when a plant is due for watering. User can mark a plant as watered, which reschedules the next reminder.
3. **Care Database** — 500+ species are searchable and display complete care instructions (light, water, soil, temp, humidity, toxicity).
4. **Plant Identification** — User can photograph a plant and receive top-5 species matches via on-device ML. Confirming a match creates a pre-filled plant profile.
5. **Garden Journal** — User can create, edit, and search journal entries with text and photos.
6. **Today View** — Dashboard shows plants due for watering today and upcoming tasks.
7. **Privacy** — Zero network requests during normal operation. No analytics SDKs. No account creation. App works fully offline after install.
8. **Cross-Platform** — Runs on iOS, Android, and web. Mac via App Store (Catalyst or PWA).
9. **Payment** — One-time purchase of $4.99 via App Store IAP and direct sales.
10. **Performance** — App launches in <2s. Plant list scrolls at 60fps with 100+ plants. ML inference completes in <1s.

---

## 12. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| ML model accuracy below 80% on diverse plant photos | Users won't trust plant ID feature | Start with houseplants-only model (higher accuracy on smaller domain). Allow manual correction. Improve model in updates. |
| App Store rejects due to "limited functionality" | Launch delayed | Ensure journal + identification + reminders provide clear distinct value. Include care database as content-rich feature. |
| Species database coverage gaps | Users can't find their plants | Allow custom species entry. Crowdsource missing species via GitHub issues on the open-source repo. |
| Expo camera/notification limitations | Core features broken on some devices | Test on 10+ device models. Have fallback UX for denied permissions. |
| Low conversion at $4.99 | Revenue below sustainability | Consider freemium with 5-plant limit for free tier if conversion is low. |

---

## 13. Design Tokens (Dark Theme)

```typescript
const theme = {
  colors: {
    background: '#0D0D0D',
    surface: '#1A1A1A',
    surfaceElevated: '#242424',
    text: '#FFFFFF',
    textSecondary: '#999999',
    textTertiary: '#666666',
    accent: '#F59E0B',              // Amber — primary action color
    accentSecondary: '#14B8A6',     // Teal — secondary actions
    healthy: '#22C55E',             // Green — plant is healthy
    attention: '#F97316',           // Coral/Orange — needs attention
    overdue: '#EF4444',             // Red — overdue care
    water: '#3B82F6',               // Blue — watering actions
    tabActive: '#FFFFFF',
    tabInactive: '#666666',
    border: '#2A2A2A',
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  borderRadius: { sm: 8, md: 12, lg: 16, xl: 24 },
  typography: {
    greeting: { fontSize: 24, fontWeight: '700', fontFamily: 'Inter' },
    plantName: { fontSize: 18, fontWeight: '600' },
    speciesName: { fontSize: 14, fontWeight: '400', color: '#999999' },
    sectionHeader: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
    caption: { fontSize: 12, fontWeight: '400', color: '#666666' },
    metric: { fontSize: 32, fontWeight: '700' },
    button: { fontSize: 16, fontWeight: '600' },
  }
}
```
