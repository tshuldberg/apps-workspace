# Plugins And MCP Inventory

Verified 2026-07-09. This file records availability, not product source of truth. Never place secret values here.

## Codex

Enabled local or stdio MCP servers:

- `node_repl`
- `open-brain`
- `playwright`
- `sites-design-picker`

Enabled remote MCP servers:

- `github`
- `openaiDeveloperDocs`
- `slack` (authentication was not active during the 2026-07-09 check)

`open-brain` is registered through `mcp-remote` with the existing `BRAIN_KEY` environment variable. Codex reads MCP registrations at session startup. After adding or changing this server, start a fresh Codex session before expecting its tools to appear.

Re-verify with:

```bash
codex mcp list
codex mcp get open-brain
```

## Claude Code

Connected during the 2026-07-09 health check:

- Context7
- Notion
- Slack
- Figma
- Gmail
- Google Calendar
- Jina MCP
- Chrome DevTools
- Open Brain

Authentication was required for:

- Zapier
- Google Drive

The shared `.mcp.json` diagnostic also warned that `JINA_API_KEY` was unavailable to project-config validation even though the Jina health probe connected. Re-check the environment before relying on Jina in a new session.

Re-verify with:

```bash
claude mcp list
```

## Open Brain Troubleshooting

1. Confirm `BRAIN_KEY` exists in the shell environment without printing its value.
2. Confirm the server appears in the relevant client inventory. Claude and Codex keep separate MCP registrations.
3. Restart the client after registration changes.
4. If the server appears but does not connect, run the client inventory command and inspect the `mcp-remote` startup error. Do not paste the key into a committed file or diagnostic log.
