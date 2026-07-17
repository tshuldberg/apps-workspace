# MyCycle — Design Document

**Date:** 2026-02-22
**Status:** Draft
**Author:** MyApps Product Team

---

## Overview

**MyCycle** is a privacy-first period and fertility tracker that keeps all menstrual health data exclusively on the user's device. In a post-Dobbs landscape where period tracking data has been subpoenaed, sold to data brokers, and shared with law enforcement, MyCycle offers a simple promise: your cycle data physically cannot be accessed by anyone but you. It runs a local moving-average prediction algorithm — no cloud ML, no accounts, no telemetry.

---

## Problem Statement

The period tracking market is broken in three specific ways:

1. **Privacy is a safety issue, not a preference.** After the Dobbs decision overturned Roe v. Wade (June 2022), period tracking data became legal evidence. Flo Health settled with the FTC in 2021 for sharing health data with Facebook and Google. In 2023, a Nebraska mother's Facebook messages about her daughter's menstrual cycle were used as evidence in a criminal abortion case. Users are deleting period trackers out of fear — not because they don't want the functionality, but because no app has earned their trust.

2. **Subscription fatigue for basic health tracking.** Flo charges $49.99/year. Clue charges $64.99/year. Natural Cycles charges $69.99/year plus a $14.99 thermometer. These apps track a biological cycle that women have tracked on paper calendars for centuries. The core functionality — logging periods and predicting the next one — does not justify recurring revenue extraction.

3. **Feature bloat obscures core utility.** Modern period trackers have become "women's health platforms" stuffed with AI chatbots, community forums, fertility consultations, pregnancy modes, and wellness content. A user who just wants to know when her next period starts must navigate past upsells, onboarding quizzes, and content feeds. The simple calendar view is buried.

---

## Target User Persona

**Primary: Sarah, 28, Privacy-Conscious Professional**

- Works in tech or healthcare; understands data privacy conceptually
- Currently uses Apple Health or a notes app to track her period because she deleted Flo after the Meta data-sharing scandal
- Wants period predictions back but refuses to use an app that requires an account or internet connection
- Checks her cycle 2-3 times per month: when logging a period start/end, and when checking the prediction for upcoming events
- Not trying to conceive (MVP focus); wants basic symptom logging (cramps, mood, flow) without medical complexity
- Willing to pay a one-time fee for an app that respects her; refuses subscriptions for basic tracking
- Age range: 18-45
- Technical level: Moderate — comfortable installing apps, uncomfortable with fine-grained privacy settings
- Platforms: Primarily iOS, secondarily Android

**Secondary: College students, reproductive rights advocates, users in restrictive-law states**

---

## Competitive Landscape

| Competitor | Price | Est. Users | Est. Revenue | Privacy Stance | Key Weakness |
|---|---|---|---|---|---|
| **Flo** | $49.99/yr | 380M downloads, ~50M MAU | ~$200M ARR | Settled FTC complaint for sharing data with FB/Google. "Anonymous mode" added post-Dobbs but still collects server-side data | Data stored on servers. Trust destroyed by FTC settlement. Subscription price for basic tracking |
| **Clue** | $64.99/yr | 12M+ MAU | ~$30M ARR | Berlin-based, GDPR-compliant, better than US competitors. But still cloud-synced with account required | Requires email account. Data stored on EU servers. Premium price for features most users don't need |
| **Natural Cycles** | $69.99/yr + $14.99 thermometer | ~3M users | ~$50M ARR | FDA-cleared contraceptive. Cloud-based ML model requires data upload | Expensive hardware requirement. Cloud-dependent algorithm. Not just a tracker — medical device positioning limits market |
| **Apple Health** | Free (built-in) | ~100M+ (iOS only) | N/A (bundled) | On-device, encrypted. Best privacy in market | No predictions. No symptom logging beyond basics. No standalone experience. iOS only |
| **Stardust** | Free / $4.99/mo | ~5M downloads | ~$10M ARR | Marketed as "privacy-first" post-Dobbs but stores data in cloud with account | Privacy marketing doesn't match architecture. Cloud-synced. VC-funded — monetization pressure inevitable |
| **Drip** | Free (open source) | ~100K | $0 (volunteer) | Fully local, open source. Best privacy architecture | Abandoned/minimal development. Poor UX. Android only. No iOS version |

