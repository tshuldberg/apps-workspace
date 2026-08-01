# AGENTS.md

Guidance for coding agents working in `mylife-talk`.

## What this is

MyTalk (`talk`): a macOS voice-copilot daemon for Claude Code sessions. The founder speaks; a codex (gpt-5.5) brain watches the live session transcript, narrates, and types verified prompts into the Claude terminal. Standalone dev tool at the Apps root (pattern: `system-monitor/`), NOT a MyLife hub module — no parity obligations.

## Stack and rules

- Node 22, TypeScript strict, ESM with NodeNext: relative imports must end in `.js`.
- **Zero runtime npm dependencies.** Only `node:` builtins at runtime; Vitest + tsx + typescript as devDeps. Keep it that way.
- Speech is macOS-native only: `swift/talk-ear.swift` (SFSpeechRecognizer on-device, echo-cancelled) for STT, `say` for TTS. No cloud speech, no bundled models.
- Transport honesty: if codex is unreachable, the daemon announces verbatim fallback out loud. Never fake the copilot.
- Tests never touch mic, network, osascript, tmux, codex, or real `~/.claude` paths. Effectful edges take injectable fakes; `talk-ear --fixture` replays scripted utterances.

## Commands

```bash
pnpm install
pnpm build        # tsc + swiftc (scripts/build-ear.sh)
pnpm test         # Vitest
pnpm typecheck
pnpm dev -- doctor   # environment checks
```

## Architecture map

Pure policy (unit-tested): `src/transcript/parser.ts`, `src/transcript/locate.ts`, `src/narrator.ts`, `src/turntaking.ts`, `src/brain/prompts.ts`, `src/brain/schema.ts`, `src/config.ts`, `src/inject/*.ts` (arg builders).
Effectful edges (injectable): `src/speech/ear.ts` (talk-ear supervisor), `src/speech/speaker.ts` (say queue), `src/transcript/watcher.ts` (poll-tail), `src/brain/codex.ts` (codex exec), `src/daemon.ts` + `src/cli.ts` (wiring).

Transcript format contract is documented in `docs/spec.md` and was verified against a live session (2026-08-01): assistant lines carry `message.stop_reason` (`end_turn` = turn boundary), `isSidechain: true` lines are subagent noise and must stay ignored.

## Change tracking

Update `PROJECT_LOG.md` per session. Conventional Commits (`feat:`, `fix:`, `docs:`...). This project lives in the Apps repo.
