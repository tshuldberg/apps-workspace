# Feature Spec: Real Member Removal + Epoch Key Rotation

> Meerkat launch plan 28. Makes "Remove member" real: an owner-signed descriptor revision
> plus a fresh epoch key wrapped only for survivors, fanned out to every remaining member
> over the mailbox, enforced fail-closed on every device and on hosted community nodes.
> Replaces the honest notice "Safe member removal needs a signed member-removal update
> plus epoch key rotation. This screen only hides local content" (`communities.tsx:419`).
> This is the enforcement backbone open posting (Plan 26) needs for real bans.

## Status (2026-07-02)

ENGINE COMPLETE, UI PENDING. P0 (`0dc3f361`), P1 (`d20af647`), P2 (`142b59d0`),
P3 (`31c9b80e`), and P5 (`ab3ef678`) are built, TDD, and committed on
`feature/meerkat-launch-finish`: protocol + gossip + dispatch/apply wired into
all three drain sites on both surfaces + `removeCommunityMemberById` provider
actions + node republish + the 3-member live-relay/live-node e2e + hardening
(legacy fake rotation throws without legacyOk; channel-apply membership cut;
wrap-withholding red-team). AC-1/2/3/5/7 and NC-2/3/4 are engine-proven; the
plan stays in queue for P4 ONLY: the owner-only Remove UI on both surfaces,
retiring the two placeholder notices (`communities.tsx` / `ChannelSidebar.tsx`)
with the epoch-boundary honest copy + parity guards (AC-4 UI half, AC-6, NC-1).
Founder decision: P4 lands with the UX-parity pass (Plan 30-32 window).

## Metadata

- **Surfaces:** `packages/sync`, `apps/meerkat`, `apps/meerkat-web`,
  `packages/meerkat-relay` (community-node republish), `scripts/check-meerkat-parity.mjs`
- **Priority Score:** 45 / 50 (A-Tier). A community platform where the owner cannot
  actually remove anyone is not moderatable; the production review flags this as a
  Priority A placeholder. Previously UNPLANNED (no queue plan owned it).
- **Estimated CC Time:** 5-7 focused sessions.
- **Depends On:** none (pure engine + app work; the crypto primitive already exists).
- **Blocks:** Plan 26 (open posting bans), Plan 27 (consumes the descriptor-gossip
  primitive built here).
- **Build order:** early. Run before Plan 26; parallel-safe with Plans 21/24.

---

## Current-State Grounding (verified 2026-07-01)

### Already real (reuse verbatim, do NOT reimplement)

