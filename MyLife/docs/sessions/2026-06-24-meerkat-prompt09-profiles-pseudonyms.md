# 2026-06-24 Meerkat Prompt 09 Profiles And Pseudonyms

## Summary

Implemented Prompt 09: per-community display identity for Meerkat, without global anonymity or safety bypasses.

Meerkat now has a signed community profile event stored in `cm_profiles`. A member can choose a display name and avatar initial for a specific community. The event is signed by that member device key, replicated as a shared workspace OR-set row, and only used for display when it verifies and the device is still an active descriptor member.

## Product Behavior

- Mobile and web Communities now show a "Name in this community" editor.
- The editor explains that members see this name on posts, replies, messages, files, and member rows.
- The UI states this is a pseudonym, not anonymity, and keeps the device key visible in member rows for trust and safety.
- Pending, not-yet-approved joiners cannot publish a community profile.
- Posts, replies, channel messages, feed cards, file indexes, and member lists resolve the same community profile name.
- Replies and existing audience behavior were not changed.
- No anonymous posting, global anonymous identity, public directory, bots, or payments were added.

## Implementation Notes

- Added `CommunityProfileEvent` plus create, verify, id, and compare helpers in `packages/sync/src/protocol/community-profile.ts`.
- Added native and web `cm_profiles` schema, shared sync policy, insert/list/resolve helpers, and parity tests.
- Wired native `SyncProvider.setCommunityProfile` and web `MeerkatProvider.setCommunityProfile` to create signed rows and record real sync changes.
- Updated relay policy mirrors so `cm_profiles` is recognized as a shared workspace OR-set.
- Added tests for signature tampering, non-member rejection, latest-profile resolution, and web/native parity.

## Verification

- `pnpm --filter @mylife/sync typecheck`
- `pnpm --filter @mylife/meerkat-app typecheck`
- `pnpm --filter @mylife/meerkat-web typecheck`
- `pnpm --filter @mylife/sync test -- community-profile`
- `pnpm --filter @mylife/meerkat-app test -- community-core`
- `pnpm --filter @mylife/meerkat-web test -- post-schema-v2-parity`
- `pnpm --filter @mylife/sync test`
- `pnpm --filter @mylife/meerkat-app test`
- `pnpm --filter @mylife/meerkat-web test`
- `pnpm --filter @mylife/meerkat-relay test`
- `node scripts/check-meerkat-parity.mjs`
- `pnpm gate:function --file packages/sync/src/protocol/community-profile.ts --tests src/__tests__/community-profile.test.ts`
- `pnpm gate:function:changed`

An initial parallel broad-suite run hit timing-sensitive function-gate slope checks in unrelated existing tests. Both failing tests passed in isolation, and the full sync and native app suites passed when rerun sequentially.

## Remaining Work

- Device QA should verify profile changes across two real members after a sync session.
- Prompt 10 is next: Apple-level polish and readiness review.
