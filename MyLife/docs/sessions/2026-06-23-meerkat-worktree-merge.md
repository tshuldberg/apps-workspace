# Meerkat Worktree Merge

Date: 2026-06-23

## Summary

Merged the remaining useful work from `.claude/worktrees/main-relay-rendezvous-fix` after preserving the dirty worktree on a local safety branch.

## What Changed

- Preserved the original worktree state on `salvage/main-relay-rendezvous-fix-20260623` at commit `8413629e`.
- Fast-forwarded local `main` to current `origin/main`.
- Carried forward the unsuperseded relay test hardening:
  - malformed friend-code resolution uses invalid `MEER-NOPE!`;
  - a throwing WebSocket proves the malformed path does not open the network;
  - valid unpublished custom code `MEER-ZZZZ-ZZZZ-ZZZZ` is covered as `not_found`.
- Left already-landed app config and `.gitignore` work on current `main` instead of replaying stale duplicates.

## Validation

- `pnpm --filter @mylife/meerkat-relay test -- src/__tests__/friend-rendezvous-e2e.test.ts`
- `pnpm --filter @mylife/meerkat-relay typecheck`
- `pnpm gate:function:changed --base origin/main`
- `pnpm check:generated-artifacts`
- `pnpm check:parity --quiet`
- `git diff --check`
