# MyTalk Implementation Plan

> **For agentic workers:** Execute tasks in order. TDD where the module is pure logic. Zero runtime npm dependencies. Node 22, ESM, NodeNext resolution: **all relative imports in src must end in `.js`**. Strict TypeScript, no `any`.

**Goal:** Ship the `talk` daemon described in `docs/spec.md`.

**Architecture:** Event-driven orchestrator (`daemon.ts`) wiring five effectful edges (ear, watcher, speaker, injector, codex) around pure policy modules (parser, narrator, turntaking, prompts, schema, config). Every effectful edge takes injectable spawn/fs functions so tests never touch mic, network, or osascript.

**Tech stack:** Node 22 + TypeScript 5.7 (ESM, NodeNext), Vitest 3, Swift 6 single-file helper, macOS `say`, `osascript`, optional `tmux`.

---

## Shared types (`src/types.ts`)

```ts
export type SessionEvent =
  | { kind: 'assistant-text'; text: string }
  | { kind: 'tool-use'; name: string; summary: string }
  | { kind: 'question'; text: string; options: string[] }
  | { kind: 'user-text'; text: string }
  | { kind: 'turn-end' };

export type BrainAction = 'chat' | 'prompt' | 'none';
export interface BrainResult { speak: string | null; action: BrainAction; prompt: string | null; }

export type TurnTakingMode = 'hands-free' | 'push-to-talk' | 'confirm-word';
export type NarrationMode = 'milestones' | 'turn-end' | 'play-by-play';
export type VerificationMode = 'read-back' | 'instant' | 'explicit';

export type EarEvent =
  | { type: 'ready' }
  | { type: 'partial'; text: string }
  | { type: 'final'; text: string }
  | { type: 'ptt'; state: 'down' | 'up' }
  | { type: 'status'; message: string }
  | { type: 'error'; message: string };

export type ControlCommand =
  | 'cancel' | 'mute' | 'unmute' | 'send' | 'wait'
  | 'status' | 'read-full' | 'help' | null;
```

## Task 1: `src/config.ts` + `src/config.test.ts`

```ts
export interface Settings {
  turnTaking: TurnTakingMode;        // 'hands-free'
  narration: NarrationMode;          // 'milestones'
  verification: VerificationMode;    // 'read-back'
  voice: string;                     // 'Samantha'
  rate: number;                      // 180
  silenceMs: number;                 // 1500
  readBackGraceMs: number;           // 3000
  turnEndQuietMs: number;            // 2000
  sendWords: string[];               // ['send it', 'go ahead']
  cancelWords: string[];             // ['scratch that', 'cancel that', 'never mind']
  waitWords: string[];               // ['wait', 'hold on']
  muteWords: string[];               // ['stop listening']
  unmuteWords: string[];             // ['start listening']
  statusWords: string[];             // ["what's happening", 'status report']
  readFullWords: string[];           // ['read it in full', 'read the whole thing']
  terminalApp: string;               // 'Terminal'
  injector: 'osascript' | 'tmux';    // 'osascript'
  tmuxTarget: string | null;         // null
  codexModel: string | null;         // null = codex default
  codexTimeoutMs: number;            // 90000
  pttKey: 'rightOption' | 'rightCommand' | 'f13'; // 'rightOption'
  locale: string;                    // 'en-US'
}
export const DEFAULT_SETTINGS: Settings;
export function settingsPath(env?: NodeJS.ProcessEnv): string; // $XDG_CONFIG_HOME or ~/.config, + /mylife-talk/settings.json
export function loadSettings(readFile: (p: string) => string): Settings; // merge file over defaults; unknown keys dropped; wrong-typed values fall back to default; missing/corrupt file -> defaults
export function saveSettings(s: Settings, writeFile: (p: string, c: string) => void): void; // mkdir handled by caller in cli
```

Tests: defaults returned on missing file; partial file merges; corrupt JSON falls back; wrong-typed value (e.g. `rate: "fast"`) falls back per-key; unknown key dropped; round-trip save/load.

