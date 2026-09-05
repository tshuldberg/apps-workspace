# Runbook: incident-drill

A staffed incident rehearsal: page the on-call, walk a real (or realistic) failure
through the escalation ladder using the existing per-page runbooks, and prove the human
+ tooling response works end to end. Records an `incident` rehearsal proof (the
incident-response sign-off in Plan 40's evidence ledger).

> **Honesty rule.** A drill that was NOT run is NOT evidence; a recorded drill proves
> the RECORD, not the infrastructure or the staffing. This repository owns the per-page
> runbooks, the honest signals (`/readyz`, `/healthz` shape, backup freshness, canary
> verdict), and the proof row. The STAFFING half - a real human paged, a real
> escalation, a real decision under time pressure - is founder-ops and cannot be faked
> by a tool. Recording an `incident` drill proves the exercise happened and what was
> decided; it does not prove the fleet is incident-proof.

## What this drill exercises

Unlike the mechanism drills (failover, dependency-outage, canary-stop), the incident
drill exercises the RESPONSE: paging, ownership, the escalation ladder, and the decision
quality when a signal fires. It reuses the existing per-page runbooks as the response
script rather than inventing new mechanics. Pick ONE failure to rehearse and drive it
through its runbook under realistic conditions.

## Escalation ladder (from `README.md`)

`on-call operator -> service owner -> founder-ops` (for backup, object-store,
DNS/TLS-edge, or database-provider actions). The drill must actually traverse this
ladder, not shortcut it: a drill where the operator silently fixed it alone did not
exercise escalation.

## The fleet-wide DO-NOTs still apply during a drill

From `README.md`, these hold even under incident pressure (a drill that violates them
teaches the wrong reflex):

- Never restart a service into `postgres` mode without the cutover proof.
- Never delete an object by hand (the deletion queue is the only byte remover).
- Never add a field to the relay `/healthz`.
- Never echo a redeem token, session secret, connection string, or identity into an
  incident channel. Copy the redacted signal, not raw payloads.

## Preconditions

- A staging fleet from an approved release (never rehearse a destructive incident on
  production unless the drill IS a production game-day with founder sign-off).
- The on-call rotation staffed and reachable; the escalation contacts known.
- The per-page runbooks in this directory accessible to responders.

## Step 1 - Choose + inject the scenario (founder-ops)

**FOUNDER-OPS.** Pick a scenario and induce it using the matching drill/runbook, WITHOUT
telling the responder the root cause (a real incident does not come labeled). Examples:

| Scenario | Inject via | Response runbook |
|---|---|---|
| Database primary loss | `failover-drill.md` Step 2 | `readyz-down.md`, `failover-drill.md` |
| Dependency outage | `dependency-outage-drill.md` Step 2 | `dependency-outage-drill.md`, `pool-saturation.md` |
| Backup gone stale | pause the restore-smoke job | `backup-stale.md` |
| Bad canary during a promotion | `canary-stop-rollback-drill.md` | `release-promotion.md`, `canary-stop-rollback-drill.md` |

Record the injection instant (ISO UTC).

## Step 2 - Run the response (founder-ops + repo tooling)

The responder works the incident using the existing runbooks:

1. **Detect.** The signal fires (a page, or the responder notices `/readyz` 503 /
   `backup-freshness` exit 2 / a failing canary verdict).
2. **Triage.** Open the named runbook; run its first-check commands (all repo tooling:
   `curl /readyz`, the freshness/shape synthetics, `promotion:postgres --status`).
3. **Escalate.** Traverse the ladder when the runbook says founder-ops action is needed.
4. **Mitigate.** Apply the runbook's safe mitigation (hold the cohort, re-run the
   restore-smoke, roll back the release, etc.).
5. **Verify recovery.** Confirm the honest signal returns to green
   (`/readyz` 200, freshness exit 0, canary verdict ok).

Capture a timeline: detect -> triage -> escalate -> mitigate -> recover, with
timestamps. That timeline is the drill's evidence.

## Decision criteria

- The right signal fired, the responder found and followed the correct runbook,
  escalation traversed the ladder, the mitigation was a SAFE one from the runbook (no
  DO-NOT violated), and recovery was confirmed by an honest signal -> **PASS**.
- The signal did NOT fire (the failure was silent) -> **FAIL** on the observability, not
  the responder: a fault with no page is a monitoring gap. Record `failed` and file the
  gap.
- A DO-NOT was violated (a hand delete, a raw secret in the channel, a cutover-less
  restart) -> **FAIL**: the drill taught the wrong reflex. Record `failed`.
- The mitigation did not recover the signal -> **FAIL**: either the runbook is wrong or
  the failure was deeper than rehearsed. Record `failed` and capture the gap.

## Step 3 - Record the proof (repo tooling)

```bash
MEERKAT_POSTGRES_URL='postgres://meerkat_ops:<pw>@<ops-host>/<db>' \
  pnpm --filter @mylife/meerkat-relay rehearsal:postgres --record \
    --kind incident --verdict passed --operator '<you>' \
    --started-at "$STARTED_AT" \
    --evidence /drill/incident-timeline.ndjson
```

Evidence: the response timeline (each step with its timestamp and the runbook command
run), the signals observed (redacted; NEVER a raw secret or identity), and the
mitigation + recovery confirmation. A `passed` verdict requires non-vacuous evidence.
This row is the incident-response sign-off Plan 40's ledger reads.

## Abort / rollback guidance

- If the injected scenario escalates beyond the drill's intended blast radius, STOP the
  drill and run the incident FOR REAL. A game-day that becomes a real outage is handled
  as a real outage, then recorded as `aborted` with a note.
- Never leave the fleet in the injected-failure state to "finish paperwork". Recover
  first, record second.

## Founder-ops boundary

| Step | Repo tooling (recorded + verifiable) | Founder-ops (real infrastructure / staffing) |
|---|---|---|
| Inject the scenario | the matching drill's inject step | operator induces the real failure |
| Detect via honest signal | `/readyz`, `backup-freshness.mjs`, `canary-verdict.mjs` | observed on the real fleet |
| Escalate | the escalation ladder in the runbooks | real humans traverse the ladder |
| Mitigate | the runbook's safe mitigation commands | operator applies them on real hosts |
| Record the proof | `rehearsal:postgres --record --kind incident` | operator runs it after the real drill |

See also every per-page runbook in `README.md`; this drill is the coordination layer
over all of them.
