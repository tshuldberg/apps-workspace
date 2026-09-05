# DoWork Adversarial Production Readiness Audit

- **Date:** 2026-07-11
- **App:** DoWork standalone (`apps/dowork/`) — invite-only trainer + workout platform on `@mylife/workouts`
- **Method:** 8 parallel adversarial auditors (7 Claude Sonnet zone-auditors + 1 Claude Sonnet deep bug-hunt; a gpt-5.5/Codex hunt was quota-blocked and replaced). Orchestrated by the Fable lead, who independently verified every P0/P1 against source.
- **Baseline gates at audit time:** typecheck clean, 375 app tests pass, 540 `@mylife/workouts` tests pass, `check:dowork-parity` passes. **The problems are not at the gate surface** — they are silent-data-loss bugs, an unenforced deploy invariant, runtime correctness gaps, and store-submission blockers.

> **Remediation status (2026-07-11, same day):** every code-addressable finding in this report (P0 through P3) was closed on `feature/dowork-production-readiness` with regression tests; gates green (518 app tests, 556 module tests, full parity). See `docs/plans/done/46-dowork-production-readiness-remediation.md` for the closure record. The NO-GO below is the audit-time snapshot; the remaining launch gate is founder-ops only (F1-F8: deploy, ASC record, RevenueCat products, legal hosting, keys, TestFlight QA, icon art).

## Verdict: NO-GO for public launch

**Overall readiness: 6/10.** DoWork's substrate is genuinely well built — real RLS with no exploitable bypass, real full-cascade account deletion, real UGC moderation wired to every surface, honest server-truth monetization, and no fake-success stubs anywhere in the tree. That is above-average for this audit style and means the app is *close*.

But it cannot ship today. Two independent code paths on the flow **every user hits after every workout** silently lose data (the Save button does nothing; ending a session drops the in-progress set). The entire edge-function auth model rests on a deploy-time invariant nothing in the repo enforces. And the binary cannot be submitted at all without an app icon and an iOS privacy manifest. Fix the P0 set and the P1 set below and this is a GO.

### Scorecard by zone

| Zone | Score | Headline |
|------|-------|----------|
| Backend security / RLS / entitlement | 8/10 | Logic is solid; the risk is an unenforced deploy invariant (BK-1) |
| Monetization / RevenueCat | 8/10 | Server-truth is correct; one real revenue bug on cancellation (MN-1) |
| App shell / providers / migrations | 8/10 | No races, safe migrations; 5 core screens unregistered (SH-1) |
| Client data / offline / downloads | 6/10 | Honest by design; KV race loses download index + in-memory social queues (DL-1, CG-2) |
| Runtime: voice / player / push / GPS | 5/10 | Honest states, but permanent voice lockout, multi-device push wipe, URL-refresh race |
| Workout flows (screens) | 4/10 | Two P0 silent-data-loss bugs on the universal post-workout path |
| Legal / trust-safety / store | 6/10 | Excellent UGC + legal substance; blocked on icon + privacy manifest |
| Completeness / honesty | 8/10 | Claims hold up; social offline queues overstated, real polish debt remains |

---

## P0 — Launch blockers

### BH-2 (P0) — "Save Workout" button does nothing; public-share intent silently lost
`apps/dowork/app/(root)/save-workout.tsx:30-36`. `handleSave` and `handleDiscard` are byte-for-byte identical — both just `router.back()`. **Verified in source.** The screen captures title, description, and a Private/Everyone visibility choice, then throws all of it away. After completing any workout the user lands here, titles it, picks "Everyone" to share publicly, taps **Save** — and nothing is titled, nothing is shared, no annotation persists. (The raw session *is* persisted upstream by `completeWorkoutSession`, so history is intact; what is lost is the title/notes and the public share the user explicitly asked for.)
**Fix:** Wire `handleSave` to persist title/notes against the session and, when visibility is "Everyone", call `uploadWorkoutShare` (already implemented, with offline queue) using a summary built from the session id via `buildWorkoutSummary` + `getSetWeightsForSession`. Effort: M.

