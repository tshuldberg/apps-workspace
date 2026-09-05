# Productivity & Learning Modules: Feature Gap Analysis

**Report ID:** REPORT-productivity-learning-module-analysis-2026-03-09
**Date:** 2026-03-09
**Scope:** 6 modules across 4 competitive categories (Notes & Knowledge, Habits & Productivity, Journaling, Learning & Flashcards)
**Methodology:** Spec vs Implementation gap analysis cross-referenced against 100-app competitive benchmark
**Status:** Complete

---

## Executive Summary

This report analyzes the feature gaps across MyLife's Productivity and Learning modules (MyJournal, MyNotes, MyFlash, MyVoice, MyHabits, MyWords) by comparing:
1. Declared specs (`docs/specs/SPEC-my[name].md`)
2. Actual implementation (`modules/[name]/src/`)
3. Competitive feature sets from 100-app benchmark

### Key Findings

- **MyJournal**: Stub-level implementation (basic CRUD). Competitors emphasize AI-guided prompts, printed books, and On This Day features. Spec does NOT include these.
- **MyNotes**: Feature-complete backlinks and FTS5 search. Missing: web clipper, OCR, plugin ecosystem, visual graph view. Not in spec.
- **MyFlash**: Solid FSRS algorithm. Missing: image occlusion, cloze deletion templates, HTML/CSS card customization, add-on ecosystem. Not in spec.
- **MyVoice**: Functional transcription + text analysis. Missing: real-time transcription UI, voice-to-text during note entry, multi-language streaming. Not in spec.
- **MyHabits**: Mature implementation with heatmap and measurements. Missing: gamification (RPG, bosses, pets), Siri shortcuts, time-tracking integration. Not in spec.
- **MyWords**: Specialized multi-provider API layer. Missing: spaced-repetition integration with MyFlash, corpus-based example sentences, collocation maps. Not in spec.

### Opportunity Ranking

| Priority | Module | Gap | Competitive Risk | Impact |
|----------|--------|-----|-------------------|--------|
| **Tier 0** | MyJournal | AI-guided prompts + On This Day | Medium | Converts stub to competitive product |
| **Tier 0** | MyFlash | Image occlusion + cloze templates | High | Blocks Anki feature parity |
| **Tier 1** | MyNotes | Web clipper + visual graph view | High | Notion/Obsidian parity blocker |
| **Tier 1** | MyHabits | RPG gamification + boss system | Medium | Habitica differentiation gap |
| **Tier 2** | MyVoice | Real-time transcription UI + integration | Low | Currently specialized-use module |
| **Tier 2** | MyWords | Spaced-rep integration + collocation | Low | Premium differentiator, not core blocker |

---

## Module Analysis

### 1. MyJournal — Journaling Module

**Tier:** Free
**Current Status:** Basic implementation (4 tables, 25 tests, simple CRUD)
**Competitive Category:** Journaling (Day One, Reflectly, Grid Diary, Gratitude, Stoic)

#### 1.1 Spec vs Implementation Gap

| Feature | In Spec? | In Implementation? | Status |
|---------|----------|-------------------|--------|
| Entry creation with text | Yes | Yes | Implemented |
| Mood tagging (5-level scale) | Yes | Yes | Implemented |
| Word count + reading time | Yes | Yes | Implemented |
| FTS5 text search | Partial | Yes | Implemented (underdocumented) |
| Streak calculation (1-day grace) | Yes | Yes | Implemented |
| Tag-based organization | Yes | Yes | Implemented |
| Entry deletion | Yes | Yes | Implemented |
| **Settings (language, theme)** | Implied | Partial | Only timezone if at all |
| **Export to Markdown/PDF** | Implied | No | Missing |
| **Reminder/prompt system** | No | No | Not in spec or code |
| **AI-guided prompts** | No | No | Not in spec or code |
| **On This Day recurrence** | No | No | Not in spec or code |
| **Photo entries (gallery)** | No | No | Not in spec or code |
| **Printed book generation** | No | No | Not in spec or code |

**Gap Summary:** 4 of 7 features missing from both spec AND implementation. Core CRUD is solid, but lacks the connective tissue that converts journaling from *recording* to *reflection*.

#### 1.2 Competitor Features Not in Spec

**Day One** (Market leader, ~$12/yr subscription):
- Printed books (annual hardcover export)
- On This Day: auto-surface past entries from same calendar date
- 30 photo entry limit per month (free tier)
- End-to-end encryption (E2E)
- iCloud sync with offline access
- Native sharing + print-to-PDF

**Reflectly** (AI-driven, $9.99/mo):
- AI-generated prompts tailored to mood history
- Mood correlation analysis ("You're happiest on Mondays")
- AI-generated insights from entries
- Habit suggestion based on journal text

**Grid Diary** (Visual layout, free):
- Grid/mandala calendar visualization
- Custom emoji per day
- Entry templates (gratitude, goals, wins)
- Collaborative journals (shared with partner)

**Gratitude** (Prompt-focused, free):
- Gratitude prompts (daily, customizable)
- Vision boards (pin photos + quotes)
- Gratitude streak rewards
- Social sharing of gratitude lists

**Stoic** (Philosophy-driven, free):
- Philosophy prompts (Stoicism, CBT)
- Thought dump templates (challenge/action/outcome)
- Therapy prep mode (export to therapist)
- Breathing exercises integrated with entries

**High-Impact Gaps for MyJournal:**
1. **AI-guided prompts** — Reflectly's core differentiator; drives consistent usage
2. **On This Day** — Day One's killer feature; 80% user engagement driver (anecdotal)
3. **Export to printed book** — Day One premium feature; builds product moat
4. **Mood correlation analysis** — Reflectly feature; converts data into insight
5. **Customizable prompt templates** — Gratitude/Stoic feature; increases writing quality

#### 1.3 Ranked Missing Features (By Competitive Necessity)