**Market opportunity:** ~70M American women of reproductive age. Post-Dobbs, "private period tracker" searches spiked 3,000%+ (Google Trends, June-July 2022). No commercial app has delivered on the promise of truly local-only tracking with a polished UX. Drip proved the demand but couldn't execute. Apple Health proved on-device works but won't build a standalone period tracker. The gap is wide open.

---

## Key Features (MVP)

### Core Tracking
- **Period logging:** Tap a date to mark period start. Tap again to mark end. Support multi-day selection by dragging. Log flow intensity (light / medium / heavy / spotting) per day
- **Cycle calendar:** Month view showing period days (filled), predicted period days (outlined), fertile window estimate (subtle highlight), and today marker
- **Cycle prediction:** On-device moving-average algorithm predicts next period start date, cycle length, and period duration based on the user's historical data. Minimum 2 cycles for first prediction, improves with more data
- **Fertile window estimate:** Simple calculation based on predicted ovulation (cycle length minus 14 days, +/- 2 day window). Clearly labeled as an estimate, not medical advice

### Symptom Logging
- **Daily symptom entry:** Tap any date to log symptoms. Categories: Physical (cramps, headache, bloating, breast tenderness, fatigue, acne, backache), Mood (happy, anxious, irritable, sad, energetic, calm), Flow (light, medium, heavy, spotting), Other (custom text note)
- **Symptom icons:** Simple, non-clinical iconography. Tap to toggle on/off. No sliders, no numeric scales — binary present/absent with optional intensity (mild / moderate / severe)

### Insights
- **Cycle statistics:** Average cycle length, average period duration, cycle length variation, longest/shortest cycle. Updates in real-time as data accumulates
- **Cycle history list:** Scrollable list of past cycles with start date, length, period duration, and logged symptoms
- **Symptom patterns:** Simple frequency chart showing which symptoms appear most often and in which cycle phase (follicular, ovulatory, luteal, menstrual)

### Reminders
- **Period reminder:** Local push notification X days before predicted period start (user-configurable, default: 2 days)
- **Daily log reminder:** Optional daily notification at user-chosen time to log symptoms
- **All reminders use local notifications** — no server, no push notification service, no APNs/FCM tokens

### Data Management
- **Export:** Export all data as CSV or JSON to Files app / share sheet
- **Import:** Import from CSV (documented format) for users migrating from other apps
- **No backup to cloud** — if the user loses their phone, the data is gone (by design). Documented clearly during onboarding
- **Wipe all data:** Single button to permanently delete all local data

### Onboarding
- **First launch:** 3-screen onboarding: (1) "Your data never leaves this device" with technical explanation, (2) "Log your last period to get started", (3) "Set up reminders (optional)"
- **No account creation.** No email. No name. App launches directly into the calendar
- **No analytics, no crash reporting, no network requests whatsoever** on first launch or ever

---

## Technical Architecture

### Stack

| Layer | Technology |
|---|---|
| Mobile framework | Expo (React Native) with Expo Router |
| Web framework | Next.js 15 (App Router) |
| Local database | expo-sqlite (mobile) / sql.js or IndexedDB (web) |
| State management | Zustand with SQLite persistence layer |
| UI components | Custom component library, dark mode native |
| Notifications | expo-notifications (local only) |
| Date handling | date-fns (tree-shakeable, no moment.js) |
| Charts/heatmap | react-native-svg + custom heatmap component |
| Monorepo | Turborepo |
| Package manager | pnpm |
| Language | TypeScript 5.9 everywhere |
| Testing | Vitest (shared logic), Jest (React Native), Playwright (web) |

### Data Model (SQLite)

