Perfect! Now I have enough information. Let me compile a comprehensive feature requirements document:

---

# macOS Hub — Feature Requirements Document

## Executive Summary

**macOS Hub** is a Model Context Protocol (MCP) server that provides Claude Code with programmatic access to native macOS applications through AppleScript. It enables Claude to read, create, update, and delete items in Reminders, Notes, Calendar, and Mail, plus send notifications and interact with the clipboard. The server also provides a polling-based change detection system and stackable keybinding functionality for executing sequences of operations.

---

## 1. App Overview

### Purpose
macOS Hub bridges the gap between Claude Code and native macOS apps, enabling Claude to interact with users' personal information management systems (notes, reminders, calendar, email) directly through natural language commands processed via MCP tools.

### Target Users
- Claude Code users on macOS who want to automate interactions with Apple apps
- Knowledge workers who need integration between AI assistance and personal productivity tools
- Users seeking to build custom workflows combining multiple Apple apps

### Key Differentiators
- **AppleScript-native**: Uses system APIs directly rather than clipboard hacks or file-based syncing
- **Change detection**: Automatic polling detects modifications to tracked items and surfaces them as MCP resources
- **Stackable keybindings**: Define custom multi-tool workflows with template variable substitution
- **Type-safe**: Full TypeScript support with Zod validation for configuration

---

## 2. Tech Stack

### Runtime & Language
- **Node.js**: ES modules (v20+ recommended)
- **TypeScript**: 5.9, compiled to JavaScript
- **MCP SDK**: @modelcontextprotocol/sdk 1.18.1 (stdio transport)

### Dependencies
| Dependency | Version | Purpose |
|---|---|---|
| @modelcontextprotocol/sdk | ^1.18.1 | MCP server protocol implementation |
| zod | ^3.24.0 | Schema validation for configuration |

### Dev Dependencies
| Dependency | Version | Purpose |
|---|---|---|
| @types/node | ^24.0.0 | Node.js type definitions |
| tsx | ^4.20.0 | TypeScript executor (dev/test mode) |
| typescript | ^5.9.0 | TypeScript compiler |

### Build Tools
- **Build**: `tsc` (TypeScript compiler)
- **Dev**: `tsx` (run TypeScript directly)
- **Execution**: Node.js (compiled JavaScript)

### External Systems
- **macOS AppleScript**: System execution via `execFile(/usr/bin/osascript)`
- **Native Apps**: Reminders, Notes, Calendar, Mail (queried via AppleScript)

---

## 3. Architecture

### Directory Structure
```
src/
├── index.ts              # Entry point: main(), graceful shutdown
├── server.ts             # Server initialization, tool/resource handlers
├── types.ts              # All TypeScript interfaces (Reminder, Note, CalendarEvent, etc.)
├── engine/
│   ├── osascript.ts      # AppleScript execution wrapper (execFile, retries, escape)
│   └── scripts.ts        # AppleScript templates for all operations
├── bridges/
│   ├── reminders.bridge.ts   # RemindersBridge class
│   ├── notes.bridge.ts       # NotesBridge class
│   ├── calendar.bridge.ts    # CalendarBridge class
│   ├── mail.bridge.ts        # MailBridge class (checks if running)
│   └── system.bridge.ts      # SystemBridge (notifications, clipboard)
├── tools/
│   ├── reminders/        # 6 tools (list, get, create, complete, update, delete)
│   ├── notes/            # 6 tools (list, listFolders, get, create, update, search)
│   ├── calendar/         # 6 tools (listCalendars, listEvents, get, create, update, delete)
│   ├── mail/             # 5 tools (listMailboxes, listMessages, get, send, search)
│   ├── system/           # 3 tools (sendNotification, getClipboard, setClipboard)
│   ├── watcher/          # 1 tool (getRecentChanges)
│   └── keybindings/      # 2 tools (list, execute)
├── watcher/
│   ├── watcher.ts        # WatcherManager: interval-based polling
│   ├── poll.ts           # pollApp(): fetch latest state for each app
│   ├── differ.ts         # diffSnapshots(): detect created/updated/deleted/completed
│   └── (snapshot store)  # Stored in state/snapshot.ts
├── keybindings/
│   ├── manager.ts        # KeybindingsManager: load, get bindings
│   ├── executor.ts       # executeKeybinding(): resolve templates, run tools sequentially
│   └── schema.ts         # Zod schema for keybindings.json
├── state/
│   ├── store.ts          # StateStore: in-memory change log (max 500)
│   └── snapshot.ts       # SnapshotStore: per-app snapshots, hash computation
└── utils/
    ├── logger.ts         # stderr logging
    └── errors.ts         # Error classes, toolError/toolSuccess helpers
```

### Architecture Patterns

