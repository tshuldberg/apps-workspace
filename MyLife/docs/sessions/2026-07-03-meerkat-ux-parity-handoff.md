# HANDOFF: Meerkat UX-parity set (Plans 30-32) orchestration (2026-07-03)

For the next session: a Fable orchestrator dispatching OPUS worker agents through
Plans 30 (chat rebuild), 31 (navigation IA + join), 32 (feed + media identity),
plus the UI work earlier founder decisions parked INTO this window (Plan 21
Phase 5 DM UI, Plan 28 P4 Remove UI). Read this file, then the three plan specs,
then start. Everything below was verified against the working tree on
2026-07-03.

---

## 1. Where the branch stands

- Branch: `feature/meerkat-launch-finish`, HEAD `68b76c89`, NOT pushed (push
  only when the founder asks). CI is down (GitHub billing): LOCAL green is the
  trust gate, matching all prior waves.
- Suites at HEAD, all green: `@mylife/sync` 1522, meerkat app 367, meerkat-web
  187, meerkat-relay 325, all four typechecks, `check-meerkat-parity` (now ~125+
  guards incl. 13 Plan 28 + 3 Plan 27 additions), husky staged function gate.
- Verify commands (run from repo root unless filtered):
  - `pnpm --filter @mylife/sync test` / `typecheck`
  - `pnpm --filter @mylife/meerkat-app test` / `typecheck` (runs both tsconfigs)
  - `pnpm --filter @mylife/meerkat-web test` / `typecheck`
  - `pnpm --filter @mylife/meerkat-relay test` / `typecheck`
  - `node scripts/check-meerkat-parity.mjs`
  - `pnpm gate:function:changed` (husky runs `--staged` on every commit)
- Known pre-existing failure NOT ours: hub `apps/web` billing test
  (entitlement-issuer expects features without `meerkat:hosted-storage`; owned
  by Plan 22 Phase 0). It does not run in the four meerkat-scoped suites.
- Uncommitted worktree noise to LEAVE ALONE (other sessions own it):
  `.mcp.json`, `errors_log.md`, `packages/meerkat-relay/bin/meerkat-host.mjs`,
  and various untracked `docs/reports/` + `docs/sessions/` files.

## 2. What landed since the plans were written (2026-07-02 thread)

The three plan specs and the master orchestration doc are dated 2026-07-01.
Since then, ONE thread (this one) landed on this branch, in order:

- Plan 21 Phases 2-8 (DMs, data/engine only): dispatcher + drain + provider for
  1:1 and group DMs, receipts, block/report, feed_opt_in seam, DM_SHRED
  disappearing messages, DM attachments (verify-then-pin). Phase 5 (mobile DM
  thread UI) is HELD for Plan 30's chat kit. Phases 9 (web parity of 3-8) and
  10 (hardening) are NOT built. `DM_MESSAGES_SURFACE_AVAILABLE` is still
  `false` (`apps/meerkat/app/(root)/data/share-route.ts:42`); flipping it is
  part of the DM UI landing.
- Plan 28 ENGINE COMPLETE (P0-P3 + P5, commits `0dc3f361`..`ab3ef678`): real
  member removal end to end. `removeCommunityMemberById(communityId,
  removedDeviceId)` exists on BOTH providers (mobile `SyncProvider`, web
  `MeerkatProvider`) and runs the whole owner action (signed revision +
  survivor-only epoch rotation + per-survivor mailbox fan-out + community-node
  republish) returning HONEST counts
  (`{ revision, epoch, survivorsToNotify, envelopesParked, nodesAttempted,
  nodesRepublished }` or a reason-coded failure). A live 3-node relay+node e2e
  proves convergence, session refusal, and hosted `not_member`. ONLY P4 (the
  Remove UI) remains, and the founder bundled it into THIS window (section 4).
- Plan 27 P0-P2 + gossip restriction (commits `1943b084`..`783354cf`):
  owner-signed `transportPolicy` on the descriptor, row-level transport gates
  in both directions, `forbiddenLayerIds` dial cap, local_only relay-token
  skip. Plan 27 P3-P5 (local join handoff, policy-change UX, hardening) remain
  on the FUNCTIONAL track and are NOT in this window, with one coordination
  note in section 5.
- Session logs with full detail:
  `docs/sessions/2026-07-02-meerkat-plan21-phase6-review.md` (Plan 21 Ph6-8 +
  Plan 28) and `docs/sessions/2026-07-02-meerkat-plan27-transport-policies.md`.

Consequences the plan specs do not know about:

