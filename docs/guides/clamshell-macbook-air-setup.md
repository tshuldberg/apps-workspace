# Clamshell MacBook Air — Automation Host Setup Guide

> Complete setup guide for a new M-series MacBook Air configured as an always-on clamshell automation server running the /Apps automation stack with Claude Code (primary), OpenAI Codex CLI, and Google Gemini CLI.

**Last updated:** 2026-02-12
**Target hardware:** MacBook Air M1/M2/M3/M4 (Apple Silicon)
**Scope:** Automation-only stack (macos-hub, automation-hub, system-monitor)

---

## Table of Contents

1. [Initial macOS Setup](#1-initial-macos-setup)
2. [Clamshell & Power Configuration](#2-clamshell--power-configuration)
3. [System Foundations](#3-system-foundations)
4. [Language Runtimes](#4-language-runtimes)
5. [Clone & Build Repositories](#5-clone--build-repositories)
6. [Claude Code Setup (Primary)](#6-claude-code-setup-primary)
7. [OpenAI Codex CLI Setup](#7-openai-codex-cli-setup)
8. [Google Gemini CLI Setup](#8-google-gemini-cli-setup)
9. [AI CLI Workflow Roles](#9-ai-cli-workflow-roles)
10. [MCP Server Wiring](#10-mcp-server-wiring)
11. [Launchd Daemons & Scheduling](#11-launchd-daemons--scheduling)
12. [Verification Checklist](#12-verification-checklist)
13. [Ongoing Maintenance](#13-ongoing-maintenance)

---

## 1. Initial macOS Setup

### First Boot

1. Complete macOS Setup Assistant (language, Wi-Fi, Apple ID sign-in)
2. Enable **FileVault** disk encryption (System Settings > Privacy & Security > FileVault)
3. Set computer name: System Settings > General > About > Name → `trey-air-automation` (or your preference)
4. Sign into **iCloud** (required for Reminders, Notes, Calendar, Mail sync — these are macos-hub data sources)
5. Open **Mail.app**, **Reminders.app**, **Notes.app**, **Calendar.app**, and **Messages.app** at least once to initialize their databases

### Enable Remote Access

```bash
# Enable SSH for remote management from your primary machine
sudo systemsetup -setremotelogin on

# Verify
ssh localhost
```

### Auto-Login (Required for Clamshell)

System Settings > Users & Groups > Automatic Login → Select your user account.

This ensures the machine boots directly to your desktop after power loss, without requiring keyboard/display interaction.

### Software Updates

```bash
# Check for updates
softwareupdate --list

# Install all available
softwareupdate --install --all --agree-to-license

# Enable automatic security updates
sudo defaults write /Library/Preferences/com.apple.SoftwareUpdate AutomaticallyInstallMacOSUpdates -bool true
```

---

## 2. Clamshell & Power Configuration

### Prevent Sleep (Always-On)

```bash
# Prevent sleep when lid is closed and on power adapter
sudo pmset -a disablesleep 1
sudo pmset -a sleep 0
sudo pmset -a disksleep 0
sudo pmset -a displaysleep 5      # Screen off after 5 min (saves energy)
sudo pmset -a powernap 1          # Allow background tasks during display sleep
sudo pmset -a tcpkeepalive 1      # Keep network connections alive
sudo pmset -a womp 1              # Wake on network access (Wake-on-LAN)

# Verify settings
pmset -g
```

**Expected output should show:**
```
sleep         0
disablesleep  1
disksleep     0
displaysleep  5
powernap      1
```

### Clamshell Mode Requirements

For macOS to stay awake with the lid closed, you need **at minimum**:
- Power adapter connected (USB-C)
- Either an external display, keyboard, or mouse connected

**Recommended setup:** Plug in the power adapter + a USB-C hub with at least one peripheral (even a $5 USB mouse counts). This satisfies macOS's clamshell requirements without needing a display.

**Alternative (no peripherals):** The `sudo pmset -a disablesleep 1` command above overrides the clamshell requirement entirely. The Mac will stay awake lid-closed with just power connected.

### Thermal Management

M-series MacBook Airs are fanless — thermal throttling is the only cooling mechanism. For an always-on automation host:

- **Elevate the laptop** on a stand or rack for airflow under the chassis
- **Keep ambient temperature below 30C / 86F**
- **Avoid stacking** anything on top of the closed lid
- Automation workloads (polling, text processing) generate minimal heat — sustained CPU over 50% is unlikely with this stack

### Wake After Power Failure

```bash
# Automatically restart after power loss
sudo pmset -a autorestart 1
```

---

## 3. System Foundations

### Xcode Command Line Tools

```bash
xcode-select --install
```

Wait for the download (~2.5 GB). This provides git, clang, make, and other build essentials.

### Homebrew

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Add Homebrew to PATH (Apple Silicon default location)
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"

# Verify
brew --version
```

### Essential System Tools

```bash
brew install \
  git \
  gh \
  tmux \
  jq \
  tree
```

### SSH Keys & GitHub Authentication

```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "your.email@example.com" -f ~/.ssh/id_ed25519

# Start SSH agent
eval "$(ssh-agent -s)"

# Add key to agent (with Apple Keychain integration)
cat >> ~/.ssh/config << 'EOF'
Host github.com
  AddKeysToAgent yes
  UseKeychain yes
  IdentityFile ~/.ssh/id_ed25519
EOF

ssh-add --apple-use-keychain ~/.ssh/id_ed25519

# Copy public key to clipboard
pbcopy < ~/.ssh/id_ed25519.pub
```

Now add the key to GitHub:
1. Go to https://github.com/settings/keys
2. Click "New SSH Key"
3. Paste from clipboard
4. Title: `trey-air-automation`

```bash
# Authenticate GitHub CLI
gh auth login
# Select: GitHub.com > SSH > existing key > Login with browser

# Verify
ssh -T git@github.com
# Should output: "Hi tshuldberg! You've successfully authenticated..."
```

### Git Configuration

```bash
git config --global user.name "Trey Shuldberg"
git config --global user.email "your.email@example.com"
git config --global core.editor "vim"
git config --global init.defaultBranch main
git config --global pull.rebase false
```

---

## 4. Language Runtimes

### Node.js & npm

```bash
brew install node

# Verify
node --version    # Should be v22+ (LTS) or v25+ (current)
npm --version     # Should be 10+ or 11+
```

### Bun (Optional — Used by easystreet-monorepo)

```bash
brew install bun

# Verify
bun --version     # Should be 1.2+
```

### Python 3 & Poetry

```bash
# Python comes with macOS / Homebrew
brew install python@3.14

# Install Poetry (Python package manager)
brew install poetry

# Verify
python3 --version    # Should be 3.14+
poetry --version     # Should be 2.x+
```

### TypeScript (tsx — dev runner)

```bash
# tsx is installed per-project via npm, but useful globally for quick scripts
npm install -g tsx

# Verify
tsx --version
```

---

## 5. Clone & Build Repositories

### Create Directory Structure

```bash
mkdir -p ~/Desktop/Apps
cd ~/Desktop/Apps
```

### Clone Workspace Root

```bash
git clone https://github.com/tshuldberg/apps-workspace.git .
# Or if the repo IS the root:
git clone https://github.com/tshuldberg/apps-workspace.git ~/Desktop/Apps
```

> **Note:** If the workspace root repo contains all project references but projects are separate repos, clone the root first, then clone each project into its subdirectory.

### Clone Automation Projects

```bash
cd ~/Desktop/Apps

# macos-hub — MCP server (32 tools for native macOS integration)
git clone git@github.com:tshuldberg/macos-hub.git

# automation-hub — Multi-channel task automation engine
# (already part of workspace root, or clone separately if needed)

# system-monitor — 24/7 CPU/memory/disk monitoring daemon
# (already part of workspace root, or clone separately if needed)
```

### Build All Projects

```bash
# macos-hub
cd ~/Desktop/Apps/macos-hub
npm install
npm run build && echo "BUILD OK" || echo "BUILD FAILED"
# Verify: dist/index.js should exist
ls -la dist/index.js

# automation-hub
cd ~/Desktop/Apps/automation-hub
npm install
npm run build && echo "BUILD OK" || echo "BUILD FAILED"
# Verify: dist/ directory with compiled JS
ls dist/

# system-monitor
cd ~/Desktop/Apps/system-monitor
npm install
npm run build && echo "BUILD OK" || echo "BUILD FAILED"
# Verify: dist/index.js should exist
ls -la dist/index.js
```

### Configure Slack Tokens

The automation-hub Slack listener requires two tokens in `~/.zshrc`:

```bash
# Bot Token — for API calls (sending messages, reading channels)
export SLACK_BOT_TOKEN="xoxb-your-bot-token"

# App Token — for Socket Mode WebSocket connection
export SLACK_APP_TOKEN="xapp-your-app-token"
```

**To get these tokens:**

1. Go to https://api.slack.com/apps and create or select your app
2. **Bot Token (`xoxb-`):** OAuth & Permissions > Install to Workspace > copy Bot User OAuth Token
3. **App Token (`xapp-`):** Basic Information > App-Level Tokens > Generate Token and Scopes > add `connections:write` scope

**Required Slack app configuration:**

1. **Socket Mode:** Left sidebar > Socket Mode > toggle ON
2. **Event Subscriptions:** Left sidebar > Event Subscriptions > toggle ON > Subscribe to bot events:
   - `message.im` (DM listening)
   - `app_mention` (channel mentions)
3. **Bot Token Scopes:** OAuth & Permissions > Bot Token Scopes — ensure these are present:
   - `chat:write` — send messages
   - `im:history` — read DM history
   - `im:read` — access DM channel list
   - `app_mentions:read` — receive @mention events
   - `channels:history` — read public channel messages
   - `channels:read` — list channels
4. **Reinstall** the app after adding scopes (OAuth & Permissions > Reinstall to Workspace)
5. **Invite the bot** to channels: `/invite @YourBotName` in each channel

### Configure automation-hub

```bash
cd ~/Desktop/Apps/automation-hub

# Copy example configs (do NOT commit the real configs — they contain local paths)
cp config/runtime.example.yaml config/runtime.yaml
cp config/channel_adapters.example.yaml config/channel_adapters.yaml

# Edit runtime.yaml to configure:
# - providers.active: "openai" or "claude" (which AI backend to use)
# - connectors: email/calendar/pm provider + MCP server references
# - paths: jobs_dir, schema_dir, policy_file, state_dir, runs_dir
# Note: The shiphawk_dev_path reference is optional and read-only — ignore it.

# Edit channel_adapters.yaml to enable/disable channels:
# email, calendar, reminders, imessage, slack, superwhisper

# Review the approval policy (default: deny all writes, require human approval)
cat policies/approval_policy.yaml
# Key facts: 15 rules, default_decision="deny", all write actions need human approval.
# Covers: pm.create_task, pm.update_task, email.send_reply, calendar.*, messages.*, reminders.*

# Review job spec files to understand what each job does
ls jobs/
# 01_email_triage.yaml         — Extract tasks from email, map to PM, draft replies
# 02_calendar_due_date_planner — Recommend due dates using calendar capacity
# 03_gantt_drift_voice_queue   — Detect timeline drift from email signals
# 04_unified_channel_consolidation — Poll all 5 channels, deduplicate, priority queue
```

### Run Tests

```bash
# automation-hub (6 test suites, 100+ assertions)
cd ~/Desktop/Apps/automation-hub
npm test

# system-monitor (collector tests against live system data)
cd ~/Desktop/Apps/system-monitor
npm test
```

---

## 6. Claude Code Setup (Primary)

Claude Code is the **primary AI agent** for this workspace. It has direct MCP integration with macos-hub and runs all workspace skills.

### Install Claude Code

```bash
npm install -g @anthropic-ai/claude-code

# Alternative: native installer (if npm method is deprecated in your version)
# curl -fsSL https://claude.ai/install.sh | sh

# Verify
claude --version
# Should output: X.X.X (Claude Code)
```

### Authenticate

```bash
claude
# Follow the browser-based authentication flow
# Sign in with your Anthropic account
```

### Copy Global Settings

On your **primary machine**, export the global settings:

```bash
# FROM PRIMARY MACHINE — copy settings to clipboard or transfer file
cat ~/.claude/settings.json | pbcopy
```

On the **new Air**, create the settings file:

```bash
mkdir -p ~/.claude
```

Create `~/.claude/settings.json` with the following structure (adapt from your primary machine):

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "permissions": {
    "allow": [
      "Read", "Edit", "Write", "Glob", "Grep", "WebSearch",
      "WebFetch(domain:github.com)",
      "WebFetch(domain:docs.anthropic.com)",
      "WebFetch(domain:code.claude.com)",
      "WebFetch(domain:platform.claude.com)",
      "WebFetch(domain:developers.openai.com)",
      "WebFetch(domain:developer.apple.com)",
      "WebFetch(domain:www.npmjs.com)",
      "WebFetch(domain:pypi.org)",
      "WebFetch(domain:stackoverflow.com)",
      "mcp__macos-hub__*",
      "Bash(npm run *)", "Bash(npm install *)", "Bash(npm test *)",
      "Bash(npm start *)", "Bash(npm list *)", "Bash(npx *)",
      "Bash(node *)", "Bash(python3 *)", "Bash(tsc *)",
      "Bash(git status)", "Bash(git status *)", "Bash(git log *)",
      "Bash(git diff *)", "Bash(git add *)", "Bash(git commit *)",
      "Bash(git branch *)", "Bash(git fetch *)", "Bash(git pull *)",
      "Bash(git remote *)", "Bash(git rev-parse *)", "Bash(git show *)",
      "Bash(git stash *)", "Bash(git checkout *)", "Bash(git worktree *)",
      "Bash(git mv *)", "Bash(git -C *)",
      "Bash(gh *)", "Bash(ls *)", "Bash(which *)", "Bash(wc *)",
      "Bash(mkdir *)", "Bash(cp *)", "Bash(mv *)", "Bash(touch *)",
      "Bash(open *)", "Bash(echo *)", "Bash(test *)",
      "Bash(brew install *)", "Bash(brew list *)", "Bash(brew services *)",
      "Bash(docker ps *)", "Bash(docker compose *)"
    ],
    "deny": [
      "Bash(rm -rf *)", "Bash(rm -r *)", "Bash(rm -f *)",
      "Bash(git push --force *)", "Bash(git push -f *)",
      "Bash(git reset --hard *)", "Bash(git clean -f *)",
      "Bash(sudo *)", "Bash(chmod 777 *)",
      "Bash(curl * | bash *)", "Bash(eval *)",
      "Bash(kill -9 *)", "Bash(killall *)",
      "Bash(launchctl *)", "Bash(defaults write *)",
      "Read(./.env)", "Read(./.env.*)", "Read(**/.env)", "Read(**/.env.*)",
      "Read(**/credentials*)", "Read(**/*secret*)",
      "Read(**/*.pem)", "Read(**/*.key)",
      "Read(**/.ssh/*)", "Read(**/.aws/*)"
    ]
  }
}
```

### Configure MCP Server (macos-hub)

Create or update `~/.claude.json` (Claude Code's MCP server config — note: this is in the home directory, not inside `~/.claude/`):

```json
{
  "mcpServers": {
    "macos-hub": {
      "type": "stdio",
      "command": "node",
      "args": ["/Users/trey/Desktop/Apps/macos-hub/dist/index.js"],
      "env": {}
    }
  }
}
```

> **Important:** Update the path to match the actual username on the new Air if different from `trey`. The MCP config file is `~/.claude.json` (home directory), distinct from settings at `~/.claude/settings.json`.

### Copy Workspace Skills

The workspace skills are tracked in git, so they should already be present after cloning. Verify:

```bash
ls ~/Desktop/Apps/.claude/skills/
# Should show: daily-report-ops/, generate-architecture-diagrams/, onboard-new-app/,
#              research-app/, research-documentation/, scan-emails/, SKILLS_REGISTRY.md
```

### Install Plugins

Claude Code plugins auto-install from the official marketplace on first use. Key plugins for the automation stack:

- `superpowers@claude-plugins-official` — Workflow automation (brainstorming, TDD, debugging)
- `claude-md-management@claude-plugins-official` — CLAUDE.md auditing
- `commit-commands@claude-plugins-official` — Git workflow
- `code-review@claude-plugins-official` — PR review
- `context7@claude-plugins-official` — Library documentation
- `firecrawl@claude-plugins-official` — Web research

Plugins are configured per-project in `.claude/settings.json`. Since these files are in git, they'll be present after cloning.

### Verify Claude Code

```bash
cd ~/Desktop/Apps
claude

# Test MCP connection:
# Ask: "List my reminders" — should invoke macos-hub list_reminders tool
# Ask: "What's on my calendar today?" — should invoke list_events tool
```

---

## 7. OpenAI Codex CLI Setup

Codex CLI is OpenAI's terminal-based coding agent. It runs locally and can inspect repos, edit files, and execute commands.

### Install

```bash
# Via npm (recommended for consistency with Node.js stack)
npm install -g @openai/codex

# Or via Homebrew
# brew install --cask codex

# Verify
codex --version
```

### Authenticate

```bash
codex
# Select "Sign in with ChatGPT"
# Complete browser-based auth flow
# Requires: ChatGPT Plus, Pro, Team, Edu, or Enterprise plan
```

### Configure

Codex CLI uses `~/.codex/` for configuration. Create a config file if needed:

```bash
mkdir -p ~/.codex
```

Codex respects the `OPENAI_API_KEY` environment variable. If using API key auth:

```bash
# Add to ~/.zprofile
echo 'export OPENAI_API_KEY="sk-your-key-here"' >> ~/.zprofile
source ~/.zprofile
```

### Test

```bash
cd ~/Desktop/Apps/automation-hub
codex "Explain the adapter pattern used in this project"
```

---

## 8. Google Gemini CLI Setup

Gemini CLI is Google's open-source terminal AI agent, powered by Gemini 3 Pro / Flash models.

### Install

```bash
npm install -g @google/gemini-cli

# Verify
gemini --version
```

### Authenticate

```bash
gemini
# When prompted, select "Login with Google"
# Authenticate with your Google account in the browser
# Free tier: 60 requests/min, 1,000 requests/day
```

### Configure (Optional — API Key)

For higher rate limits or Vertex AI integration:

```bash
# Add to ~/.zprofile
echo 'export GEMINI_API_KEY="your-key-here"' >> ~/.zprofile
source ~/.zprofile
```

### Test

```bash
cd ~/Desktop/Apps/system-monitor
gemini "What metrics does this daemon collect?"
```

---

## 9. AI CLI Workflow Roles

With three AI CLIs installed, define clear roles to avoid confusion:

### Role Assignment

| CLI | Role | When to Use |
|-----|------|-------------|
| **Claude Code** (primary) | Full workspace agent | All development, MCP tool access, workspace skills, agent teams, daily automation, code review |
| **Codex CLI** (secondary) | Fast code generation | Quick scaffolding, file edits, code explanations when Claude is busy or rate-limited |
| **Gemini CLI** (tertiary) | Research & analysis | Web research, documentation lookups, brainstorming, second-opinion code review |

### Why Three CLIs

1. **Redundancy** — If one service has an outage, the others can continue automation work
2. **Rate limit distribution** — Spread heavy workloads across providers
3. **Model diversity** — Different models catch different issues in code review
4. **Cost optimization** — Use Gemini's free tier for research, Claude for high-value orchestration

### Workflow Examples

**Daily automation (Claude Code — primary):**
```bash
cd ~/Desktop/Apps
claude
# Inside the interactive session, type slash commands:
#   /daily-report-ops        ← Uses MCP tools, workspace skills
#   /scan-emails             ← Requires macos-hub MCP integration
#   /generate-architecture-diagrams  ← Generates mermaid diagrams
```

> **Note:** Slash commands (like `/daily-report-ops`) are **workspace skills** — custom automation workflows defined in `.claude/skills/`. They run inside an interactive Claude Code session, not as CLI arguments. Separately, **plugin commands** (like `/code-review`, `/commit`) come from installed Claude Code plugins.

**Quick code task (Codex CLI):**
```bash
cd ~/Desktop/Apps/automation-hub
codex "Add a health check endpoint to the CLI"
```

**Research task (Gemini CLI):**
```bash
cd ~/Desktop/Apps
gemini "Compare the top 5 approaches for implementing webhook-based alerting in Node.js"
```

**Multi-agent code review:**
```bash
# Get review from all three perspectives
cd ~/Desktop/Apps/macos-hub
# In Claude Code session: /code-review (plugin command)
codex "Review the latest changes for security issues"  # Codex: security focus
gemini "Review this diff for performance issues"       # Gemini: perf focus
```

**Agent teams (Claude Code exclusive):**
Claude Code supports experimental agent teams (enabled via `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in settings). This allows spawning multiple specialized agents that work on parallel tasks within a single Claude Code session — useful for research + implementation workflows. See the Claude Code docs for details.

---

## 10. MCP Server Wiring

The **macos-hub MCP server** is the bridge between Claude Code and native macOS apps. It must be built and configured correctly.

### Build macos-hub

```bash
cd ~/Desktop/Apps/macos-hub
npm install
npm run build

# Verify the entry point exists
ls -la dist/index.js
```

### Verify MCP Config

Check that `~/.claude.json` points to the correct path:

```bash
cat ~/.claude.json
# Should contain:
# "macos-hub": { "type": "stdio", "command": "node", "args": ["...dist/index.js"] }
```

### Test All 32 Tools

Open Claude Code and test each category:

```bash
cd ~/Desktop/Apps
claude
```

Test commands to try inside Claude Code:
- **Reminders:** "List my reminders" / "Create a reminder called 'Test setup'"
- **Notes:** "List my notes" / "Search notes for 'meeting'"
- **Calendar:** "What's on my calendar this week?"
- **Mail:** "List my mailboxes" (requires Mail.app running)
- **Messages:** "List my recent iMessages"
- **System:** "Send a notification saying 'Setup complete'"
- **Watcher:** "Show recent changes across all apps"
- **Keybindings:** "List my keybindings"

### Watcher Configuration

The watcher polls macOS apps for changes. Verify config:

```bash
cat ~/Desktop/Apps/macos-hub/config/watchers.json
```

Expected:
```json
{
  "reminders": { "enabled": true, "intervalMs": 120000 },
  "notes": { "enabled": true, "intervalMs": 300000 },
  "calendar": { "enabled": true, "intervalMs": 900000 },
  "mail": { "enabled": false, "intervalMs": 120000 }
}
```

> **Note:** Mail watcher is disabled by default. Enable it if Mail.app will always be running on this machine.

### Keybindings Configuration

Verify keybindings are loaded:

```bash
cat ~/Desktop/Apps/macos-hub/config/keybindings.json
```

Two default bindings:
- `quick-capture` (Cmd+Shift+N) — Creates reminder + note + notification
- `morning-review` (Cmd+Shift+M) — Lists today's events + due reminders

---

## 11. Launchd Daemons & Scheduling

### Install system-monitor Daemon

The system-monitor runs as a launchd agent — it starts on login and auto-restarts on crash.

```bash
cd ~/Desktop/Apps/system-monitor

# Build and install (runs the install script)
npm run install-daemon
```

The install script:
1. Compiles TypeScript to `dist/`
2. Creates `logs/` directory
3. Copies plist to `~/Library/LaunchAgents/com.trey.system-monitor.plist`
4. Loads the daemon via `launchctl`

### Verify Daemon Running

```bash
# Check if loaded
launchctl list | grep system-monitor

# Check logs
tail -f ~/Desktop/Apps/system-monitor/logs/daemon-stderr.log
```

### Monitor Configuration

The daemon uses `config/monitor.json`:

```json
{
  "polling": { "intervalMs": 10000, "processSnapshotCount": 30 },
  "thresholds": {
    "cpu": { "warnPercent": 80, "criticalPercent": 95, "sustainedSeconds": 30 },
    "memory": { "warnPercent": 80, "criticalPercent": 90, "pressureLevel": "warn" },
    "disk": { "warnPercent": 85, "criticalPercent": 95, "volumes": ["/"] }
  },
  "cooldown": { "minSecondsBetweenReports": 300, "maxReportsPerDay": 20 },
  "notifications": { "enabled": true, "sound": "Funk" },
  "reports": {
    "outputDir": "/Users/trey/Desktop/Apps/docs/reports",
    "namingPrefix": "REPORT-system-monitor"
  },
  "history": { "logDir": "logs", "maxFileSizeMB": 50, "maxFiles": 10 }
}
```

> **Adjust paths** if your username differs from `trey`.

### Scheduling automation-hub Jobs (Future)

automation-hub jobs are currently dry-run only. When ready for production scheduling:

**Option A: launchd plist per job**

Create `~/Library/LaunchAgents/com.trey.automation-hub.email-triage.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.trey.automation-hub.email-triage</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/node</string>
    <string>/Users/trey/Desktop/Apps/automation-hub/dist/cli.js</string>
    <string>run-email-triage</string>
    <string>--dry-run</string>
  </array>
  <key>StartInterval</key>
  <integer>7200</integer>
  <key>WorkingDirectory</key>
  <string>/Users/trey/Desktop/Apps/automation-hub</string>
  <key>StandardOutPath</key>
  <string>/Users/trey/Desktop/Apps/automation-hub/logs/email-triage-stdout.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/trey/Desktop/Apps/automation-hub/logs/email-triage-stderr.log</string>
  <key>ProcessType</key>
  <string>Background</string>
  <key>Nice</key>
  <integer>10</integer>
</dict>
</plist>
```

**Option B: crontab (simpler)**

```bash
crontab -e
```

```cron
# Email triage every 2 hours, weekdays 8am-6pm
0 8,10,12,14,16,18 * * 1-5 cd /Users/trey/Desktop/Apps/automation-hub && npm run job:email-triage:dry-run >> logs/email-triage.log 2>&1

# Due date planner weekly Mon-Fri 7:30am
30 7 * * 1-5 cd /Users/trey/Desktop/Apps/automation-hub && npm run job:due-date-planner:dry-run >> logs/due-date-planner.log 2>&1

# Gantt drift check daily 4:30pm
30 16 * * 1-5 cd /Users/trey/Desktop/Apps/automation-hub && npm run job:gantt-drift:dry-run >> logs/gantt-drift.log 2>&1

# Channel consolidation every hour
0 * * * * cd /Users/trey/Desktop/Apps/automation-hub && npm run job:channel-consolidation:dry-run >> logs/channel-consolidation.log 2>&1
```

> **Note:** Remove `--dry-run` and add `--approve-writes` when ready for live execution. All jobs enforce approval gates — see `policies/approval_policy.yaml`.

---

## 12. Verification Checklist

Run through this checklist after completing setup to confirm everything works:

### System

- [ ] macOS auto-login enabled
- [ ] `pmset -g` shows `sleep 0`, `disablesleep 1`
- [ ] SSH accessible from primary machine: `ssh trey@<air-ip>`
- [ ] Machine stays awake with lid closed (test: close lid, wait 60s, SSH in)

### Tools

- [ ] `node --version` → v22+
- [ ] `npm --version` → 10+
- [ ] `python3 --version` → 3.12+
- [ ] `git --version` → 2.x+
- [ ] `gh auth status` → Logged in
- [ ] `ssh -T git@github.com` → Authenticated

### AI CLIs

- [ ] `claude --version` → Claude Code installed
- [ ] `codex --version` → Codex CLI installed
- [ ] `gemini --version` → Gemini CLI installed
- [ ] Claude Code: open session, ask "List my reminders" → MCP tools work

### Repositories

- [ ] `ls ~/Desktop/Apps/macos-hub/dist/index.js` → Built
- [ ] `ls ~/Desktop/Apps/automation-hub/dist/` → Built
- [ ] `ls ~/Desktop/Apps/system-monitor/dist/index.js` → Built
- [ ] `cd ~/Desktop/Apps/automation-hub && npm test` → All tests pass
- [ ] `cd ~/Desktop/Apps/system-monitor && npm test` → Tests pass

### Daemons

- [ ] `launchctl list | grep system-monitor` → Running
- [ ] `tail ~/Desktop/Apps/system-monitor/logs/daemon-stderr.log` → Recent entries
- [ ] `ls ~/Desktop/Apps/docs/reports/REPORT-system-monitor-*` → Reports generated (after threshold breach)

### Slack Listener

- [ ] `echo $SLACK_BOT_TOKEN` → Starts with `xoxb-`
- [ ] `echo $SLACK_APP_TOKEN` → Starts with `xapp-`
- [ ] `cd ~/Desktop/Apps/automation-hub && npm run listener:slack` → Starts without errors
- [ ] DM the bot in Slack → Receives a reply
- [ ] @mention the bot in a channel → Replies in-thread
- [ ] Bot is invited to all target channels (`/invite @YourBotName`)

### MCP Server

- [ ] Claude Code recognizes macos-hub tools (try "list my keybindings")
- [ ] Reminders.app accessible via MCP
- [ ] Calendar.app accessible via MCP
- [ ] Notes.app accessible via MCP
- [ ] Messages.app accessible via MCP (test: "list my recent iMessages")
- [ ] System notifications work (test: "send a notification saying test")

### Workspace Skills (6 total)

- [ ] `/daily-report-ops` — Generates daily/ad-hoc project reports
- [ ] `/scan-emails` — Scans inbox via macos-hub MCP (Mail.app must be running)
- [ ] `/research-app macos-hub` — Generates structured research report
- [ ] `/onboard-new-app` — Verify skill loads (used when adding new projects)
- [ ] `/research-documentation` — Verify skill loads (used for docs research)
- [ ] `/generate-architecture-diagrams` — Generates mermaid diagrams to `.claude/docs/`

---

## 13. Ongoing Maintenance

### Daily (Automated)

- system-monitor daemon runs 24/7, generates reports on threshold breaches
- automation-hub jobs run on schedule (when enabled)
- JSONL history logs rotate automatically at 50MB

### Weekly (Manual)

```bash
# Pull latest code on all repos
cd ~/Desktop/Apps && git pull
cd ~/Desktop/Apps/macos-hub && git pull && npm install && npm run build
cd ~/Desktop/Apps/automation-hub && git pull && npm install && npm run build
cd ~/Desktop/Apps/system-monitor && git pull && npm install && npm run build

# Reinstall system-monitor daemon if code changed
cd ~/Desktop/Apps/system-monitor && npm run install-daemon

# Update Claude Code
npm update -g @anthropic-ai/claude-code

# Update Codex CLI
npm update -g @openai/codex

# Update Gemini CLI
npm update -g @google/gemini-cli
```

### Monthly

```bash
# Update Homebrew and all packages
brew update && brew upgrade

# Check for macOS updates
softwareupdate --list

# Review system-monitor history for trends
wc -l ~/Desktop/Apps/system-monitor/logs/history.jsonl
# Should be ~260K lines/month at 10s polling (~770KB/day)

# Review automation-hub run artifacts
ls ~/Desktop/Apps/automation-hub/runs/

# Prune old run artifacts (keep last 30 days)
find ~/Desktop/Apps/automation-hub/runs/ -type d -mtime +30 -exec rm -rf {} +
```

### Rule Changes & Documentation Sync

When adding or changing workspace rules on the Air, always update **both** `CLAUDE.md` and `AGENTS.md` together. They are a synchronized pair — a rule change is not complete until both files reflect it. This applies at both the workspace level (`/Apps/CLAUDE.md` + `/Apps/AGENTS.md`) and per-project level.

After every development session, update the relevant change tracking file:
- Workspace: `~/Desktop/Apps/timeline.md`
- Per-project: `timeline.md` or `PROJECT_LOG.md` in the project root

### Log Rotation

- **system-monitor:** Automatic rotation at 50MB, keeps 10 files (500MB max)
- **automation-hub:** Run artifacts in `runs/<run_id>/` — prune manually or via cron
- **daemon logs:** `daemon-stdout.log` and `daemon-stderr.log` grow indefinitely — add periodic rotation:

```bash
# Add to crontab: rotate daemon logs monthly
0 0 1 * * mv ~/Desktop/Apps/system-monitor/logs/daemon-stderr.log ~/Desktop/Apps/system-monitor/logs/daemon-stderr.$(date +\%Y\%m).log 2>/dev/null
0 0 1 * * mv ~/Desktop/Apps/system-monitor/logs/daemon-stdout.log ~/Desktop/Apps/system-monitor/logs/daemon-stdout.$(date +\%Y\%m).log 2>/dev/null
```

### Troubleshooting

**Mac won't stay awake lid-closed:**
```bash
pmset -g assertions   # Check what's requesting sleep
sudo pmset -a disablesleep 1   # Re-apply override
```

**system-monitor daemon not running:**
```bash
launchctl list | grep system-monitor
# If not listed:
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.trey.system-monitor.plist
```

**MCP tools not working in Claude Code:**
```bash
# Rebuild macos-hub
cd ~/Desktop/Apps/macos-hub && npm run build

# Check MCP config path
cat ~/.claude/.json

# Ensure the app is running (Mail.app, Reminders.app, etc.)
open -a "Reminders"
```

**SSH connection refused:**
```bash
# On the Air:
sudo systemsetup -getremotelogin
# If "Off": sudo systemsetup -setremotelogin on
```

---

## Quick Reference Card

```
SSH into Air:     ssh trey@<air-local-ip>
Claude Code:      cd ~/Desktop/Apps && claude
Codex CLI:        cd ~/Desktop/Apps && codex
Gemini CLI:       cd ~/Desktop/Apps && gemini
Slack listener:   cd ~/Desktop/Apps/automation-hub && npm run listener:slack
Daemon logs:      tail -f ~/Desktop/Apps/system-monitor/logs/daemon-stderr.log
Rebuild all:      for d in macos-hub automation-hub system-monitor; do (cd ~/Desktop/Apps/$d && npm run build); done
Run tests:        for d in automation-hub system-monitor; do (cd ~/Desktop/Apps/$d && npm test); done
Job dry-run:      cd ~/Desktop/Apps/automation-hub && node dist/cli.js run-email-triage --dry-run
```

---

*Guide created: 2026-02-12. Update this document when adding new automation projects or changing the stack.*
