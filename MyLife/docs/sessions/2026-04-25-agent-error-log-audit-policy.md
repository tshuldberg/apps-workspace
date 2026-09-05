# Agent Error Log Audit Policy

## Summary

Updated the root Claude and Codex instruction pair so agents still maintain `errors_log.md` when real errors occur, but no longer audit, grep, or scan it automatically before routine work.

## Why

The user wants `errors_log.md` to remain a ledger for meaningful errors, while reserving broader audits of that file for explicit manual requests.

## Files Changed

- `AGENTS.md`
- `CLAUDE.md`
- `memory.md`
- `docs/archives/memory-sessions-2026-04-19-to-04-24.md`
- `docs/sessions/2026-04-25-agent-error-log-audit-policy.md`

## Verification

- Confirmed the old grep-before-work wording is absent from `AGENTS.md` and `CLAUDE.md`.
- Confirmed both files now state that `errors_log.md` audits happen only when explicitly requested, or when diagnosing or updating a known row after a real logged error.
- No function gate was run because this was a documentation-only change with no source function logic.

## Error Log

No `errors_log.md` row was added because no build, test, parity, runtime, hook, or workflow failure occurred during this change.
