# Plan: MyLife Hooks & Automation

<!-- superpowers:executing-plans -->

## Metadata

```yaml
project: MyLife (hub)
priority: 02
effort: M
dependencies: []
worktree: false
parallel_phases: false
created: 2026-03-08
audit_ref: docs/reports/REPORT-production-readiness-audit-2026-03-08.md
findings: C2, C3, C7, H5, H6, H7, M18
```

## Objective

Build out the Claude Code hooks layer that the audit found almost entirely missing. Currently only one hook exists (TaskCompleted for parity checks). This plan adds PreToolUse validation to prevent agents from touching off-limits paths, PostToolUse type checking after edits, console.log/credential detection, session persistence on Stop, state preservation on PreCompact, and husky pre-commit hooks for git-level enforcement.

## Scope

### Files Affected

- `.claude/settings.json` -- add PreToolUse, PostToolUse, Stop, PreCompact hooks; extend TaskCompleted (C2, C3, H5, H6, H7, M18)
- `package.json` -- add husky dependency and prepare script (C7)
- `.husky/pre-commit` -- new file, pre-commit gate (C7)

### Files NOT Affected

- Module business logic (`modules/*/`)
- App routes (`apps/*/`)
- Database schemas (`packages/db/`)
- Agent definitions (`.claude/agents/`) -- agent scoping is covered in Plan 01

## Phases

### Phase 1: PreToolUse Bash Validation Hook (C2)

This prevents agents from accidentally touching archived code, shiphawk-dev, or sensitive configs.

- [ ] Read current `.claude/settings.json` to understand existing hook structure
- [ ] Add a `PreToolUse` hook entry for the `Bash` tool that:
  1. Rejects commands containing paths to `archive/`, `shiphawk-dev/`, or `SH/`
  2. Rejects commands matching `rm -rf /`, `rm -rf ~`, `rm -rf $HOME`
  3. Rejects `git push --force` (but allows `--force-with-lease`)
  4. Returns exit code 2 with a descriptive message on rejection
  5. Returns exit code 0 (allow) for all other commands
- [ ] The hook command receives the tool input as `$CLAUDE_TOOL_INPUT` (JSON with `command` field)
- [ ] Write the validation as an inline shell script or a separate `.claude/hooks/pre-bash.sh` script
- [ ] Test by verifying the hook blocks `cd archive/MyBooks && rm -rf .` but allows `pnpm test`

**Acceptance:** PreToolUse hook exists and blocks commands targeting archived/off-limits paths. Normal dev commands pass through.

### Phase 2: PostToolUse TypeScript Validation Hook (C3)

After `.ts`/`.tsx` file edits, automatically run a targeted typecheck to catch errors early.

- [ ] Add a `PostToolUse` hook entry for the `Edit` and `Write` tools that:
  1. Extracts the file path from `$CLAUDE_TOOL_INPUT`
  2. Checks if the file ends in `.ts` or `.tsx`
  3. If so, determines the containing package (parse `pnpm-workspace.yaml` packages or use directory structure)
  4. Runs `pnpm --filter <package> exec tsc --noEmit` on that package
  5. Returns exit code 0 regardless (informational, not blocking) -- but outputs any type errors so the agent sees them
- [ ] Keep the hook fast: target only the changed package, not the entire monorepo
- [ ] Set a reasonable timeout (30s) to prevent hanging on large packages

**Acceptance:** After editing a `.ts` file, type errors for that package appear in the tool output. Non-TypeScript file edits skip the check.

### Phase 3: Console.log and Credential Detection (H7)

Privacy-first app should not ship debug logging or hardcoded credentials.

- [ ] Add a `PostToolUse` hook for `Edit` and `Write` tools that:
  1. Extracts the file path from `$CLAUDE_TOOL_INPUT`
  2. Only checks `.ts`/`.tsx`/`.js`/`.jsx` files
  3. Scans the edited file for patterns:
     - `console.log(` (warn, not block)
     - `console.debug(` (warn)
     - `debugger;` (warn)
     - Hardcoded API keys: strings matching `sk-`, `pk_live_`, `pk_test_`, `whsec_` patterns (block with exit code 2)
  4. Outputs a warning message if debug patterns found, but only blocks on credential patterns