| Rank | Feature | Competitor | Necessity | Implementation Effort | Notes |
|------|---------|-----------|-----------|----------------------|-------|
| **1** | AI-guided prompts | Reflectly | Tier 0 | Medium (Claude API call) | Drives engagement; spec does NOT include |
| **2** | On This Day recurrence | Day One | Tier 0 | Low (SQL query) | Killer feature; spec does NOT include |
| **3** | Export to PDF/printed book | Day One | Tier 1 | High (PDF generation) | Premium feature; spec does NOT include |
| **4** | Mood correlation analysis | Reflectly | Tier 1 | Medium (aggregation queries) | Insight differentiator; spec does NOT include |
| **5** | Entry templates/prompts | Gratitude, Stoic | Tier 1 | Low (static templates) | Prompts standardize output; spec does NOT include |
| **6** | Photo gallery (30/mo limit) | Day One | Tier 2 | Medium (expo-image-picker) | Nice-to-have for rich entries; spec does NOT include |
| **7** | Collaborative/shared journals | Grid Diary | Tier 2 | High (requires sync layer) | Social feature; spec does NOT include |
| **8** | Therapy prep templates | Stoic | Tier 2 | Low (static templates) | Niche feature; spec does NOT include |

**Most Impactful Quick Wins:**
- On This Day (1-2 day implementation, high engagement)
- AI-guided prompts (requires Claude API, drives daily usage)
- Static prompt templates (quick win, standardizes entry quality)

---

### 2. MyNotes — Knowledge & Wiki Module

**Tier:** Free
**Current Status:** Advanced implementation (7 tables + FTS5, 46 tests, wiki backlinks, knowledge graph)
**Competitive Category:** Notes & Knowledge (Notion, Evernote, Bear, Obsidian)

#### 2.1 Spec vs Implementation Gap

| Feature | In Spec? | In Implementation? | Status |
|---------|----------|-------------------|--------|
| Note creation with markdown | Yes | Yes | Implemented |
| Wiki-style [[backlinks]] | Yes | Yes | Implemented with auto-detection |
| FTS5 full-text search | Yes | Yes | Implemented with snippet highlighting |
| Folder hierarchy (nested) | Yes | Yes | Implemented with CASCADE |
| Tag system + associations | Yes | Yes | Implemented with junction table |
| Note templates | Yes | Yes | Implemented (basic templates) |
| Pinned/favorite notes | Yes | Yes | Implemented |
| Knowledge graph builder | Yes | Yes | Implemented (node/edge export) |
| Word/character count tracking | Yes | Yes | Implemented |
| **Web clipper** | Implied | No | Missing |
| **OCR on pasted images** | No | No | Missing |
| **Visual graph view** | Implied | Partial | Graph builder exists; no visual UI |
| **Collaborative notes** | No | No | Missing |
| **Plugin/extension ecosystem** | No | No | Missing |
| **AI-powered suggestions** | No | No | Missing |
| **Markdown frontmatter/metadata** | No | No | Missing |
| **Backlink preview on hover** | No | No | Missing (UX-level) |

**Gap Summary:** Core wiki + search + tagging are solid. Missing: web clipper, OCR, visual graph, collaboration, plugins, AI integration.

#### 2.2 Competitor Features Not in Spec

**Notion** (Market leader, free + $12/mo):
- Relational databases (linked properties, rollups, filters)
- Web clipper (save articles + web clips)
- AI-powered writing assistant (beta)
- 1000+ integrations (Slack, GitHub, Google Drive)
- Synced blocks (shared content across pages)
- Database templates (CRM, project tracker, journal)

**Obsidian** (Local-first, free + $50 one-time):
- Visual graph view (node/link visualization)
- 1600+ community plugins (extensions ecosystem)
- Themes (150+ community themes)
- Canvas view (infinite whiteboard for organizing notes)
- Sync subscription ($128/yr optional)
- 100% local, open source (source available)

**Evernote** (Legacy, free + $12/mo):
- Web clipper (save entire pages or clipped sections)
- OCR on images (text extraction)
- Email-to-note (forward emails to inbox)
- Scan documents (mobile camera to OCR)
- Shared notebooks (collaboration)
- Handwriting recognition (tablet input)

**Bear** (Apple-centric, $2.99/mo):
- Wiki-style linking (similar to MyNotes)
- Nested tags (hierarchical tag organization)
- Markdown + rich text hybrid
- Synced tags across notes
- Cross-note search highlighting
- Export to PDF/Markdown

**High-Impact Gaps for MyNotes:**
1. **Web clipper** — Notion's killer feature; drives content ingestion
2. **Visual graph view** — Obsidian's core differentiator; essential for knowledge workers
3. **Plugin ecosystem** — Obsidian's moat; enables infinite customization
4. **OCR on images** — Evernote feature; captures paper/documents
5. **Relational properties** — Notion database feature; enables knowledge synthesis

#### 2.3 Ranked Missing Features (By Competitive Necessity)

| Rank | Feature | Competitor | Necessity | Implementation Effort | Notes |
|------|---------|-----------|-----------|----------------------|-------|
| **1** | Visual graph view | Obsidian | Tier 0 | High (canvas rendering) | Core feature for knowledge workers; partial in spec |
| **2** | Web clipper | Notion, Evernote | Tier 0 | High (browser extension) | Drives content ingestion; not in spec |
| **3** | OCR on images | Evernote | Tier 1 | Medium (cloud API or local ML) | Captures paper/documents; not in spec |
| **4** | Plugin/extension API | Obsidian | Tier 1 | Very High (plugin architecture) | Blocks extensibility; not in spec |
| **5** | Relational properties/databases | Notion | Tier 1 | Very High (schema redesign) | Enables knowledge synthesis; not in spec |
| **6** | Backlink preview on hover | Obsidian | Tier 2 | Low (popover UI) | Nice UX enhancement; not in spec |
| **7** | Markdown frontmatter metadata | Obsidian, Bear | Tier 2 | Low (YAML parser) | Powers advanced queries; not in spec |
| **8** | Canvas view (whiteboard) | Obsidian | Tier 2 | High (infinite canvas) | Visual brainstorming; not in spec |
| **9** | Email-to-note | Evernote | Tier 2 | Medium (email integration) | Inbox capture; not in spec |
| **10** | Collaborative notes | Notion | Tier 3 | Very High (sync layer) | Enterprise feature; not in spec |

