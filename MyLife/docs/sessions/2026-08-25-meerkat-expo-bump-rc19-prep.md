# Meerkat controlled expo bump + rc19 prep, 2026-08-25

Continuation of the 2026-08-24 audit pass on `fix/meerkat-bug-audit-2026-08-24`.

## Outcome

The controlled expo patch bump landed and is fully verified, including a green
EAS iOS build on the bumped dependencies. rc19 is prepped to the founder line:
ledger notes authored, delta enumerated, cut procedure written. The two
remaining gates (GitHub Actions billing, merge+push of the branch) are both
founder decisions.

## Expo bump (commit `b89e361b`)

Method, per the 08-24 warning that a naive `pnpm update` breaks expo-router:

1. Edited only the three drifted pins in `apps/meerkat/package.json`:
   expo `~54.0.35 -> ~54.0.37`, expo-constants `~18.0.13 -> ~18.0.14`,
   expo-file-system `~19.0.23 -> ~19.0.24`. expo-router untouched at
   `~6.0.24`. Both meerkat native packages pin expo as peerDependencies with
   ranges 54.0.37 satisfies, so nothing else needed to move.
2. Plain `pnpm install` (6.7s). The ~990-line lockfile diff is mechanical
   peer-context re-keying (every dependent's snapshot key embeds expo's
   version); resolved versions verified via `require.resolve`: expo 54.0.37,
   constants 18.0.14, file-system 19.0.24, router 6.0.24 with
   `useLocalSearchParams`/`useRouter` present in `exports.d.ts`,
   @expo/metro-runtime 6.1.2. expo-notifications drifted 0.32.16 -> 0.32.17
   within its `~0.32.16` pin.
