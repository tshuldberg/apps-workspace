# Hub Wiring + Messaging Integration Design

> Date: 2026-02-12
> Status: Approved
> Scope: Wire automation-hub to macos-hub, add Slack + iMessage channels, build all 4 job runners

## Goals

1. Replace automation-hub's mock adapters with real MCP tool calls to macos-hub
2. Add Slack as a new input/output channel (personal workspace, DMs to self)
3. Add iMessage as a new input/output channel (Messages.app bridge in macos-hub)
4. Enable bidirectional task capture: text/Slack yourself → system creates task → confirms in same channel
5. Build TypeScript runners for all 4 automation-hub jobs
6. Add tests for adapters, extraction, approval, and dedup

## Architecture: Adapter Pattern

### Layer Diagram

```
┌───────────────────────────────────────────────────────┐
│  Layer 4: Approval Policy (automation-hub)             │
│  Default-deny, human approval gates, audit logs        │
├───────────────────────────────────────────────────────┤
│  Layer 3: Job Orchestration (automation-hub)            │
│  4 YAML jobs, canonical tasks, dedup, voice briefs     │
├───────────────────────────────────────────────────────┤
│  Layer 2: Channel Adapters (automation-hub)             │
│  Unified interface wrapping MCP tool calls              │
│  ┌─────────┬──────────┬──────────┬───────┬──────────┐ │
│  │MailAdpt │CalAdpt   │RemAdpt   │SlackA │iMsgAdpt  │ │
│  └────┬────┴────┬─────┴────┬─────┴───┬───┴────┬─────┘ │
├───────┼─────────┼──────────┼─────────┼────────┼───────┤
│  Layer 1: MCP Tools                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │ macos-hub    │  │ Slack MCP    │  │ PM MCP        │ │
│  │ 29+4 tools   │  │ 13 tools     │  │ 7 tools       │ │
│  └─────────────┘  └──────────────┘  └───────────────┘ │
└───────────────────────────────────────────────────────┘
```

### Shared Adapter Interface

```typescript
interface ChannelAdapter {
  readonly channel: ChannelType;
  initialize(): Promise<void>;
  listItems(opts: ListOptions): Promise<ChannelItem[]>;
  getItem(id: string): Promise<ChannelItem>;
  sendResponse(target: ResponseTarget, body: string): Promise<void>;
  search?(query: string, opts?: SearchOptions): Promise<ChannelItem[]>;
}

type ChannelType = "email" | "calendar" | "reminders" | "slack" | "imessage" | "pm";

interface ChannelItem {
  id: string;
  source_channel: ChannelType;
  source_reference: string;
  timestamp: string;
  content: string;
  participants: string[];
  metadata: Record<string, unknown>;
}

interface ResponseTarget {
  channel: ChannelType;
  recipient: string;  // phone number, Slack user ID, email address
  thread_id?: string; // for threaded replies
}
```

## Component 1: iMessage Bridge (macos-hub)

### New Files

```
macos-hub/
  src/bridges/messages.bridge.ts     ← MessagesBridge class
  src/tools/messages/list.ts         ← list_messages MCP tool
  src/tools/messages/get.ts          ← get_message MCP tool
  src/tools/messages/send.ts         ← send_message MCP tool
  src/tools/messages/search.ts       ← search_messages MCP tool
  src/engine/scripts.ts              ← add Messages.app AppleScript templates
  src/types.ts                       ← add ChatMessage, Chat interfaces
```

### MCP Tools

| Tool | Purpose | Key Params |
|------|---------|------------|
| `list_messages` | List recent messages | `chat_id`, `participant`, `limit`, `since` |
| `get_message` | Get message by ID | `id` |
| `send_message` | Send iMessage | `to` (phone/email), `body` |
| `search_messages` | Search by content | `query`, `participant`, `limit` |

### AppleScript Patterns

Messages.app supports:
- `tell application "Messages" to get chats` — list conversations
- `tell application "Messages" to get messages of chat X` — read messages
- `tell application "Messages" to send "text" to buddy "+17608466479"` — send

### Self-Message Flow

User's number: 7608466479. Messages to self appear in a chat with own number.
Poll this chat for new items. Send confirmations back to same number.

## Component 2: Slack Adapter (automation-hub)

### Wraps Existing MCP Tools

No new MCP tools needed — the Slack MCP server already provides 13 tools.

| Adapter Method | Slack MCP Tool |
|---|---|
| `listItems()` | `slack_read_channel` (DM channel to self) |
| `getItem()` | `slack_read_thread` |
| `sendResponse()` | `slack_send_message` |
| `search()` | `slack_search_public_and_private` |

### User Info

- Slack User ID: U01BBL118JC
- DM to self: use user_id as channel_id in `slack_send_message`

## Component 3: Real Adapters Replacing Mocks

### automation-hub/src/adapters/

```
adapter.interface.ts        ← ChannelAdapter + types
mock.ts                     ← keep for testing
macos-mail.adapter.ts       ← wraps macos-hub mail tools
macos-calendar.adapter.ts   ← wraps macos-hub calendar tools
macos-reminders.adapter.ts  ← wraps macos-hub reminders tools
macos-messages.adapter.ts   ← wraps macos-hub iMessage tools
slack.adapter.ts            ← wraps Slack MCP tools
pm.adapter.ts               ← wraps PM MCP interface
```

### MCP Client Strategy

Adapters call MCP tools by delegating to the Claude Code environment's existing MCP connections. The adapters are designed to be used within Claude Code sessions or automation scripts that have access to the MCP servers.