```sql
-- Core cycle tracking
CREATE TABLE cycles (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  start_date    TEXT NOT NULL,           -- ISO 8601 date (YYYY-MM-DD)
  end_date      TEXT,                    -- NULL if current/ongoing cycle
  period_end_date TEXT,                  -- Last day of menstrual bleeding
  cycle_length  INTEGER,                 -- Computed: days between this start and next start
  period_length INTEGER,                 -- Computed: days from start_date to period_end_date
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_cycles_start_date ON cycles(start_date);

-- Daily log entries
CREATE TABLE daily_logs (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  date          TEXT NOT NULL UNIQUE,    -- ISO 8601 date (YYYY-MM-DD)
  flow          TEXT,                    -- 'spotting' | 'light' | 'medium' | 'heavy' | NULL
  note          TEXT,                    -- Free-form text note
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_daily_logs_date ON daily_logs(date);

-- Symptom entries (many-to-one with daily_logs)
CREATE TABLE symptoms (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  daily_log_id  TEXT NOT NULL REFERENCES daily_logs(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,           -- 'physical' | 'mood' | 'other'
  symptom       TEXT NOT NULL,           -- 'cramps' | 'headache' | 'anxious' | etc.
  intensity     TEXT DEFAULT 'moderate', -- 'mild' | 'moderate' | 'severe'
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_symptoms_daily_log ON symptoms(daily_log_id);
CREATE INDEX idx_symptoms_category ON symptoms(category);

-- Prediction cache (recomputed on each new cycle entry)
CREATE TABLE predictions (
  id                    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  predicted_start_date  TEXT NOT NULL,
  predicted_end_date    TEXT NOT NULL,
  fertile_window_start  TEXT,
  fertile_window_end    TEXT,
  confidence            REAL,           -- 0.0-1.0, based on cycle regularity
  computed_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

-- App settings (key-value store)
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Schema version for migrations
CREATE TABLE schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Prediction Algorithm

The cycle prediction engine runs entirely on-device using a weighted moving average:

```
Algorithm: Weighted Moving Average Cycle Prediction
─────────────────────────────────────────────────────

Input:  Last N completed cycles (N = min(cycles_available, 6))
Output: Predicted next period start date, predicted period duration

1. Compute cycle lengths: L[i] = start_date[i+1] - start_date[i]
2. Assign weights: most recent cycle gets weight N, second most recent gets N-1, etc.
   W[i] = N - i  (where i=0 is most recent)
3. Weighted average cycle length:
   avg_cycle = sum(L[i] * W[i]) / sum(W[i])
4. Predicted next start = last_start_date + round(avg_cycle)

Period duration prediction:
5. Same weighted average applied to period_length values
6. avg_period = sum(P[i] * W[i]) / sum(W[i])

Fertile window estimate:
7. estimated_ovulation = predicted_start - 14 days
8. fertile_window = [estimated_ovulation - 3, estimated_ovulation + 1]

Confidence score:
9. stddev = standard_deviation(L[])
10. confidence = max(0, 1 - (stddev / avg_cycle))
    - stddev < 2 days → confidence > 0.9 (very regular)
    - stddev > 7 days → confidence < 0.5 (irregular)