#### 1. **Layered Architecture**
```
MCP Tools (29 total)
    ↓
Bridges (5: Reminders, Notes, Calendar, Mail, System)
    ↓
AppleScript Engine (osascript.ts)
    ↓
macOS (execFile → /usr/bin/osascript)
```

**Design Principle**: Bridges are the only layer touching AppleScript. Tools format input/output. Server wires everything together.

#### 2. **Tool Definition Pattern**
All tools export a `ToolDefinition` object:
```typescript
export const toolName: ToolDefinition = {
  name: "tool_name",
  description: "Human-readable description",
  inputSchema: { type: "object", properties: {...} },
  handler: async (args) => { ... }
}
```

#### 3. **Bridge Pattern**
Each app has one bridge class with methods for each operation:
```typescript
class RemindersBridge {
  async list(listName?, includeCompleted?): Promise<Reminder[]>
  async get(id): Promise<Reminder | null>
  async create(args): Promise<string>
  async update(id, updates): Promise<void>
  async delete(id): Promise<void>
  async complete(id): Promise<void>
}
```

#### 4. **State Management**
- **StateStore**: In-memory ring buffer (max 500 changes) with filtering by app/type/timestamp
- **SnapshotStore**: Per-app snapshots of items (id → hash → name) for diffing
- **WatcherManager**: Orchestrates polling via setInterval (with `.unref()` for clean shutdown)

#### 5. **Keybinding System**
- **KeybindingsManager**: Loads config, retrieves bindings by id/keys
- **KeybindingExecutor**: Resolves template variables, invokes tools sequentially
- **Template Variables**: `${input}`, `${today}`, `${today_end}`, `${timestamp}`, `${date}`, `${time}`

---

## 4. Features List

### 4.1 Reminders (6 tools)

| Tool | Purpose | Status |
|---|---|---|
| `list_reminders` | Fetch reminders (default: incomplete only) with pagination | Complete |
| `get_reminder` | Fetch single reminder by ID | Complete |
| `create_reminder` | Create new reminder with optional due date, priority, flags | Complete |
| `update_reminder` | Modify reminder properties (name, due date, priority, notes, flags) | Complete |
| `complete_reminder` | Mark reminder as complete | Complete |
| `delete_reminder` | Delete reminder | Complete |

**Features**:
- Filter by list name
- Include/exclude completed reminders
- Pagination (limit/offset)
- Priority levels (0=none, 1=high, 5=medium, 9=low)
- Flagging and custom notes

---

### 4.2 Notes (6 tools)

| Tool | Purpose | Status |
|---|---|---|
| `list_notes` | Fetch notes (optionally filtered by folder) | Complete |
| `list_folders` | Fetch folder hierarchy | Complete |
| `get_note` | Fetch single note with full body (HTML + plaintext) | Complete |
| `create_note` | Create new note in specified folder | Complete |
| `update_note` | Modify note content (title, body) | Complete |
| `search_notes` | Full-text search of notes | Complete |

**Features**:
- Folder organization with parent/child hierarchy
- HTML body + plaintext version
- Creation/modification date tracking
- Full-text search across title and content

---

### 4.3 Calendar (6 tools)

| Tool | Purpose | Status |
|---|---|---|
| `list_calendars` | Fetch all accessible calendars with metadata | Complete |
| `list_events` | Fetch events in date range (default: ±7 days from today) | Complete |
| `get_event` | Fetch single event by ID | Complete |
| `create_event` | Create new event with optional all-day flag | Complete |
| `update_event` | Modify event properties | Complete |
| `delete_event` | Delete event | Complete |

**Features**:
- Multiple calendars per account
- All-day vs timed events
- Location and notes
- Date range filtering (defaults to ±7 days)
- Readable date format (e.g., "January 15, 2025 at 2:00 PM")

---

### 4.4 Mail (5 tools)

| Tool | Purpose | Status |
|---|---|---|
| `list_mailboxes` | Fetch mailboxes per account with unread counts | Complete |
| `list_messages` | Fetch messages from mailbox (default: 20 messages) | Complete |
| `get_message` | Fetch single message with full content | Complete |
| `send_email` | Compose and send email via Mail.app | Complete |
| `search_mail` | Full-text search by subject and sender | Complete |

**Features**:
- Pre-flight check: ensures Mail.app is running before any operation
- Unread count tracking per mailbox
- Recipient list parsing (to/cc/bcc)
- Message metadata (subject, sender, date sent/received, read status)
- Search across mailboxes

**Limitations**:
- Requires Mail.app to be running (checked before each operation)
- Watcher disabled by default (config: `mail.enabled: false`)

---

### 4.5 System (3 tools)

| Tool | Purpose | Status |
|---|---|---|
| `send_notification` | Display native macOS notification | Complete |
| `get_clipboard` | Read clipboard contents | Complete |
| `set_clipboard` | Write text to clipboard | Complete |

