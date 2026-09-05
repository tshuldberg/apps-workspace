# TrainWithRyan: product, code, history, and feature review

**Review date:** September 5, 2026. **Reviewer:** Codex, using the research-app workflow. **Project:** `/Users/trey/Desktop/Apps/TrainWithRyan`. **Review and implementation checkout:** `/Users/trey/Desktop/Apps-wt-twr-product-review`, branch `feature/twr-coach-review`. **Reviewed baseline:** `238c6fb`, including Claude's committed bughunt and body-chart work. This document records a local review, not a deployment or launch certification.

## Assessment

The product's purpose is to extend Ryan's personal coaching beyond the time he spends physically with a client. Ryan's library and expertise in mobility, strength, fascia, and yoga are the distinctive assets. The essential experience is: Ryan understands the client, prescribes appropriate work, the client performs and records it, Ryan sees the result and responds, and the next prescription reflects what happened.

The current code is substantially stronger at **performing and recording a workout** and **exchanging a form-check video** than at closing that entire coaching loop. There is a substantial local training engine, private media infrastructure, account handling, subscriptions, and useful regression coverage. However, the cloud entities for assignment, client intake, messaging, scheduling, live tracking, check-ins, and full session reporting do not exist in the reviewed migration chain. The two experiences are therefore still connected mainly by library access and form checks.

My recommendation is to organize the remaining feature work around that coaching loop, retaining all seven feature areas in the locked build plan. A bigger exercise toolbox or another visual redesign would contribute less than making one assigned session travel correctly from Ryan to a client and back to Ryan with feedback and progress.

**Implemented in this review:** an actionable, oldest-first form-check queue on Ryan's dashboard, with exact counts, direct links to existing private review screens, bounded network work, independent section errors, request cancellation, and protection against stale/account-switched responses. The implementation uses existing tables and authorization policies; it introduces no new sharing or telemetry.

## Scope and evidence limits

This review covers the repository-wide structure and route inventory, all reachable local Git history, the inherited DoWork lineage, all database migration files as an inventory/security-contract review, the six edge-function surfaces, cloud data access, account boundaries, the main workout and media paths, packaging, tests, documentation, and product feature coverage. The companion [source inventory](/Users/trey/Desktop/Apps-wt-twr-product-review/docs/reviews/2026-09-05-source-inventory.json) records every inventoried file, line count, test classification, and exported declarations. The [route and history appendix](/Users/trey/Desktop/Apps-wt-twr-product-review/docs/reviews/2026-09-05-review-appendix.md) lists every route module and the complete local commit timeline.

Depth is explicit: all files were inventoried and searched; manual implementation review concentrated on product routes and data/security boundaries. This is **not a claim that every line of all 99,007 non-test code lines received a formal audit**, nor that passing mocked tests proves production behavior. Vendored hub utilities and unrelated theme presets received structural/dependency review rather than equal manual scrutiny. No authenticated real-client records were inspected. No production data, provisioning secrets, or other session's working files were changed.

I did not run the native application on an iPhone or Android device, conduct a two-account live backend test, verify current hosted legal pages, or re-certify the September 1 provisioning record. The successful exports are JavaScript/assets bundle exports, not signed native store builds. These limits matter especially for voice/audio contention, offline media, push delivery, and Realtime features that are not implemented.

### Verified baseline inventory

| Item | Observed |
|---|---:|
| Inventoried text/code/config/document files | 638 |
| Non-test TS/TSX/JS/MJS/SQL files | 382 |
| Lines in those non-test files, including comments and tooling | 99,007 |
| Expo route modules | 60, including 3 layouts and forwarding/tab wrapper modules |
| App route code | 30,113 lines |
| Cloud data modules at the baseline | 29 |
| SQL migrations | 34 |
| Cloud tables declared by the chain | 23 |
| Edge functions | 6 |
| Vendored workspace packages | 7 |
| Commits reachable across local refs at discovery | 74 |
| Commits reachable from the reviewed baseline | 58 |
| Baseline suite | 190 test files, 3,113 passing tests |
| Suite with this implementation | 193 test files, 3,149 passing tests |