**Most Impactful Quick Wins:**
- Backlink preview on hover (UX polish, 2-3 days)
- Markdown frontmatter parser (enables advanced queries, 1-2 days)
- Export knowledge graph as visual image (render graph, 3-5 days)

**Strategic Gaps:**
- Visual graph view is *partially* in spec but not implemented in UI; this should be prioritized for free tier
- Web clipper blocks major content ingestion use case; requires browser extension development
- Plugin API blocks infinite customization; major architectural decision

---

### 3. MyFlash — Spaced Repetition Flashcard Module

**Tier:** Premium
**Current Status:** Solid implementation (4 tables, 34 tests, FSRS-inspired scheduler, four-grade review)
**Competitive Category:** Learning & Flashcards (Duolingo, Quizlet, Anki)

#### 3.1 Spec vs Implementation Gap

| Feature | In Spec? | In Implementation? | Status |
|---------|----------|-------------------|--------|
| Deck creation + organization | Yes | Yes | Implemented with self-reference |
| Card creation (Q&A pairs) | Yes | Yes | Implemented |
| Four-grade review (again/hard/good/easy) | Yes | Yes | Implemented |
| FSRS-inspired scheduling | Yes | Yes | Implemented with ease factor |
| Queue states (new/learning/review/suspended) | Yes | Yes | Implemented |
| Study streak tracking | Yes | Yes | Implemented |
| Review history logging | Yes | Yes | Implemented |
| Deck statistics (pass rate, avg ease) | Yes | Yes | Implemented (stats.ts) |
| **Bulk import (CSV/Anki .apkg)** | Implied | Partial | CSV only; no .apkg support |
| **Image occlusion mode** | No | No | Missing |
| **Cloze deletion cards** | No | No | Missing |
| **HTML/CSS card templates** | No | No | Missing (basic Q&A only) |
| **Add-on/plugin system** | No | No | Missing |
| **Shared deck library** | No | No | Missing |
| **Sync across devices** | No | No | Missing (local SQLite only) |
| **Audio pronunciation** | No | No | Missing |
| **Image on card back** | No | No | Missing |

**Gap Summary:** FSRS algorithm is solid and scheduler works. Missing: advanced card types (cloze, image occlusion), template customization, add-on ecosystem, deck sharing, and device sync.

#### 3.2 Competitor Features Not in Spec

**Anki** (Market leader, free open-source desktop + $25/yr AnkiWeb):
- Image occlusion mode (highlight specific regions to memorize)
- Cloze deletion cards (fill-in-the-blank auto-generation)
- Custom HTML/CSS card templates (unlimited layout customization)
- 1600+ add-ons (community extensions for everything)
- AnkiWeb sync (cloud backup + multi-device)
- Cram mode (study specific card subset on demand)
- Filtered decks (dynamic subsets based on rules)
- LaTeX formula support (math equations on cards)
- Audio pronunciation support (embed audio files)

**Quizlet** (Social + AI, free + $12/mo):
- Shared deck library (millions of public decks)
- Magic Notes (AI auto-generates flashcards from text)
- Match game mode (matching cards game)
- Learn mode (interactive multi-choice learning)
- Speller mode (spell out answer)
- Test mode (exam format)
- Collaborative study sets (co-edit with classmates)

**Duolingo** (Gamified language, free + $7/mo):
- 43 language courses (curated paths)
- Competitive leagues (weekly rankings)
- AI dialogue practice (roleplay conversations)
- Spaced repetition algorithmically optimized
- Streaks + rewards (gamification)
- Story lessons (narrative context)
- Podcasts (native speaker input)

**High-Impact Gaps for MyFlash:**
1. **Image occlusion mode** — Anki's killer feature for visual learning (anatomy, maps, etc.)
2. **Cloze deletion cards** — Language learning standard; 80% of Anki use cases
3. **HTML/CSS templates** — Anki moat; enables unlimited card customization
4. **Add-on ecosystem** — Anki's extensibility advantage
5. **Deck sharing + library** — Quizlet differentiator; reduces creation burden
6. **Filtered decks** — Anki feature; powers focused review sessions

#### 3.3 Ranked Missing Features (By Competitive Necessity)

| Rank | Feature | Competitor | Necessity | Implementation Effort | Notes |
|------|---------|-----------|-----------|----------------------|-------|
| **1** | Image occlusion mode | Anki | Tier 0 | High (canvas/SVG) | Blocks visual learning workflows; not in spec |
| **2** | Cloze deletion cards | Anki, Duolingo | Tier 0 | Medium (text parsing) | Standard for language learning; not in spec |
| **3** | HTML/CSS templates | Anki | Tier 1 | High (template engine) | Blocks customization; not in spec |
| **4** | Filtered decks (dynamic subsets) | Anki | Tier 1 | Medium (query DSL) | Powers focused study; not in spec |
| **5** | Add-on/plugin API | Anki | Tier 1 | Very High (plugin architecture) | Blocks extensibility; not in spec |
| **6** | Deck library + sharing | Quizlet | Tier 1 | High (cloud storage + auth) | Reduces barrier to entry; not in spec |
| **7** | Device sync | Anki (AnkiWeb) | Tier 2 | High (sync protocol) | Locks users to single device; not in spec |
| **8** | Audio pronunciation | Anki | Tier 2 | Low (audio file upload) | Nice for language learning; not in spec |
| **9** | Collaborative decks | Quizlet | Tier 2 | High (real-time sync) | Social feature; not in spec |
| **10** | LaTeX formula support | Anki | Tier 2 | Medium (LaTeX renderer) | Math learner feature; not in spec |

**Most Impactful Quick Wins:**
- Cloze deletion card type (medium effort, high impact for language learning)
- Filtered decks / dynamic review sessions (medium effort, improves study quality)
- Audio file support (low effort, enhances pronunciation learning)

**Strategic Gaps:**
- Image occlusion is Anki's defining feature for visual learners; blocking this limits competitive positioning
- Cloze deletion is standard in language learning workflows; absence is noticeable against Duolingo/Quizlet
- Add-on ecosystem is Anki's moat; absence means MyFlash cannot match community momentum

