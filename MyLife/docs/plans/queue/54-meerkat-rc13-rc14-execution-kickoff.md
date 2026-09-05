# Meerkat rc13 + rc14 Execution Kickoff Prompt

Paste the prompt below into a fresh session at the MyLife repo root. It drives the full launch train: rc13 (defect fixes) then plans 52 + 53 (rc14). Authored 2026-07-29 by the planning session; the file references are pre-verified against `main` so the executor does not have to rediscover them.

---

## PROMPT (copy everything below this line)

You are executing the Meerkat launch train on the MyLife repo. The work is already planned and sequenced; your job is disciplined execution with evidence. Do not trust any document's claim about the code, including the plans: verify every referenced symbol in source before building on it.

### Standing rules for this whole session

- Change freeze process: every accepted code change lands as a NEW SHA, and each release candidate binds to exactly one SHA. rc13 and rc14 each get a ledger directory under `docs/releases/meerkat/` (follow the rc12 ledger shape: `evidence.json`, supersedes pointer, lineage). Verification is dispatched with `gh workflow run release-verify.yml -f sha=$(git rev-parse <sha>)`, never a hand-typed SHA.
- Feature work happens on `feature/` or `fix/` branches off `main`, squash-merged. Run `pnpm gate:function:changed` before every commit; run `pnpm check:parity` and the full battery (`pnpm --filter @mylife/sync test`, `@mylife/meerkat-relay`, `@mylife/meerkat-app`, `@mylife/meerkat-web`) before declaring any stage done. Baseline at rc12 was 6,404 passed; you must end each stage green.
- Web and mobile are parity twins. Any change to a twinned module (`apps/meerkat-web/src/lib/*` vs `apps/meerkat/app/(root)/data/*`) lands on BOTH sides in the same stage, and `check:meerkat-parity` must pass.
- Honesty rules are load-bearing: no capability may render as available unless its substrate is really present; fail closed with plain copy. The transport NC gate (`pnpm check:meerkat-transport-nc`) must stay green.
- Live browser evidence: the multi-device testbed is `artifacts/meerkat-testbed/start.sh tunnel|lan` (untracked; runs the REAL relay and REAL web bundle, stubs only the app-unlock entitlement endpoint). Use it to reproduce each defect before fixing and to demonstrate each fix after.
- Bookkeeping after each completed stage, not batched: `memory.md` (stay under 80 lines), `errors_log.md` rows for the two defects (upgrade the existing Unresolved rows dated 2026-07-24 when fixed), a session log under `docs/sessions/`, and an Open Brain `capture_memory` with context "personal, mylife". No em dashes in any document.

### Stage 0: Context load (do this before touching anything)

1. Read `memory.md` (repo root) and confirm MCP connections per the repo CLAUDE.md session-start protocol.
2. Read the three governing documents end to end:
   - `docs/reports/REPORT-meerkat-launch-readiness-2026-07-24.md` (the two defects, root causes, fix directions)
   - `docs/plans/queue/52-meerkat-person-identity-linking.md`
   - `docs/plans/queue/53-meerkat-in-person-tap-to-add.md`
3. Confirm the working tree: `main` should contain commits `ff85825e`, `fe61c13c`, `073a460d`, `c6b03712`. If a newer rc than rc12 exists under `docs/releases/meerkat/`, STOP and reconcile with the founder before proceeding.

### Stage 1: rc13, defect fixes only (branch `fix/meerkat-rc13-defects`)

Scope is exactly four items. Read the listed files fully before editing; they are the verified ground truth.