The old planning figures of 75 screens, 19 tables, and approximately 1,200 tests describe an earlier DoWork inventory. They should not be reused as current TrainWithRyan facts. The 3,113 baseline total already includes 309 edge-function tests; adding another 309 double-counts them.

## Product intent and success criteria

The locked source is [the build plan](/Users/trey/Desktop/Apps-wt-twr-product-review/docs/plans/twr-build-plan.md). TrainWithRyan is independent from MyLife and DoWork. Vendored packages retain `@mylife/*` names but resolve locally. No runtime synchronization or feature parity with MyLife is required.

| Person | Job the app should complete | Evidence of success |
|---|---|---|
| Ryan, before a session | Understand goals, limitations, and recent progress; decide what to prescribe | Intake and prior results visible alongside the assigned program |
| Client, at the gym/home | Know exactly what to do today and how Ryan wants it done | One primary action opens the correct assigned session with relevant videos and targets |
| Client, during training | Record actual work without fighting the phone | Sets, holds, rests, substitutions, notes, and effort survive interruptions |
| Ryan, after training | Identify who needs a response and give useful coaching | Review queue, session report, check-in, and timestamped form feedback converge on the client |
| Both, over weeks | See whether the prescribed work is happening and helping | Adherence tied to real assignments; progress appropriate to the discipline and consent |

The dashboard queue added here advances Ryan's after-training job immediately. It does not pretend to supply the absent session reports or general messaging.

The single-trainer model, client-circle sharing, one library subscription, active-client library access, private signed video, and store-reported prices remain locked decisions. Pricing and Ryan's credentials/brand copy remain founder/Ryan decisions. This review does not invent them.

## Git history and Claude reconciliation

### Development lineage

1. **Upstream history:** MyLife's workout lineage reaches back to the February 24 foundation. March added previous-performance and training features. July's DoWork commits established the trainer media, subscription, push, coaching, and offline-download stack, followed by repeated audits. Examples: `4b1347f7` offline downloads, `f264e8a4` push delivery, `fdf942ea` usable live-session starting state, `9b0a1596` production-audit remediation, and `3bf222d0` further hardening. This inherited breadth explains why the young standalone already contains so much code.
2. **August 29, `0c02b2a`:** standalone scaffold and single-trainer plan. `a9e0c2e` extracts DoWork; `7afcba6` rebrands; `1c1e4ad` converts marketplace behavior; `867282d` adds an isolation/security integrity gate.
3. **August 29–30:** many hardening waves address entitlement, storage signing, idempotency, account changes, notification delivery, SQL grants, units, and route pollution. The history itself is evidence that static-looking completion repeatedly hid runtime and boundary problems.
4. **September 1, Claude's branch:** `fba0080` records the multi-sweep bughunt, `b1a8a06` adds anatomical charts and trainer-first navigation, `df6eafe` updates visual documentation, and `238c6fb` records provisioning.
5. **This review:** adds the coach review queue and a reconciled feature/readiness assessment on an isolated branch based on those four Claude commits.

The standalone extraction copied files; the preceding DoWork history is in the MyLife repository rather than represented as ordinary ancestors of every copied file. The upstream timeline is included separately in the appendix.

### Current branch hazard

At discovery, the primary checkout was `main` at `b322006`. The bughunt and voice/billing worktrees were at `238c6fb`. Their common ancestor is `4abc1db`. `git rev-list --left-right --count main...238c6fb` reports **13 commits unique to main and 4 unique to the Claude baseline**. The voice/billing worktree had 16 unmerged paths, including the session-adjacent screens, provider, database exports, and logs. Main had uncommitted test typing/instruction work. No Git remote is configured.

This means neither “use the latest timestamp” nor “take Claude's branch wholesale” is a safe integration rule. For example, main has the stricter public-key role check in `scripts/check-build-env.mjs`; the Claude baseline still accepts an `authenticated` JWT. The branch names and commit dates are not a readiness ranking.

