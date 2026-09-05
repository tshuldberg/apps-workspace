# 2026-07-01 Meerkat UX-parity plan authoring (Plans 30/31/32)

## Ask
Take the 4/10 benchmark verdict (`docs/reports/REPORT-meerkat-ui-benchmark-eval-2026-07-01.html`) toward 9-10/10 by authoring the development plans, surfacing major decisions to the founder.

## Founder decisions locked (AskUserQuestion, all recommendations accepted)
1. 5 tabs: Friends merges into Messages (Feed, Communities, Discover, Messages, Me).
2. Segmented Chat | Posts views in every channel (no descriptor schema change).
3. Feed = Reddit/X-style content cards (full-bleed pager explicitly not now).
4. Reactions = quick set of 6 + full emoji picker; protocol carries any single emoji.

## Deliverables
- `docs/plans/queue/30-meerkat-chat-experience-rebuild.md`: shared chat kit (inverted FlatList, grouped bubbles, long-press actions sheet, composer with reply/edit/@mention), reactions over the EXISTING v2 `intent: 'react'` events (channel-message.ts:33, reserved by MK-P01), read-model hygiene so reacts never pollute chat/unread/replyCount, v2-capable ChatProvider send path, segmented Chat | Posts, focused polling drain loop (immediate-on-focus / 5s hot / 10s steady, honest, no status claims) retiring the Refresh button. Kit is the contract Plan 21 Phase 5 DM threads consume.
- `docs/plans/queue/31-meerkat-navigation-ia-and-join.md`: 5-tab merge + Messages shell (Chats + People + add-friend with ZERO transport UI, ConnectionStatusCard for the no-relay state), one join pipeline with four doors (deep link via static `community/join` route, QR with the 2.3KB encoder ceiling honestly handled, paste, onboarding) all through an InvitePreviewSheet (never auto-join), Communities restructure (list -> community screen -> settings holding all relocated admin), onboarding v2 (one question per step + "Just look around" -> Discover), honesty consolidation (`capability-status.ts` + "What works today" page).
- `docs/plans/queue/32-meerkat-content-first-feed-and-media.md`: feed rebuild to founder-approved card anatomy (media, engagement row, `i` why-sheet holding the real reason, filter sheet), pull-to-refresh running the real drain, image avatars as signed community-profile v2 (conditional canonical append, 32KB/128px caps, version column fix for the row mapper), sender-generated link previews as typed attachments (Signal model, receiver never fetches). New deps: expo-image-picker + expo-image-manipulator (founder-ops pnpm install).
- Orchestration master doc updated: Track E (30 -> 31 -> 32) + binding coordination rules (21 Phase 5 consumes 30 kit + 31 shell; 30/29 drain seam; 23 D.4 supersession; 23 D.1/D.2 vs 31 Phase 2 ordering; push stays founder-ops).
- Plan 21 Status Delta: binding UX-set coordination bullet appended.

## Adversarial review (general-purpose agent, code-verified) and fixes
Found 2 blockers, 7 majors, 4 minors; ALL folded into the plan text:
- B1 react events polluting listChannelMessages/unread/replyCount/thread -> new 30 T0.3 exclusion task.
- B2 Intl.Segmenter absent on Hermes (env-dependent validator would reject the default ❤️ quick reaction cross-surface) -> single pure-JS emoji-sequence grammar validator with required emoji test matrix.
- M3 no v2-capable send path existed -> new 30 T0.5; reactions moved into ChatProvider (revision bump) as T0.6.
- M4 `meerkat://community/join` collides with new `community/[communityId]` route -> static intake route + reserved-id guard.
- M5 invite QR exceeds the 2.3KB encoder ceiling at ~10-15 members -> honest fallback + named follow-up.
- M6 cm_profiles row mapper hardcodes version 1 (v2 avatars would fail verify on reload) -> version column + mapper + round-trip test.
- M7 Plan 23 D.1/D.2 vs 31 Phase 2 file collision -> binding ordering rule (both docs).
- M8 AC-5 10s unachievable at 30s idle cadence -> cadence respec (5s hot/10s steady focused) + AC-5 15s.
- M9 "free default is coming" roadmap-promise copy -> ConnectionStatusCard reuse, no new status copy.
- Minors: stale anchors corrected; cm_reactions dead-table disposition added; effectiveRelayUrl sync signature; Plan 21 friends.tsx target rewrite added to 31 T6.2.

## Verification
Em-dash check clean on all authored/edited docs (Plan 21's pre-existing 80 untouched). Reviewer verified anchors against code (45 tool uses). No code changes this session.

## Next
Execute Track E starting with Plan 30 (per master doc, non-Fable rules) once the founder gives the go. Plans stay in queue/ until built.
