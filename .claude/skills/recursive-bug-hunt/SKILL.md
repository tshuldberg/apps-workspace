---
name: recursive-bug-hunt
description: Universal recursive bug-investigation prompt for spawning Fable agents against a bug or page. Each agent inherits a chain file with merged lessons, fixes with root cause, verifies with gates and live testing, and writes the next chain file so the prompt compounds across sessions. Use when asked to "hunt this bug", "recursive bug hunt", "start a bug chain", "spawn a fable agent on this bug", or when orchestrating sequential page-by-page hardening sweeps.
---

# Recursive Bug Hunt

A self-compounding investigation prompt. Copy the template below into a Fable agent (or paste it directly into a new Claude Code session), fill the three placeholders, and go. Every run ends by writing the next numbered chain file with merged learnings, so each successive agent starts smarter.

## How to use

1. Pick the chain directory: `<app>/docs/prompts/`. If a chain exists, the newest `PROMPT-0NN-<area>.md` is the agent's inherited briefing; if not, this template bootstraps `PROMPT-001-<area>.md`.
2. Fill placeholders: `{BUG}` (symptom + repro, or the page/flow to sweep), `{SCOPE}` (files/routes the agent may touch), `{CHAIN_DIR}` (e.g. `apps/meerkat/docs/prompts`).
3. Spawn a Fable 5 agent with the filled template. After it reports, verify its claims against the gates yourself before trusting them, then spawn a Fable review agent on the exact diff.
4. Orchestrator maintenance: after each agent returns, fold any new GENERALIZABLE lesson into the Learnings section below (merge and deduplicate; keep the section under ~15 bullets; project-specific detail stays in the chain files, not here).

## The universal prompt template

```
You are a Fable 5 investigation agent. Repo root: <fill>. Read the project's
AGENTS.md/CLAUDE.md first and honor every rule (honesty boundaries, parity
twins, writing style). Then read your inherited briefing: the newest
PROMPT-0NN-*.md in {CHAIN_DIR} (skip if none exists yet; you are bootstrapping
the chain).

TARGET: {BUG}
SCOPE (files/routes you may modify): {SCOPE}

METHOD:
1. Root cause before any fix. Reproduce the failure path in code (and live,
   see 4) and name the exact mechanism with file:line evidence.
2. Fix everything you confirm, completely, on every surface that has a twin.
   Then SWEEP ADJACENT: other components, blocks, and sections of the same
   page or flow, hunting the same bug class and the classes in Learnings.
3. Add or extend unit tests for every behavioral fix. Extract screen logic
   into pure testable cores when needed. A source-lock test must actually
   fail when the fix is reverted.
4. LIVE-TEST interactions that unit tests cannot catch: web via the browser
   MCP tools (start the dev server yourself in background, open a NEW tab,
   click every button, watch the console; never trigger alert/confirm);
   mobile via the iOS Simulator (check port 8081 for a foreign Metro first).
   Report live-verified vs test-only.
5. VERIFY: run the project's full gate set (typecheck + tests on every
   affected surface, parity/consistency scripts, function gates). All green
   before you finish. Fix any diagnostics you introduced.
6. Do not run git commit/branch/merge/checkout unless the orchestrator says
   so. Never touch files outside SCOPE; never revert other uncommitted work.

DELIVERABLE - continue the chain: write {CHAIN_DIR}/PROMPT-0NN-<area>.md
(next number) with exactly five sections:
  1. Issue report: each issue, symptom, root cause, file:line evidence.
  2. Resolution report: changes, verification commands + results, and
     anything found-but-not-fixed as stranger-readable action steps.
  3. Lessons learned: MERGED with all prior chain lessons, deduplicated,
     generalized. This section compounds; keep it tight.
  4. Next session briefing: how to attack the next bug, plus the standing
     instruction to sweep adjacent components before finishing.
  5. Recursive prompt clause (copy verbatim into every successor):
     "Every session consuming this prompt MUST end by writing the next file
     in this chain (PROMPT-0NN-<area>.md, incrementing NN) with this same
     five-section structure, carrying forward all prior lessons merged and
     deduplicated, not appended verbatim, so the prompt compounds in
     usefulness while staying short. Copy this clause into the new file
     unchanged."

FINAL OUTPUT (data for the orchestrator, not user-facing): issues found with
root causes, fixes with file paths, all changed files, verification results,
action items you could not fix from code, and the chain-file path.
```

## The orchestrator prompt (paste into a new session to run a full sequential sweep of any app)