| Claude work | Disposition in this review |
|---|---|
| Committed bughunt (`fba0080`) | Included in baseline; reviewed as existing work and exercised by the full suite |
| Anatomical charts / trainer-first refocus (`b1a8a06`) | Included; retained. New work complements the trainer-first direction |
| Screen-review HTML (`df6eafe`) | Used as historical presentation evidence, not proof of device execution |
| Backend provisioning record (`238c6fb`) | Incorporated as dated evidence, clearly separated from current live verification |
| Voice/billing worktree's unresolved merge | Inspected for scope and conflicts; left untouched and not treated as finished code |
| Main's uncommitted test typing work | Left untouched; no competing root test-configuration rewrite |

**Integration handoff:** the focused dashboard/data/helper/test commit is `c788411` (`feat(coaching): make pending form checks actionable from dashboard`). Reconcile main's later security/identity/GPS changes with the four Claude commits in the owning integration session, retaining both sets of relevant behavior. Then apply the focused dashboard commit if it is not already in that ancestry and run all gates again. Do not merge this branch into main solely because its isolated tests pass. The appendix records the main-only commits for that reconciliation.

## Architecture review

### Runtime structure

- `app/`: Expo Router screens. Root layout contains an error boundary; the authenticated subtree composes database, cloud, theme, and notification providers. The route subtree remounts when the account identity changes.
- `providers/DatabaseProvider.tsx`: Expo SQLite adapter, WAL, explicit foreign keys, versioned migrations, reset of database and media cache. Local training data lives here.
- `providers/TwrCloudProvider.tsx`: Supabase client with secure session storage; anonymous boot, profile/role resolution, identity transition handling, queue hydration/flush, and push-token lifecycle. Its asynchronous responsibilities make it a critical integration file.
- `data/`: Supabase reads/writes, media signing/finalization, entitlement, purchases, downloads, notification preferences, and pending operation persistence. The common result shape separates errors from valid emptiness.
- `lib/`: workout/session adapters, display rules, body geometry and heat interpretation, voice state/grammar, GPS, and other testable decisions.
- `components/`: coach profile/dashboard, studio, body charts, and shared controls. `theme/tokens.ts` holds standalone brand tokens; vendored UI tokens provide shared foundations.
- `packages/workouts`: local schemas/CRUD, training state machine, progression, recovery, generation, CSV functions, and UI exports. Other vendored packages supply database/auth/UI/module infrastructure.
- `supabase/`: database authority for client relationships, media entitlement, purchases, and circle content. No mesh transport dependency exists.

The data boundary is appropriate: the app's cloud cache does not become the authority for entitlements, while private workouts and photos remain local by default. The missing reporting layer must extend that contract through explicit consent and client-link authorization rather than uploading everything because a coach relationship exists.

### Data and endpoint responsibilities

| Surface | Existing authority / endpoint | Review conclusion |
|---|---|---|
| Identity | Supabase Auth plus `dw_user_profiles`; secure local session storage | Working code; identity race and migration regressions require integrated tests |
| Trainer role | Single active `dw_trainers` row and bootstrap RPC via `dowork-redeem-invite` | Server-owned role is the correct boundary |
| Roster | `dw_client_links`; invite redemption RPC | Real invites and active/ended relationships; no full client profile/intake model |
| Review loop | `dw_form_checks`, `dw_form_feedback` | Real private video and timestamped feedback; actionable dashboard added here |
| Media upload | `dowork-upload-finalize`, private staging/promoted objects | Server-created/finalized records; signing alone must never mean upload success |
| Media playback | `dowork-playback-url` | Rechecks entitlement and participant identity; signs private paths |
| Billing | `dowork-rc-webhook`, purchase ledger, subscriptions, earnings RPC | Significant handling of replay/transfers/refunds; final product/store configuration remains separate |
| Notifications | `dowork-notify`, prefs, token/outbox/delivery tables | Three product types: new video, form check, form feedback; absent features have no new push path |
| Deletion | `dowork-delete-account`, cascade/storage cleanup plus local reset | Must be extended for every future table/bucket and reverified with main-only fixes |
| Local training | SQLite `wk_*` schemas and workout engine | Rich implementation; does not produce a private cloud session report today |
| Community | Shares/comments/likes/reports/blocks inside Ryan's circle | Existing product exception; distinguish this from private coach communication |