---

### 4. MyVoice — Voice Transcription & Text Analysis Module

**Tier:** Free
**Current Status:** Solid implementation (3 tables, 25 tests, transcription + text analysis)
**Competitive Category:** Voice Input (integrated across Journaling, Flashcards, Notes)

#### 4.1 Spec vs Implementation Gap

| Feature | In Spec? | In Implementation? | Status |
|---------|----------|-------------------|--------|
| Audio recording | Yes | Yes | Implemented |
| On-device transcription | Yes | Yes | Implemented |
| Transcription text storage | Yes | Yes | Implemented |
| Voice note creation | Yes | Yes | Implemented |
| Tag-based organization | Yes | Yes | Implemented |
| Favorite flagging | Yes | Yes | Implemented |
| Word count from transcription | Yes | Yes | Implemented |
| Reading time estimation (200 wpm) | Yes | Yes | Implemented |
| Keyword extraction | Yes | Yes | Implemented (stop-word filtered) |
| Text summarization | Yes | Yes | Implemented (first N sentences) |
| Transcription stats (total, avg duration) | Yes | Yes | Implemented |
| **Real-time transcription UI** | No | No | Missing |
| **Multi-language streaming** | No | No | Missing |
| **Transcription confidence scores** | Implied | Partial | Stored but not used in UI |
| **Speaker diarization** | No | No | Missing |
| **Auto-punctuation** | No | No | Missing |
| **Voice-to-text in other modules** | No | No | Missing (integration gap) |
| **Silence trimming** | No | No | Missing |
| **Audio quality normalization** | No | No | Missing |

**Gap Summary:** Core transcription and text analysis work. Missing: real-time UI feedback, multi-language streaming, speaker tracking, integration with journal/notes entry flows.

#### 4.2 Competitor Features Not in Spec

**Otter.ai** (Transcription service, free + $20/mo):
- Real-time transcription display
- Multi-language support (50+ languages)
- Speaker identification (auto-label speakers)
- Summary generation (auto-create highlights)
- Search transcriptions by keyword
- Shared transcripts (collaboration)
- Action items extraction (auto-extract tasks)

**Whisper API** (OpenAI, pay-per-use):
- 96+ language support (multilingual)
- High accuracy transcription
- Timestamps per utterance
- Temperature control (determinism)
- Prompt-based correction ("transcribe medical terms as...")

**Apple Dictation** (Native iOS/macOS):
- Real-time transcription in any text field
- Punctuation + capitalization auto-correction
- Emoji support ("insert smiley face")
- Language switching mid-sentence
- Offline support (Apple Neural Engine)

**Google Docs Voice Typing** (Free, web-based):
- Real-time transcription with cursor
- Punctuation commands ("period", "comma")
- Language auto-detection
- Undo/redo support
- Works offline (limited)

**Otter Mobile App** (Transcription, free):
- Live transcription during recording
- Search across transcripts
- Speaker labels
- Subtitle export
- Integration with calendar/email

**High-Impact Gaps for MyVoice:**
1. **Real-time transcription UI** — All competitors show text as user speaks
2. **Multi-language streaming** — Otter, Whisper, Google support 50+ languages
3. **Speaker diarization** — Otter, Whisper support speaker identification
4. **Auto-punctuation** — Apple/Google feature; critical for readability
5. **Voice-to-text integration with journal/notes** — Cross-module gap; users expect voice input in every text field

#### 4.3 Ranked Missing Features (By Competitive Necessity)

| Rank | Feature | Competitor | Necessity | Implementation Effort | Notes |
|------|---------|-----------|-----------|----------------------|-------|
| **1** | Real-time transcription UI | Otter, Apple, Google | Tier 0 | Low (display as stream) | UX expectation; not in spec |
| **2** | Voice-to-text integration in journal/notes | Apple, Google | Tier 0 | Medium (modal across modules) | Major cross-module gap; not in spec |
| **3** | Multi-language streaming | Otter, Whisper, Google | Tier 1 | Medium (API parameter) | Unlocks 50+ languages; not in spec |
| **4** | Auto-punctuation + capitalization | Apple, Google | Tier 1 | Low (post-process transcription) | Improves readability; not in spec |
| **5** | Speaker diarization | Otter, Whisper | Tier 1 | High (audio processing) | Enables meeting notes; not in spec |
| **6** | Auto-summary generation | Otter | Tier 2 | Medium (Claude API call) | Quick insight extraction; not in spec |
| **7** | Action items extraction | Otter | Tier 2 | Medium (Claude parsing) | Task automation; not in spec |
| **8** | Search across transcripts | Otter | Tier 2 | Low (FTS5 on vc_transcriptions) | Quick discovery; not in spec |
| **9** | Transcription sharing | Otter | Tier 2 | High (requires cloud) | Collaboration feature; not in spec |
| **10** | Audio silence trimming | N/A | Tier 3 | Low (audio processing) | File size optimization; not in spec |

**Most Impactful Quick Wins:**
- Real-time transcription display (quick UI win, 1-2 days)
- Voice input modal integrated into journal/notes entry (cross-module integration, 3-5 days)
- Auto-punctuation post-processing (simple regex, 1 day)
- FTS5 search on transcriptions (leverage existing DB, 1 day)

**Strategic Gaps:**
- Voice-to-text integration with other modules is a major UX gap; users expect voice input in every text field
- Real-time display is now an expectation after Otter/Apple/Google normalized it
- Multi-language support unlocks global use case but requires Whisper API or similar (paid)

---

### 5. MyHabits — Habit Tracking + Cycle Management Module

**Tier:** Premium
**Current Status:** Mature implementation (9 tables including cycle, heatmap, measurements, CSV export, flexible scheduling)
**Competitive Category:** Habits & Productivity (Habitica, Habitify, Streaks, Forest, Productive, Toggl, Sorted3)

#### 5.1 Spec vs Implementation Gap

