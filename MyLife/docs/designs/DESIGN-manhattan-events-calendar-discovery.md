# DESIGN: Manhattan (Events, Calendar & Discovery)

- Status: Draft for review
- Date: 2026-06-06
- Owner: trey
- Type: New MyLife app (BestChef-style module + standalone app pair)
- Module id: `manhattan` | Table prefix: `mh_` (verified unused) | SKU: `mylife_manhattan_unlock` ($4.99)

## 1. Summary

Manhattan is a NYC events, calendar, and discovery app delivered as a MyLife suite app. It aggregates events (music, comedy, theater, nightlife, fitness/classes, civic/cultural) from third-party sources, lets users capture events that friends post on social by sharing them into the app, syncs two ways with the device calendar, supports rich notes on saved spots and plans, and organizes everything under a robust multi-axis taxonomy.

It is built like BestChef: a logic module (`modules/manhattan`) plus a standalone Expo app (`apps/manhattan`), running on MyLife's existing substrate (SQLite via `@mylife/db`, mesh sync via `@mylife/sync`, identity via `@mylife/auth`, billing via `@mylife/billing-config` + `@mylife/entitlements`, design system via `@mylife/ui`). It is local-first with no login by default, an optional on-device lock, and optional Supabase cloud for multi-device sync and future social.

Because Ticketmaster's API terms forbid the use we need, ticketing sources are modeled as pluggable adapters with explicit gap flags. The gaps become the backlog for a future first-party "MyLife Tickets" module that Manhattan can consume the day it ships, with no consumer-code change.

## 2. Goals and non-goals

### Goals
1. Aggregate events from clean, ToS-compliant sources into one discovery feed, scoped to NYC at launch.
2. Let users capture any event from anywhere via an OS share intent (share a flyer, post, or link into Manhattan) with on-device parsing.
3. Two-way device calendar sync: events booked or saved in Manhattan write to the calendar, and calendar events read back into Manhattan.
4. Capture fitness/class commitments (Equinox and studios) through share intent and calendar, with recurrence support.
5. Rich, extended notes on pins (saved spots) and plans, with cross-module tags.
6. A robust multi-axis taxonomy and filtering system, including music purpose facets (teaching, learning, listening, making instruments, theory, history, production, jam/open-mic).
7. Local-first by default; optional lock; optional cloud; $4.99; explicit "no data sale, no ads" stance.
8. Be structurally ready to consume a future first-party ticketing module.

### Non-goals (v1)
1. Selling or reselling tickets in-app (deep-link out to the provider instead).
2. Scraping platforms that forbid it (Ticketmaster, Resident Advisor, DICE, Posh, Partiful, Instagram).
3. Building the first-party "MyLife Tickets" module (separate future project; Manhattan only prepares the seam).
4. Wiring Manhattan into the MyLife hub apps (`apps/mobile`, `apps/web`). Cross-module interfaces are implemented so this can be turned on later, but hub surfacing is out of scope for v1.
5. Cities beyond NYC (taxonomy and adapters are city-parameterized, but only NYC is seeded).

## 3. Product decisions (resolved with the user)

| Decision | Choice |
|---|---|
| Product type | Full product for others, eventually Web/Android/iOS. |
| Platform now | Expo + Next.js cross-platform, built inside MyLife (not native SwiftUI). The existing SwiftUI app is design reference only. |
| Where it lives | MyLife monorepo, BestChef-style pair: `modules/manhattan` + `apps/manhattan`. |
| Hub integration (v1) | Standalone first. Implement cross-module interfaces, defer `apps/mobile` / `apps/web` wiring. |
| Identity, default | No login, no password. Open the app and data persists on-device. |
| Identity, optional lock | Optional on-device app lock (PBKDF2 + biometric) via `@mylife/auth/module-lock`. Pure local, encrypts at rest. |
| Identity, optional cloud | Optional Supabase account for multi-device sync and future social, opt-in at setup or later. |
| Monetization | One-time IAP `mylife_manhattan_unlock` at $4.99 (also covered by the $19.99 hub bundle). |
| Privacy | "No data sale, ever. No ads, ever." pledge screen. Zero telemetry. All AI defaults off behind consent. |
| Ticketing | Use clean APIs (SeatGeek and the like) now; flag gaps (Ticketmaster, RA, DICE, Posh, Partiful, Equinox) as adapters fulfilled later by a first-party module. |
| Pins privacy | Private by default with a per-pin "share in plan" opt-in toggle. |
| Tables | Own `mh_*` tables for discovery/taxonomy control; shadow-write to `hub_events` for later suite-wide surfacing (trails-v14 pattern). |
| AI extraction | Opt-in, off by default, never required for any core flow. |
| Web calendar | No device calendar on web; ICS import/export now, optional Google Calendar adapter later. |