Edge cases:
- < 2 completed cycles: Show "Need more data" instead of prediction
- Cycle > 45 days or < 21 days: Flag as potentially irregular, still predict
- Gap > 90 days between entries: Treat as tracking gap, exclude from average
```

This algorithm requires zero network access, zero ML model, and runs in <1ms on any modern phone. It matches the accuracy of simple calendar-based predictions used by OB-GYNs for decades.

### Privacy Architecture

**Network isolation:** The app makes zero network requests. Period. No analytics (no Firebase, no Amplitude, no Mixpanel). No crash reporting (no Sentry, no Crashlytics). No remote config. No feature flags fetched from a server. No update checks beyond the App Store's built-in mechanism.

**Verification:** The app's `Info.plist` / `AndroidManifest.xml` declares no network permissions. The Expo config explicitly sets no network-dependent plugins. A user with a packet sniffer (e.g., Charles Proxy) will see zero outgoing requests.

**Data at rest:** SQLite database stored in the app's sandboxed container. On iOS, this is automatically encrypted by the device's Data Protection (NSFileProtectionComplete — file is inaccessible when the device is locked). On Android, the database file is in the app's private internal storage directory, inaccessible to other apps without root.

**No backup leakage:**
- iOS: Exclude the SQLite database from iCloud backup via `NSURLIsExcludedFromBackupKey`. The user's cycle data does not appear in iCloud backups.
- Android: Set `android:allowBackup="false"` in the manifest. Data does not appear in Google Drive backups.

**First launch behavior:** App opens directly to the onboarding flow. No splash screen network check. No "connecting to server" spinner. Immediate local-only experience.

**Data deletion:** "Wipe All Data" button in Settings performs `DROP TABLE` on all tables, then `VACUUM` to zero out the database file. Confirmed with a destructive alert ("This permanently deletes all your cycle data. This cannot be undone.").

---

## UI/UX Direction

### Design Language

- **Color palette:** Dark background (#0A0A0F), warm amber primary (#F5A623), coral accent (#FF6B6B) for period days, soft teal (#4ECDC4) for fertile window, muted grays for secondary text
- **Typography:** Inter (or system font) — clean, humanist, readable at small sizes
- **Shape language:** Rounded rectangles (12px radius), circular day cells in calendar, soft shadows
- **Iconography:** Custom line icons, 1.5px stroke weight, warm amber color. No medical/clinical aesthetic. No shield icons. No padlock icons (privacy is assumed, not advertised in-app)
- **Motion:** Subtle spring animations on toggle/tap. Calendar month transitions slide horizontally. Symptom chips have a gentle scale-in animation

### Navigation Structure

Bottom tab bar with 3 tabs:

```
[Calendar]     [Today]     [Insights]
```

1. **Calendar tab (default):** Full-screen month calendar. Period days filled coral, predicted days outlined coral, fertile window subtle teal dots. Tap any day to open the daily log sheet (half-sheet modal sliding up from bottom). Swipe left/right to change months.

2. **Today tab:** Today's snapshot. Shows: current cycle day ("Day 14 of ~28"), days until next period ("Period in ~5 days"), today's logged symptoms (with edit button), and a quick-log bar at the bottom for common symptoms.

3. **Insights tab:** Cycle statistics at top (avg length, avg period, regularity score). Below: cycle history list (scrollable, each row shows cycle dates, length, symptoms summary). Below that: symptom frequency heatmap.

### Key Screen Flows

**Onboarding (3 screens, skippable after screen 1):**
```
Screen 1: "Your data stays here."
  [Phone icon with a lock]
  "MyCycle stores everything on your device.
   No accounts. No cloud. No network requests.
   Your cycle data physically cannot be accessed by anyone but you."
  [Continue]