3. expo-doctor then showed one real regression: expo-notifications carried a
   nested expo-constants@18.0.13 beside the app's 18.0.14 (native-module
   duplicate). Fixed with a targeted `pnpm dedupe expo-constants` (that
   package only, never a bare `pnpm dedupe`), which unified expo-constants at
   18.0.14 workspace-wide (in range for every app's `~18.0.13` pin) and
   shrank the lockfile by a net 1,438 lines.

Result: expo-doctor 16/18 -> 17/18. The one remaining failure is the
duplicates check flagging a same-version expo peer-context split (two keyed
expo@54.0.37 lockfile instances), the pre-existing artifact of the inert RN
0.84.1 optional-peer lane (HEAD already had three keyed expo@54.0.35
instances). Cosmetic: same version, same bytes, no native-build conflict.

## Verification

| Check | Result |
|-------|--------|
| Meerkat app suite | 148 files / 1,510 tests green |
| Meerkat app typecheck | clean |
| Other Expo apps (mobile, bestchef, dowork, yearn, mynews, manhattan) typecheck | all clean after the workspace expo-constants dedupe |
| `check-meerkat-parity` + `check:esm-require` | green |
| Full `check:parity --quiet` aggregate | green |
| expo-doctor | 17/18 (residual = pre-existing cosmetic split above) |
| EAS iOS build, `testflight` profile | `4e355d3e-051c-4572-80a4-42fe9c6cb2a6` FINISHED, .ipa produced, from the branch tip |

The EAS build is a dependency-verification build, not a tester build (RC key
and relay URL not baked). No function logic changed in this session, so the
function gate had nothing to check beyond the pre-commit pass.

## rc19 prep

- Ledger notes authored:
  `docs/releases/meerkat/rc19-audit-branch-ledger-notes.md` (input to the
  cut, rc17-notes pattern): gates, cut procedure, full rc18 -> merge delta
  (main had already moved ~30 commits past rc18 with TestFlight prep and the
  first-green-build burn-down; this branch adds 11 more), evidence table,
  honesty constraints.
- GitHub Actions billing: UNCONFIRMED. No workflow run since the 2026-08-01
  billing-cancelled batch; the repo token cannot read billing endpoints and
  all dispatchable workflows are release/deploy machinery, so no safe probe
  exists without a push. Founder checks github.com/settings/billing.
- The cut itself: founder merges + pushes the branch, creates the rc dir at
  the merge SHA (supersedes `meerkat-2026-08-01-rc18` @ `43a357a3`), and
  dispatches release-verify with `$(git rev-parse <merge sha>)`.

## Bookkeeping

- errors_log Expo Doctor row updated in place (stays Mitigated: doctor is
  17/18, residual cosmetic split documented).
- memory.md: 24 July session rows archived to
  `docs/archives/memory-sessions-2026-07.md` to restore the 80-line budget;
  tech-debt row updated (branch now 11 commits, bump DONE, remaining =
  founder gates); session row added.

## Remaining (unchanged from 08-24 handoff)

- Deferred WebRTC MED/LOW hardening (reuse `call-signal.ts` primitives,
  day-bucket invite + mailbox tokens): dev-build-only rung, tracked, not
  launch-blocking.
- Founder-ops: relay fleet + data plane deploy and default relay URL flip,
  TestFlight env-block rebuild + two-device QA, counsel + NCMEC (public tier
  only), live billing/deletion/DR/canary evidence.

## WebRTC MED hardening (same day, second phase, founder-directed)

The founder directed completing the deferred WebRTC MED/LOW items before the
merge. Landed as `ff4f3dd5` plus a codex-review follow-up commit.

### What changed

1. **Signed sync signaling (finding a).** call-signal.ts internals are now
   parameterized by a signal profile (signing domain + media set + kind set);
   the public call API and CallSignal type are byte-identical in behavior. New
   exports (createWebRTCSyncSignal, verifyWebRTCSyncSignal, seal/open frame,
   payload encrypt/decrypt, token derivations) give the WebRTC sync rung the
   same Ed25519-signed, strictly-validated envelope as calls, under domain
   'meerkat-webrtc-sync-signal-v1', media 'data', kinds offer/answer/ice, and
   its own frame HKDF context. The app manager (webrtc-sync-signaling.ts) was
   rewritten on these primitives with the replay floor moved from an in-memory
   map to the DB-persisted call_signal_nonces table (survives relaunch),
   preserving all resource-safety behavior from e10b54de.
2. **Day-bucketed invite token (finding b).** v2 invite tokens fold in the UTC
   day index; listeners hold current + previous bucket and re-derive just
   after midnight (recursion-safe with injected instant timers).
3. **Day-bucketed mailbox tokens (finding c).** deriveMailboxToken v2 with the
   same window rule; all ten park sites (channel, DM direct/group/receipt/
   shred, file request/grant, history backfill, presence beacon, person
   announce) resolve ONE clock per seal; runMailboxDrainJob and
   MailboxListenEngine cover both buckets.

### Codex adversarial review (gpt-5.5 via codex CLI) and disposition

- P1 mixed-version unreachability: ACCEPTED deliberate pre-beta clean break,
  recorded as a ledger row in the rc19 notes (both founder devices must run
  same-side builds).
- P2 invite-listener socket budget: FIXED (cap 12 most-recently-seen peers,
  regression test).
- P2 seal/token clock incoherence: FIXED (resolveMailboxSealClock, one read
  per park).
- P2 rotation unlinkability overclaim, ahead-clock midnight loss, backward
  clock re-arm: comments corrected to claim only what holds (rotation defeats
  token-string-only correlation, not a connection-correlating relay; ahead-
  clock loss is bounded by the pre-existing 30s skew policy and fails soft to
  relay; backward clock delays one rotation until the next host refresh).

### Verification (final tree)

Sync, app, web, relay suites green (app 1514 incl. new cap test; sync gains
the webrtc-sync-signal profile suite and mailbox rotation tests); typecheck +
lint clean on all four packages; gate:function:changed, check-meerkat-parity,
transport NC, check:esm-require green. New regression coverage: profile
round-trip, domain separation both directions incl. mutual-media forgery,
replay across manager restart, forged-sender drop, invite/mailbox rotation,
two-bucket windows, listen-engine day roll, invite-peer cap.

## Merge, push, and rc19 cut (final phase)

- Branch true-merged to `main` at `cdfea6d6` (--no-ff; one memory.md conflict
  resolved by keeping both session rows) and PUSHED, together with main's two
  unpushed docs commits (composition-platform plan `8f2c94da`, instruction
  restructure `a0706b68`). Branch ref also pushed. Merged-tree code is
  byte-identical to the fully verified branch tip; parity + esm + typecheck
  re-confirmed on the merge before pushing.
- rc19 ledger CUT at `cdfea6d6`: `docs/releases/meerkat/meerkat-2026-08-25-rc19/`
  (evidence.json superseding rc18, rendered evidence-summary.html), carrying
  rc18's open steps and the accepted token-compat-break row.
- release-verify dispatch BLOCKED, honestly recorded in the ledger: the merge
  push created NO workflow runs because GitHub Actions is DISABLED at the repo
  level (`GET /actions/permissions` -> `enabled:false`), on top of the
  unconfirmed billing. Founder unblock: fix Billing & plans, re-enable Actions
  in repo Settings, then `gh workflow run release-verify.yml -f
  sha=$(git rev-parse cdfea6d6)`.