### Security and privacy findings

**Strengths observed:** private video buckets; signed playback; server-side role and entitlement checks; finalized-upload filtering; operation IDs for retryable writes; explicit account scoping for downloads; separate unavailable/revoked/offline states; on-device voice requirements; camera/microphone permission copy distinguishes local recognition from deliberately uploaded form-check audio; all 23 declared cloud tables are covered by the integrity gate's RLS checks.

**Limits:** the 3,816-line integrity script includes many source/contract assertions. These are useful regression alarms, but their pass is not a live RLS proof. The edge-function tests inject stores and execute handlers under Vitest; they do not exercise the deployed gateway, JWT settings, storage, and PostgREST together. The repository also has a live SQL verification script, but its default selects the first running `supabase_db_*` container. In a multi-project workspace that can verify the wrong database. Use an explicitly identified target and fix default selection before relying on it.

Sensitive intake and trainer-private notes need different RLS policies/tables. Progress-photo and measurement sharing must remain separate opt-ins. A client link must not silently turn the existing local database into a cloud export. No analytics SDK or telemetry was added in this work.

## Feature inventory

“Implemented” below means code paths exist and were reviewed/tested locally; it does not mean real-device or production acceptance is complete.

| Feature | Current state | Gap or next improvement |
|---|---|---|
| Anonymous start, email/password, magic links, recovery | Implemented | Reconcile callback and identity fixes across branches; test cold links on device |
| Role-specific tabs | Implemented | Role-resolution failures must never select a guessed client/coach shell |
| Ryan profile, subscribe/join states | Implemented | Populate approved real identity, credentials, media, and store product |
| Coach invitations, roster, end/reactivate link | Implemented | Intake, goals, private notes, discipline tags, and client detail absent |
| Coach review dashboard | **Improved here** | Oldest 12 pending finalized checks, exact total, direct review actions; additional items enter after review |
| Form-check upload and timestamped feedback | Implemented | Real-device retry/expired-url/video-reply round trip still needs acceptance |
| Video upload, queue, metadata, publish/hide/delete | Implemented | Bulk discipline/tag editing and collections absent |
| Video player, resume, PiP, signed URL refresh | Implemented | Device audio/PiP interruption verification remains necessary |
| Hands-free and push-to-talk voice | Implemented | Real on-device recognizer/audio session testing; coordinate with voice/billing session |
| Offline video downloads and storage management | Implemented | Revocation, 401, offline-open, account swap, interrupted download device tests |
| Exercise library, search, favorites, history rail | Implemented | Discipline-first discovery and verified links into Ryan's actual library |
| Workout builder and supersets | Implemented | Link prescriptions to immutable assignment versions |
| Timed sets/holds and rest timers | Implemented | Timed per-set reporting and flow/side representation need richer persisted records |
| Workout logging, completion, repeat | Implemented | No assignment-linked cloud completion/report |
| Previous performance and progression targets | Implemented | Carry coach-prescribed targets and actual outcome separately |
| Per-set set-type selection | **Partial** | Draft label is visible but not supplied to persisted set-weight records; see finding R5 |
| Per-set target/actual RIR | **Absent** | No complete field-to-session-to-history path |
| Local programs/plans, schedules, covers | Implemented | Local plan subscription is not Ryan assigning a cloud program to a client |
| Ryan program assignment / Today from Ryan | **Absent** | Four planned program/assignment tables and executable assignment bridge missing |
| Measurements and progress photos | Implemented locally | Explicit sharing and Ryan-facing trends absent |
| Body charts, recovery, volume visualization | Implemented, including Claude improvements | Estimated/group-derived data must keep uncertainty labels; refresh and query horizons need scrutiny |
| History, streaks, monthly insights | Implemented with window disclosures in several screens | Use database aggregates for lifetime claims; avoid reintroducing page-derived totals |
| CSV export | Package functions exist | Not exposed in the app; validate totals before adding the action |
| GPS activity | Foreground tracking implemented | Background continuity intentionally not promised; retain main's abandoned-route fixes |
| Quick Workout generation | Local rule/scoring engine | Keep described as a convenience; it is not Ryan's individualized prescription or a medical assessment |
| Circle sharing, comments, likes, reports, blocks | Implemented | Retain client-circle boundary and explicit share action; avoid prioritizing social breadth over coaching |
| General messaging | **Placeholder** | No `dw_messages` or app Realtime channel implementation |
| Scheduling and availability | **Placeholder** | No availability/booking schema, booking UI, concurrency handling, or reminders |
| Live coach monitoring | **Absent** | No live event/session schema, durable replay, broadcast, or presence |
| Check-ins and shared session reports | **Absent** | No `dw_checkins`/`dw_session_reports`; no adherence denominator from assignments |
| Watch app | Protocol types only | No native watch target found; do not count protocol tests as a shipped watch feature |
| Store distribution and legal | Partly prepared | App Store app ID placeholder, product/legal/brand decisions, device acceptance remain |

