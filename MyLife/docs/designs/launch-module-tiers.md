# Launch Module Tiers

## Tier Definitions

| Tier | Criteria | Visibility | Module Count |
|------|----------|-----------|-------------|
| **Launch** | 88%+ complete, mobile + web functional, all buttons work | Fully visible + enabled by default (free) or in Discover (premium) | 19 |
| **Beta** | 50-87% complete, core flows work, some gaps | Visible with "Beta" badge, in Discover only | 6 |
| **Hidden** | <50% complete, scaffolding or missing core functionality | Not visible in app until promoted to Beta | 4 |

## Module Classification

### Launch Tier (19 modules) -- Ship in v1.0

These modules are 88%+ complete and represent the core value proposition.

| # | Module | Completeness | Tier (Free/Premium) | Mobile | Web | Key Gaps to Close |
|---|--------|-------------|---------------------|--------|-----|-------------------|
| 1 | Budget | 95% | Premium | Full | Fallback | Build web UI |
| 2 | Fast | 95% | Free | Full | Full | Minor polish |
| 3 | Books | 95% | Premium | Full | Full | Recommendation engine (P1) |
| 4 | Journal | 100% | Free | Full | Full | Print partner API (P3) |
| 5 | Workouts | 92% | Premium | Full | Fallback | Rest timer (P0), build web UI |
| 6 | Meds | 92% | Premium | Full | Full | BP logging improvements (P0) |
| 7 | Voice | 92% | Free | Full | Full | Minor polish |
| 8 | Recipes | 92% | Premium | Full | Fallback | Build web UI |
| 9 | Nutrition | 90% | Premium | Full | Full | Restaurant menus (P1) |
| 10 | Mood | 90% | Free | Full | Full | PIN/biometric lock (P1) |
| 11 | Notes | 90% | Free | Full | Full | Checklists (P1), daily notes (P1) |
| 12 | Habits | 90% | Premium | Full | Full | Fix migration bug first! |
| 13 | Cycle | 90% | Premium | Full | Full | Temperature tracking (P1) |
| 14 | Flash | 88% | Premium | Full | Full | Rich media cards (P1) |
| 15 | Surf | 88% | Premium | Full | Fallback | Multi-region (P1), build web UI |
| 16 | RSVP | 85% | Premium | Full | Fallback | Calendar sync (P0), build web UI |
| 17 | Words | 85% | Premium | Full | Full | Saved words persistence (P1) |
| 18 | Closet | 100% | Premium | Full | Fallback | Build web UI |
| 19 | Health | 99% | Premium | Full | Partial | HealthKit native wiring |

**Pre-launch work for Launch tier:**
- Fix habits migration bug (period_id) -- BLOCKER
- Build real web UI for: Budget, Workouts, Recipes, Surf, RSVP, Closet (currently fallback stubs)
- Close all P0 gaps: rest timer (workouts), BP logging (meds), calendar sync (RSVP)

### Beta Tier (6 modules) -- Visible with badge

These modules have core functionality but significant gaps. Users can try them with the understanding they're in active development.

| # | Module | Completeness | Tier | Key Gaps |
|---|--------|-------------|------|----------|
| 19 | Pets | 70% | Premium | Feeding schedules, grooming log, walk logging |
| 20 | Car | 65% | Premium | Maintenance reminders (P0), cost per mile, document storage |
| 21 | Stars | 60% | Premium | Friend compatibility, transit tracking, AR sky |
| 22 | Homes | 60% | Premium | Maintenance reminders (P0), appliance manuals, inventory |
| 23 | Trails | 50% | Premium | Offline maps (P0), weather overlay, trail database |
| 24 | Forums | 50% | Free | Real-time updates, media sharing, user profiles |

### Hidden Tier (4 modules) -- Not visible until promoted

These modules are early-stage. Showing them hurts the product perception.

| # | Module | Completeness | Tier | Status |
|---|--------|-------------|------|--------|
| 25 | Garden | 40% | Premium | Fix migration bug first! Then: AI plant ID, disease diagnosis |
| 26 | Market | 90% | Free | Backend complete (7 subsystems). Needs: UI screens, cross-module listing integration |
| 27 | Mail | 30% | Premium | Needs: full IMAP, search, threading, filters |
| 28 | Subs | 20% | Premium | Being absorbed into Budget module |

## Launch Readiness Checklist (per module)

Before a module can be in Launch tier, it must pass ALL of these:

- [ ] All migrations run cleanly on fresh install
- [ ] All buttons/links navigate to functional screens (no dead routes)
- [ ] Mobile: all tab screens render with real data
- [ ] Web: real page (not ModuleWebFallback) for all primary routes
- [ ] At least 5 unit tests passing
- [ ] No P0 gaps remaining in competitive matrix
- [ ] Cool Obsidian theme applied consistently (no light theme leaks)
- [ ] Empty states handled (new user with no data sees helpful message, not blank screen)
- [ ] Error states handled (network failure, db error shows user-friendly message)
- [ ] Module accent color correctly applied in headers/accents

## Promotion Path

```
Hidden → Beta: Core flows work, primary screens render, no crashes
Beta → Launch: 88%+ complete, all P0 gaps closed, web UI built, checklist passes
```

## Free Tier Strategy for Launch

**Free modules at launch (5 of 7):** Fast, Journal, Mood, Notes, Voice
**Free modules deferred to Beta:** Forums (50%), Market (90%)

Forums is at 50% and deferred until trust infrastructure and UI are built. Market is at 90% (backend complete, UI needed) -- promote to Launch tier once UI screens are built and pass the Launch Readiness Checklist.

## Web UI Build Priority

6 Launch-tier modules currently use ModuleWebFallback on web. Priority order for building real web UI:

1. **Budget** (95% complete, highest market impact, most users care about web for finance)
2. **Workouts** (92%, web UI is valuable for reviewing workout history on desktop)
3. **Recipes** (92%, cooking mode works best on tablet/desktop with larger screen)
4. **RSVP** (85%, event management is naturally a desktop activity)
5. **Closet** (100%, wardrobe browsing and outfit planning benefit from large screen)
6. **Surf** (88%, forecast viewing works well on desktop)
