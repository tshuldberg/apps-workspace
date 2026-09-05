# Apps instruction reset proposal

Reviewed September 4 to 5, 2026. This document records the original proposal. The user subsequently approved the cuts; see [the applied results and validation](REPORT-apps-instruction-reset-applied-2026-09-05.md).

**Recommendation: remove roughly 85 to 95 percent of primary-project instruction prose, make CLAUDE.md an import, and keep only durable project constraints that the code does not explain well.** This is a proposed reduction target, not a measured result of an applied rewrite. Stronger models reduce the value of generic coaching; they still cannot infer a private product decision, a spending limit, or an integration boundary that exists only in these files.

The concrete replacement drafts are in [the proposed replacements](REPORT-apps-instruction-reset-proposed-files-2026-09-04.md). [The CSV inventory](REPORT-apps-instruction-reset-inventory-2026-09-04.csv) gives every discovered file a classification, size, content fingerprint, disposition, and retention note.

## Coverage and quality assessment

| Classification | Files | Lines | Words | Treatment |
|---|---:|---:|---:|---|
| Primary projects, including the workspace root | 105 | 12,170 | 97,093 | Main reset scope |
| Worktree copies | 328 | 30,224 | 288,101 | Reconcile through their owning branches |
| Upstream/reference instruction content | 48 | 3,509 | 18,434 | Preserve upstream ownership |
| Archived standalones | 8 | 871 | 5,118 | Replace obsolete active-work guidance with archive status |
| Explicit template copy | 2 | 314 | 1,564 | Establish ownership before changing |
| **Total** | **491** | **47,088** | **410,310** | **168 distinct exact contents** |

Counts include ignored worktrees and repeated import stubs. They do not imply that all files load in every session. The primary set is 20 AGENTS.md files, 82 CLAUDE.md files, and three MyLife path rules. Only seven primary CLAUDE.md files contain a direct `@AGENTS.md` import; 65 CLAUDE.md files have no AGENTS.md sibling in the same directory. The two EasyStreet files inside `.claude/` also need their parent-directory relationship considered when converting imports.

The audit inventoried instruction text, inspected project constraints and process directives, compared divergent worktree versions, and checked selected manifests, hook wiring, and path claims. It is not a source-code or security certification of every documented invariant. Existing security statements are treated as requirements to preserve or relocate, not as proof that the implementation satisfies them.

`shiphawk-dev` trees are excluded from the deliverables and recommendations. Dependency/build/cache trees were excluded from discovery. Upstream gstack, Everything Claude Code, and AzerothCore instructions were classified separately from application policy. Personal/global instructions outside Apps and the contents of every skill or custom-agent definition were not part of this review. Settings review covered committed workspace, MyLife, Receipts, and EasyStreet configurations; no credentials or permission entries are reproduced here.

Quality is uneven: the files contain valuable architecture and regression knowledge, but concision, currency, and consistency are poor. Command lists are useful where the correct validation is non-obvious, but duplicated stack versions, module counts, feature status, and full API catalogs age quickly. A shorter file is better only if it preserves the constraints below.

## Highest-impact findings

1. **The canonical-file rule is contradicted locally.** Sixteen primary files in MMO, both EasyStreet projects, fed-memes, macos-hub, receipts, shiphawk-templates, and tron-castle-fight explicitly require updating both files. Receipts calls them “co-equal.” Replace this entire mechanism with AGENTS.md plus one import. Do not copy content into both files again.

2. **The workspace CLAUDE.md manufactures extra interaction.** Its forced educational insight boxes, AskUserQuestion check-ins, and team choreography add behavior the task often does not need. Delete those extras. Keep the user's preferences in one shared place.

3. **Much of MyLife's instruction tree is a second API reference.** Forty-one module CLAUDE.md files repeat exports, schemas, migration histories, test counts, paths, and feature status. `modules/classes/CLAUDE.md` alone is 508 lines of largely schema/API history. Remove these from automatic instructions. Preserve useful explanations in existing package documentation; omit inventories already evident in source and tests.

