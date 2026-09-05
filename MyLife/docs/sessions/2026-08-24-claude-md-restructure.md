# 2026-08-24: Instruction-file restructure to current CLAUDE.md best practices

## What was done

Reviewed the full CLAUDE.md stack against Anthropic's current guidance (code.claude.com/docs/en/memory): target under 200 lines per file, path-scoped `.claude/rules/`, `@AGENTS.md` import instead of manual dual-file sync, trim code-derivable content, hooks over prose for enforcement.

Findings that drove the change:

- A meerkat session loaded ~1,250 lines / ~79 KB across 5 stacked CLAUDE.md files (global 25, Desktop 50, Apps 120, MyLife 636, meerkat 423).
- The manual AGENTS.md sync rule had already failed: MyLife CLAUDE.md (636 lines) vs AGENTS.md (279 lines, older divergent content); Apps pair differed by 247 lines. The meerkat pair was a hand-maintained verbatim copy.
- Big duplicated blocks (Writing Style, Code Intelligence/LSP, Report Artifacts) appeared 3-4 times across the stack.

## Changes

- **New mechanism (all levels):** `AGENTS.md` is canonical; `CLAUDE.md` = `@AGENTS.md` import + Claude-only extras. The manual "keep both in sync" rules were removed; drift is now structurally impossible.
- **MyLife:** merged both files into a ~146-line canonical `AGENTS.md`; `CLAUDE.md` is a ~50-line import stub carrying Claude-only content (gstack gate routing, MDD rules, Agent Teams + ownership zones, Open Brain protocol). New path-scoped `.claude/rules/`: `mesh-sync.md`, `design-system.md` (Obsidian Noir tokens), `module-system.md` (ModuleDefinition, prefixes, tiers, consolidation workflow). Cut: architecture tree, ModuleDefinition interface snippet, verbatim token tables (all code-derivable per /doctor trim guidance).
- **Meerkat:** 423-line duplicate pair became one ~121-line (wc) canonical `AGENTS.md` + 1-line CLAUDE.md import. Every transport-honesty, Plan 51, Plan 38, and public-layer rule preserved; cut the directory tree, per-symbol export enumerations, palette value table (tokens.ts is source of truth), and plan-chronology framing.
- **Apps:** merged the divergent pair into one canonical `AGENTS.md` (~113 lines; plan-queue protocol condensed to pointers at `docs/guides/parallel-agent-orchestration.md`); CLAUDE.md stub holds interaction style + agent teams.
- **Desktop CLAUDE.md:** removed the duplicated LSP block (now single-homed in Apps AGENTS.md), updated the sync-rule wording to the import mechanism, removed the stale claim that macos-hub provides live MCP tools (retired 2026-03-23).
- **Global ~/.claude/CLAUDE.md:** unchanged (25 lines, already conformant).

Result: a meerkat session now loads roughly 380 lines of instruction content plus on-demand rules, down from ~1,250, with zero rule-content loss on Critical sections.

## Verification

- `node scripts/check-meerkat-parity.mjs`: the two instruction-file existence checks pass. One pre-existing FAIL (`person-identity-core.ts` mobile/web drift) belongs to the concurrent `fix/meerkat-bug-audit-2026-08-24` session's uncommitted work, not this change (markdown-only diff).
- Em-dash lint on all new files: clean.
- No function logic changed; `pnpm gate:function:changed` skipped on that basis.

## Concurrent-session handling

Mid-session the shared checkout switched to `fix/meerkat-bug-audit-2026-08-24` with ~35 dirty source files (active Codex bug audit). Per the standing worktree rule, the instruction files in the shared checkout were restored to HEAD via `git show` (no destructive git commands) and this work was committed from the `claude-md-restructure` worktree on `main` instead.

## Remaining items

- The other levels' non-repo files (Desktop, global) have no git history; changes applied in place.
- Apps-repo commit for the Apps pair is separate (Apps is its own repository).
- Optional follow-up: point `.codex` tooling docs at the new canonical-AGENTS.md convention if any script hard-codes the old sync rule.