```
Orchestrate a sequential, recursive hardening sweep of this app using Fable 5
agents. You are the orchestrator: you manage prompts, agents, and verification;
agents do the work. Follow the workspace skill at
Apps/.claude/skills/recursive-bug-hunt/SKILL.md (load it if available; its
Learnings section and per-agent template are the base for every agent prompt).

SETUP
1. Read this app's AGENTS.md/CLAUDE.md and enumerate every page, route, and
   expected user path in its interfaces. Group them into 5-10 sequential work
   sets, ordered by user impact, and add one final set that exercises CREATING
   new content/entities varied across every option the app offers. Track sets
   as tasks.
2. Chain files live at <app>/docs/prompts/PROMPT-0NN-<area>.md. If a chain
   exists, the newest file is the first agent's inherited briefing; otherwise
   agent 1 bootstraps PROMPT-001.

PER SET, STRICTLY SEQUENTIAL (never two agents at once)
3. Spawn ONE Fable 5 fix agent from the skill's template: it reads the newest
   chain file, sweeps its pages plus adjacent components, root-causes before
   fixing, fixes completely on every surface with a twin, adds tests that fail
   on revert, live-tests (browser MCP for web, simulator where drivable; one
   agent owns the browser at a time; stub unreachable backends with throwaway
   local servers), runs the app's full gate set, and writes the next chain
   file with lessons merged and deduplicated plus the verbatim recursive
   clause.
4. When it reports, VERIFY YOURSELF before trusting it: re-run the gates,
   diff the working tree against your pre-set snapshot, confirm the changed
   files match its claims. Editor diagnostics can be stale in both directions;
   gates are truth.
5. Then spawn ONE Fable 5 review agent on exactly that set's diff:
   adversarial, correctness-first; every finding gets a concrete failure
   scenario and a CONFIRMED or REFUTED status; it fixes what it confirms,
   re-runs all gates, and folds its findings into the same chain file.
   Verify its gates yourself too, then close the set and start the next.

STANDING RULES
6. Out-of-scope bugs an agent finds get routed to the matching set's task and
   logged, never fixed out of order and never dropped.
7. After each agent returns, fold any generalizable lesson into the skill's
   Learnings section (merge, dedupe, cap ~15 bullets); app-specific detail
   stays in the chain files.
8. No git commits unless I say so; work accumulates in the tree, sets stay
   separable via your snapshots. Update the repo's memory/error logs per its
   own rules as sets close.
9. Report to me at each set boundary: what was found, root causes, what was
   live-verified vs test-only, and anything only I can do (device checks,
   store consoles, credentials).

Begin with setup now, then run the sets without waiting for me.
```

## Learnings (maintained by the orchestrator; keep under ~15 bullets)

