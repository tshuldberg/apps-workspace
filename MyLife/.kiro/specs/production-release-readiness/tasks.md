# Implementation Plan: Production Release Readiness

## Overview

Transform MyLife from pre-alpha (445+ tests, 24 modules QA'd, TestFlight-verified) to a credible initial production release on iOS App Store, Google Play Store, and web. Work is organized into 6 dependency-ordered phases: Foundation, Auth & Billing, Data Safety & Privacy, User Experience, Observability & Performance, and Release Operations. All code is TypeScript. All tests use Vitest + fast-check.

## Tasks

- [x] 1. Phase 1: Foundation (R9, R11, R13, R14, R28)
  - [x] 1.1 Add hidden release state and enforce module visibility filtering
    - Add `'hidden'` to `ModuleReleaseState` union in `packages/module-registry/src/release-states.ts`
    - Add `HIDDEN_MODULE_IDS` array with `garden`, `mail`, `subs`
    - Add `isUserVisibleModule()` and `getModuleReleaseLabel()` helper functions
    - Update `apps/mobile/app/(hub)/discover.tsx` to filter out hidden modules and show "Beta" badge for public_beta
    - Update `apps/web/app/discover/page.tsx` with same filtering and badge logic
    - Create a dismissible beta disclaimer banner component in `packages/ui/src/components/BetaDisclaimer.tsx`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x]* 1.2 Write property test for release state completeness and visibility (Property 14)
    - **Property 14: Release state completeness and visibility filtering**
    - For any ModuleId, MODULE_RELEASE_STATES has a defined state; hidden/merged modules are not user-visible; public_beta modules get "BETA" label
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4**

  - [x] 1.3 Implement web error boundary
    - Create `apps/web/components/ModuleErrorBoundary.tsx` as a React class component
    - Props: moduleId, moduleName, children; State: hasError, error
    - Display module name, error message, "Try Again" and "Back to Hub" actions
    - Integrate into each module route layout in `apps/web/app/[moduleId]/layout.tsx`
    - Wire Sentry reporting placeholder (completed in Phase 5)
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 1.4 Implement structured logging for self-host API
    - Create `deploy/self-host/api/src/logger.ts` with pino logger
    - Configure JSON format with timestamp, level, message fields
    - Add PII redaction for authorization, cookie, password, email fields
    - Add request logging middleware with method, path, statusCode, responseTime
    - Replace `console.*` calls in self-host API with logger instance
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

  - [x]* 1.5 Write property test for structured log format (Property 17)
    - **Property 17: Structured log format and request fields**
    - For any HTTP request, log entry is valid JSON with required fields and PII redacted
    - **Validates: Requirements 13.1, 13.3, 13.4**

  - [x] 1.6 Security hardening
    - Verify CSP in `apps/web/middleware.ts` does not include `unsafe-eval` in production
    - Add `pnpm audit --audit-level high` step to `.github/workflows/ci.yml` that fails on critical/high
    - Add rate limiting middleware to `apps/web/app/api/` routes (token bucket, in-memory)
    - Audit all API routes for Zod validation coverage
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [x]* 1.7 Write property test for API input validation (Property 26)
    - **Property 26: API input validation**
    - For any API endpoint and random invalid request body, endpoint returns validation error
    - **Validates: Requirements 14.4**

  - [x] 1.8 Design system token evolution
    - Extend `packages/ui/src/tokens/colors.ts` with 5-tier surface system (lowest, low, container, high, highest) and hub accent (#C9894D, #FFB877)
    - Create or update `packages/ui/src/tokens/glass.ts` with formalized glass morphism tokens
    - Add Plus Jakarta Sans typography config in `packages/ui/src/tokens/typography.ts` with Inter fallback
    - Create `packages/ui/src/constants/brand.ts` with BRAND_NAME and BRAND_DOMAIN constants for rebrand contingency (R15)
    - _Requirements: 28.1, 28.2, 28.3, 28.4, 28.5, 15.1, 15.4_

  - [x] 1.9 Checkpoint: Foundation phase
    - Ensure all tests pass, ask the user if questions arise.

- [x] 2. Phase 2: Auth and Billing (R1, R2, R3)
  - [x] 2.1 Complete auth service implementation
    - In `packages/auth/src/service.ts`: complete signUp, signIn, signOut, getSession, onAuthStateChange; add deleteAccount() method
    - Create `packages/auth/src/secure-storage.ts` with platform-specific SessionStorage adapter (expo-secure-store mobile, httpOnly cookies web)
    - In `packages/auth/src/client.ts`: add platform-specific storage to Supabase client
    - In `packages/auth/src/provider.tsx`: add auto-restore session on mount, error state handling with safe messages
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 1.7, 1.8, 1.9_

  - [x]* 2.2 Write property tests for auth (Properties 1-5)
    - **Property 1: Auth round-trip (sign up then sign in)** -- Validates: Requirements 1.2, 1.3
    - **Property 2: Sign-out clears session** -- Validates: Requirements 1.4
    - **Property 3: Local-only mode grants universal access** -- Validates: Requirements 1.5
    - **Property 4: Session persistence round-trip** -- Validates: Requirements 1.6
    - **Property 5: Invalid credentials produce safe error messages** -- Validates: Requirements 1.9

  - [x] 2.3 Create auth screens
    - Create `apps/mobile/app/(hub)/auth/sign-in.tsx` and `sign-up.tsx`
    - Create `apps/web/app/auth/sign-in/page.tsx` and `sign-up/page.tsx`
    - Wire AuthProvider session restoration in `apps/mobile/app/_layout.tsx` and `apps/web/app/layout.tsx`
    - Add "Sign In / Sign Up" or "Account" section to Hub settings based on auth state
    - _Requirements: 1.1, 1.2, 1.3, 1.5_

  - [x] 2.4 Implement subscription billing and entitlement gating
    - In `packages/subscription/src/revenuecat.ts`: add restorePurchases(), getCustomerInfo(), checkEntitlement()
    - In `packages/subscription/src/stripe.ts`: add getSubscriptionStatus(), cancelSubscription()
    - In `packages/subscription/src/service.ts`: add entitlement caching layer backed by `hub_entitlement_cache` SQLite table
    - Create hub_entitlement_cache table migration in `packages/db/`
    - Wire `packages/entitlements/` to check real subscription state via useModuleUnlocked()
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 2.9_

  - [x]* 2.5 Write property tests for entitlements (Properties 6-7)
    - **Property 6: Entitlement gating matches module tier and subscription state** -- Validates: Requirements 2.1, 2.2, 2.7
    - **Property 7: Cached entitlements survive network failure** -- Validates: Requirements 2.5, 2.9

  - [x] 2.6 Create paywall and subscription management UI
    - Create `apps/mobile/components/PaywallScreen.tsx` (full-screen paywall for premium modules)
    - Create `apps/web/components/PaywallModal.tsx` (modal paywall for web)
    - Add subscription management section to Hub settings (view plan, cancel, resume)
    - _Requirements: 2.2, 2.6, 2.8_

  - [x] 2.7 Implement legal compliance pages and health data consent
    - Create `apps/web/app/legal/privacy/page.tsx`, `terms/page.tsx`, `health-data/page.tsx`
    - Create `packages/ui/src/components/HealthDataConsentDialog.tsx` with moduleId, dataTypes, onConsent, onDecline props
    - Create `hub_health_consent` SQLite table migration (module_id, consented_at, withdrawn_at)
    - Wire consent check into module enable flow for health data modules (health, meds, cycle, mood, nutrition, workouts, fast, habits, presence)
    - Add "Health Data Consent" section to Hub settings with per-module status and withdraw option
    - Add health/wellness disclaimers to privacy policy
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x]* 2.8 Write property tests for health data consent (Properties 8-9)
    - **Property 8: Health data consent gating** -- Validates: Requirements 3.4, 3.5, 6.6
    - **Property 9: Health data deletion completeness** -- Validates: Requirements 3.8

  - [x] 2.9 Checkpoint: Auth and Billing phase
    - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Phase 3: Data Safety and Privacy (R5, R17, R19, R20, R21)
  - [x] 3.1 Implement data export
    - Create `packages/db/src/export.ts` with exportAllModules() function
    - Iterate enabled modules, query all tables by prefix, assemble HubExportData JSON
    - Handle per-module errors gracefully (skip failing module, include error note)
    - Mobile integration: system share sheet via expo-sharing
    - Web integration: Blob + URL.createObjectURL for browser download
    - Add "Export My Data" button to settings screen on both platforms
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.7_

  - [x]* 3.2 Write property tests for data export (Properties 11-12)
    - **Property 11: Data export round-trip completeness** -- Validates: Requirements 5.1, 5.2
    - **Property 12: Export error resilience** -- Validates: Requirements 5.7

  - [x] 3.3 Implement module-level data deletion
    - Create `packages/db/src/deletion.ts` with deleteModuleData() and resetModuleSchemaVersion()
    - Drop all tables with module's prefix, reset hub_schema_versions entry
    - For cloud modules (forums, market, surf, workouts): call Supabase deletion endpoint
    - Add "Delete Module Data" with two-step confirmation dialog in settings
    - Add "Delete All My Data" option with confirmation in settings
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 5.6_

  - [x]* 3.4 Write property test for module data deletion (Property 13)
    - **Property 13: Module data deletion clears all prefixed tables**
    - For any module with a known table prefix, deleteModuleData results in zero rows and schema version removed
    - **Validates: Requirements 17.1, 17.3, 5.6**

  - [x] 3.5 Implement privacy dashboard
    - Redesign `apps/mobile/app/(hub)/privacy.tsx` to show per-module expandable list with table names, row counts, storage type, and size
    - Create `apps/web/app/privacy/page.tsx` with equivalent functionality
    - Display total database size
    - Link "Delete Module Data" action per module to deletion flow (task 3.3)
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_

  - [x] 3.6 Implement backup and restore
    - Enhance `apps/mobile/app/(hub)/backup.tsx` with SQLite file export via share sheet and restore from .sqlite file
    - Implement validateBackupCompatibility() to compare schema versions
    - Implement restore flow: select file, validate, confirm overwrite, replace database, restart
    - Handle incompatible/corrupt backups gracefully (preserve existing database, show error)
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5_

  - [x]* 3.7 Write property tests for backup and restore (Properties 21-22)
    - **Property 21: Backup and restore round-trip** -- Validates: Requirements 20.2
    - **Property 22: Backup validation and restore safety** -- Validates: Requirements 20.3, 20.5

  - [x] 3.8 Implement sensitive module protection (biometric/PIN lock)
    - Create `packages/auth/src/module-lock.ts` with ModuleLockService interface
    - Create `hub_module_locks` SQLite table migration (module_id, pin_hash, salt, failed_attempts, locked_until, created_at)
    - Implement PIN storage as scrypt hash, biometric auth via expo-local-authentication (mobile) / WebAuthn (web)
    - Implement 5-attempt lockout with 60-second window
    - Wire lock check into module navigation for lockable modules (health, meds, mood, journal, budget, cycle, notes, mail)
    - Add per-module lock toggle in module settings
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5_

  - [x]* 3.9 Write property test for module lock enforcement (Property 23)
    - **Property 23: Module lock enforcement**
    - Module with lock requires auth; 5 failed PINs triggers 60s lockout; fewer than 5 does not
    - **Validates: Requirements 21.2, 21.4**

  - [x] 3.10 Checkpoint: Data Safety and Privacy phase
    - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Phase 4: User Experience (R6, R8, R10, R23, R24, R25, R26, R27)
  - [x] 4.1 Enhance onboarding flow
    - Enhance `apps/mobile/app/(onboarding)/index.tsx` with privacy pledge/welcome screen, module selection grid, optional account creation step, health data consent for selected health modules
    - Wire health consent step integration into `packages/onboarding/src/` state machine
    - Ensure completion state persistence via useOnboardingComplete()
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 4.2 Complete web UI for GA modules
    - Audit all 9 GA modules (books, budget, fast, habits, health, meds, recipes, rsvp, words) for any remaining ModuleWebFallback usage
    - Build real web pages for Budget sub-routes: subscriptions, reports, goals, debt-payoff
    - Replace any remaining ModuleWebFallback stubs in GA modules with real web UIs
    - Ensure all GA module web UIs follow Cool Obsidian design system
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 4.3 Create shared notification infrastructure
    - Create `packages/notifications/` package with types.ts, service.ts, and index.ts
    - Define ScheduledNotification interface and NotificationService interface
    - Mobile implementation: wrap expo-notifications with timezone handling via date-fns-tz
    - Web implementation: use Notification API where available
    - Create `hub_scheduled_notifications` and `hub_notification_preferences` SQLite table migrations
    - Implement rescheduleAll() for boot/reinstall recovery
    - Add per-module notification preferences UI in Hub settings
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x]* 4.4 Write property tests for notifications (Properties 15-16)
    - **Property 15: Notification timezone scheduling** -- Validates: Requirements 10.2
    - **Property 16: Notification persistence round-trip** -- Validates: Requirements 10.5

  - [x] 4.5 Optimize hub search reliability
    - In `packages/search/src/query.ts`: add LRU query result cache (50 entries, 30s TTL) for 200ms target
    - Ensure FTS5 index covers all enabled modules implementing CrossModuleInterface
    - Add performance logging for queries exceeding 200ms
    - Ensure incremental indexing on module data changes in `packages/search/src/indexer.ts`
    - Implement search results grouped by module with accent color and icon
    - Implement empty state with 15 most recent cross-module actions
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5_

  - [x]* 4.6 Write property test for search result grouping (Property 24)
    - **Property 24: Search result grouping by module**
    - Results spanning multiple modules are grouped by moduleId with correct accent color and icon
    - **Validates: Requirements 23.2**

  - [x] 4.7 Enhance import wizard
    - Enhance `apps/mobile/app/(hub)/import-wizard.tsx` with source app selection, export instructions, file upload with progress, results summary with per-row error details
    - Ensure support for Goodreads, YNAB, MyFitnessPal, Day One importers from `packages/onboarding/src/import/`
    - No network requirement for local file imports
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5_

  - [x]* 4.8 Write property test for import parsing (Property 25)
    - **Property 25: Import parsing with error tolerance**
    - Mix of valid/invalid rows: all valid rows imported, error details for invalid rows
    - **Validates: Requirements 24.2, 24.4**

  - [x] 4.9 UI/UX redesign: Hub shell screens (R25)
    - Redesign Hub dashboard per `docs/uiux-prompts/hub-dashboard.md` (dynamic greeting, bento summary cards, quick actions, module library grid)
    - Redesign Hub Discover per `docs/uiux-prompts/hub-discover.md` (asymmetric bento grid, featured hero card, category browsing, premium lock overlay)
    - Redesign Hub Settings per `docs/uiux-prompts/hub-settings.md` (metallic gradient subscription card, sync mode selector, glass nav cards)
    - Redesign Hub Search per `docs/uiux-prompts/hub-search.md` (cross-module grouping, keyword highlighting, recent activity feed)
    - Redesign Hub Onboarding per `docs/uiux-prompts/hub-onboarding.md` (privacy consent, sync picker, module selection grid)
    - Redesign Hub Backup & Restore, Privacy Dashboard, Import Wizard, Data & Sync, Sharing Preferences per their respective prompt files
    - Apply equivalent redesign to web hub screens per `docs/uiux-prompts/hub-shell.md`
    - Use extended design tokens from task 1.8; no hardcoded colors
    - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 25.7, 25.8, 25.9, 25.10, 25.11, 25.12_

  - [x] 4.10 UI/UX redesign: GA module screens (R26)
    - Redesign mobile screens for each GA module (books, budget, fast, habits, health, meds, recipes, rsvp, words) per their `docs/uiux-prompts/` prompt files
    - Use each module's registered accent color from MODULE_METADATA
    - Follow Cool Obsidian design system with glass morphism cards
    - Implement complete empty, loading, and error states
    - Preserve all existing functionality (visual refresh only)
    - Verify existing test suites pass after redesign
    - _Requirements: 26.1, 26.2, 26.3, 26.4, 26.5, 26.6_

  - [x] 4.11 UI/UX redesign: Public Beta module screens (R27)
    - Follow same Cool Obsidian patterns as GA modules
    - Display "Beta" badge on module home screens
    - Non-blocking for release: modules not redesigned ship with current visual treatment
    - _Requirements: 27.1, 27.2, 27.3, 27.4, 27.5_

    - [x] 4.11.a UI/UX redesign: MyWorkouts (32 screens)
      - Redesign all 26 mobile screens (home, exercises, exercise detail, workout builder, session, history, programs, program detail, create program, progress, body map, measurements, photos, 1RM calculator, warmup calculator, plate loader, AI generator, overload, GPS runs, watch app, social feed, share workout, explore, superset, timer, settings) and 6 web screens (hub dashboard, exercises, progress, programs, explore, settings)
      - Apply accent #EF4444, glass morphism cards, Cool Obsidian tokens
      - Follow `docs/uiux-prompts/myworkouts.md` prompt spec
      - Preserve all existing workout tracking, program, and session functionality

    - [x] 4.11.b UI/UX redesign: MyNutrition (22 screens)
      - Redesign all 14 mobile screens (home, log food, diary, food detail, search, goals, trends, water, restaurant, community, food notes, barcode, export, settings) and 8 web screens (dashboard, diary, search, goals, trends, water, restaurants, settings)
      - Apply accent #65A30D, glass morphism cards, Cool Obsidian tokens
      - Follow `docs/uiux-prompts/mynutrition.md` prompt spec
      - Preserve all existing nutrition tracking and food logging functionality

    - [x] 4.11.c UI/UX redesign: MyCloset + MyCycle (31 screens)
      - MyCloset (19 screens): redesign 14 mobile screens (home, wardrobe, add item, item detail, outfits, create outfit, outfit detail, laundry, packing lists, wishlist, capsule builder, color analysis, donations, settings) and 4 web screens (hub, wardrobe, outfits, stats) per `docs/uiux-prompts/mycloset.md`
      - MyCycle (12 screens): redesign all mobile screens per `docs/uiux-prompts/mycycle.md`
      - Apply accent #EC4899 (closet) and #F472B6 (cycle)
      - Preserve all existing wardrobe management and cycle tracking functionality

    - [x] 4.11.d UI/UX redesign: MyJournal + MyMood + MyNotes (55+ screens)
      - MyJournal (21 screens): redesign 17 mobile and 4 web screens per `docs/uiux-prompts/myjournal.md`
      - MyMood: redesign all screens per `docs/uiux-prompts/mymood.md`
      - MyNotes (26 screens): redesign 14 mobile and 12 web screens per `docs/uiux-prompts/mynotes.md`
      - Apply accent #A78BFA (journal), module accent (mood), #64748B (notes)
      - Preserve all existing journaling, mood tracking, and note-taking functionality

    - [x] 4.11.e UI/UX redesign: MyPets + MyCar (44 screens)
      - MyPets (17 screens): redesign 13 mobile and 4 web screens per `docs/uiux-prompts/mypets.md`
      - MyCar (27 screens): redesign 19 mobile and 8 web screens per `docs/uiux-prompts/mycar.md`
      - Apply accent #F97316 (pets) and #3B82F6 (car)
      - Preserve all existing pet care and vehicle management functionality

    - [x] 4.11.f UI/UX redesign: MyFlash + MyStars (56 screens)
      - MyFlash (20 screens): redesign 14 mobile and 6 web screens per `docs/uiux-prompts/myflash.md`
      - MyStars (36 screens): redesign 23 mobile and 13 web screens per `docs/uiux-prompts/mystars.md`
      - Apply accent #8B5CF6 (flash) and #A78BFA (stars)
      - Preserve all existing flashcard and astrology functionality

    - [x] 4.11.g UI/UX redesign: MySurf + MyTrails (62 screens)
      - MySurf (30 screens): redesign 21 mobile and 9 web screens per `docs/uiux-prompts/mysurf.md`
      - MyTrails (32 screens): redesign 21 mobile and 11 web screens per `docs/uiux-prompts/mytrails.md`
      - Apply accent #3B82F6 (surf) and #65A30D (trails)
      - Preserve all existing surf session and trail tracking functionality

    - [x] 4.11.h UI/UX redesign: MyHomes (48 screens)
      - Redesign all 38 mobile and 10 web screens per `docs/uiux-prompts/myhomes.md`
      - Apply accent #F59E0B, glass morphism cards, Cool Obsidian tokens
      - Preserve all existing home/property management functionality

    - [x] 4.11.i UI/UX redesign: MyVoice + MyPresence (22 screens)
      - MyVoice (11 screens): redesign all screens per `docs/uiux-prompts/myvoice.md`
      - MyPresence (11 screens): redesign all screens per `docs/uiux-prompts/mypresence.md`
      - Apply accent #EF4444 (voice) and #0891B2 (presence)
      - Preserve all existing voice memo and mindfulness functionality

    - [x] 4.11.j UI/UX redesign: MyForums + MyMarket (48 screens)
      - MyForums (30 screens): redesign 13 mobile and 17 web screens per `docs/uiux-prompts/myforums.md`
      - MyMarket (18 screens): redesign 17 mobile and 1 web screen per `docs/uiux-prompts/mymarket.md`
      - Apply accent #7C4DFF (forums) and #14B8A6 (market)
      - Both are Supabase-backed: preserve cloud data layer and offline caching
      - Preserve all existing community and marketplace functionality

  - [ ] 4.12 Checkpoint: User Experience phase
    - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Phase 5: Observability and Performance (R4, R12, R18)
  - [ ] 5.1 Integrate Sentry error reporting
    - Create `apps/mobile/lib/sentry.ts` with @sentry/react-native initialization and source map upload config
    - Create `apps/web/lib/sentry.ts`, `apps/web/sentry.client.config.ts`, `apps/web/sentry.server.config.ts` with @sentry/nextjs
    - Wire Sentry into mobile and web ModuleErrorBoundary.componentDidCatch
    - Wire into DatabaseProvider error handler and self-host API global error handler
    - Add context tags: moduleId, screenName, hubMode, platform, enabledModules count
    - Implement PII scrubbing via beforeSend hook (strip email, user IDs, session tokens)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 5.2 Write property test for PII scrubbing (Property 10)
    - **Property 10: PII scrubbing in error reports**
    - For any error context with email, userId, or session tokens, beforeSend strips all PII
    - **Validates: Requirements 4.6**

  - [x] 5.3 Establish performance baselines
    - Create `docs/performance/BASELINE.md` with targets: cold start <3s, Lighthouse >=90, LCP <2.5s, DB ops <100ms, bundle <500KB gzipped
    - Create `scripts/benchmark-db.ts` for automated DB operation timing (insert, query, update, delete)
    - Measure and document all baselines
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [x] 5.4 Ensure migration safety
    - Verify transaction wrapping per module migration batch in `packages/db/src/`
    - Ensure hub_schema_versions tracking prevents duplicate execution
    - Implement failed module migration isolation: disable module, log error, continue
    - Add migration progress state to DatabaseProvider with loading indicator if >1 second
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_

  - [ ]* 5.5 Write property tests for migration safety (Properties 18-20)
    - **Property 18: Migration execution correctness** -- Validates: Requirements 18.1, 18.2, 18.5
    - **Property 19: Migration failure isolation** -- Validates: Requirements 18.3
    - **Property 20: Migration transactional safety** -- Validates: Requirements 18.6

  - [ ] 5.6 Checkpoint: Observability and Performance phase
    - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Phase 6: Release Operations (R7, R15, R16, R22)
  - [ ] 6.1 Configure EAS Build and app store submission
    - Verify `apps/mobile/eas.json` has development, preview, and production profiles
    - Create `apps/mobile/store-metadata/` with screenshots, descriptions, keywords per platform
    - Add privacy policy URL, age rating, and content rating to store metadata
    - Create `docs/release/RELEASE_CHECKLIST.md` covering build, test, stage, submit, monitor, rollback steps
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ] 6.2 CI/CD and release operations
    - Verify `.github/workflows/ci.yml` runs typecheck, lint, test, parity on every PR
    - Ensure `pnpm audit --audit-level high` step is in CI (from task 1.6)
    - Add staging deployment workflow for web (Vercel preview or equivalent)
    - Create `docs/release/INCIDENT_RESPONSE.md` with triage, communication, resolution runbook
    - Create `docs/release/ROLLBACK.md` with mobile (phased rollout revert) and web (redeploy previous) procedures
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

  - [ ] 6.3 Cloud module operational readiness
    - Ensure staging and production Supabase project configurations in `supabase/`
    - Add environment-based Supabase client selection in `packages/db/src/supabase-client.ts`
    - Audit all Supabase tables for proper RLS enforcement for cloud modules (forums, market, surf, workouts)
    - Implement offline degradation: cached data or "offline" message on network failure
    - Document rate limits, failure runbooks, and migration procedures per cloud module
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5_

  - [ ] 6.4 Final checkpoint: Release readiness
    - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation per phase
- Property tests validate the 26 correctness properties defined in the design document using Vitest + fast-check
- Unit tests validate specific examples and edge cases
- The 6 phases are dependency-ordered: Phase 1 unblocks Phases 2-3, Phase 2 unblocks Phase 4, all phases feed into Phase 6
- All code is TypeScript; all new files use .ts/.tsx
- Brand name abstraction (BRAND_NAME constant) is included in Phase 1 to support potential rebrand (R15)
