# Ledger notes for the rc that carries the 2026-08-24 audit branch

Authored 2026-08-25 on `fix/meerkat-bug-audit-2026-08-24` (11 commits,
`eadbbc78..b89e361b`, unpushed), for the next release candidate (expected
`meerkat-2026-08-25-rc19` or later, superseding `meerkat-2026-08-01-rc18` at
`43a357a3`, which closed NO-GO with its release-verify billing-cancelled
mid-run). This file is an INPUT to the cut, not a ledger: the rc directory
with `evidence.json` is authored at the merge SHA on `main`, after this
branch lands through the sanctioned path.

## Gates on the cut (both founder-controlled)

1. **GitHub Actions billing.** Unconfirmed as of 2026-08-25. No workflow run
   has executed since the 2026-08-01 billing-cancelled batch; the repo token
   cannot read the billing API and no cheap dispatchable probe workflow
   exists. Confirm at github.com/settings/billing (a push that triggers CI is
   itself the proof). Do not dispatch release-verify before this is green.
2. **Merge + push approval.** The branch is deliberately unpushed. Cutting
   rc19 requires the founder's decision to land it on `main`.

## Cut procedure (unchanged rules)

1. Merge `fix/meerkat-bug-audit-2026-08-24` into `main` (branch protection
   is live; PR path per rc10-exc-1).
2. Create the rc directory binding `releaseSha` to the merge commit,
   `supersedes: meerkat-2026-08-01-rc18`.
3. Dispatch `gh workflow run release-verify.yml -f sha=$(git rev-parse <merge sha>)`,
   never a hand-typed SHA.
4. Carry forward rc18's still-open rows.

## What rc19 carries beyond rc18 (43a357a3)

`main` itself moved past rc18 before this branch: TestFlight prep (icon
assets, call-native plugin, share envelopes), the five-defect burn-down to
the first green iOS build `06cc1435` (EAS image pin, maplibre plugin,
Exception subclass fixes in call-native + native-transport), the 24h relay
mailbox TTL preset, EAS submit block with the ASC app id, and the rc17 FAIL
close-out + rc18 ledger docs.

The audit branch then adds, in order:

- `eadbbc78` seven product defects from the 08-24 adversarial audit
  (trusted-proxy rate-limit bypass, same-epoch account recreation, LWW
  future-timestamp poisoning, WebRTC signaling contract + direction split,
  noncanonical credential Base64, stale React effects, unsigned-pairing
  copy).
- `dbe43965` two CRITICAL account-tombstone blockers the green Vitest suite
  masked (require-in-ESM would 500 the account service on deploy;
  pre-mint-epoch defeated the Sybil tombstone).
- `2fc8427a` SAS mandatory before community sync (`requiresSasForShare`
  policy flag, parity-locked on both twins). Behavior note for the ledger:
  peers paired earlier without an emoji confirm must SAS-verify once before
  their shared communities resume syncing.
- `39053a37` three 2026-08-01 deploy-walkthrough defects (mobile
  `ensurePersonalWorkspace` bootstrap, web secure-context boot-hang guard,
  age-gate parity locks).
- `915405bb` tombstone finish: anti-abuse flags carried across deletion +
  HMAC subject marker under `MEERKAT_ACCOUNT_TOMBSTONE_SECRET` (production
  compose sets it; must stay stable for the deployment's lifetime).
- `4d9a50f1` `check:esm-require` gate (pre-commit + check:parity) banning
  require() in ESM production source.
- `e10b54de` two HIGH WebRTC resource leaks (listener leak on malformed
  invite, glare orphan leak) + serial-unlinkability honesty correction.
- `c77bcfe3` Blackglass 2026-07-09 re-verification: 10 FIXED, 1 PARTIAL,
  0 still-valid; errors_log corrected.
- `c731fc85`, `09746faa` session docs.
- `b89e361b` controlled expo patch bump: expo 54.0.37, expo-constants
  18.0.14, expo-file-system 19.0.24 + targeted `pnpm dedupe expo-constants`.
  expo-router stays 6.0.24 (exports verified). expo-doctor 16/18 -> 17/18;
  residual is the pre-existing same-version expo peer-context split from the
  inert RN 0.84.1 optional-peer lockfile lane (cosmetic, documented in
  memory.md tech debt).
- `ff4f3dd5` (+ codex-review follow-up) WebRTC MED hardening, closing the
  three deferred 08-24 findings: the WebRTC sync rung's SDP/ICE exchange now
  rides the shared SIGNED call-signal machinery under its own domain/media/
  frame-context profile with a DB-persisted replay floor; the WebRTC invite
  token and ALL pair mailbox tokens are day-bucketed (v2), receivers hold the
  current + previous UTC bucket. Codex adversarial review applied: invite
  listeners capped at 12 most-recently-seen peers (relay socket budget),
  seal/token clock resolved once per park, honesty-scoped rotation claims.
  **LEDGER ROW - accepted compatibility break:** mailbox delivery and WebRTC
  sync invites between a pre-`ff4f3dd5` build and a post-`ff4f3dd5` build do
  not interoperate (v1 static tokens vs v2 bucketed tokens). Deliberate
  pre-beta clean break with no installed base; both of the founder's devices
  must run builds from the same side of this commit.

## Evidence at the branch tip (2026-08-25, local)

| Surface | Result |
|---------|--------|
| Meerkat app suite | 148 files / 1,510 tests green |
| Sync suite | 2,526 green (at `09746faa`; untouched by the bump) |
| Relay suite | 1,612 green (at `09746faa`; untouched by the bump) |
| Web suite | 1,049 green (at `09746faa`; untouched by the bump) |
| Typechecks | meerkat + mobile + bestchef + dowork + yearn + mynews + manhattan all clean after the workspace expo-constants dedupe |
| Parity | `check-meerkat-parity` (incl. SAS + age-gate locks) and full `check:parity --quiet` green |
| ESM gate | `check:esm-require` green |
| EAS iOS build (testflight profile) | Build `4e355d3e-051c-4572-80a4-42fe9c6cb2a6` FINISHED 2026-08-25 from the branch tip (`b89e361b`): the native build compiles and signs on the bumped deps, .ipa produced. This is a dep-verification build, not a tester build (RC key + relay URL not baked). |

## Honesty constraints on the cut

- The PostgreSQL account-store lanes (tombstone flag-carry, integration
  suite) are env-gated and were SKIPPED locally; release-verify's
  meerkat-postgres job is the proof point.
- The WebRTC rung's deferred MED items (reuse `call-signal.ts` primitives,
  day-bucket the invite + mailbox tokens) are tracked, dev-build-only, and
  not part of this rc's claims.
- The rc must not claim live-evidence rows (two-device sweep, provider
  round-trips, deployed relay fleet) from local suites; those remain OPEN
  founder-ops rows carried from rc18.
