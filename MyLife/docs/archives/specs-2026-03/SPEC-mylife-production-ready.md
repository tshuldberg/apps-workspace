# MyLife Production Readiness Specification

> **Spec Version:** 1.0
> **Last Updated:** 2026-03-09
> **Status:** Draft
> **Author:** Codex
> **Scope:** MyLife suite platform, hub shell, all 27 registered modules, and planned modular additions MyFilms and MyBaby

---

## 1. Product Overview

### 1.1 Product Identity

- **Name:** MyLife
- **Positioning:** Privacy-first personal life suite with one hub and many contained apps
- **Platforms:** iOS, Android, Web
- **Architecture:** Shared hub shell plus registered modules with local-first SQLite storage and selective cloud-backed features
- **Registry Scope:** 27 registered module IDs in `packages/module-registry/src/constants.ts`

### 1.2 Production-Ready Goal

MyLife is production ready when the suite can be released to real paying users without pretending unfinished modules are complete, without putting sensitive data at risk, and without relying on manual heroics to keep the product stable.

Production ready does **not** mean every module is general-availability on day one. It means:

1. The platform itself is launch-safe.
2. The launch-tier modules meet a clear GA bar.
3. Beta and fallback preview states are honestly labeled and operationally contained.
4. Billing, privacy, data safety, migrations, notifications, support, and release operations are treated as first-class product features.

### 1.3 Initial Commercial Scope

The first production release should be scoped deliberately:

- **Market:** US-first, English-first
- **Device scope:** iPhone, Android phone, responsive web
- **Business model:** MyLife suite subscription with free-module access preserved
- **Privacy promise:** No analytics, no ad tech, no data resale, local-first by default
- **Module truthfulness:** No module may be marketed as parity-complete if it is still a thin adapter or partial migration
- **Module model:** every included app remains modular, with its own definition, navigation surface, migrations, release state, and entitlement behavior

### 1.4 Explicit Non-Goals for Initial Production

The following are out of scope for initial production readiness and must not block launch:

- Full suite-wide social/community features
- Cross-device real-time sync for every local module
- macOS-native application
- International billing, tax, and multi-currency polish beyond initial US support
- Shipping every included module as GA on day one

---

## 2. Production-Ready Principles

### 2.1 Honest Release States

Every module must be assigned one release state:

| State | Meaning | User Visibility | Marketing Eligibility |
|------|---------|-----------------|-----------------------|
| GA | Production ready, supported, included in paid promise | Default visible | Yes |
| Public Beta | Real user-facing module with known gaps | Visible with beta badge and disclaimer | Limited |
| Preview | Incomplete or experimental | Opt-in only or hidden behind Labs | No |
| Hidden/Internal | Not user-facing | Hidden | No |
| Merged/Deprecated | No longer standalone in the suite | Hidden or redirected | No |

### 2.2 No Dead Routes

No enabled module may expose a button, route, or tab that leads to a missing screen, broken re-export, or placeholder shell unless the surface is explicitly labeled Preview.

### 2.3 Privacy Is a Product Requirement

For MyLife, privacy is not marketing copy. Production readiness requires:

- no silent telemetry
- no hidden third-party data export
- clear permission requests
- export and delete capabilities
- sensitive-data protection for health, mood, notes, journal, mail, homes, and finance domains

### 2.4 Module Maturity Must Match Billing

Premium modules can be sold only if their state is honest:

- GA modules support the advertised core job-to-be-done
- Beta modules are clearly labeled and excluded from parity claims
- Preview modules are not used to justify price

### 2.5 Launch in Tiers

The suite must launch in tiers. The hub may include all modules in the registry, but only modules that meet their target gates may be enabled by default or promoted in pricing/marketing.

### 2.6 Included Apps Remain Modular

Included apps must remain modular even when launched together inside one suite.

This means:

- every included app has a discrete module definition and release state
- beta modules are developed in place without being collapsed into generic suite screens
- cross-module integrations may exist, but they do not erase per-module ownership, navigation, or data boundaries
- future additions such as MyFilms and MyBaby must enter through the same modular registry and release-gate system

---

## 3. Suite-Level Production Requirements

### 3.1 Security and Privacy

The platform must satisfy all of the following before production launch:

