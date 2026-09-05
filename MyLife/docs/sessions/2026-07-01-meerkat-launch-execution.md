# Meerkat Launch Execution - 2026-07-01 (session 2)

Executing the launch plans per `docs/plans/meerkat-launch-orchestration.md` with non-Fable
subagent orchestration (Opus for crypto/security, Sonnet for app wiring; two-stage review
after each task). Founder chose "proceed autonomously in recommended order," checkpoint
after each phase. Branch `feature/meerkat-launch-finish`. CI down (GitHub billing); local
green is the gate.

## Phase 1 COMPLETE: Plan 23 D.6 (Noise forward-secrecy upgrade)
Ran first because it edits `sync-session.ts` before Plan 21 Phase 2 does. Founder decision:
harden the tweetnacl construction in place (no new dependency).
- `f67886c8` real Noise SymmetricState (chaining key + transcript hash binding) + per-message
  ratchet (captured message key reveals no other message) + removed the silent static-key
  downgrade (missing ephemeral leg fails the session unless both sides opt out via `fsOptOut`).
- `100b297c` review fix: fail-closed validation of the wire `msgIndex` (4096 skip window)
  after adversarial review found a DoS (unvalidated index -> CPU hang / uncaught throw).
- Adversarial Opus review: crypto core sound (transcript binding, ratchet one-wayness,
  no silent downgrade, group-epoch exemption). 1417 -> 1428 sync tests green.

## Phase 2 COMPLETE: Plan 19 FF3 close-out (public-join owner approve, end to end)
The last remaining codeable item in Plan 19. Public communities now have a working
request-to-join flow: joiner requests -> owner drains + records -> owner approves (member
add + real epoch-key handoff) -> joiner gets membership. Owner-review-gated because a public
grant is broadcast (unlike an individually issued invite).
- `1cec0347` engine: `PUBLIC_JOIN_REQUEST_MAILBOX_KIND` dispatcher case + `publicJoinRequest`
  handler slot + drain counter; `approvePublicJoinRequest` owner mechanism reusing the invite
  key-handoff rail (extracted `grantMembershipAndParkKey`, invite path proven byte-identical).
- `c39de02c` engine fix (review): approve verifies the owner signature revision-agnostically
  (`verifyPublicationOwnerSignature`) so it survives publication revisions and grant
  revocation actually enforces (genesis-only would have broken on any edit and weakened revoke).
- `a5a2f512` app data: device-local `cm_public_join_requests` queue (explicit device_local
  rule + guard), drain record handler (owner-filtered), `approvePublicJoinRequestById` /
  `declinePublicJoinRequestById` provider methods, both surfaces.
- `1de7930d` app UI: owner "Requests to join" review panel (Approve/Decline) both surfaces,
  honest copy (never a false "Added" when there is no relay; `not_parked` -> "Saved. It will
  be sent when a connection server is available.").
- `947642f6` web fix + `a4621e7b` mobile fix (closing review): the closing review found the
  record handler was wired to a drain nobody called on the owner path (web), and both apps
  never polled the DISTINCT `derivePublicJoinToken` mailbox, so the owner review panel would
  have stayed permanently empty on BOTH platforms. Fixed by unifying web's foreground drain
  with the join handlers and adding the public-join delivery token to both surfaces'
  extra-token derivation (foreground + background), each with a load-bearing negative test
  proving the token, not just the handler, carries delivery. Plus UI approve try/catch.
- Final state: mobile 310, web 183, sync 1428, relay 321; parity + gate green.

Plan 19 is now CODE-COMPLETE (P0-P9 + FF1-FF6 + FF3 close-out). Remaining gates are
founder-ops (deploy relay + community node + directory, 2-device QA); it stays in queue.

## Also this session
- Plan 29 amended (`001b9b6b`) for the founder's presence + async-delivery decision: opt-in,
  peer-validated (signed roster membership), sealed signed beacons with honest TTL, relay
  stays blind, default off. Added a Phase 6 (presence) + revised NC-1.
- Noted: another session added plans 30-32 (UX parity: chat rebuild, nav IA + join, feed +
  media) and production-review v2.0 docs; founder is progressing founder-ops (pnpm-lock,
  meerkat-host.mjs uncommitted in tree, not mine).

## Phase 3 COMPLETE: Plan 21 DMs Phases 2-4 (engine + data + provider plumbing)
Founder sequencing decision: functional plans first, then the UX-parity set 30-32 (with
Plan 30's chat kit built right before Plan 21's DM UI so nothing is built twice).
- `e62df8e1` + `a4c0dd34` Phase 2: DM message + receipt dispatcher/drain wiring, mirroring
  the FF3 pattern; live-relay 1:1 e2e (real bytes) placed in `packages/meerkat-relay` to
  avoid a sync -> meerkat-relay dependency cycle the first attempt introduced.
- `91f13b85` Phase 3: mobile `dm-core.ts` local-only store (8 dm_ tables). dm_ is absent
  from `MEERKAT_SYNC_PREFIXES`/`MEERKAT_SYNC_POLICIES`, proven never-replicate against the
  real `applyReceivedDocumentChanges`.
- `65579b9b` Phase 4: provider send/drain + own-device mirror via a shared pure
  `dm-provider-core.ts` used by BOTH foreground and background drains. Honest delivery:
  'parked' only on real park, 'delivered'/'read' only from a real re-verified inbound
  receipt signature; own-device mirror re-verifies, genuine no-op without a link.
- Closing integration review APPROVED, no issues. The FF3-class delivery-gap risk is clean:
  DMs ride the SAME pairwise mailbox token (`deriveMailboxToken`) every other mailbox kind
  already uses and the drain already polls, and the background-sync parity test independently
  re-derives that token from persisted paired-device state (not the send-side value).
- Final: mobile 341, sync 1441, relay 323; parity + gate green.

Remaining Plan 21: Phase 5 mobile DM UI (HELD for Plan 30 chat kit), Phase 6-7 group DMs,
Phase 8 attachments/block/report/disappearing, Phase 9 web parity, Phase 10 hardening.

## Next
Checkpoint decision: continue Plan 21 non-UI engine phases (6 group epoch, 8 attachments/
block/report) to finish the DM functional layer, or move to Plan 28 (member removal) per the
track order. Then 27, 24, 26; UX set 30-32 after; Plan 25 calls last (needs founder pnpm
install / EAS build).