Screen 2: "When did your last period start?"
  [Calendar picker — select a date]
  [Optional: "How long did it last?" — day picker, default 5]
  [Continue]  [Skip — I'll log later]

Screen 3: "Want a heads-up before your period?"
  [Toggle: Period reminder — ON by default, "2 days before"]
  [Toggle: Daily log reminder — OFF by default]
  [Done]
```

**Daily log (half-sheet modal from any calendar day tap):**
```
┌─────────────────────────────────────┐
│  Tuesday, March 15                   │
│                                     │
│  Flow                               │
│  [Spotting] [Light] [Medium] [Heavy]│
│                                     │
│  Physical                           │
│  [Cramps] [Headache] [Bloating]     │
│  [Fatigue] [Breast ↑] [Backache]    │
│  [Acne]                             │
│                                     │
│  Mood                               │
│  [Happy] [Anxious] [Irritable]      │
│  [Sad] [Energetic] [Calm]           │
│                                     │
│  Notes                              │
│  [Free-text input........................]│
│                                     │
│  [Save]                             │
└─────────────────────────────────────┘
```

Symptom chips are toggle buttons — tap to select (amber fill), tap again to deselect. Long-press to set intensity (mild/moderate/severe via a small popover).

**Settings screen (gear icon in top-right of Calendar tab):**
- Period reminder: toggle + days-before picker
- Daily log reminder: toggle + time picker
- Export data (CSV / JSON)
- Import data (CSV)
- Wipe all data (destructive, requires confirmation)
- About MyCycle (version, license, privacy statement)

### Platform-Specific Considerations

- **iOS widget:** Small (2x2) widget showing cycle day number and days-until-next-period. Uses WidgetKit via expo-widgets or a native module. No network required.
- **Apple Watch complication (post-MVP):** Cycle day on watch face.
- **Android widget:** Same as iOS widget, using expo-widgets or native module.

---

## Monetization

### Pricing

- **$4.99 one-time purchase** via App Store / Google Play (RevenueCat for IAP management)
- **$4.99 one-time purchase** via direct sale (Lemon Squeezy) for users who prefer not to go through the App Store
- **No free tier.** The entire app is the paid product. No feature gating, no "premium" upsell, no ads.
- **No subscription.** One payment, lifetime access, including all future updates.

### Revenue Model

- App Store takes 30% (year 1) / 15% (year 2+ via Small Business Program) of IAP revenue
- Lemon Squeezy takes ~5% of direct sales
- Target: 50,000 paid downloads in year 1 = ~$175,000 gross revenue (after App Store cut)
- Long-term: 200,000+ downloads as privacy-first period tracker becomes a category standard

### Why One-Time Works

- Zero server costs (no cloud infrastructure to maintain)
- Zero ongoing data costs (no ML model training, no API calls)
- Marginal cost per user is effectively $0
- Updates are funded by new user acquisition, not subscription retention
- Aligns incentives: the app must be good enough that users recommend it, not sticky enough that users can't cancel

---

## Marketing Angle

### One-Sentence Pitch

**"The period tracker that can't be subpoenaed."**

### Expanded Pitch

MyCycle is a $5 period tracker that stores your cycle data exclusively on your device. No accounts, no cloud sync, no analytics, no network requests — ever. In a world where period tracking data has been used as evidence in criminal cases, MyCycle is the only commercial-grade tracker that makes privacy a technical guarantee, not a policy promise.

### Target Communities

1. **r/privacy** (1.7M members) — Core audience. Lead with the technical architecture: zero network requests, no backup leakage, on-device encryption. This community will verify claims and amplify if true.
2. **r/TwoXChromosomes** (14M members) — Largest women's community on Reddit. Post-Dobbs privacy anxiety is a recurring topic. Position as a practical solution, not a political statement.
3. **r/QuantifiedSelf** (100K members) — Data ownership angle. "Your data, your device, your export."
4. **Reproductive rights advocates and organizations** — Partner with digital rights orgs (EFF, Access Now) for credibility. Seek endorsements from privacy-focused journalists (e.g., The Markup, EFF's Surveillance Self-Defense).
5. **Women's health influencers on TikTok/Instagram** — Short-form content: "I deleted Flo. Here's what I use now."
6. **Tech press** — Pitch to The Verge, Ars Technica, Wired. Angle: "A developer built the period tracker that the post-Dobbs era demands."

### Press-Worthy Elements

- **Technical verifiability:** Source-available under FSL. Anyone can audit the code and confirm zero network requests. This is the killer differentiator — no other commercial period tracker can make this claim and prove it.
- **Timing:** Every news cycle about reproductive rights data privacy renews the demand signal.
- **Price disruption:** $5 one-time vs $50-70/year from competitors. The value proposition is obvious.
- **Emotional resonance:** "Nobody needs to know your cycle but you." This isn't just a product feature — it's a values statement that drives organic sharing.

---

## MVP Timeline

### Pre-Development (Week 0)
- Finalize design document (this document)
- Set up Turborepo monorepo with Expo + Next.js + shared packages
- Configure pnpm, TypeScript, ESLint, Prettier
- Set up CI (GitHub Actions: typecheck, lint, test)

### Week 1: Data Layer + Core Logic
- Implement SQLite schema and migration system
- Build cycle prediction algorithm in `packages/shared/`
- Write comprehensive tests for prediction algorithm (edge cases: irregular cycles, gaps, insufficient data)
- Implement Zustand store with SQLite persistence
- Build data export/import utilities (CSV, JSON)

### Week 2: Calendar UI
- Build month calendar component (custom, not a library — need full control over day cell rendering)
- Implement period day highlighting (filled for logged, outlined for predicted)
- Implement fertile window highlighting
- Build month-to-month navigation (horizontal swipe)
- Integrate with cycle data store

### Week 3: Daily Logging + Symptoms
- Build daily log half-sheet modal
- Implement flow intensity selector
- Build symptom chip grid (physical, mood categories)
- Implement long-press intensity picker
- Build notes text input
- Wire save/update/delete to SQLite

### Week 4: Today View + Insights
- Build Today tab with cycle day counter, days-until prediction, and quick-log bar
- Build Insights tab: cycle statistics cards, cycle history list
- Build symptom frequency heatmap (react-native-svg)
- Implement settings screen (reminders, export, import, wipe)

### Week 5: Notifications + Onboarding
- Implement local push notifications (expo-notifications)
- Build period reminder scheduling logic
- Build daily log reminder scheduling logic
- Build 3-screen onboarding flow
- Implement iCloud/Google backup exclusion
- Build "Wipe All Data" with confirmation

### Week 6: Polish + Web
- Port mobile UI to Next.js web app (shared components where possible)
- Cross-platform testing (iOS simulator, Android emulator, web browsers)
- Accessibility pass (VoiceOver, TalkBack, dynamic type sizes)
- Performance profiling (SQLite query times, render performance)
- Dark mode refinement
- App icon and splash screen design

### Week 7: Distribution Prep
- App Store screenshots and metadata
- Privacy policy page (static site or GitHub Pages)
- App Store review submission (iOS + Android)
- Lemon Squeezy storefront setup
- RevenueCat IAP configuration
- Source-available repository setup (GitHub, FSL license)

### Week 8: Launch
- Submit to App Store review
- Prepare launch posts for target communities
- Draft press pitches
- Set up simple landing page (mycycle.app or similar)
- Launch day: Reddit posts, community outreach, press emails
- Monitor crash-free rate, reviews, download velocity

---

## Acceptance Criteria

The MVP is complete when ALL of the following are true:

### Functional
- [ ] User can log period start and end dates by tapping calendar days
- [ ] User can log flow intensity (spotting, light, medium, heavy) for each day
- [ ] User can log symptoms (physical and mood categories) for each day with optional intensity
- [ ] User can add free-text notes to any day
- [ ] Cycle prediction algorithm produces a predicted next period start date after 2+ logged cycles
- [ ] Fertile window estimate is displayed on the calendar
- [ ] Cycle statistics (avg length, avg period, regularity) are computed and displayed
- [ ] Cycle history list shows all past cycles with summary data
- [ ] Symptom frequency patterns are visualized
- [ ] Local push notifications fire for period reminders at the configured time
- [ ] Local push notifications fire for daily log reminders at the configured time
- [ ] User can export all data as CSV
- [ ] User can export all data as JSON
- [ ] User can import data from CSV
- [ ] User can wipe all data with confirmation dialog
- [ ] Onboarding flow collects last period date and reminder preferences
- [ ] App works completely offline from first launch — never requires network

### Privacy
- [ ] Zero network requests confirmed via Charles Proxy / mitmproxy during a full test session
- [ ] iOS: SQLite database excluded from iCloud backup (verified via `NSURLIsExcludedFromBackupKey`)
- [ ] Android: `android:allowBackup="false"` in manifest
- [ ] No analytics SDK, no crash reporting SDK, no remote config SDK in the dependency tree
- [ ] No `NSAppTransportSecurity` exceptions in Info.plist (no HTTP/HTTPS needed)
- [ ] No `INTERNET` permission in AndroidManifest (or if required by Expo, no actual network calls)
- [ ] Privacy policy accurately states: no data collection, no data sharing, no server communication

### Quality
- [ ] App launches in <2 seconds on iPhone 12 and equivalent Android
- [ ] Calendar scrolling is 60fps on target devices
- [ ] Prediction algorithm has >95% test coverage with edge cases
- [ ] VoiceOver (iOS) and TalkBack (Android) navigate all screens correctly
- [ ] Dynamic Type (iOS) and font scaling (Android) don't break layouts
- [ ] App passes App Store review on first submission (no rejections for missing functionality)

### Distribution
- [ ] Available on iOS App Store
- [ ] Available on Google Play Store
- [ ] Available on Mac App Store (Catalyst or web via PWA)
- [ ] Source code published on GitHub under FSL license
- [ ] Lemon Squeezy storefront active for direct purchases
- [ ] Landing page live with privacy statement and download links