**Features**:
- Notification with title, message, subtitle, sound
- Clipboard read/write (text only)
- No persistent storage required

---

### 4.6 Watcher (1 tool + 1 resource)

| Feature | Purpose | Status |
|---|---|---|
| **Tool**: `get_recent_changes` | Fetch detected changes (created/updated/deleted/completed) | Complete |
| **Resource**: `macos://changes/recent` | MCP resource with auto-updated change log | Complete |

**Features**:
- Polling-based change detection (configurable intervals)
- Change types: `created`, `updated`, `deleted`, `completed` (reminders only)
- Filters: by app, by type, by timestamp
- Limit/offset pagination
- Resource notification on change (if client supports)
- Per-app snapshot + diffing

**Configuration** (config/watchers.json):
```json
{
  "reminders": { "enabled": true, "intervalMs": 30000 },
  "notes":     { "enabled": true, "intervalMs": 60000 },
  "calendar":  { "enabled": true, "intervalMs": 60000 },
  "mail":      { "enabled": false, "intervalMs": 120000 }
}
```

---

### 4.7 Keybindings (2 tools + 1 resource)

| Feature | Purpose | Status |
|---|---|---|
| **Tool**: `list_keybindings` | Fetch all defined keybindings | Complete |
| **Tool**: `execute_keybinding` | Execute binding by ID with optional input | Complete |
| **Resource**: `macos://keybindings` | MCP resource with current config | Complete |

**Features**:
- Define sequences of tools with template variable substitution
- Template variables:
  - `${input}`: User-provided text passed to `execute_keybinding`
  - `${today}`: Today's date (e.g., "February 7, 2026")
  - `${today_end}`: Today at 11:59 PM
  - `${timestamp}`: ISO 8601 timestamp
  - `${date}`: Same as `${today}`
  - `${time}`: Current time string
- Keybindings have id, keys (description), label, and action list
- Actions resolve in sequence (can depend on prior outputs)
- Tool errors in a sequence are caught and reported but don't stop subsequent actions

**Example Binding**:
```json
{
  "id": "quick-capture",
  "keys": "cmd+shift+n",
  "label": "Quick capture to Reminders + Notes",
  "actions": [
    { "tool": "create_reminder", "args": { "name": "${input}", "flagged": true } },
    { "tool": "create_note", "args": { "title": "${input}", "body": "Captured ${timestamp}" } },
    { "tool": "send_notification", "args": { "title": "Captured", "message": "${input}" } }
  ]
}
```

---

## 5. Key Commands

### Build & Deployment
```bash
npm run build          # Compile src/ → dist/
npm run dev            # Run with tsx (no build step, auto-reloads)
npm start              # Run compiled JavaScript
```

### Setup with Claude Code
```bash
# Register MCP server
claude mcp add macos-hub -s user -- node /Users/trey/Desktop/Apps/macos-hub/dist/index.js

# Unregister
claude mcp remove macos-hub -s user
```

### Development
```bash
# Debug logging
DEBUG=1 npm run dev
```

---

## 6. Configuration

### Config Files Location
- `config/watchers.json` — Polling intervals and enable/disable per app
- `config/keybindings.json` — Stackable keybinding definitions

### Watchers Configuration
Controls polling frequency for change detection:

```json
{
  "reminders": { "enabled": true, "intervalMs": 30000 },
  "notes":     { "enabled": true, "intervalMs": 60000 },
  "calendar":  { "enabled": true, "intervalMs": 60000 },
  "mail":      { "enabled": false, "intervalMs": 120000 }
}
```

**Defaults**:
- Reminders: 30s (frequent, likely to change)
- Notes, Calendar: 60s
- Mail: 120s, disabled by default (requires Mail.app running)

### Keybindings Configuration
JSON schema for stackable keybindings (Zod validated):

```json
{
  "version": 1,
  "bindings": [
    {
      "id": "quick-capture",
      "keys": "cmd+shift+n",
      "label": "Quick capture to Reminders + Notes",
      "actions": [
        { "tool": "create_reminder", "args": { "name": "${input}", "flagged": true } },
        { "tool": "create_note", "args": { "title": "${input}", "body": "Captured ${timestamp}" } },
        { "tool": "send_notification", "args": { "title": "Captured", "message": "${input}" } }
      ]
    }
  ]
}
```

### Runtime Behavior
- **Logger**: Outputs to stderr (stdout reserved for MCP protocol)
- **AppleScript defaults**:
  - Timeout: 30s (can be overridden per operation)
  - Max buffer: 10 MB
  - Retries: 1 (automatic retry on failure with 1s delay)
- **Watcher timers**: Use `.unref()` so they don't block process exit
- **Change log**: In-memory ring buffer of max 500 changes (FIFO eviction)

---

## 7. Dependencies & External Systems

