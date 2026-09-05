# Plan 39 Track D2 - Reconciliation + P13 Legal Pipelines + P14 Red-Team

Date: 2026-07-07
Branch: `track-d2` (worktree `.claude/worktrees/track-d2`, off the P12 operator-console branch)
Commits: `0910fd11` (merge1) + `b6b7ecc1` (fold) + `f367c8de` (P13) + `a13a9b92` (merge2) + `a6a87f3c` (P14)

## Scope

Track D wave 2: reconcile the P12 operator console with the A-B public-feed integration, then build P13 (legal pipelines) and P14 (hardening/red-team) against the integrated tree.

## Commit 1 - Reconciliation merge (`0910fd11` + `b6b7ecc1`)

Merged `feature/meerkat-public-base-feed` into `track-d2`. Conflicts:

- **`meerkat-persona-service.mjs`** (add/add): unified on the A-B integration base (port 8894, honest boot log, session-issuance humanity guard) and grafted the P12 persona-admin surface (`adminSecret`-gated `/persona/admin/*`) + the session TTL override.
- **Canonical env set** (exactly one name per secret): `MEERKAT_PERSONA_SESSION_SECRET`, `MEERKAT_PERSONA_ADMIN_SECRET`, `MEERKAT_PERSONA_SESSION_TTL_MS`. The bare `PERSONA_SESSION_SECRET` (A-B side) is gone; the P12-era `MEERKAT_PERSONA_HUMANITY_REQUIRED` dev-escape was dropped in favor of the base's hardcoded humanity-required posture. The MEERKAT_-prefix is the dominant convention across the meerkat bins (persona admin, app-unlock, operator console/authority, post receipt, humanity).
- **`persona-service-http.ts`** auto-merged both capabilities (adminSecret + sessionHumanityGuard); `memory.md` + P12 session log unioned.

Codex adversarial review of the merge found a real **P2 fail-closed deployment bug**: the community-node bin appended `/persona/session/verify` to `SESSION_VERIFY_URL`, while the persona-service doc + P12 log told operators to set it to `<base>/persona`, doubling the segment to `/persona/persona/session/verify` and refusing every public submit on a healthy service. Fixed (`b6b7ecc1`) by extracting `personaSessionVerifyEndpoint()` (pure, barrel-exported) that normalizes off a trailing `/persona` + slashes so both configured forms resolve to `<base>/persona/session/verify`; corrected the docs; added `persona-session-verify-endpoint.test.ts` (6 tests).

Suites green on the reconciled tree: relay 505, sync 1802, entitlements 77, meerkat app persona-core 27.

## Commit 2 - Second reconciliation merge (`a13a9b92`)

Ran the merge again to pick up P8 (The Commons provisioning) + P9 (verify-to-view read gate) which landed on the branch after the first merge base. Union resolution: kept the P13 `dmcaIntake` option AND the P9 `publicRead` gate in `community-node-http.ts`; kept the P12 console imports + P13 scanner/NCMEC/DMCA wiring AND added P9 `parseCommonsProvisioning` + `publicRead` in the bin. This put the read gate in the tree so the P14 red-team could attack it. Relay 548, app persona-core 35.

## Commit 3 - P13 Legal pipelines (`f367c8de`)

All code-side complete; vendor calls behind honest seams (real hash DB, NCMEC vendor, DMCA agent registration are founder-ops, P15).

- **CSAM hash-scan at the SUBMIT boundary** (`abuse-scan.ts` + `community-node.ts`): every public post carrying attachments is matched against a known-bad hash set (`AbuseHashScanner` seam) BEFORE countersign+append. FAIL-CLOSED for media: no scanner or a scanner outage refuses `503 scanner_unavailable`; a known-bad hash refuses `451 blob_rejected` and files NCMEC evidence. Text-only posts pass. `node.abuseScannerState()` reports honestly.
- **NCMEC report queue** (`ncmec-queue.ts` + `ncmec-queue-store-file.ts`): durable, idempotent, vendor seam (`NcmecFilingClient`, no real API). A submit scan-hit or an operator CONFIRMING (reviewed, not dismissed) a csam report enqueues an evidence-reference record. NDJSON export for manual filing; the console CSAM lane shows real counts and downloads the payload.
- **DMCA intake** (`dmca-intake.ts` + file store + `POST /public/dmca/notice`, public, rate-limited, zod-validated): operator-console DMCA lane with takedown (tombstone claimed posts), counter-notice, reject, all audited. A takedown with unresolved items (URLs/unknown ids) keeps the claim actionable + durably tracked. Registered-agent block is a founder-fill placeholder constant.
- **GDPR delete end-to-end AC-5** (`gdpr-deletion.ts` coordinator): one persona-signed delete drives alias release + 30-day block + session revoke + tombstone all the persona's posts + purge flood counters + release the sticky app-unlock persona binding (resolves the Track B founder flag) + purge console triage rows; the append-only audit log REMAINS. Fail-closed gate: a bad-signature delete purges nothing. e2e proves the whole chain.

