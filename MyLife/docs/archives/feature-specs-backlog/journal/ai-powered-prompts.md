# Feature Spec: AI-Powered Prompts

## Metadata
- **Module:** journal
- **Priority Score:** 29 / 50 (B-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 3 x3 + Complexity 3 x2 + CrossModule 2 x1 + PaidUser 3 x1
- **Sprint:** Sprint 6 (B+C Features)
- **Estimated CC Time:** 3-4 hours
- **Depends On:** JR-002 (Daily Journaling with Prompts -- implemented, `engine/prompts.ts` with 4 categories), mood tagging (implemented, 5-level scale)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Reflectly ($59.99/yr) built its entire business on AI-powered journaling prompts, attracting millions of users who want a personalized writing experience. Day One and other competitors are adding AI features behind paywalls. MyJournal already has 16 static prompts across 4 categories. AI-powered prompts dynamically generate context-aware writing prompts based on the user's recent entries, mood patterns, and journaling habits. The key differentiator: all AI prompt generation runs through an on-device prompt template system rather than sending journal content to external AI services. User entries never leave the device.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Reflectly | Yes | $59.99/yr | AI-generated prompts based on mood and past entries. Cloud-processed. Core product. |
| Day One | Partial | $34.99/yr | AI writing suggestions and templates. Cloud-processed via OpenAI. Premium feature. |
| Daylio | No | N/A | Static pre-written prompts only. No AI integration. |
| Apple Journal | Partial | Free | Suggestion-based prompts from photos, music, location. On-device ML. Not text-aware. |

### Target User
Daily journalers who run out of things to write about after the initial 16 static prompts cycle through. Reflectly users paying $59.99/yr who want personalized prompts without sending their most private thoughts to cloud AI services. Users who journal for mental health and want prompts tailored to their emotional patterns.

## Technical Context

### Where This Lives in MyLife

```
modules/journal/src/ai-prompts/                    -- NEW: AI prompt engine
modules/journal/src/ai-prompts/types.ts            -- AiPrompt, PromptContext, PromptTheme types
modules/journal/src/ai-prompts/prompt-engine.ts    -- Context analysis, prompt generation
modules/journal/src/ai-prompts/themes.ts           -- 12 prompt theme definitions with template strings
modules/journal/src/ai-prompts/index.ts            -- Barrel export
modules/journal/src/ai-prompts/__tests__/          -- Tests
modules/journal/src/db/ai-prompts.ts               -- NEW: CRUD for prompt history
apps/mobile/app/(journal)/components/AiPromptCard.tsx   -- Mobile AI prompt card
apps/web/app/journal/components/AiPromptCard.tsx        -- Web AI prompt card
```

### Wireframe Position

```
Hub Dashboard
  └── MyJournal card
       └── Today tab -> Entry Editor
            └── Above entry body, below mood selector
                 └── AI Prompt Card ← YOU ARE HERE
```

### Data Model

New table and settings in migration V4:

```sql
CREATE TABLE IF NOT EXISTS jn_ai_prompts (
  id TEXT PRIMARY KEY NOT NULL,
  prompt_text TEXT NOT NULL,
  theme TEXT NOT NULL
    CHECK (theme IN (
      'emotional_exploration', 'pattern_recognition', 'growth_reflection',
      'relationship_insight', 'gratitude_deepening', 'future_visioning',
      'self_compassion', 'values_alignment', 'energy_awareness',
      'boundary_setting', 'creative_expression', 'mindful_observation'
    )),
  context_summary TEXT,
  mood_context TEXT,
  was_used INTEGER NOT NULL DEFAULT 0,
  was_skipped INTEGER NOT NULL DEFAULT 0,
  generated_date TEXT NOT NULL,
  entry_id TEXT REFERENCES jn_entries(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS jn_ai_prompts_date_idx ON jn_ai_prompts(generated_date DESC);
CREATE INDEX IF NOT EXISTS jn_ai_prompts_theme_idx ON jn_ai_prompts(theme);
CREATE INDEX IF NOT EXISTS jn_ai_prompts_used_idx ON jn_ai_prompts(was_used, was_skipped);

INSERT OR IGNORE INTO jn_settings (key, value) VALUES ('aiPromptsEnabled', 'true');
INSERT OR IGNORE INTO jn_settings (key, value) VALUES ('aiPromptThemes', 'all');
```

### Dependencies
- **Internal:** `@mylife/db`, journal entry CRUD, mood distribution from `engine/stats.ts`, existing prompts engine
- **External:** none (fully local template-based generation, no AI API calls)
- **Cross-Module:** Mood data provides emotional context. CBT thought records (if available) can inform pattern-recognition themes.

## Functional Requirements

### User Stories
1. As a daily journaler, I want prompts that respond to my recent writing patterns so that each day's prompt feels relevant to where I am emotionally.
2. As someone tracking their mood, I want prompts that acknowledge my emotional trends so that I can explore why I am feeling a certain way.
3. As a privacy-conscious user, I want AI-style prompts generated entirely from local templates without sending my entries anywhere.

### Behavior Specification

1. User enables AI Prompts in Settings (default: on).
2. When creating a new entry, the AI Prompt Card appears above the editor.
3. **Context analysis (local, synchronous):**
   a. Query last 7 entries: extract mood tags, word counts, entry frequency.
   b. Compute mood trend: improving, declining, stable, or mixed.
   c. Identify dominant themes: look for keywords in recent entry bodies (simple substring matching against a theme keyword map).
   d. Check journaling streak and frequency.
4. **Prompt selection:**
   a. Pick a theme from the 12 available themes, weighted by:
      - Mood context (declining mood biases toward self_compassion, emotional_exploration)
      - Entry frequency (infrequent journaling biases toward mindful_observation, energy_awareness)
      - Recency: avoid themes used in the last 3 days
   b. Select a template string from the chosen theme.
   c. Fill template variables with context (e.g., mood name, days since last entry, streak count).
5. Prompt card displays: theme icon, generated prompt text, "Write About This" and "New Prompt" buttons.
6. User taps "Write About This": prompt text becomes the first line of the entry body.
7. User taps "New Prompt": regenerates with a different theme/template.
8. User taps "Skip": dismisses the card for this entry.
9. After saving the entry, the prompt is logged as "used" with a link to the entry.

### Edge Cases

- **No previous entries (first-time user):** Use a "welcome" theme set with universal prompts. No context analysis needed.
- **All entries have null mood:** Skip mood-based weighting. Use general themes only.
- **User writes 5+ entries per day:** Context analysis uses only today's entries for recency, not the full 7-day window.
- **All 12 themes used in last 3 days:** Allow theme repetition but pick the least-recently-used.
- **AI Prompts disabled:** No prompt card shown. No context analysis. Zero overhead.
- **Very short entries (under 10 words):** Context analysis treats these as "minimal entries" and may suggest creative_expression or mindful_observation themes.
- **Entry body contains no recognizable keywords:** Falls back to random theme selection weighted by mood only.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** AI Prompt Card appears above the entry editor when creating a new entry.
- [ ] **AC-2:** Prompt text is contextually relevant (references mood trend or journaling pattern).
- [ ] **AC-3:** "Write About This" pre-fills the entry body with the prompt text.
- [ ] **AC-4:** "New Prompt" generates a different prompt (different theme from current).
- [ ] **AC-5:** "Skip" dismisses the card for this entry.
- [ ] **AC-6:** AI Prompts toggle exists in Settings (default: on).
- [ ] **AC-7:** Prompt themes rotate without immediate repetition (3-day cooldown).
- [ ] **AC-8:** Prompts adapt when mood is consistently low (bias toward self-compassion themes).
- [ ] **AC-9:** First-time user sees a welcome-themed prompt without errors.

### Technical Criteria
- [ ] **TC-1:** Migration V4 creates `jn_ai_prompts` table with indexes and settings.
- [ ] **TC-2:** Context analysis queries only the last 7 entries (not full history).
- [ ] **TC-3:** Prompt generation completes in under 50ms (pure template fill, no heavy computation).
- [ ] **TC-4:** 12 themes with at least 8 template strings each (96+ total prompt templates).
- [ ] **TC-5:** Prompt history logged in `jn_ai_prompts` with used/skipped status.
- [ ] **TC-6:** Theme cooldown tracks last 3 days of used themes.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Entry text must NEVER be sent to any external AI service. All prompt generation is local template-based.
- [ ] **NC-2:** AI prompts must NOT slow down the entry editor opening. Context analysis is synchronous but lightweight.
- [ ] **NC-3:** Disabling AI prompts must NOT affect existing prompt history data.
- [ ] **NC-4:** AI prompts must NOT override the existing static prompt system. Both coexist independently.

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- AI Prompt Card: glass card with subtle gradient top border in `#A78BFA` (accent)
- Theme icon: left-aligned, 24px, accent color
- Prompt text: 16px, `#F0F0F5`, 2-3 lines max
- "Write About This" button: accent color, pill shape
- "New Prompt" and "Skip": ghost buttons, textSecondary color
- Module accent: `#A78BFA`

### Web (Next.js)

- Same prompt card in entry editor
- Wider layout allows prompt text + action buttons on same row
- Keyboard shortcut: `Cmd+Shift+P` to regenerate prompt

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Ready | AI Prompt Card with generated prompt | New entry opened |
| First Use | Welcome-themed prompt | No previous entries exist |
| Used | Card dimmed, "Prompt used" label | User tapped "Write About This" |
| Skipped | Card hidden | User tapped "Skip" |
| Disabled | No card | AI Prompts toggle off in Settings |

## Test Requirements

### Unit Tests
- [ ] `analyzeMoodTrend`: 5 entries with declining mood -> trend = 'declining'
- [ ] `analyzeMoodTrend`: 5 entries with improving mood -> trend = 'improving'
- [ ] `analyzeMoodTrend`: mixed moods -> trend = 'mixed'
- [ ] `selectTheme`: declining mood -> biases toward self_compassion or emotional_exploration
- [ ] `selectTheme`: theme used yesterday -> not selected (cooldown)
- [ ] `fillTemplate`: template with {mood} and {streak} variables -> correctly substituted
- [ ] `fillTemplate`: template with no variables -> returned as-is
- [ ] `generatePrompt`: no previous entries -> welcome theme
- [ ] `generatePrompt`: all themes on cooldown -> picks least-recently-used
- [ ] `keywordExtraction`: entry body "I feel anxious about work" -> matches 'emotional_exploration'

### Integration Tests
- [ ] Full flow: open new entry -> AI prompt shown -> tap "Write About This" -> prompt in body -> save -> prompt logged as used
- [ ] Regenerate: tap "New Prompt" 3 times -> 3 different themes shown

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyJournal > Settings
3. Verify: "AI Prompts" toggle exists, default on -- corresponds to AC-6
4. Navigate to Today tab, open new entry
5. Verify: AI Prompt Card visible with prompt text -- corresponds to AC-1
6. Verify: prompt references mood or journaling pattern -- corresponds to AC-2
7. Tap "Write About This"
8. Verify: prompt text appears in entry body -- corresponds to AC-3
9. Create another new entry
10. Tap "New Prompt"
11. Verify: different prompt shown (different theme) -- corresponds to AC-4
12. Tap "Skip"
13. Verify: card disappears -- corresponds to AC-5
14. Create entries with mood "low" for 3 consecutive days
15. Create a new entry
16. Verify: prompt has self-compassion or emotional exploration theme -- corresponds to AC-8
17. Disable "AI Prompts" in Settings
18. Create a new entry
19. Verify: no AI Prompt Card shown -- corresponds to AC-6

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to journal entry editor, verify prompt card flow

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Journal has 16 static prompts across 4 categories (reflection, gratitude, therapy, stoic) in `engine/prompts.ts`. Prompts cycle by date index with no personalization.

### After This Work
A `jn_ai_prompts` table logs prompt history. An `ai-prompts/` directory provides context analysis (mood trend, keyword extraction, frequency analysis), 12 themes with 96+ template strings, and a template-fill engine. AI Prompt Card appears in the entry editor with "Write About This", "New Prompt", and "Skip" actions.

### Files Changed
- `modules/journal/src/db/schema.ts` -- add CREATE_AI_PROMPTS table, indexes, settings
- `modules/journal/src/definition.ts` -- add to JOURNAL_MIGRATION_V4, increment schemaVersion
- `modules/journal/src/ai-prompts/types.ts` -- AiPrompt, PromptContext, PromptTheme, MoodTrend types
- `modules/journal/src/ai-prompts/themes.ts` -- 12 theme definitions with 8+ templates each
- `modules/journal/src/ai-prompts/prompt-engine.ts` -- analyzeMoodTrend, selectTheme, fillTemplate, generatePrompt
- `modules/journal/src/ai-prompts/index.ts` -- barrel export
- `modules/journal/src/ai-prompts/__tests__/prompt-engine.test.ts` -- 10+ unit tests
- `modules/journal/src/db/ai-prompts.ts` -- CRUD for prompt history
- `modules/journal/src/types.ts` -- extend with AiPrompt Zod schema
- `modules/journal/src/index.ts` -- re-export ai-prompts module
- `apps/mobile/app/(journal)/components/AiPromptCard.tsx` -- mobile prompt card
- `apps/web/app/journal/components/AiPromptCard.tsx` -- web prompt card

### Known Limitations
- No actual LLM/AI call. All prompts are template-based with variable substitution. Feels "AI-powered" through context awareness but is deterministic.
- Keyword extraction is simple substring matching, not NLP. Works for common emotional terms but misses nuance.
- No cross-module context (e.g., workout data, budget stress). Only journal data informs prompts.

### Context for Next Agent
- The existing prompt system in `engine/prompts.ts` uses `getDailyJournalPrompt(referenceDate, category)`. AI prompts are a separate system that coexists. Do not modify the existing prompt engine.
- The `jn_entries` table has `mood` (5-level: low/okay/good/great/grateful), `body` (markdown text), `word_count`, and `entry_date` columns. Use these for context analysis.
- Template variables use `{variable}` syntax. Common variables: `{mood}`, `{streak}`, `{daysSinceLastEntry}`, `{recentTheme}`, `{wordCountAvg}`.
- Theme cooldown: query `jn_ai_prompts` for `generated_date >= date('now', '-3 days')` to get recently used themes.
- Migration V4 coordination: if other features also need V4 changes, combine into a single V4 migration.
