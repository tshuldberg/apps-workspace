# 2026-08-01: CI attempt #50 run stopped and deleted

## Request

Founder saw "attempt #50" of a CI workflow on GitHub and asked to turn it off and stop seeing it.

## Findings

- The run was CI run #345 (id 30509580547, commit 2512ffe4, main), the same run the 2026-07-31 repo audit documented: a prior-session 15-minute rerun loop drove it to attempt #49 on 07-30, every attempt killed at startup by the billing failure, one email per attempt.
- Attempt #50 fired today at 18:34 UTC as a one-off rerun under the founder account (`triggering_actor: tshuldberg`) and concluded `startup_failure`. No automation was found that could have fired it: no crontab, no launchd rerun agents, no Claude Code crons, no gh aliases/extensions, no rerun scripts in automation-hub or system-monitor. Most likely a manual "Re-run" click in the GitHub UI or another session.
- The run was already completed, so there was nothing to cancel.

## Action

- Deleted run 30509580547 via `gh api -X DELETE repos/tshuldberg/MyLife/actions/runs/30509580547`. Verified 404 afterward. The run and all 50 attempts are gone from the Actions UI and can never be re-run again, so no further attempt emails are possible from it.
- Left today's legitimate CI run #359 (id 30712386110, testflight EAS profile push) running.

## Billing status

GitHub Actions billing is confirmed fixed as of 2026-08-01: CI run #359 executes real jobs (lint, typecheck, parity, audit green; coverage failed on its own merits; test in progress at time of writing) and MyNews run #7 succeeded. Updated the 2026-07-31 billing recurrence row in `errors_log.md` to Resolved.

## Remaining

- CI run #359 `coverage` job failed on its own (not billing). Not investigated in this session.
