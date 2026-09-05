# 2026-07-06 - Meerkat Plan 39 P12: Operator Moderation Console

**Branch:** `worktree-agent-a6eda8f0bdc81e10e` (worktree of `feature/meerkat-public-base-feed`, fast-forwarded to the Track A+B merge `eaa8d3c0`)
**Commit:** `758e04cf`
**Scope:** Track D wave 1, phase P12 only (P13 legal pipelines and P14 red-team run later against the integrated tree).

## What was built

The first-party Trust & Safety web console (report W-2 buildout), served by the community node on a dedicated admin port:

- `packages/meerkat-relay/src/operator-console.ts` - `OperatorConsoleService`: report-queue triage over the real Plan 19 P8a intake rows (reason filters, csam/illegal priority lane, reportKey = sha256(report signature)), operator-signed post tombstones through the Track B path, posting freeze/unfreeze, Plan 19 descriptor kill (+ paired freeze), persona suspend/unsuspend through a `PersonaAdminClient` seam (in-process or HTTP), persona status + post history, publications overview. Every count is a real store count (NC-P6); every success follows a real node/store verdict, refusals are surfaced and audited (NC-P4).
- `packages/meerkat-relay/src/operator-console-store-file.ts` - durable `FileOperatorConsoleStore`: APPEND-ONLY `audit.log` (JSONL, monotonic seq, O_APPEND, torn-tail newline repair, serialized appends) + serialized `triage.json` decisions.
- `packages/meerkat-relay/src/operator-console-http.ts` - admin HTTP surface: static console page at `GET /`, JSON API under `/api/*`, `Authorization: Bearer` with constant-time compare, 503 `console_not_configured` on every API route when unconfigured, default bind `127.0.0.1`, no CORS, strict CSP on the page, bounded bodies with drain-before-error-response.
- `packages/meerkat-relay/src/operator-console-page.ts` - self-contained console page (dark theme, lanes: Report queue, CSAM lane, Personas, Publications, Audit log; queue cards with Remove post / Suspend persona / View history / Dismiss reports; action-detail rail + SLA + "Every console action emits a signed audit event. No silent moderation."). Honest states: locked, unconfigured, unreachable, empty. Verified live in Chrome (unlock, queue render with real counts, tombstone via UI, audit lane, persona lookup + suspend).
- Persona registry (Track A files, documented seam): `PersonaRegistryStore.unrevoke`, `suspendPersona` / `unsuspendPersona` / `personaAdminStatus(+ByAlias)` on `PersonaRegistryService`, per-persona lock serializing delete/suspend/unsuspend. Unsuspend refuses GDPR-deleted personas (`not_registered`).
- Persona service HTTP: operator admin routes `/persona/admin/suspend|unsuspend|status`, gated by `adminSecret` (503 `admin_not_configured` when unset, 401 wrong bearer, constant-time).
- Bins: `meerkat-community-node.mjs` starts the console when `MEERKAT_OPERATOR_CONSOLE_SECRET` is set (operator authority seed derives the trusted kill authority; a mismatch with `TRUST_AND_SAFETY_AUTHORITY_DEVICE_ID` is fatal); new `meerkat-persona-service.mjs` deployable (+ `start:persona-service`).

## Env (deploy contract)