- `ForegroundDrainResult` (both surfaces) gained `memberRemovalsApplied`. Plan
  30's live loop (Phase 3) wraps `runForegroundDrain`; its refresh trigger
  should treat `memberRemovalsApplied > 0` like `appliedMessages > 0` (a
  removal arriving while a channel is focused must refresh the member list and
  roster-driven UI).
- `MergeChannelMessageEventsResult` gained `droppedRemoved` (Plan 28 P5
  membership cut). Any new test asserting the full result literal must include
  it.
- The drain-token builders in `SyncProvider.tsx`, `background-sync.ts`, and web
  `MeerkatProvider.tsx` now derive member-removal tokens per community AND skip
  every relay token for `local_only` communities. Parity guards STRING-LOCK
  these (handler spreads, token derivations, labels,
  `removeCommunityMemberById`, `republishCommunityDescriptor(...)` wiring, the
  `transportAllowedForCommunity(db, d.communityId, 'wan_relay')` skip). Plan
  30/31 refactors that touch these files MUST keep the locked needles intact
  or update `scripts/check-meerkat-parity.mjs` in the SAME commit.
- `revokeFromWorkspace` / `rotateWorkspaceKey` now THROW without
  `{ legacyOk: true }` (NC-2). No UI may call them; Block flows keep using
  `createSignedRevocation` as today.
- Plan 30's spec says "Depends On: Plan 23 D.6 ... parallel-safe": D.6 already
  LANDED (2026-07-01). The NC-5 rule stands: do not touch `sync-session.ts` /
  `noise-handshake.ts` in this window.
- Test counts cited inside the plan specs are stale; the numbers in section 1
  are current.

## 3. The work: sequencing for the orchestrator

Track E order per the master doc (`docs/plans/meerkat-launch-orchestration.md`),
with the held UI folded in:

```
Wave 1: Plan 30 Phases 0-2   (chat kit + reactions + channel rebuild)
        Plan 31 Phase 0      (Messages shell + tab merge)  [file-disjoint from 30]
Wave 2: Plan 30 Phases 3-5   (live loop, web parity, hardening)
        Plan 31 Phases 1-2   (join pipeline + Communities restructure)
        Plan 32 Phase 0      (feed data enrichment; needs 30 Phase 0 landed)
Wave 3: Plan 21 Phase 5      (DM thread UI: consumes 30's chat kit + 31's
                              Messages shell; flips DM_MESSAGES_SURFACE_AVAILABLE)
        Plan 28 P4           (Remove UI: build INTO 31's new settings screen)
        Plan 31 Phases 3-6   (onboarding v2, honesty consolidation, web, ship)
Wave 4: Plan 32 Phases 1-5   (feed rebuild, avatars, link previews, web, ship)
        Plan 21 Phases 9-10  (web DM parity + hardening)
Close:  /design-review batch across 30+31+32 (the UX-set close), full sweeps
```

File-ownership map (parallel safety): 30 owns `channel/`, `post/`,
`components/chat/`, `ChatProvider`; 31 owns `(tabs)/_layout.tsx`,
`communities.tsx`, `community/`, `messages.tsx`, `friends.tsx`, onboarding,
`me.tsx`; 32 owns `(tabs)/index.tsx`, `feed-core`, `community-profile.ts`,
`link-preview`, `components/feed/`, `components/Avatar.tsx`. Web twins mirror
the same split. Overlaps to referee: Plan 30 Phase 2 moves history-import into
the channel overflow, Plan 31 Phase 2 re-homes it into community settings;
Plan 32 T2.3 edits the profile editor "wherever it lives at execution time".

Binding coordination rules (from the master doc + plan Depends-On sections):

- Plan 23 D.1/D.2 edits the SAME `communities.tsx` admin JSX Plan 31 Phase 2
  relocates. Nothing of D.1/D.2 has been built. Plan 31 relocates whatever is
  current and MUST update Plan 23's Status Delta in the same session to
  redirect D.1/D.2 targets to `community/[communityId]/settings.tsx`.
- Plan 30 T3.3: the live loop exposes `tickImpl` injection as the Plan 29 seam.
- Plan 32 Phase 1 satisfies Plan 23 D.4 (mobile Feed states); record the
  supersession in 23's Status Delta at ship.
- Plan 31's route-collision guard (static `community/join` intake route beating
  the dynamic `[communityId]` segment) is MANDATORY and test-covered.

## 4. Held UI this window MUST absorb

### Plan 21 Phase 5: DM thread UI (mobile), then Phase 9 web parity

