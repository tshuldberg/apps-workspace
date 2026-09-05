# 2026-08-31: Meerkat sequential hardening sweep, full wrap-up (Sets 1-8)

## What

Orchestrated a strictly sequential 8-set hardening sweep of every Meerkat page and expected path on both surfaces. Each set ran one Fable 5 fix agent then one Fable 5 adversarial review agent; the orchestrator (lead) independently re-ran all gates and diffed the tree between every agent. The Set 5 review ran inline by the lead after the review agent hit the account session limit. Prompt chain: `apps/meerkat/docs/prompts/PROMPT-001` through `PROMPT-009-creation-matrix.md` (each file: issue report, resolution, merged lessons, next-session briefing, recursive clause). Generalizable lessons maintained in the workspace skill `Apps/.claude/skills/recursive-bug-hunt/SKILL.md`.

## Totals

Roughly 100 confirmed defects fixed across the sweep (each root-caused, twin-fixed, source-locked):

- Set 1 Feed + share intake: 15 (freeze-class modal races, silent dead taps, back dead-ends, stale targets, viability gating).
- Set 2 Communities: 13 (4 freeze-class incl. the invite sheet under every join door; review caught the Android child-unmount navigation loss in the onboarding host).
- Set 3 Channels/posts/rooms/files: 18 (web archived enforcement missing entirely; review closed 5 more archived write paths incl. room join; 11 file-pipeline dead taps; room toggles could never turn off).
- Set 4 Messages/DMs/calls/friends: 18 (startCall provider-hidden navigation race on 4 surfaces; mobile Leave-group missing; archived channels offered in share pickers; group-create double-mint).
- Set 5 Discover/public/personas: 14 (single-use humanity-token double-spend; stale host-probe gating Publish; unconfirmed destructive block; review pass fixed a false "Nothing was created" claim).
- Set 6 Shell/settings/identity/storage: the sweep P0 - browser-secret-store data loss (unlocked key mint, no-backoff persist hot loop, undetected key-vs-vault half-states) fixed with lock composition, backoff + honest failure surface, key-id-stamped vaults, BootRecoveryScreen; unlock split-brain replaced by a seq-guarded 4-state machine; review found + fixed a NEW P0-class merge-adoption clobber of pending writes; plus a 27-file page sweep.
- Set 7 Library/data hub + sync: 9 (web reader/player stranded spinners from decrypt outside try; fake "copied" claims; review completed the web edit-metadata drift and the alert-under-dismissing-modal class on 4 sheet handlers; live-proved the sealed CbzReader end to end).
- Set 8 Creation variation matrix: 7 (ghost sync change-log rows on failed creation; invisible-character names at 3 entry points, widened by review; category-id collisions + apply-side dedupe for pre-fix descriptors in packages/sync; invisible create failures; misplaced add-channel row) + 33 matrix tests through the real cores.

## Final gates (2026-08-31, run by lead after the last review edit)

- @mylife/meerkat-app: typecheck clean, 1799 tests / 164 files (was 1593 pre-sweep).
- @mylife/meerkat-web: typecheck clean, 1214 tests / 150 files (was 1122).
- @mylife/sync: typecheck clean, 2624 passed / 3 skipped.
- check-meerkat-parity.mjs: all pass. gate:function:changed: exit 0.

## Tree state

ALL work uncommitted in the working tree by founder instruction (~167 changed/new files, includes the pre-sweep age-gate + unlock work and an unrelated docs/reports/RESEARCH-fiscal-* pair from another session). Set-by-set snapshots in the session scratchpad allowed per-set diff attribution.

## Founder actions (consolidated; stranger-readable steps live in each chain file)

1. Commit the tree (or say the word and the lead commits it in logical units).
2. New TestFlight build + the accumulated iOS device checks: Feed sheet transitions (002), Communities handoffs + two-device join (003), channel Delete/Report + overflow + Add to library (004), person-sheet call handoff + DM overflow + group create double-tap + blocked-friend Unblock question (005), clipboard family + offline disconnect + cold deep links (007), library backs + open/remove errors (008), in-sheet create failure + category re-add + Family Space landing (009).
3. Product decisions: community-name length cap (400+ char names currently ride invite links); "Publish publicly" + file-request panel in archived channels (deliberately left open, 004).
4. RevenueCat/ASC items from the unlock-screen session (PROMPT-001) still stand.

## Open follow-ups (carried in PROMPT-009 handoff)

public-post-client.ts:44 raw unlock-cache read; web ingest extension-stripping (3b); web scratch createCommunity purge-on-failure (item 8); dead negative-detail branch in MeerkatProvider revalidate; DoWork env-capture bug (apps/dowork purchases.ts:128, separate app). Set-9 candidates: join-side matrix as second device, live sync over template-created communities, Plan 56 C1-C3 creation intersections, member removal + epoch rotation.
