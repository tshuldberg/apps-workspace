# 2026-08-01: MyTalk voice copilot built (Apps/mylife-talk)

## What and why

Founder asked for a way to run Claude Code sessions by voice ("typing has been a lot"): speak at the computer, discuss back and forth, and drive the project conversationally. Reviewed MyLife + Meerkat + git history first; confirmed the ecosystem has no real STT/TTS terminal tooling (the MyVoice module is data-layer only; DoWork's voice coach is the only live STT).

Design session (AskUserQuestion rounds) settled: companion daemon beside the normal Claude terminal; **codex (gpt-5.5) is the runtime brain and voice** (narrates the session, discusses it, verifies next prompts) while Fable 5 stays the agent engineer; all turn-taking/narration/verification modes in a settings menu; macOS-native on-device speech; lightweight (zero runtime npm deps).

## Where

New standalone dev tool `Apps/mylife-talk/` (system-monitor pattern, tracked directly by the Apps repo). NOT a MyLife hub module; no parity obligations. Apps repo commit `06a1380` (48 files, 5,217 insertions), index rows added to Apps CLAUDE.md/AGENTS.md + timeline.md.

## How it works

- `talk-ear` (Swift 6, single file): AVAudioEngine with voice-processing IO (echo cancellation) into on-device SFSpeechRecognizer; silence-based utterance segmentation; CGEventTap push-to-talk (rightOption/rightCommand/f13); stdin mute/unmute; `--fixture` replay mode for CI.
- TS daemon (Node 22, ESM, zero runtime deps): poll-tails `~/.claude/projects/<slug>/<session>.jsonl` (format verified against this live session: `stop_reason: end_turn` = turn boundary, `isSidechain` skipped), routes utterances through stateless `codex exec -s read-only` calls carrying rolling history + recent session events, strict-JSON brain contract `{speak, action: chat|prompt|none, prompt}`, verification flow (read-back grace window / instant / explicit send word), injection via System Events keystroke or `tmux send-keys`, `say` TTS queue with barge-in.
- Honesty: codex unreachable -> announced verbatim fallback (raw words injected, replies read directly). Claude questions/permission prompts always spoken.

## Build process

Fable authored spec (`mylife-talk/docs/spec.md`) + plan (`docs/plan.md`); codex exec implemented all 32 TS files from the plan contracts (154k tokens, 120 tests); Fable wrote the Swift helper, reviewed every codex file, and fixed 3 defects.

## Defects found in review (all fixed)

1. **PTT final-drop:** talk-ear emitted `ptt: up` before the final utterance and TurnTaking gated routing on key-down state, so every push-to-talk utterance would be dropped. Fixed both sides (final now emitted before key-up; TS routes finals regardless of key state since the ear enforces capture windows).
2. **codex stdin hang:** `codex exec` waits on an open stdin pipe ("Reading additional input from stdin..."), so every live brain call timed out; worked in manual terminal testing (TTY stdin) which is why codex's stubbed tests missed it. Fixed by closing child stdin in the default runner.
3. **JSON extraction fragility:** first-brace extraction could grab pre-answer braces from codex logs; parseResult now scans all balanced JSON candidates until one validates.

## Verification

- 120/120 Vitest, `tsc --noEmit` clean, dist build ok.
- Swift helper compiles (swiftc 6.2.3), fixture mode replay verified end to end.
- Live codex probes: work request -> `{action:'prompt', prompt:'Run the tests and fix whatever fails.'}`; status question -> grounded chat answer. Both through the real runner.
- `talk doctor` from MyLife cwd: all checks green (found this very session's transcript).

## Live-run fix + transcripts (same day, follow-up)

Founder's first live run: "nothing is happening when I speak." Reproduced headlessly by playing `say` output through the speakers into talk-ear with `--debug-levels`:
- AEC off: mic levels flow, 18 partials + clean final. AEC on (the shipped default): input format becomes **48000Hz x9** (voice-processing IO reshapes the input node) and SFSpeechRecognizer produces zero partials despite audio flowing.
- Fix: AEC now opt-in (`--aec`); echo prevention moved to the daemon, which mutes the ear during TTS plus a `ttsMuteTailMs` (300 ms) tail; founder mute survives the tail. Live-verified with defaults.

Also shipped founder request from the same conversation: **saved voice conversations + cross-session history.** Live-appended JSONL transcripts at `~/.config/mylife-talk/transcripts/<timestamp>.jsonl` (utterances, copilot speech, injected prompts, start/end notes); next `talk start` seeds the codex brain with the last `historyTurns` (10) turns from the newest transcript. New `src/voicelog.ts` + tests; 126 tests + typecheck green; second Apps repo commit. errors_log row added (AEC defect, Resolved).

## Remaining (needs a human at the machine)

Spoken round-trip QA of the full daemon (mic -> codex -> read-back -> injection) with permissions granted. STT, brain, and injection paths are each verified individually; the composed live loop still wants a human ear.