### System Dependencies
- **macOS**: Any recent version with AppleScript support
- **Node.js**: v20+ recommended
- **Terminal/Shell**: Must have automation access granted in System Preferences

### External Services
None (all operations are local via AppleScript)

### AppleScript Integration
- Execution: `execFile(/usr/bin/osascript, ["-e", script])` (safe from shell injection)
- Communication: Tab-delimited output parsing
- Pre-flight check: Mail bridge tests if Mail.app is running before each operation
- Error handling: AppleScript errors propagate with exit code and stderr

### Databases
None (state is in-memory)

---

## 8. Testing

### Current Test Infrastructure
**No tests currently implemented** (this is a feature gap).

### What Should Be Tested
- Bridge communication with AppleScript
- Tool input validation against Zod schemas
- Change detection and diffing logic
- Keybinding template variable resolution
- State store management (max 500 changes)
- Error handling for missing apps (e.g., Mail.app not running)

### How to Run Tests (when implemented)
```bash
npm test                # Run all tests
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
```

---

## 9. Current State & Completeness

### Fully Implemented
- All 29 tools (reminders, notes, calendar, mail, system, keybindings, watcher)
- AppleScript engine with retry logic
- Polling-based change detection
- Keybinding template resolution and sequential execution
- MCP server with tool and resource handlers
- Configuration loading (watchers.json, keybindings.json)

### Partially Implemented / Known Limitations
- **Mail**: Requires Mail.app to be running; watcher disabled by default
- **Watcher**: Polling only (not event-based); change detection uses hashing
- **Testing**: Zero test coverage
- **AppleScript parsing**: Tab-delimited format; fragile for special characters
- **Reminders**: Completion detection relies on name prefix `[completed]`

### Not Yet Implemented
- File-based persistence (all state is in-memory)
- Real-time event subscriptions (polling only)
- Batch operations
- Undo/rollback capabilities
- Calendar recurrence rules
- Mail attachment handling
- Notes media/attachments
- Rate limiting or quota management

---

## 10. Feature Requirements by Tool

### Reminders Feature Requirements

#### `list_reminders`
**Purpose**: Retrieve reminder items with optional filtering and pagination

**Inputs**:
- `list` (string, optional): Filter by list name
- `include_completed` (boolean, default: false): Include completed reminders
- `limit` (number, default: 50): Maximum reminders to return
- `offset` (number, default: 0): Skip first N reminders

**Outputs**:
```json
{
  "total": 42,
  "offset": 0,
  "limit": 50,
  "reminders": [
    {
      "id": "uuid",
      "name": "Buy groceries",
      "list": "Shopping",
      "isCompleted": false,
      "dueDate": "2025-02-08T23:59:59.000Z",
      "priority": 5,
      "flagged": true,
      "notes": "Get milk and bread",
      "completionDate": null,
      "creationDate": "2025-02-01T10:00:00.000Z",
      "modificationDate": "2025-02-07T14:30:00.000Z"
    }
  ]
}
```

**Dependencies**:
- RemindersBridge.list()
- AppleScript: Reminders app scripting

**Edge Cases**:
- Empty list name or non-existent list → returns empty array
- No reminders → returns `total: 0, reminders: []`
- Offset > total → returns empty reminders but correct total
- Limit larger than available → returns available count

---

#### `get_reminder`
**Purpose**: Fetch single reminder by ID with full details

**Inputs**:
- `id` (string, required): Reminder UUID

**Outputs**:
```json
{
  "id": "uuid",
  "name": "Buy groceries",
  "list": "Shopping",
  "isCompleted": false,
  "dueDate": "2025-02-08T23:59:59.000Z",
  "priority": 5,
  "flagged": true,
  "notes": "Get milk and bread",
  "completionDate": null,
  "creationDate": "2025-02-01T10:00:00.000Z",
  "modificationDate": "2025-02-07T14:30:00.000Z"
}
```

**Dependencies**:
- RemindersBridge.get()

**Edge Cases**:
- Non-existent ID → null
- Malformed ID → null

---

#### `create_reminder`
**Purpose**: Create new reminder in specified list

**Inputs**:
- `name` (string, required): Reminder title
- `list` (string, optional): Target list name (creates in default if omitted)
- `due_date` (string, optional): Due date string (e.g., "January 15, 2025 at 9:00 AM")
- `priority` (number, optional, enum: [0, 1, 5, 9]): 0=none, 1=high, 5=medium, 9=low
- `flagged` (boolean, optional): Flag for prominence
- `notes` (string, optional): Body/details

**Outputs**:
```json
{
  "id": "new-uuid",
  "message": "Reminder created"
}
```

**Dependencies**:
- RemindersBridge.create()
- AppleScript: Reminders app scripting

**Edge Cases**:
- Non-existent list → Error
- Invalid priority → Treated as 0
- Empty name → Error from AppleScript
- Malformed due date → AppleScript error

---

