# Meerkat User-First Privacy Current-State Map

Date: 2026-06-24
Status: Prompt 00 implementation map
Scope: `apps/meerkat`, `apps/meerkat-web`, `packages/sync`, `packages/meerkat-relay`

## Purpose

This map records the observed implementation state for the Meerkat user-first
privacy social pivot. It is intentionally narrow: it does not approve product
readiness and does not replace the source specs.

Source specs:

- `docs/plans/active/17-meerkat-user-first-privacy-social-spec.md`
- `apps/meerkat/docs/plans/meerkat-consumer-front-door-decomposition-2026-06-22.md`
- `apps/meerkat/docs/README.md` (current artifact map; the June 23 prompt deck is in git history)

## Current Product Surface

### Mobile App

Observed files:

- `apps/meerkat/app/(root)/(tabs)/_layout.tsx`
- `apps/meerkat/app/(root)/(tabs)/index.tsx`
- `apps/meerkat/app/(root)/(tabs)/share.tsx`
- `apps/meerkat/app/(root)/(tabs)/identity.tsx`
- `apps/meerkat/app/(root)/(tabs)/communities.tsx`
- `apps/meerkat/app/(root)/(tabs)/settings.tsx`
- `apps/meerkat/app/(root)/(tabs)/channel/[communityId]/[channelId].tsx`
- `apps/meerkat/app/(root)/(tabs)/files/[communityId].tsx`
- `apps/meerkat/app/(root)/sync.tsx`

Current primary tabs are `Node`, `Share`, `Identity`, `Communities`, and
`Settings`. This is still node-first. `Communities` and channel chat are real,
but `Feed`, `Messages`, `Friends`, and `Me` are not first-class primary surfaces.

The current `Node` tab renders local pinned content and store stats. The `Share`
tab seals content into encrypted signed blocks, opens share links, verifies
remote hosts before pinning, and exposes technical scope labels from the sync
layer. The `Identity` tab owns display name, friend code, custom friend code,
and safety code. `Settings` holds storage, transport, background sync,
diagnostics, recovery key export, and destructive local reset flows. These are
mostly honest but too prominent for the target consumer IA.

### Web App

Observed files:

- `apps/meerkat-web/src/ui/App.tsx`
- `apps/meerkat-web/src/ui/shell/AppShell.tsx`
- `apps/meerkat-web/src/ui/community/CommunityRail.tsx`
- `apps/meerkat-web/src/ui/community/ChannelSidebar.tsx`
- `apps/meerkat-web/src/ui/channel/ChannelView.tsx`
- `apps/meerkat-web/src/ui/channel/Composer.tsx`
- `apps/meerkat-web/src/ui/files/FilesView.tsx`
- `apps/meerkat-web/src/ui/onboarding/OnboardingOverlay.tsx`
- `apps/meerkat-web/src/ui/settings/SettingsOverlay.tsx`
- `apps/meerkat-web/src/lib/MeerkatProvider.tsx`

The web app already has a Discord-style three-pane shell with a community rail,
channel sidebar, channel view, files view, first-run overlay, and settings
overlay. It is closer to the desired community mental model than mobile.

The web welcome and onboarding still use primary copy such as "private,
decentralized chat node" and "private Meerkat node." Web does not expose
Feed, Friends, or Messages as top-level concepts. It is relay-only by design.

### Sync, Relay, And Hosted Foundation

Observed files:

- `apps/meerkat/app/(root)/data/sync-core.ts`
- `apps/meerkat/app/(root)/data/community-core.ts`
- `apps/meerkat-web/src/lib/schema.ts`
- `apps/meerkat-web/src/lib/meerkat-data.ts`
- `apps/meerkat-web/src/lib/relay.ts`
- `apps/meerkat-web/src/lib/hosted-access.ts`
- `packages/sync/src/protocol/channel-message.ts`
- `packages/sync/src/protocol/community.ts`
- `packages/sync/src/protocol/abuse-rails.ts`
- `packages/meerkat-relay/src/hosted-api.ts`
- `packages/meerkat-relay/src/hosted-pricing.ts`

The network layer is real and must remain the source of transport truth. Both
mobile and web default relay URLs are empty by design. Hosted access exists on
web through hosted entitlement tokens, hosted relay detection, and first-party
hosted API calls. Relay-side hosted entitlement and pricing helpers exist, with
pricing marked illustrative until real invoice inputs replace the defaults.

## Capability Matrix

