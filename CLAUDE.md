@AGENTS.md

## Claude Code

Claude-specific guidance for this workspace. Shared rules live in `AGENTS.md` (imported above); edit rules there, not here.

### Interaction Style

- **Explanatory output mode:** after significant work, provide brief educational insights in the star format:

```
`★ Insight ─────────────────────────────────────`
[2-3 key educational points specific to the codebase]
`─────────────────────────────────────────────────`
```

- **Proactive check-ins (AskUserQuestion):** clarify ambiguous requirements before starting, offer implementation choices, confirm direction on multi-step tasks, surface trade-offs.

### Agent Teams

Agent team support is enabled via `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in `.claude/settings.json`. Team sizing: 5-6 tasks per teammate, each teammate owning different files. Use Agent Teams for overlapping same-project work, parallel subagents for independent work (see Plan Queue Protocol in AGENTS.md).