- Stripe webhook signature verification is implemented and enforced server-side.
- No critical secret management issues remain in mobile, web, Supabase, or cloud-backed modules.
- Sensitive modules support app lock / biometric guardrails or equivalent protected-entry flow.
- Error messages shown to end users do not leak secret names, environment variable names, or internal infrastructure details.
- All cloud module secrets live in environment-backed server configuration only.
- Privacy policy, terms, and data-handling disclosures exist for web and store listings.
- A release review confirms zero analytics SDKs, ad SDKs, or telemetry endpoints beyond explicitly approved operational services.

### 3.2 Identity, Auth, and Account Model

MyLife production auth must follow this model:

- Core local modules work without account creation.
- MyLife account is optional for local-only usage and required only for purchase restore, cloud-backed modules, or cross-device premium entitlement recovery.
- Session persistence works reliably on mobile and web.
- First-run onboarding clearly explains local-first behavior, optional account scope, and premium entitlements.
- Account deletion, logout, and local data reset flows are implemented and tested.

### 3.3 Billing and Entitlements

Billing must be production ready on both mobile and web:

- RevenueCat and Stripe entitlements resolve to the same product model.
- Purchase restore works on iOS, Android, and web account sessions.
- Free versus premium module gating is driven by registry metadata and shared entitlement checks.
- Grace-period and offline entitlement caching exist so users do not lose access due to transient network failures.
- The suite must not present dormant or hidden modules as paid value in checkout copy.
- `subs` is treated as part of MyBudget, not as a separately marketed production module.

### 3.4 Data, Migrations, Backup, Export, and Delete

The shared data layer must meet these requirements:

- Fresh install and upgrade migrations are idempotent across mobile and web.
- Each GA or Beta module supports export of user-owned data in a durable format.
- Suite-level diagnostic export exists for support without violating the privacy model.
- Delete flows are available at module level or suite level as appropriate.
- Migration rollback strategy is documented for local SQLite schema failures and cloud schema failures.
- Backups are local-first. If optional cloud backup is introduced later, it must be explicit opt-in.

### 3.5 Notifications and Background Work

Production readiness requires a shared platform approach for notifications:

- Reminders are centralized by permission domain and surfaced clearly in settings.
- Time-zone handling is tested for reminders, recurring events, fasting windows, cycle predictions, and medications.
- Background sync and refresh are used only where necessary and documented per module.
- If a module promises reminders, it must support creation, edit, disable, and recovery after reinstall or device reboot.

### 3.6 Integrations and External Services

MyLife production readiness requires explicit decisions for every external dependency:

- Apple Health / Health Connect shared adapter is a supported platform feature, not an experiment.
- Supabase-backed modules have staging and production environments, migrations, logs, rate limits, and failure runbooks.
- Mail, voice transcription, barcode, OCR, and food search integrations each have provider fallback or honest limitation states.
- External API usage must include attribution and caching rules where licenses require them.

### 3.7 UX, Accessibility, and Platform Consistency

All GA and Beta modules must meet the following baseline:

- complete empty, loading, error, and success states
- touch targets, text scaling, and screen reader support
- consistent Cool Obsidian shell treatment
- no obviously placeholder cards or zero-value dashboards on marketed modules
- one coherent onboarding path for the hub and optional module-level onboarding where needed

### 3.8 Performance and Reliability

The suite must define and meet operational budgets:

- cold start on modern phone should feel immediate and never present a blank screen
- first-run migration path must show a loading state if setup exceeds a short threshold
- scrolling, search, and primary list screens should remain smooth on low-end devices
- no module may block hub boot on optional network requests
- cloud-backed modules degrade gracefully when offline

### 3.9 QA, Release Operations, and Support

Production release operations must include:

- staged environments for web and cloud modules
- signed mobile builds and repeatable build pipelines
- parity checks, type checks, tests, and route existence checks in CI
- release checklist for web deploys, mobile builds, app store metadata, privacy review, and rollback
- support workflow for export-based debugging and issue triage
- incident owner and rollback path for billing, auth, and cloud modules

---

## 4. Launch Tiers for All Registered Modules

The following tiers define the target production posture for the current 27-module registry.

| Tier | Modules | Policy |
|------|---------|--------|
| GA at initial production launch | books, budget, fast, habits, health, meds, recipes, rsvp, words | Enabled by default, included in pricing and marketing |
| Public Beta at initial production launch | car, closet, cycle, flash, garden, homes, journal, mail, mood, notes, nutrition, pets, stars, surf, trails, voice, workouts | Visible in product at launch, clearly labeled beta, not sold as parity-complete |
| Merged / deprecated | subs | Fold into MyBudget; do not ship as independent module |
| Planned modular additions | MyFilms, MyBaby | Included in suite planning, but not launch blockers until they are registered, implemented, and assigned a release tier |