| Target surface | Current state | Key files | Notes |
|---|---|---|---|
| Primary tabs: Feed, Communities, Messages, Friends, Me | Missing on mobile, partial on web | mobile `_layout.tsx`, web `App.tsx` | Mobile still uses Node, Share, Identity, Communities, Settings. Web uses community shell, not target social IA. |
| Onboarding join/create/friend path | Partial | web `OnboardingOverlay.tsx`, mobile `identity.tsx`, `communities.tsx`, `sync.tsx` | Web has first-run naming only. Mobile has no dedicated first-run path. Join/create/friend actions exist but are scattered. |
| Audience labels and reply inheritance | Missing as product model | `share.tsx`, `community-core.ts`, `channel-message.ts` | Sync scopes exist, but user-facing audience rules like Friends, This community, Public do not exist. No reply inheritance model yet. |
| Posts and thread UI | Foundation only | `community-core.ts`, `schema.ts`, `channel-message.ts`, `MK-P01-post-schema-v2-contract.md` | `cm_posts`, v2 message fields, and parity tests exist. Visible composers still create chat-style events. |
| Feed engine and feed controls | Missing | `cm_post_activity`, `cm_read_state`, web `feed-status.ts` | Read state and activity columns exist, but no user-controlled Feed tab or source toggles. |
| Friends graph and DMs | Partial identity/pairing only | `IdentityProvider.tsx`, `SyncProvider.tsx`, web `MeerkatProvider.tsx`, `sync.tsx`, `SyncDialog.tsx` | Friend codes and paired devices exist. No Friends tab, friend list UX, request inbox, DM workspace, or DM feed rules. |
| Communities | Partial to strong | `communities.tsx`, `ChannelView.tsx`, `community.ts`, web community UI | Signed invite-only communities, channels, roles, members, unread counts, files, and join handoff exist. Copy still exposes internals. |
| Files | Strong local/community file path | `share.tsx`, `files/[communityId].tsx`, `AttachmentCard.tsx`, web files UI | Community files and request/approve/re-send are real. Audience labels are not yet the user-facing frame. |
| Moderation and safety | Protocol partial, UI mostly missing | `abuse-rails.ts`, `community.ts`, `cm_read_state` columns | Report/hash/kill primitives and role enforcement exist. Mute/block/report UI, owner inbox, and member removal UX are missing. |
| Hosted/public cost boundaries | Partial | web `hosted-access.ts`, `RelayBar.tsx`, relay `hosted-api.ts`, `hosted-pricing.ts` | Hosted entitlement gates exist. Product copy and action gates for backup, public posts, public feeds, hosted history, and large storage are incomplete. |
| Pseudonymous community profiles | Partial descriptor names only | `community.ts`, peer name maps in mobile/web channel views | Community member display names exist in descriptors. No per-community profile settings, avatar model, or clear pseudonym copy. |

## Existing Invariants To Preserve

- The app must not implement cryptography directly. Use `@mylife/sync`.
- `mk_` identity, settings, and pinned tables are device-local.
- `cm_file_requests`, `cm_snapshots`, `cm_feed_cursor`, and `cm_post_activity`
  are local-only by omission from the sync policy.
- `cm_read_state` is capped at `personal_replica`.
- `cm_messages`, attachments, posts, tags, and lifecycle replicate as
  `shared_workspace` under community policy.
- v1 channel messages reject unsigned v2 field smuggling.
- v2 channel message fields are signature-covered.
- Channel posting rights are enforced below the UI by community descriptor
  membership and role checks.
- Default relay URL is empty until a real relay is deployed.
- Public or hosted price figures are illustrative unless backed by real
  provider invoice inputs.

## Slice Map

### Prompt 01: Information Architecture

Recommended ownership:

- Mobile: `apps/meerkat/app/(root)/(tabs)/_layout.tsx`, existing tab screens,
  possibly new route files under `apps/meerkat/app/(root)/(tabs)/`
- Web: `apps/meerkat-web/src/ui/App.tsx`, `AppShell.tsx`, navigation state,
  welcome copy, settings placement

Suggested approach:

- Mobile should map old tabs to the target IA:
  - `Node` moves behind `Me` as storage or local library.
  - `Share` becomes a Files action or Me advanced action, not a primary tab.
  - `Identity` moves into `Me`.
  - `Settings` moves behind `Me`.
  - `Communities` stays primary.
- Add honest placeholders for `Feed`, `Messages`, and `Friends` where backing
  features are not yet ready. Empty states should route to real existing actions
  and must not claim delivery, DMs, or followers exist.
- Web should either align top-level labels in the shell or record a parity
  defer with exact follow-up files.

Verification:

- `pnpm --filter @mylife/meerkat-app typecheck`
- `pnpm --filter @mylife/meerkat-app test` if imports or tested surfaces change
- `pnpm --filter @mylife/meerkat-web typecheck` if web labels or navigation change
- `node scripts/check-meerkat-parity.mjs` if labels/screens are parity-sensitive
- `pnpm gate:function:changed` if route logic changes