#### `update_reminder`
**Purpose**: Modify reminder properties

**Inputs**:
- `id` (string, required): Reminder UUID
- `name` (string, optional): New title
- `due_date` (string, optional): New due date
- `priority` (number, optional): New priority
- `flagged` (boolean, optional): New flag state
- `notes` (string, optional): New notes

**Outputs**:
```json
{
  "message": "Reminder updated"
}
```

**Edge Cases**:
- Non-existent ID → Error
- Partial updates → Only specified fields change
- Clearing due date → Pass null or empty string

---

#### `complete_reminder`
**Purpose**: Mark reminder as complete

**Inputs**:
- `id` (string, required): Reminder UUID

**Outputs**:
```json
{
  "message": "Reminder marked complete"
}
```

**Edge Cases**:
- Non-existent ID → Error
- Already completed → No-op (no error)

---

#### `delete_reminder`
**Purpose**: Delete reminder

**Inputs**:
- `id` (string, required): Reminder UUID

**Outputs**:
```json
{
  "message": "Reminder deleted"
}
```

**Edge Cases**:
- Non-existent ID → Error
- Already deleted → Error

---

### Notes Feature Requirements

#### `list_notes`
**Purpose**: Fetch notes with optional folder filtering

**Inputs**:
- `folder` (string, optional): Filter by folder name

**Outputs**:
```json
{
  "total": 12,
  "notes": [
    {
      "id": "uuid",
      "name": "Project Ideas",
      "folder": "Work",
      "body": "",
      "plaintext": "",
      "creationDate": "2025-01-15T10:00:00.000Z",
      "modificationDate": "2025-02-07T14:30:00.000Z"
    }
  ]
}
```

**Edge Cases**:
- Non-existent folder → returns empty array
- No notes → returns `total: 0, notes: []`

---

#### `list_folders`
**Purpose**: Fetch folder hierarchy

**Inputs**: None

**Outputs**:
```json
{
  "total": 4,
  "folders": [
    {
      "id": "uuid",
      "name": "Work",
      "container": null
    },
    {
      "id": "uuid2",
      "name": "Projects",
      "container": "Work"
    }
  ]
}
```

**Edge Cases**:
- Nested folders → container field has parent folder ID

---

#### `get_note`
**Purpose**: Fetch single note with full body (HTML and plaintext)

**Inputs**:
- `id` (string, required): Note UUID

**Outputs**:
```json
{
  "id": "uuid",
  "name": "Project Ideas",
  "folder": "Work",
  "body": "<p>Idea 1: Build X</p><p>Idea 2: Build Y</p>",
  "plaintext": "Idea 1: Build X\
Idea 2: Build Y",
  "creationDate": "2025-01-15T10:00:00.000Z",
  "modificationDate": "2025-02-07T14:30:00.000Z"
}
```

**Edge Cases**:
- Non-existent ID → null
- Note with no content → body/plaintext are empty strings

---

#### `create_note`
**Purpose**: Create new note

**Inputs**:
- `title` (string, required): Note title
- `body` (string, optional): Note content (accepts HTML or plaintext)
- `folder` (string, optional): Target folder (default: Notes folder)

**Outputs**:
```json
{
  "id": "new-uuid",
  "message": "Note created"
}
```

**Edge Cases**:
- Non-existent folder → Error
- Empty title → Error

---

#### `update_note`
**Purpose**: Modify note content

**Inputs**:
- `id` (string, required): Note UUID
- `title` (string, optional): New title
- `body` (string, optional): New body

**Outputs**:
```json
{
  "message": "Note updated"
}
```

**Edge Cases**:
- Non-existent ID → Error
- Partial updates → Only specified fields change

---

#### `search_notes`
**Purpose**: Full-text search notes

**Inputs**:
- `query` (string, required): Search text

**Outputs**:
```json
{
  "total": 3,
  "notes": [
    {
      "id": "uuid",
      "name": "Project Ideas",
      "folder": "Work",
      "body": "",
      "plaintext": "",
      "creationDate": "2025-01-15T10:00:00.000Z",
      "modificationDate": "2025-02-07T14:30:00.000Z"
    }
  ]
}
```

**Edge Cases**:
- No matches → returns `total: 0, notes: []`
- Partial word matching → Depends on Notes.app search behavior

---

### Calendar Feature Requirements

#### `list_calendars`
**Purpose**: Fetch all accessible calendars

**Inputs**: None

**Outputs**:
```json
{
  "total": 3,
  "calendars": [
    {
      "id": "uuid",
      "name": "Personal",
      "color": "RGB(255,0,0)",
      "writable": true,
      "account": "user@example.com"
    }
  ]
}
```

**Edge Cases**:
- Shared calendars → writable may be false
- Multiple accounts → account field identifies owner

---

#### `list_events`
**Purpose**: Fetch events in date range

