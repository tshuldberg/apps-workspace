# Meerkat M2 MK-018: Introducer model

Date: 2026-06-11
Branch: `feature/meerkat-network`
Plan: `docs/plans/active/14-meerkat-network-v2-mission-control.md` (M2)

## Goal

MK-018: let a trusted member (the admin) introduce others so a group does not
need every pair to meet. Acceptance: a third member who paired only with the
admin ends up mutually paired with all members (the Syncthing introduction
pattern).

## What was built (library core)

`protocol/introduction.ts` (pure create/verify + a DB-touching apply):

- `IntroductionRecord` = `{ version, workspaceId, introducerDeviceId, subject:
  SignedIdentityBundle, introducedAt }`. The subject is a member's MK-015
  self-signed bundle.
- `createIntroduction(admin, subject, workspaceId)` signs a canonical record
  (binding the subject's signature) under the admin's Ed25519 key.
- `verifySignedIntroduction(signed, expectedIntroducerId?)` checks BOTH the
  subject bundle's self-signature AND the admin's signature over the record. A
  forged admin signature or a swapped subject DH key fails.
- `applyIntroduction(db, identity, signed)`:
  1. verify the introduction;
  2. require the introducer to be a device the recipient has ALREADY paired with
     (you only act on introductions from someone you trust);
  3. reject `self`; TOFU-evaluate the subject (key change is surfaced, not
     silently trusted) and pin on first sight;
  4. `completePairing` with the subject and store the paired device.

The pairing needs no direct contact: X25519 is commutative, so a recipient
computing `DH(self_priv, subject_dhPub)` lands on the same shared secret the
subject computes as `DH(subject_priv, recipient_dhPub)`. The admin's two
introductions (B->C and C->B) leave B and C mutually paired with an identical
shared secret.

## Tests

`introduction.test.ts` (6):
- create/verify round-trip; wrong-introducer rejection;
- forged admin signature rejected; tampered subject bundle rejected;
- **the acceptance**: B and C, each paired ONLY with the admin, both
  `applyIntroduction` the admin's record for the other and end up with a
  paired-device row for each other AND the same `sharedSecretRef` -- a usable
  channel established with zero direct contact; the subject is pinned (TOFU);
- an introduction from an un-paired introducer is refused (`untrusted_introducer`);
- idempotency: re-applying for an already-paired subject is a no-op success.

## Verification

- `@mylife/sync`: 905 tests (was 899; +6). typecheck clean.
- `pnpm gate:function:changed`: EXIT 0.

## Remaining seam (deferred, honestly)

Distributing introductions over a live session and the admin/workspace UI to
trigger them. The Meerkat app has no workspace-membership or admin surface yet
(pairing today is personal), so wiring an introductions UI now would be
decorative -- it is deferred to the workspace UI work. The library is complete
and the transitive-pairing property is proven, so that surface is a thin layer
when the workspace UI lands.

## Remaining M2

MK-019 (revocation v2: signed revocation records gossiped via sessions + relay
mailboxes, CHECKED IN HANDSHAKE; device list UI), MK-020 (recovery key).
