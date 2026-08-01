# MyTalk (mylife-talk) Design Spec

Date: 2026-08-01. Approved by founder in the 2026-08-01 design session.

## One-liner

A lightweight macOS terminal daemon (`talk`) you run beside Claude Code. You talk to a codex-powered (gpt-5.5) voice copilot that watches the live Claude Code session transcript, narrates what is happening, discusses it with you, and turns your spoken intent into verified prompts that it types into the Claude terminal. All speech processing stays on-device.

## Roles

- **You (founder):** speak and listen. Hands stay off the keyboard.
- **Codex (gpt-5.5):** the runtime brain and voice. Summarizes session activity, answers questions about the session, drafts and verifies the next prompt from your speech.
- **Claude (Fable 5):** the agent engineer, untouched, running in its normal terminal with all skills, hooks, and MCP.

## Decisions (from the design session)

1. **Architecture:** companion daemon beside the normal Claude Code terminal. Not a standalone REPL.
2. **Turn-taking:** settings menu with all modes: `hands-free` auto-submit on silence (default), `push-to-talk` (global key), `confirm-word` (utterance held until a send word).
3. **Lightweight:** no Electron, no TUI framework, zero runtime npm dependencies, no bundled ML models.
4. **Codex is the runtime brain:** every user utterance and narration decision routes through `codex exec`. If codex is unavailable, the daemon falls back to verbatim mode and says so out loud (transport honesty; never fake the copilot).
5. **Narration:** settings menu with all modes: `milestones` + turn-end (default), `turn-end` only, `play-by-play`. Claude questions and permission requests are always spoken regardless of mode.
6. **Speech stack:** macOS-native. STT via a small bundled Swift helper (`talk-ear`) using on-device SFSpeechRecognizer with echo-cancelled input (voice-processing audio unit). TTS via `say` with a configurable system voice.
7. **Prompt verification** (a setting): `read-back` (default; codex speaks "Sending: ..." and injects after a grace window unless you say the wait/cancel word), `instant`, `explicit` (requires the send word).
8. **Placement:** standalone dev-tool project at `Apps/mylife-talk/` (same pattern as `system-monitor/`). Not a MyLife hub module; no parity obligations.
9. **Build split:** Fable authors spec + plan and reviews; codex does bulk TS implementation; Fable writes the Swift helper and verifies everything.

## Components

| Unit | Responsibility |
|------|---------------|
| `src/cli.ts` | `talk start`, `talk settings`, `talk doctor` entry points |
| `src/daemon.ts` | Orchestrator wiring ear, watcher, brain, speaker, injector per settings |
| `src/config.ts` | Settings schema, defaults, load/save at `~/.config/mylife-talk/settings.json` |
| `src/transcript/locate.ts` | Project dir to `~/.claude/projects/<slug>` and newest session file |
| `src/transcript/parser.ts` | Tolerant JSONL line to `SessionEvent` |
| `src/transcript/watcher.ts` | Poll-tail the transcript; emit events, turn boundaries |
| `src/brain/prompts.ts` | Codex prompt construction with rolling conversation memory |
| `src/brain/codex.ts` | `codex exec` runner, JSON extraction, retry, availability probe |
| `src/brain/schema.ts` | Validation of the brain's JSON output |
| `src/narrator.ts` | Narration-mode policy: which session events trigger speech |
| `src/turntaking.ts` | Utterance lifecycle, control words, verification state machine |
| `src/speech/ear.ts` | Spawn/supervise `talk-ear`, parse its JSONL, mute control |
| `src/speech/speaker.ts` | `say` queue with interrupt (barge-in) |
| `src/inject/osascript.ts` | Type prompt + return into the terminal app via System Events |
| `src/inject/tmux.ts` | `tmux send-keys` backend |
| `src/ui.ts` | Single ANSI status line + scrolling log lines |
| `swift/talk-ear.swift` | Mic capture, on-device streaming STT, silence segmentation, PTT key tap, fixture mode |

## Conversation flow

1. You speak. `talk-ear` streams partials; silence (default 1500 ms) finalizes the utterance (mode-dependent).
2. Control words are checked locally first (cancel, mute/unmute, wait, send, "read it in full", "what's happening").
3. Everything else goes to the codex brain with recent session context. Brain returns strict JSON: `{ speak, action: 'chat' | 'prompt' | 'none', prompt? }`.
4. `action: 'chat'` speaks the answer. `action: 'prompt'` enters the verification flow, then the injector types it into the Claude terminal and presses return.
5. Watcher events narrate per mode; turn-end always produces a compact spoken summary of Claude's final message (never a 40-line verbatim read; "read it in full" is available).
6. If the brain fails or codex is missing: verbatim fallback (raw transcript injected, Claude replies read directly), announced aloud.

## Transcript format (verified against live session 2026-08-01)

- Lines with `type: 'assistant'`, `message.content` array of `text` / `tool_use` blocks, `message.stop_reason` in `'tool_use' | 'end_turn'`. `stop_reason === 'end_turn'` is the turn boundary.
- Lines with `type: 'user'` and string `message.content` are real user prompts; array content is tool results (ignored); `isMeta: true` ignored.
- `isSidechain: true` lines are subagent transcripts: always ignored.
- `AskUserQuestion` tool_use input: `{ questions: [{ question, header, options: [{ label, description }] }] }`.
- Unknown or malformed lines are skipped, never crash.

## Error handling

- Missing mic or speech permission: spoken + printed instructions, daemon stays alive.
- Missing accessibility permission (injection fails): spoken instructions naming System Settings pane.
- Codex missing/timeout: announced verbatim fallback; probe retried each utterance.
- Transcript not found: clear message naming the expected slug dir; `--transcript` flag override.
- `talk-ear` crash: auto-restart up to 3 times, then degraded (speaks the failure).

## Testing

Vitest on all pure logic (parser, locate slug, control words, narration policy, verification state machine, brain JSON extraction/validation, settings merge, injector arg building). Integration tests use a fixture transcript writer and a mocked codex/spawn. `talk-ear --fixture <file>` replays scripted utterances so CI never needs a mic. No network, no mic, no osascript in tests.

## Non-goals (v1)

- No Windows/Linux. No wake word. No cloud STT/TTS engines (interface stays swappable). No MyLife hub module wiring. No reading of arbitrary non-Claude terminal apps.