## Findings requiring action

### R1. The core coaching loop is not implemented end to end — high product priority

The migration inventory contains none of the 15 planned tables for client profiles/notes, programs/assignment, messages, live events/sessions, bookings/availability, collections, session reports, or check-ins. `session.tsx` completes the local record and navigates to save/share; it does not post an assignment-linked private report. This is a code gap, not merely a backend provisioning task. Complete the locked feature contracts and test the two-person loop.

### R2. Branch divergence can discard already-fixed security behavior — high integration priority

Main-only waves 23–27 include account, push, receipt transfer, SQL ownership, session units, and GPS changes. The Claude branch contains independent improvements based on an older ancestor. A concrete difference is the public-key role allowlist mentioned above. The unresolved other worktree is not a tested integration result. Maintain a reconciliation checklist by behavior and prove the combined tree after merge; source-level “take ours” resolution is insufficient.

### R3. Dashboard counts required work but did not provide a review queue — fixed here

The old dashboard displayed pending totals and linked only to Clients and Library. Ryan then had to find the right client and expand that client's form checks. It also fetched all checks separately for every active client. The new queue turns the pending total into immediately actionable work, ordered oldest first, without downloading video or note bodies.

### R4. Dashboard totals and request lifecycle were fragile — fixed here

The old count was calculated from returned pages and unbounded per-client fan-out. One failure hid the entire dashboard, and overlapping focus/refresh requests had no generation guard. The new data layer uses exact HEAD counts for the three roster statuses and one limited inner-join review query, plus at most one name lookup. Roster/review errors are independent. Missing counts and invalid metadata fail explicitly. Screen requests are aborted on replacement/leave; generations and identity-keyed snapshots reject stale results.

### R5. Set-type controls are not durable and RIR is absent — high training-data priority

`lib/workouts/session-drafts.ts` stores `setLabel` in component drafts. `session.tsx` records weight, reps, unit, and estimated 1RM, without writing that label to the persisted set row. The completed-set state and `buildSessionCompletion` do not establish durable per-set type/RIR history either. Thus a user can choose Warmup/Drop/Failure but later analysis cannot reliably distinguish it. Add actual set type, target/actual RIR, and timed duration to a versioned per-set record, including resume, history, export, and report serialization. Keep old records as unknown where the information was never recorded.

### R6. Export exists below the UI and its totals need reconciliation — medium data priority

`exportWorkoutHistoryCSV` is exported from the package but no app screen calls it. It sums `repsCompleted` once per completion entry. The session-completion path can store the last set's reps for a partial exercise rather than the sum of all sets. Therefore wiring an Export button alone risks producing inconsistent totals. Export from canonical per-set records, identify incomplete/legacy data, then offer the user's full-history export and separately consented coach export.

### R7. Recovery and some analytics still depend on finite read windows — medium correctness priority

Recovery reads 120 completed sessions and a 500-exercise page, then uses local memoization. Other history surfaces use bounded windows, sometimes with helpful disclosures. The home page already demonstrates better time-window and aggregate queries. Apply that approach consistently and refresh retained routes on focus. Do not turn an unresolved exercise or excluded history into “never trained,” “fully recovered,” or lifetime zero.

### R8. The dependency audit reports eight production-tree advisories — high maintenance priority