**Inputs**:
- `start_date` (string, optional): Start date (default: 7 days ago)
- `end_date` (string, optional): End date (default: 7 days from now)
- `calendar` (string, optional): Filter by calendar name

**Outputs**:
```json
{
  "total": 5,
  "events": [
    {
      "id": "uuid",
      "summary": "Team Meeting",
      "startDate": "2025-02-08T14:00:00.000Z",
      "endDate": "2025-02-08T15:00:00.000Z",
      "location": "Conference Room A",
      "notes": "Q1 planning",
      "calendar": "Work",
      "allDay": false,
      "url": "webcal://..."
    }
  ]
}
```

**Edge Cases**:
- No events in range → returns `total: 0, events: []`
- All-day events → startDate/endDate are at midnight, allDay is true
- Non-existent calendar → Error

---

#### `get_event`
**Purpose**: Fetch single event by ID

**Inputs**:
- `id` (string, required): Event UUID
- `calendar` (string, required): Calendar name (needed to locate event)

**Outputs**:
```json
{
  "id": "uuid",
  "summary": "Team Meeting",
  "startDate": "2025-02-08T14:00:00.000Z",
  "endDate": "2025-02-08T15:00:00.000Z",
  "location": "Conference Room A",
  "notes": "Q1 planning",
  "calendar": "Work",
  "allDay": false,
  "url": "webcal://..."
}
```

**Edge Cases**:
- Non-existent ID or calendar → null
- Event with no location/notes → empty strings

---

#### `create_event`
**Purpose**: Create new calendar event

**Inputs**:
- `summary` (string, required): Event title
- `start_date` (string, required): Start date (e.g., "January 15, 2025 at 2:00 PM")
- `end_date` (string, required): End date
- `calendar` (string, optional): Target calendar (default: primary)
- `location` (string, optional): Event location
- `notes` (string, optional): Event description
- `all_day` (boolean, optional): All-day event flag

**Outputs**:
```json
{
  "id": "new-uuid",
  "message": "Event created"
}
```

**Dependencies**:
- CalendarBridge.create()
- AppleScript: Calendar app scripting

**Edge Cases**:
- Start > End → Error
- Non-existent calendar → Error
- Empty summary → Error
- Malformed date → Error

---

#### `update_event`
**Purpose**: Modify event properties

**Inputs**:
- `id` (string, required): Event UUID
- `calendar` (string, required): Calendar name
- `summary` (string, optional): New title
- `start_date` (string, optional): New start date
- `end_date` (string, optional): New end date
- `location` (string, optional): New location
- `notes` (string, optional): New description
- `all_day` (boolean, optional): New all-day flag

**Outputs**:
```json
{
  "message": "Event updated"
}
```

**Edge Cases**:
- Non-existent ID → Error
- Partial updates → Only specified fields change

---

#### `delete_event`
**Purpose**: Delete event

**Inputs**:
- `id` (string, required): Event UUID
- `calendar` (string, required): Calendar name

**Outputs**:
```json
{
  "message": "Event deleted"
}
```

**Edge Cases**:
- Non-existent ID → Error
- Already deleted → Error

---

### Mail Feature Requirements

#### `list_mailboxes`
**Purpose**: Fetch mailboxes across accounts with unread counts

**Inputs**: None

**Outputs**:
```json
{
  "total": 4,
  "mailboxes": [
    {
      "name": "INBOX",
      "account": "user@example.com",
      "unreadCount": 3
    }
  ]
}
```

**Dependencies**:
- Pre-flight: MailBridge checks if Mail.app is running

**Edge Cases**:
- Mail.app not running → Error
- Multiple accounts → Mailboxes grouped by account

---

#### `list_messages`
**Purpose**: Fetch messages from mailbox

**Inputs**:
- `mailbox` (string, required): Mailbox name (e.g., "INBOX")
- `account` (string, required): Account identifier
- `limit` (number, default: 20): Max messages

**Outputs**:
```json
{
  "total": 42,
  "messages": [
    {
      "id": "msg-id",
      "subject": "Project Update",
      "sender": "alice@example.com",
      "recipients": ["bob@example.com"],
      "dateSent": "2025-02-08T14:30:00.000Z",
      "dateReceived": "2025-02-08T14:31:00.000Z",
      "isRead": false,
      "mailbox": "INBOX",
      "content": ""
    }
  ]
}
```

**Edge Cases**:
- Non-existent mailbox → Error
- Empty mailbox → returns `total: 0, messages: []`

---

#### `get_message`
**Purpose**: Fetch single message with full content

**Inputs**:
- `id` (string, required): Message ID
- `mailbox` (string, required): Mailbox name
- `account` (string, required): Account identifier