- Modal and navigation authority: an RN Modal unmounted (not hidden) while navigation fires in the same React commit leaves a stuck invisible touch-swallowing window on iOS; same class for closing one modal while presenting another, conditionally-mounted visible modals, synchronous store listeners that swap a navigator mid-tap, and a provider method that pushes a route before its first await. One navigation/presentation authority only: keep modals mounted with a visible toggle, queue the next action as pending state flushed from Modal onDismiss (iOS-only) or a platform-gated visibility effect (Android unmounts children the instant visible flips), keep the queue in a component that outlives the modal, and return from a catch so a sheet closes only on success (an alert fired in the closing commit is torn down with it).
- Every async tap handler needs try/catch, a REF re-entry guard taken before the first await (state is not applied before tap 2; guard-after-probe is no guard), and busy state keyed by row id cleared in a finally that encloses the whole sequence. try/finally without catch makes a thrown promise a dead tap; a dropped result union is a silent dead tap. Batch loops need per-item catches, and an error must render in the pane the user is viewing, never behind an open sheet or in a hidden tab. Stale async results are gates for the wrong input: sequence-guard probes so an in-flight result cannot mark the NEW value healthy off the OLD value's check, and auto-close timers must close only their own target.
- Expo build traps: EXPO_PUBLIC_* env vars inline only as literal process.env.NAME member expressions (captured process.env, optional chaining, globalThis all yield undefined in release while dev and tests pass); a source-lock must scan every bundled directory and extension. A redbox naming code not in the app means a foreign Metro owns port 8081.
- Affordance and copy derive from ONE pure rule: never render an enabled action beside copy saying it is unavailable, hide or disable actions that can only fail in the current state, never let an advisory notice hide a live alternative, and give notice components a tone prop (a green dot on a blocker reads as OK).
- Success copy ("Copied", "Sent", "Connected") only after the real operation resolves; "Sent" and "delivered" states come only from real protocol rows, never from an uncaught call or optimistic chip.
- Navigation and selection defaults must repair stale state: router.back() needs a canGoBack() fallback route (deep-linked or gate-replaced screens can be the only route), and default-selection effects must replace deleted targets, not just fill null.
- One rule function for every sibling site and twin: when a rule is enforced in five places and skipped in two, the two are the bug; a repair applied to one of N siblings (one of two entry points, four of five capped screens, one of three store implementations) is still the bug. Grep every consumer of the shared concept, extract the rule into one pure function, convert every sibling in the same pass, and leave a source lock listing the files that must use it. Shared twin logic (mobile + web, memory + file + Postgres) must call the one function; inline re-implementations drift. An allowlist registry that names what IS gated leaves every unlisted table, route, or handler open: invert to fail-closed (everything in the class is gated unless explicitly listed as safe with a reason) and add a guard test that enumerates the real set (created tables, mounted routes, registered handlers) against the registry.
- Trust gates, not agent claims or editor diagnostics: re-run typecheck/tests/parity yourself after every agent (stale LSP output both misses real errors and reports fixed ones). A test that cannot fail is not a test: revert each fix and watch it go red for the RIGHT reason (locks passing on guards in the wrong order, regex windows reaching into a neighbouring block, absence assertions matching the removal comment, a lock red for a mechanism the fix does not use). Layered defenses need one test per layer whose fixture disables the other layers, or the revert check proves nothing about that layer. Edits to a verification gate get the highest scrutiny: break the guarded code in both directions and watch the gate go red. For server-side authorization fixes, a PoC run before (red) and after (green), pasted verbatim, is the live evidence. A source lock that asserts a COMMENT exists (or pins an identifier that a refactor renames) guards nothing: pin the mechanism, and scan the suite for comment-only locks as a standing check. When you inherit unverified work from a dead agent, revert-check its load-bearing tests yourself and say which you did not.
- Distinguish "still checking", "cannot verify" (surface the error plus a real retry, never "reopen this screen"), "verified negative", and "answered earlier, now stale"; collapsing any two produces contradictory claims on one screen, and a failed read must reach the CONTROLS too (operable defaults over a suppressed error ship the lie plus a write path that persists it). One failure flag over several sequential reads must mean nothing was updated: read into locals, commit together.
- Numeric trust boundaries: a stored magnitude without a unit tag is a latent 2.2x error; grid-rounding converters must be identity when from equals to (test off-grid values); domain clamps belong at PERSISTENCE, not only display; parsing must never let a fallback or a negative silently replace what the user typed.
- A read-only or archived state must gate EVERY write path (reactions, quick-reacts, edits, deletes, joins, pickers, drag-drop, paste), not just composers; content stays visible and device-local actions (copy, report) keep working.
- Persistent-store hazards: mint-on-first-use keys need a cross-context lock (StrictMode double-mount and second tabs race first boot); a persist catch that retries without backoff is a silent hot loop of memory-only writes; cache the boot PROMISE, not the resolved value; snapshot pending-write sets per round and restore on failure; stamp vaults with their key id so a mismatch is a typed state with an honest recovery screen; a cross-context merge must never adopt stored values over PENDING local writes. A memoized resource with a permanent destroy (engine, socket, signaling client) must be owned by ONE hook that creates a fresh instance per dependency change and destroys only what it stops owning; an effect that destroys in cleanup and re-runs against the same memoized instance is a dead resource after the first flip (test the lifecycle with a fake instance under unlock flip, rename, and StrictMode). A store that writes one encoding and reads another (base64 text vs raw bytes) is a silent data-loss bug that only backup or range reads expose: round-trip put/get/size/readRange in one test.
- Server authorization binds to the RECORD ON FILE, never to attacker-supplied data: a self-consistent signed document proves only that its signer signed it, so every "is the caller the owner" check compares the submitted identity to the identity the store already holds, and the submitted document is trusted only on a genuine cold start (no state AND no ledger row). The same class on the client: a message handler must bind the SENDER to the mailbox or thread it arrived in (paired set, participant set, derived 1:1 id) before any handler runs, and every AUTHOR to the roster, not just verify a signature. When a verifier accepts aliases (case, whitespace, junk digits) that string-compared roster, revocation, or pin lookups do not, canonicalize the identifier once at every parse boundary and reject non-canonical input. A negotiated protocol upgrade with a legacy fallback is only half shipped: write the retirement step (refuse the old version once every build speaks the new one) into the resolution report. Continuity invariants ("one id, one owner for life") persist in the durable ledger beside the revision, not only in mutable state, so a restart or wiped state store still enforces them; legacy rows are tolerated and backfilled. Any schema column added for this is a migrate-first deploy step written into the resolution report.
- Cache and store key spaces must be owner-controlled and bounded anyway: a negative cache keyed by reader input is a memory-growth primitive. Validate the key against the owner-declared scope before any work (never cache an out-of-scope key), bound identifier length at the HTTP edge before limiter, session, or store, and still cap every dimension with an LRU. Bounds are per sibling entry point (a cap on publish and not on register is the bug). A WebView with an empty originWhitelist hands every unmatched URL to the OS browser before your handler runs: whitelist everything and gate in onShouldStartLoadWithRequest, and strip meta refresh, base, and form tags plus unquoted URL attributes in the sanitizer.
- Live-testing: only ONE agent drives the shared Chrome at a time (concurrent agents reset each other's pages); stub an unreachable backend with a throwaway local server so the real client flow can run; kill the servers when done; macOS has no `timeout` binary, so bound PoC scripts with the runner's own timeouts.