4. **MyLife requires several overlapping records and workflows.** The root pair is 228 lines. It layers memory.md, session logs, timeline/state/debt notes, errors_log.md, HTML report twins, fixed gstack sequences, and external-memory guidance over ordinary work. Make special workflows opt-in and record durable decisions once. Keep genuine validation gates.

5. **Worktrees contain real policy drift.** Older MyLife copies mandate “everything ships together” and unrestricted release scope; the current primary file correctly limits work to the authorized scope. Meerkat worktrees disagree about New Architecture, background readiness, and the current launch report. One also contains a copy glossary and orphan-service watchdog warning absent from the primary instructions. Reconcile those against each branch's code; do not replace every copy with the newest-looking text.

6. **Discoverable and stale facts are repeatedly loaded.** The workspace project table still lists root MySurf, MyBudget, and MyBooks directories that are absent. The car module refers to a standalone MyCar that is also absent at the Apps root. Several files pin old model names, tool catalogs, module/test counts, and completed-plan status. Remove these lists from instructions and use the current filesystem, manifests, registry, and release evidence.

7. **The largest files deserve the first cut.** Pixel Agent Hub has a 649-line upstream reference in AGENTS.md; the two EasyStreet `.claude/CLAUDE.md` files total 1,645 lines. These are mostly manuals and repeated process rules. The hub's upstream reference was carried into the local project during setup and should be moved out of automatically loaded guidance. Its 15-line Ghostty adapter file is much closer to the desired shape.

## Proposed structure

| Level | Suggested default | Contents |
|---|---|---|
| Apps/AGENTS.md | About 10 to 15 lines | Workspace exclusion, repository boundaries, concurrent-session care, canonical-file rule, short writing preference |
| Project AGENTS.md | Usually 5 to 20 substantive lines | Non-obvious product/architecture constraints, unusual validation entry point, a few relevant document pointers |
| Most module directories | No child instruction file | Inherit the project/module rules; use source and README for the API |
| Security-sensitive packages or app boundaries | Usually 10 to 30 substantive lines | Privacy, authorization, protocol compatibility, ownership, and specific regression requirements |
| CLAUDE.md | One line | `@AGENTS.md`, or the correct relative import if the file remains inside `.claude/` |
| Skills and runbooks | On demand | Dispatch, releases, setup, deep review, device testing, and long procedures |

These are review guidelines, not a new enforced line limit. Do not create empty files throughout every directory to satisfy a template. Where the app needs a new shared AGENTS.md, transfer the retained Claude-only rules before converting its CLAUDE.md.

Representative source evidence: [workspace shared rules](../../AGENTS.md), [workspace Claude extras](../../CLAUDE.md), [MyLife shared rules](../../MyLife/AGENTS.md), [MyLife Claude workflows](../../MyLife/CLAUDE.md), [Receipts mirroring requirement](../../receipts/AGENTS.md), [EasyStreet's long manual](../../Parks/EasyStreet/.claude/CLAUDE.md), and [the hub's upstream reference](../../pixel-agent-hub/AGENTS.md).

Delete generic advice such as “read before editing,” “use strict TypeScript,” “follow existing patterns,” repeated tool instructions, fixed teammate roles, and universal test-first or full-suite mandates. Preserve compiler/linter/CI enforcement. Keep a validation command when it conveys an actual project trap: for example, MMO's browser-inclusive `npm run verify`, rather than its Node checks alone.

Move historical plans, source maps, setup recipes, troubleshooting narratives, and API descriptions into existing docs only when they add information beyond code. Do not turn every removed paragraph into a new document. Preserve a versioned protocol or threat-model document before removing a requirement whose only durable record currently lives in an instruction file.

## Project dispositions

