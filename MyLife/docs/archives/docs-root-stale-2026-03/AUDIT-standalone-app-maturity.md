# Standalone App Maturity Audit

**Date:** March 3, 2026
**Scope:** All standalone app directories within `/Users/trey/Desktop/Apps/MyLife/`
**Purpose:** Assess production readiness for iOS App Store submission

---

## Executive Summary

**Total Apps:** 26
**MATURE (Production Code):** 10
**DOCS_ONLY (Design/Placeholder):** 16

### MATURE Apps Available for iOS Development
1. **MyBooks** — Near-ready (34 tests, splash screen)
2. **MyBudget** — Near-ready (116 tests, splash screen)
3. **MyCar** — Near-ready (52 tests, splash screen)
4. **MyFast** — In Progress (10 tests, splash screen)
5. **MyHomes** — Near-ready (12 tests, splash screen)
6. **MyRecipes** — Near-ready (36 tests, splash screen)
7. **MySurf** — Near-ready (25 tests, splash screen)
8. **MyVoice** — In Progress (no tests)
9. **MyWords** — In Progress (no tests)
10. **MyWorkouts** — Near-ready (38 tests, splash screen)

---

## Maturity Assessment

### MATURE Apps (10)

All MATURE apps have:
- ✓ `package.json` (runnable monorepo structure)
- ✓ `CLAUDE.md` + `AGENTS.md` (documented, agent-ready)
- ✓ `README.md` (user-facing documentation)
- ✓ TypeScript source code (140+ files per app on average)
- ✓ Test coverage (10-116 tests per app)
- ✓ Expo + Expo Router (cross-platform mobile/web)

#### Stack Consistency
All MATURE apps follow the Turborepo + Expo + Next.js pattern:
- **Mobile:** Expo (React Native) with Expo Router file-based routing
- **Web:** Next.js 15 (App Router)
- **Database:** SQLite (expo-sqlite mobile, better-sqlite3 web)
- **Validation:** Zod 3.24
- **Testing:** Vitest
- **Package Manager:** pnpm 9.x

#### iOS Readiness Details

| App | Tests | Splash | app.json | EAS | Tier |
|-----|-------|--------|----------|-----|------|
| MyBooks | 34 | ✓ | ? | ? | Near-ready |
| MyBudget | 116 | ✓ | ? | ? | Near-ready |
| MyCar | 52 | ✓ | ? | ? | Near-ready |
| MyFast | 10 | ✓ | ? | ? | In Progress |
| MyHomes | 12 | ✓ | ? | ? | Near-ready |
| MyRecipes | 36 | ✓ | ? | ? | Near-ready |
| MySurf | 25 | ✓ | ? | ? | Near-ready |
| MyVoice | 0 | ? | ? | ? | In Progress |
| MyWords | 0 | ? | ? | ? | In Progress |
| MyWorkouts | 38 | ✓ | ? | ? | Near-ready |

**Gaps for iOS App Store readiness:**
- [ ] Verify `app.json` exists and has iOS-specific metadata (bundle ID, version, etc.)
- [ ] Verify `eas.json` exists with EAS Build/Submit credentials
- [ ] Confirm app icons and launch screens are present
- [ ] Verify Info.plist entries (privacy strings, etc.) are properly configured
- [ ] Add tests for MyVoice and MyWords (currently 0 tests)
- [ ] Verify all apps have proper error handling and offline fallbacks
- [ ] Conduct QA regression testing before TestFlight

---

### DOCS_ONLY Apps (16)

These apps exist as design documents and specs but have **no runnable code**:

| App | Description |
|-----|-------------|
| MyCloset | Wardrobe + outfit planning |
| MyCycle | Period tracking |
| MyFlash | Flashcard learning |
| MyGarden | Garden planning + care log |
| MyHabits | Habit tracking (20 TS files, likely early scaffolding) |
| MyHealth | Health dashboard |
| MyJournal | Journal entries |
| MyMail | Mail integration |
| MyMeds | Medication tracking |
| MyMood | Mood/emotion tracking |
| MyNotes | Notes app |
| MyPets | Pet tracker |
| MyRSVP | Event RSVP (has 10 TS files + CLAUDE.md, closer to scaffolding) |
| MyStars | Rating/wishlist |
| MySubs | Subscription tracker |
| MyTrails | Hiking trail tracking |

**Status:** Design phase. No runtime code, no package.json, no native configurations.
**Priority:** Establish design requirements before allocating implementation resources.

---

## iOS Production Readiness Ranking

### Tier 1: Ready for Beta Testing (Post-Configuration)
These apps are closest to TestFlight submission pending configuration verification:
1. **MyBudget** (116 tests) — Highest test coverage
2. **MyRecipes** (36 tests)
3. **MyWorkouts** (38 tests)
4. **MyBooks** (34 tests)
5. **MyCar** (52 tests)

### Tier 2: Near-Ready (Minor Gaps)
6. **MyHomes** (12 tests) — Smallest test suite but well-structured
7. **MySurf** (25 tests)

### Tier 3: In Progress (Gaps to Address)
8. **MyFast** (10 tests) — Minimal test coverage
9. **MyWords** (0 tests) — No tests
10. **MyVoice** (0 tests) — No tests

---

## Critical Path to iOS Launch

