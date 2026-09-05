# 2026-09-01 — FlashCards standalone extraction + Chinese study system

## What

Broke the MyLife `flash` module out into a fully standalone, independently installable
app at `Apps/FlashCards` (own git repo, 3 commits), and built the feature set the
first user (Trey's friend, studying Chinese) needs before deployment. Founder
decisions taken via AskUserQuestion: name "FlashCards", iOS/Android Expo only,
standalone becomes canonical with hub parity backport later, TestFlight via EAS.

## How

- Extraction followed the TrainWithRyan pattern: pnpm workspace with vendored
  `@mylife/db` (from TWR), `@mylife/module-registry` (types only), minimal
  `@mylife/ui` (tokens + 9 components), `@mylife/typescript-config`, and
  `modules/flash` copied to `packages/flash` (all 338 tests passed unmodified).
  MyLife repo untouched; `modules/flash` remains in place for the hub.
- 14 hub screens ported into a root expo-router Tabs navigator; TWR's
  DatabaseProvider adapted (flash migrations on local `flashcards.db`).
- Friend requirements (from screenshots) implemented:
  1. English prompt, self-rate 1-5 (colored circles like their reference app).
  2. Split ratings: pronunciation and character recognition are independent
     scheduled axes per card (`fl_card_axes`, migration v6).
  3. Rating-driven SRS: 1 = 5 min, 2 = 30 min, 3 = 1 day, 4 = 2 days, 5 = 2 days
     then multiplicative growth (`scheduleAxisReview`).
  4. Writing quiz: hanzi-writer in a WebView (37 KB runtime inlined), stroke data
     for 9,574 characters precompiled into a 39 MB read-only SQLite asset via
     `scripts/build-hanzi-assets.mjs`; hint / erase / stroke-animation tools;
     mistake count suggests the rating. Fully offline.
  5. zh-CN TTS via expo-speech on review and writing screens.
  Plus Chinese card creation mode in Decks and paste-import
  (`english | pinyin | hanzi`) in Import/Export.

## Verification

- 365 tests green (338 inherited + 21 chinese engine + 6 vocab parser); typecheck
  clean (app + 5 packages); `expo export` clean.
- App booted in the iOS simulator (Expo Go): Study tab renders, v1-v6 migrations
  applied, Default deck seeded.
- WebView quiz proven in Chrome: synthesized pointer strokes along character
  medians produced `charComplete(月, 0 mistakes)` + `allComplete`; hint/erase/
  animate commands work; zero console errors. hanzi.db integrity script validates
  9,574 rows.

## Files

- New repo `Apps/FlashCards` (commits `20ecffe`, `068a50b`, `36ed12b`).
- MyLife: this log + memory.md rows only (no function logic changed in MyLife, so
  no MyLife function gate run).
- Apps workspace: AGENTS.md project table now lists FlashCards and TrainWithRyan.

## Remaining / follow-ups

- Founder: ASC app record + `eas build --profile testflight` + tester invite
  (click-by-click runbook: `FlashCards/docs/guides/testflight-runbook.md`).
- Hub parity backport session: port migration v6, chinese engine, review/write
  screens back into MyLife `modules/flash` + `apps/mobile` + `apps/web`.
- Device pass on a real iPhone before the friend: writing canvas latency, TTS
  voice availability, hanzi.db asset copy on first launch.
- Open Brain MCP tools were not exposed in this session (server connected but no
  tools in the registry), so no captures were made; capture this session next time.
- Note: a Metro dev server (port 8090) and a python http.server (port 8899) may
  still be running from verification; kill manually if present.
