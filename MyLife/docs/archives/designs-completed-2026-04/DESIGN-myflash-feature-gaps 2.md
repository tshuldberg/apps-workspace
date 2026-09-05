# MyFlash - Feature Gap Design Doc
**Source:** Competitive Feature Analysis (2026-03-05)
**Status:** Complete (100% competitive parity)

## Current State
Full-featured spaced repetition engine with 4 migrations, 20+ tables, and 14 sub-domains. All P0-P3 features from the original analysis have been implemented. The module now includes study analytics, forgetting curve intelligence, cross-module study signals, Anki import parsing, and session detection.

## Competitors Analyzed

| Competitor | Pricing | Focus |
|-----------|---------|-------|
| Duolingo | $84/yr | Gamified language learning with streaks, leagues, and AI conversation |
| Quizlet | $36/yr | Flashcard platform with AI-generated study materials and shared decks |
| Anki | $25 iOS (one-time), free desktop | Open-source spaced repetition with powerful customization and massive deck library |

## Feature Gaps (Full Build Required)

| Feature | Priority | Competitors That Have It | Implementation Difficulty | Notes |
|---------|----------|--------------------------|--------------------------|-------|
| Flashcard creation (front/back) | P0 | Quizlet, Anki | Low | Basic card creation with text on both sides |
| Spaced repetition algorithm (FSRS) | P0 | Anki | High | Use the Free Spaced Repetition Scheduler algorithm (open source, state of the art). Superior to SM-2 |
| Deck organization | P0 | Quizlet, Anki | Low | Create, rename, reorder decks. Nested deck support |
| Study session with review queue | P0 | Anki | Medium | Daily review queue based on FSRS scheduling. Show due cards, track answers |
| Basic card types (basic, reversed) | P0 | Anki | Low | Front-to-back and back-to-front card variants |
| Import Anki .apkg decks | P0 | Anki | High | Parse .apkg format (SQLite + zip). Massive existing deck library becomes accessible |
| Study statistics (cards due, retention rate) | P0 | Anki | Medium | Cards due today, retention rate, review forecast, time spent studying |
| Cloze deletions | P1 | Anki | Medium | Fill-in-the-blank cards auto-generated from text. Essential for medical/language study |
| Image occlusion | P1 | Anki | High | Hide parts of an image for studying (anatomy diagrams, maps, circuit layouts) |
| Custom card templates | P1 | Anki | Medium | HTML/CSS templates for card layouts. Power user feature |
| AI card generation from text | P1 | Quizlet (Magic Notes) | Medium | Paste text, AI generates flashcards. On-device if possible, opt-in cloud otherwise |
| Rich media cards (audio, images) | P1 | Quizlet, Anki | Medium | Embed audio clips and images in cards. Critical for language learning |
| Shared deck browser | P1 | Quizlet, Anki | High | Browse and download community decks. Could be opt-in P2P or curated library |
| Streak system | P1 | Duolingo | Low | Consecutive days studied. Gamification for retention |
| Daily review reminders | P1 | Anki | Low | Push notifications for due cards. Configurable time and frequency |
| AI practice tests | P2 | Quizlet | Medium | Generate quiz format (multiple choice, matching) from deck content |
| Match game / multiple choice mode | P2 | Quizlet | Medium | Alternative study modes beyond standard flashcard review |
| Competitive leagues | P2 | Duolingo | High | Weekly leaderboards by XP. Requires opt-in social infrastructure |
| AI roleplay/conversation | P2 | Duolingo | High | Practice language via AI chat. Requires on-device or cloud LLM |
| Export to Anki format | P2 | Anki | Medium | Export decks as .apkg for Anki compatibility |

## Recommended MVP Features

Minimal feature set to ship v1 of MyFlash:

1. **Flashcard creation** - Front/back text cards with basic and reversed types
2. **FSRS spaced repetition** - State-of-the-art scheduling algorithm (open source)
3. **Deck organization** - Create and manage decks with nesting support
4. **Study sessions** - Daily review queue with due cards, answer grading, and session summary
5. **Anki .apkg import** - Unlock the entire Anki deck ecosystem on day one
6. **Study statistics** - Cards due, retention rate, review forecast, streak tracking
7. **Cloze deletions** - Fill-in-the-blank cards for efficient knowledge testing

This MVP targets the Anki power user who wants a modern mobile-first experience without sacrificing the algorithm or deck ecosystem.

## Full Feature Roadmap

1. **v1.0 (MVP)** - Card creation, FSRS algorithm, decks, study sessions, Anki import, stats, cloze deletions
2. **v1.1** - Rich media cards (audio, images), daily review reminders, streak system
3. **v1.2** - Image occlusion, custom card templates
4. **v1.3** - AI card generation from text, match game and multiple choice modes
5. **v2.0** - Shared deck browser (opt-in community), AI practice test generation
6. **v2.1** - Export to Anki format, competitive leagues (opt-in)
7. **v3.0** - AI roleplay/conversation for language practice

## Privacy Competitive Advantage

The flashcard/learning space has notable privacy concerns:

- **Quizlet** tracks detailed study behavior, sells aggregated learning data, and uses it for ad targeting. Study patterns reveal what you are learning (medical conditions, career pivots, personal interests).
- **Duolingo** collects extensive behavioral data for its ad-supported tier. Language learning data reveals nationality, immigration status, and career plans.
- **Anki (desktop)** is the privacy gold standard: open source, local-first, no accounts required. However, the iOS app costs $25 and the mobile UI is dated.

MyFlash's positioning: **Anki-grade privacy with a modern mobile-first UI.** All study data stays on-device. FSRS algorithm runs locally. No accounts, no telemetry, no study behavior tracking. Users studying sensitive topics (medical boards, legal exams, language for immigration) can study without their learning patterns being monetized.

## Cross-Module Integration

| Module | Integration Point |
|--------|------------------|
| MyHabits | Daily study streaks tracked as habits. Study session completion triggers habit check-in |
| MyBooks | Vocabulary cards generated from reading. Highlight a word in MyBooks, create a flashcard in MyFlash |
| MyMeds | Medical study aids. Pre-built pharmacology, anatomy, and medical terminology decks |
| MyHealth | Memory training metrics. Track cognitive performance trends over time via study retention rates |
| MyNotes | Create flashcards directly from note content. Select text in MyNotes, generate cards in MyFlash |