| Project or family | Keep in the minimal instructions | Remove or move |
|---|---|---|
| **MyLife root** | Standalone ownership and explicit parity exceptions; module disable preserves data; sync scopes/privacy; changed-function gate; CodeRabbit prohibition | Counts, inventories, forced logs/HTML, tool catalogs, team recipes, broad mandatory context loading |
| **MyLife modules** | One shared module contract; small exceptions for BestChef, Manhattan, MyNews, payments, nutrition, sleep/travel release state, sports registry coupling | Most child files; export/schema/test inventories and historical status |
| **Meerkat app, sync, relay** | Keychain/PRNG boot order; fail-closed encryption/signatures; identity separation; opaque relay; tenant isolation; native/Node import boundary; protocol compatibility; honest device evidence | Symbol catalogs and plan diaries; detailed security rationale moves to scoped architecture docs before deletion |
| **MyNews surfaces** | Author signatures and exact money math; moderator authorization on every mutation; server-only secrets; audited operations; provider readiness and fail-closed safety paths; server-safe imports | Route/env inventories, rollout histories, repeated task logs. Preserve detailed security contracts in scoped documents |
| **BestChef and DoWork** | Server-backed public flows; storage privacy; server entitlements; separate ops console; correct user-JWT versus machine-secret deployment contracts; production fixture gates | Release/build numbers, raw locale counts, old readiness summaries, file maps |
| **Yearn** | Canonical native reference during rewrite; product identity; existing backend; ciphertext and real-capability boundaries | Duplicate pair and build narrative |
| **FlashCards** | Offline study; generated hanzi regeneration contract; append-only shipped migrations; no nested transactions; follow-up hub parity exception | Generic stack/style paragraphs and extra log ceremonies |
| **TrainWithRyan** | Isolated single-trainer fork; no MyLife parity; private video URLs and server-side entitlement | “Everything ships” scope expansion, compulsory full-plan reads, triple session records. Remove inherited MyLife parity claims from its copied workouts package doc |
| **Arena** | Forest Rascals name; authoritative combat/data; Meshy 100-credit cap per character; one task-owned heavy process; relevant engine compatibility trap | Team biographies, exhaustive intake questionnaires, repeated instructions for explaining steps, mandatory commit-hash logs. Move UE build/migration cookbook to docs |
| **MMO / arenalite** | Deterministic sim boundary; content provenance; limited dependencies; replay/runtime-probe contracts; meaningful browser validation | Mirrored files, full architecture maps and command inventories, mandatory HTML twins |
| **Both EasyStreet projects** | Shared sweeping semantics; observed holiday dates; platform-specific validation; xcodegen/build source of truth | Hundreds of timeline-template lines, plugin lists, team matrices, duplicated setup manuals |
| **Receipts** | Existing API/UI/cache/serializer seams; applicable test/build commands; no direct main pushes | Co-equal instruction files, duplicated Codex prompt policy, tool lists, broad formatting of unrelated files, mandatory multiple notes |
| **fed-memes** | Relevant backend/iOS/bot checks; real Messages-extension validation for external tests; storage-provider decision | Generic mirrored operating rules, stale sprint target, team matrices |
| **automation-hub** | External replies are drafts pending approval; iMessage is outbound notifications only | Dependency/architecture listings and team templates |
| **HawkVoice** | Local speech; overlay must not steal focus; Electron/native-addon and remote-content boundaries | State-machine walkthrough, setup, mandatory tracking, agent rosters |
| **mylife-talk** | No runtime dependencies; local speech; truthful fallback; isolated tests; transcript parsing contract | Copied pair, stale model label, architecture inventory |
| **system-monitor** | Shell-free system command execution and relevant daemon validation | Copied tool/team guidance and config catalog |
| **macos-hub** | Retired/reference-only status; no watcher/keybinding changes without intent if maintenance is explicitly requested | Active server expansion instructions and duplicated development manual |
| **mcp-apps** | No analytics/body logging; disclosed third parties; free public privacy endpoint; ephemeral IP limits | Stack catalog and repeated setup. These privacy constraints remain even with a stronger model |
| **shiphawk-templates variants** | Table layout plus inline styles; canonical field dictionary for the owning checkout | Mirrored instructions and template cookbook. Do not guess which duplicate checkout is canonical |
| **ShipHawkHub** | Non-production-only database copies; required sibling WMS directories | Portfolio and customer documentation inventories; duplicated writing/LSP guidance |
| **TheMarlinTraders** | Provider adapters and computation off the UI thread | Stack catalog, source tree, stale named-agent/model guidance |
| **BestChef root / Pokemon / small reference children** | Only distinctive behavior constraints and correct local checks after checking current ownership | General descriptions and inherited boilerplate; several children can disappear entirely |
| **pixel-agent-hub** | Adapter/upstream isolation; asset attribution; protocol generation ownership; local terminal-control boundaries | 649-line upstream manual from automatic context; preserve useful reference outside AGENTS.md |
| **archive-standalone** | Historical/reference-only status, with migration destination when verified | Rules that incorrectly call archived apps the active canonical product |