## 4. Architecture overview

Manhattan is primarily an orchestrator. Only six capabilities are genuinely new code; everything else is reused from existing MyLife modules and packages.

New code:
1. Source-adapter registry and the Tier-1 adapters.
2. Cross-source de-duplication engine.
3. Multi-axis taxonomy engine.
4. Two-way device calendar bridge (`expo-calendar`).
5. Share-intent ingestion (`expo-share-intent`) plus on-device URL/text parser.
6. One shared notifications platform adapter for Expo (none exists yet in the repo).

Reused:
- `@mylife/db` (SQLite adapter, migration runner, test helpers)
- `@mylife/sync` (mesh sync, declarative `syncPolicy`)
- `@mylife/auth` (no-login default, module lock, secure storage, Supabase client)
- `@mylife/billing-config` + `@mylife/entitlements` + `@mylife/subscription` (paywall)
- `@mylife/ui` (design tokens and components)
- `@mylife/notes` plus hub `hub_tags`/`hub_tag_bindings` (extended notes and tags)
- `@mylife/search` (FTS and filtering via `getSearchableContent`)
- `@mylife/notifications` (reminders and digests)
- `@mylife/social` (future social activity types and share cards)
- `@mylife/intelligence` (LLM transport for opt-in extraction)
- `modules/rsvp` engines (`ical`, `location`) and RSVP/check-in model
- `modules/classes` calendar engine (`classesToICS`, `eventKitPayload`, `commuteBuffer`, `detectConflicts`)
- `modules/mail` `parseIcs` for inbound ICS
- `modules/friends` hangouts integrations (fulfilling existing empty stubs)

### 4.1 File tree

```
modules/manhattan/                      # @mylife/manhattan (logic)
  package.json                          # main+types ./src/index.ts; peerDeps @mylife/db,@mylife/ui,react,react-native
  tsconfig.json                         # extends @mylife/typescript-config/react.json
  CLAUDE.md  AGENTS.md  README.md
  src/
    index.ts                            # barrel exports
    definition.ts                       # MANHATTAN_MODULE: id, tablePrefix 'mh_', tier 'premium',
                                        #   requiresAuth:false, requiresNetwork:false, migrations[], syncPolicy, crossModule
    types.ts                            # zod schemas + inferred types (NormalizedEvent, Pin, Plan, Facet, SourceRef)
    db/
      schema.ts                         # CREATE TABLE IF NOT EXISTS mh_* constants + indexes
      crud/                             # events.ts, pins.ts, plans.ts, plan-members.ts, facets.ts, sources.ts
    engines/                            # PURE (no Expo/FS/DB imports)
      taxonomy.ts                       # multi-axis classifier + facet assignment
      dedup.ts                          # title + venue + start_at fuzzy de-duplication
      ranking.ts                        # discovery feed ranking
      calendar-payload.ts               # NormalizedEvent/Plan -> EventKit/CalendarContract payload (TZID America/New_York)
    sources/
      types.ts                          # EventSourceAdapter, SourceCoverage, gapFlag, SourceGapError
      registry.ts                       # buildSourceRegistry()
      seatgeek.ts  nyc-open-data.ts  tiktok-oembed.ts  ics-import.ts  share-intent.ts
      gaps/                             # ticketmaster.ts, ra.ts, dice.ts, posh.ts, partiful.ts, equinox.ts, mylife-tickets.ts
    parser/
      url-parser.ts                     # on-device share-link/text parsing (date/venue/title), ports the SwiftUI EventLinkParser logic
    integrations/                       # cross-module bridges (pure functions over already-loaded rows)
      notes-bridge.ts                   # markdown notes + hub tags on pins/plans
      classes-bridge.ts                 # recurring fitness/class capture via classes engine
      friends-bridge.ts                 # fulfill rsvp-link/music-link hangout stubs
      calendar-link.ts                  # calendar_event_id mapping helpers
    cloud/client.ts                     # initManhattanClient/getManhattanClient/resetManhattanClient
    cross-module.ts                     # getTodayCards, getSearchableContent, getDataSummary
    __tests__/                          # vitest with createModuleTestDatabase

apps/manhattan/                         # @mylife/manhattan-app (Expo Router)
  package.json                          # dep "@mylife/manhattan":"workspace:*" + auth/db/sync/ui/social/notifications/search/intelligence
                                        #   + expo block copied from apps/bestchef + expo-calendar + expo-share-intent + expo-local-authentication
  app.json eas.json tsconfig.json metro.config.js .easignore .env.example
  shims/crypto.js                       # copy verbatim
  plugins/                              # withSecurityHardening.js, withDataProtection.js (verbatim)
                                        #   + expo-calendar config plugin + expo-share-intent config plugin
  assets/icon.png
  app/
    index.tsx                           # Redirect -> /(root)/(tabs)/discover
    _layout.tsx
    (root)/
      _layout.tsx                       # DatabaseProvider > I18nProvider > ManhattanCloudProvider > AppProvider > AppThemeProvider > Stack
      (tabs)/_layout.tsx                # Tabs: Discover | Calendar | Pins | Plans | Settings
      (tabs)/discover.tsx calendar.tsx pins.tsx plans.tsx settings.tsx
      event/[id].tsx  pin/[id].tsx  plan/[id].tsx
      onboarding/pledge.tsx             # no-data-sale pledge
      settings/data-sync.tsx            # cloud opt-in, lock, source toggles
      providers/
        DatabaseProvider.tsx            # openDatabaseSync('manhattan.db') + MANHATTAN_MODULE.migrations
        ManhattanCloudProvider.tsx      # getSupabaseClient when env present + initManhattanClient
        AppProvider.tsx  AppThemeProvider.tsx
      data/launch-environment.ts        # read EXPO_PUBLIC_SUPABASE_* / EXPO_PUBLIC_MANHATTAN_*
```