### Prompt 02: Onboarding

Recommended ownership:

- Mobile: add a first-run route or gate under `apps/meerkat/app/(root)/`
- Existing dependencies: `IdentityProvider.tsx`, `communities.tsx`,
  `SyncProvider.tsx`, `data/db.ts`
- Web: `OnboardingOverlay.tsx`, `IdentityCard.tsx`, overlay host/navigation

Current blockers:

- Mobile has no single onboarding gate.
- QR scan is not observed in the current app surface.
- Hosted default relay is not configured, so onboarding must not imply automatic
  delivery.

Verification:

- `pnpm --filter @mylife/meerkat-app typecheck`
- `pnpm --filter @mylife/meerkat-app test`
- Web typecheck/test if web onboarding changes
- `pnpm gate:function:changed` if persistence or gate logic changes

### Prompt 03: Audience Rules

Recommended ownership:

- New shared-ish app model in `apps/meerkat/app/(root)/data/` or a small local
  utility, plus mirrored web types if web renders the same model.
- UI primitives in `apps/meerkat/app/(root)/components/kit.tsx` or adjacent
  dedicated components.
- Web primitives under `apps/meerkat-web/src/ui/`.
- Protocol changes only if the current `cm_` schema cannot carry the rule.

Current blockers:

- No V1 audience-rule type exists.
- Current `NodeShareScope` labels are sync scopes, not product audience labels.
- Reply inheritance is not represented below the UI yet.

Verification:

- Mobile and web typechecks/tests for touched surfaces
- `pnpm --filter @mylife/sync typecheck/test` if protocol changes
- `node scripts/check-meerkat-parity.mjs`
- `pnpm gate:function:changed`

### Prompt 04: Posts And Replies

Recommended ownership:

- Mobile: new or changed post surfaces under `apps/meerkat/app/(root)/(tabs)/`,
  channel/thread route files, `ChatProvider.tsx` if it becomes post-aware
- Web: `ChannelView.tsx`, `Composer.tsx`, `MessageList.tsx`, possibly new post
  components
- Shared contract: `packages/sync/src/protocol/channel-message.ts`,
  `community-core.ts`, `meerkat-data.ts`

Current blockers:

- `cm_posts` has DDL and policy but no app helper for creating signed post
  headers.
- Visible composers call `createChannelMessage`, not `createChannelMessageV2`.
- No audience inheritance primitive exists unless Prompt 03 lands first.

Verification:

- App/web typecheck and tests
- `pnpm --filter @mylife/sync test` if signed event behavior changes
- `node scripts/check-meerkat-parity.mjs`
- `pnpm gate:function:changed`

### Prompt 05: Feed Engine

Recommended ownership:

- Mobile: new Feed tab route, feed engine under `apps/meerkat/app/(root)/data/`
- Web: feed view/state under `apps/meerkat-web/src/ui/` and mirrored data helper
- Shared data: `cm_read_state`, `cm_post_activity`, message/file aggregation

Current blockers:

- Friends and DMs are not yet productized.
- Mute/block/report-hidden state is not productized.
- Public feed sources do not exist and must remain hidden or explicit as not
  available.

Verification:

- App/web typecheck and tests
- Parity check if feed source terminology or schemas are mirrored
- `pnpm gate:function:changed`

### Prompt 06: Friends And Messages

Recommended ownership:

- Mobile: Friends tab, Messages tab, `SyncProvider.tsx`, `IdentityProvider.tsx`
- Web: identity/friend-code controls, `SyncDialog.tsx`, new friends/messages UI
- Sync: only if DM workspace or direct-message primitives require package work

Current blockers:

- Current "friends" are paired devices plus friend-code rendezvous, not a
  user-facing mutual friend graph.
- No DM schema decision is made. Reuse `cm_` under DM workspaces or add `dm_`
  tables before Feed depends on it.
- No follower work should be included in this slice.

Verification:

- App/web typecheck and tests
- `pnpm --filter @mylife/sync typecheck/test` if pairing, workspace, or message
  protocol changes
- `node scripts/check-meerkat-parity.mjs`
- `pnpm gate:function:changed`

### Prompt 07: Communities And Safety

Recommended ownership:

- Mobile: `communities.tsx`, channel/files screens, new safety UI
- Web: community sidebar/menus, message/file actions, settings/owner overlays
- Sync: `abuse-rails.ts`, `community.ts`, revocation/remove-member primitives if
  needed

Current blockers:

- No observed member removal primitive. Do not fake removal.
- Report primitives exist in `@mylife/sync`, but no app owner inbox UI was
  observed.
- Read-state mute columns exist, but no user safety controls were observed.

