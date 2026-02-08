# macOS Hub MCP Server — User Guide

**Category:** MCP Server
**Scope:** User-scoped (registered globally for all projects)
**Projects using this:** All projects in /Apps/ (workspace-wide access)
**Last updated:** 2026-02-08

## What It Does

macOS Hub is a Model Context Protocol (MCP) server that gives Claude Code direct access to native macOS applications through AppleScript. It provides 29 tools across 6 categories — Reminders, Notes, Calendar, Mail, System, and Keybindings — plus a change detection watcher that monitors for modifications across apps.

## Setup

### Prerequisites
- macOS (uses AppleScript via `/usr/bin/osascript`)
- Node.js v20+
- The macos-hub project built: `cd /Users/trey/Desktop/Apps/macos-hub && npm run build`
- For Mail tools: Mail.app must be running

### Installation

Register as a user-scoped MCP server in Claude Code:

```bash
claude mcp add macos-hub -s user -- node /Users/trey/Desktop/Apps/macos-hub/dist/index.js
```

### Removal

```bash
claude mcp remove macos-hub -s user
```

### Configuration Files

| File | Location | Purpose |
|------|----------|---------|
| `watchers.json` | `/Users/trey/Desktop/Apps/macos-hub/config/watchers.json` | Polling intervals per app |
| `keybindings.json` | `/Users/trey/Desktop/Apps/macos-hub/config/keybindings.json` | Custom multi-tool workflows |

## Usage

### Quick Start

1. Build: `cd /Users/trey/Desktop/Apps/macos-hub && npm run build`
2. Register: `claude mcp add macos-hub -s user -- node /Users/trey/Desktop/Apps/macos-hub/dist/index.js`
3. Restart Claude Code
4. Ask Claude naturally: "Show me my reminders" or "Create a note called Meeting Notes"

### Tool Reference

#### Reminders (6 tools)

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `list_reminders` | Fetch reminders (default: incomplete only) | `listName?`, `includeCompleted?`, `limit?`, `offset?` |
| `get_reminder` | Fetch single reminder by ID | `id` |
| `create_reminder` | Create new reminder | `name`, `dueDate?`, `priority?` (0/1/5/9), `notes?`, `flagged?` |
| `update_reminder` | Modify reminder properties | `id`, `name?`, `dueDate?`, `priority?`, `notes?`, `flagged?` |
| `complete_reminder` | Mark reminder as complete | `id` |
| `delete_reminder` | Delete reminder | `id` |

**Priority values:** 0 = none, 1 = high, 5 = medium, 9 = low

#### Notes (6 tools)

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `list_notes` | Fetch notes (optionally by folder) | `folder?`, `limit?`, `offset?` |
| `list_folders` | Fetch folder hierarchy | (none) |
| `get_note` | Fetch note with full body (HTML + plaintext) | `id` |
| `create_note` | Create note in folder | `title`, `body`, `folder?` |
| `update_note` | Modify note content | `id`, `title?`, `body?` |
| `search_notes` | Full-text search across notes | `query` |

#### Calendar (6 tools)

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `list_calendars` | Fetch all calendars with metadata | (none) |
| `list_events` | Fetch events in date range | `startDate?`, `endDate?`, `calendarName?` |
| `get_event` | Fetch single event by ID | `id` |
| `create_event` | Create event | `title`, `startDate`, `endDate`, `calendarName?`, `location?`, `notes?`, `allDay?` |
| `update_event` | Modify event | `id`, `title?`, `startDate?`, `endDate?`, `location?`, `notes?` |
| `delete_event` | Delete event | `id` |

**Default date range:** events lists default to +/-7 days from today.

#### Mail (5 tools)

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `list_mailboxes` | Fetch mailboxes per account with unread counts | (none) |
| `list_messages` | Fetch messages from mailbox (default: 20) | `mailbox?`, `account?`, `limit?` |
| `get_message` | Fetch full message content | `id` |
| `send_email` | Compose and send via Mail.app | `to`, `subject`, `body`, `cc?`, `bcc?` |
| `search_mail` | Search by subject and sender | `query`, `mailbox?` |

