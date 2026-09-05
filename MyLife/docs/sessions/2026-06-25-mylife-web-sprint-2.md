# MyLife improvement Sprint 2 (web connective tissue)

Date: 2026-06-25
Branch: feature/mylife-improvements-sprints
Orchestration: ultracode orchestrator + plain-Opus implement -> adversarial-review pipelines (Workflow), MEDS-SUPP fix via a focused Opus agent; orchestrator verifies + commits. Dependency honored: REMIND-INTAB + DN-NU-JOIN in parallel (disjoint files), then MEDS-SUPP after REMIND-INTAB.

## Tickets

### REMIND-INTAB - commit (in-tab reminder layer)
apps/web/components/RemindersProvider.tsx (new) + reminders-data.ts (new server action) + apps/web/app/layout.tsx. App-wide client provider: route-persistent Notification-permission prompt (generalized from the sleep pattern) + persistent "due now" tray. reminders-data reads real due-today meds doses via getRegimenSummary (gated on meds enabled, try/catch to []). Workout/walk sources are honestly-empty placeholders (render nothing). Copy states closed-tab and background push are NOT supported on web. Adversarial review PASS. Verified: broad route probe all 200 (app-wide mount breaks nothing).

### DN-NU-JOIN - commit f1038be5 (dining <-> nutrition + real map)
modules/nutrition/src/integrations/dining.ts (pure bridge, mobile-safe) + apps/web/app/dining/{actions.ts,dish/add,map}/page.tsx + a dining-bridge test. Dish form gains Calories/Protein/Carbs/Fat + a "Log macros for this meal" toggle calling logMealMacrosFromDishes, which persists a real nu_food_log + nu_food_log_items (verified by a real-persistence test). /dining/map replaced placeholder with a real interactive slippy map: server-proxied OSM raster tiles as data URIs (CSP-compliant, no key), Web-Mercator pan/zoom/fit, clickable pins, OSM attribution; geocode-on-add/import via Nominatim wired into CSV + Google-Maps import. Adversarial review PASS. @mylife/nutrition 195 tests.
NOTE: the plan claimed maplibre-gl was "already a dependency" but it is ABSENT from the repo (0 hits anywhere). Delivered a keyless data-URI tile map instead (adding maplibre-gl would need lead-owned package.json + middleware CSP changes). Flagged as a follow-up if maplibre rendering is specifically wanted.

### MEDS-SUPP - commit 5a4ee5e3 (supplement tracker) [was FAIL, fixed]
apps/web/app/meds/medications/page.tsx + apps/web/app/meds/actions.ts + modules/meds/src/{reminders/scheduler.ts, engine/regimen-summary.ts, medication/crud.ts} + 2 meds test files. Quick-add gains time-of-day (timeSlots) + Prescription/Supplement toggle; createMedicationExtended auto-creates md_reminders so getRegimenSummary.todaySchedule populates a real "Due today" checklist (also feeds the REMIND-INTAB tray); take logs against the canonical slot and decrements supply; a "Supplements" group separates creatine from the prescription registry; regimen-summary status matching hardened for ad-hoc takes.

ADVERSARIAL REVIEW CAUGHT A REAL BLOCKER the implementer under-disclosed: MEDS-SUPP moved the supply decrement INTO logDose, but both mobile take handlers (apps/mobile/(meds)/(tabs)/index.tsx, medications.tsx) already call decrementPillCount() after logDose() -> 2x supply depletion on mobile. FIX (via a focused Opus agent, then orchestrator-verified): reverted logDose to insert-only; added a single status-gated decrementPillCount to the web take action (doLogDoseV2), matching mobile's existing explicit-decrement pattern; mobile untouched (still one decrement). Added tests locking the no-double-decrement contract + the regimen-summary fallback matching. @mylife/meds 337 tests pass.

## Barrier gates (orchestrator-run, combined tree)
- pnpm --filter web build: exit 0, 478/478 pages (RNW + the app-wide RemindersProvider all build)
- pnpm --filter web typecheck: clean
- pnpm gate:function:changed: 0 errors, 95 warnings (one fewer than Sprint 1; cleaned a dead expression)
- @mylife/meds 337, @mylife/nutrition 195, web 376
- pnpm check:parity: green
- Broad route probe (incl. /, /discover, /settings, /meds, /dining/map, /dining/dish/add, /mood, /workouts, ...) all 200; no dev-log runtime errors

## Verification gap (honest)
Interactive Playwright click-through (take a dose -> due-today done + supply decrement + tray; submit a dish macro log; pan the map) could not run: the Playwright MCP browser profile was locked by a concurrent :3000 session. Covered instead by HTTP 200 + source-confirmed feature UI/copy + comprehensive unit tests (incl. real-persistence and no-double-decrement contracts) + adversarial review. Recommend a later live click-through when the browser is free.

## Cleanups
- Removed a dead parseCuisines call + its orphaned function in dining/map/page.tsx.
- Removed an unused getActiveReminders import in reminders.test.ts.

## Remaining
- Sprint 3 (L, headline): MANH-WEB (NYC live-music/events discovery on web), SYNC-REAL (real secure cross-device sync, then Meerkat). Founder-ops flagged: SeatGeek proxy/client-id (MANH-WEB), 2-device sync QA (SYNC-REAL).
- Follow-ups: optional maplibre-gl swap for the dining map; reconcile .skip'd @myfast-web passthrough parity when MyFast is restored/retired; pass autoCreateReminders from mobile add-med to preserve its reminders opt-out.
