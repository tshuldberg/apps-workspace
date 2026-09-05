# Runbook: canary-stop-rollback-drill

Prove the rollout STOPS on a bad canary: an intentionally FAILING canary verdict must
REFUSE the promotion record, and the emergency rollback must record honestly (images
re-pointed, database NOT un-written). Records a `canary_stop_rollback` rehearsal proof
(AC-44.11's rollout-stop half).

> **Honesty rule.** A drill that was NOT run is NOT evidence; a recorded drill proves
> the RECORD, not the infrastructure. This repository owns the canary evidence gate (a
> promotion to a canary rung REQUIRES an evidence file whose final line is a verdict
> with `verdict: "ok"`), the refusal path, and the rollback's honest non-reversal
> markers. Deploying the bad build to a real canary cohort and re-pointing the real
> fleet is founder-ops. The refusal IS the proof: recording a canary rung on a failing
> canary is exactly the lie the gate exists to stop.

## What the repo already proves

The refusal-on-failing-verdict + record-on-passing-verdict contract is proven end to end
through the SHIPPED promotion bin by
`src/postgres/__tests__/canary-stop.integration.test.ts`: against a scratch database
holding an approved release at `staging`, a failing verdict file refuses the
`staging_canary` promotion (nonzero exit, `not "ok"` fatal) and lands NO row; a degraded
verdict is likewise refused; a passing verdict records the rung. This DRILL confirms the
same gate on a real canary deploy with a real (intentionally bad) build. Do not
re-derive the gate contract by hand.

## Preconditions

- A staging fleet with an APPROVED release at `staging` (see `release-promotion.md`).
- An intentionally BAD build to promote (the canary must genuinely fail; a healthy build
  would make the stop unobservable). A prior approved release to roll back to.
- `psql` with `meerkat_ops` + `meerkat_observer` URLs.
- The canary host set reachable for the verdict synthetic.

## Step 1 - Deploy the bad build to the canary cohort (FOUNDER-OPS)

**FOUNDER-OPS.** Pull + start the bad build's pinned images on the canary cohort only
(the same compose pull/up idiom as `release-promotion.md`). Do NOT widen the cohort and
do NOT record any promotion yet.

## Step 2 - Run the canary verdict (repo tooling)

Run the synthetic against the canary hosts. Because the build is bad, at least one check
fails, so the aggregate verdict is `fail` (exit 2):

```bash
node packages/meerkat-relay/deploy/observability/synthetics/canary-verdict.mjs \
  --relay-url http://<relay-canary>:8787/healthz \
  --service persona:<persona-canary>:8894 \
  --service humanity:<humanity-canary>:8892 \
  > /drill/canary-fail-<id>.ndjson; echo "verdict exit: $?"
# exit 2 = fail (a check failed / unreachable / zero checks). exit 1 = degraded. exit 0 = ok.
```

The final NDJSON line is the aggregate verdict object. For a bad build it is
`{"probe":"canary-verdict","verdict":"fail",...}` (or `"degraded"`), NOT `"ok"`.

## Step 3 - Attempt the promotion; it MUST refuse (repo tooling)

Feed the FAILING verdict to the promotion CLI. The evidence gate refuses it:

```bash
MEERKAT_POSTGRES_URL='postgres://meerkat_ops:<pw>@<ops-host>/<db>' \
  pnpm --filter @mylife/meerkat-relay promotion:postgres --promote \
    --release-id '<bad-release-id>' --to staging_canary \
    --operator '<you>' --evidence /drill/canary-fail-<id>.ndjson
echo "promote exit: $?"
```

Expected: **nonzero exit**, with a `fatal` NDJSON event whose detail contains
`not "ok"` (the `assertOkVerdict` refusal). Confirm NO promotion row landed:

```bash
MEERKAT_POSTGRES_URL='postgres://meerkat_observer:<pw>@<ops-host>/<db>' \
  pnpm --filter @mylife/meerkat-relay promotion:postgres --status --release-id '<bad-release-id>'
# currentState must still be "staging"; there is NO staging_canary transition.
```

**This refusal is the AC-44.11 rollout-stop proof.** A bad canary cannot be recorded as
a healthy promotion.

## Step 4 - Roll back honestly (repo tooling + founder-ops deploy)

**FOUNDER-OPS.** Re-point the canary cohort at the prior approved release's pinned
images (emergency rollback in `release-promotion.md`). **NC-44.5: no destructive
migration may run inside the rollback window.**

Record the rollback with its honest non-reversal markers:

```bash
MEERKAT_POSTGRES_URL='postgres://meerkat_ops:<pw>@<ops-host>/<db>' \
  pnpm --filter @mylife/meerkat-relay promotion:postgres --rollback \
    --release-id '<bad-release-id>' --rollback-to '<prior-approved-id>' \
    --operator '<you>' --evidence /drill/canary-fail-<id>.ndjson
```

The store stamps `dataReversalClaimed=false` and
`postgresWritesAfterFlipReversed=false`, and REFUSES any evidence claiming reversal. A
rollback re-points images; it never un-writes the database. Any rows the bad release
wrote REMAIN and are reconciled deliberately (they are not automatically reverted). The
failing canary verdict is attached as the justification for the rollback.

## Decision criteria

- The promotion was REFUSED on the failing verdict (nonzero exit, `not "ok"` fatal), no
  `staging_canary` row landed, and the rollback recorded with honest non-reversal
  markers -> **PASS**. This is the rollout-stop contract working.
- The promotion RECORDED despite the failing verdict -> **FAIL**: the gate is broken
  (this would contradict the CI proof; investigate immediately). Record `failed`.
- The rollback record was refused because evidence claimed reversal -> the record is
  honest by construction; remove the false claim and re-record.
- A destructive migration had run inside the rollback window so the prior release cannot
  boot -> **FAIL**: NC-44.5 violated (see `migration-rollback-drill.md`).

## Step 5 - Record the proof (repo tooling)

```bash
MEERKAT_POSTGRES_URL='postgres://meerkat_ops:<pw>@<ops-host>/<db>' \
  pnpm --filter @mylife/meerkat-relay rehearsal:postgres --record \
    --kind canary_stop_rollback --verdict passed --operator '<you>' \
    --started-at '<ISO instant the drill began>' \
    --evidence /drill/canary-stop-evidence.ndjson
```

Evidence: the failing canary verdict, the promotion `--status` showing the release
stayed at `staging` (refusal), and the promotion `--history` showing the `rolled_back`
record with its honest markers. A `passed` verdict here means "the stop-and-rollback
worked"; it requires non-vacuous evidence.

## Abort / rollback guidance

- If the bad build cannot be rolled back (the prior release will not boot), STOP and
  restore from backup (`disaster-recovery-drill.md`); that is an `aborted` drill and a
  real incident (`incident-drill.md`).
- Never "force" the promotion past the gate to complete the drill. The gate refusing IS
  the pass condition; forcing past it destroys the very property being proven.

## Founder-ops boundary

| Step | Repo tooling (recorded + verifiable) | Founder-ops (real infrastructure) |
|---|---|---|
| Deploy the bad build to canary | — | compose pull/up on the canary cohort |
| Compute the failing verdict | `canary-verdict.mjs` (real probe exits) | point it at the real canary hosts |
| Refuse the promotion | `promotion:postgres --promote` (evidence gate) | operator runs it after the deploy |
| Re-point to the prior release | — | compose pull/up prior images |
| Record the honest rollback | `promotion:postgres --rollback` (non-reversal markers) | operator runs it after the redeploy |
| Record the drill proof | `rehearsal:postgres --record --kind canary_stop_rollback` | operator runs it after the real drill |

See also `release-promotion.md` (the ladder + rollback flow), `healthz-shape-regression.md`,
`readyz-down.md`, `migration-rollback-drill.md` (NC-44.5).