### 4.2 Registry and config edits (required)

- `packages/module-registry/src/types.ts`: add `'manhattan'` to the `ModuleId` union and `ModuleIdSchema` enum.
- `packages/module-registry/src/constants.ts`: add `MODULE_METADATA` and `MODULE_IDS` entry.
- `packages/module-registry/src/release-states.ts`: add `'manhattan'` to `HIDDEN_MODULE_IDS` (promote later after a UIUX mission-control doc exists).
- `packages/ui/src/tokens/colors.ts`: add a Manhattan accent color.
- `packages/billing-config/src/index.ts`: add `manhattan: { id: 'mylife_manhattan_unlock', price: 4.99 }` to `standaloneModules`.
- `packages/auth/src/module-lock.ts`: add `'manhattan'` to `LOCKABLE_MODULE_IDS`.

## 5. Data model

All tables use app-generated `TEXT PRIMARY KEY NOT NULL`. Every syncable row carries `created_at TEXT NOT NULL DEFAULT (datetime('now'))` and `updated_at TEXT NOT NULL DEFAULT (datetime('now'))`; `updated_at` must be bumped on every update (load-bearing for last-write-wins). Soft delete via `deleted_at TEXT`.

### Tables

- `mh_events`: id, source_id, external_id, title, description, venue_name, address, lat, lng, neighborhood, start_at, end_at, all_day, category, purchase_url, ticket_provider, image_url, price_min, price_max, is_free, saved (bool), status, created_at, updated_at, deleted_at. Stores events the user has engaged with (saved, planned, imported). Live discovery results are cached separately (see `mh_source_cache`) and are not synced.
- `mh_event_facets`: id, event_id, axis, value, created_at. The taxonomy join table (see Section 8). One row per (event, axis, value).
- `mh_pins`: id, name, category, lat, lng, neighborhood, photo_ref, is_shareable (default 0), created_at, updated_at, deleted_at. Saved spots/venues. Notes live in `@mylife/notes`, bound by tag.
- `mh_plans`: id, title, start_at, end_at, event_id (nullable), pin_id (nullable), reminder_minutes (nullable), calendar_event_id (nullable), has_reservation, party_size, source, status, created_at, updated_at, deleted_at. An itinerary entry.
- `mh_plan_members`: id, plan_id, person_ref, role, created_at, updated_at. Collaborators on a shared plan (or-set CRDT).
- `mh_sources`: id (adapter id), enabled, last_synced_at, config_json, created_at, updated_at. Per-adapter enable state and config. Device-local only.
- `mh_source_cache`: id, source_id, fetched_at, payload_json, ttl_seconds. Short-TTL cache of live discovery results. Device-local only; never synced.