## Task 2: `src/transcript/locate.ts` + test

```ts
export function projectSlug(projectDir: string): string; // absolute path, strip trailing slash, replace every char not [A-Za-z0-9] with '-'  => '/Users/trey/Desktop/Apps/MyLife' -> '-Users-trey-Desktop-Apps-MyLife'
export function transcriptDirFor(projectDir: string, home: string): string; // `${home}/.claude/projects/${projectSlug(projectDir)}`
export function newestTranscript(dir: string, fsi: { readdirSync(p: string): string[]; statSync(p: string): { mtimeMs: number } }): string | null; // newest *.jsonl by mtime, null if none/dir missing (catch)
```

Tests: slug matches the verified real example above; dot and underscore chars become '-'; newest picked by mtime; missing dir -> null.

## Task 3: `src/transcript/parser.ts` + test

```ts
export function parseTranscriptLine(line: string): SessionEvent[]; // [] for anything irrelevant
```

Rules (verified against live format, see spec):
- Malformed JSON, `isSidechain === true`, `isMeta === true`, unknown `type` -> `[]`.
- `type === 'user'` with **string** `message.content` -> `[{ kind: 'user-text', text }]`. Array content -> `[]`.
- `type === 'assistant'`: walk `message.content` array. `text` blocks (non-empty after trim) -> `assistant-text`. `tool_use` blocks -> `tool-use` with `summary` built as:
  - `Bash` -> `input.description ?? first 80 chars of input.command`
  - `Read`/`Write`/`Edit` -> basename of `input.file_path`
  - `Agent` -> `input.description`
  - `Skill` -> `input.skill`
  - anything else -> `''`
  - `AskUserQuestion` -> instead emit `question` events: one per `input.questions[]`, `text` = question, `options` = option labels.
- After walking content, if `message.stop_reason === 'end_turn'` append `{ kind: 'turn-end' }`.

Tests: one per rule, using realistic fixture lines copied from the spec format section (write them inline in the test file); a torn/partial JSON line; empty text block skipped; AskUserQuestion with 2 questions yields 2 question events; end_turn with text yields text then turn-end.

## Task 4: `src/transcript/watcher.ts` + test

```ts
export interface WatcherIo { statSync(p: string): { size: number; mtimeMs: number }; openSync; readSync; closeSync; } // subset of fs
export class TranscriptWatcher extends EventEmitter {
  constructor(file: string, io: WatcherIo, opts?: { pollMs?: number; fromStart?: boolean });
  start(): void; stop(): void;
  // emits: 'event' (SessionEvent), 'error' (Error)
}
```

Behavior: begin at current EOF (unless `fromStart`), poll every `pollMs` (default 300), read appended bytes, buffer partial trailing line, feed complete lines to `parseTranscriptLine`, emit each event. File truncated (size shrank) -> reset offset to 0. Never throw from the poll loop; emit 'error' once per distinct failure.

Tests: use a real temp file (node:fs, node:os tmpdir) with short pollMs (20 ms) and vi.waitFor: append two lines -> both events; append half a line then the rest -> one event; pre-existing content skipped; truncation reset.

## Task 5: `src/brain/schema.ts` + `src/brain/prompts.ts` + tests

```ts
// schema.ts
export function extractJson(text: string): string | null; // substring from first '{' to matching brace (track depth + strings); null if none balanced
export function validateBrainResult(raw: unknown): BrainResult | null; // action must be chat|prompt|none; speak/prompt string|null (missing -> null); action 'prompt' with empty/absent prompt -> null (invalid)
```

```ts
// prompts.ts
export interface BrainTurn { who: 'founder' | 'copilot'; text: string }
export interface BrainContext {
  utterance?: string;            // what the founder just said
  sessionEvents: string[];       // rendered recent events, oldest first
  history: BrainTurn[];          // rolling copilot conversation, max 20
  task: 'route-utterance' | 'narrate-milestone' | 'summarize-turn' | 'read-full';
  fullText?: string;             // for read-full / summarize-turn: Claude's message text
}
export function renderEvent(e: SessionEvent): string; // 'CLAUDE: <text>' | 'TOOL Bash: pnpm test' | 'QUESTION: ... OPTIONS: a | b' | 'FOUNDER-TYPED: ...' | 'TURN END'
export function buildBrainPrompt(ctx: BrainContext): string;
```

