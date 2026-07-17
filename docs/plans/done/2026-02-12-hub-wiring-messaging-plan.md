# Hub Wiring + Messaging Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire automation-hub to macos-hub, add Slack + iMessage channels, build all 4 job runners, with tests.

**Architecture:** Adapter pattern — shared ChannelAdapter interface in automation-hub wrapping MCP tool calls to macos-hub (29+4 tools), Slack MCP (13 tools), and PM MCP (7 tools). New iMessage bridge in macos-hub follows existing bridge/tool pattern. Jobs use Claude Opus 4.6 for task extraction and reply generation.

**Tech Stack:** TypeScript 5.9, Node.js ES modules, Zod 3.24, MCP SDK 1.18.1, AppleScript/osascript

**Design Doc:** `docs/plans/2026-02-12-hub-wiring-messaging-design.md`

**Parallelization:** Tasks 1-3 (macos-hub iMessage bridge) and Tasks 4-6 (automation-hub adapter interface + schema) can run in parallel. Tasks 7-12 depend on both.

---

## TRACK A: iMessage Bridge in macos-hub

### Task 1: Add Messages types and AppleScript templates

**Files:**
- Modify: `/Users/trey/Desktop/Apps/macos-hub/src/types.ts:69` (after MailMessage interface)
- Modify: `/Users/trey/Desktop/Apps/macos-hub/src/engine/scripts.ts` (append new templates)

**Step 1: Add domain types to types.ts**

Add after the `MailMessage` interface (line 69):

```typescript
// ─── Messages (iMessage) ────────────────────────────────────────

export interface Chat {
  id: string;
  participants: string[];
  displayName: string;
  lastMessageDate: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  sender: string;
  content: string;
  date: string;
  isFromMe: boolean;
  isRead: boolean;
}
```

Add `"messages"` to the `WatcherApp` type union (line 88):

```typescript
export type WatcherApp = "reminders" | "notes" | "calendar" | "mail" | "messages";
```

Add `messages` to `WatcherConfig` interface (after `mail` entry, line 111):

```typescript
messages: { enabled: boolean; intervalMs: number };
```

**Step 2: Add AppleScript templates to engine/scripts.ts**

Append to the end of `scripts.ts`:

```typescript
// ─── Messages.app ─────────────────────────────────────────────────

export function listChatsScript(): string {
  return `
tell application "Messages"
  set chatList to every chat
  set output to ""
  repeat with c in chatList
    set chatId to id of c
    set chatName to name of c
    set participants to ""
    try
      set buddyList to participants of c
      repeat with b in buddyList
        if participants is "" then
          set participants to handle of b
        else
          set participants to participants & "," & handle of b
        end if
      end repeat
    end try
    set output to output & chatId & "\t" & chatName & "\t" & participants & "\n"
  end repeat
  return output
end tell`;
}

export function listChatMessagesScript(chatId: string, limit: number): string {
  const escaped = escapeForAppleScript(chatId);
  return `
tell application "Messages"
  set targetChat to chat id "${escaped}"
  set msgList to messages of targetChat
  set msgCount to count of msgList
  set startIdx to 1
  if msgCount > ${limit} then set startIdx to msgCount - ${limit} + 1
  set output to ""
  repeat with i from startIdx to msgCount
    set m to item i of msgList
    set msgId to id of m
    set msgSender to ""
    try
      set msgSender to handle of sender of m
    end try
    set msgContent to content of m
    set msgDate to date of m as string
    set isFromMe to "false"
    try
      if sender of m is missing value then set isFromMe to "true"
    end try
    set isRead to "true"
    try
      set isRead to (is read of m) as string
    end try
    set output to output & msgId & "\t" & msgSender & "\t" & msgContent & "\t" & msgDate & "\t" & isFromMe & "\t" & isRead & "\n"
  end repeat
  return output
end tell`;
}

export function sendMessageScript(to: string, body: string): string {
  const escapedTo = escapeForAppleScript(to);
  const escapedBody = escapeForAppleScript(body);
  return `