Community node: `MEERKAT_OPERATOR_CONSOLE_SECRET`, `MEERKAT_OPERATOR_AUTHORITY_SEED` (64 hex), `ADMIN_PORT` (8891), `ADMIN_HOST` (127.0.0.1), `PERSONA_ADMIN_URL`, `MEERKAT_PERSONA_ADMIN_SECRET`.
Persona service: `MEERKAT_PERSONA_SESSION_SECRET` (required, fatal if unset), `DATA_DIR`, `HUMANITY_VERIFY_URL`, `HUMANITY_SERVICE_PUBLIC_KEY` (session-issuance guard), `MEERKAT_PERSONA_ADMIN_SECRET`, `MEERKAT_PERSONA_SESSION_TTL_MS` (optional), `PORT` (8894). Community node `SESSION_VERIFY_URL` should be the persona service BASE url (e.g. `https://accounts.example`); the node appends the absolute `/persona/session/verify` route. A trailing `/persona` is normalized off, so the older `{base}/persona` form also works, but base is canonical. (Reconciliation, Track D2: the persona bin unified on the A-B integration base - registration + session issuance are hardcoded humanity-required/fail-closed; the P12-era `MEERKAT_PERSONA_HUMANITY_REQUIRED` dev escape was dropped, canonical port is 8894.)

## Suspend seam (exact)

Suspend writes the same durable revocation flag GDPR delete uses (`PersonaRegistryStore.revoke`). The submit route's injected verifier (`createPersonaSessionVerifier({ secret, isRevoked })`) consults it per request, so live bearers die instantly and issuance is refused; unsuspend clears it via the new `unrevoke` (never for deleted accounts). Proven e2e with the REAL verifier over a shared `FilePersonaRegistryStore`.

## Verification

- 41 new tests: `operator-console.test.ts` (15), `operator-console-http.test.ts` (13, auth matrix on every route, IDOR, audit tamper, fail-closed unconfigured), `operator-moderation-console-e2e.test.ts` (4, full stack: gated submit -> report -> tombstone gone on next page fetch -> suspend blocks live session -> unsuspend -> freeze -> kill -> append-only on-disk audit), `persona-admin.test.ts` (5), `operator-console-store-file.test.ts` (4, triage serialization, torn tail, delete/unsuspend race invariant).
- Relay suite 500/500 (75 files); `pnpm gate:function:changed` exit 0; `pnpm check:parity --quiet` exit 0; tsc clean.
- Confirmed `scripts/check-meerkat-parity.mjs` scopes to `apps/meerkat(+web)`; console strings intentionally NOT parity-locked (operator surface).
- Live browser pass via chrome-devtools on a seeded stack: unlock, queue, UI tombstone (toast from real verdict, queue 2 -> 1, audit row), audit lane, persona lookup + suspend.

## Codex review findings folded (all fixed + regression-tested)

1. P1: unsuspend racing GDPR delete could clear the delete's revocation -> per-persona lock + post-unrevoke row recheck.
2. P2: concurrent triage decisions lost via triage.json read-modify-write -> serialized write chain.
3. P2: torn audit tail swallowed the first post-restart row -> newline repair on first append.
Also fixed from my own browser pass: alias persona lookup listed ALL posts unfiltered (misattribution); now filtered by the resolved persona key.

## Founder-ops items for P15

- Mint + store `MEERKAT_OPERATOR_CONSOLE_SECRET`, `MEERKAT_OPERATOR_AUTHORITY_SEED`, `MEERKAT_PERSONA_ADMIN_SECRET`, `MEERKAT_PERSONA_SESSION_SECRET` (keychain), set them on the community-node + persona-service deploys.
- Deploy `meerkat-persona-service` alongside the community node; point `PERSONA_ADMIN_URL` + `SESSION_VERIFY_URL` at it.
- Expose the ADMIN port only via loopback/VPN/TLS edge; it deliberately defaults to 127.0.0.1.
- CSAM lane SLA is policy, not yet pipeline: NCMEC reporting lands in P13; until then escalation is a runbook step (console copy says so honestly).
- Operator authority key custody: the authority seed IS the network-wide kill authority; treat like the humanity service key.

## Remaining in Track D (not P12)

P13 (CSAM hash-scan extension at submit, NCMEC vendor seam, DMCA intake + registered agent, GDPR delete e2e wiring to post tombstones) and P14 (red-team) run against the integrated tree. The console's DMCA lane and topic-rules editing intentionally wait for P13/P8 so no fake lanes ship (NC-P6).