**Outputs**:
```json
{
  "id": "msg-id",
  "subject": "Project Update",
  "sender": "alice@example.com",
  "recipients": ["bob@example.com", "charlie@example.com"],
  "dateSent": "2025-02-08T14:30:00.000Z",
  "dateReceived": "2025-02-08T14:31:00.000Z",
  "isRead": true,
  "mailbox": "INBOX",
  "content": "Full email body text..."
}
```

**Edge Cases**:
- Non-existent ID → null
- Message with attachments → Content includes message text only (attachments not extracted)

---

#### `send_email`
**Purpose**: Compose and send email via Mail.app

**Inputs**:
- `to` (string, required): Recipient email address
- `subject` (string, required): Email subject
- `body` (string, required): Email body
- `cc` (string, optional): CC recipient
- `bcc` (string, optional): BCC recipient

**Outputs**:
```json
{
  "message": "Email sent"
}
```

**Dependencies**:
- MailBridge.send()
- Mail.app must be running

**Edge Cases**:
- Invalid email address → Mail.app validation (error if rejected)
- No network → Mail.app will queue for later
- Multiple recipients → Comma-separated in cc/bcc

---

#### `search_mail`
**Purpose**: Full-text search messages by subject or sender

**Inputs**:
- `query` (string, required): Search text (matched against subject and sender)
- `mailbox` (string, optional): Limit to specific mailbox
- `account` (string, optional): Limit to specific account
- `limit` (number, default: 20): Max results

**Outputs**:
```json
{
  "total": 7,
  "messages": [
    {
      "id": "msg-id",
      "subject": "Project Update",
      "sender": "alice@example.com",
      "recipients": [],
      "dateSent": "2025-02-08T14:30:00.000Z",
      "dateReceived": "2025-02-08T14:31:00.000Z",
      "isRead": true,
      "mailbox": "INBOX",
      "content": ""
    }
  ]
}
```

**Edge Cases**:
- No matches → returns `total: 0, messages: []`
- Case-insensitive matching

---

### System Feature Requirements

#### `send_notification`
**Purpose**: Display native macOS notification

**Inputs**:
- `title` (string, required): Notification title
- `message` (string, required): Main message
- `subtitle` (string, optional): Secondary message
- `sound` (string, optional): Sound name (e.g., "Glass", "Ping")

**Outputs**:
```json
{
  "message": "Notification sent"
}
```

**Edge Cases**:
- Invalid sound name → No sound (macOS ignores invalid names)
- Very long title/message → Truncated by macOS

---

#### `get_clipboard`
**Purpose**: Read clipboard contents

**Inputs**: None

**Outputs**:
```json
{
  "content": "Clipboard text contents..."
}
```

**Edge Cases**:
- Empty clipboard → Empty string
- Non-text content (image, file, etc.) → Error or empty string

---

#### `set_clipboard`
**Purpose**: Write text to clipboard

**Inputs**:
- `text` (string, required): Text to copy

**Outputs**:
```json
{
  "message": "Clipboard updated"
}
```

**Edge Cases**:
- Very large text → May be truncated by macOS
- Special characters → Properly escaped by escapeForAppleScript

---

### Watcher Feature Requirements

#### `get_recent_changes`
**Purpose**: Fetch detected changes across all apps

**Inputs**:
- `app` (string, optional): Filter by app (reminders, notes, calendar, mail)
- `type` (string, optional): Filter by change type (created, updated, deleted, completed)
- `since` (string, optional): ISO timestamp — return changes after this time
- `limit` (number, default: 50): Max changes to return
- `offset` (number, default: 0): Skip first N changes

**Outputs**:
```json
[
  {
    "id": "change-uuid",
    "app": "reminders",
    "type": "created",
    "itemId": "reminder-uuid",
    "itemName": "Buy groceries",
    "timestamp": "2025-02-08T14:30:00.000Z",
    "details": {}
  }
]
```

**Watcher Behavior**:
- Polls each app at configurable interval (default: 30-60s)
- Compares snapshots (id → hash → name)
- Detects: created, updated, deleted, completed (reminders only)
- Stores in-memory ring buffer (max 500 changes)
- Calls change callback on watcher state update

**Edge Cases**:
- Empty change log → returns `[]`
- Timestamp filter → Inclusive (changes >= since)
- Offset > total → returns `[]` but maintains total

---

### Keybindings Feature Requirements

#### `list_keybindings`
**Purpose**: Fetch all defined keybindings

**Inputs**: None

**Outputs**:
```json
{
  "version": 1,
  "bindings": [
    {
      "id": "quick-capture",
      "keys": "cmd+shift+n",
      "label": "Quick capture to Reminders + Notes",
      "actions": [
        { "tool": "create_reminder", "args": { "name": "${input}", "flagged": true } },
        { "tool": "create_note", "args": { "title": "${input}", "body": "Captured ${timestamp}" } },
        { "tool": "send_notification", "args": { "title": "Captured", "message": "${input}" } }
      ]
    }
  ]
}
```

