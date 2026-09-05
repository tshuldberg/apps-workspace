# MyJournal — Module Audit

**ID:** journal | **Prefix:** jn_ | **Tier:** free | **Storage:** sqlite
**Mobile wired:** yes | **Web wired:** yes | **Version:** 0.1.0
**One-line promise:** Private journal, thought toolkit, and self-reflection suite

## User Value
- Markdown journaling with mood tagging, tags, image/voice attachments, location/weather metadata
- CBT thought records (15 cognitive distortions) with belief reduction tracking
- Therapy prep templates (pre/post session, crisis plan, progress check-in)
- Daily affirmations (8 categories), philosophy quotes (5 traditions), AI-generated mood-aware prompts
- Grid/mandala layouts, vision boards, book builder for physical printed journals

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---|---|---|
| Entry CRUD + notebooks + tags + mood | src/db/crud.ts | shipped |
| Full-text search + pagination | src/db/crud.ts | shipped |
| Voice-to-text recording + transcription | src/voice | shipped |
| Automatic location + weather metadata | src/metadata | shipped |
| CBT thought records (15 distortions) | src/cbt, src/db/cbt.ts | shipped |
| Therapy prep templates (4 types) | src/therapy, src/db/therapy.ts | shipped |
| AI mood-aware prompts (6 themes) | src/ai-prompts | shipped |
| Philosophy quotes (5 traditions) | src/philosophy | shipped |
| Affirmations (8 categories, streaks) | src/affirmations | shipped |
| Grid layouts (4 built-in templates) | src/grid | shipped |
| Vision boards | src/vision-board | shipped |
| Book builder (A5/letter/A4, TOC) | src/book-builder | shipped |
| Writing insights (trends, vocab, tag-mood) | src/engine/writing-insights.ts | shipped |
| Therapeutic progress (belief reduction, distortion rank) | src/engine/therapeutic-progress.ts | shipped |
| Habit intelligence (consistency, richness) | src/engine/habit-intelligence.ts | shipped |
| Smart On-This-Day nostalgia ranking | src/engine/nostalgia.ts | shipped |
| Writing challenges (6 built-in) | src/engine/challenges.ts | shipped |
| Export bundle | src/engine/export.ts | shipped |
| Cross-module hook | src/cross-module.ts | shipped |

## Data Model
Prefix `jn_`, schema v4. 18 tables including jn_entries, jn_journals, jn_tags, jn_entry_tags, jn_settings, jn_voice_recordings, jn_thought_records, jn_thought_record_emotions, jn_thought_record_distortions, jn_therapy_topics, jn_ai_prompts, jn_philosophy_quotes, jn_affirmations, jn_affirmation_logs, jn_grid_cells, jn_grid_layouts, jn_vision_boards, jn_vision_board_items. 25+ indexes.

## Screens / User Flows
Mobile tabs: Today, Entries, Toolkit, Insights, Search, Settings. Stack screens: entry-detail, new-entry, thought-record, therapy-prep, affirmations, philosophy, grid-entry, vision-board, challenges, book-builder. 21 mobile route files, 5 web route files (lighter web surface).

## Distinctive / Moat-worthy
- Absorbs Day One + Daylio + Quirk (CBT) + I Am (affirmations) + Stoic (philosophy) + vision-board apps into one free tier
- Intelligence stack: writing insights + therapeutic progress + habit intelligence + nostalgia scoring (all pure functions, 100+ tests)
- Voice capture + auto-transcription + location + weather captured without any cloud call

## Gaps vs competitors
- No end-to-end encrypted cloud sync (by design; Day One's hook)
- Web surface (5 routes) lags mobile (21 routes)
- No AI-generated summary/insight narratives beyond prompt templates

## Investor-facing hook
The free tier hook of MyLife: a Day One + CBT + affirmations + vision-board suite that ships with 15 cognitive distortions and zero analytics.