| Feature | In Spec? | In Implementation? | Status |
|---------|----------|-------------------|--------|
| Habit creation (daily/weekly/monthly) | Yes | Yes | Implemented |
| Completion tracking + heatmap | Yes | Yes | Implemented (GitHub-style) |
| Completion statistics | Yes | Yes | Implemented (rate by day/time/month) |
| Flexible scheduling (custom recurrence) | Yes | Yes | Implemented |
| Measurements (numeric tracking) | Yes | Yes | Implemented |
| Cycle tracking (menstrual) | Yes | Yes | Absorbed from MyHabits |
| Cycle predictions | Yes | Yes | Implemented (algorithm-based) |
| Symptom logging (cycle) | Yes | Yes | Implemented |
| CSV export | Yes | Yes | Implemented |
| Habit reminders/notifications | Implied | Partial | Only if alert system wired |
| **Gamification (RPG, bosses, pets)** | No | No | Missing |
| **Siri shortcuts integration** | No | No | Missing |
| **Time tracking/billable hours** | No | No | Missing |
| **Location-based reminders** | No | No | Missing |
| **Habit streaks + rewards** | Implied | Partial | Streaks calculated; no rewards system |
| **Apple Health integration** | No | No | Missing |
| **Social accountability (friends)** | No | No | Missing |
| **Team challenges** | No | No | Missing |
| **Scheduling with calendar unification** | No | No | Missing |

**Gap Summary:** Core habit + cycle tracking is mature. Missing: gamification, Siri integration, time tracking, location awareness, social features, calendar unification.

#### 5.2 Competitor Features Not in Spec

**Habitica** (RPG-gamified, free + $5/mo):
- RPG character avatar (grows/dies with habits)
- Boss battles (group habit challenges)
- Pet/mount collection (reward unlocks)
- Quest system (narrative progression)
- Class system (warrior/mage/rogue)
- Party system (collaborative groups)
- Streaks with level progression

**Streaks** (Apple-native, $4.99/yr):
- 3D ring visualization (completion circles)
- Siri shortcuts (voice-triggered habits)
- Apple Watch support (wrist tracking)
- Notification scheduling (custom times)
- Habit stacking (link habits together)
- Skip options (skip specific days)
- Apple Health integration

**Forest** (Focus timer, free + $2/mo):
- Real tree planting (partnership with Trees for the Future)
- Focus timer (25min Pomodoro default)
- Social challenge (grow forest with friends)
- Offline support
- Stats tracking (trees planted, time focused)

**Productive** (Scheduling, free + $9.99/mo):
- Daily task scheduling (time blocks)
- Location-based reminders (geofencing)
- Time estimation + tracking
- Habit prioritization (daily focus list)
- Synced across devices (cloud sync)
- Widget support (iOS home screen)

**Toggl Track** (Time tracking, free + $20/mo):
- Time tracking with billable hours
- Project-based categorization
- Detailed reporting (time by category)
- Integration with 100+ apps (Slack, Jira, etc.)
- Team analytics (crew productivity)

**Sorted3** (Hyper-scheduling, $4.99/mo):
- Calendar + tasks unified view
- Automatic time blocking (schedules tasks into calendar)
- Custom time slot rules (always 30min for admin tasks)
- Predictive scheduling (learns user patterns)
- Interruption handling (reschedules on conflicts)

**Habitify** (Apple-integrated, free + $10/yr):
- Apple Health auto-tracking (steps, workouts)
- Mood tracking + habit correlation
- Habit grouping/categories
- Daily reminder notifications
- Statistics + trends
- Widget support

**High-Impact Gaps for MyHabits:**
1. **RPG gamification** — Habitica's core differentiator; drives daily engagement
2. **Siri shortcuts** — Streaks feature; enables voice-triggered habits
3. **Apple Health integration** — Habitify/Streaks feature; auto-track workouts/steps
4. **Time tracking** — Toggl/Productive feature; converts tracking into insights
5. **Unified calendar + task scheduling** — Sorted3 differentiator; solves scheduling friction

#### 5.3 Ranked Missing Features (By Competitive Necessity)

| Rank | Feature | Competitor | Necessity | Implementation Effort | Notes |
|------|---------|-----------|-----------|----------------------|-------|
| **1** | RPG gamification (avatar, bosses, pets) | Habitica | Tier 0 | High (game mechanics) | Habitica's moat; drives engagement; not in spec |
| **2** | Siri shortcuts integration | Streaks | Tier 0 | Medium (shortcuts framework) | Voice-triggered habits; not in spec |
| **3** | Apple Health sync | Habitify, Streaks | Tier 1 | Medium (HealthKit API) | Auto-track workouts/steps; not in spec |
| **4** | Time tracking + billable hours | Toggl, Productive | Tier 1 | Medium (timer + reporting) | Converts tracking into billable value; not in spec |
| **5** | Location-based reminders | Productive | Tier 1 | High (geofencing) | Context-aware triggering; not in spec |
| **6** | Calendar unification + auto-scheduling | Sorted3 | Tier 1 | Very High (scheduling algorithm) | Solves scheduling friction; not in spec |
| **7** | Habit stacking (link dependencies) | Streaks | Tier 2 | Low (self-reference) | Builds momentum chains; not in spec |
| **8** | Reward system (badges, levels) | Habitica | Tier 2 | Medium (progression system) | Gamification layer; partial in streak tracking |
| **9** | Social accountability (friends) | Habitica | Tier 2 | High (requires sync layer) | Social feature; not in spec |
| **10** | Team challenges | Habitica | Tier 2 | High (real-time sync) | Collaborative feature; not in spec |

**Most Impactful Quick Wins:**
- Habit stacking (low effort, improves habit building)
- Siri shortcuts integration (medium effort, unlocks voice control)
- Apple Health read API (medium effort, auto-populate workout habits)

**Strategic Gaps:**
- RPG gamification is Habitica's entire moat; absence means MyHabits competes on features, not engagement
- Siri shortcuts is now standard for habit apps; absence is a competitive disadvantage on iOS
- Calendar unification is Sorted3's unique angle; MyHabits treats habits as standalone tracking, not scheduling

---

### 6. MyWords — Language Learning & Dictionary Module