### 4.1 Tier Movement Rules

A module can move up a tier only when:

- all routes declared by the host app exist on supported surfaces
- P0 requirements for that module are complete
- export, delete, and support paths exist
- module-specific tests and manual QA are complete
- product copy, pricing, and discover labels match the actual state

For planned modular additions, a module cannot enter the launch matrix until it has:

- a module definition
- registry inclusion
- host-app wiring plan
- documented release-state assignment

---

## 5. Platform Release Gates

### 5.1 Suite GA Gate

The suite cannot launch until all of the following are true:

- critical security issues are closed
- auth and billing flows are reliable on mobile and web
- broken or missing module routes are eliminated for all enabled modules
- the launch-tier modules meet their GA gates
- beta modules are clearly labeled, and preview remains available as a fallback state if a module must be pulled back
- app store assets, legal pages, support contact, and release runbooks exist

### 5.2 Module GA Gate

A module reaches GA only when:

- the core user job is fully supported on its marketed host surfaces
- mobile and web have no dead links for declared screens
- empty/loading/error states are complete
- export and delete are implemented or explicitly supported at the suite level
- module-specific P0 items are complete
- automated coverage and smoke tests meet the module bar
- manual QA confirms offline behavior, upgrade safety, and primary happy paths

### 5.3 Public Beta Gate

A module can ship as Public Beta when:

- the module is usable end-to-end for at least one core workflow
- known major gaps are disclosed
- broken routes are removed
- data safety and export/delete behavior are acceptable
- support can reproduce and diagnose common failures

### 5.4 Preview Gate

A module can ship as Preview only when:

- it is opt-in
- the user is not charged on the basis of that module alone
- the module cannot corrupt suite state or crash the hub
- missing screens or placeholder surfaces are clearly marked or hidden

Preview is not the intended initial launch state for the current registered modules, but it remains a valid rollback state if a beta module is not stable enough for public exposure.

---

## 6. Module Production Requirements

This section defines the required release state and production work for every registered module.

### 6.1 GA Launch Modules

#### MyBooks (`books`) - Target: GA

- **Current posture:** Mature, hub-wired, feature-rich reading tracker.
- **P0 before GA:** stable library/search/detail/review flows, reading progress, stats, series support, export/import sanity, no dead routes on mobile or web.
- **P1 after GA:** book clubs, friend activity, author following, richer social discovery.
- **Go/no-go rule:** must fully satisfy the private reading-tracker job without depending on social features.

#### MyBudget (`budget`) - Target: GA

- **Current posture:** Mature, core budgeting flows and reports exist.
- **P0 before GA:** envelopes, transactions, subscriptions, reports, account state, export, onboarding, entitlement-safe premium gating, data integrity under heavy usage.
- **P0 note:** production launch may be US-only and USD-first. Multi-currency can remain P1 if launch scope stays explicit.
- **P1 after GA:** richer charts, receipt OCR, investments, advanced loan planning, broader shared-finance flows.
- **Go/no-go rule:** must be reliable as a daily budgeting product with no data-loss risk.

#### MyFast (`fast`) - Target: GA

- **Current posture:** Core timer/history/stats are live, but hub parity still trails standalone in onboarding and widgets.
- **P0 before GA:** fasting timer, history, protocol selection, zone display, onboarding, widget parity, health sync flow, stable settings and export.
- **P1 after GA:** smart hydration reminders, multi-beverage coefficients, caffeine timeline, watch-specific quick actions.
- **Go/no-go rule:** must match the core standalone product intent on the hub before being marketed as GA.

#### MyHabits (`habits`) - Target: GA

- **Current posture:** Strong core tracking and stats, with advanced engagement features still missing.
- **P0 before GA:** daily/weekly/monthly habits, streaks, reminders, timed habits, export, stable stats, no dead routes, reliable local notifications.
- **P1 after GA:** negative habits, sobriety clock, focus timer, Health auto-tracking, structured challenges, gamification layers.
- **Go/no-go rule:** must be credible as a general-purpose habit tracker even before deeper gamification arrives.

