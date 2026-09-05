# MyFlash — Module Audit

**ID:** flash | **Prefix:** fl_ | **Tier:** premium | **Storage:** sqlite
**Mobile wired:** yes | **Web wired:** yes | **Version:** 0.2.0 (schema v5)
**One-line promise:** Never forget what matters

## User Value
- Anki-grade spaced repetition with a modern UI and a true FSRS-inspired scheduler.
- 4 card types (basic, reversed, cloze, occlusion) plus rich media, not just text.
- Match games, multiple choice, AI practice tests, AI conversation practice.
- Competitive leagues with tiers and XP for sustained study.
- Cross-module: pulls vocabulary cards from MyBooks and study decks from MyNotes.

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---------|--------|--------|
| FSRS-inspired scheduler + queue states | modules/flash/src/engine/scheduler.ts, session.ts | shipped |
| Ease factor clamp + leech detection | modules/flash/src/engine/scheduler.ts | shipped |
| Basic/reversed/cloze cards | modules/flash/src/engine/cloze.ts, db (fl_cards) | shipped |
| Image occlusion (rect/ellipse) | modules/flash/src/occlusion/, db (fl_occlusion_regions) | shipped |
| Custom templates | modules/flash/src/templates/, db (fl_templates, fl_template_fields) | shipped |
| Rich media (audio/image) | modules/flash/src/media/, db (fl_media) | shipped |
| Anki .apkg import | modules/flash/src/engine/anki-import.ts | shipped |
| Export with schedule preservation | modules/flash/src/engine/export.ts, db (fl_export_records) | shipped |
| Streaks + badges + reminders | modules/flash/src/streaks/, reminders/ | shipped |
| Match game + best times | modules/flash/src/match/, db (fl_match_results, fl_match_bests) | shipped |
| Multiple-choice engine | modules/flash/src/mc/, db (fl_mc_results) | shipped |
| AI practice tests (MC, T/F, short, fill) | modules/flash/src/practice/, db (fl_practice_tests, fl_practice_answers) | shipped |
| AI conversation practice | modules/flash/src/conversation/, db (fl_conversations, fl_conversation_messages) | shipped |
| AI card generation | modules/flash/src/ai/ | shipped |
| Competitive leagues (5 tiers, XP) | modules/flash/src/leagues/, db (fl_leagues, fl_league_members, fl_league_scores) | shipped |
| Study analytics | modules/flash/src/engine/analytics.ts | shipped |
| Forgetting curve engine | modules/flash/src/engine/forgetting-curve.ts | shipped |
| Cross-module signals (books/notes) | modules/flash/src/engine/cross-module.ts | shipped |
| Card browser + FTS search | modules/flash/src/engine/search.ts | shipped |

## Data Model
- fl_decks, fl_cards, fl_review_logs, fl_media, fl_templates, fl_template_fields, fl_occlusion_regions, fl_match_results, fl_match_bests, fl_mc_results, fl_practice_tests, fl_practice_answers, fl_conversations, fl_conversation_messages, fl_leagues, fl_league_members, fl_league_scores, fl_export_records, fl_settings.

## Screens / User Flows
- Mobile: apps/mobile/app/(flash)/ -- index, decks, study, browser, card-stats, card-types, schedule, match-game, session-analytics, signals, stats, forgetting-curve, import-export, settings.
- Web: apps/web/app/flash/ -- page, decks/, browser/, stats/, import/, settings/, layout.tsx.

## Distinctive / Moat-worthy
- Full Anki parity + Quizlet's game layer + StudyFetch's AI practice, in one module under one suite price.
- Leagues-as-XP without Duolingo-style dark patterns (opt-in, not forced streaks).
- Cross-module study signals (book vocabulary, note-based decks) that no standalone flashcard app can replicate.
- .apkg import parser preserves scheduling state, removing the switching cost from Anki.

## Gaps vs competitors (from COMPETITIVE-MATRIX)
- None -- section 7 marks full competitive parity achieved.

## Investor-facing hook
MyFlash collapses three separate subscriptions (Quizlet, Anki Pro, StudyFetch) into one suite line item while beating them on cross-module study signals.