The community-node bin wires all four pipelines with honest boot logs. Relay 540 tests (+29 P13). Codex review found 3 real correctness bugs, all folded:
1. NCMEC console export marked records exported but the page discarded the NDJSON payload -> now downloads it before marking exported.
2. Dismissing a csam report still enqueued NCMEC (checked reason, ignored status) -> gated on `status === 'reviewed'`.
3. A DMCA takedown with unresolved items was marked `actioned`, dropping unresolved work out of the queue -> stays `received` (actionable) + persists `unresolvedItems` when anything is unresolved.

## Commit 4 - P14 Hardening + red-team (`a6a87f3c`)

`plan39-red-team.test.ts` - 23 adversarial attacks, all fail closed:
- Forged persona/receipt/dual-signature + domain confusion (wrong key, transplanted signature, session!=author, GDPR-delete sig replayed as a session challenge, stranger-signed tombstone).
- Session fixation/replay + P9 read-gate bypass (expired/wrong-secret/tampered/revoked bearers, revocation-store error fails closed, gated-read rejects no-token/garbage/expired/wrong-secret while a valid session passes).
- Humanity token double-spend race (20 concurrent redeems, exactly one wins).
- Entitlement spoof (unbound/cross-persona/wrong-secret/tampered proofs rejected).
- Flood/rate-cap bypass (parallel submits capped, oversized body 413).
- Alias squat/homoglyph (concurrent register over a durable store -> one atomic winner, case-fold collision, reserved word, 30-day block).
- Console interleave (a GDPR-deleted persona can't be unsuspended back to life).

No product bug was exposed; every guard held (the primitives were already fail-closed). The 3 initial red-flags were test-harness mistakes in my own assertions, not security holes. Codex blind-spot review found no gaps. Relay 571 tests.

## Canonical env set (final)

- `MEERKAT_PERSONA_SESSION_SECRET` (required, fatal if unset)
- `MEERKAT_PERSONA_ADMIN_SECRET` (operator admin routes; unset => 503 admin_not_configured)
- `MEERKAT_PERSONA_SESSION_TTL_MS` (optional session lifetime override)
- Session verify wiring: community node `SESSION_VERIFY_URL` = persona service BASE (e.g. `https://accounts.example`); a trailing `/persona` is tolerated.
- New P13 env on the community node: `MEERKAT_ABUSE_HASH_FILE` (known-bad hash list -> real scanner) or `MEERKAT_ABUSE_SCANNER=unavailable` (honest placeholder). Unset => media submits fail closed 503.

## P15 founder-ops additions (never faked in code)

- NCMEC CyberTipline vendor onboarding + a real `NcmecFilingClient`. Until then the founder exports the durable queue (NDJSON) and files manually.
- DMCA designated-agent registration with the U.S. Copyright Office; fill `DMCA_REGISTERED_AGENT` placeholder fields.
- CSAM/abuse scanner hash-DB provisioning (`MEERKAT_ABUSE_HASH_FILE` or a real matcher); until then media submits fail closed.
- Cross-process GDPR delete coordinator wiring (persona service + community node + hosted billing are separate deployables); the coordinator's seams run in-process today (proven by the e2e) and take HTTP clients for a multi-box deploy.

## Founder flags

- GDPR delete releases the app-unlock persona binding so the same $4.99 purchase can rebind after deletion (resolves the recorded Track B flag) - NC-P5 respected, no new SKU.
- The persona-service humanity posture is now hardcoded fail-closed (the P12 dev-escape env was dropped); self-host dev registries that relied on it must wire a humanity verify URL.

## Verification

- Relay 571, sync 1802, entitlements 77; typechecks clean; function gate green; community-node bin boots with honest logs.
- 4 codex findings folded (1 reconcile P2 + 3 P13); logged in `errors_log.md`.
- Tree clean; NEVER pushed; worktree preserved.