### BH-1 (P0) — Ending a session mid-set silently discards the current set's weight/reps
`apps/dowork/app/(root)/session.tsx:510-529` + `417-454`. **Verified in source.** `recordSetWeight` is called only inside `handleCompleteSet` (on "Mark Complete"). `handleEndWorkout → finalizeSession` calls `completeWorkoutSession` and never flushes the current draft. Type a weight/reps, tap **End Workout** → confirm, and that set is never written to `wk_workout_set_weights` — invisible to history and 1RM tracking, with zero warning.
**Fix:** In `finalizeSession`, flush any draft with `weight>0 && reps>0` via `recordSetWeight` before completing (or warn in the confirm dialog). Effort: S.

### BK-1 (P0) — No deploy-time enforcement that DoWork edge functions verify the JWT signature
`supabase/functions/_shared/broker.ts:147-159`; `supabase/config.toml`; missing `apps/dowork/scripts/deploy-functions.sh`. `getUserIdFromAuth` decodes the JWT `sub` with `atob`/`JSON.parse` and **no signature check** — every one of the 6 `dowork-*` functions trusts the Supabase gateway to have verified the signature first (`verify_jwt = true`). None of the 6 functions appear in `config.toml`, and unlike BestChef, DoWork has **no deploy script** pinning the flag and **no post-deploy canary**. A single `--no-verify-jwt` copy-paste at the manual F1 deploy step opens full account takeover (forge `{"sub": "<victim>"}`, call `dowork-delete-account` / `dowork-playback-url` as anyone) with no code-level trace.
**Fix:** Add `[functions.dowork-*] verify_jwt = true` entries to `config.toml` for all 6; add `apps/dowork/scripts/deploy-functions.sh` mirroring BestChef's; add a forged-JWT→401 smoke test; update the F1 runbook. Effort: S.

### LG-1 (P0, founder-ops) — No app icon or splash image configured
`apps/dowork/app.json` has only `splash.backgroundColor`; no `icon`, no `adaptiveIcon.foregroundImage`, no `assets/`. EAS build falls back to the default Expo icon; App Store Connect and Play Console both reject binaries without a real icon. Tracked as founder-ops F8. Effort: M (art + wiring).

### LG-2 (P0) — No iOS Privacy Manifest (`PrivacyInfo.xcprivacy`)
None generated by `withSecurityHardening.js`/`withDataProtection.js` and none on disk. The app uses required-reason APIs (SecureStore/UserDefaults, SQLite file-timestamps) and bundles RevenueCat + Supabase SDKs. ASC now performs an **automated** manifest check at binary processing — this rejects *after* a successful build, an easy-to-miss failure on submission day.
**Fix:** Add a privacy manifest via config plugin declaring UserDefaults + file-timestamp reason codes, `NSPrivacyTracking: false`, and `NSPrivacyCollectedDataTypes` matching the privacy policy; verify RevenueCat/Supabase pod manifests are present. Effort: M.

### LG-3 (P0, founder-ops) — `ascAppId` placeholder blocks the submit pipeline
`apps/dowork/eas.json:26` still reads `"ascAppId": "REPLACE_WITH_ASC_APP_ID"`. `eas submit` fails until the founder creates the $4.99 ASC record and pastes the real id (founder-ops F2). Effort: S.

---

## P1 — High (fix before public launch)

