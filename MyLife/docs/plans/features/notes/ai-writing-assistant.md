# Feature Spec: AI Writing Assistant

## Metadata
- **Module:** notes
- **Priority Score:** 32 / 50 (A-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 3 x3 + Complexity 1 x2 + CrossModule 2 x1 + PaidUser 4 x1
- **Sprint:** Sprint 5 (S+A Features)
- **Estimated CC Time:** 3-4 hours
- **Depends On:** NT-001 (Markdown Editor -- implemented)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Notion AI ($8/mo add-on) generates $100M+ ARR by helping users write, summarize, translate, and brainstorm within their notes. It is Notion's fastest-growing revenue line. Users select text and get AI-powered rewriting, expansion, summarization, and tone adjustment without leaving the editor. MyNotes can offer a privacy-conscious alternative: on-device AI for basic operations (summarize, fix grammar, expand) with opt-in cloud AI (Claude API) for advanced features. The key differentiator is transparency -- users choose whether to process text locally or send it to an API, with clear labeling of which mode is active. This is a premium feature that drives MyLife Pro subscriptions.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Notion | Yes | $8/mo add-on | Notion AI: rewrite, summarize, translate, brainstorm, continue writing. Cloud-processed via OpenAI/Anthropic. |
| Obsidian | Partial | Free (plugins) | Community plugins (Text Generator, Copilot) use external APIs. No official AI feature. |
| Evernote | Yes | Premium | AI-powered search and organization. Limited writing assistance. Cloud-based. |
| Apple Notes | No | N/A | No AI writing features (as of iOS 18). |
| Google Docs | Yes | Free (Gemini) | "Help me write" feature. Cloud-processed via Gemini. |

### Target User
Writers, students, professionals, and anyone who wants AI assistance while writing notes. Primary migration target: Notion AI users paying $8/mo ($96/yr) who want the same capabilities with privacy controls and without a separate AI subscription on top of a notes subscription.

## Technical Context

### Where This Lives in MyLife

```
modules/notes/src/ai/                             -- NEW: AI writing assistant engine
modules/notes/src/ai/types.ts                     -- AiAction, AiRequest, AiResponse types
modules/notes/src/ai/actions.ts                   -- Action definitions (summarize, expand, rewrite, etc.)
modules/notes/src/ai/provider.ts                  -- AI provider interface (local + cloud)
modules/notes/src/ai/local-engine.ts              -- On-device text operations (no AI model needed)
modules/notes/src/ai/cloud-engine.ts              -- Claude API integration (opt-in)
modules/notes/src/ai/index.ts                     -- Barrel export
modules/notes/src/ai/__tests__/                   -- Tests
apps/mobile/app/(notes)/components/AiToolbar.tsx   -- Mobile AI action toolbar
apps/web/app/notes/components/AiToolbar.tsx        -- Web AI action toolbar
```

### Wireframe Position

```
Hub Dashboard
  └── MyNotes card
       └── Notes tab -> Note Editor
            └── Select text -> AI toolbar appears ← YOU ARE HERE
            └── Cursor in empty area -> "AI: Write about..." ← ALSO HERE
```

### Data Model

New table in migration V2 for tracking AI usage and history:

```sql
CREATE TABLE IF NOT EXISTS nt_ai_history (
  id TEXT PRIMARY KEY NOT NULL,
  note_id TEXT NOT NULL REFERENCES nt_notes(id) ON DELETE CASCADE,
  action TEXT NOT NULL
    CHECK (action IN ('summarize', 'expand', 'rewrite', 'fix_grammar', 'simplify', 'translate', 'tone_change', 'continue', 'brainstorm', 'custom')),
  input_text TEXT NOT NULL,
  output_text TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'local'
    CHECK (provider IN ('local', 'cloud')),
  accepted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS nt_ai_history_note_idx ON nt_ai_history(note_id);
```

New settings keys (using existing `nt_settings`):

```sql
INSERT OR IGNORE INTO nt_settings (key, value) VALUES ('aiEnabled', 'true');
INSERT OR IGNORE INTO nt_settings (key, value) VALUES ('aiProvider', 'local');
INSERT OR IGNORE INTO nt_settings (key, value) VALUES ('aiApiKey', '');
INSERT OR IGNORE INTO nt_settings (key, value) VALUES ('aiDefaultTone', 'neutral');
```

### Dependencies
- **Internal:** `@mylife/db`, notes CRUD, settings
- **External:** Claude API (`@anthropic-ai/sdk`) for cloud mode (opt-in). No external dependency for local mode.
- **Cross-Module:** AI engine could be shared with journal (AI prompts) and other text-heavy modules. The `@mylife/intelligence` package may provide shared AI infrastructure.

## Functional Requirements

### User Stories
1. As a writer, I want to select text and ask AI to rewrite, summarize, or expand it so that I can improve my writing without leaving the editor.
2. As a student, I want AI to simplify complex text so that I can create study notes from dense source material.
3. As a privacy-conscious user, I want to choose between on-device and cloud AI so that I control whether my text leaves my device.

### Behavior Specification

1. **Text Selection AI Actions:**
   a. User selects text in the note editor.
   b. An AI action toolbar appears above the selection (floating toolbar):
      - "Summarize" -- condense the selected text.
      - "Expand" -- elaborate on the selected text with more detail.
      - "Rewrite" -- rephrase while keeping the same meaning.
      - "Fix Grammar" -- correct grammar and spelling errors.
      - "Simplify" -- make the text easier to understand.
      - "Translate" -- translate to a chosen language.
      - "Change Tone" -- adjust to formal/casual/professional/friendly.
   c. User taps an action.
   d. Processing indicator replaces the toolbar.
   e. Result appears in a preview card below the selection:
      - Shows the AI-generated text.
      - "Accept" replaces the selected text with the result.
      - "Discard" dismisses the preview.
      - "Retry" re-runs the action.
      - Provider badge: "On-device" or "Cloud (Claude)" for transparency.
   f. Accepted results are logged in `nt_ai_history`.

2. **Cursor AI Actions (no selection):**
   a. User places cursor in an empty area and triggers AI (slash command `/ai` or dedicated button).
   b. Options:
      - "Continue writing" -- AI continues from the existing text above the cursor.
      - "Brainstorm" -- generate bullet-point ideas about the note's topic.
      - "Custom prompt" -- user types a specific instruction.

3. **Provider Modes:**
   a. **Local mode (default):** Uses rule-based text transformations for grammar fixes, simplification (readability heuristics), and basic summarization (extractive -- pulls key sentences). No AI model needed. No network. Limited quality but fully private.
   b. **Cloud mode (opt-in):** Uses Claude API for all actions. Higher quality, generative results. Requires API key. User explicitly opts in with a clear privacy disclosure: "Selected text will be sent to Anthropic's API for processing."

4. **Settings:**
   a. AI enabled/disabled toggle.
   b. Provider: "On-device only" (default) or "Cloud (Claude API)".
   c. API key input (for cloud mode).
   d. Default tone preference.

### Edge Cases

- **No text selected and no context:** AI toolbar not shown. Slash command `/ai` shows "Write some text first for AI assistance."
- **Very short selection (1-2 words):** Some actions disabled (e.g., summarize). Show tooltip "Select more text for this action."
- **Very long selection (10,000+ chars):** Local mode may truncate. Cloud mode handles via API chunking.
- **Cloud API unavailable:** Toast "Cloud AI is unavailable. Try again later or switch to on-device mode."
- **Invalid API key:** Toast "Invalid API key. Check your AI settings."
- **API rate limit:** Toast "Too many requests. Please wait a moment."
- **Local mode limitations:** Summarize is extractive only (pulls top sentences by TF-IDF). Expand and continue are not available in local mode (require generative AI). These actions show "Cloud mode required" badge.
- **Translation languages:** Support 10 languages: English, Spanish, French, German, Chinese, Japanese, Korean, Portuguese, Italian, Russian.
- **Offline with cloud mode selected:** Falls back to local mode with toast "Offline -- using on-device mode."
- **AI history deletion:** User can clear AI history from settings. Does not affect notes.
- **Undo after accept:** Standard undo (Ctrl+Z) reverts the accepted AI change.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** AI action toolbar appears when text is selected in the editor.
- [ ] **AC-2:** 7 text actions available: summarize, expand, rewrite, fix grammar, simplify, translate, change tone.
- [ ] **AC-3:** AI result shown in preview card with Accept/Discard/Retry options.
- [ ] **AC-4:** Provider badge clearly shows "On-device" or "Cloud (Claude)" on each result.
- [ ] **AC-5:** "Continue writing" and "Brainstorm" available from cursor position.
- [ ] **AC-6:** Settings allow choosing provider (local/cloud) and entering API key.
- [ ] **AC-7:** Privacy disclosure shown when switching to cloud mode.
- [ ] **AC-8:** Accepted results replace selected text and are undoable.
- [ ] **AC-9:** AI can be completely disabled in settings (no toolbar, no actions).
- [ ] **AC-10:** Local mode works fully offline with no network requests.

### Technical Criteria
- [ ] **TC-1:** Migration V2 creates nt_ai_history table and AI settings keys.
- [ ] **TC-2:** Local engine implements grammar fix, simplify, and extractive summarize without external dependencies.
- [ ] **TC-3:** Cloud engine uses Claude API (`@anthropic-ai/sdk`) with appropriate system prompts.
- [ ] **TC-4:** API key stored in `nt_settings` (on-device, not transmitted beyond Claude API calls).
- [ ] **TC-5:** AI history logged with action type, input, output, provider, and acceptance status.
- [ ] **TC-6:** Cloud mode sends only the selected text to the API, not the entire note body.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** In local mode, text must NEVER be sent over the network.
- [ ] **NC-2:** Cloud mode must NEVER activate without explicit user opt-in.
- [ ] **NC-3:** API key must NEVER be logged, transmitted outside Claude API calls, or visible in the UI after entry.
- [ ] **NC-4:** AI actions must NEVER modify the note without user acceptance (preview-first).
- [ ] **NC-5:** AI-generated text must NEVER be presented as the user's own writing without the user explicitly accepting it.

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- AI action toolbar: floating glass bar above selected text, horizontal scrollable action buttons
- Action buttons: pill-shaped, icon + label, `rgba(255,255,255,0.08)` background, 13px text
- Processing state: pulsing sparkle icon with "Thinking..." text in `#64748B`
- Result preview card: glass card below selection, AI text in `#F0F0F5`, provider badge (12px pill), Accept (green), Discard (textSecondary), Retry (accent)
- Provider badge: "On-device" = `rgba(48,209,88,0.2)` bg + `#30D158` text, "Cloud" = `rgba(100,116,139,0.2)` bg + `#64748B` text
- Slash command: `/ai` in editor triggers action menu
- Module accent: `#64748B`

### Web (Next.js)

- Route: existing note editor at `/notes/[id]`
- AI toolbar as floating popover on text selection
- Same result preview with Accept/Discard/Retry
- Settings page at `/notes/settings` with AI section

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| No Selection | No AI toolbar | Cursor without selection |
| Selection | AI action toolbar above selection | Text selected |
| Processing | Sparkle animation, "Thinking..." | Action triggered |
| Result | Preview card with AI output and Accept/Discard/Retry | Processing complete |
| Accepted | AI text replaces selection, toast "Applied" | User taps Accept |
| Discarded | Preview dismissed, original text unchanged | User taps Discard |
| Error | "AI unavailable" toast | API error or offline |
| Disabled | No AI UI anywhere | AI disabled in settings |
| Local Limited | "Cloud mode required" on generative actions | Local mode, action needs generation |

## Test Requirements

### Unit Tests
- [ ] `extractiveSummarize`: 500-word text -> returns top 3 sentences
- [ ] `extractiveSummarize`: 1-sentence text -> returns that sentence unchanged
- [ ] `fixGrammar`: "their going to the store" -> "they're going to the store" (basic rule-based)
- [ ] `simplifyText`: academic text -> simpler vocabulary and shorter sentences
- [ ] `buildClaudePrompt`: action "rewrite" + input text -> correct system + user prompt
- [ ] `buildClaudePrompt`: action "translate" + language "Spanish" -> correct prompt
- [ ] `logAiAction`: creates nt_ai_history record with all fields
- [ ] `getAiHistory`: returns history for a note sorted by created_at desc
- [ ] `clearAiHistory`: deletes all history records
- [ ] `isActionAvailableLocal`: "summarize" -> true, "continue" -> false

### Integration Tests
- [ ] Full flow: select text -> tap "Rewrite" (local mode) -> preview shown -> accept -> text replaced -> history logged
- [ ] Cloud flow: configure API key -> select text -> tap "Expand" (cloud mode) -> Claude API called -> preview shown -> accept

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyNotes > Settings
3. Verify: AI settings (enabled, provider, API key, tone) -- corresponds to AC-6
4. Ensure AI is enabled, provider is "On-device"
5. Create a note with a paragraph of text
6. Select the paragraph
7. Verify: AI action toolbar appears -- corresponds to AC-1
8. Verify: 7 actions visible -- corresponds to AC-2
9. Tap "Fix Grammar"
10. Verify: processing indicator shown, then result preview -- corresponds to AC-3
11. Verify: "On-device" provider badge -- corresponds to AC-4
12. Tap "Accept"
13. Verify: text replaced with corrected version -- corresponds to AC-8
14. Undo (Ctrl+Z)
15. Verify: original text restored
16. Place cursor at end of text, type `/ai`
17. Verify: "Continue writing" and "Brainstorm" options -- corresponds to AC-5
18. Switch to cloud mode in settings
19. Verify: privacy disclosure shown -- corresponds to AC-7
20. Enter Claude API key
21. Select text and tap "Expand"
22. Verify: "Cloud (Claude)" badge on result -- corresponds to AC-4
23. Disable AI in settings
24. Verify: no AI toolbar on text selection -- corresponds to AC-9
25. Enable AI, turn on airplane mode
26. Verify: local mode works offline -- corresponds to AC-10

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to note editor, select text, verify AI toolbar and actions

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
MyNotes has no AI capabilities. Users edit text manually with no writing assistance. No integration with any AI provider.

### After This Work
An AI writing assistant with 7 text actions on selection and 3 cursor actions. Dual-mode: on-device (rule-based, offline) and cloud (Claude API, opt-in). Preview-first workflow with Accept/Discard/Retry. Provider transparency badges. AI history logging. Privacy-first with clear opt-in for cloud processing.

### Files Changed
- `modules/notes/src/db/schema.ts` -- CREATE nt_ai_history table, AI settings keys
- `modules/notes/src/definition.ts` -- add AI table to NOTES_MIGRATION_V2
- `modules/notes/src/ai/types.ts` -- AiAction, AiRequest, AiResponse, AiProvider types
- `modules/notes/src/ai/actions.ts` -- action definitions with prompts and local/cloud availability
- `modules/notes/src/ai/provider.ts` -- AiProvider interface, provider factory
- `modules/notes/src/ai/local-engine.ts` -- extractiveSummarize, fixGrammar, simplifyText (rule-based)
- `modules/notes/src/ai/cloud-engine.ts` -- Claude API integration with prompt building
- `modules/notes/src/ai/index.ts` -- barrel export
- `modules/notes/src/ai/__tests__/local-engine.test.ts` -- local engine tests
- `modules/notes/src/ai/__tests__/actions.test.ts` -- action availability tests
- `modules/notes/src/db/ai.ts` -- AI history CRUD
- `modules/notes/src/types.ts` -- add AiHistory Zod schema
- `modules/notes/src/index.ts` -- re-export AI module
- `apps/mobile/app/(notes)/components/AiToolbar.tsx` -- floating AI toolbar
- `apps/web/app/notes/components/AiToolbar.tsx` -- web AI toolbar

### Known Limitations
- Local mode is rule-based, not ML-based. Quality is limited for summarization (extractive only) and rewriting (pattern-based).
- "Continue writing" and "Brainstorm" are cloud-only (require generative AI).
- No fine-tuning or custom model support.
- No voice input for custom prompts.
- No context window -- AI sees only the selected text, not the full note (for privacy and simplicity).
- Translation quality in local mode is not available (cloud-only feature).

### Context for Next Agent
- Local engine: `extractiveSummarize` uses TF-IDF to rank sentences and returns the top N. `fixGrammar` uses regex-based rules for common errors (their/they're, its/it's, etc.). `simplifyText` replaces complex words with simpler synonyms from a lookup table and breaks long sentences.
- Cloud engine: uses `@anthropic-ai/sdk` with `claude-sonnet-4-5-20250514` model. System prompt varies by action. User prompt is the selected text. Max tokens = 2x input length for expand, 0.5x for summarize, 1x for rewrite.
- The `@mylife/intelligence` package at `packages/intelligence/` may already have AI infrastructure. Check before duplicating.
- API key storage: stored in `nt_settings` on-device SQLite. Never logged. Transmitted only in the `x-api-key` header to `api.anthropic.com`.
- V2 migration coordination: shares V2 with other features. Combine all into one V2 migration.
- Complexity is 1 (complex tier). Consider `/plan-eng-review` before building.
