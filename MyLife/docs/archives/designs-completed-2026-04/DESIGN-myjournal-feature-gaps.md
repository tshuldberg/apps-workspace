# MyJournal - Feature Gap Design Doc
**Source:** Competitive Feature Analysis (2026-03-05)
**Status:** Complete (100% competitive parity, CEO review 2026-03-24)

## Current State
Full-featured mental wellness suite with 4 schema versions, 15+ engines, 60+ source files. Core journaling (markdown, mood, tags, images, search, streaks, notebooks, export), voice-to-text, automatic metadata (location/weather), CBT thought records (15 distortions), therapy prep templates, AI-powered prompts, philosophy quotes (5 traditions), affirmations (8 categories), grid/mandala layouts, vision boards, book builder, writing insights engine, therapeutic progress engine, habit intelligence engine, nostalgia ranking, and writing challenge system.

## Competitors Analyzed

| Competitor | Pricing | Focus |
|-----------|---------|-------|
| Day One | $35-50/yr | Premium journaling with multimedia, location, cloud sync |
| Reflectly | $20-60/yr | AI-guided journaling with mood tracking |
| Grid Diary | $23/yr | Structured grid/mandala journaling prompts |
| Gratitude | $23/yr | Gratitude journaling, affirmations, vision boards |
| Stoic | $40/yr | Stoicism-based mental wellness journaling with CBT tools |

## Feature Status (all built)

| Feature | Priority | Status | Implementation |
|---------|----------|--------|---------------|
| Rich text entries with photos | P0 | DONE | V1: markdown body + image_uris_json |
| Multiple journals/notebooks | P0 | DONE | V2: jn_journals table with default journal |
| Tag-based organization | P0 | DONE | V1: jn_tags + jn_entry_tags with normalization |
| Streak tracking | P0 | DONE | V1: engine/stats.ts with 1-day grace period |
| Search across entries | P0 | DONE | V1: title + body + tag search |
| On-device storage (privacy) | P0 | DONE | SQLite, zero cloud, zero telemetry |
| Export bundle | P0 | DONE | V1: engine/export.ts with JSON bundle |
| On This Day (nostalgia) | P1 | DONE | V1 + smart ranking via engine/nostalgia.ts |
| Voice-to-text entries | P1 | DONE | V3: voice/ subsystem with recording + transcription |
| Automatic metadata (location, weather) | P1 | DONE | V3: metadata/ subsystem with lat/lon/weather |
| AI-guided prompts (daily questions) | P1 | DONE | V4: ai-prompts/ with mood-aware theme selection |
| Mood tracking per entry | P1 | DONE | V1: 5-level mood enum (low/okay/good/great/grateful) |
| Gratitude prompts | P1 | DONE | V1: engine/prompts.ts gratitude category |
| Mood + entry correlation | P1 | DONE | CEO review: engine/writing-insights.ts tag-mood correlation |
| Grid/mandala layout option | P2 | DONE | V4: grid/ subsystem with built-in layouts |
| Vision board | P2 | DONE | V4: vision-board/ with image/text/quote/goal items |
| Affirmations tracker | P2 | DONE | V4: affirmations/ with 8 categories + streak |
| Philosophy/stoic prompts | P2 | DONE | V4: philosophy/ with 5 traditions |
| CBT thought records | P2 | DONE | V3: cbt/ with 15 distortions + belief tracking |
| Therapy prep templates | P2 | DONE | V3: therapy/ with 4 template types |
| Book builder (layout estimation) | P2 | DONE | V4: book-builder/ with page layout + TOC |
| Writing insights engine | -- | DONE | CEO review: word count trends, vocabulary, tag analysis |
| Therapeutic progress engine | -- | DONE | CEO review: CBT completion, belief reduction, distortion ranking |
| Habit intelligence engine | -- | DONE | CEO review: consistency scoring, richness, best writing day |
| Writing challenge system | -- | DONE | CEO review: 6 challenge definitions with progress tracking |
| Printed books via print partner | P3 | DEFERRED | Requires third-party print API integration |

## Implementation History

All features shipped across 4 schema versions plus CEO review engines:

1. **V1** - Rich text entries, multiple journals, tags, streaks, search, export, dashboard
2. **V2** - Multiple notebooks with default journal
3. **V3** - Voice-to-text, automatic metadata (location/weather), therapy prep, CBT thought records
4. **V4** - AI prompts, philosophy quotes, affirmations, grid layouts, vision boards, book builder
5. **CEO Review (2026-03-24)** - Writing insights, therapeutic progress, habit intelligence, nostalgia ranking, writing challenges

## Privacy Competitive Advantage

Journaling is THE most privacy-sensitive app category. Users write their innermost thoughts, fears, dreams, and secrets. The competitive landscape has significant privacy concerns:

- **Day One** was acquired by Automattic (WordPress parent company). User journal data now sits in a corporate cloud infrastructure. E2E encryption is a paid upsell, meaning free users' most private thoughts are readable by the company.
- **Reflectly** and **Gratitude** store data in cloud services with standard (not E2E) encryption.
- **Stoic** collects mood and mental health data that could be sensitive if exposed.

MyJournal's positioning: **Your thoughts never leave your device.** Zero cloud, zero accounts, zero telemetry. E2E encryption included for free (not a paid feature). This is a genuine competitive moat in a category where privacy directly maps to user trust.

## Cross-Module Integration

| Module | Integration Point |
|--------|------------------|
| MyMood | Mood data recorded in journal entries feeds MyMood analytics. Bidirectional - MyMood trends can surface in journal insights |
| MyHealth | Health journaling for symptom tracking, wellness reflections. Health metrics can auto-populate as entry metadata |
| MyMeds | Medication side effect journaling. Link entries to medication logs for correlation |
| MyHabits | Daily journaling tracked as a habit. Streak data shared between modules |
| MyBooks | Reading reflections and book notes can be journal entries. Link entries to specific books |