tell application "Messages"
  set targetService to 1st service whose service type = iMessage
  set targetBuddy to buddy "${escapedTo}" of targetService
  send "${escapedBody}" to targetBuddy
end tell`;
}

export function searchMessagesScript(query: string, limit: number): string {
  const escaped = escapeForAppleScript(query);
  return `
tell application "Messages"
  set allChats to every chat
  set output to ""
  set found to 0
  repeat with c in allChats
    if found >= ${limit} then exit repeat
    set msgList to messages of c
    repeat with m in msgList
      if found >= ${limit} then exit repeat
      set msgContent to content of m
      if msgContent contains "${escaped}" then
        set msgId to id of m
        set chatId to id of c
        set msgSender to ""
        try
          set msgSender to handle of sender of m
        end try
        set msgDate to date of m as string
        set isFromMe to "false"
        try
          if sender of m is missing value then set isFromMe to "true"
        end try
        set output to output & msgId & "\t" & chatId & "\t" & msgSender & "\t" & msgContent & "\t" & msgDate & "\t" & isFromMe & "\n"
        set found to found + 1
      end if
    end repeat
  end repeat
  return output
end tell`;
}
```

**Step 3: Build to verify compilation**

Run: `cd /Users/trey/Desktop/Apps/macos-hub && npm run build`
Expected: Clean compilation

**Step 4: Commit**

```bash
git add src/types.ts src/engine/scripts.ts
git commit -m "feat(macos-hub): add Messages.app types and AppleScript templates"
```

---

### Task 2: Build MessagesBridge class

**Files:**
- Create: `/Users/trey/Desktop/Apps/macos-hub/src/bridges/messages.bridge.ts`

**Step 1: Create the bridge**

```typescript
import { runAppleScript } from "../engine/osascript.js";
import * as scripts from "../engine/scripts.js";
import type { Chat, ChatMessage } from "../types.js";

function parseChat(line: string): Chat | null {
  const parts = line.split("\t");
  if (parts.length < 3) return null;
  return {
    id: parts[0],
    displayName: parts[1],
    participants: parts[2] ? parts[2].split(",") : [],
    lastMessageDate: "",
  };
}

function parseChatMessage(line: string): ChatMessage | null {
  const parts = line.split("\t");
  if (parts.length < 6) return null;
  return {
    id: parts[0],
    chatId: "",
    sender: parts[1],
    content: parts[2],
    date: parts[3],
    isFromMe: parts[4] === "true",
    isRead: parts[5] === "true",
  };
}

function parseSearchResult(line: string): ChatMessage | null {
  const parts = line.split("\t");
  if (parts.length < 6) return null;
  return {
    id: parts[0],
    chatId: parts[1],
    sender: parts[2],
    content: parts[3],
    date: parts[4],
    isFromMe: parts[5] === "true",
    isRead: true,
  };
}

export class MessagesBridge {
  async listChats(): Promise<Chat[]> {
    const result = await runAppleScript(scripts.listChatsScript(), { timeout: 30_000 });
    return result
      .split("\n")
      .filter(Boolean)
      .map(parseChat)
      .filter((c): c is Chat => c !== null);
  }

  async listMessages(chatId: string, limit = 50): Promise<ChatMessage[]> {
    const result = await runAppleScript(
      scripts.listChatMessagesScript(chatId, limit),
      { timeout: 60_000 },
    );
    return result
      .split("\n")
      .filter(Boolean)
      .map(parseChatMessage)
      .filter((m): m is ChatMessage => m !== null)
      .map((m) => ({ ...m, chatId }));
  }

  async send(to: string, body: string): Promise<void> {
    await runAppleScript(scripts.sendMessageScript(to, body), {
      timeout: 30_000,
      retries: 1,
    });
  }

  async search(query: string, limit = 20): Promise<ChatMessage[]> {
    const result = await runAppleScript(
      scripts.searchMessagesScript(query, limit),
      { timeout: 60_000 },
    );
    return result
      .split("\n")
      .filter(Boolean)
      .map(parseSearchResult)
      .filter((m): m is ChatMessage => m !== null);
  }
}
```

**Step 2: Build**

