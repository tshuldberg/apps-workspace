# Meerkat Prompt 03 Audience Rules

Date: 2026-06-24

## Scope

Implemented Prompt 03 for the user-first privacy pivot. The goal was to add a durable V1 audience-rule model, visible audience labels for the current community message/file composer, and code-level reply inheritance tests without widening the sync protocol schema.

## What Changed

- Added `packages/sync/src/protocol/audience-rule.ts` with V1 audience types: `Only me`, `Friends`, `Connections`, `Selected people`, `This community`, and `Public`.
- Exported the audience model from both `packages/sync/src/index.ts` and `packages/sync/src/index.native.ts`.
- Added reply helpers in the shared model:
  - `createReplyAudienceRule`
  - `validateReplyAudience`
  - `audienceRulesEqual`
- Added sync tests proving:
  - public rules carry hosted storage and moderation flags
  - replies derive from the original audience
  - friends-only replies cannot become public
  - selected-people replies cannot add a new viewer
  - `Only me` items do not allow replies
- Added mobile audience UI primitives in `apps/meerkat/app/(root)/components/AudienceRule.tsx`.
- Added web audience UI primitives in `apps/meerkat-web/src/ui/audience/AudienceRule.tsx`.
- Wired the active mobile channel composer and message bubbles to show `This community`.
- Wired the active web channel composer and message rows to show `This community`.

## Product Behavior

Current community channels now answer "Who can see this?" before sending a message or file attachment. Recorded and pending channel messages also show the same audience rule. Public/hosted copy exists in the shared model and UI primitives, but public posting is not exposed because public hosted posting is not implemented yet.

The current code path stays honest: all wired audience labels are `This community`, because the current working composer is a community-channel composer. No friends, selected-people, public, or DM capability was claimed.

## Privacy And Enforcement

The reply invariant now has a shared enforcement point in `@mylife/sync`: a reply audience must equal the original audience rule. Any attempted expansion, such as `Friends` to `Public` or adding a device to `Selected people`, is rejected by `validateReplyAudience`.

No protocol schema was widened in this slice. Existing community access is still enforced by the community descriptor, group keys, signed channel messages, and `shared_workspace` policy. The new model is the reusable contract Prompt 04 can use when posts and replies become visible product surfaces.

## Files Changed

- `packages/sync/src/protocol/audience-rule.ts`
- `packages/sync/src/__tests__/audience-rule.test.ts`
- `packages/sync/src/index.ts`
- `packages/sync/src/index.native.ts`
- `apps/meerkat/app/(root)/components/AudienceRule.tsx`
- `apps/meerkat/app/(root)/(tabs)/channel/[communityId]/[channelId].tsx`
- `apps/meerkat-web/src/ui/audience/AudienceRule.tsx`
- `apps/meerkat-web/src/ui/channel/Composer.tsx`
- `apps/meerkat-web/src/ui/channel/MessageRow.tsx`
- `apps/meerkat-web/src/ui/app.css`
- `memory.md`
- `docs/sessions/2026-06-24-meerkat-prompt03-audience-rules.md`

## Verification

- `pnpm --filter @mylife/sync test -- src/__tests__/audience-rule.test.ts` passed.
- `pnpm --filter @mylife/sync typecheck` passed.
- `pnpm --filter @mylife/meerkat-app typecheck` passed.
- `pnpm --filter @mylife/meerkat-web typecheck` passed.
- `pnpm --filter @mylife/sync test` passed: 89 files, 1175 tests.
- `pnpm --filter @mylife/meerkat-web test` passed: 17 files, 61 tests.
- `pnpm --filter @mylife/meerkat-app test` passed on rerun: 19 files, 157 tests.
- `node scripts/check-meerkat-parity.mjs` passed.
- `pnpm gate:function:changed` passed for Meerkat app, Meerkat web, sync, and downstream consumer typechecks.
- `rg -n "\x{2014}"` on changed code/docs returned no matches.

## Notes

The first `pnpm --filter @mylife/meerkat-app test` run was executed in parallel with the full sync and web suites and hit a load-sensitive existing performance-slope assertion in `saveFilesBulk`. The same command passed immediately when rerun alone, and `pnpm gate:function:changed` also passed the Meerkat app suite with bounded workers. No `errors_log.md` row was added because the failure was not persistent and did not reveal a product bug.

Open Brain MCP tools were not available in this session after discovery. Repo-local memory and this session log were updated instead.

## Remaining Work

- Prompt 04 should use the shared audience model when building post composer, thread view, and reply composer.
- Friends, selected people, public posting, and DMs still need real data paths before their audience selector options are exposed in product flows.
- Public/hosted cost copy is ready in the shared model, but public posting remains hidden until hosted public surfaces exist honestly.

## Recommended Next Prompt

Prompt 04: Posts And Replies.