### 5.1 syncPolicy

Declared on `MANHATTAN_MODULE.syncPolicy` (mirrors the verified `modules/rsvp/src/definition.ts` shape). Mesh sync activates only when the user opts into cloud; with cloud off, all data is local.

```ts
syncPolicy: {
  defaultScope: 'personal_replica',
  shareable: true,
  entityRules: [
    { tableName: 'events',       defaultScope: 'personal_replica', conflictStrategy: 'lww' },
    { tableName: 'event_facets', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
    // Pins: private by default; per-pin toggle elevates an individual row to shared_workspace.
    { tableName: 'pins',         defaultScope: 'personal_replica', maxScope: 'shared_workspace', conflictStrategy: 'lww', isSensitive: true },
    { tableName: 'plans',        defaultScope: 'shared_workspace', conflictStrategy: 'lww' },
    { tableName: 'plan_members', defaultScope: 'shared_workspace', conflictStrategy: 'or_set' },
    { tableName: 'sources',      defaultScope: 'device_local',     conflictStrategy: 'lww' },
    { tableName: 'source_cache', defaultScope: 'device_local',     conflictStrategy: 'lww' },
  ],
}
```

Per-pin sharing: a pin defaults to `personal_replica` and `isSensitive`. Setting `is_shareable = 1` elevates that single row's effective scope to `shared_workspace` so it can be referenced by a shared plan. Turning it back off returns the row to private.

## 6. Source-adapter architecture

A registry of pluggable sources. Each adapter normalizes into one `NormalizedEvent` shape and declares coverage plus an optional `gapFlag`. Gap adapters surface in the UI as "Coming with MyLife Tickets" rather than failing silently. This is the seam that lets the future ticketing module slot in with no consumer-code change.

```ts
export type SourceTier = 'tier1' | 'gap';
export type GapReason = 'tos_excluded' | 'no_public_api' | 'auth_required' | 'planned_first_party';

export interface SourceCoverage {
  categories: string[];                  // music, comedy, theater, nightlife, sports, civic, fitness, arts
  ingestKinds: ('api' | 'oembed' | 'share' | 'calendar' | 'scrape')[];
  realtime: boolean;
}

export interface EventSourceAdapter {
  id: string;
  displayName: string;
  tier: SourceTier;
  coverage: SourceCoverage;
  gapFlag?: { reason: GapReason; note: string };
  isAvailable(): boolean;                // env/key/consent gate
  fetchEvents(input: SourceQuery): Promise<NormalizedEvent[]>;  // throws SourceGapError if gapFlag set
}

export interface NormalizedEvent {
  sourceId: string;
  externalId?: string;
  title: string;
  description?: string;
  venueName?: string;
  address?: string;
  lat?: number;
  lng?: number;
  neighborhood?: string;
  startAt?: string;                      // ISO8601, America/New_York
  endAt?: string;
  allDay?: boolean;
  category?: string;
  facets?: { axis: string; value: string }[];
  priceMin?: number;
  priceMax?: number;
  isFree?: boolean;
  imageUrl?: string;
  purchaseUrl?: string;                  // deep-link out (never sell in-app)
  ticketProvider?: string;               // first-party provider slots in here later
}
```

### Tier-1 adapters (build now)

| Adapter | Mechanism | Coverage | Notes |
|---|---|---|---|
| `seatgeek` | Public API, key in `.env.local` | concerts, sports, theater, comedy | Primary structured NYC inventory. Affiliate revenue is sanctioned. Short-TTL cache, deep-link out. |
| `nyc_open_data` | Socrata SODA, no key | civic, parks, free public programming | Public-domain. Cleanest source, zero ToS risk. |
| `tiktok_oembed` | oEmbed endpoint + `url-parser` | viral event posts | Parse a shared TikTok link into a candidate event. |
| `share_intent` | OS share intent + `url-parser` | any URL or text | User shares a flyer/post; on-device parse; optional AI extraction (opt-in). |
| `device_calendar` | `expo-calendar` two-way | the user's own events | Read existing events; write Manhattan plans back via `calendar_event_id`. |
| `ics_import` | `parseIcs` (from `modules/mail`) + file/URL | any calendar | Import shared invites or venue ICS feeds. |