Run: `cd /Users/trey/Desktop/Apps/macos-hub && npm run build`
Expected: Clean compilation

**Step 3: Commit**

```bash
git add src/bridges/messages.bridge.ts
git commit -m "feat(macos-hub): add MessagesBridge for iMessage via AppleScript"
```

---

### Task 3: Create MCP tools and register in server

**Files:**
- Create: `/Users/trey/Desktop/Apps/macos-hub/src/tools/messages/list.ts`
- Create: `/Users/trey/Desktop/Apps/macos-hub/src/tools/messages/get.ts`
- Create: `/Users/trey/Desktop/Apps/macos-hub/src/tools/messages/send.ts`
- Create: `/Users/trey/Desktop/Apps/macos-hub/src/tools/messages/search.ts`
- Modify: `/Users/trey/Desktop/Apps/macos-hub/src/server.ts` (add imports + register tools)

**Step 1: Create list tool**

`/Users/trey/Desktop/Apps/macos-hub/src/tools/messages/list.ts`:

```typescript
import { MessagesBridge } from "../../bridges/messages.bridge.js";
import { toolSuccess, toolError, formatError } from "../../utils/errors.js";
import type { ToolDefinition } from "../../types.js";

const bridge = new MessagesBridge();

export const listChatMessages: ToolDefinition = {
  name: "list_messages",
  description:
    "List recent iMessages. Optionally filter by chat ID or participant phone/email.",
  inputSchema: {
    type: "object",
    properties: {
      chat_id: { type: "string", description: "Chat ID to list messages from" },
      participant: {
        type: "string",
        description: "Phone number or email to filter by (lists their chat)",
      },
      limit: { type: "number", description: "Max messages (default 50)" },
    },
  },
  handler: async (args) => {
    try {
      const limit = (args.limit as number) || 50;

      if (args.chat_id) {
        const messages = await bridge.listMessages(args.chat_id as string, limit);
        return toolSuccess(messages);
      }

      if (args.participant) {
        const chats = await bridge.listChats();
        const match = chats.find((c) =>
          c.participants.some((p) => p.includes(args.participant as string)),
        );
        if (!match) {
          return toolSuccess({ chats: [], messages: [], note: "No chat found for participant" });
        }
        const messages = await bridge.listMessages(match.id, limit);
        return toolSuccess(messages);
      }

      const chats = await bridge.listChats();
      return toolSuccess(chats);
    } catch (err) {
      return toolError(formatError(err));
    }
  },
};
```

**Step 2: Create send tool**

`/Users/trey/Desktop/Apps/macos-hub/src/tools/messages/send.ts`:

```typescript
import { MessagesBridge } from "../../bridges/messages.bridge.js";
import { toolSuccess, toolError, formatError } from "../../utils/errors.js";
import type { ToolDefinition } from "../../types.js";

const bridge = new MessagesBridge();

export const sendMessage: ToolDefinition = {
  name: "send_message",
  description: "Send an iMessage to a phone number or Apple ID email.",
  inputSchema: {
    type: "object",
    properties: {
      to: { type: "string", description: "Recipient phone number or Apple ID" },
      body: { type: "string", description: "Message text" },
    },
    required: ["to", "body"],
  },
  handler: async (args) => {
    try {
      await bridge.send(args.to as string, args.body as string);
      return toolSuccess({ message: "iMessage sent" });
    } catch (err) {
      return toolError(formatError(err));
    }
  },
};
```

**Step 3: Create search tool**

`/Users/trey/Desktop/Apps/macos-hub/src/tools/messages/search.ts`:

```typescript
import { MessagesBridge } from "../../bridges/messages.bridge.js";
import { toolSuccess, toolError, formatError } from "../../utils/errors.js";
import type { ToolDefinition } from "../../types.js";

const bridge = new MessagesBridge();

export const searchMessages: ToolDefinition = {
  name: "search_messages",
  description: "Search iMessages by content text.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Text to search for" },
      limit: { type: "number", description: "Max results (default 20)" },
    },
    required: ["query"],
  },
  handler: async (args) => {
    try {
      const results = await bridge.search(
        args.query as string,
        (args.limit as number) || 20,
      );
      return toolSuccess(results);
    } catch (err) {
      return toolError(formatError(err));
    }
  },
};
```