#### MyHealth (`health`) - Target: GA

- **Current posture:** Broadest health hub with working sync infrastructure and strong local domain model.
- **P0 before GA:** today dashboard, vitals, sleep, fasting bridge, documents/vault, emergency info, health sync settings, reliable import from Apple Health / Health Connect, export path.
- **P1 after GA:** sleep-stage analysis, readiness scoring, guided meditation, fuller recovery insights, clinical record import polish.
- **Go/no-go rule:** must function as the suite’s trusted health dashboard and shared health-data surface.

#### MyMeds (`meds`) - Target: GA

- **Current posture:** Strong medication management, reminders, interactions, and reporting.
- **P0 before GA:** medication CRUD, reminders, adherence tracking, refill tracking, interaction checks, doctor report export, stable medication history.
- **P1 after GA:** blood pressure, glucose/insulin, caregiver alerts, digestive tracking, pain mapping, weather correlation.
- **Go/no-go rule:** cannot launch GA without dependable reminders and clear support for missed-dose recovery.

#### MyRecipes (`recipes`) - Target: GA

- **Current posture:** Rich kitchen module with pantry, meal planning, garden/event bridges, and strong product depth.
- **P0 before GA:** recipe CRUD, meal planning, shopping list, cooking mode, pantry, event flow, import/export stability, mobile/web parity on primary flows.
- **P1 after GA:** paper OCR, video import, voice cooking, richer freezer inventory and cooking history polish.
- **Go/no-go rule:** must be strong enough to replace a typical personal recipes app for a private household.

#### MyRSVP (`rsvp`) - Target: GA

- **Current posture:** Strong event and guest-management module.
- **P0 before GA:** event creation, invites, RSVP state, guest list, announcements, check-in basics, event analytics, export and time-zone safety.
- **P1 after GA:** iCal sync polish, QR check-in, dietary/accessibility notes, seating charts.
- **Go/no-go rule:** must safely support a real hosted event end-to-end.

#### MyWords (`words`) - Target: GA

- **Current posture:** Real dictionary/thesaurus lookup surface exists on mobile and web.
- **P0 before GA:** lookup reliability, provider fallback, error handling, attribution/licensing compliance, recent-result caching, responsive mobile/web surfaces.
- **P1 after GA:** saved words, spaced review bridge into MyFlash, stronger offline/local dictionary options.
- **Go/no-go rule:** must be dependable for repeated daily lookups and not fail silently on provider outages.

### 6.2 Public Beta Modules

#### MyCar (`car`) - Target: Public Beta

- **Current posture:** Core vehicle and maintenance flows exist, but spec breadth is far larger than current delivery.
- **P0 before Public Beta:** garage, vehicle detail, maintenance log, fuel logs, basic reminders surface, expense log, export, reliable CRUD.
- **P1 before GA:** proactive reminder engine, next-due scheduling, cost-per-mile analytics, trip logging, registration/inspection, insurance vault, parking saver.
- **Go/no-go rule:** beta is acceptable only if the module is framed as a maintenance log, not a fully complete vehicle platform.

#### MyCloset (`closet`) - Target: Public Beta

- **Current posture:** Strong wardrobe base with explicit advanced-feature gaps.
- **P0 before Public Beta:** item catalog, outfit creation, wear logs, laundry, packing lists, export, stable search/filter flows.
- **P1 before GA:** outfit recommendations, capsule workflows, wishlist, color analysis, share/export packaging.
- **Go/no-go rule:** beta is acceptable because the core wardrobe use case is already meaningful.

#### MyFlash (`flash`) - Target: Public Beta

- **Current posture:** Real study/deck/browser/stats/settings UI exists, but ecosystem import/export and richer media are missing.
- **P0 before Public Beta:** deck CRUD, study queue, review logging, browser search, basic cloze support, export history, reminders if promised.
- **P1 before GA:** Anki `.apkg` import/export, rich media, nested deck polish, undo review, AI generation, shared decks, onboarding.
- **Go/no-go rule:** cannot be sold as an Anki replacement until ecosystem import/export is real.

#### MyJournal (`journal`) - Target: Public Beta

- **Current posture:** Real Today flow exists, but encryption and richer editing are still pending.
- **P0 before Public Beta:** entry creation, notebook separation, prompts, On This Day, search, export, stable local storage.
- **P1 before GA:** encryption, richer markdown, voice capture, metadata capture, calendar heatmap.
- **Go/no-go rule:** beta is acceptable only with clear disclosure that advanced privacy/editing features are still arriving.