- **MN-1** — Cancellation revokes paid access immediately instead of at period end. `dowork-rc-webhook/index.ts:37-43` maps `CANCELLATION → 'cancelled'`; entitlement policy (`20260703000001…:547-548`) requires `status = 'active'`, so a mid-period cancel locks the user out of content they paid for that same second. **Verified in source.** Fix: keep `status='active'` on `CANCELLATION` and let `current_period_end` expire it; only flip on `EXPIRATION`. Effort: S.
- **SH-1** — Five reachable screens are missing from the root `Stack` registration: `my-trainer`, `clients`, `client-invite/[code]`, `client-invite/index`, `form-check/[id]` (`(root)/_layout.tsx`). Expo Router still resolves them, so they render *outside* the parent `screenOptions` — white-flash + native header on exactly the trainer↔client coaching screens, the product's core differentiator. Fix: add 5 `<Stack.Screen>` lines. Effort: S.
- **DL-1** — Read-modify-write race on the `hub_settings` KV blob for the downloads index and pending queues (`downloads.ts:102-114`, `pending-queues.ts:57-63`); no transaction despite `DatabaseAdapter.transaction()` being available. Two downloads finishing together → one file's index entry is clobbered: bytes on disk, invisible to the user, never counted, never deletable (storage leak). Fix: wrap read+write in a transaction or move to per-row keys. Effort: M.
- **CG-2 / IMP-8** — Likes/comments/shares offline queues are **in-memory only** (`cloud-likes.ts`, `cloud-comments.ts`, `cloud-shares.ts` each carry a self-flagged TODO). Offline like/comment/share + force-quit = silently lost. (Form-check feedback correctly persists.) This makes CLAUDE.md's "H3 offline queues persist to KV" an overstatement. Fix: extend `pending-queues.ts` KV persistence to these three. Effort: M.
- **RT-6** — `runtimeError` from a transient `audio-capture` event (phone call, Bluetooth renegotiation) is **never cleared** (`useVoiceCoach.ts:212-222`), pinning voice control to `unavailable` — including the manual push-to-talk button — for the rest of the screen's life. Contradicts the file's own honesty rules (presents a transient state as permanent). Fix: clear `runtimeError` on next successful `start` / on foreground. Effort: S.
- **RT-7** — `removePushTokens` deletes **all** of a user's token rows (`push.ts:277-289`); sign-out or toggling notifications off on one device silently deregisters push on every other device. Fix: scope token rows by a device id. Effort: M.
- **RT-2** — Voice seek/rate commands read stale `duration` and can race `refreshExpiredSource`'s `player.replace()` on foreground (`player.tsx:426-475`), landing on the wrong timestamp or silently dropping while the toast claims success. Fix: gate commands on an `isRefreshing` ref (queue-and-replay). Effort: M.
- **RT-4** — Signed-URL expiry is only checked on `AppState → active`, never on a timer (`player.tsx:271-296`); a session left foregrounded past the 60-min window relies on the player erupting into an error, which expo-video does not guarantee. Fix: add a 60s `isExpired` poll. Effort: S.
- **RT-8** — GPS records foreground-only (correct on permissions), but nothing tears down the elapsed-time interval on background (`gps.tsx:208-232`); route time can drift out of sync with point coverage, skewing pace/speed. Fix: pause the timer on background via `AppState`. Effort: S-M.
- **BH-3** — Legacy plate calculator hides the valid "bar only" answer: `calculator.tsx:45-49` nulls the result when `target <= barWeight`, though `calculatePlates` handles it. Fix: guard on `<= 0`, matching `plate-loader.tsx`. Effort: S.
- **DL-2** — `clearAllPendingQueues` clears memory then persists; if the persist throws, stale prior-user queue survives on disk and rehydrates into the **next** signed-in user (cross-identity leak on a shared device). Fix: catch/retry/surface the persist failure. Effort: S.

---

## P2 — Medium

