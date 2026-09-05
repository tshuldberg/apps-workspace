# Plan 52: Meerkat Person Identity - Linked Devices, One Name, Expandable Device Detail

- **Status:** active (2026-07-29: P0-P6 code COMPLETE on `feature/meerkat-plan52-person-identity`, closed through five adversarial review rounds; awaiting the rc cut that carries plans 52+53 and the founder device sweep for live evidence)
- **Owner:** unassigned (execution session)
- **Created:** 2026-07-29
- **Depends on:** rc13 (the two 2026-07-24 defect fixes: web template-commit transaction ordering, relay probe staleness) merged to main first. This plan then executes and produces rc14. Launch follows rc14 verification. Founder sequencing decision 2026-07-29.
- **Founder decisions encoded here (2026-07-29):** full person model, not name-alignment-only. Default rendering everywhere is ONE person under their chosen name; expanding a profile or a message's details reveals the individual connected devices (PC, Mac, iOS, ...), each of which keeps its own true internal identity. Per-community name selection happens at join time and applies across all of that person's devices. "As close to one user shared across all connected devices" as the device-key architecture allows.

## Why this exists

Verified state of the code today (2026-07-29 review):

- Each device is a standalone identity (own Ed25519/X25519 keypair, own safety code). Nothing carries a display name between a user's own devices; `updateDisplayName` (`apps/meerkat-web/src/lib/meerkat-data.ts:133`) is device-local.
- Per-community pseudonyms ALREADY exist post-join: signed `CommunityProfileEvent` (`packages/sync/src/protocol/community-profile.ts`, `cm_profiles` table) carries `{communityId, memberDeviceId, displayName, avatarInitial, avatarImage(v2)}` verified against the member's signature. There is NO name field in any join flow (`join-flow.ts` verified).
- Own-device linking exists but is DM-mirroring only (`dm_own_devices`).
- The correct replication scope for a shared profile already exists in the engine: `personal_replica` (`packages/sync/src/types.ts:24`), which replicates between a user's own paired devices and no further.
- Member lists, message headers, and moderation all operate per device. A user on three devices appears as three unrelated members.

## Product architecture (binding)

1. **Person group.** A set of device identities mutually attested as one person. Formed only between devices that are already paired AND own-device linked (safety-code compare precedes linking, unchanged). Every device keeps its own keypair; the group never shares or merges private keys.
2. **Mutual attestation, no unilateral claims.** The group document lists member devices and carries a signature from EVERY listed device over the same revision. A doc missing any member's signature does not verify. A device therefore cannot be claimed into a group without signing its own membership, and cannot claim another's.
3. **Presentation profile.** One `personal_replica`-scoped document per person: global `{displayName, avatarInitial, avatarImage}` plus per-community overrides `{communityId -> {displayName, avatarInitial}}`. It replicates over the existing own-device sync. On receipt, each device updates its local identity name and RE-SIGNS ITS OWN `CommunityProfileEvent`s to match, because member rows are device-keyed: alignment means every linked device emits identical profile content under its own signature, never one device signing for another.
4. **Per-community pseudonymity is preserved (hard constraint).** A per-community override always beats the global name. The group identifier shown to a community is DERIVED PER COMMUNITY (`HMAC(groupSecret, communityId)`, groupSecret replicated at `personal_replica` only), so two communities cannot correlate a person's pseudonyms by comparing group ids. Same derivation per DM peer. The stable inner group id never leaves the person's own devices. This mirrors the plan 51 unlinkability posture at the community layer.
5. **Default rendering is the person; devices are one expand away.** Member lists collapse a person's attested devices into ONE row under the community-chosen name. Message headers and DM threads show the person name. Expanding a profile (member row tap/click, message author detail, DM header) shows "Connected devices": each device's label, short device id, and safety code, honestly presented as separate cryptographic identities. No surface hides that devices are distinct; no default surface leads with it.
6. **Moderation at person granularity.** Owner removal of a member removes ALL of that person's attested devices in the community and the epoch rotation excludes all of them (extends the existing removal + `createGroupCommit` machinery). Join requests and owner review display the person (with expandable devices). A removed person's other attested devices cannot silently re-enter on the same invite. Blocking a DM peer blocks the person group as known at block time.
7. **Join-time naming.** The join preview sheet (web dialog, mobile route, onboarding join door, QR path) gains "Your name in this community" (prefilled with the global name). On join it writes the `CommunityProfileEvent` immediately and records the override into the presentation profile so every linked device adopts it.

## Amendments (2026-07-29, P0 execution)

- **Table naming (corrects P0):** the person tables are `pi_person_group` and `pi_presentation_profile` under a new `personidentity` module (prefix `pi_`), NOT `mk_`-prefixed. The shipped convention is that `mk_` tables stay device-local by omission from `MEERKAT_SYNC_PREFIXES` ("Only mp_ + cm_ + the key-wrap table sync"), and the prefix map is one prefix per module, so replicating `mk_` names would erode a load-bearing invariant. `cm_person_links` stays as planned (device_local, explicit rule). A synced `cm_person_announces` table (shared_workspace) carries the P2 membership proofs, mirroring how `cm_profiles` rows travel.
- **Announce signature payload (strengthens P2):** each device signs the canonical announce bytes covering derivedId, context, revision, the FULL sorted device list, and updatedAt, a superset of the planned `derivedId || communityId || revision` triple. Without the device list in the signed bytes, a relaying member could drop a device from the announce while keeping the remaining signatures valid (splice attack). Pinned by test.
- **Secret rotation on removal (strengthens the model):** any revision that removes a device also rotates the group secret, so an expelled or lost device that knew the old secret cannot derive the person's future per-context ids. Communities see a fresh derived id via re-announce; receivers resolve per device by the winning (revision, updatedAt) announce, so the collapse follows the newest attestation.
- **Self-inclusion check placement:** the engine-level inbound validator cannot know the local device id (validator signature is (db, change)), so "this doc actually lists me" is enforced at the app read/apply layer (readPersonGroup returns null when self is not listed), with the validator enforcing structure, mutual signatures, and monotonicity.

