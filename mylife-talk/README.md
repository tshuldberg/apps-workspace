# MyTalk (`talk`)

Talk to your Claude Code sessions. MyTalk is a lightweight macOS terminal daemon you run beside Claude Code: you speak, a codex-powered (gpt-5.5) copilot watches the live session, narrates what Claude is doing, discusses it with you, and types verified prompts into the Claude terminal for you. Speech recognition and synthesis are fully on-device.

```
┌─ Terminal 1: claude ────────────────────────┐
│ > your spoken words land here and submit    │
│ Claude's replies are summarized aloud       │
└─────────────────────────────────────────────┘
┌─ Terminal 2: talk ──────────────────────────┐
│ 🎤 listening — MyLife session               │
└─────────────────────────────────────────────┘
```

## Requirements

- macOS 13+ (built and tested on macOS 26), Apple Silicon or Intel
- Node 22+, pnpm
- Xcode Command Line Tools (`swiftc`) to build the speech helper once
- [Codex CLI](https://github.com/openai/codex) on PATH (the copilot brain). Without it, MyTalk still works in verbatim mode: your words go in as spoken, Claude's replies are read directly.

## Install

```bash
cd mylife-talk
pnpm install
pnpm build          # compiles TypeScript + the talk-ear Swift helper
node dist/cli.js doctor   # or: pnpm dev doctor
```

Grant when prompted (attributed to your terminal app in System Settings > Privacy & Security):
- **Microphone** and **Speech Recognition** — first `talk start`
- **Accessibility** — lets MyTalk type into the Claude terminal
- Push-to-talk additionally needs **Input Monitoring** on some systems

## Use

```bash
cd your-project     # same directory where you run `claude`
talk                # or: talk start --project /path/to/project
```

Start `claude` in another terminal as usual. Then just speak.

- Give Claude work: "run the parity gates and fix whatever drifts" → the copilot drafts a clean prompt, reads it back ("Sending: ..."), and types it into the Claude terminal after a 3 second grace window.
- Discuss: "what's happening?", "why did the tests fail?" → answered aloud, nothing injected.
- Control words: `scratch that`, `wait`, `send it`, `stop listening`, `start listening`, `read it in full`, `help`.

## Settings

`talk settings` opens an interactive menu; stored at `~/.config/mylife-talk/settings.json`.

| Setting | Options (default first) |
|---------|------------------------|
| turnTaking | `hands-free` silence auto-submit, `push-to-talk` (global key), `confirm-word` |
| narration | `milestones` + turn-end, `turn-end` only, `play-by-play` |
| verification | `read-back` grace window, `instant`, `explicit` send word |
| voice / rate | any `say -v ?` voice, words per minute |
| terminalApp / injector | `Terminal` via osascript, or `tmux` with a target pane |
| pttKey | `rightOption`, `rightCommand`, `f13` |
| ttsMuteTailMs | mic stays muted this long after TTS ends (default 300) |
| historyTurns | prior-conversation turns recalled at startup (default 10) |

Claude's questions and permission prompts are always spoken, regardless of narration mode.

## Conversation history

Every session is saved live to `~/.config/mylife-talk/transcripts/<timestamp>.jsonl` (your words, the copilot's words, every injected prompt). The next `talk start` recalls the last `historyTurns` turns so the copilot remembers where you left off. Read any transcript back with `cat` or pipe it to `jq`.

## How it works

1. `talk-ear` (Swift) streams on-device SFSpeechRecognizer transcription with echo-cancelled input; silence finalizes an utterance.
2. The utterance routes to a stateless `codex exec` call carrying rolling conversation history plus recent session events tailed from `~/.claude/projects/<slug>/<session>.jsonl`.
3. The brain answers as JSON: speak something, and/or submit a prompt. Prompts go through the verification flow, then System Events keystrokes (or `tmux send-keys`) into the Claude terminal.
4. Session events narrate per your narration mode; `stop_reason: end_turn` triggers a spoken summary of Claude's reply.

## Troubleshooting

- **Nothing happens when you speak:** make sure your terminal app has Microphone + Speech Recognition permission, then watch `talk-ear` directly: `./bin/talk-ear --debug-levels` and speak. `level 0.000xx` lines confirm mic audio; partials confirm recognition. Do not enable `--aec`: macOS voice processing feeds SFSpeechRecognizer a multichannel format it cannot read (this presents exactly as "nothing happens").
- **The copilot hears itself:** raise `ttsMuteTailMs`.

## Development

```bash
pnpm test        # Vitest, no mic/network needed (talk-ear has a --fixture mode)
pnpm typecheck
```

See `docs/spec.md` (design) and `docs/plan.md` (implementation contract). Change log in `PROJECT_LOG.md`.