**Edge Cases**:
- No keybindings configured → returns empty bindings array

---

#### `execute_keybinding`
**Purpose**: Execute a keybinding by ID with optional user input

**Inputs**:
- `id` (string, required): Keybinding ID
- `input` (string, optional): User-provided text (substituted for `${input}`)

**Outputs**:
```json
{
  "binding_id": "quick-capture",
  "binding_label": "Quick capture to Reminders + Notes",
  "results": [
    {
      "tool": "create_reminder",
      "result": {
        "content": [{ "type": "text", "text": "{\"id\": \"...\", \"message\": \"Reminder created\"}" }]
      }
    },
    {
      "tool": "create_note",
      "result": {
        "content": [{ "type": "text", "text": "{\"id\": \"...\", \"message\": \"Note created\"}" }]
      }
    },
    {
      "tool": "send_notification",
      "result": {
        "content": [{ "type": "text", "text": "{\"message\": \"Notification sent\"}" }]
      }
    }
  ]
}
```

**Template Resolution**:
1. Build variable map: `${input}`, `${today}`, `${today_end}`, `${timestamp}`, `${date}`, `${time}`
2. Recursively replace in all action arguments (strings, nested objects, arrays)
3. Execute tools sequentially

**Edge Cases**:
- Non-existent binding ID → Error
- Tool not found in binding → Error in results array but continue
- Tool execution fails → Error in results array but continue
- Missing `${input}` and no input provided → Resolves to empty string

---

## 11. Summary Table: All Features

| Feature | Tool | Status | Inputs | Key Dependencies |
|---|---|---|---|---|
| **Reminders** | | | | |
| List | `list_reminders` | Complete | list, include_completed, limit, offset | RemindersBridge |
| Get | `get_reminder` | Complete | id | RemindersBridge |
| Create | `create_reminder` | Complete | name, list, due_date, priority, flagged, notes | RemindersBridge |
| Update | `update_reminder` | Complete | id, name, due_date, priority, flagged, notes | RemindersBridge |
| Complete | `complete_reminder` | Complete | id | RemindersBridge |
| Delete | `delete_reminder` | Complete | id | RemindersBridge |
| **Notes** | | | | |
| List | `list_notes` | Complete | folder | NotesBridge |
| List Folders | `list_folders` | Complete | — | NotesBridge |
| Get | `get_note` | Complete | id | NotesBridge |
| Create | `create_note` | Complete | title, body, folder | NotesBridge |
| Update | `update_note` | Complete | id, title, body | NotesBridge |
| Search | `search_notes` | Complete | query | NotesBridge |
| **Calendar** | | | | |
| List Calendars | `list_calendars` | Complete | — | CalendarBridge |
| List Events | `list_events` | Complete | start_date, end_date, calendar | CalendarBridge |
| Get Event | `get_event` | Complete | id, calendar | CalendarBridge |
| Create Event | `create_event` | Complete | summary, start_date, end_date, calendar, location, notes, all_day | CalendarBridge |
| Update Event | `update_event` | Complete | id, calendar, [fields] | CalendarBridge |
| Delete Event | `delete_event` | Complete | id, calendar | CalendarBridge |
| **Mail** | | | | |
| List Mailboxes | `list_mailboxes` | Complete | — | MailBridge (requires Mail.app) |
| List Messages | `list_messages` | Complete | mailbox, account, limit | MailBridge |
| Get Message | `get_message` | Complete | id, mailbox, account | MailBridge |
| Send Email | `send_email` | Complete | to, subject, body, cc, bcc | MailBridge |
| Search Mail | `search_mail` | Complete | query, mailbox, account, limit | MailBridge |
| **System** | | | | |
| Send Notification | `send_notification` | Complete | title, message, subtitle, sound | SystemBridge |
| Get Clipboard | `get_clipboard` | Complete | — | SystemBridge |
| Set Clipboard | `set_clipboard` | Complete | text | SystemBridge |
| **Watcher** | | | | |
| Get Recent Changes | `get_recent_changes` | Complete | app, type, since, limit, offset | StateStore, WatcherManager |
| **Keybindings** | | | | |
| List | `list_keybindings` | Complete | — | KeybindingsManager |
| Execute | `execute_keybinding` | Complete | id, input | KeybindingsManager, ExecuteKeybinding |

---

## Conclusion

macOS Hub is a **production-ready MCP server** with **comprehensive feature coverage** across macOS's core productivity apps. Its layered architecture (Tools → Bridges → AppleScript Engine) provides a clean separation of concerns, and the polling-based watcher + keybinding system enable flexible automation workflows.

**Recommended next steps**:
1. Add test suite (unit + integration)
2. Implement real-time event subscriptions (alternative to polling)
3. Add batch operation support
4. Expand Mail attachment handling
5. Support for more macOS apps (Finder, Messages, etc.)