| Capability | Anchor |
|-----------|--------|
| `commitMemberRemoval`: closes roster row, mints fresh epoch, wraps ONLY survivors; tested (removed device gets zero new wraps) | `packages/sync/src/protocol/group-keys.ts:401-417`; test `group-keys.test.ts:149-161` |
| `createGroupCommit` / `storeReceivedKeyWrap` (apply side; self-wrap advances local key version, foreign wraps stored for gossip) | `group-keys.ts:190-218,303-323` |
| Key wraps ride the normal engine session when `recordChange` is wired (same as `commitMemberAdd` does today) | `group-keys.ts:45-50`; `sync-session.ts:626-637` `SYNC_WORKSPACE_KEYS_TABLE` branch |
| Epoch-mismatch session refusal (no pairwise fallback; removed member cannot ride old keys once peers converge) | `sync-session.ts:976-981` (initiator), `:1311-1317` (responder) |
| Outbound membership gate on local `removed_at` | `sync-session.ts:1003-1010` |
| Inbound membership gate (`removed_at IS NULL` roster check) | `sync-session.ts:385-415` `resolveInboundAuth`; `queries.ts:725-729` |
| Hosted community-node feed rejects non-members on next challenge once owner republishes | `packages/sync/src/protocol/feed-auth.ts:111-142`; app surfaces it as `source:'removed'` (`community-core.ts:1972-1976`) |
| Owner-only signed descriptor revision, monotonic fail-closed upsert | `packages/sync/src/protocol/community.ts:212-233` `reviseCommunity`, `:561` `upsertCommunity` revision guard |
| Mailbox request/grant template to clone | `packages/sync/src/protocol/join-handoff-mailbox.ts` + `join-handoff-core.ts:185-317` |
| Dispatcher slots pattern | `packages/sync/src/protocol/mailbox-dispatch.ts:75-129` (handlers), `:145-177` (switch) |
| Epidemic gossip template (send all held signed records, apply peer's, fail-closed monotonic) | `packages/sync/src/protocol/revocation-gossip.ts:47-126` |

### Genuinely missing (this plan builds)

1. Any production caller of `commitMemberRemoval` (grep-verified: zero call sites in apps).
2. A descriptor revision that removes a member from `CommunityDescriptor.members`.
3. Distribution: `member-removal-mailbox.ts` + dispatcher case + handler composition in
   the three drain sites (`SyncProvider.tsx:905-924`, `background-sync.ts:305-306`,
   `MeerkatProvider.tsx:1262-1269`).
4. Closing `sync_workspace_members.removed_at` on REMAINING members' devices (today only
   the caller's device would have it).
5. General descriptor gossip (`descriptor-gossip.ts`): descriptor revisions currently do
   NOT propagate to already-joined members at all (`MeerkatProvider.tsx:1334-1339`
   documents re-join as the only refresh path). Plan 27 consumes this primitive too.
6. "Remove member" UI on both surfaces + hosted-node republish in the same action.
7. Deprecation guard on the legacy fake-rotation path (`identity/revocation.ts:62-88`
   `revokeFromWorkspace`, `rotateWorkspaceKey`): no real secret, no wraps; must not be
   reachable by autocomplete accident.

### Known traps (design around, verified)

- `reviseCommunity` is HARD owner-only (`community.ts:218-220`); the Owner review UI gate
  is `owner || admin` (`communities.tsx:259`). Removal UI must be owner-only; admin
  delegation is out of scope (would need a descriptor authority extension).
- Race window: a remaining member who has not yet drained the removal update still
  trusts the removed device (stale local descriptor + old epoch). Removal is
  EPOCH-BOUNDARY honest: old-epoch content stays readable to the removed member; the
  guarantee is forward secrecy from the rotation point, converging per device as the
  update drains. UI copy must say exactly this, never "removed instantly everywhere".
- Survivors to wrap = members holding a CURRENT wrap (`Boolean(m.dhPublicKey)` filter,
  `join-handoff-core.ts:288-290`), NOT blindly `descriptor.members` (FF3 public joiners
  can hold roster rows with zero key material).
- Mesh rotation and hosted-node republish are separate enforcement surfaces; one action
  must trigger both.
- `channel-mailbox.ts` delivery is pairwise-sealed and membership-unchecked, but its
  drain handler is UNWIRED in all three composition sites today; T5 adds the membership
  check so it is safe if ever wired.

---

## Architecture

```
packages/sync/src/protocol/
  member-removal-mailbox.ts   -- NET-NEW: MEMBER_REMOVAL_MAILBOX_KIND; payload
                                 { signedDescriptor, keyWraps (recipient's new-epoch wrap
                                 + back-wraps it should gossip), removedDeviceId };
                                 sealMailboxDelta/openMailboxDelta; token derived HKDF
                                 'meerkat-community-removal-v1:<communityId>:<recipient>';
                                 FAN-OUT: one sealed envelope per remaining member.
  descriptor-gossip.ts        -- NET-NEW (shared with Plan 27): collect/apply
                                 SignedCommunityDescriptor records over any established
                                 session, cloned from revocation-gossip.ts; apply via
                                 upsertCommunity (monotonic fail-closed already).
  mailbox-dispatch.ts         -- EXTEND: memberRemoval handler slot + switch case.
  community.ts                -- EXTEND: removeMemberRevision(previous, removedDeviceId)
                                 helper (owner-only, drops the member, bumps revision).
  group-keys.ts               -- EXTEND: deprecation guard note only (no logic change).
  identity/revocation.ts      -- EDIT: mark revokeFromWorkspace/rotateWorkspaceKey
                                 deprecated; throw unless explicit legacyOk flag; barrel
                                 doc comments updated.

apps/meerkat/app/(root)/
  data/community-core.ts      -- EXTEND: removeCommunityMember(db, engine, deps, communityId,
                                 removedDeviceId): (1) removeMemberRevision + upsertCommunity,
                                 (2) commitMemberRemoval with recordChange wired (survivors
                                 filtered by dhPublicKey), (3) fan-out member-removal mailbox
                                 envelopes over effectiveRelayUrl (parkEnvelope), (4) republish
                                 revised descriptor to every configured community node,
                                 (5) return honest per-step result counts.
                                 + applyMemberRemoval handler: verify owner sig + chain,
                                 upsertCommunity, close removed_at locally,
                                 storeReceivedKeyWrap(recipient), drop paired-device dial
                                 eligibility for the removed device in this community context.
  providers/SyncProvider.tsx  -- EXTEND: memberRemoval drain handler in buildDrainHandlers.
  data/background-sync.ts    -- EXTEND: same handler (shared builder, cannot drift).
  (tabs)/communities.tsx      -- EDIT: owner-only "Remove member" action next to Block
                                 (members list rows :351-390); confirm dialog with the
                                 epoch-boundary honest copy; RETIRE the :419 notice.

apps/meerkat-web/src/
  lib/meerkat-data.ts + MeerkatProvider.tsx -- twins of core + handler.
  ui/community/ChannelSidebar.tsx           -- twin UI (:139-165 members, retire :192 notice).

scripts/check-meerkat-parity.mjs -- EXTEND: twin guards + retired-notice guard.
```

## Phases

- **P0 protocol:** `removeMemberRevision` + `member-removal-mailbox.ts` (+ tests: owner-only
  signing, non-owner forgery rejected, canonical bytes, seal/open round trip, fan-out
  builds one envelope per survivor, survivor filter excludes key-less roster rows).
- **P1 descriptor gossip:** `descriptor-gossip.ts` cloned from revocation-gossip + tests
  (newer revision applies, older/replayed rejected by the monotonic guard, forged sig
  rejected). Wire into the session gossip step where revocation gossip runs today.
- **P2 dispatch + apply:** dispatcher slot/case + `applyMemberRemoval` app handler (both
  surfaces, shared drain builder). Tests: full drain applies roster close + wrap; removed
  device's own drain of the envelope yields nothing (not a recipient); a lagging member
  applying the removal then refuses old-epoch sessions with the removed device.
- **P3 orchestration + node republish:** `removeCommunityMember` end-to-end + community
  node republish step; Node integration test: 3 in-memory members + loopback relay, owner
  removes B, A drains and (a) closes B's roster row, (b) advances epoch, (c) refuses a
  session with B; hosted-node feed pull by B returns `not_member` after republish.
- **P4 UI both surfaces:** Remove action (owner-only), confirmation with honest copy
  ("Takes effect on each member's device as they receive the update; content shared
  before removal stays on their device"), pending/error states, retire both notices +
  parity guards + CLAUDE.md table/honesty updates.
- **P5 hardening:** deprecate legacy revocation path; membership check added to
  `mergeChannelMessageEvents` apply path (closes the latent channel-mailbox bypass);
  red-team tests (removed member replays old envelope, forged descriptor, wrap
  withholding, downgrade to stale revision).

## Acceptance Criteria

- AC-1: Owner removes a member; every remaining ONLINE member converges within one drain:
  roster closed, new epoch active, sessions with the removed device refused.
- AC-2: The removed device keeps pre-removal content (epoch-boundary honesty) but can
  never decrypt post-removal content nor author accepted new rows on converged peers.
- AC-3: Hosted community node rejects the removed member on its next feed challenge after
  the same single user action (republish included).
- AC-4: Admin (non-owner) does not see an enabled Remove action; the signing model is
  never violated.
- AC-5: A stale or replayed descriptor cannot reopen membership (monotonic guard test).
- AC-6: The `communities.tsx:419` and `ChannelSidebar.tsx:192` notices are gone; new copy
  is honest about convergence; parity guard locks the twins.
- AC-7: FF3 roster-only joiners (no key material) can be removed without wrap errors.

## Negative Criteria

- NC-1: Never claim instant network-wide removal; copy is per-device convergence honest.
- NC-2: Never fall back to `revokeFromWorkspace`/`rotateWorkspaceKey` (fake rotation).
- NC-3: No new crypto; wraps and signatures use existing group-keys/community primitives.
- NC-4: The removal envelope contains no message content, only descriptor + wraps.

## Test Plan

Tier A: protocol pure tests (P0/P1). Tier B: Node integration (P2/P3, three-member
loopback). Tier C: app/vitest handler + UI states + parity + retired-notice absence.
Tier D (founder QA): 2-device removal demo (remove B while offline, B drains later and
is locked out of new content; A and C converge).

## Founder-Ops

None beyond the standard dev build for device QA. Fully codeable now.