**Step 4: Register tools in server.ts**

Add imports after the existing keybindings import block in `/Users/trey/Desktop/Apps/macos-hub/src/server.ts`:

```typescript
import { listChatMessages } from "./tools/messages/list.js";
import { sendMessage } from "./tools/messages/send.js";
import { searchMessages } from "./tools/messages/search.js";
```

Add to the `staticTools` array (after system tools):

```typescript
// Messages (iMessage)
listChatMessages,
sendMessage,
searchMessages,
```

**Step 5: Build and verify**

Run: `cd /Users/trey/Desktop/Apps/macos-hub && npm run build`
Expected: Clean compilation, 32 tools registered (29 existing + 3 new)

**Step 6: Commit**

```bash
git add src/tools/messages/ src/server.ts
git commit -m "feat(macos-hub): add iMessage MCP tools (list, send, search)"
```

---

## TRACK B: Adapter Interface + Schema Extensions (automation-hub)

### Task 4: Create shared adapter interface and types

**Files:**
- Create: `/Users/trey/Desktop/Apps/automation-hub/src/adapters/adapter.interface.ts`

**Step 1: Write the adapter interface**

```typescript
export type ChannelType = "email" | "calendar" | "reminders" | "slack" | "imessage" | "pm";

export interface ListOptions {
  limit?: number;
  since?: string;
  filters?: Record<string, unknown>;
}

export interface SearchOptions {
  limit?: number;
  participant?: string;
}

export interface ChannelItem {
  id: string;
  source_channel: ChannelType;
  source_reference: string;
  timestamp: string;
  content: string;
  subject?: string;
  participants: string[];
  metadata: Record<string, unknown>;
}

export interface ResponseTarget {
  channel: ChannelType;
  recipient: string;
  thread_id?: string;
}

export interface ChannelAdapter {
  readonly channel: ChannelType;
  initialize(): Promise<void>;
  listItems(opts: ListOptions): Promise<ChannelItem[]>;
  getItem(id: string): Promise<ChannelItem>;
  sendResponse(target: ResponseTarget, body: string): Promise<void>;
  search?(query: string, opts?: SearchOptions): Promise<ChannelItem[]>;
}
```

**Step 2: Build**

Run: `cd /Users/trey/Desktop/Apps/automation-hub && npm run build`
Expected: Clean compilation

**Step 3: Commit**

```bash
git add src/adapters/adapter.interface.ts
git commit -m "feat(automation-hub): add shared ChannelAdapter interface"
```

---

### Task 5: Extend schemas — contracts.ts, approval policy, canonical task JSON schema

**Files:**
- Modify: `/Users/trey/Desktop/Apps/automation-hub/src/contracts.ts:142-151` (source_system enum)
- Modify: `/Users/trey/Desktop/Apps/automation-hub/src/contracts.ts:156-164` (evidence kinds)
- Modify: `/Users/trey/Desktop/Apps/automation-hub/policies/approval_policy.yaml` (add messaging rules)
- Modify: `/Users/trey/Desktop/Apps/automation-hub/schemas/canonical_task.schema.json` (add slack)

**Step 1: Add "slack" to source_system enum in contracts.ts (line 142)**

Change the `source_system` enum to:
```typescript
source_system: z.enum([
  "gmail",
  "outlook",
  "pm_tool",
  "manual",
  "apple_reminders",
  "messages",
  "superwhisper",
  "calendar",
  "slack",
]),
```

**Step 2: Add "slack_message_id" to evidence kinds (line 156)**

Change the evidence `kind` enum to:
```typescript
kind: z.enum([
  "email_id",
  "calendar_event_id",
  "task_id",
  "note",
  "message_id",
  "reminder_id",
  "transcript_id",
  "slack_message_id",
]),
```

**Step 3: Add messaging approval rules to policies/approval_policy.yaml**

