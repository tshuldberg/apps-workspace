# Apps instruction reset applied

Applied September 5, 2026, following approval of the [audit and proposal](REPORT-apps-instruction-reset-2026-09-04.md).

Primary-project instruction text fell from **97,186 to 4,009 words, a 95.9% reduction**. The before count includes Meerkat's private-storage rule added after the audit; that newer constraint was retained.

| Measure | Before | After |
|---|---:|---:|
| Primary instruction/rule files | 105 | 98 |
| Primary instruction words | 97,186 | 4,009 |
| Primary shared AGENTS.md files | 20 | 49 |
| Primary CLAUDE.md files | 82 | 49 |
| Primary Claude-only path rules | 3 | 0 |

The file count remains close because formerly Claude-only project constraints now have a short shared file and a one-line import. All 49 primary CLAUDE.md files resolve to shared instructions. Most module inventories were removed; a shared module file and ten small exception files preserve the actual contracts.

The reset removed **46 redundant instruction/rule files**, including eight obsolete archived-standalone files. The archive now has one short shared status file and import. Twelve scoped reference documents retain detailed security, protocol, native compatibility, and upstream integration contracts. Their approximately 23,000 words are outside automatic instruction files; they are consulted for relevant changes. Ordinary API inventories, stale counts, team prescriptions, forced questions, and compulsory session diaries were discarded instead of moved into new manuals.

Key retained constraints include the excluded ShipHawk project, concurrent-session boundaries, Arena's spending/process limits, offline flashcards and shipped migrations, server-side entitlements, private media, Meerkat identity separation and private storage, opaque relay behavior, MyNews trust contracts, and automation-hub's outbound approval policy.

## Automation changes

- MyLife no longer wires per-edit TypeScript/debug-regex checks, automatic errors_log writes, memory breadcrumbs, or Stop/PreCompact snapshots. The old helper scripts remain available but are not wired in committed settings.
- The command-safety and full TaskCompleted parity hooks remain enabled. Full parity is retained as the conservative fallback because a complete changed-path mapping has not been established.
- Retained hooks now use the selected project directory instead of a hardcoded primary checkout. This follows the documented `CLAUDE_PROJECT_DIR` mechanism in the [Claude hook reference](https://code.claude.com/docs/en/hooks).
- Permission allow/deny lists, plugin settings, environment settings, and the repository pre-commit checks were preserved. The broad raw-text console/debugger ban was retired with the per-edit hook; no new global lint restriction was added.
- Receipts' review prompt now consumes AGENTS.md instead of maintaining a third policy copy. MyNews workflow references point to the relocated platform contracts.

Active worktree instruction copies, upstream/plugin reference trees, and the unresolved explicit template copy were left untouched. Existing terminal sessions were not restarted. No application runtime code was changed, committed, or deployed.

## Validation

Verified every planned edit and deletion, all 49 primary imports, retained critical constraints, and unchanged worktree/upstream/copy fingerprints. Checked local settings in the workspace, MyLife, Meerkat, Receipts, and native EasyStreet for hook overrides; none were present.

Exercised the retained hooks with temporary fixtures: a safe command remained allowed, a destructive-command payload remained blocked, parity success returned success, parity failure blocked completion, project paths containing spaces worked from another working directory, and a missing project directory failed. The parity fixture substitutes a test executable; it verifies hook dispatch and exit behavior without running the full application suite.

No full application test suite was needed for the instruction rewrite. The MyNews workflow edit changes only a comment and a documentation path in a diagnostic message.

Rollback data containing the pre-edit contents and applied replacements is saved outside Apps at [the backup manifest](/Users/trey/.codex/backups/apps-instruction-reset-20260905-005646/manifest.json). A rollback must preserve any edits made after this reset; the agent should compare current content with the recorded replacement before restoring an individual file.