- **RT-1** — Resume-position rows in `hub_settings` grow unbounded (no prune on delete/revoke/close) (`player.tsx:317-337`), slowing every keyed lookup in a shared table. Prune on `deleteDownload`/`revoked`. S.
- **RT-15** — `ensureDownloadsDir()` is unguarded (`downloads.ts:260-263`) and `startDownload`'s `.then` has no `.catch` (`player.tsx:376-398`); a full disk → unhandled rejection → download UI stuck `active` forever, and cancel is a no-op (resumable never assigned). Wrap in try/catch + add `.catch`. S.
- **BH-6** — Superset duration estimate over-counts rest: `superset.tsx:126-129` sums `restAfter * sets` per slot instead of one shared rest cycle per round. Use `maxSets * restAfter`. S.
- **BH-5** — GPS pace is always per-km even when distance shows miles (`gps.tsx:377-383`); a miles user reads a min/km pace as min/mi. Add unit-aware conversion + label. S.
- **BH-4** — Two divergent 1RM/plate calculator screens (`calculator.tsx` vs `one-rm.tsx`+`plate-loader.tsx`), both reachable, drifting bugs (produced BH-3). Retire `calculator.tsx`, repoint the Toolbox link. M.
- **DL-3** — `hydratePendingQueues` validates only top-level array-ness, not item shape; a malformed persisted item replays `duration_seconds: undefined` to Supabase. Add per-item zod validation. S.
- **DL-4** — Offline retry cap counts flush cycles, not real retries; flaky gym wifi can burn the 5-attempt budget in seconds and silently drop a share/feedback with no user warning. Distinguish transient vs permanent; surface `failed>0`. M.
- **BK-2** — `dowork-notify` secret check uses non-constant-time `!==` and has no rate limit; a leaked secret = unlimited push spam / marketing blasts. Constant-time compare + coarse rate limit. S.
- **CG-3 / IMP-10** — Zero accessibility labels on `builder.tsx` and `session.tsx` (highest-interaction screens; long-press-to-increment is undiscoverable), while `trainer/[handle].tsx` has 11+. Apply the existing a11y pattern. M.
- **CG-4 / IMP-1** — `onboarding.tsx` never mentions "trainer" — new users have no guided path into half the product. Add a "Meet your coach" step. S.
- **LG-4** — Trainer "Verified" badge is self-issued on invite redemption (`dowork-redeem-invite:269` sets `is_verified: true`; guidelines say "verified"). Rename to "Invite-only"/"Approved" or add a real check. S (copy) / M (flow).
- **SH-2 / SH-3** — `index.tsx` opens SQLite and reads `hub_settings` before `DatabaseProvider` creates it (safe only by try/catch accident; second WAL-less handle); onboarding navigates via a `setTimeout(100)` that's a latency guess, not a completion signal. Clean both up. S.
- **CG-1** — No dedicated tests for `cloud-blocks.ts`, `cloud-reports.ts`, `launch-environment.ts`, `public-render-policy.ts`. Scaffold function-gate tests. S.
- **RT-9 / RT-12** — Cold-start push route push isn't gated on DB-readiness; download entitlement treats a 401 (stale session) as "offline." Gate on ready signal; special-case 401. S-M.

---

## P3 / polish and improvements

- **CG-5 / IMP-2** — No delete/edit for saved workouts or history sessions (every other list has delete-with-confirm). A bad log is permanent. S.
- **CG-6 / IMP-3** — No pull-to-refresh on Workouts/Explore/Progress/Programs (History/Clients/Exercises have it). S.
- **CG-7 / IMP-4** — No text search on the Explore exercise library (only chips). S.
- **CG-8 / IMP-5** — Premium trainer videos are hidden entirely from non-subscribers instead of shown as a locked teaser — a direct conversion lever left on the table. M.
- **CG-9 / IMP-6** — Voice control only wires into the video `player`, not into live `session.tsx` — the marquee "hands-free in the gym" pitch doesn't reach the moment it matters (mid-set). M.
- **IMP-9** — No "repeat last session" / duplicate-workout quick action; the single most common gym flow requires rebuilding by hand. S.
- **BK-3 / BK-4 / DL-6 / RT-10/11/13/14** — invite-RPC rate cap; report target validation; non-crypto uuid warning comment; push diagnosability; minor voice/toast polish. S each.

---

## Founder-ops (cannot be closed in code)

- **F1** — real `supabase db push` + deploy all 6 functions **through the new deploy script** (BK-1) + configure Database Webhooks (gates coaching push).
- **F2** — ASC $4.99 paid app + real `ascAppId` (LG-3).
- **F3** — RevenueCat 8-product ladder + webhook secret + EAS keys.
- **F4** — trainer revenue-split decision (earnings screen can't show real payouts until then).
- **F5** — host + counsel-review legal pages; confirm governing law + moderation SLA staffing (LG-5).
- **F6** — APNs/FCM keys. **F7** — TestFlight white-glove QA with the first trainer. **F8** — icon + splash art (LG-1).

## Bottom line

Fix the code-addressable P0s (BH-1, BH-2, BK-1 config+script, LG-2 manifest) and the P1 set, complete the founder-ops asset/deploy items (LG-1, LG-3, F-series), and DoWork is a defensible GO. The engineering foundation is strong; the gap is a small number of high-impact defects plus submission logistics, not a rewrite.
