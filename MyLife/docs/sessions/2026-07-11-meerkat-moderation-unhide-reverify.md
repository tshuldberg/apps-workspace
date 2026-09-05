# 2026-07-11 - Meerkat moderation un-hide defect re-verification

## Task

Re-verify the reported Meerkat moderation defect (reported content hides only while
`cm_safety_actions.status = 'active'`; the only resolution path `markSafetyActionReviewed`
sets a non-active status and un-hides it; no review-and-uphold option) on `main`, and fix
it if it still exists.

## Verdict: defect does NOT exist on main. No fix needed.

The defect was already fixed by the "D.2" hide-vs-review decoupling, which landed in
commit `7722be7d` (feat(meerkat): wave 2). The errors_log row dated 2026-07-06
("P3 moderation un-hide (D.2)") is marked Resolved and that resolution is accurate.

## Evidence verified on main

1. **Helpers** (`apps/meerkat-web/src/lib/community-safety.ts` and byte-twin
   `apps/meerkat/app/(root)/data/community-safety.ts`, identical except one comment word):
   - `isCommunityContentReportHidden` hides while `status IN ('active', 'reviewed')`.
   - `markSafetyActionReviewed(db, id, status)` takes `'reviewed'` (uphold, stays hidden)
     or `'dismissed'` (un-hide). The type excludes `'active'`.
   - `listOwnerReviewItems` keeps `active` and `reviewed` rows in the owner queue; only
     `dismissed` leaves it.
   - `mostHiddenSafetyStatus` protects the file-report reconciliation merge from
     un-hiding via a dismissed duplicate.
2. **UI, both surfaces:** web `CommunitySettings.tsx:104-125` and mobile
   `community/[communityId]/settings.tsx:126-134` both offer "Mark reviewed, keep hidden"
   (uphold) and "Un-hide for me" (dismiss), with a "Reviewed - still hidden" pill.
3. **State model:** the overloaded status is resolved semantically without a schema change:
   `active` = hidden + pending review, `reviewed` = hidden + review upheld,
   `dismissed` = visible + resolved. Full hide/uphold/unhide matrix is representable, so
   no column split or migration is required. Existing rows needed no migration because the
   fix only changed which statuses count as hidden (widening, never un-hiding).
4. **Tests green (run 2026-07-11):**
   - Web: `apps/meerkat-web/src/lib/__tests__/web-community-safety.test.ts` 3/3 passed,
     including "keeps reported content hidden through Reviewed; only Un-hide (dismissed)
     shows it".
   - Mobile: `apps/meerkat/app/__tests__/community-safety.test.ts` 6/6 passed, same matrix
     plus reconciliation-collision hidden-preservation.
5. **Parity green:** `pnpm check:meerkat-parity` passed; the script pins the D.2 marker
   (`status IN ('active', 'reviewed')`) in both twins (script lines 977-984), so a
   regression in either twin fails the gate.
6. **Call-site sweep:** every hide check on both platforms (feed-core, ChannelView /
   channel route, PostThreadView / post route, FilesView / files route, DownloadsView /
   downloads route, InChannelFileCard / AttachmentCard, meerkat-data / community-core
   reaction hiding) routes through `isCommunityContentReportHidden`; no raw
   `status = 'active'` hide query exists outside the mute/block helper, where
   active-only is correct because mute/block clear by row deletion.

## Outcome

No branch created, no code changed. Branch `fix/meerkat-moderation-uphold` not needed.
