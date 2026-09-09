# Apps workspace

- Each project owns its code and git workflow. Keep changes within the requested project scope.
- Exclude `/Users/trey/Desktop/Apps/SH/shiphawk-dev` unless the user explicitly requests work there.
- Do not create staging/copy directories at Apps root. Use a temporary directory or a git worktree at `../Apps-wt-[name]`; new Apps directories must be real projects/groups.
- Preserve unrelated edits and sessions. Run only task-owned processes and stop only processes you started.
- AGENTS.md is the shared instruction source. CLAUDE.md imports it; do not duplicate shared rules. Add a child instruction file only for constraints unique to that subtree.
- Keep instruction files limited to durable constraints and non-obvious validation. Put setup, architecture explanations, and history in existing project docs.
- When executing a queued plan, follow `docs/guides/parallel-agent-orchestration.md`; do not apply plan-queue ceremony to unrelated tasks.
- For shared sweeping/holiday changes, check both `Parks/EasyStreet` and `Parks/easystreet-monorepo`.
- Use plain, concise writing without em dashes. For unfamiliar human procedures, give exact locations, control labels, actions, and a verifiable result.

- Follow the core shared-machine memory policy in `/Users/trey/.codex/AGENTS.md` for all editor, build, render, and other heavy work.
