# 2026-07-11 Meerkat Plan 44 Phase 6 Completion

**Branch:** `feature/meerkat-production-readiness-2026-07-09` (pushed to origin)

**Commits:** `e2d936b8` (execution contract), `0ace4d39` (WP-6A), `9c7cce59` (WP-6B), `440f9218` (memory-gate test fix), `c229cf81` (WP-6C), plus review-catch docs commits (`d286f253`, `33a5baa6`)

**Launch status:** Production NO-GO (unchanged)

## What was done

Plan 44 Phase 6 (supply chain and complete images) is code-complete in three work packages, each built by a fresh Opus agent against the committed execution contract, then lead-reviewed, Codex-adversarially reviewed per founder instruction, hardened, and battery-verified before commit.

### WP-6A (`0ace4d39`): signed release image supply chain

- All four production Dockerfile bases digest-pinned against live-registry digests (verified independently by the lead).
- `release-images.yml` builds relay, platform, hosted, and verification images tagged by immutable git SHA (never `latest`), and per image: SPDX SBOM, a BLOCKING Grype scan (fixed findings at high+ unless excepted) plus an INFORMATIONAL full-severity scan so the only-fixed filter never hides evidence, SLSA provenance attestation, and Cosign keyless signing via GitHub OIDC. Every third-party action pinned to a lead-verified full commit SHA. Elevated permissions scoped to the build job.
- The vulnerability exception file is audited structurally in CI: every ignore entry requires vulnerability, reason, package.name scope, and an unexpired per-entry expiry.
- The final job emits a WP-6B-schema-shaped draft release manifest (configSchemaDigest = sha256 of compose.production.yml); recording and approval are founder-ops. The old unsigned publish workflow is a loud failing stub.

### WP-6B (`9c7cce59`): release manifest schema and NC-44.4 gate

- Strict zod schema for `ops.release_manifests.manifest`: digest-pinned unique image entries with SBOM/scan/attestation/signature refs, migration range, config digest, honestly-nullable founder-supplied mobile/web slots. Tag-only refs rejected at parse time.
- `meerkat-release` CLI: immutable `--record` (idempotent replay exit 0; a conflicting manifest under an existing id exits 1 with both digests), one-shot CAS `--approve`, and `--verify` which fails an unapproved manifest and detects post-record SQL tampering by recomputing the canonical digest against the recorded `manifestDigestHex`.
- Stated boundaries: the gate proves membership and pinning; cryptographic signature verification runs at deploy time via cosign (founder-ops), and deploy-ref completeness is operator-attested.

### WP-6C (`c229cf81`): promotion ladder, canary verdict, honest rollback

- `ops.release_promotions` (migration 11): immutable transition rows with a total insert order (`seq`), pairwise transition CHECK, and a DB-level rollback-honesty CHECK. States: staging, staging_canary, production_canary, production, rolled_back (terminal).
- The promotion store lease-FENCES the insert and refuses: unapproved releases, rung skips, stale from-states, rollbacks to unapproved / non-earlier / already-rolled-back targets, unprovable ordering (fails closed), and data-reversal claims smuggled at any depth or type shape. Every rollback row records that images re-point and the database is never un-written (NC-44.5).
- The promotion CLI records transitions the operator performed and never deploys; canary rungs hard-require evidence ending in a `verdict:"ok"` line, NDJSON attached in full.
- `canary-verdict.mjs` aggregates the real synthetics fail-closed: zero, skipped-only, unknown-verdict, or malformed-spec conditions all fail.
- Three founder-triggered checklist-rail workflows (staging deploy, canary promotion, emergency rollback) validate input format before rendering, and record nothing; the release-promotion runbook covers the ladder, decision criteria, rollout stop, emergency rollback, and the founder-ops boundary, with cosign verification pinned to this repo's release workflow identity.

## Adversarial review results (Codex, per founder instruction)

- WP-6A/6B: 8 P1 + 3 P2 findings, all fixed pre-commit (manifest tamper detection, duplicate-record exit honesty, exceptions-audit structural enforcement, only-fixed disclosure plus full-scan artifact, unscoped-ignore refusal, duplicate-pin rejection, job-scoped permissions, stated gate boundaries).
- WP-6C: 13 findings; 11 fixed pre-commit (see errors_log.md), DB-level continuity documented as a stated trust boundary consistent with every proof table in the repo.
- Lead review additionally caught the unfenced promotion insert (same class as the Phase 5 backup-store defect), the wildcard cosign identity, and the malformed-spec coverage hole before Codex ran.

## Test-infrastructure fix (`440f9218`)

The roles memory-budget gate failed 2 of 3 isolated runs; the Phase 5 close-out had called it a transient flake. Root cause: `assertMemoryBudget` never forced GC without `--expose-gc`, measuring collection timing instead of the function. Fixed with a runtime GC handle plus a min-of-attempts fallback; five consecutive isolated runs green.

## Verification (lead-run before every commit)

| Gate | Result |
|---|---|
| Relay typecheck | Passed |
| Full relay suite | 1104 passed, 147 skipped |
| Live PostgreSQL 17 (55444) | 136 passed, including release-manifest and promotion state-machine integration suites |
| Live S3 (MinIO 55490) | 10 passed |
| Workflow YAML | All new/changed workflows parse |
| Production compose config | Passed |

## Honest boundaries

- Workflows and manifests are repo-owned and testable; the first RUN of the signed pipeline against GHCR with real OIDC, manifest recording/approval, deploys, canary cohort choices, and rollback drills are founder-ops evidence recorded through the release and promotion stores.
- AC-44.9 and AC-44.10 are satisfied to the workflow-definition level; AC-44.11's tested canary/rollback against real infrastructure belongs to Phase 7 rehearsal plus founder-ops.

## Remaining Plan 44 work

Phase 7 (production rehearsal tooling and runbooks). Meerkat remains production NO-GO.
