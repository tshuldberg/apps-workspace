# HTML Artifact Reconciliation

Date: 2026-07-09  
Branch: `feature/meerkat-public-base-feed`  
Starting commit: `ab1f2a83`

## Objective

Compare current code, git history, and HTML documentation across MyLife and contained apps. Remove superseded generated artifacts, retain files with a current runtime or evidentiary purpose, and make the remaining collection navigable.

## Source-Of-Truth Findings

- The module registry contains 41 module IDs.
- The mobile hub fully registers 38 modules. `manhattan`, `mynews`, and `subs` are not full mobile registrations.
- The web hub fully registers 30 modules. `cycle`, `garden`, `mail`, `mood`, `mynews`, `notes`, `nutrition`, `stars`, `subs`, `trails`, and `voice` are not full web registrations.
- The current visual token source is Obsidian Noir in `packages/ui/src/tokens/colors.ts`, not the older Cool Obsidian values repeated in instruction files.
- March and April business and investor materials are snapshots. They do not override current code or the current report catalog.

## Reconciliation

- Removed 74 tracked HTML artifacts that were superseded, duplicated Markdown plans, or carried outdated implementation and launch claims.
- Removed 19 obsolete Markdown prompts, report fragments, handoffs, and orchestration documents whose instructions conflicted with the current repository.
- Reduced the live non-hidden HTML surface from 118 files to 52. The 52 retained files are 10 runtime or app-local files, 13 dated reports, 13 session twins, 11 investor-package files, 4 archived snapshots, and 1 intentional interactive manifesto.
- Retained runtime pages, legal documents, test fixtures, host interfaces, the intentional interactive manifesto, the investor package, and 13 dated report artifacts.
- Kept BestChef's Pinwheel Mission Control HTML because the app explicitly references it.
- Added documentation maps for the repository, report catalog, BestChef artifacts, and Meerkat artifacts.
- Restored the missing `.claude/plugins.md` inventory required by the repository startup checklist and documented separate Claude and Codex MCP registration checks.
- Marked the July 7 Meerkat final review as a historical snapshot superseded by the July 9 Blackglass audit.
- Added snapshot warnings to the April investor packages rather than silently rewriting unverified financing and market claims.
- Added a persistent artifact lifecycle policy to both `AGENTS.md` and `CLAUDE.md`.
- Corrected module counts, free-tier labels, and visual tokens in current entry-point documentation.

## Open Brain And Codex

The Open Brain endpoint was already connected in Claude but absent from Codex. It was registered globally in Codex through the existing `mcp-remote` endpoint and `BRAIN_KEY` environment variable. The endpoint completed an MCP initialization request successfully. Codex loads MCP registrations at session startup, so a fresh Codex session is required before Open Brain tools appear in the tool list.

For GPT-5.6 Sol, `max` is the deepest single-agent reasoning setting. `ultra` adds automatic task delegation. The current persistent setting remains `xhigh`; selecting Ultra in `/model` or setting `model_reasoning_effort = "ultra"` enables that mode for a fresh session.

## Verification

- Current entry-point link validation passed across 10 instruction and index files.
- All 13 retained report HTML files are cataloged and contain no external script, image, or stylesheet dependencies.
- No deleted artifact is referenced by current operational Markdown outside historical sessions and archives.
- `git diff --check` passed, and no newly added documentation line contains an em dash.
- `pnpm check:generated-artifacts` passed.
- `pnpm check:parity --quiet` passed across the full repository parity chain.
- No application or shared-package function logic changed, so `pnpm gate:function:changed` was not required for this reconciliation.