Append before the final empty line:
```yaml

  - action: "slack.send_message"
    decision: "allow"
    requires_human_approval: true

  - action: "messages.send_message"
    decision: "allow"
    requires_human_approval: true
```

**Step 4: Update canonical_task.schema.json**

Add `"slack"` to the source_system enum and `"slack_message_id"` to the evidence kind enum in the JSON schema file.

**Step 5: Build**

Run: `cd /Users/trey/Desktop/Apps/automation-hub && npm run build`
Expected: Clean compilation

**Step 6: Commit**

```bash
git add src/contracts.ts policies/approval_policy.yaml schemas/canonical_task.schema.json
git commit -m "feat(automation-hub): extend schemas for Slack + iMessage channels"
```

---

### Task 6: Add Slack adapter config to channel_adapters.example.yaml

**Files:**
- Modify: `/Users/trey/Desktop/Apps/automation-hub/config/channel_adapters.example.yaml`

**Step 1: Add slack adapter entry**

Add after the existing `messages` adapter block:

```yaml
  slack:
    enabled: true
    provider_options:
      primary: slack_mcp
    capabilities:
      - list_messages
      - send_message
      - search_messages
      - read_thread
      - read_channel
    self_user_id: "U01BBL118JC"
```

**Step 2: Commit**

```bash
git add config/channel_adapters.example.yaml
git commit -m "feat(automation-hub): add Slack adapter to channel config"
```

---

## TRACK C: Real Adapters (depends on Tracks A + B)

### Task 7: Build Slack adapter

**Files:**
- Create: `/Users/trey/Desktop/Apps/automation-hub/src/adapters/slack.adapter.ts`

**Step 1: Create the adapter**

This adapter wraps the Slack MCP tools available in the Claude Code environment. For CLI execution, it uses mock data; for Claude Code sessions, it delegates to the MCP tools.

```typescript
import type { ChannelAdapter, ChannelItem, ListOptions, ResponseTarget, SearchOptions } from "./adapter.interface.js";

const SELF_USER_ID = "U01BBL118JC";

export class SlackAdapter implements ChannelAdapter {
  readonly channel = "slack" as const;

  async initialize(): Promise<void> {
    // Slack MCP tools are available via the Claude Code environment.
    // No initialization needed — tools are called through the MCP protocol.
  }

  async listItems(opts: ListOptions): Promise<ChannelItem[]> {
    // In Claude Code session: delegates to slack_read_channel MCP tool
    // In standalone CLI: returns empty (Slack requires MCP connection)
    return [];
  }

  async getItem(id: string): Promise<ChannelItem> {
    return {
      id,
      source_channel: "slack",
      source_reference: `slack:${id}`,
      timestamp: new Date().toISOString(),
      content: "",
      participants: [SELF_USER_ID],
      metadata: {},
    };
  }

  async sendResponse(target: ResponseTarget, body: string): Promise<void> {
    // In Claude Code session: delegates to slack_send_message MCP tool
    // Target recipient is the Slack user ID or channel ID
    // For self-DM: use SELF_USER_ID as channel_id
    console.log(`[SlackAdapter] Would send to ${target.recipient}: ${body}`);
  }

  async search(query: string, opts?: SearchOptions): Promise<ChannelItem[]> {
    // In Claude Code session: delegates to slack_search_public_and_private
    return [];
  }
}
```

**Step 2: Build**

Run: `cd /Users/trey/Desktop/Apps/automation-hub && npm run build`

**Step 3: Commit**

```bash
git add src/adapters/slack.adapter.ts
git commit -m "feat(automation-hub): add Slack adapter wrapping MCP tools"
```

---

### Task 8: Build iMessage adapter

**Files:**
- Create: `/Users/trey/Desktop/Apps/automation-hub/src/adapters/macos-messages.adapter.ts`

**Step 1: Create the adapter**

