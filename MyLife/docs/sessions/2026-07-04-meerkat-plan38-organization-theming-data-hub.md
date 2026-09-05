# 2026-07-04 Meerkat Plan 38 authored: community organization, retheming, data hub

## Founder direction
Users must be able to organize and retheme any of their communities ("servers"), and use Meerkat as a data hub the way Plex sorts movies, if they design their space that way. Confirmed grand scope: a pseudo-internet of webbed, invite-gated (or public) networks carrying whatever data and formats users want.

## What was done
Reviewed meerkat git history (plans 18-37 lineage), the community descriptor (`packages/sync/src/protocol/community.ts`: CommunityChannel is flat `{id,name,postRoles}`; descriptor has no identity/theme/organization fields but a proven conditional-canonical-append pattern), the done Plan 18 theme system (`packages/meerkat-theme`: app-level, per-device only), the files layer (`community-files.ts`: flat name+mimeType index), cm_ table census, and the plan queue (no coverage of either capability; 38 = next number).

Authored `docs/plans/queue/38-meerkat-community-organization-theming-and-data-hub.md`:
- 11 grounded gaps (G1-G11) across Track A (identity/theme/organization) and Track B (Plex-style libraries).
- 8 binding design decisions: structure in the signed descriptor, cosmetics in owner-signed `cm_community_identity` rows (cm_profiles precedent); community theme = Plan 18 codec blob, member-sovereign with high-contrast always winning; a library is a channel `kind`; items are signed metadata rows over content ids; curator-fetch-only enrichment (link-preview NC-2 precedent); local-first honest playback; progress device_local; layout mode is presentation not permission.
- Data model: cm_community_identity, cm_libraries, cm_library_items, cm_library_collections(+items), mk_library_progress, mk_community_prefs; descriptor optional fields (kind/categoryId/order/topic/archived/categories/layout).
- 9 phases (0-8) engine -> identity/retheme -> organization -> library substrate -> metadata pipeline -> browse UX -> playback -> data-hub layout + personal hub -> hardening/parity/honesty.
- Dependencies: after Plan 37 waves; W2 channel-creation fix before Phase 2; Plan 22 copy alignment only. Public library publishing explicitly out (Plan 19 follow-on).

## Files
- New: `docs/plans/queue/38-meerkat-community-organization-theming-and-data-hub.md`
- New: this log.

## Verification
Docs-only session; no function logic changed, function gate skipped per rule.