**1A. Web template-commit transaction nesting (defect 1).**
- Read first: `apps/meerkat/app/(root)/data/community-template-commit.ts` (the CORRECT reference: `storeOwnedCommunity` runs BEFORE the transaction, libraries + identity inside one transaction after, `purgeLocalCommunity` on failure; its header documents why), then `apps/meerkat-web/src/lib/community-template-commit.ts` (the broken twin), `apps/meerkat-web/src/lib/meerkat-data.ts:1773-1860` (`storeOwnedCommunity` -> `createGroupCommit`), `packages/sync/src/protocol/group-keys.ts:190-215` (the inner transaction), `apps/meerkat-web/src/lib/storage/browser-database-adapter.ts:120-140` (raw BEGIN, cannot nest).
- Fix: mirror the mobile ordering on web, including an equivalent purge-on-failure so a half-built community never persists. Check whether web already has a purge helper; if not, port the mobile one.
- Evidence: reproduce the failure on the testbed first (any template -> "cannot start a transaction within a transaction"), then show all six templates creating successfully after the fix.

**1B. Relay probe staleness (defect 2, BOTH platforms).**
- Read first: `packages/sync/src/transport/default-relay.ts` (health gate, `resolved.source === 'user'` bypass), `packages/sync/src/engine/session-job.ts:75-100` ("No relay URL configured."), web `apps/meerkat-web/src/lib/meerkat-data.ts:155-210` + `apps/meerkat-web/src/lib/MeerkatProvider.tsx:1185-1210` + `apps/meerkat-web/src/ui/sync/ConnectionStatusCard.tsx:100-140`, mobile `apps/meerkat/app/(root)/data/db.ts:180-210` + `apps/meerkat/app/(root)/components/ConnectionStatusCard.tsx`.
- Fix direction (the report's option 1): re-probe on demand in the sync path when the cached probe is stale, before concluding no relay exists; AND derive the "Free server reachable" label from the same read the dial uses so they can never disagree. Keep the user-set-URL bypass semantics unchanged. Apply to web and mobile.
- Evidence: on the testbed, wait longer than 60 seconds after opening Sync, then run a session on the free default WITHOUT a user-set URL; it must succeed.

**1C. Close the CI blind spot.** `packages/db/src/test-utils.ts:14-27`: `createInMemoryTestDatabase` currently delegates to better-sqlite3's savepoint-nesting `raw.transaction(fn)()`, which is MORE permissive than the shipped browser adapter. Make the test adapter refuse nested transactions exactly like `browser-database-adapter` (raw BEGIN semantics). Expect this to make the pre-fix web template test fail, which is the point; land 1A and 1C in an order that keeps the suite green at every commit. Check for other hub consumers of the test adapter that may legitimately nest (`packages/db/src/hub-queries.ts`, migration runner); if hub code depends on nesting, scope the non-nesting behavior to a new adapter variant and run the meerkat-web suite on it, stating the trade-off in the session log.

**1D. e2e coverage.** Add a template-creation case to `apps/meerkat-web/e2e/launch-paths.spec.ts` (it currently only exercises the scratch path via onboarding; reuse its `passAgeGate` + unlock-seeding helpers). Also add a spec or unit coverage pinning the stale-probe re-probe behavior.

Then: full battery + parity + typecheck green, squash-merge to `main`, cut the rc13 ledger superseding rc12, dispatch release-verify pinned to the rc13 SHA, and record the run URLs in the ledger. Upgrade the two 2026-07-24 `errors_log.md` rows to Resolved with commit links.

### Stage 2: Plan 52, person identity (branch `feature/meerkat-plan52-person-identity`)

Execute `docs/plans/queue/52-meerkat-person-identity-linking.md` phase by phase (P0-P6). Its architecture section is binding, including mutual attestation (every listed device signs the same revision), per-community derived group ids (`HMAC(groupSecret, communityId)`, inner id never leaves the person's devices), per-community overrides beating the global name, and the 8-device cap with monotonic revisions.

Context to load at depth before P0 (all pre-verified to exist):
- `packages/sync/src/protocol/community-profile.ts` (the shipped per-community profile event you will extend to v3) and its `cm_profiles` storage in `apps/meerkat-web/src/lib/schema.ts` + the mobile schema twin.
- `packages/sync/src/types.ts` (SyncScope, `personal_replica`) and `packages/sync/src/protocol/sync-session.ts:430-520` (how session scope is resolved; your presentation profile rides this).
- `packages/sync/src/protocol/group-keys.ts` (`createGroupCommit`) plus the member-removal path (`apps/meerkat-web/src/lib/member-removal-view-core.ts` and its mobile twin) for P5 person-scoped removal.
- Own-device linking: `apps/meerkat-web/src/lib/dm-own-device-status.ts`, `dm-core.ts`, and mobile twins (the person group forms only between own-device-linked pairs).
- All four join doors for P3: web Add-a-community dialog + invite preview (`apps/meerkat-web/src/lib/join-flow.ts`, `src/ui/community/`), onboarding join step (`src/ui/onboarding/OnboardingOverlay.tsx`), mobile `app/(root)/(tabs)/community/join.tsx` including the QR path.
- Member-list and message-header render sites for P4: web `CommunitySettings.tsx` members region, `ChatMessageBubble/List`, `MessagesView`/`DmThreadPane`; mobile equivalents under `app/(root)/(tabs)` and `app/(root)/components/chat/`.
- Privacy reference: `docs/designs/meerkat-account-verification-architecture.md` (plan 51's unlinkability posture that the derived-id rule mirrors).

Meet every AC and NC in the plan, including AC-4 (two communities cannot equate derived ids) and NC-1 (no relay/hosted/log surface ever sees the inner group id; extend the log-hygiene canary). Adversarial-review the P0 protocol before P1 (dispatch an independent review agent on the crypto/replay surfaces, as was done for plan 51).

### Stage 3: Plan 53, in-person tap-to-add (branch `feature/meerkat-plan53-tap-to-add`)

Execute `docs/plans/queue/53-meerkat-in-person-tap-to-add.md` (P0-P5). Binding points: ephemeral-only discovery payloads (test-enforced), SAS mutual confirm, nothing persists until both signed accepts, zero relay involvement (NC-1 transport spy), the same ceremony reused as "Pair in person" for own devices, fail-closed in Expo Go and on web.

Context to load at depth before P0:
- `packages/meerkat-native-transport/src/index.ts` (the bridged `advertise`/`browse` surface, `loadNativeNearbyModule` null-when-absent idiom) and skim `ios/MeerkatNearbyModule.swift` + the Android twin to know exactly what the native side delivers.
- `apps/meerkat/app/(root)/data/nearby-backend.ts` and `transport-backends.ts` (how Nearby is consumed today; your ceremony adapter is a sibling, not a modification of the sync rung).
- The pairing bundle + shared-secret derivation behind `MKPAIR1-` codes (search `packages/sync/src` for the pairing bundle sign/verify and DH derivation; AC-5 requires byte-equivalent paired state).
- `apps/meerkat/app/(root)/(tabs)/add-friend.tsx` + `add-friend-core.ts` (entry point, honest-copy idiom), the Sync dialog pairing section on both platforms, and `capability-status.ts` twins for P4 honesty lines.
- `scripts/check-meerkat-transport-nc.mjs` (the static NC gate your new transport code must not trip; extend it if the plan's guarantees are statically checkable).

Live AC evidence (two physical iPhones) is founder-ops via TestFlight; your exit bar is the full simulated-transport test suite plus every statically checkable AC, with the device-evidence rows left honestly OPEN in the ledger.

### Stage 4: rc14 + handoff

Merge plans 52 + 53 to `main` (order: 52 then 53, since 53's P3 consumes 52's presentation profile). Full battery, parity, both builds, transport NC, typecheck. Cut the rc14 ledger superseding rc13 with both plans in the lineage, dispatch release-verify pinned to the rc14 SHA. Update the tester guide (`docs/guides/meerkat-tester-guide-2026-07-24.html`) and the screen walkthrough with the new person-identity and tap-to-add sections so the founder + friend device sweep can exercise them. Finish with a session log and a summary for the founder listing: what shipped, what remains founder-ops (TestFlight build from the rc14 SHA, ASC record, RevenueCat, device-sweep evidence rows), and the exact commands to start the sweep.

Throughout: if you find that a plan's assumption contradicts the code, stop that phase, record the finding, and fix the plan (with a dated amendment note) before writing code against it. Plans are corrected, never silently deviated from.