### Phase 1: Configuration Verification (1-2 days)
For each MATURE app:
- [ ] Verify `app.json` has iOS-specific metadata (bundle ID, version, privacy strings)
- [ ] Verify `eas.json` exists with build/submit configuration
- [ ] Verify app icons (1024x1024) and launch screen are present
- [ ] Verify Info.plist has required privacy descriptors (camera, location, calendar, contacts, etc. per module)
- [ ] Run `eas build --platform ios --local` locally to verify build succeeds

### Phase 2: Test Coverage Expansion (2-3 days)
For apps with <15 tests:
- [ ] **MyFast:** Add 10+ tests (currently 10)
- [ ] **MyWords:** Add 15+ tests (currently 0)
- [ ] **MyVoice:** Add 15+ tests (currently 0)
- [ ] Target: 25+ tests per app minimum

### Phase 3: QA & Regression Testing (3-5 days)
- [ ] Test all 10 MATURE apps on iOS device/simulator
- [ ] Verify offline functionality (SQLite reads without network)
- [ ] Verify error handling (network failures, permissions, storage limits)
- [ ] Verify dark mode appearance
- [ ] Verify accessibility (VoiceOver, text scaling)
- [ ] Check for console errors and warnings
- [ ] Benchmark performance (cold start, list scrolling, search)

### Phase 4: TestFlight Beta (1-2 weeks)
- [ ] Submit Tier 1 apps (MyBudget, MyRecipes, MyWorkouts, MyBooks, MyCar) for internal testing
- [ ] Iterate on feedback
- [ ] Tier 2 apps (MyHomes, MySurf) follow

### Phase 5: App Store Submission (1 week per batch)
- [ ] Prepare marketing materials (App Store screenshots, descriptions)
- [ ] Submit first 3 apps (MyBudget, MyBooks, MyRecipes)
- [ ] Await review cycles (typically 24-48 hours)
- [ ] Publish in batches to avoid overwhelming support

---

## Dependency & Parity Considerations

### Hub Integration Status
All 10 MATURE apps are designed for integration into the MyLife hub (`modules/<name>/`). Verify:
- [ ] Standalone app modules have matching hub integration at `/Users/trey/Desktop/Apps/MyLife/modules/<name>/`
- [ ] Module exports `ModuleDefinition` contract
- [ ] Data models in standalone and hub are synchronized
- [ ] Run `pnpm check:parity` and `pnpm check:passthrough-parity` before launch

### Supabase Cloud Apps
Three apps use Supabase (cloud-backed):
- **MySurf** — spot data, forecast sync
- **MyWorkouts** — activity sync
- **MyHomes** — property data sync (Drizzle + tRPC)

Verify staging credentials and error handling for offline scenarios.

---

## File Ownership for Parallel iOS Implementation

For Agent Team-based development:

| Zone | Owner | Apps |
|------|-------|------|
| MyBudget | agent-1 | MyBudget (116 tests) |
| MyBooks/MyRecipes | agent-2 | MyBooks (34 tests), MyRecipes (36 tests) |
| MyWorkouts/MyHomes | agent-3 | MyWorkouts (38 tests), MyHomes (12 tests) |
| MySurf/MyCar | agent-4 | MySurf (25 tests), MyCar (52 tests) |
| MyFast/MyVoice/MyWords | agent-5 | MyFast (10 tests), MyVoice (0), MyWords (0) |
| QA & Config | lead | Cross-app iOS verification |

Agents can work on different apps in parallel without file conflicts. Sync points:
- After Phase 1: Configuration verified across all apps
- After Phase 2: Test coverage requirements met
- Before Phase 3: All apps passing typecheck + lint

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|-----------|
| Incomplete app.json/eas.json | High | Phase 1 config verification checklist |
| Insufficient test coverage | Medium | Target 25+ tests per app; focus on critical paths |
| Offline data sync issues | Medium | QA phase includes offline-mode testing |
| Privacy string compliance | High | Phase 1 includes Info.plist audit per app capabilities |
| Different builds between standalone/hub | Medium | Run parity checks before submission |

---

## Next Steps

1. **Immediately:** Run Phase 1 configuration verification (1-2 days)
2. **This week:** Complete Phase 2 test expansion for MyFast/MyVoice/MyWords
3. **Next week:** Begin Phase 3 QA testing with Agent Team
4. **Following week:** Submit Tier 1 batch to TestFlight
5. **Parallel:** Document DOCS_ONLY apps for future implementation prioritization

---

## Appendix: Full App Inventory

### MATURE Apps Summary (Source-Ready)
```
MyBooks       – 295 TS files | 34 tests | Tier 2
MyBudget      – 705 TS files | 116 tests | Tier 1 ← Highest readiness
MyCar         – 160 TS files | 52 tests | Tier 1
MyFast        – 140 TS files | 10 tests | Tier 3
MyHomes       – 145 TS files | 12 tests | Tier 2
MyRecipes     – 285 TS files | 36 tests | Tier 1
MySurf        – 217 TS files | 25 tests | Tier 2
MyVoice       – 69 TS files | 0 tests | Tier 3
MyWords       – 14 TS files | 0 tests | Tier 3
MyWorkouts    – 224 TS files | 38 tests | Tier 1
```

### DOCS_ONLY Apps (Deferred Implementation)
```
MyCloset, MyCycle, MyFlash, MyGarden, MyHabits, MyHealth, MyJournal,
MyMail, MyMeds, MyMood, MyNotes, MyPets, MyRSVP, MyStars, MySubs, MyTrails
```

---

*End of Audit Report*
