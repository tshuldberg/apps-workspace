# Documentation Research: MyLife Agent Instruction Review

Date: 2026-03-08
Scope: Review and normalize `AGENTS.md` and `CLAUDE.md` guidance across the MyLife workspace, then verify the resulting instruction surface against the live repo state.

## Sources (Official)

- https://docs.anthropic.com/en/docs/claude-code/memory
- https://docs.anthropic.com/en/docs/claude-code/settings

## Local Sources Reviewed

- `/Users/trey/Desktop/Apps/MyLife/AGENTS.md`
- `/Users/trey/Desktop/Apps/MyLife/CLAUDE.md`
- `/Users/trey/Desktop/Apps/MyLife/MyHomes/AGENTS.md`
- `/Users/trey/Desktop/Apps/MyLife/MyHomes/CLAUDE.md`
- `/Users/trey/Desktop/Apps/MyLife/MySurf/AGENTS.md`
- `/Users/trey/Desktop/Apps/MyLife/MySurf/CLAUDE.md`
- `/Users/trey/Desktop/Apps/MyLife/MyVoice/CLAUDE.md`
- `/Users/trey/Desktop/Apps/MyLife/MyWorkouts/CLAUDE.md`
- `/Users/trey/Desktop/Apps/MyLife/modules/car/CLAUDE.md`
- `/Users/trey/Desktop/Apps/MyLife/modules/homes/CLAUDE.md`
- `/Users/trey/Desktop/Apps/MyLife/modules/surf/CLAUDE.md`
- `/Users/trey/Desktop/Apps/MyLife/modules/workouts/CLAUDE.md`
- `/Users/trey/Desktop/Apps/MyLife/packages/module-registry/src/types.ts`
- `/Users/trey/Desktop/Apps/MyLife/packages/module-registry/src/constants.ts`
- `/Users/trey/Desktop/Apps/MyLife/apps/mobile/app/_layout.tsx`
- `/Users/trey/Desktop/Apps/MyLife/apps/web/components/Providers.tsx`

## Findings (Documented Facts)

1. Anthropic documents `./CLAUDE.md` as team-shared project memory and states that Claude Code reads project memories recursively from the working directory upward. Inference: root and nested MyLife `CLAUDE.md` files need to be internally consistent because both can influence a session.
2. Anthropic documents `.claude/settings.json` and `.claude/settings.local.json` as the official project-level configuration mechanism. Inference: startup checklists should point to real settings files, and shared rules such as agent-team enablement or task hooks belong in checked-in docs.
3. The live MyLife repo state no longer matched parts of the root instruction pair. Root docs had drifted on archive status, parity workflow, repo-local skill availability, and module inventory vs actual registry/app wiring.

## Recommendations

1. Keep the root instruction pair aligned on archive status, parity commands, task-complete hooks, and the current registry/app wiring snapshot.
2. Ensure every live standalone workspace with a `CLAUDE.md` also has an `AGENTS.md` when local docs or agents assume an instruction pair exists.
3. Normalize parity wording across standalone and module docs so active standalone apps remain canonical until archived, lightweight hub adapters are not described as parity-complete, and dated boilerplate does not accumulate as pseudo-policy.

## Proposed Instruction Updates

- `/Users/trey/Desktop/Apps/MyLife/AGENTS.md`: restored parity workflow, archive/phase status, repo-local skill note, and parity verification hook details.
- `/Users/trey/Desktop/Apps/MyLife/CLAUDE.md`: updated root architecture and module inventory, restored parity workflow, added hook-backed verification details, and aligned archive/phase status with `AGENTS.md`.
- `/Users/trey/Desktop/Apps/MyLife/MyHomes/AGENTS.md`: added canonical standalone vs partial hub parity rules.
- `/Users/trey/Desktop/Apps/MyLife/MyHomes/CLAUDE.md`: added canonical standalone vs partial hub parity rules.
- `/Users/trey/Desktop/Apps/MyLife/MySurf/AGENTS.md`: added canonical standalone vs partial hub parity rules.
- `/Users/trey/Desktop/Apps/MyLife/MySurf/CLAUDE.md`: added canonical standalone vs partial hub parity rules.
- `/Users/trey/Desktop/Apps/MyLife/MyVoice/AGENTS.md`: created the missing instruction pair file expected by local docs and agents.
- `/Users/trey/Desktop/Apps/MyLife/MyVoice/CLAUDE.md`: added explicit instruction-pair guidance.
- `/Users/trey/Desktop/Apps/MyLife/MyWorkouts/AGENTS.md`: created the missing instruction pair file.
- `/Users/trey/Desktop/Apps/MyLife/MyWorkouts/CLAUDE.md`: added instruction-pair and parity guidance.
- `/Users/trey/Desktop/Apps/MyLife/MyCar/AGENTS.md`: simplified stale boilerplate and reconciled the local instruction pair after moving the standalone repo to `main`.
- `/Users/trey/Desktop/Apps/MyLife/MyCar/CLAUDE.md`: simplified stale boilerplate, added explicit parity guidance, and reconciled the file after moving the standalone repo to `main`.
- `/Users/trey/Desktop/Apps/MyLife/modules/car/CLAUDE.md`: corrected stale parity wording for active standalone status.
- `/Users/trey/Desktop/Apps/MyLife/modules/homes/CLAUDE.md`: clarified that the hub module is a lightweight adapter, not full HumanHomes parity.
- `/Users/trey/Desktop/Apps/MyLife/modules/surf/CLAUDE.md`: clarified that the hub module is a lightweight adapter, not full MySurf parity.
- `/Users/trey/Desktop/Apps/MyLife/modules/workouts/CLAUDE.md`: clarified that standalone remains canonical until archive.
- `/Users/trey/Desktop/Apps/MyLife/scripts/check-module-parity.mjs`: added explicit `archived` handling so archived standalones are no longer treated as active submodule parity targets.
- `/Users/trey/Desktop/Apps/MyLife/apps/web/test/parity/standalone-passthrough-matrix.test.ts`: simplified and updated the parity matrix to reflect `implemented`, `design_only`, `scaffolded`, and `archived` states instead of the old active-only model.
- `/Users/trey/Desktop/Apps/MyLife/apps/web/package.json`: removed a duplicate `@mylife/auth` dependency key surfaced during parity verification.

## Verification

- Pair completeness check: all live top-level standalone workspaces with `CLAUDE.md` now also have `AGENTS.md`.
- Targeted text audit: cleared the reviewed stale claims around dated skill counts, dated plugin confirmations, root team-size rules, and the old `MyCar` design-only wording.
- `MyCar` standalone repo now points at `main`, matching `origin/HEAD`, so `check-standalone-repos` passes without warnings.
- `pnpm check:parity --quiet`: passes end-to-end after:
  - excluding archived `MyBooks`, `MyBudget`, and `MyRecipes` from active standalone parity enforcement,
  - updating the web parity matrix to model scaffolded and archived states explicitly,
  - and removing the duplicate `@mylife/auth` dependency entry in `apps/web/package.json`.
