# 2026-07-01 Meerkat UI benchmark evaluation (analysis only, no code changes)

## Ask
Review Meerkat git history, then evaluate the mobile UI against production benchmarks: Discord/Slack (communities), Signal/iMessage (messaging), TikTok/Reels/Reddit/X (feeds). Bar: seamless for a broad audience, from boomers to a 7-year-old.

## What was reviewed
- Git history: 48 meerkat-scoped commits, from the 2026-06-14 standalone landing (PR #13) through the Prompts 01-11 consumer IA sprint (2026-06-24/25), Plan 19 public layer, Plan 18 themes, Plan 20 connectivity, Plan 21 DM protocol start (current branch `feature/meerkat-launch-finish`).
- All six primary tabs read in full: Feed (index), Communities, Discover, Messages, Friends, Me, plus channel chat screen, OnboardingGate, kit components, tab layout. Spot checks: post thread (ScrollView), AttachmentCard (image previews exist), QrScanner/QrCode (exist but unused in join/friend flows).

## Verdict (delivered in chat)
Overall roughly 4/10 against the stated bar. Visual design system is strong (7.5/10): consistent tokens, light/dark, a11y labels, skeletons, honest empty states. The gaps are IA and interaction patterns, not aesthetics.

Per surface vs benchmark:
- Communities vs Discord ~4/10: tab is an admin console (create/join forms always on top; per-community cards mix profile editor, members, owner review, publish, invite, leave). Join is paste-a-link; QR components exist unused; no tap-to-join deep-link preview.
- Channel chat vs Discord/Slack ~4.5/10: non-inverted ScrollView (opens at oldest, no virtualization), manual Refresh button (drain runs once on mount), every message is a card with author+timestamp+Saved/Edited+audience badge+always-visible edit/delete/report, two composers on one screen (Posts panel at top, message composer at bottom), raw JSON history import one tap from chat.
- Messages vs Signal ~2/10: honest placeholder tab; DMs not built (Plan 21 protocol begun). Friend add requires typing a ws:// relay URL. SAS emoji safety code is genuinely Signal-grade.
- Feed vs Reddit/X ~3/10 (vs TikTok ~1/10): transparency dashboard, ~40% content; hero explainer, source toggle pills, reason lines, kind pills, honesty notice, excluded-sources panel; no media, no pull-to-refresh, no engagement affordances on cards.
- Onboarding ~6/10: 3 steps to first message is good; step 2 choice overload (3 equal panels); paste-link join; no browse-first lurker path.
- Discover ~5/10: right shape (search, categories, trending, skeletons, 4 states); blocked on deployed directory (founder-ops).

## Systemic gaps
1. Nothing is real-time (manual refresh chat, push deferred behind dev flag).
2. Technical objects still user-facing: ws:// URL fields, meerkat:// paste boxes, JSON manifests, hex ids.
3. HonestNotice paragraph on nearly every screen; consolidate to inline moments + one "what works today" page.
4. Zero list virtualization (all ScrollViews).
5. Actions always visible instead of long-press/swipe progressive disclosure.
6. No media-first surfaces (initial-only avatars, text-only feed).

## Recommended roadmap (chat has full detail)
- Tier 1: tap-to-join invites (deep link + QR + preview sheet); channel chat rebuild (inverted FlatList, right-aligned own bubbles, grouping, long-press menu, focused-drain polling loop); hide relay URL behind Advanced once default relay deploys (Plan 20/29 intent); content-first feed (reason behind a "why" tap, pull-to-refresh, inline images).
- Tier 2: Communities tab becomes a community list > community screen (channel list) > settings screen for all admin; collapse create/join to "+"; wire Plan 21 DM UI into Messages; HonestNotice consolidation.
- Tier 3: reactions, mentions autocomplete, reply-to, image avatars, push enable (founder-ops), link previews.

## Gap in plan coverage
No queue plan owns "consumer chat UX benchmark parity" (18-29 cover themes/public/connectivity/DMs/billing/readiness/calls/participation/proximity/removal/auto-connect). Prompts 01-11 was the last consumer pass. Suggested: author Plan 30 for the Tier 1+2 UX rebuild.

## Files changed
None (analysis only). Session row added to memory.md; Open Brain capture made.
