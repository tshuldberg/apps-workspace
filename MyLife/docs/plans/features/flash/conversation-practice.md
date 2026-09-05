# Feature Spec: Conversation Practice

## Metadata
- **Module:** flash
- **Priority Score:** 22 / 50 (B-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 1 x3 + Complexity 1 x2 + CrossModule 1 x1 + PaidUser 4 x1
- **Sprint:** Sprint 6+ (B+C Features)
- **Estimated CC Time:** 5-6 hours
- **Depends On:** AI card generation (A-tier, cloud API infrastructure)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Flashcards are great for memorizing facts, but language learning and professional certification prep also require conversational fluency: the ability to use knowledge in context, think on your feet, and respond naturally. StudyFetch charges $228/yr and positions conversation practice as a premium AI study mode. The user starts a conversation with an AI tutor that uses their flashcard content as the knowledge base. Instead of testing "What is mitosis?" in isolation, the AI tutor asks "Explain how a cell prepares for division" and follows up with "What happens if the checkpoint fails?" This transforms passive recall into active, Socratic-method learning. MyFlash can offer this using Claude API with the user's deck content as context, delivering StudyFetch-tier study quality at a fraction of the price.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| StudyFetch | Yes | $228/yr | "Ace" AI tutor with conversation mode. Uses uploaded notes as knowledge base. Explains concepts, asks follow-ups, corrects misconceptions. Voice input supported. |
| Quizlet | No | N/A | No conversation mode. "Learn" mode is still single-card Q&A. |
| Anki | No | N/A | No AI features at all. Pure SRS. |
| Brainscape | No | N/A | No AI features. Teacher-created confidence ratings only. |

### Target User
Language learners who want to practice using vocabulary in conversation (not just translating isolated words). Medical students who need to explain pathophysiology, not just recall facts. Law students who need to reason about cases, not just memorize holdings. Professional certification students who need to articulate concepts to demonstrate competency. These users value depth of understanding over surface-level recall and are willing to pay for AI-powered study tools.

## Technical Context

### Where This Lives in MyLife

```
modules/flash/src/conversation/types.ts              -- Conversation, Message, ConversationConfig types
modules/flash/src/conversation/engine.ts             -- Conversation orchestration, prompt construction, turn management
modules/flash/src/conversation/prompts.ts            -- System prompt templates for different modes
modules/flash/src/conversation/index.ts              -- Barrel export
modules/flash/src/conversation/__tests__/            -- Tests
modules/flash/src/db/conversation.ts                 -- SQLite CRUD for conversations and messages
modules/flash/src/db/schema.ts                       -- V4 migration: fl_conversations, fl_conversation_messages
modules/flash/src/definition.ts                      -- Add V4 migration
apps/mobile/app/(flash)/conversation.tsx             -- Conversation screen (chat UI)
apps/mobile/app/(flash)/conversation-history.tsx     -- Past conversations list
apps/mobile/app/(flash)/components/ChatBubble.tsx    -- Message bubble component
apps/web/app/flash/conversation/page.tsx             -- Web conversation page
apps/web/app/flash/conversation/history/page.tsx     -- Web conversation history
```

### Wireframe Position

```
Hub Dashboard
  └── MyFlash card
       └── Study tab -> "Conversation Practice" button
            └── Configuration sheet
                 └── Conversation Screen (chat interface) <- YOU ARE HERE
```

### Data Model

Two new tables in V4 migration:

```sql
-- V4 migration: conversation practice
CREATE TABLE IF NOT EXISTS fl_conversations (
  id TEXT PRIMARY KEY NOT NULL,
  deck_id TEXT NOT NULL REFERENCES fl_decks(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'tutor' CHECK (mode IN ('tutor', 'quiz', 'explain', 'debate')),
  difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('beginner', 'medium', 'advanced')),
  language TEXT NOT NULL DEFAULT 'en',
  topic_summary TEXT NOT NULL DEFAULT '',
  message_count INTEGER NOT NULL DEFAULT 0,
  cards_referenced INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  performance_rating REAL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS fl_conversation_messages (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES fl_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('system', 'assistant', 'user')),
  content TEXT NOT NULL,
  card_ids_json TEXT NOT NULL DEFAULT '[]',
  tokens_used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS fl_conversations_deck_idx ON fl_conversations(deck_id, started_at DESC);
CREATE INDEX IF NOT EXISTS fl_conversation_msgs_conv_idx ON fl_conversation_messages(conversation_id, created_at ASC);
```

### Dependencies
- **Internal:** `@mylife/flash` (fl_cards for deck content, AI infrastructure for Claude API), `@mylife/ui` (Cool Obsidian tokens)
- **External:** Claude API (required, no on-device fallback for conversation). `claude-haiku-4-5-20251001` for cost efficiency on conversational turns.
- **Cross-Module:** Words module (future): vocabulary conversation practice could reference saved word definitions.

## Functional Requirements

### User Stories
1. As a language learner, I want to practice using my vocabulary flashcards in a conversation so that I can build fluency, not just recognition.
2. As a medical student, I want an AI tutor to quiz me on my pharmacology deck in a Socratic dialogue so that I can explain mechanisms, not just name them.
3. As a law student, I want to debate legal concepts using my case study cards so that I practice legal reasoning.
4. As a returning user, I want to see my conversation history and performance ratings so that I can track my progress in conversational fluency.
5. As a beginner, I want the AI to adjust difficulty based on my responses so that the conversation matches my current level.

### Behavior Specification

**Configuring a conversation:**
1. User navigates to Study tab and taps "Conversation Practice"
2. Configuration sheet appears with:
   - Deck selector (which deck to practice from)
   - Mode selector:
     - **Tutor:** AI explains concepts from the deck and asks follow-up questions. Corrects misconceptions.
     - **Quiz:** AI asks rapid-fire questions and evaluates answers conversationally (not just right/wrong).
     - **Explain:** AI asks the user to explain a concept, then provides feedback on completeness and accuracy.
     - **Debate:** AI takes a contrarian position and the user must defend their understanding.
   - Difficulty: Beginner / Medium / Advanced
   - Language: defaults to English, supports any language the deck is in
3. User taps "Start Conversation"

**Conversation flow:**
1. System constructs a system prompt that includes:
   - The conversation mode and difficulty
   - A selection of card content from the deck (front+back, max 50 cards to fit context)
   - Instructions for the AI: use only knowledge from these cards, adjust to user level, provide corrections
2. AI sends the opening message based on mode:
   - Tutor: "Let's study [deck name]. I'll ask you questions and help you understand. Ready?"
   - Quiz: "Quick quiz on [deck name]! Here's your first question: [question from card]"
   - Explain: "Tell me about [concept from card]. I'll let you know how complete your explanation is."
   - Debate: "I'm going to challenge your understanding of [topic]. Let's see how well you can defend your knowledge."
3. User types a response in the chat input
4. System sends the conversation history + user message to Claude API
5. AI responds with follow-up, correction, or new question
6. Each AI response may reference specific cards (tracked in `card_ids_json`)
7. Conversation continues until user taps "End Conversation"

**Ending and scoring:**
1. User taps "End Conversation" or the AI naturally concludes (after covering all selected cards)
2. AI sends a final summary message:
   - Topics covered
   - Concepts the user demonstrated strong understanding of
   - Concepts that need more review
   - A performance rating (1-5 stars based on accuracy, depth, and fluency)
3. Summary is persisted and visible in conversation history
4. Cards that the user struggled with are flagged for extra SRS review (their ease factor is not changed, but they are surfaced first in the next review session)

**Conversation history:**
1. User navigates to Study tab -> "Conversation History"
2. List of past conversations with: date, deck name, mode, duration, performance rating
3. Tapping a conversation shows the full chat transcript (read-only)

### Edge Cases

- **No API key configured:** Show a setup prompt: "Conversation Practice requires Claude API. Configure your API key in Settings." Block starting a conversation.
- **API rate limit or error mid-conversation:** Show error toast: "Connection issue. Tap to retry." Preserve conversation state. User can retry the last message.
- **Very large deck (> 500 cards):** Select the most relevant 50 cards for the system prompt. Prioritize: due cards > leeches > recently reviewed > random. Show notice: "Using 50 most relevant cards from your deck."
- **Empty deck (0 cards):** Block start. Show: "Add cards to this deck first."
- **Very short user responses ("idk", "yes"):** AI should prompt for more detail: "Can you elaborate?" or "What specifically do you mean?"
- **User sends content unrelated to the deck:** AI should gently redirect: "Interesting, but let's focus on [topic]. Can you tell me about [concept from card]?"
- **Conversation exceeds token limit:** End the conversation gracefully: "We've covered a lot! Let me summarize what we discussed." Trigger the scoring summary.
- **App backgrounded during conversation:** Conversation state persists in SQLite. Returning shows the conversation as-is with a "Continue?" prompt.
- **Module disabled during conversation:** Conversation is marked `abandoned`. Messages are preserved.
- **Offensive or inappropriate user input:** Claude API has built-in safety. The response will redirect appropriately.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** "Conversation Practice" button is visible on the Study tab
- [ ] **AC-2:** Configuration sheet shows deck selector, mode (4 options), difficulty, and language
- [ ] **AC-3:** Starting a conversation shows a chat interface with an AI opening message
- [ ] **AC-4:** User can type messages and receive AI responses within 3 seconds
- [ ] **AC-5:** AI responses reference specific card content from the selected deck
- [ ] **AC-6:** "End Conversation" button is always accessible
- [ ] **AC-7:** Ending a conversation shows a summary with topics covered and performance rating
- [ ] **AC-8:** Conversation history shows past conversations with date, mode, and rating
- [ ] **AC-9:** Tapping a past conversation shows the full read-only transcript
- [ ] **AC-10:** All 4 modes (tutor, quiz, explain, debate) produce distinct conversation styles

### Technical Criteria
- [ ] **TC-1:** System prompt includes up to 50 card front/back pairs from the selected deck
- [ ] **TC-2:** Conversation messages persist in `fl_conversation_messages` as they are sent
- [ ] **TC-3:** Claude API calls use `claude-haiku-4-5-20251001` for cost efficiency
- [ ] **TC-4:** API errors surface as retryable toasts without losing conversation state
- [ ] **TC-5:** Performance rating (1-5) is extracted from the AI's final summary message
- [ ] **TC-6:** V4 migration creates tables without affecting existing data
- [ ] **TC-7:** Token usage per message is tracked in `fl_conversation_messages.tokens_used`

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Conversation practice must NOT modify card SRS scheduling (ease, interval, etc.)
- [ ] **NC-2:** AI responses must NOT contain information outside the deck's card content (no hallucinated facts)
- [ ] **NC-3:** User messages must NOT be sent to any server other than the Claude API
- [ ] **NC-4:** API key must NOT be logged or included in error messages
- [ ] **NC-5:** Conversation mode must NOT block standard review or other Flash features

## UI Specification

### Mobile (Expo)

**Configuration Sheet (bottom sheet)**
- Background: `#12121A` (surface token) with glass border
- Mode cards: 4 glass cards in a 2x2 grid, each with icon + mode name + one-line description
- Difficulty: segmented control [Beginner, Medium, Advanced]
- "Start Conversation" button: full-width, `#FBBF24` background

**Conversation Screen (full-screen chat)**
- Background: `#0A0A0F` (background token)
- Header: deck name + mode badge + duration timer
- Chat bubbles:
  - AI messages: left-aligned, `rgba(255,255,255,0.04)` (glass) background, `glassBorder`
  - User messages: right-aligned, `#FBBF24` background at 20% opacity, `#FBBF24` border
  - System/summary: centered, dashed border, slightly dimmer text
- Input bar: bottom, glass background, text input + send button (`#FBBF24` icon)
- "End Conversation" button: top-right, ghost style

**Conversation History**
- List of glass cards, each showing: deck name, mode icon, date, duration, star rating (1-5)
- Empty state: "No conversations yet. Start your first practice session!"

### Web (Next.js)

- Same design tokens via CSS variables
- Chat layout: centered column (max-width 600px), scrollable message area
- Input: sticky bottom bar with auto-growing textarea
- Route: `/flash/conversation` (config + start), `/flash/conversation/:id` (active/history view)
- History: sidebar list or separate `/flash/conversation/history` page

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Typing indicator ("AI is thinking...") | Waiting for API response |
| Config | Configuration sheet with options | "Conversation Practice" tapped |
| Active | Chat interface with messages flowing | Conversation started |
| Error | Retry toast over chat | API call failed |
| Summary | Final AI message with performance rating | Conversation ended |
| History | List of past conversations | History view opened |

## Test Requirements

### Unit Tests
- [ ] `buildSystemPrompt(deck, mode, difficulty)`: includes card content in prompt
- [ ] `buildSystemPrompt(deck, mode, difficulty)`: limits to 50 cards
- [ ] `buildSystemPrompt(deck, mode, difficulty)`: tutor/quiz/explain/debate have different instructions
- [ ] `selectCardsForContext(deck, maxCards)`: prioritizes due > leech > recent > random
- [ ] `selectCardsForContext(emptyDeck, maxCards)`: returns empty array
- [ ] `extractPerformanceRating(summaryMessage)`: extracts 1-5 star rating from AI text
- [ ] `extractPerformanceRating(noRating)`: returns null if no rating found
- [ ] `formatCardContext(cards)`: formats front/back pairs as structured text
- [ ] `formatCardContext([])`: returns empty string
- [ ] `estimateTokens(messages)`: approximates token count for context window check
- [ ] V4 migration: tables created, indexes created

### Integration Tests
- [ ] Full flow: configure -> start -> exchange 3 messages -> end -> summary shown -> history updated
- [ ] Error flow: API failure -> retry toast -> retry succeeds -> conversation continues
- [ ] Resume flow: start conversation -> background -> return -> conversation state preserved

### QA Verification Script

1. Open the app on iOS simulator
2. Navigate to MyFlash via hub dashboard
3. Ensure a deck exists with 20+ cards and a Claude API key is configured in settings
4. Navigate to Study tab
5. **Verify:** "Conversation Practice" button visible (AC-1)
6. Tap "Conversation Practice"
7. **Verify:** Configuration sheet shows all options (AC-2)
8. Select a deck, "Tutor" mode, "Medium" difficulty
9. Tap "Start Conversation"
10. **Verify:** Chat interface appears with AI opening message (AC-3)
11. Type a response and tap send
12. **Verify:** AI responds within 3 seconds, references card content (AC-4, AC-5)
13. Exchange 3-4 more messages
14. Tap "End Conversation"
15. **Verify:** End button was accessible throughout (AC-6)
16. **Verify:** AI sends summary with topics and performance rating (AC-7)
17. Navigate to conversation history
18. **Verify:** The conversation appears with date, mode, and rating (AC-8)
19. Tap the conversation
20. **Verify:** Full transcript shown read-only (AC-9)
21. Start new conversations in "Quiz", "Explain", and "Debate" modes
22. **Verify:** Each mode produces a distinct conversation style (AC-10)
23. Open web at /flash/conversation, repeat steps 6-22
24. **Verify:** Web interface works identically
25. Test with no API key configured
26. **Verify:** Setup prompt shown, start blocked

## gstack Quality Gates

Based on this feature's complexity score (1 -- Complex), these gstack skills are REQUIRED:

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in flash module, run `/qa` on the module URL

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if Complexity <= 1 (Complex):
- [ ] `/office-hours` (builder mode) -- validate approach before building

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Flash module has AI card generation infrastructure (`ai/generator.ts`) with on-device text parsing and a cloud placeholder that throws "requires API key." There is no conversational interface, no chat-based study mode, and no Claude API integration for multi-turn conversations.

### After This Work
- Two new tables: `fl_conversations` (session metadata + scoring) and `fl_conversation_messages` (chat transcript)
- Four conversation modes: tutor, quiz, explain, debate
- Claude API integration for multi-turn conversation with deck content as knowledge base
- Chat UI on mobile (Expo) and web (Next.js)
- Performance rating extraction from AI summary
- Conversation history with full transcripts

### Files Changed
- `modules/flash/src/conversation/types.ts` -- New: Conversation, Message, ConversationConfig types
- `modules/flash/src/conversation/engine.ts` -- New: conversation orchestration, prompt construction
- `modules/flash/src/conversation/prompts.ts` -- New: system prompt templates per mode
- `modules/flash/src/conversation/index.ts` -- New: barrel export
- `modules/flash/src/conversation/__tests__/engine.test.ts` -- New: unit tests
- `modules/flash/src/db/conversation.ts` -- New: CRUD for conversations and messages
- `modules/flash/src/db/schema.ts` -- Add V4 migration SQL
- `modules/flash/src/definition.ts` -- Add FLASH_MIGRATION_V4
- `modules/flash/src/index.ts` -- Export conversation types and functions
- `apps/mobile/app/(flash)/conversation.tsx` -- New: chat UI screen
- `apps/mobile/app/(flash)/conversation-history.tsx` -- New: history list screen
- `apps/mobile/app/(flash)/components/ChatBubble.tsx` -- New: message bubble component
- `apps/web/app/flash/conversation/page.tsx` -- New: web conversation page
- `apps/web/app/flash/conversation/history/page.tsx` -- New: web history page

### Known Limitations
- V1 requires Claude API key (no on-device fallback for conversations). This is a deliberate design choice: multi-turn Socratic dialogue requires LLM capability.
- V1 does not support voice input/output. Text only. Voice would require speech-to-text + text-to-speech integration (future).
- V1 does not enforce strict knowledge boundaries (AI may occasionally reference general knowledge outside the deck). The system prompt instructs it to stay focused, but it's not a hard constraint.
- No conversation sharing or export. Local only.
- Token usage is tracked per message but not capped per user. Future: add monthly token budget.

### Context for Next Agent
- The conversation engine constructs a system prompt with card content. Use `claude-haiku-4-5-20251001` for cost efficiency (conversations generate many turns, each costing tokens).
- Card selection for context should prioritize cards the user struggles with (due > leech > recent). Use the same card ordering logic as `listDueFlashcards`.
- The performance rating (1-5) is extracted from the AI's final summary. Include explicit instructions in the system prompt: "End your summary with 'Performance: X/5' where X is your rating."
- Conversation state must survive app backgrounding. Persist all messages to SQLite as they arrive. On resume, reconstruct the conversation from the database.
- The `cards_referenced` count on `fl_conversations` is incremented each time the AI mentions a card concept. This is an approximate count based on keyword matching against card fronts/backs.
