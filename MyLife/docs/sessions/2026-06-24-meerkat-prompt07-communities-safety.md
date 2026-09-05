# Meerkat Prompt 07 - Communities And Safety

Date: 2026-06-24

## Summary

Implemented Prompt 07 across native and web Meerkat. Communities now have local-only safety controls for muting, blocking, reporting, and owner review, and the feed, channel, thread, and Files surfaces filter that local safety state without pretending to moderate other members or rotate keys.

## Changes

- Added `cm_safety_actions` to native and web schema as a local-only table outside `COMMUNITY_SYNC_POLICY`.
- Added shared native and web helpers for community mute, channel mute, member block, report-hidden content, owner review listing, and review status updates.
- Updated the local feed engine to drop muted communities/channels, blocked authors, report-hidden posts/messages, and report-hidden files.
- Added mobile Communities controls for muting communities/channels, blocking members, and reviewing local reports.
- Added web sidebar controls for the same community/channel/member safety actions and owner review.
- Added report actions for channel messages, posts, thread replies, and files on mobile and web.
- Updated channel, post thread, attachment, and Files views so report-hidden content disappears locally.

## Data Model

`cm_safety_actions` is intentionally local-only. It stores mute, block, and report actions with `active`, `reviewed`, or `dismissed` status. It does not sync, notify other devices, remove members, revoke keys, or claim delivery to an owner.

## Privacy Guarantees

- Reports hide content only on the current device and add it to local owner review.
- Blocking a community member hides their posts, messages, and files locally.
- Mutes affect the local feed and unread presentation only.
- Owner review does not imply remote moderation.
- Safe member removal remains blocked until the signed member-removal update plus epoch key rotation path is built.

## Verification

- `pnpm --filter @mylife/meerkat-app typecheck`
- `pnpm --filter @mylife/meerkat-web typecheck`
- `pnpm --filter @mylife/meerkat-web test`
- `pnpm --filter @mylife/meerkat-app test`
- `node scripts/check-meerkat-parity.mjs`
- `pnpm gate:function:changed`

`pnpm --filter @mylife/meerkat-app test` initially hit the known noisy `saveFilesBulk` complexity slope gate already tracked in `errors_log.md`; the immediate rerun passed all 169 tests. Web typecheck initially failed because report-hidden file cards can return `null`; the return type was corrected and the resolved failure was logged.

## Next

Prompt 08: Hosted boundaries and paid-service copy.
