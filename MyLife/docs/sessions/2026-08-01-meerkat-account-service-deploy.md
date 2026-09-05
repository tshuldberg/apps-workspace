# 2026-08-01: Plan 51 account service wired into the production topology (Step 7 open item)

Interactive founder session (guide walkthrough continuation). Built in an isolated worktree per the concurrent-session rule.

## What was done

- `compose.production.yml`: new `account` service (platform image, persona lineage, port 8896, `command: tsx bin/meerkat-account-service.mjs`), first-party postgres profile on `ACCOUNT_DATABASE_URL` (meerkat_account role), verify-full TLS + postgres CA secret, `:?` fail-fast session/epoch secrets, honest-OFF SSO/rail passthroughs on the documented `MEERKAT_*` names, `assn_root_ca` mounted secret (host `ACCOUNT_ASSN_ROOT_CA_HOST_FILE`, default `/dev/null`), `/readyz` healthcheck; edge gains `ACCOUNT_DOMAIN` and a readiness dependency; Caddyfile routes `account:8896`.
- `bin/meerkat-account-service.mjs`: default port 8895 -> 8896 (push owns 8895); `MEERKAT_ASSN_ROOT_CA_FILE` mounted-PEM loader (precedence over inline env; fail-closed on unreadable/empty/non-certificate via X509 parse); HONESTY GATE: no entitlement rail reports `configured` until its founder-ops payload resolver is wired (`RAIL_RESOLVERS_WIRED`), rails answer 503 not_configured and the ready log names the real blocker.
- `production-topology.test.ts`: new test pinning the account service shape, `:?` semantics, the ASSN mount, edge gating, Caddy route, and the full foreign-database-URL denylist (deploy-shaped wall).
- Step 11 provider-matrix tracker: `docs/releases/meerkat/render-provider-matrix.mjs` + rendered html (15 destinations x 13 ops + 9 scenarios, localStorage per release id, evidence JSON export, refuses multiple active ledgers, releaseId shape-guarded).
- Doc sync: runbook Step 7 service list (md + html twin), execution guide Step 7, dashboard re-render; rc17 ledger notes gained the merged-work section + follow-ups; errors_log rows for the two review findings.

## Review

- /review checklist pass caught the multiline-PEM dotenv defect (led to the _FILE loader).
- Fresh-context Claude adversarial subagent: P1 fake-ON entitlement rails (verified in code: HTTP seam defaults resolvers to null, bin wires none, authentic events would 400 while ready log said configured) -> honesty gate fix; P2 ASSN mount mechanism missing -> shipped as a secret; P2 PEM validation -> X509 parse-or-die; P2 tracker wrong-ledger binding -> multi-active refusal; P3s (stale run example, misleading OFF hint, test hardening) -> fixed. Edge-gating blast radius kept as-is: it matches the runbook's deliberate edge-blocking invariant shared by every stateful service.
- Codex adversarial: ACCOUNT_*/MEERKAT_* interpolation mismatch (fixed), ASSN mount gap (already fixed), tracker JS injection (fixed via shape guard), test slicing fragility (accepted; anchors fail loudly).
- Deferred follow-ups recorded in rc17-plan52-53-ledger-notes.md: account metrics listener, env-vs-file secret hardening, rate-limit posture, real payload resolvers before Step 10.

## Verification

- Full relay suite 1589 passed / 189 env-gated skips (twice: pre- and post-review fixes); topology + canary + account-http suites green; relay typecheck green; compose YAML parse + `docker compose config` (subagent) clean; real-bin boot checks: unreadable/invalid PEM -> fatal, valid file + unwired resolver -> honest OFF states.

## State at session log time

- Branch `worktree-meerkat-account-service-deploy`, 2 commits + bookkeeping, unmerged; merge decision with the founder (rc sequencing vs rc17 at cad7db07, GitHub Actions billing still blocking all verify dispatches).