#### MyNutrition (`nutrition`) - Target: Public Beta

- **Current posture:** More complete than earlier audits suggested, with food search, diary, trends, barcode, photo, and API layers.
- **P0 before Public Beta:** food search, diary logging, goals, barcode flow, trends, settings, export, reliable food data attribution.
- **P1 before GA:** restaurant database, better AI photo logging, watch quick log, deeper meal planning, richer wearable burn sync.
- **Go/no-go rule:** beta is acceptable if calorie/macro tracking is solid and food data is reliable enough for everyday use.

#### MyPets (`pets`) - Target: Public Beta

- **Current posture:** Strong backend model and good care tracking foundation.
- **P0 before Public Beta:** pet profiles, medications, vaccinations, vet visits, feeding/exercise/grooming logs, export, emergency/sitter card basics.
- **P1 before GA:** richer gallery, breed-risk alerts, stronger multi-pet dashboard, better sitter handoff UX.
- **Go/no-go rule:** beta is acceptable if a household can safely use it for one or two pets.

#### MySurf (`surf`) - Target: Public Beta

- **Current posture:** Product depth is high, but hub parity and cloud/data pipeline hardening still matter.
- **P0 before Public Beta:** forecast view, spot detail, favorites, sessions, account state, cloud/env hardening, graceful offline behavior.
- **P1 before GA:** full hub map parity, deeper community surface, refined cross-device subscription sync.
- **Go/no-go rule:** beta is acceptable only if NOAA/NDBC data and auth flows are operationally stable.

#### MyWorkouts (`workouts`) - Target: Public Beta

- **Current posture:** Strong data model and engine, but hub player UX is incomplete relative to the full product promise.
- **P0 before Public Beta:** exercise library, builder, progress, recordings, stable session logging, surfaced active workout player, rest timer UI, previous performance display.
- **P1 before GA:** progressive overload automation, recovery map, demos, AI generation, watch companion, richer social/coach features.
- **Go/no-go rule:** beta is acceptable only after the active workout experience exists as a real user-facing flow, not just engine code.

### 6.3 Additional Public Beta Modules

#### MyCycle (`cycle`) - Target: Public Beta

- **Current posture:** Real engine exists, but host surfaces are incomplete.
- **P0 before Public Beta:** log-day, insights, settings, export, prediction stability, clear privacy framing.
- **P1 before GA:** broader symptom depth, refined education, richer Apple Health export and cycle-adjacent integrations.
- **Go/no-go rule:** beta is acceptable only if the core tracking loop is real on the launched host surfaces.

#### MyGarden (`garden`) - Target: Public Beta

- **Current posture:** Data model exists, but declared screens are missing and web is placeholder-level.
- **P0 before Public Beta:** plant detail, add plant, journal, seeds, settings, stable care reminders.
- **P1 before GA:** bed planning, companion guidance, pest/disease knowledge, frost/weather intelligence.
- **Go/no-go rule:** beta is acceptable only if users can manage real plants without hitting missing-screen dead ends.

#### MyHomes (`homes`) - Target: Public Beta

- **Current posture:** Significant standalone-to-hub parity gap and cloud/API complexity.
- **P0 before Public Beta:** honest scope, gated cloud dependencies, auth stability, discover detail, profile, messages, support for staging/prod ops.
- **P1 before GA:** stronger parity with standalone listing flows, deeper search/filter, richer profile and communication tools.
- **Go/no-go rule:** beta is acceptable, but `homes` must stay out of GA until the cloud and parity burden is materially lower.

#### MyMail (`mail`) - Target: Public Beta

- **Current posture:** data layer exists but host compose/setup/detail flows are incomplete.
- **P0 before Public Beta:** account setup, inbox, message detail, draft, compose, search, sync error handling.
- **P1 before GA:** better threading, attachment workflows, offline sync resilience, multi-account polish.
- **Go/no-go rule:** beta is acceptable only if users can connect an account and complete basic inbox workflows.

#### MyMood (`mood`) - Target: Public Beta

- **Current posture:** backend is substantial, but host surfaces are incomplete.
- **P0 before Public Beta:** logging, breathing, insights, year-in-pixels, stable exports and sensitive-data protection.
- **P1 before GA:** richer experiments, SOS flows, attachment support, improved correlation views.
- **Go/no-go rule:** beta is acceptable only if the daily mood logging and review loop is fully surfaced.