- [ ] This hook should run AFTER the PostToolUse typecheck hook (or combine them into one script)
- [ ] The hook should be lightweight -- a simple grep on the single file, not a full repo scan

**Acceptance:** Editing a file that adds `console.log` shows a warning. Adding a string matching `sk-ant-*` blocks the edit.

### Phase 4: Stop Hook for Session Persistence (H5)

Long consolidation sessions should persist context for the next session.

- [ ] Add a `Stop` hook that:
  1. Writes a summary to the memory directory at `/Users/trey/.claude/projects/-Users-trey-Desktop-Apps-MyLife/memory/`
  2. Summary includes:
     - Current git branch and last commit hash (`git rev-parse --short HEAD`)
     - List of modified files (`git diff --name-only`)
     - Any active plans in `docs/plans/active/`
  3. Appends to a `session-log.md` file (creates if not exists)
  4. Keeps the file under 200 lines by trimming old entries
- [ ] Set timeout to 10s -- this should be fast
- [ ] The hook must not fail the session exit (use `|| true` or `exit 0` fallback)

**Acceptance:** After a session ends, the memory directory contains a `session-log.md` with the latest session's git state.

### Phase 5: PreCompact Hook for State Preservation (H6)

When the context window compresses, active plan state and git status should be preserved.

- [ ] Add a `PreCompact` hook that:
  1. Checks if any plans exist in `docs/plans/active/`
  2. Outputs the plan filenames and their current phase (grep for `- [x]` and `- [ ]` counts)
  3. Outputs `git status --short` (truncated to 20 lines)
  4. Outputs the current branch name
  5. This output gets included in the compacted context
- [ ] Keep output concise -- the whole point is to not waste context tokens
- [ ] Set timeout to 5s

**Acceptance:** PreCompact hook exists and outputs plan state + git status when triggered.

### Phase 6: Install Husky Pre-Commit Gate (C7)

Git-level enforcement prevents commits with failing tests/lint.

- [ ] Run `pnpm add -D husky` in the workspace root
- [ ] Run `npx husky init` to create `.husky/` directory
- [ ] Edit `.husky/pre-commit` to run:
  ```bash
  pnpm gate:function:changed
  ```
- [ ] Verify the gate runs on a test commit (stage a file, attempt commit)
- [ ] Ensure the hook doesn't block commits when no source files changed (docs-only commits)
- [ ] Add `.husky/` to git tracking

**Acceptance:** `git commit` on a branch with modified `.ts` files triggers the function quality gate. Commits with failing gates are rejected. Docs-only commits pass through.

### Phase 7: Extend TaskCompleted Hook (M18)

Currently only runs parity check. Should also run typecheck on changed packages.

- [ ] Read the current TaskCompleted hook command in `.claude/settings.json`
- [ ] Extend to also run: `pnpm typecheck` (or a targeted typecheck on changed packages)
- [ ] Keep the existing parity check -- add typecheck as an additional step
- [ ] If typecheck fails, output a clear message and exit with code 2
- [ ] Keep total timeout reasonable (extend to 180s if needed for typecheck)

**Acceptance:** TaskCompleted hook runs both parity check AND typecheck. Tasks cannot be marked complete if either fails.

## Acceptance Criteria

1. PreToolUse hook blocks Bash commands targeting archived/off-limits paths
2. PostToolUse hook runs typecheck after `.ts`/`.tsx` edits
3. PostToolUse hook warns on `console.log`, blocks on hardcoded credentials
4. Stop hook writes session state to memory directory
5. PreCompact hook outputs active plan state and git status
6. Husky pre-commit runs `pnpm gate:function:changed`
7. TaskCompleted hook runs both parity and typecheck
8. All hooks have reasonable timeouts and do not block normal workflow
9. `.claude/settings.json` is valid JSON after all modifications

## Constraints

- Hooks must be fast -- individual hooks should complete in under 30s, total hook chain under 60s
- PostToolUse hooks are informational (warn) by default, not blocking, except for credential detection
- PreToolUse hook must not block legitimate development commands (`pnpm *`, `git *`, `tsc *`, `node *`)
- Stop hook must never fail the session exit -- always exit 0
- Husky pre-commit must not block docs-only or config-only commits
- Do not modify module source code, app routes, or database schemas in this plan
- Keep `.claude/settings.json` well-formatted and valid JSON at all times
