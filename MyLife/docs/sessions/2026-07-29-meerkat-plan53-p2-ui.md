# 2026-07-29: Meerkat plan 53 P2, the in-person ceremony UI

Branch `feature/meerkat-plan52-person-identity`, commit `678f591d` on top of `8c489671`. Plan: `docs/plans/queue/53-meerkat-in-person-tap-to-add.md` (read in full, both amendments, before any code).

## Context verification before building

Every symbol P2 depends on was verified in source first:

- `startProximityCeremony` in `apps/meerkat/app/(root)/data/proximity-ceremony-adapter.ts` takes `{ mod, identity, selfBundle, onState, onCommitted }` and returns `{ confirm, cancel, state }`. The P1 adapter tests show the canonical construction: `selfBundle: createSignedIdentityBundle(identity)`, which the native barrel exports (line 325 of `packages/sync/src/index.native.ts`).
- All eight `CeremonyPhase` values and four `CeremonyFailure` reasons in `packages/sync/src/protocol/proximity-ceremony.ts`; `SasResult.emoji` is the five-emoji array.
- `applyTrustedBundle` (SyncProvider line 2269) existed but was NOT on the context; `pairWithJson` and `pairWithFriendCode` wrap it internally.
- `add-friend.tsx` gates the entire QR/publish flow behind `canResolve` from `resolveAddFriendRelay`, confirming the plan's placement warning.
- `loadNativeNearbyModule()` returns null when the raw module lacks the `connect` probe (Expo Go), and building a bridge is cheap (listeners attach lazily), so it doubles as the availability check.
- add-friend-core mobile/web are NOT byte-locked twins; parity only `ensureContains` the needs-server line in each, so a web-only honesty const is safe there.

No plan assumption contradicted the code; no amendment was needed.

## What was built