**Requirement:** Mail.app must be running. Tools check this before each operation.

#### System (3 tools)

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `send_notification` | Display native macOS notification | `title`, `message`, `subtitle?`, `sound?` |
| `get_clipboard` | Read clipboard contents | (none) |
| `set_clipboard` | Write text to clipboard | `text` |

#### Watcher (1 tool)

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `get_recent_changes` | Fetch detected changes across apps | `app?`, `type?`, `since?`, `limit?` |

Change types: `created`, `updated`, `deleted`, `completed` (reminders only)

#### Keybindings (2 tools)

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `list_keybindings` | Fetch all defined keybindings | (none) |
| `execute_keybinding` | Execute a keybinding by ID | `id`, `input?` |

### Common Operations

| Operation | What to Ask Claude |
|-----------|--------------------|
| View today's reminders | "Show me my reminders" |
| Create a reminder | "Remind me to buy groceries tomorrow at 5pm" |
| Check calendar | "What's on my calendar this week?" |
| Create a meeting | "Schedule a meeting with John tomorrow 2-3pm" |
| Search notes | "Search my notes for project ideas" |
| Quick capture | "Create a note and reminder for: Review Q4 report" |
| Check email | "Show me my unread emails" |
| Send notification | "Send me a notification that the build is done" |
| Copy to clipboard | "Copy this text to my clipboard: hello world" |

### Advanced Usage

#### Custom Keybindings

Define multi-tool workflows in `config/keybindings.json`:

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

**Template variables:**

| Variable | Value |
|----------|-------|
| `${input}` | User-provided text passed to `execute_keybinding` |
| `${today}` | Today's date (e.g., "February 8, 2026") |
| `${today_end}` | Today at 11:59 PM |
| `${timestamp}` | ISO 8601 timestamp |
| `${date}` | Same as `${today}` |
| `${time}` | Current time string |

#### Watcher Configuration

Adjust polling intervals in `config/watchers.json`:

```json
{
  "reminders": { "enabled": true, "intervalMs": 30000 },
  "notes":     { "enabled": true, "intervalMs": 60000 },
  "calendar":  { "enabled": true, "intervalMs": 60000 },
  "mail":      { "enabled": false, "intervalMs": 120000 }
}
```

Mail is disabled by default to avoid requiring Mail.app to be open.

#### MCP Resources

Two resources are exposed for clients that support MCP resource subscriptions:

| Resource URI | Content |
|-------------|---------|
| `macos://changes/recent` | Auto-updated change log from watcher |
| `macos://keybindings` | Current keybinding configuration |

## Integration with Other Tools

- **All projects:** macOS Hub is user-scoped, so its tools are available in every Claude Code session regardless of project
- **Workflow automation:** Combine with project skills — e.g., after `/add-to-timeline`, send a notification confirming the update
- **Cross-app workflows:** Use keybindings to chain operations across Reminders, Notes, Calendar, and Mail

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Tools not available | Verify registration: `claude mcp list`. Re-register if missing |
| Mail tools fail | Ensure Mail.app is running. Mail watcher is disabled by default |
| AppleScript permission errors | Grant Terminal/Claude Code access in System Settings > Privacy & Security > Automation |
| Watcher not detecting changes | Check `config/watchers.json` — ensure the app is `enabled: true` |
| Build errors | Run `cd /Users/trey/Desktop/Apps/macos-hub && npm run build` and check for TypeScript errors |
| Slow responses | AppleScript has a 30s timeout. Large data sets (many reminders/notes) may be slow |

## References

- **Project path:** `/Users/trey/Desktop/Apps/macos-hub/`
- **CLAUDE.md:** `/Users/trey/Desktop/Apps/macos-hub/CLAUDE.md`
- **Research report:** `/Users/trey/Desktop/Apps/docs/reports/macos-hub-research-2026-02-08.md`
- **MCP SDK docs:** [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/sdk)