## Non-goals / guardrails

- NO shared private keys, no key escrow, no "log in on another device". Devices remain independent identities; recovery-restore stays device REPLACEMENT only (the relay mailbox is consume-once; two live devices must never share a device identity).
- NO server-side person registry. The person group is client-held, replicated at `personal_replica`, and disclosed per community / per DM peer in derived form only. Relays and hosted services never see the inner group id or the group secret.
- NO cross-community correlation: reusing one visible group id across communities is a spec violation, enforced by test.
- Group size hard cap: 8 devices (matches the relay `maxPeersPerToken` posture). Revision counter is monotonic; older revisions are rejected (stale-doc replay cannot resurrect a removed device).
- Removing a device from the group (lost phone) must compose with existing device revocation (`isDeviceRevoked`): a revoked device is also expelled from the group by the next revision, and communities treat its person association as ended at that revision.

## Execution status (2026-07-29)

P0-P5 are IMPLEMENTED and WIRED on `feature/meerkat-plan52-person-identity`, and survived two independent adversarial review rounds (1 CRITICAL + 5 HIGH found and closed). Remaining: the DM-surface collapse, and P6 (final gates, e2e scenario, capability-status entries, tester-guide sections, rc cut).

An independent adversarial review of P0/P1 found 3 HIGH and 7 MEDIUM issues, all fixed and regression-pinned before P2 wiring; see the amendments below and `docs/sessions/2026-07-29-meerkat-rc14-rc16-and-plan52.md`.

## Phases

- **P0 Protocol + schema.** `packages/sync/src/protocol/person-group.ts`: group doc format, canonical signing bytes, all-member mutual signature verification, revision monotonicity, per-context id derivation, size caps. Presentation-profile document format. New tables (web + mobile schema twins): `mk_person_group`, `mk_presentation_profile` (device-local + `personal_replica` policy entries), `cm_person_links` (community-scoped: derived group id -> member device ids, populated from verified announcements). Threat model: stale-revision replay, partial-signature forgery, correlation via derived ids, removed-device races with epoch rotation.
- **P1 Own-device replication + auto-alignment.** Presentation profile + group doc replicate over existing own-device sync at `personal_replica`. On receipt: update local identity name, re-sign owned `CommunityProfileEvent`s for every joined community, refresh DM display naming. Conflict rule: highest revision wins; equal revisions resolve by the existing HLC total order.
- **P2 Community + DM distribution.** `CommunityProfileEvent` v3 adds the community-derived group id (signature-covered); a companion signed `PersonGroupAnnounce` carries the membership proof for that derived id (each member device's signature over `derivedId || communityId || revision`). Members verify and populate `cm_person_links`. DM handshake exchanges the peer-derived equivalent. Verification failure = render as ungrouped device, never a fabricated group.
- **P3 Join-time naming.** Name field in: web Add-a-community join door + invite preview, onboarding join step, mobile `community/join` route including the QR path. Writes the profile event on join and the override into the presentation profile. Prefill from global name; empty falls back to global.
- **P4 Person-collapsed UI + expandable device detail.** Web + mobile: member lists collapse by derived group id under the chosen name with a device-count affordance; expanding shows each device (label, short id, safety code). Message author detail and DM headers get the same expansion. Owner surfaces (members, join requests, owner review, removal) render person-first with device detail available.
- **P5 Moderation semantics.** Person-scoped removal: selecting the person removes all its attested devices and the epoch commit excludes all of them; re-join guard extends to attested siblings; DM block extends to the group; removal/ban copy updated to say devices, plural, honestly.
- **P6 Gates + docs + rc14.** Full battery (sync, relay, app, web), new focused suites for P0-P5, launch-path e2e gains a linked-two-device person scenario, `check:meerkat-parity` extended to the new twinned modules, capability-status entries updated on both platforms, tester guide + walkthrough sections updated, CLAUDE/AGENTS pairs updated, rc14 cut with ledger notes.

## Acceptance criteria

- AC-1: Two own devices, paired and linked, converge on one presentation profile; renaming on either device updates the other and both re-sign their community profiles to the same name.
- AC-2: A community member list shows a 3-device person as ONE row under the community-chosen name; expanding it lists all 3 devices with distinct ids and safety codes.
- AC-3: A name chosen at join time is visible to other members under that community immediately after the first sync, from every one of the joiner's linked devices.
- AC-4: Per-community overrides survive a global rename; two communities observing the same person receive different derived group ids that cannot be equated (test compares announced ids across communities).
- AC-5: Owner removal of a person expels all attested devices and rotates the epoch excluding all of them; a sibling device cannot rejoin on the same invite.
- AC-6: A group doc missing any listed member's signature, carrying a stale revision, or exceeding the device cap is rejected and renders as ungrouped devices.
- NC-1 (negative): a device cannot be added to a group without its own signature over that revision; an attacker replaying an old revision cannot resurrect a removed device; no relay, hosted-service, or log surface ever receives the inner group id or group secret (log-hygiene canary extended).

## Founder-ops (outside this plan's code)

None new. Executes after rc13 on the standard local + CI verification path; the multi-device testbed plus the founder/friend device sweep provide the live evidence for AC-1/2/3 across PC, Mac, and iOS.