Verification:

- App/web typecheck and tests
- Sync tests if moderation or member primitives change
- Parity and function gate

### Prompt 08: Hosted Boundaries

Recommended ownership:

- Web: `hosted-access.ts`, `RelayBar.tsx`, settings, hosted access UI
- Mobile: Settings/Me hosted state copy and gates
- Relay: `hosted-api.ts`, `hosted-pricing.ts`, `server.ts`,
  `community-node-http.ts`

Current blockers:

- Real provider invoice costs are not recorded in code.
- Product pricing beyond the one-time $4.99 app and paid-hosted principle is not
  finalized.
- Public posts/public feed are not built, so do not expose them as live.

Verification:

- App/web typecheck/tests
- `pnpm --filter @mylife/meerkat-relay test` if hosted API changes
- Sync tests if hosted protocol changes
- Parity and function gate

### Prompt 09: Profiles And Pseudonyms

Recommended ownership:

- Sync: `CommunityMember` descriptor fields only if new signed fields are needed
- Mobile: community profile settings and member display surfaces
- Web: matching community profile settings and member display surfaces

Current blockers:

- Descriptor `displayName` exists, but there is no per-community profile editor.
- No avatar model was observed.
- Underlying identity safety copy must make clear that pseudonymity is not total
  anonymity.

Verification:

- App/web typecheck/tests
- Sync tests if descriptor signing fields change
- Parity and function gate

### Prompt 10: Apple-Level Polish

Recommended ownership:

- Mobile and web UI owners, with sync/relay only for defects found during QA.

Prerequisites:

- Prompts 01 through 09 should have landed or explicit defers should be listed.
- Run visual/manual QA only against real states. No fabricated accounts, delivery,
  backup, peer counts, public reach, or hosted state.

Verification:

- Full Meerkat app and web typechecks/tests
- Sync/relay tests if touched
- `node scripts/check-meerkat-parity.mjs`
- `pnpm gate:function:changed`
- Search changed UI/docs for prohibited jargon and em dash characters

## File Ownership By Area

| Area | Mobile files | Web files | Shared/package files |
|---|---|---|---|
| IA and copy | `app/(root)/(tabs)/*`, components kit | `ui/App.tsx`, `ui/shell/*`, navigation | None unless shared constants extracted |
| Onboarding | providers, new route/gate, identity/community screens | onboarding overlay/card, overlay host | Friend-code and identity package APIs only if needed |
| Audience | components, data model helpers | UI primitives and mirrored types | `@mylife/sync` only if persisted protocol changes |
| Posts | channel/post routes, ChatProvider, community-core | ChannelView, Composer, message/list/post components, meerkat-data | channel-message protocol, sync barrels |
| Feed | Feed tab, feed engine helper | feed view/state/helper | none unless data model changes |
| Friends/messages | Friends/Messages tabs, SyncProvider | friend-code/sync UI, new DM UI | pairing/workspace/message primitives if needed |
| Safety | communities/channel/files actions | community menus/message/file actions | abuse rails, community membership, revocation/remove-member |
| Hosted | Me/Settings hosted states | RelayBar/settings/hosted access | relay hosted API, pricing, entitlement checks |
| Profiles | community profile editor and render sites | profile editor and render sites | community descriptor if signed fields change |

## Known Blockers And Decisions

- Decide DM schema before building Feed sources that include private messages.
- Decide whether mobile should create honest placeholder tabs in Prompt 01 or
  wait for backing features. Recommendation: create placeholders with action
  empty states and no fake data.
- Decide exact hosted-service package names and pricing before publishing public
  cost copy.
- Real relay deployment remains absent in code defaults. Leave default relay URL
  empty until a real endpoint is deployed.
- Member removal and key rotation are not observed as a completed app feature.
  Any owner "remove" UI must wait for a real primitive or explain the blocker.
- Public directory, followers, anonymous community posting, voice/video,
  bot/agent posting, and user payments are out of scope for the current prompt
  board unless a later prompt explicitly changes that.

## Recommended Next Prompt

Run Prompt 01: Information Architecture.

Next agent should read first:

- `apps/meerkat/docs/plans/meerkat-user-first-privacy-current-state-map-2026-06-24.md`
- `docs/plans/active/17-meerkat-user-first-privacy-social-spec.md`
- `apps/meerkat/docs/README.md`
- `apps/meerkat/app/(root)/(tabs)/_layout.tsx`
- `apps/meerkat/app/(root)/(tabs)/index.tsx`
- `apps/meerkat/app/(root)/(tabs)/settings.tsx`
- `apps/meerkat-web/src/ui/App.tsx`
- `apps/meerkat-web/src/ui/shell/AppShell.tsx`