`buildBrainPrompt` must produce a single self-contained prompt containing: (1) role preamble — you are MyTalk, the spoken-voice copilot for a founder pair-programming with Claude Code; your `speak` text is read aloud by TTS, so keep it conversational, under ~60 words for narration, no markdown, no code blocks, say file names plainly; (2) strict output contract — reply with ONLY a JSON object `{"speak": string|null, "action": "chat"|"prompt"|"none", "prompt": string|null}`; action rules: `prompt` only when the founder is giving Claude work or answering Claude's question — then `prompt` is the exact text to type into the Claude terminal (single line, no quotes-wrapping); `chat` when answering the founder aloud; `none` when nothing needs saying; (3) task-specific instruction block per `ctx.task`; (4) recent session events; (5) rolling history; (6) the utterance.

Tests: extractJson on clean JSON, JSON inside prose, nested braces, brace inside string, unbalanced -> null; validate rejects bad action / prompt-action without prompt; accepts minimal `{action:'none'}` -> speak/prompt null; renderEvent for each kind; buildBrainPrompt contains contract line, utterance, and last event for each task type.

## Task 6: `src/brain/codex.ts` + test

```ts
export interface CodexRunner { (args: string[], input: string, timeoutMs: number): Promise<{ stdout: string; code: number | null }> } // default impl wraps child_process.execFile('codex', args, ...) with prompt passed as last positional arg after 'exec' subcommand flags; kill on timeout
export class CodexBrain {
  constructor(settings: Settings, run?: CodexRunner);
  available(): Promise<boolean>;   // `codex --version` succeeds, cached 5 min
  ask(ctx: BrainContext): Promise<BrainResult | null>; // build prompt; run `codex exec -s read-only --skip-git-repo-check [-m model] <prompt>`; extractJson+validate stdout; on null: one retry with '\nReply with ONLY the JSON object.' appended; still bad or nonzero code or timeout -> null
}
```

Tests with a stubbed runner: happy path parses; noisy stdout around JSON parses; first-bad-then-good retries exactly once; timeout -> null; model flag present only when set; `-s read-only` always present.

## Task 7: `src/turntaking.ts` + test

```ts
export function detectControl(text: string, s: Settings): ControlCommand; // case-insensitive, trims trailing punctuation; the utterance must EQUAL a control phrase or START with it followed by nothing else meaningful (<=2 extra chars); otherwise null
export type DaemonPhase = 'listening' | 'muted' | 'awaiting-send' | 'read-back';
export interface PendingPrompt { prompt: string; spokenBack: boolean }
export class TurnTaking extends EventEmitter {
  constructor(s: Settings, now?: () => number);
  // inputs
  onFinalUtterance(text: string): void;
  onPtt(state: 'down' | 'up'): void;
  onBrainPrompt(prompt: string): void;   // brain wants to send this to Claude
  tick(): void;                          // called every 250ms by daemon for grace timing
  // emits:
  //  'route' (text)          -> send this utterance to the brain
  //  'inject' (prompt)       -> type into terminal now
  //  'speak' (text)          -> TTS ('Sending: ...', 'Cancelled.', 'Muted.', ...)
  //  'control' (ControlCommand) -> status / read-full / help handled by daemon
  //  'mute-ear' / 'unmute-ear'
}
```

