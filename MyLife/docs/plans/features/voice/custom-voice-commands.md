# Feature Spec: Custom Voice Commands

## Metadata
- **Module:** voice
- **Priority Score:** 29 / 50 (B-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [3] x3 + Complexity [2] x2 + CrossModule [3] x1 + PaidUser [4] x1
- **Sprint:** 3-4
- **Estimated CC Time:** 3-5 hours
- **Depends On:** none (VoiceCommand type already exists in types.ts)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Custom voice commands let users define trigger phrases that execute actions across MyLife modules. This turns voice dictation from a passive transcription tool into an active control surface for the entire hub. "Add milk to my grocery list" routes to Recipes. "Start my morning fast" triggers the Fast module. This cross-module integration is a key differentiator since no competitor offers voice commands that span 29 personal app modules in one hub.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Otter.ai | Partial | Yes ($100/yr) | AI-powered action items from transcription, not real-time commands |
| Notta | No | N/A | Transcription-only, no command execution |
| Apple Shortcuts | Yes | Free | Custom voice triggers via Siri, limited to iOS, requires Shortcuts app setup |
| Google Assistant | Yes | Free | Custom routines, cloud-dependent, limited to Google ecosystem |

### Target User
Power users who want hands-free control over their personal data. Primary: users who already use MyLife with 3+ modules active and want a voice-first workflow. Secondary: accessibility-focused users who benefit from voice control. Migration path: Apple Shortcuts users frustrated by platform lock-in and limited personal data integration.

## Technical Context

### Where This Lives in MyLife

```
modules/voice/src/db/schema.ts         -- New table DDL (vc_commands, vc_command_log)
modules/voice/src/db/crud.ts           -- New CRUD for commands and command log
modules/voice/src/types.ts             -- Expand VoiceCommandSchema, add CommandLogSchema
modules/voice/src/engine/commands.ts   -- Command matching engine (phrase -> action routing)
modules/voice/src/definition.ts        -- Migration v2 (or v3 if speaker ID ships first)
modules/voice/src/index.ts             -- Re-export new APIs
apps/mobile/app/(voice)/               -- Commands management screen, command builder
apps/web/app/voice/                    -- Web equivalents
```

### Wireframe Position

```
Hub Dashboard
  └── MyVoice card
       └── Dictate tab
            └── [Listening mode detects commands] ← ENHANCED
       └── Settings tab
            └── Voice Commands ← NEW
                 └── Command Builder ← NEW
```

### Data Model

```sql
-- New table: user-defined voice commands
CREATE TABLE IF NOT EXISTS vc_commands (
  id TEXT PRIMARY KEY,
  phrase TEXT NOT NULL,
  action TEXT NOT NULL,
  module_target TEXT,
  params TEXT,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 0,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- New table: command execution log
CREATE TABLE IF NOT EXISTS vc_command_log (
  id TEXT PRIMARY KEY,
  command_id TEXT NOT NULL REFERENCES vc_commands(id) ON DELETE CASCADE,
  matched_phrase TEXT NOT NULL,
  match_confidence REAL,
  executed_at TEXT NOT NULL DEFAULT (datetime('now')),
  success INTEGER NOT NULL DEFAULT 1,
  error_message TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS vc_commands_enabled_idx ON vc_commands(is_enabled);
CREATE INDEX IF NOT EXISTS vc_commands_module_idx ON vc_commands(module_target);
CREATE INDEX IF NOT EXISTS vc_command_log_command_idx ON vc_command_log(command_id);
CREATE INDEX IF NOT EXISTS vc_command_log_executed_idx ON vc_command_log(executed_at DESC);
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), `@mylife/module-registry` (to resolve module_target and validate target module is enabled)
- **External:** On-device speech recognition (expo-speech or platform-native). No cloud APIs.
- **Cross-Module:** This feature is inherently cross-module. Commands can target any enabled module:
  - Fast: "Start fasting" / "End fast"
  - Budget: "Add expense [amount] for [category]"
  - Recipes: "Add [item] to shopping list"
  - Mood: "Log mood [rating]"
  - Habits: "Mark [habit] done"
  - Meds: "Log medication [name]"
  - Journal: "New journal entry"
  - Notes: "Create note [title]"

## Functional Requirements

### User Stories
1. As a user, I want to define custom voice phrases that trigger specific actions so that I can control MyLife hands-free.
2. As a user, I want preset command templates for common actions across modules so that setup is quick.
3. As a user, I want to see a log of executed commands so that I can verify what happened and troubleshoot failures.
4. As a user, I want to enable/disable individual commands without deleting them so that I can manage my command set.
5. As a user, I want the command system to work during live dictation so that I don't need a separate "command mode."

### Behavior Specification

**Creating a custom command:**
1. User navigates to Settings > Voice Commands
2. User taps "Add Command"
3. Command builder screen appears with fields:
   - Trigger phrase (text input or "Record phrase" button)
   - Action type dropdown (e.g., "Start Fast", "Log Expense", "Add to Shopping List", "Log Mood", "Create Note")
   - Target module (auto-filled based on action, or manual override)
   - Parameters (dynamic fields based on action type)
4. User saves the command
5. System creates the command record and shows it in the list

**Using preset templates:**
1. In the command list, user taps "Browse Templates"
2. System shows categorized preset templates grouped by module
3. User taps a template to preview it
4. User taps "Add" to install the template (can customize phrase before saving)

**Executing a command during dictation:**
1. User is recording via the Dictate tab
2. User speaks a registered trigger phrase (e.g., "Hey MyLife, start my fast")
3. System detects the phrase match in the live transcript
4. A toast notification confirms: "Starting fast..." with the module icon
5. System routes the action to the target module
6. Command log entry is created with success/failure status
7. Transcription continues (command phrase is marked but not removed from transcript)

**Viewing command log:**
1. User navigates to Settings > Voice Commands > History
2. List shows recent command executions: phrase matched, action taken, timestamp, success/fail badge
3. Failed commands show error message on tap

### Edge Cases
- Trigger phrase matches partial sentence: only trigger if the phrase appears as a complete segment (start of sentence or after pause)
- Multiple commands match the same phrase: execute the highest priority command, log which was chosen
- Target module is disabled: show error toast "Module [name] is not enabled", log failure
- Target module action fails (e.g., invalid expense amount): log failure with error message, show toast
- Very similar trigger phrases (e.g., "add milk" vs "add milk to list"): longer phrase takes priority (more specific match)
- Empty trigger phrase: prevent save, show validation error
- Duplicate trigger phrase: warn user, allow override with confirmation
- Command executed while offline (for network-dependent modules like Surf): show "offline" error, do not retry
- Module removed/uninstalled: commands targeting it become orphaned, shown as "inactive" in list
- Recording stops mid-command phrase: no match, treat as normal transcription
- Very long trigger phrase (>10 words): allow but warn "shorter phrases work more reliably"
- Special characters in trigger phrase: strip to alphanumeric + spaces for matching

### Preset Command Templates

| Module | Template Phrase | Action |
|--------|----------------|--------|
| Fast | "Start fasting" | Start a new fast |
| Fast | "End my fast" | End current fast |
| Budget | "Add expense [amount]" | Create quick expense |
| Recipes | "Add [item] to shopping list" | Add shopping list item |
| Mood | "Log mood [1-5]" | Quick mood entry |
| Habits | "Mark [habit] done" | Complete habit for today |
| Meds | "Took my [medication]" | Log medication dose |
| Journal | "New journal entry" | Open journal composer |
| Notes | "Quick note [text]" | Create a new note |
| Workouts | "Start workout" | Begin workout session |

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** User can create a custom command with a trigger phrase and target action
- [ ] **AC-2:** Command builder shows dynamic parameter fields based on selected action type
- [ ] **AC-3:** Preset templates are browseable by module and installable with one tap
- [ ] **AC-4:** Speaking a trigger phrase during dictation shows a confirmation toast
- [ ] **AC-5:** Command execution routes to the correct target module and performs the action
- [ ] **AC-6:** Commands can be enabled/disabled via toggle without deletion
- [ ] **AC-7:** Command log shows history of executions with success/fail indicators
- [ ] **AC-8:** Failed command shows error message in the log detail
- [ ] **AC-9:** Duplicate trigger phrase warning appears with override option
- [ ] **AC-10:** Commands targeting disabled modules show clear "module not enabled" error

### Technical Criteria
- [ ] **TC-1:** vc_commands and vc_command_log tables are created by the migration
- [ ] **TC-2:** Command matching engine uses normalized phrase comparison (case-insensitive, trimmed)
- [ ] **TC-3:** Priority field determines winner when multiple commands match
- [ ] **TC-4:** usage_count increments on each successful execution
- [ ] **TC-5:** Command log entries include match_confidence score (0.0 to 1.0)
- [ ] **TC-6:** Deleting a command cascades to delete its log entries
- [ ] **TC-7:** Module target validation checks module-registry for enabled status
- [ ] **TC-8:** Zod schemas validate command and log data at boundaries
- [ ] **TC-9:** Phrase matching handles variable slots (e.g., "[amount]" replaced with regex capture group)

### Negative Criteria
- [ ] **NC-1:** Command execution must NOT block the recording/transcription pipeline
- [ ] **NC-2:** Commands must NOT execute on partial phrase matches within longer sentences unless at segment boundaries
- [ ] **NC-3:** Command parameters must NOT be sent to any external service (all processing on-device)
- [ ] **NC-4:** Command log must NOT store audio data, only matched text

## UI Specification

### Mobile (Expo)

**Voice Commands list screen:**
- Background: `#0A0A0F` (background token)
- Command cards: glass surface (`rgba(255,255,255,0.04)`) with border
- Each card: trigger phrase in `text` token (bold), action description in `textSecondary`, module icon + name badge, enable/disable toggle right-aligned
- Module accent: `#EF4444`
- "Add Command" FAB or bottom button

**Command Builder screen:**
- Step-by-step form: Phrase input (with microphone button for voice capture), Action type picker (grouped by module), Parameter fields (dynamic based on action)
- Preview card at bottom showing how the command will appear
- "Test Command" button that simulates execution without routing

**Command Log screen:**
- Timeline-style list: each entry shows matched phrase, module icon, timestamp
- Success entries: green checkmark, Failure entries: red X with expandable error

### Web (Next.js)

- Same tokens via CSS variables
- Sidebar navigation: accessible via `/voice/commands` route
- Two-column layout: command list left, builder/detail right
- Command log accessible via `/voice/commands/history`

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton command cards | Initial load |
| Empty | "No commands yet" + "Get started with templates" CTA | No commands created |
| Error | "Failed to load commands" + retry | DB read fails |
| Success | List of command cards with toggles | Commands exist |
| Partial | Some commands active, some shown as "inactive (module disabled)" | Target module was disabled |

## Test Requirements

### Unit Tests
- [ ] `createCommand`: creates with phrase, action, module_target, returns VoiceCommand
- [ ] `createCommand`: handles optional params and priority fields
- [ ] `getCommand`: returns null for non-existent ID
- [ ] `getCommands`: returns enabled commands only when filtered
- [ ] `updateCommand`: updates phrase, action, is_enabled
- [ ] `deleteCommand`: removes command and cascades to log entries
- [ ] `logCommandExecution`: creates log entry with confidence and success
- [ ] `getCommandLog`: returns entries ordered by executed_at DESC
- [ ] `incrementUsageCount`: bumps count on successful execution
- [ ] Command engine: exact phrase match returns correct command
- [ ] Command engine: case-insensitive matching works
- [ ] Command engine: longest phrase wins on ambiguous matches
- [ ] Command engine: priority field breaks ties
- [ ] Command engine: disabled commands are excluded from matching
- [ ] Command engine: variable slot extraction ("[amount]" captures "50")
- [ ] Command engine: no match returns null (does not throw)

### Integration Tests
- [ ] Full flow: create command -> speak phrase during dictation -> command logged as executed
- [ ] Error flow: command targets disabled module -> logged as failure with error message
- [ ] Template flow: install preset template -> command appears in list -> executable

### QA Verification Script

1. Open the app on iOS/Android
2. Navigate to MyVoice > Settings > Voice Commands
3. Verify empty state shows "No commands yet" with templates CTA (Empty state)
4. Tap "Browse Templates" -- verify preset list grouped by module
5. Install "Start fasting" template -- verify it appears in command list (AC-3)
6. Tap "Add Command" -- verify builder screen appears
7. Enter phrase "remind me to stretch", select action "Create Note", module "Notes" (AC-1)
8. Verify dynamic parameter field appears for note title (AC-2)
9. Save command -- verify it appears in the list
10. Toggle the command off -- verify visual toggle state changes (AC-6)
11. Toggle back on
12. Go to Dictate tab, start recording
13. Say "start fasting" clearly
14. Verify confirmation toast appears with Fast module icon (AC-4)
15. Check that the Fast module received the action (AC-5)
16. Go to Voice Commands > History -- verify execution logged with success (AC-7)
17. Disable the Fast module in hub settings
18. Return to dictation, say "start fasting" again
19. Verify error toast "Module not enabled" appears (AC-10)
20. Check command log -- verify failure entry with error message (AC-8)
21. Create a command with a phrase identical to an existing one -- verify warning (AC-9)

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for the command matching engine

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- voice has no standalone counterpart, skip
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Voice module has a VoiceCommand type defined in types.ts but no backing table or CRUD. No command execution infrastructure exists. The Dictate tab records and transcribes but has no command detection.

### After This Work
Voice module has a complete command system: vc_commands table with CRUD, vc_command_log for execution history, a command matching engine that parses trigger phrases during live transcription, preset templates for 10 common cross-module actions, and a management UI for creating/editing/toggling commands.

### Files Changed
- `modules/voice/src/db/schema.ts` -- added CREATE_COMMANDS, CREATE_COMMAND_LOG DDL, new indexes
- `modules/voice/src/db/crud.ts` -- added command CRUD (create, get, list, update, delete, log execution, get log)
- `modules/voice/src/types.ts` -- expanded VoiceCommandSchema with new fields, added CommandLogSchema
- `modules/voice/src/engine/commands.ts` -- new file: phrase matching engine, variable slot extraction, priority resolution
- `modules/voice/src/definition.ts` -- added migration with new tables
- `modules/voice/src/index.ts` -- re-exported new APIs
- `apps/mobile/app/(voice)/commands.tsx` -- new: command list + management
- `apps/mobile/app/(voice)/command-builder.tsx` -- new: command creation/editing
- `apps/mobile/app/(voice)/command-log.tsx` -- new: execution history
- `apps/web/app/voice/commands/page.tsx` -- new: web command management

### Known Limitations
- Variable slot extraction is regex-based, not NLP. "[amount]" captures the next word/number but cannot parse complex natural language patterns. Future iteration could add on-device NLP.
- Cross-module action routing requires each target module to expose a "quick action" API. Modules without this API cannot be targeted by voice commands. The initial set covers the 10 preset templates.
- No voice activation keyword ("Hey MyLife") in v1. Commands are only detected during active dictation sessions.

### Context for Next Agent
- The VoiceCommand type already exists in types.ts (id, phrase, action, isEnabled). The new schema expands it significantly (module_target, params, priority, usage_count, timestamps). Update the existing type rather than creating a parallel one.
- Cross-module routing should use the module-registry to validate targets. Each target module needs a `quickActions` map or similar interface for the command system to call into. Define this interface in module-registry types.
- Template presets should be stored as a static JSON array in the engine, not in the database. They are installed into vc_commands when the user selects them.