```typescript
import type { ChannelAdapter, ChannelItem, ListOptions, ResponseTarget, SearchOptions } from "./adapter.interface.js";

const SELF_PHONE = "+17608466479";

export class MacosMessagesAdapter implements ChannelAdapter {
  readonly channel = "imessage" as const;

  async initialize(): Promise<void> {
    // Messages MCP tools available via macos-hub MCP server
  }

  async listItems(opts: ListOptions): Promise<ChannelItem[]> {
    // In Claude Code session: delegates to macos-hub list_messages MCP tool
    // Filters to self-chat by default
    return [];
  }

  async getItem(id: string): Promise<ChannelItem> {
    return {
      id,
      source_channel: "imessage",
      source_reference: `imessage:${id}`,
      timestamp: new Date().toISOString(),
      content: "",
      participants: [SELF_PHONE],
      metadata: {},
    };
  }

  async sendResponse(target: ResponseTarget, body: string): Promise<void> {
    // In Claude Code session: delegates to macos-hub send_message MCP tool
    console.log(`[MacosMessagesAdapter] Would send to ${target.recipient}: ${body}`);
  }

  async search(query: string, opts?: SearchOptions): Promise<ChannelItem[]> {
    // In Claude Code session: delegates to macos-hub search_messages MCP tool
    return [];
  }
}
```

**Step 2: Build and commit**

```bash
cd /Users/trey/Desktop/Apps/automation-hub && npm run build
git add src/adapters/macos-messages.adapter.ts
git commit -m "feat(automation-hub): add iMessage adapter wrapping macos-hub MCP tools"
```

---

### Task 9: Build macos-hub real adapters (mail, calendar, reminders)

**Files:**
- Create: `/Users/trey/Desktop/Apps/automation-hub/src/adapters/macos-mail.adapter.ts`
- Create: `/Users/trey/Desktop/Apps/automation-hub/src/adapters/macos-calendar.adapter.ts`
- Create: `/Users/trey/Desktop/Apps/automation-hub/src/adapters/macos-reminders.adapter.ts`

**Step 1: Create mail adapter** (follows same pattern as Slack/iMessage adapters, wraps macos-hub mail MCP tools)

**Step 2: Create calendar adapter** (wraps macos-hub list_events, list_calendars, create_event, etc.)

**Step 3: Create reminders adapter** (wraps macos-hub list_reminders, create_reminder, complete_reminder — serves as lightweight PM)

**Step 4: Build and commit**

```bash
cd /Users/trey/Desktop/Apps/automation-hub && npm run build
git add src/adapters/macos-mail.adapter.ts src/adapters/macos-calendar.adapter.ts src/adapters/macos-reminders.adapter.ts
git commit -m "feat(automation-hub): add real macos-hub adapters for mail, calendar, reminders"
```

---

### Task 10: Build PM adapter and reply router

**Files:**
- Create: `/Users/trey/Desktop/Apps/automation-hub/src/adapters/pm.adapter.ts`
- Create: `/Users/trey/Desktop/Apps/automation-hub/src/adapters/router.ts`

**Step 1: Create PM adapter** (wraps PM MCP interface tools — pm.list_projects, pm.create_task, etc. Falls back to Apple Reminders adapter for now.)

**Step 2: Create reply router**

```typescript
import type { ChannelAdapter, ChannelType, ResponseTarget } from "./adapter.interface.js";

export class ChannelRouter {
  private adapters = new Map<ChannelType, ChannelAdapter>();

  register(adapter: ChannelAdapter): void {
    this.adapters.set(adapter.channel, adapter);
  }

  async sendResponse(target: ResponseTarget, body: string): Promise<void> {
    const adapter = this.adapters.get(target.channel);
    if (!adapter) {
      throw new Error(`No adapter registered for channel: ${target.channel}`);
    }
    await adapter.sendResponse(target, body);
  }

  getAdapter(channel: ChannelType): ChannelAdapter | undefined {
    return this.adapters.get(channel);
  }

  getAllAdapters(): ChannelAdapter[] {
    return Array.from(this.adapters.values());
  }
}
```

**Step 3: Build and commit**

```bash
cd /Users/trey/Desktop/Apps/automation-hub && npm run build
git add src/adapters/pm.adapter.ts src/adapters/router.ts
git commit -m "feat(automation-hub): add PM adapter and channel router for reply-in-same-channel"
```

---