#### MyNotes (`notes`) - Target: Public Beta

- **Current posture:** data and index surfaces exist, but editor/search/folders/settings are still missing.
- **P0 before Public Beta:** note editor, folders, search, settings, stable markdown storage, export and recovery.
- **P1 before GA:** attachments, graph view, version history, richer embeds and daily-notes polish.
- **Go/no-go rule:** beta is acceptable only if note creation, editing, and retrieval are all real.

#### MyStars (`stars`) - Target: Public Beta

- **Current posture:** data model exists, but charting experience is far from user expectation.
- **P0 before Public Beta:** profile creation, reading basics, chart rendering strategy, clear disclosure of current depth.
- **P1 before GA:** full birth chart, transit alerts, aspect grid, stronger compatibility and journaling experiences.
- **Go/no-go rule:** beta is acceptable only if users can at least create a profile and receive coherent readings without broken navigation.

#### MyTrails (`trails`) - Target: Public Beta

- **Current posture:** geo engine exists, but core map/offline/route UX is not ready.
- **P0 before Public Beta:** route detail, map rendering, recording playback, GPX handling, safe offline states.
- **P1 before GA:** offline maps, route planning, weather overlays, safety sharing, privacy zones.
- **Go/no-go rule:** beta is acceptable only if the app is explicit that backcountry-grade offline reliability is still in progress.

#### MyVoice (`voice`) - Target: Public Beta

- **Current posture:** CRUD layer exists, but STT provider decision and recording UX are unresolved.
- **P0 before Public Beta:** recording UI, playback, transcript detail, provider choice, privacy disclosures, export.
- **P1 before GA:** stronger search, tags, summarization polish, and bridges into Notes and Journal.
- **Go/no-go rule:** beta is acceptable only if the record-to-transcript loop actually works.

### 6.4 Merged / Deprecated Module

#### MySubs (`subs`) - Target: Merged Into MyBudget

- **Current posture:** registry metadata exists but there are no host routes.
- **Production rule:** do not ship MySubs as an independent user-facing module.
- **Required action:** expose subscriptions as a first-class section of MyBudget and remove independent marketing/discover expectations.

### 6.5 Planned Modular Additions

#### MyFilms - Target: Post-Launch Modular Addition

- **Current posture:** planned module, not part of the current registered launch matrix.
- **Production rule:** include in the suite roadmap, but do not block the initial launch bundle.
- **Required action before entry:** add registry metadata, module definition, route plan, data model, and release-state assignment.

#### MyBaby - Target: Post-Launch Modular Addition

- **Current posture:** planned module, not part of the current registered launch matrix.
- **Production rule:** include in the suite roadmap, but do not block the initial launch bundle.
- **Required action before entry:** add registry metadata, module definition, route plan, data model, and release-state assignment.

---

## 7. Cross-Module Production Requirements

### 7.1 Shared Health Stack

The following modules must share one supported health integration contract:

- MyHealth
- MyFast
- MyMeds
- MyHabits
- MyNutrition
- MyWorkouts
- MyMood (read-only where relevant)

Shared requirements:

- one permissions model
- one Apple Health / Health Connect adapter
- clear import versus export semantics
- graceful degradation when health permissions are denied

### 7.2 Shared Reminder Stack

Notifications must be unified across:

- MyMeds
- MyHabits
- MyCycle
- MyCar
- MyFlash
- MyRSVP
- MyGarden

Shared requirements:

- per-module reminder settings
- suite-level notification health check
- time-zone safe scheduling
- snooze, disable, and audit state where appropriate

### 7.3 Shared Documents and Attachments

Attachments, exports, and user-owned media need one common policy for:

- MyHealth documents
- MyJournal photos and exports
- MyNotes attachments
- MyPets records
- MyRSVP photos
- MyCar documents

Requirements:

- predictable storage location
- export inclusion rules
- delete behavior
- privacy-safe previews and sharing

### 7.4 Shared Financial Context

MyBudget is the suite’s money system of record for cross-module spend correlation.

Cross-module hooks should be planned for:

- MyRecipes grocery cost
- MyPets care costs
- MyTrails trip spend
- MySurf travel spend
- MyCar operating costs
- MySubs subscription cost inside MyBudget