Everything under the UI is already real and tested: `dm-core` local store,
`dm-provider-core` send/drain (1:1 + group, own-device mirror), honest delivery
(parked only on real park; delivered/read only from verified receipts), block =
real revocation, report ledger, DM_SHRED delete-for-everyone, attachments with
verify-then-pin. The UI consumes `useSync()` callbacks that already exist
(`queueDmMessage`, `queueDmReceipt`, `queueDmShred`, `createDmGroup`,
`dmGroupAddMember`, `dmGroupRemoveMember`, `blockDmParticipant`, `reportDm`).
Requirements:

- Conversation list slots into Plan 31's Messages shell ("Chats" section);
  thread screen consumes Plan 30's chat kit components with DM-shaped items
  (the kit is props-only by design, 30 T1.x).
- Flip `DM_MESSAGES_SURFACE_AVAILABLE` to true in `share-route.ts` (mobile) and
  the web twin flag (`DM_MESSAGES_SURFACE_ENABLED`, `ShareInbox.tsx`) ONLY when
  the surface really ships on that platform; the parity guard locks both flags
  (`check-meerkat-parity.mjs` "DM-hidden guard" section) and must be updated in
  the same commit. The Share Inbox DM destination and the Messages person-sheet
  Message button then un-hide by existing wiring.
- Honest copy rules: show only locally recorded events; "Delivered"/"Read" only
  from verified receipt rows; disappearing messages honestly describe the
  drain-dependent boundary (see the dm-shred module docs); one deferred item is
  documented in the Plan 21 delta (over-cap DM file re-request lands with
  attachment UI).
- Plan 21's spec still cites `friends.tsx` edit targets; Plan 31 T6.2 rewrites
  those to the Messages People person sheet. If Phase 5 runs before 31 T6.2,
  apply the redirection yourself (friends.tsx becomes a redirect in 31 P0).

### Plan 28 P4: owner-only Remove member UI (both surfaces)

- Retire the two placeholder notices, currently verified at
  `apps/meerkat/app/(root)/(tabs)/communities.tsx:425` ("Safe member removal
  needs a signed member-removal update...") and
  `apps/meerkat-web/src/ui/community/ChannelSidebar.tsx:194` (same copy).
  Build the control INTO Plan 31's `community/[communityId]/settings.tsx`
  member rows (mobile) and the web community settings twin, AFTER 31 Phase 2
  relocates the JSX; do not build it twice against the old surface.
- The control calls `removeCommunityMemberById` and is OWNER-only. AC-4 is
  binding: an admin (non-owner) never sees an enabled Remove action; the
  signing model cannot be violated (the engine refuses `not_owner` anyway;
  the UI must match).
- Confirmation copy is EPOCH-BOUNDARY honest (NC-1), founder-approved shape:
  "Takes effect on each member's device as they receive the update; content
  shared before removal stays on their device." Never "removed instantly
  everywhere". Surface the honest result counts (e.g. "Update sent to 3 of 4
  members; 1 will receive it by community update" from envelopesParked /
  survivorsToNotify, "Hosted community server updated" only when
  nodesRepublished > 0). Never claim a park or republish that returned false.
- Add parity guards for the new control + copy; extend AC-6's retired-notice
  guard (assert the OLD notice strings are ABSENT from both files).
- When P4 ships, move Plan 28 from queue/ to done/ and update its Status block.

## 5. Out-of-window coordination notes

- Plan 27 P4 (policy-change UX: "Sync policy" settings row, owner policy picker
  at create/revise, `cm_policy_history`, member notice) targets the SAME
  community-settings surface Plan 31 builds. It stays on the functional track,
  but 31's settings screen should be built so a later settings row is a plain
  addition (it will be, if the relocation keeps the current block structure).
  If the founder pulls 27 P4 into this window, its plan doc has the full spec;
  `communityTransportPolicy`, `revisePolicy`, `transportAllowedForCommunity`
  are already exported and tested.
- Plan 26 (open posting) and Plan 24 (humanity) present sheets from surfaces 31
  renames; their plan docs get route-reference updates in 31 T6.2.
- Plan 29's auto-connect replaces Plan 30's loop tick body 1:1 later (30 T3.3
  seam); do not build extra connectivity logic into the loop.

## 6. Traps learned this thread (workers WILL hit these)

1. FF3 trap (token nobody polls): any new mailbox kind or per-entity token must
   be polled from PERSISTED state in ALL THREE drain sites (SyncProvider
   foreground, background-sync headless, web MeerkatProvider) or it is dead
   code. Plans 30-32 add no mailbox kinds; DM UI consumes existing ones.
2. Session tests: engine sessions are INITIATOR-PUSH (a duplex assertion needs
   two legs, each side initiating once), and the D.6 Noise leg fails with
   "Forward secrecy required" unless paired records carry the peer's REAL
   `dhPublicKey` (not a placeholder string).
