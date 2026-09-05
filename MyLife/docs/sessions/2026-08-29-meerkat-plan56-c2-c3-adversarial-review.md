# 2026-08-29 - Meerkat Plan 56 C2 + C3 adversarial review + fixes

## What

Reviewed the six Plan 56 C2 commits on `main` (`68cb4e2e..24c06f7c`) plus the
in-flight C3 Plaza data layer (`53991c07`, branch
`feature/meerkat-plan56-c3-plaza`) against plan section 7 (security invariants),
section 10 (caps), and the transport-honesty register.

## Verification of guard surfaces (all green at review time)

- `check-meerkat-parity.mjs` passed; mobile 1597, web 1120, sync 2609 (+3 skip).
- Git discipline confirmed: each signed table (`cm_badges`, `cm_asset_packs`,
  `cm_canvas_pixels`) landed DDL + entity rule + inbound validator + fixture in
  one commit. Descriptor untouched (Canvas rides new `kind` VALUES only).
- Persona privacy verified end-to-end: `presentationNameForCommunity` omits
  global bio/pronouns/nameColor/avatar when an override exists, and
  `alignPersonIdentity` projects per-community BEFORE writing the `cm_profiles`
  event; the full `PresentationProfile` stays personal_replica. An override
  community never physically receives the global persona.
- Reaction grammar (`isPackReactionToken`), cross-community reseal
  (`copyProfileDesignForward` / `resealCanvasAssetForCommunity`), anti-spoof
  glyph gate, and chrome-leakage guards all hold for the new node types.

## Findings (3 real defects) and fixes

1. **HIGH - Plaza pixel rate limit bypassable with equal `created_at`** (C3).
   `validateCanvasPixelRow` used a strict `created_at < event.createdAt` upper
   bound, so a burst of same-timestamp pixels each excluded its siblings and all
   applied, defeating the section-10 1/30s cap. FIXED `78d514dc` (C3 branch):
   deterministic `(created_at, id)` upper bound; same-timestamp burst regression
   test (10 -> 1 accepted). Confirmed the test fails against pre-fix code.

2. **HIGH - asset-pack slug/pack hijack via backdated `createdAt`** (C2, main).
   "Original uploader" was the earliest signer-chosen `createdAt` (never
   past-bounded), so any member could reuse a known packId/slug with an old
   timestamp to seize authorship and swap a community's custom emoji. FIXED
   `9127fdf8` (branch `feature/meerkat-plan56-c2-assetpack-authority`): packId is
   now owner-bound (first 128 bits = `sha512(tag|signerPubkey)`); a live pack or
   item event whose packId is not bound to its signer fails
   `verifyAssetPackEvent`, so the hijack never verifies. The timestamp-raced
   original-uploader map is removed; `deriveAssetPackId` mints ids on both
   surfaces.

3. **MEDIUM - asset-pack curator moderation tombstone outrunnable** (C2, main).
   A curator tombstone was entryVersion-LWW, so the uploader re-uploaded at
   version+1 and resurrected moderated content. FIXED in the same commit: a
   curator moderation tombstone (signer is owner/admin but NOT the pack owner) is
   now permanent (`moderationKilled`), mirroring the canvas `curator_remove`; an
   owner self-tombstone stays LWW. New regression test.

## Verification of fixes

- Pixel fix: sync 2610 + gate + parity green; burst test proven to fail pre-fix.
- Asset-pack fix: regenerated the frozen fixture with a bound packId; sync 2603,
  mobile 1596, web 1119, parity, barrel-parity, and full function gate all green.

## Branches

- `feature/meerkat-plan56-c3-plaza`: pixel fix committed (`78d514dc`) on top of
  the Plaza data layer. Ready to continue C3 UI / merge.
- `feature/meerkat-plan56-c2-assetpack-authority`: off `main`, one commit
  (`9127fdf8`). Ready to merge to main. Pre-beta compat note: the packId format
  changed, but C2 shipped with no live pack data, so nothing breaks.

## Notes

- Wire-format change to freshly-merged C2 was approved by the founder before
  reshaping (AskUserQuestion: "Fix both now, bind packId to creator").
- Errors logged in `errors_log.md` (all three, findings 2+3 marked Resolved).