**Tier:** Premium
**Current Status:** Specialized implementation (stateless API aggregation, 270+ languages, multi-provider, in-memory caching)
**Competitive Category:** Language Learning (Duolingo, Quizlet, Anki, Dictionary services)

#### 6.1 Spec vs Implementation Gap

| Feature | In Spec? | In Implementation? | Status |
|---------|----------|-------------------|--------|
| Word lookup (30+ definitions) | Yes | Yes | Implemented (Free Dictionary API) |
| Multiple language support (270+) | Yes | Yes | Implemented across 24h cache |
| Etymology display | Yes | Yes | Implemented (Wiktionary provider) |
| Pronunciation guide | Implied | Partial | Available via API; UI may be missing |
| Thesaurus (synonyms/antonyms) | Yes | Yes | Implemented (Datamuse API) |
| Rhymes/similar words | Yes | Yes | Implemented (Datamuse API) |
| Example sentences | Yes | Yes | Implemented (Free Dictionary) |
| Word audio pronunciation | Implied | Partial | API provides; UI integration TBD |
| **Corpus-based example sentences** | No | No | Missing |
| **Collocation maps** (word associations) | No | No | Missing |
| **Spaced repetition integration with MyFlash** | No | No | Missing (cross-module) |
| **Flashcard deck auto-generation** | No | No | Missing |
| **Language learning paths** | No | No | Missing |
| **Learner-level content filtering** | No | No | Missing |
| **Contextual usage patterns** | No | No | Missing |

**Gap Summary:** Multi-provider API layer is solid; pronunciation and etymology covered. Missing: corpus-based examples, collocation maps, MyFlash integration, learning path scaffolding.

#### 6.2 Competitor Features Not in Spec

**Duolingo** (Language courses, free + $7/mo):
- 43 curated language courses (self-paced learning)
- AI dialogue roleplay (conversational practice)
- Spaced repetition algorithmically optimized
- Streaks + rewards (gamification)
- Stories (narrative context)
- Podcasts (native speaker input)
- Competitive leagues (weekly rankings)
- Adaptive difficulty (personalizes content)

**Quizlet** (Community decks, free + $12/mo):
- Shared deck library (millions of public decks)
- Magic Notes (AI auto-generates flashcards from text)
- Multiple study modes (Match, Learn, Test, Speller)
- Collaborative study sets (co-edit with classmates)
- Mobile offline support
- Class organization (teacher features)

**Anki** (Spaced repetition, free + $25/yr):
- Open-source with 1600+ add-ons
- Cloze deletion + image occlusion (for word learning)
- Custom card templates
- 100% offline + AnkiWeb sync
- Shared deck library (1M+ decks)

**Traditional Dictionaries (Oxford, Merriam-Webster, Cambridge)**:
- Word frequency indicators (learn common words first)
- Learner-specific definitions (simpler language for L2 learners)
- Collocations (words that appear together)
- Usage notes (register, formality level)
- Corpus-based example sentences (real text)

**Youglish** (Video-based, free):
- Real-world usage in YouTube videos
- Native speaker pronunciation (video context)
- Multiple accent variations
- Subtitle search across videos

**High-Impact Gaps for MyWords:**
1. **Spaced-repetition integration with MyFlash** — Cross-module gap; enables word learning workflow
2. **Collocation maps** — Dictionary feature; shows word associations
3. **Corpus-based examples** — Learner-level content; authentic usage context
4. **Flashcard deck auto-generation** — Integration with MyFlash; reduces manual work
5. **Learner-level content filtering** — Duolingo feature; simplifies definitions for L2 learners

#### 6.3 Ranked Missing Features (By Competitive Necessity)

| Rank | Feature | Competitor | Necessity | Implementation Effort | Notes |
|------|---------|-----------|-----------|----------------------|-------|
| **1** | Spaced-rep integration with MyFlash | Duolingo, Quizlet | Tier 0 | Medium (module integration) | Major cross-module gap; not in spec |
| **2** | Flashcard deck auto-generation | Quizlet (Magic Notes) | Tier 1 | Medium (Claude API call) | Reduces manual flashcard creation; not in spec |
| **3** | Collocation maps (word associations) | Oxford Dictionary | Tier 1 | Medium (API + UI) | Shows how words are used together; not in spec |
| **4** | Corpus-based example sentences | Oxford, Cambridge, Youglish | Tier 1 | Medium (API integration) | Authentic usage context; not in spec |
| **5** | Learner-level content filtering | Duolingo (A1-C2 levels) | Tier 2 | Medium (content curation) | Simplifies definitions for L2 learners; not in spec |
| **6** | Audio pronunciation with speaker choice | Youglish, Oxford | Tier 2 | Low (UI selector) | Multiple accent support; not in spec |
| **7** | Language learning paths (A1-C2) | Duolingo | Tier 2 | High (curriculum design) | Scaffolded learning progression; not in spec |
| **8** | Learner-tagged word frequency | Duolingo | Tier 2 | Low (frequency filtering) | Prioritizes high-frequency words; not in spec |
| **9** | Shared word lists (with friends) | Quizlet | Tier 2 | High (requires sync) | Social feature; not in spec |
| **10** | Real-world video examples | Youglish | Tier 2 | Medium (YouTube API) | Contextual native speaker usage; not in spec |

**Most Impactful Quick Wins:**
- Spaced-rep integration with MyFlash (medium effort, major UX win)
- Audio pronunciation UI selector (low effort, enhances learning)
- Flashcard auto-generation from definitions (medium effort, MyFlash integration)

**Strategic Gaps:**
- Cross-module integration with MyFlash is major gap; users expect to create flashcards from word lookups
- Collocation maps are dictionary-standard; absence limits vocabulary depth learning
- Corpus-based examples unlock authentic usage patterns vs AI-generated or generic examples

---

## Cross-Module Integration Opportunities

### 1. Journal <> Mood Analysis

**Opportunity:** MyJournal entries contain mood tags (5-level scale); can create sentiment correlation analysis across entries.