### Flagged gaps (stub now, fulfilled by future MyLife Tickets module)

| Source | gapFlag.reason |
|---|---|
| `ticketmaster` | `tos_excluded` |
| `resident_advisor` | `no_public_api` |
| `dice` | `no_public_api` |
| `posh` | `no_public_api` |
| `partiful` | `no_public_api` |
| `equinox` | `auth_required` (capture via share intent + calendar + classes recurrence until a sanctioned path exists) |
| `mylife_tickets` | `planned_first_party` (inert stub; flip `isAvailable()` when the module ships) |

## 7. Calendar, share intent, and notes

### 7.1 Two-way device calendar (new native bridge)

`expo-calendar` is absent from the repo and is the one true native gap. Add it plus its config plugin to `apps/manhattan`.

- Read: pull the user's upcoming events into Manhattan as plans, de-duplicated by a Manhattan-owned UUID written into the event (do not rely on `eventIdentifier`, which invalidates on delete, or `calendarItemExternalIdentifier`, which is not guaranteed unique).
- Write: when a user saves or books a plan, write to a dedicated Manhattan calendar (not the default), storing the returned id in `mh_plans.calendar_event_id`.
- Payloads come from `engines/calendar-payload.ts`, reusing the verified `classes` engine shapes (`eventKitPayload`, `classesToICS`), extended to inject `TZID=America/New_York` (the classes engine currently emits floating local datetimes).
- Web has no device calendar: use ICS import/export now; an optional Google Calendar adapter is future work.

### 7.2 Share-intent ingestion (new)

`expo-share-intent` is absent; add it plus iOS/Android share-extension config. The extension is a thin courier: capture the shared URL or text, hand it to `parser/url-parser.ts` for on-device extraction of title, date, and venue (porting the existing SwiftUI `EventLinkParser` logic), producing a candidate `NormalizedEvent` the user confirms. Optional AI extraction (Section 9) can enrich a low-confidence parse, but only with explicit consent.

### 7.3 Extended notes (composed, no new table)

Notes attach to pins and plans via `@mylife/notes` CRUD plus hub `hub_tags`/`hub_tag_bindings` (both verified present), following the `modules/classes` `notes-bridge` pattern. Notes are Markdown stored as plain text. The model supports a single editable summary note plus an append-only timestamped log per entity, with optional photo attachments. When a plan is mirrored to the device calendar, its summary note is projected into a delimited managed block inside the calendar event notes so the rest of that field is left untouched.

## 8. Taxonomy and filtering

Six orthogonal axes, stored generically in `mh_event_facets` (`event_id`, `axis`, `value`). Filtering is AND across axes, OR within an axis, surfaced through `@mylife/search` via `getSearchableContent`.

- Axis 1 Category (single-select): Music, Comedy, Theater, Dance, Visual Arts/Exhibition, Film/Screening, Sports, Education/Class, Food & Drink, Literary/Spoken Word, Nightlife/Social, Festival, Family/Kids, Talks & Ideas, Markets & Fairs. Maps to Schema.org Event subtypes for any future JSON-LD.
- Axis 2 Format/Purpose (multi-select, scoped per category). Generic: Live Performance, Festival, Screening, Class/Workshop, Seminar/Talk, Conference, Networking, Party, Competition, Tour, Exhibition, Gala. Music-specific (the headline request): Live Show (Listening), Jam Session, Open Mic, DJ Set, Listening Party, Teaching/Class, Learning/Workshop, Masterclass, Music Theory, Music History, Production/Recording, Instrument Making/Luthiery, Record Fair, Artist Talk.
- Axis 3 Genre (multi-select, hierarchical, scoped by category). Music seeded from a standard genre vocabulary (Alternative, Blues, Classical, Country, Dance/Electronic, Folk, Hip-Hop/Rap, Jazz, Latin, Metal, Pop, R&B, Reggae, Rock, World) with subgenres. Non-music categories get their own genre vocab.
- Axis 4 Vibe (multi-select, curated): Free, 21+, All Ages, Intimate, Big Venue, Outdoor, Late Night, Day Party, Date Night, Solo-Friendly, Beginner-Friendly, Family-Friendly, Standing/GA, Seated, Accessible (ADA), plus a skill sub-facet (Beginner, Intermediate, Advanced, All Levels).
- Axis 5 Price (computed): Free, Under $20, $20-50, $50-100, $100+, Pay-what-you-can.
- Axis 6 Time (computed): Tonight, This Weekend, This Week, Pick a Date, Recurring, plus day-part.