A fresh `pnpm audit --prod --json` reported four high and four moderate advisories, zero critical. They affect four packages, not eight distinct packages:

| Dependency at baseline | Location / exposure assessment | Advisory and remediation evidence |
|---|---|---|
| `postcss` 8.4.49 | Expo/Metro build tooling; no user-CSS processing surface found in the app | Four advisories. Audit recommends at least 8.5.23 for the combined set. [Source-map disclosure advisory](https://github.com/advisories/GHSA-r28c-9q8g-f849) |
| `image-size` 1.2.1 | Metro asset parsing; treat untrusted build assets as an exposure boundary | Two parser denial-of-service advisories; audit supplies no patched release range. [JXL/HEIF advisory](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq) |
| `uuid` 7.0.3 | `xcode` through Expo config tooling; actual vulnerable-buffer call path not proven here | Buffer bounds issue; audit recommends 11.1.1+, a major-version jump. [Advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq) |
| `decode-uri-component` 0.2.2 | `query-string` through React Navigation/Expo Router; malformed-link parsing deserves runtime investigation | Exponential decoding issue; audit recommends 0.5.0+. [Advisory](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) |

These are registry findings, not evidence that a client has been exploited. The exposure statements are inferences from dependency paths and app surfaces. I did not force major overrides into the framework stack. Resolve them through compatible patched dependencies/upstream changes, test malformed-link handling, and rebuild both platforms. Preserve the remaining advisories in the launch ledger rather than declaring the dependency tree clean.

### R9. Live verification can target the wrong local project — high validation priority

`scripts/verify-live-db.mjs` chooses the first container whose name starts with `supabase_db_`. That selection is unsafe as evidence in this multi-app workspace, even when the SQL rolls back. Select the exact configured project/container or require an explicit connection. This review did not execute that ambiguous default against an arbitrary running database.

### R10. Release and CI evidence is incomplete — high release priority

No remote or `.github/workflows` directory is configured in this repository. `eas.json` retains `REPLACE_WITH_ASC_APP_ID`. The September 1 record says the backend/functions and EAS environment were provisioned, but it also lists remaining store/product/push tasks. Legal documents still contain operating-entity/date/business placeholders. Local export success cannot close these gaps. The plan's R1–R8 ledger needs dated evidence and working URLs, not historical completion language.

### R11. Tests are broad but not equivalent to device coverage — medium validation priority

The tests include many valuable pure-rule/property cases and handler tests. Several route tests inspect source strings, while render tests use DOM stand-ins for React Native. Root typechecking excludes test directories. Main already has another session's uncommitted test-type work, which should be integrated rather than duplicated. Keep the 36 behavioral tests added here, then prioritize real identity, media, assignment, and device-interruption paths over growing source-string assertion counts.

### R12. Module size and inherited breadth increase change risk — medium maintainability priority

The session screen is 1,640 lines, the form-check screen 1,213, the coach profile 1,371, the upload function 2,163, and workouts CRUD 2,256. The vendored DB and module-registry packages contain substantial hub functionality outside the product's main purpose. Extract stateful operations and reusable data decisions when modifying these areas, following the existing `lib/` approach. Avoid a wholesale package rename or removal exercise while the core coaching features remain unbuilt.

## Improved feature plan

This is a dependency order for completing the existing full product mandate, not permission to ship missing locked functionality.

### 1. Establish the client and prescription contract

Build FA-1 client profile/intake and separate trainer-private notes. Collect goals, movement history, preferred training schedule, equipment, and limitations only for the declared coaching purpose. Let Ryan see what the client submitted and when; do not interpret a blank response as “no limitations.” Keep each sharing category opt-in.

Build FA-2 cloud programs with strength sets, timed holds, and flow blocks. Use immutable published versions or assignment snapshots so editing a template does not rewrite the historical prescription. Store local calendar dates and an explicit scheduling timezone, distinguish rest, skipped, moved, and completed slots, and preserve substitutions/adjustments visibly. Duplicate-tap assignment and completion writes need stable operation IDs.

**Acceptance:** Ryan assigns a program; the invited client sees the correct day; the client changes device/timezone or reconnects; the prescribed version and position remain correct. Editing Ryan's template does not alter a completed session's targets.

### 2. Complete the session and reporting round trip

Build FA-7 reports together with the assignment execution adapter. A local completion is immediate and durable; a private cloud report is a separate idempotent queued operation with visible pending/failed/sent state. Persist actual reps, load/unit, duration, set type, RIR, notes, and assignment position. Never mark unconfirmed draft work as successfully synced. Use a stable session/assignment identity for replay.

Ryan's client view should compare prescribed versus completed work and display unavailable data explicitly. Adherence needs a real assignment denominator. Bodyweight, yoga, mobility, and fascia should have useful time/consistency/subjective outcomes rather than being judged only by kilograms lifted. Recovery estimates remain informational and should not imply diagnosis or medical clearance.

**Acceptance:** force-quit after local save but before network acknowledgement; reconnect; exactly one report reaches the correct coach. Repeated uploads, ended links, account changes, and revoked sharing do not leak reports or lose local history.

### 3. Make Ryan's video library usable at its actual scale

Complete FA-6 discipline/tag metadata, collections, bulk editing, and stable ordering. Treat exercise/video linkage as a first-class relationship. Surface Continue watching and videos for today's prescription. Keep downloaded state separate from current entitlement and completed-workout state separate from watched-video state.

**Acceptance:** a large mixed-discipline library can be organized without editing every video individually; retrying a batch does not duplicate records; a collection reorder remains stable across refresh; premium/video URLs remain private and server authorized.

### 4. Bring coaching communication into one place

Complete FA-3 participant-scoped messaging with durable message identity and text retries. Connect form checks and session reports into the same thread as references, with access rechecked when opened. Define read acknowledgements and unread counts explicitly. Respect notification opt-in and deduplicate push versus in-app activity; an offline client should see a queued message, not a successful send.

The review queue built here should evolve into an action list for pending forms, unanswered check-ins, and report follow-ups. Only add categories when real records and action destinations exist. Do not invent “at risk” client labels from missing data.

**Acceptance:** two accounts exchange a message with disconnect/reconnect and token/account changes; no duplicate, falsely read, or cross-client messages occur. Feedback is accessible from both the queue and the thread.

### 5. Close scheduling and live-coaching workflows

Complete FA-5 availability, booking transitions, timezone display, reminders, and cancellation reasons. Prevent double booking with a database constraint/transaction, not only a disabled button. Reminder jobs must be idempotent and respect changes to booking time/status and notification preferences.

Complete FA-4 after assignment/session/report identity is stable. Use the locked durable events plus Realtime transport contract. Every event needs replay/order semantics; “live” requires real presence and recent transport evidence. Ryan's target adjustment applies only to remaining work and leaves the original prescription/audit trail available.

**Acceptance:** concurrent booking requests cannot claim the same slot. Reconnecting to a live session replays a complete event sequence; out-of-order/duplicate broadcasts do not double-log sets; a disconnect visibly ends the current-live claim. Both participants can see what Ryan changed.

### 6. Validate the complete product with Ryan

Use a real coach account and at least two client accounts on physical devices, with approved sample content. Verify intake, assignment, timed/strength logging, offline recovery, library access, form feedback, messaging, bookings/reminders, live cues, consent revocation, account deletion, and subscription restoration as one continuous scenario. Include denied permissions, expired credentials, interrupted upload, background/resume, and a second account on the same phone.

The operational measure should be whether Ryan can confidently run his client workflow inside the app. Suggested measurement definitions are time from a submitted form check to the first actual coach response, completed prescribed sessions divided by eligible assigned sessions, and successful report delivery after local completion. Derive them from existing authorized records; do not silently add analytics collection to obtain them.

### Competitive context

Trainerize documents integrated programming, messaging, progress, habits, and compliance tied to scheduled workouts. Everfit documents programming, tasks, check-in forms, and client submissions. These establish relevant workflow expectations, not a reason to copy every feature. TrainWithRyan's opportunity is Ryan's instruction, the quality of feedback, and low-friction performance of his programs. [Trainerize features](https://www.trainerize.com/features/), [Trainerize compliance definition](https://help.trainerize.com/hc/en-us/articles/360022256632-Measuring-Client-Engagement-and-Compliance), [Everfit tasks and habits](https://help.everfit.io/en/collections/2863885-tasks-habits), [Everfit workout builder](https://help.everfit.io/en/articles/4620515-workout-builder-overview).

## Implementation details and validation

### Changed runtime files

- [CoachDashboard.tsx](/Users/trey/Desktop/Apps-wt-twr-product-review/components/coach/CoachDashboard.tsx): oldest-first review actions; separate roster/review failures; usable Clients/Library shortcuts; request cancellation, generation guard, identity-keyed rendering, and recovery of the refresh indicator.
- [cloud-coach-dashboard.ts](/Users/trey/Desktop/Apps-wt-twr-product-review/data/cloud-coach-dashboard.ts): exact roster counts, an inner-join pending/finalized/active-client query limited to 12 items, bounded profile lookup, response validation, explicit errors, and 15-second read timeout. Five requests when names are needed, four for an empty queue; request count is independent of active-client count. This is a code-path bound, not a measured latency claim.
- [review-queue.ts](/Users/trey/Desktop/Apps-wt-twr-product-review/lib/coaching/review-queue.ts): readable exercise labels and honest elapsed-wait labels, including invalid/future dates.

The query uses documented Supabase exact counts and nested relationship filtering. Existing row-level policies remain authoritative; the filters are additional scoping rather than client-only authorization. [Supabase select/count documentation](https://supabase.com/docs/reference/javascript/select), [relationship query documentation](https://supabase.com/docs/guides/database/joins-and-nesting).

### New behavior tests

- 17 data tests use the actual Supabase client/query builder against controlled HTTP responses. They assert exact-count headers, active-coach join filters, finalized/pending filtering, stable oldest-first ordering, page limit, metadata-only projection, partial errors, missing/contradictory counts, invalid identities/rows, absent/failed profiles, and timeout behavior.
- 10 mounted React interaction tests prove review navigation, independent failures, retry, verified-empty display, bounded-page copy, refresh ordering, identity change, completed-review removal, unexpected rejection recovery, and cancellation on leave.
- 9 label tests cover minute/hour/day boundaries, invalid timestamps, future clock skew, and exercise labels.

These tests do not emulate RLS or prove live PostgREST execution. The existing database authorization suite and a correctly targeted two-account backend test remain required for final release verification.

### Commands actually run

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile --offline` | Passed; no dependency/lockfile changes |
| Baseline `pnpm typecheck` | Passed |
| Baseline `pnpm test` | 190 files, 3,113 tests passed |
| New focused tests | 36 passed |
| Final `pnpm typecheck` | App, functions, and vendored packages passed |
| Final `pnpm test` | 193 files, 3,149 tests passed |
| `pnpm check:integrity` | Passed before and after changes |
| `CI=1 pnpm build` | iOS and Android exports succeeded |
| `git diff --check` | Passed |
| `pnpm audit --prod --json` | 8 advisories: 4 high, 4 moderate; recorded as unresolved |

Tests by project in the final run: app 1,701; workouts 638; functions 309; database 226; auth 141; module registry 90; UI 29; errors 15. Total 3,149. The standalone has no `gate:function:changed` script; its applicable app/package/function checks above were used. No MyLife runtime code or registration was changed.

Raw command logs and bundle output remain temporary/ignored. No generated performance dump was added to tracked documentation.

## Documentation and handoff

The README has a useful project definition, commands, and architecture summary, but its status line predates several committed improvements. PROJECT_LOG and the prompt chain provide unusually rich history, yet they mix dated test counts, proposed work, code-complete claims, and deployment evidence. Keep one current capability matrix distinguishing implemented, tested locally, verified on device, and verified in the deployed backend. Preserve the historical logs rather than rewriting them as current truth.

The focused code and documentation live in the isolated checkout linked above. The other session's files and unresolved merge remain intact. This review's product conclusion is that TrainWithRyan has a substantial foundation and a clear purpose, with concrete remaining work to make Ryan's prescription, the client's execution, and Ryan's response form one dependable system.