**Example:** "You mention 'stressed' in 5 of your last 10 entries. On Mondays, you're stressed 60% of the time vs 20% on Thursdays. Try morning exercise."

**Implementation:**
- MyJournal adds `mood_score` field (derived from mood tag)
- Query joins journal entries + mood tags by date
- Claude API processes aggregates for insights
- Effort: 3-5 days (sentiment scoring + Claude integration)

**Cross-module impact:** Could integrate with MyHabits to suggest stress-reducing habits (exercise, meditation, sleep tracking)

---

### 2. Flash <> Notes (Knowledge Spaced-Repetition)

**Opportunity:** MyNotes contains [[wiki links]]; can auto-create flashcards from note snippets to reinforce knowledge.

**Example:** User writes a note about "photosynthesis". On next review, MyFlash offers auto-generated cards:
- Q: "What is the primary function of photosynthesis?" A: "[excerpt from note]"
- Q: "What related topics did I link?" A: "[backlink suggestions]"

**Implementation:**
- MyNotes API exports note content + backlinks
- MyFlash deck importer creates cards from note segments
- Synced mode: changes to notes update linked cards
- Effort: 5-7 days (note extraction + card generation + sync logic)

**Cross-module impact:** Converts passive knowledge capture (MyNotes) into active learning (MyFlash)

---

### 3. Words <> Flash (Vocabulary Learning Path)

**Opportunity:** MyWords lookups can auto-create MyFlash decks for vocabulary acquisition.

**Example:** User looks up 10 words in MyWords over a week. System creates "Weekly Vocabulary Deck" in MyFlash with:
- Front: word + pronunciation
- Back: definition + example sentence + synonym
- Spaced repetition scheduled across 2 weeks

**Implementation:**
- MyWords tracks lookups (add to settings table)
- Daily cron aggregates lookups into flashcard deck
- MyFlash scheduler applies spaced-rep timing
- Effort: 3-5 days (lookup aggregation + card generation + scheduler wiring)

**Cross-module impact:** Closes workflow gap between word learning and long-term retention

---

### 4. Voice <> Journal/Notes (Transcription as Entry)

**Opportunity:** MyVoice transcriptions can become MyJournal entries or MyNotes notes automatically.

**Example:** User voice-records a daily reflection. MyVoice transcribes it, then user can:
- Save as MyJournal entry with auto-extracted mood from text sentiment
- Save as MyNotes knowledge item with auto-generated title + backlinks
- Create MyFlash cloze cards from key sentences

**Implementation:**
- MyVoice transcription modal integrates with MyJournal/MyNotes
- Auto-extract mood sentiment (Claude API)
- Auto-title note from first sentence
- Auto-detect [[backlinks]] via MyNotes engine
- Effort: 5-7 days (cross-module modal + sentiment + routing)

**Cross-module impact:** Enables voice-first knowledge capture across entire hub

---

### 5. Habits <> All Modules (Habit-Tracking Integration)

**Opportunity:** Every module can suggest habit-building recommendations.

**Examples:**
- **Journal habit:** "You've journaled 8/30 days this month. Build a daily reflection habit?"
- **Notes habit:** "You created 3 notes this week. Try 1 note/day habit?"
- **Flash habit:** "You reviewed 5 cards today. Create a 'daily study' habit?"
- **Words habit:** "You looked up 12 words. Track vocabulary learning as a habit?"
- **Voice habit:** "You recorded 2 voice notes. Daily voice journaling habit?"

**Implementation:**
- MyHabits exposes `createHabitRecommendation(module, action)` function
- Hub dashboard shows "Habits to unlock" for each module
- User can enable habit with 1 click
- Effort: 5-7 days (module→habits integration + dashboard UI)

**Cross-module impact:** Gamifies module engagement through habit system

---

## Implementation Roadmap

### Phase 0 (Quick Wins) — Weeks 1-2

Focus on highest-impact, lowest-effort features:

| Module | Feature | Effort | Priority | Notes |
|--------|---------|--------|----------|-------|
| Journal | On This Day (recurrence) | Low | Tier 0 | SQL query, 1-2 days |
| Journal | AI-guided prompts | Medium | Tier 0 | Claude API integration, 3-4 days |
| Notes | Backlink preview hover | Low | Tier 2 | UI popover, 2-3 days |
| Flash | Cloze deletion card type | Medium | Tier 0 | Text parsing, 3-5 days |
| Voice | Real-time transcription display | Low | Tier 0 | UI stream, 1-2 days |
| Habits | Habit stacking (self-reference) | Low | Tier 2 | DB schema, 2-3 days |
| Words | Audio pronunciation UI | Low | Tier 2 | Selector component, 1-2 days |

**Phase 0 Effort:** ~18-24 days = ~1 month with parallel work

---

### Phase 1 (Cross-Module Integrations) — Weeks 3-6

Focus on connecting modules:

| Feature | Modules | Effort | Priority | Notes |
|---------|---------|--------|----------|-------|
| Voice <> Journal | Voice, Journal | Medium | Tier 0 | Transcription → entry, 5-7 days |
| Words <> Flash | Words, Flash | Medium | Tier 0 | Lookup → deck, 3-5 days |
| Flash <> Notes | Flash, Notes | Medium | Tier 1 | Note → cards, 5-7 days |
| Journal <> Mood | Journal | Medium | Tier 1 | Sentiment analysis, 3-5 days |
| Habits <> All | Habits, all | Medium | Tier 1 | Recommendation system, 5-7 days |

**Phase 1 Effort:** ~25-35 days = ~1.5 months

---

### Phase 2 (Ecosystem Features) — Weeks 7-12

Focus on ecosystem moats:

| Module | Feature | Effort | Priority | Notes |
|--------|---------|--------|----------|-------|
| Journal | PDF/printed book export | High | Tier 1 | PDF generation, 5-7 days |
| Notes | Visual graph view | High | Tier 0 | Canvas rendering, 7-10 days |
| Notes | Web clipper | Very High | Tier 0 | Browser extension, 10-14 days |
| Flash | Image occlusion mode | High | Tier 0 | Canvas + SVG, 7-10 days |
| Habits | Siri shortcuts | Medium | Tier 0 | Shortcuts framework, 3-5 days |
| Habits | Apple Health sync | Medium | Tier 1 | HealthKit API, 3-5 days |