These integrations are P1 unless they block a module’s core promise.

### 7.5 Shared Knowledge Loop

The knowledge-productivity stack should interoperate after launch:

- MyNotes -> MyFlash
- MyJournal -> MyMood
- MyVoice -> MyJournal / MyNotes
- MyWords -> MyFlash

These are not launch blockers for the initial suite, but data model compatibility should be preserved.

---

## 8. Quality Gates and Acceptance Criteria

### 8.1 Engineering Gates

Every production-bound change must pass:

- `pnpm typecheck`
- relevant module tests
- `pnpm check:module-parity`
- `pnpm check:passthrough-parity`
- `pnpm check:workouts-parity`
- `pnpm check:parity`

Additional required gates:

- route existence audit for enabled modules
- migration upgrade test from previous schema versions
- billing smoke tests
- auth smoke tests
- manual accessibility review for new or changed primary screens

### 8.2 Test Thresholds by Release State

| Release State | Minimum Automated Bar |
|--------------|------------------------|
| GA | Unit + integration coverage on core module logic, smoke coverage on host surfaces, one end-to-end happy path per host |
| Public Beta | Strong unit coverage on data layer plus host-surface smoke tests |
| Preview | Route-level smoke tests and data-safety tests only |

### 8.3 Manual QA Checklist for Every Enabled Module

- install fresh and open module for first time
- upgrade from prior schema version
- create, edit, delete, export primary record type
- verify offline behavior
- verify error states for denied permissions or missing network
- verify module can be disabled and re-enabled without data loss

### 8.4 Store and Web Launch Checklist

- mobile app icons, splash assets, privacy strings, deep links, and subscription screenshots are present
- web pricing, privacy policy, terms, support, and billing pages are live
- user-facing copy matches actual module tier states
- beta labels are present in hub discover and pricing-adjacent screens, and preview fallback labeling is ready if any module must be pulled back

---

## 9. Release Plan

### Phase 1: Platform Hardening

- close critical security findings
- stabilize auth, billing, entitlement restore, and export/delete flows
- finish route-existence enforcement
- harden cloud-backed module environments

### Phase 2: GA Bundle Completion

- bring `books`, `budget`, `fast`, `habits`, `health`, `meds`, `recipes`, `rsvp`, and `words` to GA gate
- ensure hub discover, pricing, and onboarding reflect only this guaranteed value

### Phase 3: Public Beta Bundle

- ship `car`, `closet`, `cycle`, `flash`, `garden`, `homes`, `journal`, `mail`, `mood`, `notes`, `nutrition`, `pets`, `stars`, `surf`, `trails`, `voice`, and `workouts` as clearly labeled beta modules
- instrument support and export workflows to absorb real-world feedback safely

### Phase 4: Beta Hardening and Tier Graduation

- graduate beta modules only after their host-surface gaps and core workflow gaps are closed
- use Preview only as a fallback state if a launched beta module is not stable enough for continued public exposure

### Phase 5: Post-Launch Expansion

- re-evaluate social, gamification, deeper AI features, internationalization, and planned modular additions MyFilms and MyBaby

---

## 10. Final Acceptance Definition

MyLife is ready for production when all of the following are simultaneously true:

1. The suite passes security, billing, auth, migration, and export/delete release gates.
2. The GA module set is polished and honest.
3. Beta modules are usable, clearly disclosed, and modular in implementation rather than collapsed into generic suite placeholders.
4. Preview remains available only as a fallback state, not as a substitute for honest launch labeling.
5. No currently enabled module contains dead routes, deceptive placeholders, or unsupported pricing claims.
6. Support, release, and rollback workflows exist for mobile, web, and cloud-backed surfaces.
7. Future included apps such as MyFilms and MyBaby remain in the roadmap until they are introduced through the same modular release system.

If these conditions are not met, MyLife may still be a strong platform in development, but it is not yet a production-ready suite.

---

## 11. References

- `docs/specs/SPEC-*.md` module specifications
- `docs/reports/REPORT-production-readiness-audit-2026-03-08 2.md`
- `docs/reports/REPORT-platform-consolidation-review-2026-03-07.md`
- `docs/reports/REPORT-feature-gap-deep-dive-2026-03-09.md`
- `docs/reports/REPORT-competitive-feature-analysis-2026-03-05.md`
- `docs/AUDIT-standalone-app-maturity.md`