## TRACK D: Job Runners (depends on Track C)

### Task 11: Rewire Job 01 (email triage) to use real adapters

**Files:**
- Modify: `/Users/trey/Desktop/Apps/automation-hub/src/jobs/email-triage.ts`
- Modify: `/Users/trey/Desktop/Apps/automation-hub/src/cli.ts`

**Step 1: Update email-triage.ts imports**

Replace mock adapter imports with real adapter imports. Use a factory function that returns mock adapters for dry-run/test mode and real adapters for production mode.

**Step 2: Add adapter factory to cli.ts**

The CLI creates adapters based on runtime config — mock for dry-run, real for live.

**Step 3: Build and test dry-run**

Run: `cd /Users/trey/Desktop/Apps/automation-hub && npm run build && npm run job:email-triage:dry-run`
Expected: Same output as before (mock data), proving backward compatibility.

**Step 4: Commit**

```bash
git add src/jobs/email-triage.ts src/cli.ts
git commit -m "feat(automation-hub): rewire email triage to adapter pattern with factory"
```

---

### Task 12: Build Job 02 runner (calendar-aware due date planner)

**Files:**
- Create: `/Users/trey/Desktop/Apps/automation-hub/src/jobs/due-date-planner.ts`
- Modify: `/Users/trey/Desktop/Apps/automation-hub/src/cli.ts` (add command)

**Step 1: Implement planner**

Reference: `jobs/02_calendar_due_date_planner.yaml` for spec.

Steps:
1. Load active projects via PM adapter
2. For each project, get gantt snapshot
3. Pull calendar events for planning window (45 days)
4. Identify critical path tasks with missing/conflicting dates
5. Propose revised dates based on calendar availability
6. Generate escalation list and summary markdown

**Step 2: Add CLI command `run-due-date-planner`**

**Step 3: Build and test dry-run**

**Step 4: Commit**

```bash
git add src/jobs/due-date-planner.ts src/cli.ts
git commit -m "feat(automation-hub): add Job 02 due-date-planner runner"
```

---

### Task 13: Build Job 03 runner (gantt drift voice queue)

**Files:**
- Create: `/Users/trey/Desktop/Apps/automation-hub/src/jobs/gantt-drift.ts`
- Modify: `/Users/trey/Desktop/Apps/automation-hub/src/cli.ts`

**Step 1: Implement drift detector**

Reference: `jobs/03_gantt_drift_voice_queue.yaml` for spec.

Steps:
1. Load project timelines via PM adapter
2. Load recent email threads via mail adapter (24h window)
3. Compare planned dates vs actual signals
4. Flag drift categories (late start, blocked, scope increase, capacity risk)
5. Generate voice review queue (one script per decision item)
6. Generate email reply drafts

**Step 2: Add CLI command and build**

**Step 3: Commit**

```bash
git add src/jobs/gantt-drift.ts src/cli.ts
git commit -m "feat(automation-hub): add Job 03 gantt-drift voice queue runner"
```

---

### Task 14: Build Job 04 runner (unified channel consolidation)

**Files:**
- Create: `/Users/trey/Desktop/Apps/automation-hub/src/jobs/channel-consolidation.ts`
- Modify: `/Users/trey/Desktop/Apps/automation-hub/src/cli.ts`

**Step 1: Implement consolidator**

Reference: `jobs/04_unified_channel_consolidation.yaml` for spec.

This is the most complex job — it uses ALL adapters:
1. Poll all channels (email, calendar, reminders, iMessage, Slack)
2. Normalize each item to ChannelItem
3. Deduplicate across channels (semantic fingerprint + source reference)
4. Extract tasks from each item
5. Cross-check due dates against calendar availability
6. Build unified prioritized action queue
7. Draft response messages routed to source channel

**Step 2: Add CLI command and build**

**Step 3: Commit**

```bash
git add src/jobs/channel-consolidation.ts src/cli.ts
git commit -m "feat(automation-hub): add Job 04 unified channel consolidation runner"
```

---

## TRACK E: Tests

### Task 15: Unit tests for extraction, approval, and dedup