Behavior matrix (test each):
- muted: only `unmute` control is honored; everything else dropped.
- hands-free: final utterance -> control check -> control handled locally; else emit 'route'.
- confirm-word: utterance buffered (appended with spaces); send word -> emit 'route' with buffer, clear; cancel clears buffer + speak 'Cancelled.'
- push-to-talk: utterances only routed between ptt down/up capture (ear enforces capture; TurnTaking just routes finals; cancel still works).
- onBrainPrompt per verification mode: instant -> 'inject' + speak 'Sent.'; read-back -> speak `Sending: <prompt>` then after readBackGraceMs of ticks -> 'inject' (wait word pauses indefinitely until send/cancel; cancel drops it); explicit -> speak read-back + 'Say send it when ready.', inject only on send word; cancel drops.
- while a pending prompt exists, a NEW final utterance that is not a control word replaces nothing: it is routed normally (founder may be answering codex), pending prompt stays.

## Task 8: `src/narrator.ts` + test

```ts
export type NarrationDecision = { type: 'silent' } | { type: 'milestone'; text: string } | { type: 'question'; text: string } | { type: 'turn-summary' };
export class Narrator {
  constructor(mode: NarrationMode);
  decide(e: SessionEvent): NarrationDecision;
}
```

Rules: `question` -> always `{type:'question', text: question + ' Options: ' + options.join(', ')}`. `turn-end` -> `turn-summary` in every mode. `tool-use`: play-by-play -> milestone with rendered summary; milestones -> milestone only for the FIRST tool-use after a turn-end/user-text (reset on turn-end), else silent; turn-end mode -> silent. `assistant-text`: silent in all modes (its content reaches the founder via turn summary), but store it: `lastAssistantText(): string` getter accumulating current turn's text (reset on turn-end after read).

Tests: each mode x event matrix; first-tool-only logic resets after turn-end; question formatting.

## Task 9: `src/speech/speaker.ts` + `src/speech/ear.ts` + tests

```ts
// speaker.ts
export interface SpawnLike { (cmd: string, args: string[]): { on(ev: 'exit', cb: () => void): void; kill(): void } }
export class Speaker {
  constructor(s: Settings, spawn?: SpawnLike);
  say(text: string, opts?: { interrupt?: boolean }): void; // queue; interrupt kills current + clears queue first
  stop(): void;
  get speaking(): boolean;
  // emits 'speaking-start' / 'speaking-end'
}
```
Sanitize text before `say`: strip backticks/asterisks/underscores, collapse whitespace, cap at 1200 chars (append ' ...truncated'). Args: `['-v', voice, '-r', String(rate), text]`.

```ts
// ear.ts
export class Ear extends EventEmitter {
  constructor(s: Settings, binPath: string, spawn?: typeof child_process.spawn);
  start(): void; stop(): void; mute(): void; unmute(): void; // mute/unmute write 'mute\n'/'unmute\n' to child stdin
  // parses child stdout JSONL -> emits typed EarEvent per line; malformed lines ignored
  // child exit while running -> restart, max 3 in 60s, then emit 'error'
}
```
Ear child args: `['--silence-ms', String(s.silenceMs), '--locale', s.locale]` plus `['--ptt-key', s.pttKey]` when turnTaking is push-to-talk.

Tests: speaker queues sequentially (fake spawn resolving exits), interrupt clears, sanitize cases; ear parses events from a scripted fake child (PassThrough stdout), restart cap, mute writes to stdin.

## Task 10: `src/inject/osascript.ts` + `src/inject/tmux.ts` + tests

```ts
// osascript.ts
export function buildInjectScript(text: string, app: string): string; // sanitize: newlines->space, collapse spaces, escape \ and " for AppleScript; script: activate app, delay 0.2, keystroke text, delay 0.15, key code 36
export async function injectViaOsascript(text: string, app: string, exec?: ExecFileLike): Promise<void>; // throws Error with accessibility guidance ('System Settings > Privacy & Security > Accessibility') when osascript exits nonzero with '1002' or 'not allowed' in stderr
// tmux.ts
export function tmuxArgs(text: string, target: string): string[]; // ['send-keys','-t',target,'-l',text] then caller sends Enter separately: second call ['send-keys','-t',target,'Enter']
export async function injectViaTmux(text: string, target: string, exec?: ExecFileLike): Promise<void>;
```