The per-file CSV refines this table, including each worktree and upstream reference file. “Remove child” means remove its automatic instructions after preserving the stated exception in shared guidance or a scoped replacement; it does not mean delete application code or historical product records.

## Rules and automation

| Current mechanism | Proposed change |
|---|---|
| MyLife `.claude/rules/design-system.md` | Replace copied hex tables with the canonical token source. Put the shared constraint in AGENTS.md; remove the rule after migration. Its current module-wide path scope is broader than UI work |
| MyLife `.claude/rules/module-system.md` | Move enable/disable/migration invariants into a short `modules/AGENTS.md`; remove exact registry counts and copied metadata |
| MyLife `.claude/rules/mesh-sync.md` | Put universal sync policy in the root and protocol constraints in `packages/sync/AGENTS.md`; preserve BestChef's exception at its app boundary; remove duplication |
| MyLife PostToolUse TypeScript guard | Replace per-edit package checks with checks after coherent edits plus the existing changed-function/commit gate. Move its raw-text console/debugger prohibition into applicable lint rules; the current regex can also match comments or strings |
| MyLife TaskCompleted full parity hook | Keep parity checks but make the automatic invocation depend on changed parity-sensitive paths, with a full-suite fallback when mapping is uncertain. Do not disable the gate before that mapping exists |
| MyLife automatic errors_log and Stop memory writes | Remove compulsory tracked-file writes. Retain useful incident knowledge once, when an issue merits it |
| MyLife PreCompact/Stop runtime snapshots | Optional local recovery facility; keep only if useful. No requirement to duplicate them into committed session documents |
| MyLife Bash policy and repository pre-commit checks | Retain during the prose reset. These enforce execution or code policy, not writing style. Review behavioral changes separately |
| Receipts `.github/codex/prompts/review.md` | Make it consume canonical repository policy plus review-specific instructions; remove the requirement to maintain a third verbatim policy copy |
| Fixed gstack steps, external memory lookup, agent/team/model prescriptions | Remove from default instructions. Keep the workflows available through their own skills when applicable |
| Settings permission allow/deny lists, installed plugins | No blanket reset. They are separate controls and configuration, not redundant prose. No changes proposed without reviewing each rule's effect |

The workspace settings have no hooks; MyLife's committed settings wire the listed hooks. Their commands use absolute paths to the primary MyLife checkout. That deserves a separate worktree-correctness check because a command invoked from another checkout can still act on the primary tree. This audit does not assume these Claude hooks also run in Codex.

## Applying the proposal

This is an implementation sequence for the agent, not work the founder needs to perform manually:

1. In the primary checkout of each listed project, reconcile current instruction changes against the inventory's content fingerprint. The review is current when no newer user decisions would be overwritten; a changed fingerprint requires rereading that file.
2. Move the retained project-specific contracts into their proposed shared files or existing scoped docs, then replace CLAUDE.md with its relative import. The change is ready when every removed policy has an explicit retain, relocate, or retire decision and no import points to a missing file.
3. Remove redundant child/rule files and generic process paragraphs. Review the resulting diff against the retained constraints above; stop and resolve any lost privacy, spending, repository, migration, or ownership boundary.
4. Change optional hooks only after the Markdown reset is reviewable. Exercise hook selection against representative changed paths and verify that unrelated worktrees are not modified. Keep existing checks if replacement coverage is uncertain.
5. Reconcile active worktrees through their owning git workflows. Preserve branch-specific native compatibility, glossary, and process-cleanup requirements until the associated code is merged or retired.

No application test suites were run for this read-only policy review. Inventory arithmetic, file classifications, selected commands, path existence, and actual hook configuration were checked. A resulting instruction reset should validate imports, retained invariants, and hook behavior; it does not justify running every application's full suite.