3. Byte-parity twins: `check-meerkat-parity.mjs` locks whole-file or
   string-level parity on several files these plans touch (share-route,
   ShareInbox copy, public-publish, hosted-boundaries, Requests-to-join copy,
   Plan 28/27 wiring needles). Run the script LOCALLY BEFORE committing; a
   guard failure after a big UI diff is painful to bisect.
4. The husky pre-commit gate runs lint+typecheck+tests on staged files and can
   take minutes on provider-file changes; batch commits sensibly.
5. `communities.tsx` / `channel/[communityId]/[channelId].tsx` line numbers in
   the plan docs have drifted (this thread edited neighbors); re-grep symbols,
   never trust cited lines (orchestration rule 1).
6. Mobile has NO `Intl.Segmenter` (Hermes): Plan 30 T0.1's emoji validator must
   be the explicit grammar the spec demands, byte-identical across Hermes, V8,
   and Node.
7. Reactions must NOT leak: Plan 30 T0.3's read-model exclusions are the other
   half of the reaction design; Plan 32 T0.1 hard-depends on them for honest
   reply counts and unread badges.
8. `effectiveRelayUrl(db)` is synchronous and the ONLY legal relay read
   (TC-2 of Plan 31 greps for violations).
9. Expo Go vs dev build: camera QR scan (`isQrScannerAvailable()`),
   `expo-image-picker`, `expo-image-manipulator` are dev-build/native-gated;
   every native touch lazy-requires with a null fallback (the `lan-backend.ts`
   pattern) so Expo Go and tests never crash.

## 7. Worker protocol for the orchestrator

The proven pattern from this repo (MK-P01 + the 2026-07-01 execution sessions):

- One fresh Opus worker per phase (or per 2-3 tasks within a large phase), each
  given: the plan file path, the relevant Status Delta / this handoff's section
  2 corrections, the file-ownership slice, and the gate list. Workers follow
  TDD (test first, watch it fail) and Conventional Commits.
- After each implementer: a spec-compliance review agent (did it build what the
  plan says, are the ACs met) and a code-quality/adversarial review agent
  (honesty invariants, fail-closed paths, parity). Orchestrator personally
  re-verifies gates and fixes findings before the phase commit.
- Honesty invariants are non-negotiable and test-enforced (master doc rule 2):
  `DEFAULT_RELAY_URL` stays `''`; staged != sent; no simulated backend shown
  live; no fabricated status, peer counts, receipts, or engagement; polling
  adds NO "connected/live" claims (Plan 30 NC-1); no receiver-side URL fetches
  (Plan 32 NC-2); `cm_publications` sole `published_blob`; omitted cm_ tables
  fail closed.
- Per-phase gates: suite + typecheck for touched surfaces, parity script,
  `pnpm gate:function:changed`, `/review` diff review. Batch `/qa` on web
  surfaces after each plan's web phase; ONE `/design-review` batch at the
  UX-set close.
- Session memory: update `memory.md` (row per session) + session log per plan
  + `errors_log.md` on qualifying failures + Open Brain capture with context
  "personal, mylife" after every milestone. No em dashes anywhere.
- Commit on the existing branch `feature/meerkat-launch-finish` (or split into
  a `feature/meerkat-ux-parity` branch off it if the founder prefers; ask
  once, not per phase). Never push unprompted.

## 8. Founder-ops boundary for this window

- Plan 32 needs `expo-image-picker` + `expo-image-manipulator`: adding them to
  `apps/meerkat/package.json` + lockfile is codeable in-session; the DEVICE
  build refresh afterward is founder-ops. Lazy-require regardless.
- Plan 30 AC-5 (15s live-feel latency) and Plan 31's cold-start deep link + QR
  scan need a deployed relay + dev builds + 2 devices: finish codeable scope,
  list Tier-D checks explicitly (runbook:
  `docs/guides/meerkat-founder-ops-runbook.md`).
- Universal https links (tap-to-join without the app) are OUT (Plan 23 B.3).

## 9. Definition of done for the window

All three plans' AC/TC/NC lists green with tests; Plan 21 Phase 5 + 9 shipped
and `DM_MESSAGES_SURFACE_AVAILABLE` flipped honestly on both surfaces; Plan 28
P4 shipped, placeholder notices gone, Plan 28 moved to done/; parity guard
extended and green; all four suites + typechecks green locally; plan Status
Deltas updated (21, 23 D.1/D.2/D.4 redirects, 24/26 route refs); session logs +
memory.md + Open Brain captures written. Plans 30/31/32 move to done/ unless a
founder-ops Tier-D item forces queue/ with an explicit ops list.
