# Conversational Slack Daemon Design

> Created: 2026-02-12 | Status: Approved

## Overview

Turn the automation-hub into a conversational personal assistant that responds to Trey via Slack. The "bot" is not a standalone daemon — it's the active Claude Code session (Opus 4.6) running on a clamshell MacBook Pro, leveraging its full context (macos-hub MCP, humanizer skill, automation-hub tools).

## Platform Decisions

- **Slack (two-way):** DMs, channel mentions (@bot), and proactive responses where meaningful
- **iMessage (one-way):** Notifications, summaries, alerts only — no incoming message processing
- **Humanizer:** Claude Code IS the LLM — no separate API call needed. Humanizer skill is loaded in session context
- **Eliminated:** iMessage two-way (fragile), Telegram (unnecessary with Slack), Discord/Signal/WhatsApp (no advantage)

## Architecture

```
Trey (phone/laptop)                    Clamshell MacBook Pro
┌─────────────┐                       ┌──────────────────────────────┐
│ Slack App    │── DM to bot ────────▶ │ Claude Code (Opus 4.6)       │
│             │── @bot in channel ──▶ │   ├─ macos-hub MCP (Slack)    │
│             │◀─ bot replies ─────── │   ├─ humanizer skill          │
│             │                       │   ├─ automation-hub jobs      │
│ Messages    │◀─ notifications ───── │   ├─ macos-hub MCP (iMessage) │
│  (one-way)  │                       │   └─ session-difficulties.md  │
└─────────────┘                       └──────────────────────────────┘
```

## Slack Bot Behavior

### Response Triggers
1. **DM to bot:** Always respond conversationally
2. **@mention in channel:** Respond in-thread when tagged
3. **Proactive participation:** Respond in channels where the bot has meaningful answers or feedback (not every message — only when it adds value)

### Send Policy (Critical)
- **Auto-send OK:** Messages to Trey (self), Receeps Slack (internal)
- **Draft only:** All emails to external recipients, non-Receeps Slack, external iMessages
- **iMessage:** One-way notifications only

### Safety Layers
1. `allowed-tools` whitelist in skill YAML — no send tools for external contacts
2. `SendPolicy` runtime evaluator in the router
3. CLAUDE.md 3-bullet rule near the top

## Components

### 1. Slack Socket Mode Listener (`automation-hub/src/listeners/slack-socket.ts`)
- Uses `@slack/bolt` with Socket Mode (no public URL needed)
- Handles `message` events (DMs) and `app_mention` events (channel tags)
- Surfaces messages to the Claude Code session for processing
- Bot replies via Slack MCP tools or SlackBridge

### 2. SendPolicy Evaluator (`automation-hub/src/approval/send-policy.ts`)
- Classifies outbound messages as `auto` or `draft_only`
- Called by ChannelRouter before any adapter send
- Self-replies and Receeps Slack = auto; everything else = draft

### 3. Session Difficulties Log (`automation-hub/logs/session-difficulties.md`)
- Append-only markdown file
- Bot logs questions, edge cases, errors, and improvement ideas
- Timestamped entries for trend analysis
- Reviewed periodically to inform skill/tool improvements

### 4. Humanizer Integration
- No separate utility function needed — Claude Code applies humanizer skill naturally
- Email drafts in `buildReplyDraft` are rewritten by the active Claude session
- All outgoing text passes through the humanizer as part of normal Claude Code processing

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `automation-hub/src/listeners/slack-socket.ts` | Create | Socket Mode listener daemon |
| `automation-hub/src/approval/send-policy.ts` | Create | Auto vs draft-only evaluator |
| `automation-hub/logs/session-difficulties.md` | Create | Bot difficulty/improvement log |
| `automation-hub/src/jobs/email-triage.ts` | Modify | Drafts routed through Claude Code humanization |
| `automation-hub/src/adapters/router.ts` | Modify | SendPolicy gate before any adapter send |
| `automation-hub/CLAUDE.md` | Modify | Add critical outbound message rules |
| `automation-hub/package.json` | Modify | Add `@slack/bolt` dependency |
| `tests/send-policy.test.ts` | Create | Tests for send/draft classification |
| `tests/slack-socket.test.ts` | Create | Tests for Socket Mode listener |

## CLAUDE.md Addition

```markdown
## Critical: Outbound Message Rules
- NEVER auto-send to external recipients — all external replies are drafts presented for approval
- Auto-send OK: messages to Trey (self), Receeps Slack (internal)
- iMessage is one-way notifications only — never process incoming iMessages
```

## Research Sources

- **Platform comparison:** Evaluated Slack, Telegram, iMessage, Discord, Signal, WhatsApp Business
- **Skill patterns:** openclaw/skills hexnickk/claude-optimised (CLAUDE.md brevity), local humanizer skill (allowed-tools whitelist)
- **Existing code:** macos-hub SlackBridge, automation-hub adapters, email-triage.ts reply drafts
