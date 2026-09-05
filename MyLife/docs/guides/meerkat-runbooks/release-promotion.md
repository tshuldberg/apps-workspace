# Runbook: release-promotion

The signed-release promotion ladder (Plan 44 WP-6C): move an APPROVED release from
staging through canary to production, gate each rung on a real canary verdict, and
record every transition as durable, immutable proof. Emergency rollback re-points the
deploy at an earlier approved release without ever un-writing the database.

> **Honesty rule.** A transition that was NOT recorded is not evidence; a recorded
> transition proves the RECORD, not the deploy. This repository owns the RECORD-AND-
> VERIFY half (the promotion CLI, the canary-verdict synthetic, the proof table). The
> DEPLOY half (pulling pinned images, restarting the stack, choosing a canary cohort)
> is founder-ops. The tooling never fabricates: a promotion row exists only after an
> operator ran the CLI, a canary verdict comes from a real synthetic exit, and a
> rollback records what is honestly NOT undone. The GitHub workflows
> (`deploy-staging.yml`, `promote-canary.yml`, `rollback-release.yml`) are the
> auditable checklist rail: they print the exact commands and record nothing.

## The ladder

```
(none) --deploy--> staging --canary--> staging_canary --canary--> production_canary --canary--> production
                                                                                                   |
   any non-rolled_back state ------------------------------- rolled_back <---- emergency rollback --+
```

The promotion CLI derives each transition's from-state from the release's CURRENT
recorded state (the latest row for the release id) and refuses an illegal jump or a
stale from-state. Only an APPROVED release manifest (NC-44.4) may be promoted.

## Preconditions (every rung)

- The release is recorded and APPROVED: `release:postgres --status` shows it, and
  `release:postgres --verify --release-id <id> --image ...` exits 0 for the images
  you are about to deploy (digest-pinned + present in the approved manifest).
- Each image signature verifies at deploy time (founder-ops). The identity MUST be
  pinned to THIS repository's release workflow; a wildcard identity would accept a
  signature from any GitHub workflow anywhere:
  ```bash
  cosign verify <repo>@sha256:<digest> \
    --certificate-oidc-issuer https://token.actions.githubusercontent.com \
    --certificate-identity-regexp '^https://github\.com/tshuldberg/MyLife/\.github/workflows/release-images\.yml@'
  ```

## Rung 1 - staging

1. **Deploy (founder-ops).** Pull + start the pinned images:
   ```bash
   export MEERKAT_RELEASE_TAG='<git-sha>'
   docker compose --env-file <staging.env> -f packages/meerkat-relay/deploy/compose.production.yml pull
   docker compose --env-file <staging.env> -f packages/meerkat-relay/deploy/compose.production.yml up -d
   ```
2. **Record.**
   ```bash
   MEERKAT_POSTGRES_URL='postgres://meerkat_ops:<pw>@<ops-host>/<db>' \
     pnpm --filter @mylife/meerkat-relay promotion:postgres --promote \
       --release-id '<id>' --to staging --operator '<you>'
   ```

## Rungs 2-4 - staging_canary, production_canary, production

Each forward rung is: run the canary verdict, apply the decision criteria, deploy the
next cohort (founder-ops), then record the transition with the verdict as evidence.

1. **Canary verdict.** Run the synthetic against the canary host set:
   ```bash
   node packages/meerkat-relay/deploy/observability/synthetics/canary-verdict.mjs \
     --relay-url http://<relay-canary>:8787/healthz \
     --service persona:<persona-canary>:8894 \
     --service humanity:<humanity-canary>:8892 \
     > /tmp/canary-<id>.ndjson; echo "verdict exit: $?"
   ```
2. **Decision criteria (the go/no-go):**
   - **exit 0 (ok)** -> PROCEED: every requested check ran and passed.
   - **exit 1 (degraded)** -> INVESTIGATE: a check answered but is not fully healthy
     (e.g. a service /readyz 503 during boot). Do not promote until it clears.
   - **exit 2 (fail)** -> STOP: a check failed, was unreachable, or ZERO checks were
     requested (a vacuous "all clear" is a fail by design). Follow rollout stop below.
3. **Deploy the next cohort (founder-ops)** using the same compose pull/up against the
   widened cohort.
