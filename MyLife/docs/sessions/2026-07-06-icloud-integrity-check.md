# 2026-07-06: iCloud-Off Workspace Integrity Check

## Context
User disabled iCloud storage (Desktop & Documents sync) on this Mac. The workspace lives under ~/Desktop, so eviction/placeholder damage was possible. Verified with local checks plus an independent codex (gpt-5.5, read-only) investigation.

## Verdict
NO DATA LOSS DETECTED. Claude and codex agreed on every finding.

## Evidence
- MyLife repo: git status clean except memory.md; `git fsck --no-dangling` clean.
- Zero `*.icloud` placeholder stubs anywhere under ~/Desktop or Apps.
- iCloud Drive `Desktop` folder is empty (only .DS_Store), so nothing was moved off local Desktop.
- File population: apps/mobile 12,358 files, apps/web 7,656, modules 16,372, packages 3,282; codex spot-checked 10 tracked files with real content.
- 5 zero-byte files `apps/mobile/app/(car)/{document,fuel,service,trip,vehicle}/add.tsx` are committed as empty blobs (e69de29) in git: pre-existing stubs, not eviction. Separate tech-debt item.
- Parent Apps repo 177 uncommitted deletions (MyBooks 90, MyVoice 54, MyLife 22 gitlinks, 11 root md) are stale consolidation cleanup from the standalone-to-hub archive migration (archive dirs mtime 2026-03-14). All git-restorable if ever needed.

## Notes
- `brctl status` showed teardown mid-sync ("needs-sync") at check time, expected during the toggle.
- gstack upgrade available (1.5.1 -> 1.58.5), not applied this session.
- First codex background run failed instantly: `_gstack_codex_timeout_wrapper` not available in background shell (sourced helper does not persist). Reran with plain `codex exec` + Bash timeout.