For standalone CLI execution, adapters use the macos-hub bridge classes directly (imported as a local dependency) or spawn an MCP client subprocess.

## Component 4: Schema Extensions

### contracts.ts Changes

```typescript
// Add "slack" to source_system enum
source_system: z.enum([
  "gmail", "outlook", "pm_tool", "manual",
  "apple_reminders", "messages", "superwhisper",
  "calendar", "slack"  // ← NEW
])

// Add "slack_message_id" to evidence kinds
kind: z.enum([
  "email_id", "calendar_event_id", "task_id", "note",
  "message_id", "reminder_id", "transcript_id",
  "slack_message_id"  // ← NEW
])
```

### Approval Policy Additions

```yaml
- action: "slack.send_message"
  decision: "allow"
  requires_human_approval: true

- action: "messages.send_message"
  decision: "allow"
  requires_human_approval: true
```

## Component 5: Reply-in-Same-Channel

### Routing Logic

Every CanonicalTask carries `source_channel` and `source_reference`. When the orchestrator needs confirmation:

1. Look up `source_channel` on the task/item
2. Route to the matching adapter's `sendResponse()`
3. Wait for reply (poll the same channel for responses)
4. Parse yes/no/details from reply
5. Continue or abort based on response

### Confirmation Message Format

```
[Automation Hub] Action proposed:
  Create task: "Follow Up With Acme on Install Timeline"
  Project: Acme Co Post-Sales Install
  Priority: P2
  Due: 2026-02-17

Reply YES to approve, NO to cancel, or provide details.
```

## Component 6: Job Runners

### Job 01: Email Triage (exists → wire to real adapters)

Replace MockEmailAdapter with MacosMailAdapter. Replace MockPmAdapter with PmAdapter or RemindersAdapter. Replace MockCalendarAdapter with MacosCalendarAdapter.

### Job 02: Calendar-Aware Due Date Planner (new)

Steps: Load projects → build dependency graph → pull calendar capacity → detect conflicts → propose dates → generate escalation list.

Uses: MacosCalendarAdapter, PmAdapter.

### Job 03: Gantt Drift Voice Queue (new)

Steps: Load project timelines → compare against email signals → flag drift → produce corrective actions → generate voice scripts + reply drafts.

Uses: MacosMailAdapter, PmAdapter.

### Job 04: Unified Channel Consolidation (new)

Steps: Poll all channels → normalize to ChannelItem → deduplicate → extract tasks → cross-check calendar → build unified queue → draft responses.

Uses: ALL adapters (email, calendar, reminders, messages, Slack).

## Component 7: Testing Strategy

### Unit Tests

- `extraction.test.ts` — action candidate extraction, date parsing, priority inference
- `approval-gate.test.ts` — policy evaluation, default-deny, human approval
- `hash.test.ts` — semantic fingerprint dedup
- `adapter-normalization.test.ts` — each adapter's item normalization

### Integration Tests

- Each adapter against fixture data (mock MCP responses)
- Job runners in dry-run mode with fixture inputs
- Reply-in-same-channel routing logic

### E2E Tests

- All 4 jobs with fixture data producing expected run artifacts
- iMessage bridge AppleScript output parsing (macos-hub)

## Performance Considerations

- iMessage bridge: Messages.app AppleScript can be slow with large chat histories. Use `since` parameter to limit scope.
- Slack adapter: Rate limits on Slack API (tier 3/4). Respect pagination, add backoff.
- Watcher polling: Don't poll all channels every second. Use configurable intervals matching existing watcher pattern.
- Job execution: Jobs should be idempotent and safe to re-run. Use cursor-based state to avoid reprocessing.

## Component 8: Claude Opus 4.6 Integration

### Requirement

All task accomplishment — extracting tasks from messages, generating replies, making approval decisions, producing voice briefs — must use Claude Code Opus 4.6 (model ID: `claude-opus-4-6`), not rule-based heuristics alone.

### Current State

`extraction.ts` uses regex/keyword matching (e.g., "Action:" prefix, keyword-based priority). This is insufficient for real-world messages from iMessage/Slack where intent is conversational.

### Design

Replace rule-based extraction with Opus 4.6-powered extraction in a hybrid approach:

1. **Task extraction**: When a message arrives from any channel, pass it to Opus 4.6 with a structured prompt to extract: title, description, priority, due date, dependencies, confidence score.
2. **Reply generation**: Use Opus 4.6 to draft contextual replies (not template strings).
3. **Confirmation parsing**: Use Opus 4.6 to understand natural-language replies (not just "yes"/"no" — handle "sure, but change the due date to Friday").
4. **Voice brief generation**: Use Opus 4.6 to produce natural-sounding review scripts.

### Implementation

The automation-hub jobs run within Claude Code sessions (Opus 4.6 is the runtime model). The job orchestrator delegates to Claude's reasoning by:
- Using the Claude Agent SDK or headless Claude Code for automated runs
- Using the current Claude Code session for interactive runs
- Keeping rule-based extraction as a fallback for offline/batch processing

### Provider Config

Jobs already support multi-provider config in YAML:
```yaml
providers:
  claude:
    runtime: "headless_or_agent_sdk"
    model: "claude-opus-4-6"
    tool_transport: ["mcp"]
```

## Open Items

- PM adapter: Until a real PM tool is connected, Apple Reminders can serve as lightweight PM (create reminder = create task).
- Superwhisper: Deferred to future — not included in this build.
- Scheduler: Job schedules are defined in YAML but not wired to a runtime scheduler yet. This design focuses on CLI-triggered execution.