A `participationMode` (Watch, Participate, Learn, Make) distinguishes, for example, a jazz concert from a jazz jam from a jazz class even when genre is identical. The music purpose axis is bespoke; no external API populates it, so it is filled by the taxonomy classifier, organizer-submitted tags, or opt-in AI extraction.

Filter UX: primary chips are Category, Time, Price; secondary expandable chips are Format/Purpose, Genre, Vibe. Show live result counts and suppress zero-result values.

## 9. AI extraction (opt-in, off by default)

On-device parsing is always free and offline. LLM extraction of shared posts and RSS roundups reuses `@mylife/intelligence` transport (`queryLLM`, `buildRequest`, `parseLLMResponse`) behind the existing consent gate (`hub_ai_config`). A new event-extraction prompt and output schema are required (the existing schema is insight-specific). AI extraction is never required for any core flow and defaults off.

## 10. Identity, privacy, and monetization

- Default: no login. Render with `authService = null`; `requiresAuth: false`, `requiresNetwork: false`. Data persists in `manhattan.db` on device.
- Optional lock: `@mylife/auth/module-lock` (PBKDF2-SHA256, 600k iterations, 5-attempt lockout) plus biometric via `expo-local-authentication`; gate the Manhattan subtree with a lock guard.
- Optional cloud: Supabase client built only when `EXPO_PUBLIC_SUPABASE_*` exist, opt-in on the Data & Sync screen; enables mesh sync and future social.
- Monetization: one-time IAP `mylife_manhattan_unlock` at $4.99 via `billing-config`, gated with `entitlements.isModuleUnlocked('manhattan', state)`; purchases through `createPaymentService({platform})` (RevenueCat on mobile, Stripe on web). Set entitlements test mode to false before release.
- Privacy stance: a "No data sale, ever. No ads, ever." pledge screen modeled on the existing onboarding pledge; zero analytics/telemetry; AI defaults off.

## 11. Cross-module readiness (standalone-first)

Implement the `CrossModuleInterface` now even though hub wiring is deferred:
- `getTodayCards(db)`: today's plans and tonight's nearby events (mirror `modules/rsvp/src/cross-module.ts`).
- `getSearchableContent(db)`: events, pins, plans with their facet tags for FTS.
- `getDataSummary(db)`: counts for a future hub dashboard.

When hub surfacing is enabled (Phase 4 or later), shadow-write saved events to the hub events surface (`hub_events` / `hub_places`) so the change requires no migration. Confirm the exact hub surface and its columns at that time (only `hub_tags`, `hub_tag_bindings`, and `hub_places` are verified present today).

## 12. Future first-party "MyLife Tickets" module

Out of scope to build, but Manhattan prepares the seam:
1. Ship the `EventSourceAdapter` interface with gap flags so Ticketmaster, RA, DICE, Posh, Partiful, and Equinox are first-class registry entries that are simply unfulfilled.
2. Keep `NormalizedEvent` source-agnostic with `purchaseUrl` and `ticketProvider` so a first-party provider slots in without schema change.
3. Ship an inert `mylife_tickets` gap stub (`reason: planned_first_party`); when the module ships, flip its `isAvailable()` and point `fetchEvents` at it. No Manhattan consumer-code change.

A public-facing paid ticketing module must follow the BestChef server-backed exception (Supabase Auth, Postgres RLS, Storage, Edge Functions; local SQLite as offline cache only) and can reuse the MyMusic venue/artist SaaS thinking plus `packages/restaurant-saas`, `packages/pos-adapters`, and `packages/payments-advanced`.

## 13. Build phases