1. **Ceremony screen** `apps/meerkat/app/(root)/(tabs)/add-in-person.tsx` (hidden route, registered `href: null`). Loads one bridge over the shared native module, starts the ceremony on mount, renders per-phase from the pure view core, cancels on unmount AND on AppState leaving `active` (AC-2), and on commit routes the peer bundle through the provider's one pairing path. `mode=friend|device` changes copy only. With no native module it renders the honest needs-the-full-app copy (AC-6), never a searching pretense.
2. **Pure view core** `data/proximity-ceremony-view-core.ts`: every user-facing line of the ceremony, mapped from `CeremonyState` + mode + the pairing-write outcome. Confirm is enabled in exactly one phase (`awaiting_confirm`, SAS on screen); every terminal-without-commit state says nothing was saved; the nearby-sync pause consequence (plan amendment: the ceremony's browse takes the single native browser slot) is stated during active phases; the 90-second window line derives from `CEREMONY_WINDOW_MS`. The provider's `'Already paired with that device.'` result renders as the benign two-generals re-run, not an error.
3. **Provider seam**: `pairWithVerifiedBundle` on `SyncContextValue`, implemented as `applyTrustedBundle` itself, so an in-person add is byte-equivalent to the MKPAIR1 flow (AC-5). No pairing logic was reimplemented.
4. **Add friend entry**: "Add in person" panel rendered OUTSIDE the `canResolve` ternary with a comment stating why. Expo Go shows the honest line instead of the button.
5. **Sync screen entry**: "Pair in person" in the Pairing section, same screen with `mode=device`, same Expo Go honesty.
6. **Web**: `ADD_FRIEND_IN_PERSON_WEB_LINE` in `apps/meerkat-web/src/lib/add-friend-core.ts`, rendered as an "Add in person" card in `AddFriendOverlay`: a browser cannot use the nearby radio; QR + friend codes remain the web paths.

Copy rules enforced by test: no line matches `\btap\b` (no NFC-style hardware claim), no em dashes, and the SAS instruction commands the comparison ("Confirm only if both phones show exactly the same five").

## Verification

- New: `app/__tests__/proximity-ceremony-view-core.test.ts`, 11 tests. Mutation-checked three ways (confirm enabled in `awaiting_peer`; "nothing was saved" removed from cancelled copy; already-paired special case disabled); each mutation failed the intended test and was reverted.
- Battery: sync 2498 passed, relay 1587 passed, app 1486 passed (up 11), web 1038 passed, `check-meerkat-parity` green, `check:meerkat-transport-nc` green (NC-42.7 holds for the new screen), `gate:function:changed` green, both typechecks green.
- The `account.test.ts` intermittent (errors_log, Unresolved) did not reproduce in this session's web run.

## Remaining

- P3: presentation-profile name on the confirm popup, person announce exchange on completion, DM thread from the success screen.
- P4: capability-status entries both platforms, parity extension locking the new copy, tester-guide section.
- P5: remaining test surface + rc ledger notes.
- OPEN unchanged: nearby browse takeover (stated in UI now, device sweep must confirm recovery), both native files UNVERIFIED until TestFlight, AC-3 ledger row stays OPEN.

## P3 (same session, commit de53b43f): plan 52 integration

- Verified in source first: `PresentationProfile` (global displayName + per-community overrides), the announce machinery (`neededAnnounceContexts` computes contexts only at proposal time; `mk_person_announce_outbox` + `drainPersonAnnounceOutbox` park DM-peer proofs; the outbox had NO drain caller outside the accept handler), and `ensureDirectConversation` in dm-view-core.
- Finding recorded: plan 52 as shipped never creates a dm-peer announce for a friend paired AFTER group formation, and queued announces had no retry point. P3 closes both for the ceremony path.
- `announcePersonToDmPeer(deps, peerDeviceId)` added to person-identity-core (BOTH twins, byte-identical, parity green): no person group = honest no-op; own-device-linked peer = refused (a no-change proposal could block the plan 52 linking proposal via single-flight); missing context = a no-change `proposePersonGroupRevision({})` re-announce (immediate for a single-device person, a co-sign round for siblings); then a best-effort outbox drain. Idempotent per peer.
- Both foreground drains (mobile SyncProvider + web MeerkatProvider) now call `drainPersonAnnounceOutbox` after the mailbox drain, so an announce queued offline eventually parks.
- Ceremony screen: selfBundle now carries the presentation-profile name when set (peer's popup shows the chosen person name); on a written friend pairing or the already-paired re-run it fires `announcePersonToFriend`; the success screen gains "Message [name]" via `ensureDirectConversation` + the DM route. The DM action is modeled in the view core (`showMessageButton`) and earned ONLY by a written friend pairing.
- Tests: 4 announce tests in person-identity-core.test.ts (full deliver-and-link path over the fake mailbox, no-group no-op, own-device refusal, idempotence) + a DM-action model test. Mutation-checked: own-device guard removed, outbox guard removed, showMessageButton flipped; every mutation failed its intended test.
- Battery: app 1491, web 1038 (one unnamed test failed once, then passed 3 consecutive full reruns; errors_log intermittent row updated), parity, transport NC, function gate all green. Three deliberate mutation-check auto-stub rows were removed from errors_log.md per its "what not to log" policy.

## P4 (same session, commit 474dbf28): honesty surfaces + parity

- Capability entries both platforms. Mobile `in_person_add` DERIVES from the real substrate (`loadNativeNearbyModule() !== null`), so it reads live only where the native module exists and pending in Expo Go; web reuses `ADD_FRIEND_IN_PERSON_WEB_LINE` at 'partial', following the photo-map mobile-only precedent.
- check-meerkat-parity plan 53 block: SAS-instruction, nearby-pause, and Expo-Go-fallback copy locked at their single source; the add-friend entry's OUTSIDE-the-canResolve-gate placement locked by index ordering (mutation-checked: breaking the needle fails the gate; note the first probe appended a char and did NOT trip it because indexOf matches substrings, so the probe was redone properly); web line single-sourced across AddFriendOverlay and capability-status; a no-tap scan over non-comment lines of both copy sources (it caught the view-core header comment on first run, so the scan excludes comments and the rule is documented inline).
- Tester guide: new section 11 "Add a friend in person (two iPhones, no internet)" with the happy path, the airplane-mode no-internet proof, cancel/timeout/background nothing-saved checks (AC-2), own-device Pair in person, and the nearby-sync-recovery check the plan amendment left OPEN; sections renumbered 11->12, 12->13 (no cross-references existed); two quick-reference rows added, including "the five emoji differ" = cancel and report.
- Battery green: app 1491, web 1038, parity, transport NC, function gate.

## P5 (same session): NC-1 assertion, ledger notes, plan status

- NC-1 landed in two halves, both proven against a planted `ws://` dial in the adapter's confirm path: the new NC-53.1 gate in check-meerkat-transport-nc (no ceremony surface may reference relay machinery; self-test plants a WebSocketRelayBackend import) and a behavioral WebSocket spy over a full two-phone ceremony in the adapter suite.
- Audit of the rest of P5's list found it already satisfied: the P0 protocol suite covers every state-machine path, the MITM SAS-divergence vector, forged/mismatched/replayed material, and the advertisement payload shape; the P1 adapter suite covers the fake-native-module drive.
- rc reality check: this branch forked from main at f53fc3d6 BEFORE rc14-rc16, so the rc carrying plans 52+53 must bind to the post-merge main SHA and cannot be cut branch-side. Authored docs/releases/meerkat/rc17-plan52-53-ledger-notes.md: the evidence rows (CLOSED vs honestly OPEN), the cut procedure (PR path, supersedes rc16 at 105adcc8, dispatch release-verify with git rev-parse), and the carry-forward of rc16's open e2e row. AC-1 and AC-3 stay OPEN until the TestFlight sweep; both native files remain UNVERIFIED.
- Plans 52 and 53 moved queue -> active with dated status lines (code complete; merge + rc + live evidence outstanding).
- Full battery at head: sync 2498, relay 1587, app 1492, web 1038, parity, transport NC (incl. NC-53.1 self-test), function gate.

## Merge to main (same session, founder go-ahead)

- Pushed local main's outstanding docs commit (6decd359), proving direct push to main is permitted (protection blocks force-push/deletion only, so no PR was required).
- Merged main into the branch (89e3578d). Only two conflicts, both bookkeeping: memory.md (took the branch block, adopted main's richer rc13 row with the release-verify run id, dropped a stop-hook stub, fixed the plan 53 link to active/) and errors_log.md (unioned both sides' rows; stale auto-stubs left for the scheduled archive prune).
- Verified the merged tree before landing: pnpm install against main's rc14-16 advisory lockfile, then sync 2498, relay 1587, app 1492, web 1038, bestchef 1304 (rc14 touched it), check-meerkat-parity, transport NC, full 133/133 workspace typecheck, check:parity, check:generated-artifacts. All green.
- Pushed the branch, then true-merged (--no-ff) into main as cad7db07 after confirming `git diff main feature/...` was empty (trees identical), re-ran parity + NC on main, and pushed. origin/main is now cad7db07.
- NOT done here (next steps): cut rc17 at cad7db07 per docs/releases/meerkat/rc17-plan52-53-ledger-notes.md and dispatch release-verify with `gh workflow run release-verify.yml -f sha=$(git rev-parse cad7db07)`; then the TestFlight sweep.