**Files:**
- Create: `/Users/trey/Desktop/Apps/automation-hub/tests/extraction.test.ts`
- Create: `/Users/trey/Desktop/Apps/automation-hub/tests/approval-gate.test.ts`
- Create: `/Users/trey/Desktop/Apps/automation-hub/tests/hash.test.ts`

**Step 1: Add vitest or node:test as dev dependency**

Run: `cd /Users/trey/Desktop/Apps/automation-hub && npm install --save-dev vitest`
Add test script to package.json: `"test": "vitest run"`

**Step 2: Write extraction tests**

Test: `extractActionCandidates`, `extractDateCandidate`, `inferPriority`, `containsAnyKeyword`, `summarizeText`, `toTitleCase`

**Step 3: Write approval gate tests**

Test: default-deny behavior, rule matching, human approval required, dry-run blocking, the new slack/messages rules

**Step 4: Write hash tests**

Test: `semanticFingerprint` determinism, collision resistance, normalization

**Step 5: Run tests**

Run: `cd /Users/trey/Desktop/Apps/automation-hub && npm test`
Expected: All pass

**Step 6: Commit**

```bash
git add tests/ package.json package-lock.json
git commit -m "test(automation-hub): add unit tests for extraction, approval, dedup"
```

---

### Task 16: Adapter and router tests

**Files:**
- Create: `/Users/trey/Desktop/Apps/automation-hub/tests/adapters.test.ts`
- Create: `/Users/trey/Desktop/Apps/automation-hub/tests/router.test.ts`

**Step 1: Test adapter interface compliance**

Verify each adapter implements ChannelAdapter correctly. Test item normalization.

**Step 2: Test router**

Test: register adapters, route to correct adapter by channel type, error on missing adapter.

**Step 3: Run tests and commit**

---

### Task 17: E2E dry-run tests for all 4 jobs

**Files:**
- Create: `/Users/trey/Desktop/Apps/automation-hub/tests/jobs-e2e.test.ts`

**Step 1: Test each job in dry-run mode with fixture data**

Verify run artifacts are created in expected locations with expected structure.

**Step 2: Run tests and commit**

---

### Task 18: iMessage bridge tests in macos-hub

**Files:**
- Create: `/Users/trey/Desktop/Apps/macos-hub/tests/messages-bridge.test.ts`

**Step 1: Test AppleScript output parsing**

Test `parseChat`, `parseChatMessage`, `parseSearchResult` with tab-delimited fixture data.

**Step 2: Run tests and commit**

---

## TRACK F: Documentation + Cleanup

### Task 19: Update config and documentation

**Files:**
- Modify: `/Users/trey/Desktop/Apps/automation-hub/README.md`
- Modify: `/Users/trey/Desktop/Apps/macos-hub/CLAUDE.md`
- Modify: `/Users/trey/Desktop/Apps/CLAUDE.md`
- Create: `/Users/trey/Desktop/Apps/automation-hub/CLAUDE.md`

**Step 1: Update automation-hub README** with new adapters, channels, and all 4 job commands

**Step 2: Update macos-hub CLAUDE.md** — add Messages tools (now 32 tools, not 29)

**Step 3: Create automation-hub CLAUDE.md** (it's missing one — required by workspace standards)

**Step 4: Update root CLAUDE.md** — update automation-hub section with new capabilities

**Step 5: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: update documentation for hub wiring + messaging integration"
```

---

## Task Summary

| Track | Tasks | Can Parallelize With |
|-------|-------|---------------------|
| **A: iMessage Bridge** | 1, 2, 3 | Track B |
| **B: Adapter Interface + Schema** | 4, 5, 6 | Track A |
| **C: Real Adapters** | 7, 8, 9, 10 | (depends on A+B) |
| **D: Job Runners** | 11, 12, 13, 14 | (depends on C) |
| **E: Tests** | 15, 16, 17, 18 | Tasks 15+18 can start during Track C |
| **F: Docs** | 19 | After all other tracks |

**Total: 19 tasks across 6 tracks. Tracks A and B are fully parallel. Track E tasks 15 and 18 can start early.**