**Phase 2 Effort:** ~40-55 days = ~2-3 months

---

### Phase 3 (Differentiation) — Weeks 13+

Focus on competitive differentiation:

| Module | Feature | Effort | Priority | Impact |
|--------|---------|--------|----------|--------|
| Habits | RPG gamification | Very High | Tier 0 | Habitica differentiation; 20-30 days |
| Notes | Plugin API | Very High | Tier 1 | Obsidian extensibility; 20-30 days |
| Flash | HTML/CSS templates | High | Tier 1 | Anki customization; 10-14 days |
| Flash | Add-on ecosystem | Very High | Tier 2 | Anki moat; 20-30 days |

**Phase 3 Effort:** 60-100+ days = 3+ months

---

## Summary Table: All Gaps By Priority

| Tier | Module | Gap | Effort | Est. Days | Dependencies |
|------|--------|-----|--------|-----------|--------------|
| **0** | Journal | AI-guided prompts | Medium | 3-4 | Claude API |
| **0** | Journal | On This Day | Low | 1-2 | None |
| **0** | Flash | Cloze deletion cards | Medium | 3-5 | None |
| **0** | Flash | Image occlusion mode | High | 7-10 | Canvas/SVG |
| **0** | Voice | Real-time transcription UI | Low | 1-2 | None |
| **0** | Voice | Voice-to-text in journal/notes | Medium | 3-5 | Modal UI |
| **0** | Habits | Siri shortcuts | Medium | 3-5 | Shortcuts framework |
| **0** | Notes | Visual graph view | High | 7-10 | Canvas rendering |
| **1** | Journal | Mood correlation analysis | Medium | 3-5 | None |
| **1** | Journal | Export to PDF/book | High | 5-7 | PDF library |
| **1** | Notes | Web clipper | Very High | 10-14 | Browser extension |
| **1** | Notes | OCR on images | Medium | 3-5 | ML API or local |
| **1** | Flash | HTML/CSS templates | High | 10-14 | Template engine |
| **1** | Flash | Filtered decks | Medium | 3-5 | Query DSL |
| **1** | Voice | Multi-language streaming | Medium | 2-3 | API parameter |
| **1** | Voice | Speaker diarization | High | 5-7 | Audio processing |
| **1** | Habits | Apple Health sync | Medium | 3-5 | HealthKit API |
| **1** | Habits | Time tracking | Medium | 3-5 | Timer UI |
| **1** | Habits | Calendar unification | Very High | 10-14 | Scheduling algorithm |
| **1** | Words | Flashcard auto-generation | Medium | 3-5 | MyFlash integration |
| **1** | Words | Collocation maps | Medium | 3-5 | API + UI |
| **2** | Journal | Photo entries | Medium | 3-5 | expo-image-picker |
| **2** | Notes | Markdown frontmatter | Low | 1-2 | YAML parser |
| **2** | Notes | Backlink preview hover | Low | 2-3 | Popover UI |
| **2** | Flash | Add-on ecosystem | Very High | 20-30 | Plugin architecture |
| **2** | Flash | Deck library + sharing | High | 7-10 | Cloud storage |
| **2** | Habits | RPG gamification | Very High | 20-30 | Game mechanics |
| **2** | Habits | Habit stacking | Low | 2-3 | Self-reference |
| **2** | Words | Language learning paths | High | 7-10 | Curriculum design |

---

## Recommendations

### Immediate Actions (Next Sprint)

1. **MyJournal:** Implement "On This Day" feature (1-2 days, high engagement return)
2. **MyVoice:** Add real-time transcription UI display (1-2 days, UX polish)
3. **MyNotes:** Add markdown frontmatter parser (1-2 days, enables advanced queries)
4. **MyFlash:** Implement cloze deletion card type (3-5 days, language learning standard)
5. **MyHabits:** Wire Siri shortcuts (3-5 days, iOS competitive necessity)

**Expected Impact:** Addresses 5 Tier-0 and Tier-1 gaps in ~15-20 days

### Strategic Priorities (Next Quarter)

1. **MyJournal:** Build AI-guided prompts (drives daily engagement, Tier 0)
2. **MyNotes:** Add visual graph view UI (knowledge-worker essential, Tier 0)
3. **MyFlash:** Add image occlusion mode (visual learning standard, Tier 0)
4. **MyVoice:** Integrate voice-to-text into journal/notes (cross-module gap, Tier 0)
5. **MyHabits:** Build habit-tracking ecosystem integrations (gamification foundation, Tier 1)

**Expected Impact:** Closes all Tier-0 gaps and most Tier-1 gaps in ~2-3 months

### Long-Term Differentiation (Next 6 Months)

1. **MyJournal:** PDF/printed book export (Day One feature parity)
2. **MyNotes:** Web clipper + OCR (Notion/Evernote parity)
3. **MyFlash:** Add-on ecosystem + HTML/CSS templates (Anki parity)
4. **MyHabits:** RPG gamification system (Habitica engagement driver)
5. **Cross-Module:** Build unified voice-to-knowledge pipeline (unique competitive angle)

---

## Conclusion

The Productivity & Learning modules have solid foundational implementations but face significant competitive gaps across UX polish (real-time UI), cross-module integration, and ecosystem features (web clipper, plugins, gamification).

**High-Return-on-Investment priorities:**
- **Tier 0 Quick Wins:** On This Day (journal), Real-time transcription (voice), Cloze cards (flash), Siri shortcuts (habits) — 10-15 days total
- **Tier 0 Strategic:** AI-guided prompts (journal), Visual graph (notes), Image occlusion (flash), Voice integration (voice) — 20-30 days
- **Competitive Moat Features:** Web clipper (notes), RPG gamification (habits), Add-on API (flash) — 50-80+ days

**Cross-module integration** is MyLife's unique competitive angle and should be prioritized alongside individual module features.

---

*Report generated: 2026-03-09*
*Next review: 2026-03-16 (after Phase 0 implementation)*