- Phase 0 Foundation. Scaffold `modules/manhattan` + `apps/manhattan` from the BestChef recipe (copy `metro.config.js`, `shims/crypto.js`, `plugins/*`, `.easignore` verbatim). Write `db/schema.ts` and `definition.ts` (migrations v1, `tablePrefix: 'mh_'`, `tier: 'premium'`, `requiresAuth: false`, `syncPolicy`). Make the registry/UI/billing/lock edits in Section 4.2. Acceptance: `pnpm install`; `pnpm --filter @mylife/manhattan typecheck` and `--filter @mylife/manhattan-app typecheck` pass; vitest covers schema and migrations; app boots and runs migrations against `manhattan.db`.
- Phase 1 Local CRUD + UI shell. CRUD for events/pins/plans/facets; the five tabs on `@mylife/ui`; pledge onboarding; DatabaseProvider migration boot. Acceptance: fully offline create/read/update/delete persists across relaunch; no sources yet.
- Phase 2 Tier-1 sources + taxonomy. `sources/types.ts` + `registry.ts`; `seatgeek`, `nyc_open_data`, `ics_import`; `engines/dedup.ts`; `engines/taxonomy.ts`; feed ranking. Acceptance: discovery feed populates from SeatGeek + NYC Open Data, de-duplicated, filterable across all six axes; gap adapters render as "coming soon."
- Phase 3 Calendar + share intent. Add `expo-calendar` (two-way, TZID America/New_York, dedicated calendar, UUID de-dup) and `expo-share-intent` (+ extension) feeding `url-parser`; `tiktok_oembed`; opt-in AI extraction. Acceptance: a plan written in-app appears on the device calendar and survives edit/delete without duplicates; a shared post becomes a confirmable candidate event; calendar events read back in.
- Phase 4 Hub composition. Implement the cross-module interfaces; compose `@mylife/notes` (extended notes + tags), `@mylife/friends` (fulfill rsvp-link/music-link stubs), `@mylife/notifications` (build the Expo `NotificationPlatformOps` adapter + reminders/digests); Equinox capture via the classes engine. Acceptance: notes and tags attach to pins/plans; reminders fire; attending an event can log a friends hangout.
- Phase 5 Cloud + social + monetization + release. Optional Supabase via `ManhattanCloudProvider`; mesh sync verified across two devices; `@mylife/social` activity type + share cards; wire the $4.99 paywall; flip entitlements test mode off; `eas init` and set `extra.eas.projectId`; promote the module id from hidden after a UIUX mission-control doc exists; EAS build and submit. Acceptance: cloud opt-in syncs across devices with per-pin privacy respected; paywall gates correctly; TestFlight build uploads.

## 14. Risks and ToS landmines

1. Ticketmaster API forbids the use we need and bars deriving revenue from its data. Excluded; modeled as a gap.
2. Scraping nightlife platforms (RA, DICE, Posh, Partiful) breaches ToS and breaks on every deploy. Never a production dependency; share-import or partnership only.
3. Equinox and ClassPass have no consumer API; reverse-engineering violates ToS. Capture via share intent, calendar, and the classes recurrence engine.
4. Instagram has no compliant path to arbitrary public event posts (Basic Display API retired; Graph API limited; oEmbed App-Review-gated). Rely on share intent.
5. Email parsing scopes are restricted (Google verification plus annual CASA audit). Out of scope; use share/calendar instead.
6. EventKit identifier instability: carry a Manhattan UUID to de-duplicate, not the system identifiers.
7. Mesh sync is an active queued mission; `syncPolicy` is mandatory and must extend `@mylife/sync`, not parallel-wire new sync code.
8. SwiftData/native sharp edges do not apply here (Expo stack), but App Group equivalents for the share extension must be configured for iOS and Android, or the extension cannot hand data to the app.
9. Cross-source duplicates (the same event from Open Data and a share import). The dedup engine must exist before multiple sources coexist (Phase 2).

## 15. Open items (non-blocking, for later)

- Optional Google Calendar adapter for web.
- Editorial RSS ingestion (The Skint, Time Out, BrooklynVegan) with an LLM roundup parser.
- SeatGeek affiliate enrollment and any partner applications.
- Promotion from hidden module to public beta after a UIUX mission-control doc.
- City expansion beyond NYC (parameterized, not seeded).