4. **Record** with the verdict attached:
   ```bash
   MEERKAT_POSTGRES_URL='postgres://meerkat_ops:<pw>@<ops-host>/<db>' \
     pnpm --filter @mylife/meerkat-relay promotion:postgres --promote \
       --release-id '<id>' --to <staging_canary|production_canary|production> \
       --operator '<you>' --evidence /tmp/canary-<id>.ndjson
   ```
   The evidence gate is HARD for these rungs: `--evidence` is required and its final
   line must be a canary verdict with `verdict: "ok"`. A missing, degraded, or failed
   verdict refuses the record; re-run the canary until it passes (or follow rollout
   stop). Only the initial `--to staging` record accepts notes-only evidence.

## Rollout STOP procedure

When a canary verdict is degraded or fail, or an operator observes a regression:

1. **Do not promote.** Do not record a forward transition; the release stays at its
   current recorded rung.
2. **Hold the cohort.** Do not widen the canary. If the current cohort is unhealthy,
   proceed to emergency rollback.
3. **Investigate** with the failing check names from the verdict line and the relevant
   runbook (`readyz-down.md`, `healthz-shape-regression.md`).

## Emergency rollback

A rollback re-points the deploy at an EARLIER approved release. It is reachable from
any non-rolled_back state.

1. **Verify the rollback target (founder-ops).** The target must be a recorded,
   APPROVED, EARLIER release; confirm with `release:postgres --verify --release-id
   <target> --image ...`. The promotion CLI independently refuses a target that is not
   found, not approved, not earlier, or the same release.
2. **Redeploy the prior images (founder-ops).**
   ```bash
   export MEERKAT_RELEASE_TAG='<git-sha of the target>'
   docker compose --env-file <prod.env> -f packages/meerkat-relay/deploy/compose.production.yml pull
   docker compose --env-file <prod.env> -f packages/meerkat-relay/deploy/compose.production.yml up -d
   ```
   **NC-44.5: no destructive migration may run inside the rollback window.** A schema
   change that drops or rewrites data cannot be undone by re-pointing images.
3. **Record the rolled_back transition.**
   ```bash
   MEERKAT_POSTGRES_URL='postgres://meerkat_ops:<pw>@<ops-host>/<db>' \
     pnpm --filter @mylife/meerkat-relay promotion:postgres --rollback \
       --release-id '<id>' --rollback-to '<target>' --operator '<you>'
   ```
   The CLI stamps `dataReversalClaimed=false` and
   `postgresWritesAfterFlipReversed=false` into the evidence and REFUSES any evidence
   claiming reversal. **A rollback re-points images; it never un-writes the database.**
   Rows written while the rolled-back release was live REMAIN; reconcile them
   deliberately, they are not automatically reverted.

## Founder-ops boundary

| Step | Repo tooling (recorded + verifiable) | Founder-ops (real infrastructure) |
|---|---|---|
| Verify release signed + approved | `release:postgres --verify` (membership + digest-pin) | `cosign verify` against the live registry |
| Deploy to staging / canary / prod | — | `docker compose pull/up` against real hosts |
| Choose the canary cohort | — | operator picks the cohort |
| Run the canary verdict | `canary-verdict.mjs` (real probe exits) | point it at the real canary hosts |
| Record the transition | `promotion:postgres --promote` (immutable proof) | operator runs it after the real deploy |
| Emergency rollback deploy | — | redeploy prior images |
| Record the rollback | `promotion:postgres --rollback` (honest non-reversal) | operator runs it after the real redeploy |

## Verify a release's state

```bash
MEERKAT_POSTGRES_URL='postgres://meerkat_observer:<pw>@<ops-host>/<db>' \
  pnpm --filter @mylife/meerkat-relay promotion:postgres --status --release-id '<id>'
# full history, newest first:
MEERKAT_POSTGRES_URL='postgres://meerkat_observer:<pw>@<ops-host>/<db>' \
  pnpm --filter @mylife/meerkat-relay promotion:postgres --history --release-id '<id>'
```

Or directly:

```sql
SELECT promotion_id, from_state, to_state, operator, recorded_at
FROM ops.release_promotions
WHERE release_id = '<id>'
ORDER BY recorded_at DESC, promotion_id DESC;
```
