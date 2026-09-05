# Runbook: healthz-shape-regression (zero-knowledge alarm)

Pages: `relay-healthz-shape`.

## Symptoms

- The `relay-healthz-shape` synthetic returned exit code 2 with
  `reason: "shape_regression"` and an `extraKeys` list. The relay `/healthz` body carried a
  field OTHER than `ok` and `connections`.

This is NOT a normal availability page. It is a **metadata-privacy regression alarm**. The
relay's entire public surface is `GET /healthz -> {ok, connections}`. Any additional field
leaks information about the relay's internal state (token groups, per-tenant counts,
addresses) and breaks the zero-knowledge guarantee that the relay forwards ciphertext and
knows nothing.

## First checks

Confirm the live shape:

```bash
curl -fsS http://relay:8787/healthz
# CORRECT:   {"ok":true,"connections":3}
# REGRESSION: any extra key, e.g. {"ok":true,"connections":3,"tokenGroups":7}
```

Run the synthetic for the NDJSON verdict and the exact leaked key names:

```bash
node packages/meerkat-relay/deploy/observability/synthetics/relay-healthz-shape.mjs \
  --url http://relay:8787/healthz
```

## Interpretation

The regression means someone added a field to the `/healthz` responder in
`packages/meerkat-relay/src/server.ts` (search for the `res.end(JSON.stringify({ ok: true,
connections: ... }))` line). The CLAUDE.md invariant is explicit: **never add a field to
`/healthz`.** Even a seemingly harmless debug field is a leak.

A `reason: "missing_cors"` (exit 1, degraded) is a different, softer problem: the wildcard
`Access-Control-Allow-Origin: *` header the web relay-selector depends on is missing, so the
browser probe path would break. Fix the header; it is not a privacy leak.

## Safe mitigations

- Revert the change that added the field. The correct body is exactly
  `{ ok: true, connections: <number> }` with `Access-Control-Allow-Origin: *`.
- Ship the revert through the normal release path; this is a code fix, not an ops toggle.
- Verify the synthetic returns exit 0 (`reason: "shape_exact"`) against the new build before
  closing.

## DO-NOT

- Do NOT "fix" the alert by adding the leaked field to the synthetic's allow-list. The
  synthetic is correct; the endpoint regressed.
- Do NOT expose any additional relay hub statistic on `/healthz`. Private counts belong on
  the stateful services' private `/metrics` (which the relay deliberately does not have),
  never on the relay's public liveness endpoint.

## Escalation

If the field was added deliberately for a feature, escalate to the service owner: the
zero-knowledge surface is a hard invariant and needs a different mechanism (a private metrics
listener on the stateful services, not the relay), not an expanded `/healthz`.

## Rollback pointer

This is a code regression; roll back the offending release via the standard signed release
manifest rollback, not a store cutover.
