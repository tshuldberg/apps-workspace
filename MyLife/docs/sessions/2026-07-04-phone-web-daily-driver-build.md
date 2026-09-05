# Session: Phone + Web Daily Driver Build (Sprint from the 2026-07-03 Function Eval)

**Date:** 2026-07-04
**Branch:** `feature/phone-web-daily-driver` (worktree off main `3c8b41f5`, unpushed)
**Source plan:** `docs/reports/REPORT-mylife-function-eval-phone-web-2026-07-03.html` Section 7 (founder said "begin building", phone + web first)

## Commits (7)
1. `ee7100ff` fix(nutrition): read real wk_ workout tables in cross-module data bridge. TDD: 4 regression tests red against `wo_sessions`, green after the union of `wk_workout_sessions` + `wk_workout_logs`.
2. `01bb1adc` fix(web): remove fabricated social content from the workouts feed. Deleted 3 fixture athletes, fixture posts, fake reactions/comments on the user's own sessions, fabricated follower counts and memberSince; social page copy now states device-local honestly; segment tabs removed.
3. dashboard v2 feat(web): Today cards for workouts (train-today/trained), meds (doses left/all taken via regimen engine), nutrition (first-meal prompt/goal progress), dining (tonight's reservation + wishlist); nutrition + dining gained crossModule wiring; TODAY_MODULES 7 -> 12 (manhattan's existing provider now included); `savePrimaryClustersAction` + TodayFocusEditor (web can finally edit `today.primary_clusters`); real evening workout nudge in the reminders tray. 15 new module tests.
4. PWA feat(web): app/manifest.ts (standalone, obsidian theme), ImageResponse favicon + 180px apple-touch-icon, SVG manifest icons (any + maskable), viewport-fit=cover + safe-area insets on mobile header/drawer/main. Verified live: manifest + both icon routes 200, full head tag set injected.
5. macro loop feat(web): "I cooked this" on recipe detail drives `recipeToNutritionRule` (transactional nu_food_log + pantry decrement; mirrors receipt-to-budget wiring); Online tab on /nutrition/search backed by keyless Open Food Facts (Save + Add persists to nu_foods; ODbL attribution; FatSecret/USDA honestly unwired, and `modules/nutrition/src/api/fatsecret.ts` is permission-denied by local settings); workouts CSV export (history + set weights, formula-injection guarded) with buttons on /workouts/history; nutrition getCorrelationData (90d calories+protein) + NUTRITION_MODULE added to INSIGHTS_MODULES.
6. Training + Fuel feat(web): /training-fuel report composing trained days (sessions + quick logs), calories/protein vs goal, dose adherence over 7/30 days with summary tiles; disabled modules absent, unlogged days render dashes (no invented numbers). Linked from Today. Verified live 200 on both ranges.
7. `eaa808e2` Manhattan depth feat(web): search; category/when/price filter axes with mobile AND-across/OR-within semantics via real taxonomy engines; Save persists feed events to mh_events (idempotent) so they hit the Today card; manual add ("Added by you"); local rows merged into the feed with saved reconciliation. SeatGeek still honestly disconnected (founder-ops proxy).

## Verification
- Per-commit: `pnpm gate:function:changed` green each time (module suites + web 54 files/376+ tests), `pnpm --filter web typecheck` clean, `pnpm check:parity` exit 0 at close.
- Live probing on :3200 (worktree dev server): /manifest.webmanifest + /icon + /apple-icon 200 with head tags; /training-fuel 200 both ranges with honest empty states; /manhattan 200.
- NOT done: interactive browser QA of the new UI states (clicking save/filters/cooked button in a real browser with data) and a production `next build`. Both should run before merge; noted per the eval-review lesson about dev-only verification.

## Founder-ops still open (from the eval, unchanged)
- SeatGeek proxy deploy (live-music unlock for Manhattan).
- The hosted single-tenant deploy decision (track b of phone access); PWA polish (track a) shipped this session.

## Notes
- Worktree used because the primary checkout carried another session's mid-flight Meerkat work.
- The two eval bugs are logged Resolved in errors_log.md on this branch; the primary checkout's uncommitted Unresolved rows should be reconciled at merge.

## QA pass + production build (same day, pre-merge)

Founder asked for the QA pass, prod build, and merge-if-safe. Production build + interactive browser QA against `next start` (chrome-devtools MCP, fresh worktree DB) found and fixed 3 more defects (commits `873d5d26`, `78d6a83a`):
1. Fresh-database prerender crashes: car/closet/flash/journal/pets route groups queried module tables without ensureModuleMigrations (~70 pages). Fixed at module layouts (shop/sleep pattern) + journal per-page + pets action.
2. Static prerender baked the builder's database into 422 routes; `/` permanently redirected to onboarding in prod. Fixed with root-layout `force-dynamic` (correct for a live local-SQLite app); static pages 483 -> 23.
3. `manhattan` missing from the web migrations registry (mh_ tables never created on web; Save/manual-add dead) + the Save button swallowed failures. Both fixed; save/manual-add live-verified.

QA flows verified on the production server: full onboarding (pledge -> goals -> starter kit), dashboard v2 cards (workouts Train-today, nutrition first-meal), focus editor round-trip persisted (body, social, outdoor), OFF live search (19 results) -> Save + Add -> diary -> Today card flipped to "85 kcal logged" -> Training + Fuel report shows 85 kcal today with honest dashes, Manhattan feed (60 live events) + search (60 -> 2) + 3-axis filters + save (Saved/Unsave) + manual add ("Added by you"), workouts social honest empty state (no fixtures), true 390px iPhone emulation (no horizontal overflow, hamburger drawer works). Only console error all session: pre-existing CSP block on the Material Symbols font (logged Unresolved).

Merge verification: full `pnpm test` 127/129 green with @mylife/mobile killed by the documented OOM contention (exit 137) and green in isolation (58 files/185 tests); web typecheck clean; `pnpm check:parity` exit 0; prod build 483/483.