Tests: escaping quotes/backslashes/newlines; script contains key code 36 exactly once; tmux uses literal `-l` flag; error mapping.

## Task 11: `src/ui.ts` + test

```ts
export type UiState = { phase: string; detail?: string };
export class Ui {
  constructor(out?: { write(s: string): void });
  log(line: string): void;      // prints line above the sticky status line
  status(s: UiState): void;     // re-renders single sticky line: '  🎤 listening — MyLife session' etc.
}
```
Icons: listening 🎤, muted ⏸, speaking 🔊, thinking ⚙, read-back 📨, error ✖. Test: status rewrite uses \r and clears previous width; log reprints status after the line.

## Task 12: `src/daemon.ts` + `src/cli.ts` (integration wiring)

`Daemon` class takes `{ settings, ear, speaker, watcher, brain, injector, narrator, turnTaking, ui, log }` (all injectable) and wires:
- ear final -> turnTaking.onFinalUtterance; ear ptt -> onPtt; ear error -> ui + speaker.
- turnTaking 'route' -> brain.ask({task:'route-utterance', ...}) with rolling history + last 12 rendered session events; result null -> **fallback verbatim**: speak 'Codex is unreachable; sending your words as spoken.' then inject raw utterance; action chat -> speak; action prompt -> turnTaking.onBrainPrompt; action none -> nothing.
- turnTaking 'inject' -> injector; failures spoken with guidance.
- watcher 'event' -> narrator.decide: question -> speak immediately (interrupt: true); milestone -> brain narrate (fallback: speak rendered summary directly); turn-summary -> brain summarize with `fullText = narrator.lastAssistantText()` (fallback: speak first 200 chars of the text verbatim).
- control 'status' -> brain chat about current state (fallback: speak phase + last event); 'read-full' -> speak lastAssistantText in full; 'help' -> speak the control-word list.
- barge-in: ear 'partial' while speaker.speaking -> speaker.stop().
- maintains rolling BrainTurn history (founder utterances + spoken copilot replies, cap 20) and rendered event ring (cap 40).
- 250 ms interval calling turnTaking.tick().

`cli.ts`: parse argv: `talk` / `talk start [--project <dir>] [--transcript <file>]` -> resolve transcript (locate or flag; if none found, print + exit 1 with slug dir named), construct real edges, print banner, run until SIGINT (clean shutdown: ear.stop, speaker.stop, watcher.stop). `talk settings` -> numbered readline menu over every Settings key with current values, enter number -> prompt new value (validated), saves. `talk doctor` -> checks: codex on PATH + `codex --version`; talk-ear binary built; transcript dir found for cwd; tmux present when configured; prints ✅/✖ lines with fix hints (mic + accessibility can only be verified live, print how to grant). Exit code 0 only if hard requirements pass.

No unit tests for cli/daemon internals beyond a smoke test: `src/daemon.test.ts` builds a Daemon with all-fake edges, replays scripted ear finals + watcher events, asserts injected prompts and spoken lines (this is the system-level test of the whole loop, including verbatim fallback when brain returns null).

## Task 13 (Fable): `swift/talk-ear.swift` + `scripts/build-ear.sh`

Single-file Swift 6 CLI. Args: `--silence-ms N --locale en-US [--ptt-key rightOption|rightCommand|f13] [--fixture path]`. Emits JSONL on stdout per the EarEvent contract. On-device SFSpeechRecognizer, AVAudioEngine with voice-processing IO (echo cancellation), silence-based segmentation with in-Swift restart, stdin mute/unmute, CGEventTap for the PTT key, fixture mode replaying `partial:`/`final:`/`sleep:` scripted lines. Build: `swiftc -O -o bin/talk-ear swift/talk-ear.swift`.

## Task 14: Verify + ship

- `pnpm install`, `pnpm test`, `pnpm typecheck` all green.
- `bash scripts/build-ear.sh` builds; `talk doctor` runs.
- README.md, CLAUDE.md, PROJECT_LOG.md.
- Conventional commit(s) to the Apps repo.
