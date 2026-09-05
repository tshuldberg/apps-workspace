# DoWork audit fix waves (dp-audit-2026-07-04)

Branch: `feature/dowork-trainer-launch` (worktree `.claude/worktrees/dowork-trainer-launch`)
Input: `dp-audit-2026-07-04.md` (report-only audit at `495fb04b`, verdict 6.8/10: 1 Critical, 7 High, 9 Medium, 5 Low)
Mode: six fix waves in the audit's recommended order, one commit per wave, tests + parity green per wave.

## Wave 1 - account lifecycle (`c988442d`) - C1, H1

- `auth-callback.tsx` rewritten: parses PKCE `?code=` and implicit `#access_token` fragments (via `expo-linking` URL, fragment params never reach router params), exchanges into a real Supabase session (`exchangeCodeForSession` / `setSession`), confirms via `getSession`, routes `type=recovery` to a new `reset-password` screen. Honest error state with back-to-sign-in. Client now runs `flowType: 'pkce'`.
- New `reset-password.tsx`: new-password + confirm, `auth.updateUser`, registered in the Stack.
- New helpers in `data/account.ts` (`parseAuthCallbackUrl`, `completeAuthCallback`, `updatePassword`) with 12 new contract tests.
- `dowork-delete-account` now anonymizes `dw_purchase_events` in place (PATCH `user_id=null`, `raw={scrubbed}`) instead of leaving raw RevenueCat payloads keyed to the deleted user. Deleting rows would rewrite trainer earnings history; the retained columns hold no personal data. App Review notes state the retention policy.

## Wave 2 - paid/server truth (`a612c8a3`) - H2, H3

- Paid-through cancellation: entitlement now honors `status='cancelled'` with future `current_period_end` in FOUR places: new migration `20260704000002_dowork_entitlement_hardening.sql` (RLS select policy), `dowork-playback-url` (`hasPaidSubscription`), webhook subscriber count, and the client mirror `isSubscriptionActive`. Refunds carry `expiration_at_ms <= now` so they still revoke immediately. `UNCANCELLATION -> active` added to the webhook map.
- Active/verified trainer server enforcement: `dowork-upload-finalize` rejects sign + finalize for trainer videos when `is_active`/`is_verified` is false; `dowork-playback-url` requires a serving trainer for free/subscription/client-link paths; the RLS policy mirrors it. Explicit exceptions encoded: owner preview of own videos and private form-check participation survive deactivation.

## Wave 3 - coaching correctness (`87b29e84`) - H4, H5, H7, L4

- Migration `20260704000003_dowork_coaching_state.sql`: `dw_form_feedback` insert policy now requires an ACTIVE client link (`dw_form_feedback_participant(form_check_id, true)`); select stays historical. `dw_reports` check constraint gains `form_check` + `form_feedback` kinds.
- `postFormFeedback` classifies failures via `isTransientCoachingError`: transient transport errors queue with `queued: true`; permanent server verdicts return `queued: false` (UI keeps the draft and shows the real reason instead of a false "saved offline"). `flushPendingFeedback` drops permanently-rejected items immediately.
- Form-check screen: read-only ended state ("Coaching ended" explainer, composer hidden), report action on the check header (non-author) and on each received feedback row, `feedbackError` state renders a retryable error instead of a false "No feedback yet."

## Wave 4 - offline identity (`14298092`) - H6, M6

- `PendingShareItem.userId` records the enqueueing auth uid; `flushPendingShares` replays only on uid match, drops mismatched/legacy-unowned items (`dropped` count). Enqueue binds the current session uid.
- `DoWorkCloudProvider` clears all pending queues on an in-place auth user-id transition (anonymous -> email sign-in without sign-out).
- Push prompt answered state keyed per auth uid (`dowork.push_prompt.v1:<uid>`); the legacy un-keyed row is deliberately not trusted (its answerer is unknowable).

## Wave 5 - user-visible workflow (`6bfe2108`) - M1, M3, M5, M7, L1

- Save Workout is real: workouts module schema v7 (`title`, `notes` on `wk_workout_sessions`), new `updateWorkoutSessionMeta` + `deleteWorkoutSession` crud (exported through both barrels). DoWork Save persists meta and, on visibility Everyone, posts a real cloud share (volume computed from set weights, lbs converted). Discard confirms then deletes the session. Hub twin (`apps/mobile/(workouts)/save-workout.tsx`) saves meta + real discard and drops the visibility control it has no share layer for. Both session screens pass `sessionId` already; DoWork now also passes `durationSeconds`.
- Plan unsubscribe passed `activeSub.id` into a `WHERE plan_id = ?` helper on BOTH surfaces; now passes `planId`.
- `friendlyError` guards playback load errors, studio upload-queue errors, and account auth errors (action-specific fallbacks).
- `android.softwareKeyboardLayoutMode: "resize"` so the form-check composer is not hidden under the IME.
- Settings About DoWork row is a real action (version + guidelines/privacy/support links).

## Wave 6 - reliability/efficiency (commit hash below) - M2, M4, M8, M9, L2, L3, L5

- Voice restart policy: sessions that live >= `RESTART_HEALTHY_LIFETIME_MS` (1500ms) reset the restart budget, so normal Android ~2s silence turnover cycles forever while genuine rapid-fire loops still stop (3 new policy tests including a 50-cycle silence soak).
- Downloads: a markerless 403 (gateway/JWT/CORS layers) is now offline/unknown; only an explicit `{ error: 'not_entitled' }` deletes a local file (new regression test).
- Session screen (BOTH surfaces): real `expo-keep-awake` (dep added to apps/mobile), interval effect keyed on the state discriminator instead of the whole 200ms-mutating status object, dead "later pass" mic button removed.
- GPS: per-fix work is O(1) (append point locally + rolling distance/elevation/max-speed refs instead of re-querying all rows); final metrics computed from the full history at stop; `maxSpeedKmh` is the fastest valid GPS speed sample (was: equal to avg). Elevation chart draws only altitude-known points and shows an honest "Elevation unavailable" placeholder (was: null charted as 0 m).
- Virtualization (M9): exercises grid (DoWork + hub twin), trainer profile video lists, and Studio ManageGrid moved from ScrollView + `.map` to FlatList with memoized rows.
- Dead `DoWorkProvider` removed (unmounted from `_layout`, file deleted, parity script + docs updated).

## Verification

- Per-wave: `apps/dowork` tsc + full vitest suite, edge-function suites via `modules/bestchef` vitest config, `modules/workouts` tests + tsc, `apps/mobile` tsc, `node scripts/check-dowork-parity.mjs`, `check-workouts-parity`.
- Final counts recorded in the Wave 6 commit message.

## Remaining / not addressed (from the audit's excluded list)

Two-brand visual seams, ported-half a11y, builder-first funnel, block-list read filtering on trainer surfaces, deep RevenueCat price fallback, Expo SDK hoist skew, and all device-bound QA (voice, GPS, push, purchases) remain open, plus founder-ops (migrations `20260704000002/3` must be pushed and the three touched edge functions redeployed before the next build).

## Deploy notes (founder-ops)

- `supabase db push` must apply `20260704000002_dowork_entitlement_hardening.sql` and `20260704000003_dowork_coaching_state.sql`.
- Redeploy edge functions: `dowork-delete-account`, `dowork-playback-url`, `dowork-upload-finalize`, `dowork-rc-webhook`.
- Supabase Auth: the app now uses PKCE email links; no dashboard change needed (`dowork://auth-callback` already allow-listed), but recovery emails should be re-tested on device.
