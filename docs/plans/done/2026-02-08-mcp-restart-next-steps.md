# MCP Restart + AGENTS.md Next Steps

Date: 2026-02-08
Workspace: /Users/trey/Desktop/Apps

## What Was Done
- Enumerated all instruction files across `/Apps` excluding `SH/shiphawk-dev`.
- Loaded and compared:
  - `/Users/trey/Desktop/Apps/AGENTS.md`
  - `/Users/trey/Desktop/Apps/CLAUDE.md`
  - Project instruction files in `receipts`, `shiphawk-templates`, `macos-hub`, `tron-castle-fight`, `Parks/EasyStreet`, `Parks/easystreet-monorepo`.
  - Relevant skill registries and `.claude/settings.json` files.
- Installed official OpenAI docs MCP server in Codex config:
  - Command run: `codex mcp add openaiDeveloperDocs --url https://developers.openai.com/mcp`
- Confirmed MCP server is registered:
  - `codex mcp list` shows `openaiDeveloperDocs` as enabled.

## Current Blocker
- In the active session, MCP tool calls still reported unknown server `openaiDeveloperDocs`.
- This indicates the running Codex session likely needs a restart to pick up the newly added MCP server.

## First Steps After Restart
1. Restart Codex desktop app/session.
2. Verify server registration in terminal:
   - `codex mcp list`
3. In the new chat session, verify MCP connectivity via tooling:
   - list MCP resources/templates for `openaiDeveloperDocs`.
4. If still unavailable after restart:
   - run `codex mcp get openaiDeveloperDocs`
   - if needed, remove/re-add the server and retry.

## AGENTS.md Work Queue (Prepared)
Goal: create a universal `/Apps/AGENTS.md` and per-project `AGENTS.md` files that mirror existing `CLAUDE.md`/agent docs functionality for Codex.

### Target Projects
- `/Users/trey/Desktop/Apps` (root)
- `/Users/trey/Desktop/Apps/receipts` (missing AGENTS.md)
- `/Users/trey/Desktop/Apps/shiphawk-templates` (missing AGENTS.md)
- `/Users/trey/Desktop/Apps/macos-hub` (has AGENTS.md; update/align)
- `/Users/trey/Desktop/Apps/tron-castle-fight` (has AGENTS.md; update/align)
- `/Users/trey/Desktop/Apps/Parks/EasyStreet` (missing AGENTS.md)
- `/Users/trey/Desktop/Apps/Parks/easystreet-monorepo` (missing AGENTS.md)

### Source Material Already Identified
- Root-level:
  - `/Users/trey/Desktop/Apps/CLAUDE.md`
  - `/Users/trey/Desktop/Apps/AGENTS.md`
  - `/Users/trey/Desktop/Apps/.claude/skills/SKILLS_REGISTRY.md`
- Receipts:
  - `/Users/trey/Desktop/Apps/receipts/CLAUDE.md`
  - `/Users/trey/Desktop/Apps/receipts/AGENT_GUIDE.md`
  - `/Users/trey/Desktop/Apps/receipts/.claude/docs/*.md`
  - `/Users/trey/Desktop/Apps/receipts/.claude/skills/SKILLS_REGISTRY.md`
- Shiphawk templates:
  - `/Users/trey/Desktop/Apps/shiphawk-templates/CLAUDE.md`
- macos-hub:
  - `/Users/trey/Desktop/Apps/macos-hub/AGENTS.md`
  - `/Users/trey/Desktop/Apps/macos-hub/CLAUDE.md`
  - `/Users/trey/Desktop/Apps/macos-hub/.claude/skills/*/SKILL.md`
- Tron:
  - `/Users/trey/Desktop/Apps/tron-castle-fight/AGENTS.md`
  - `/Users/trey/Desktop/Apps/tron-castle-fight/CLAUDE.md`
  - `/Users/trey/Desktop/Apps/tron-castle-fight/project-governance/AGENTS_TEMPLATE.md`
  - `/Users/trey/Desktop/Apps/tron-castle-fight/skills/project-log-updater/SKILL.md`
- EasyStreet + monorepo:
  - `/Users/trey/Desktop/Apps/Parks/EasyStreet/.claude/CLAUDE.md`
  - `/Users/trey/Desktop/Apps/Parks/EasyStreet/.claude/settings.json`
  - `/Users/trey/Desktop/Apps/Parks/easystreet-monorepo/.claude/CLAUDE.md`
  - `/Users/trey/Desktop/Apps/Parks/easystreet-monorepo/.claude/settings.json`

## Planned Implementation Order After MCP Is Live
1. Pull official AGENTS.md guidance from OpenAI docs MCP and lock the file contract.
2. Update `/Users/trey/Desktop/Apps/AGENTS.md` to include universal rules + scope guardrail.
3. Create missing project `AGENTS.md` files (`receipts`, `shiphawk-templates`, `Parks/EasyStreet`, `Parks/easystreet-monorepo`).
4. Normalize existing project `AGENTS.md` files (`macos-hub`, `tron-castle-fight`) for consistency while preserving project-specific requirements.
5. Re-scan to confirm each target project has an `AGENTS.md` and summarize diffs.

## Critical Guardrail to Preserve
- Always exclude `/Users/trey/Desktop/Apps/SH/shiphawk-dev` unless explicitly requested.

## Execution Update (Completed 2026-02-08)

Completed all planned AGENTS work after MCP restart:

- Updated: `/Users/trey/Desktop/Apps/AGENTS.md`
- Updated: `/Users/trey/Desktop/Apps/macos-hub/AGENTS.md`
- Updated: `/Users/trey/Desktop/Apps/tron-castle-fight/AGENTS.md`
- Created: `/Users/trey/Desktop/Apps/receipts/AGENTS.md`
- Created: `/Users/trey/Desktop/Apps/shiphawk-templates/AGENTS.md`
- Created: `/Users/trey/Desktop/Apps/Parks/EasyStreet/AGENTS.md`
- Created: `/Users/trey/Desktop/Apps/Parks/easystreet-monorepo/AGENTS.md`

MCP verification and source used:
- `codex mcp list` confirms `openaiDeveloperDocs` enabled.
- Official guidance referenced: `https://developers.openai.com/codex/guides/agents-md/`

## Follow-Up Update (Instruction Sync + New Skill)

Completed additional workspace governance updates:

- Added explicit `Instruction Sync (Critical)` rules in both `AGENTS.md` and `CLAUDE.md` across workspace and project instruction pairs.
- Added workspace skill:
  - `/Users/trey/Desktop/Apps/.claude/skills/research-documentation/SKILL.md`
- Registered the new skill in:
  - `/Users/trey/Desktop/Apps/.claude/skills/SKILLS_REGISTRY.md`
- Updated workspace instruction skill listings in:
  - `/Users/trey/Desktop/Apps/AGENTS.md`
  - `/Users/trey/Desktop/Apps/CLAUDE.md`
