# Meerkat Plan 41 Completion Audit and Remediation Re-Audit

Date: 2026-07-15

Original audited implementation: `feature/meerkat-plan41-storage` at `a788a11a`

Remediation commit: `f29ab80d`

Integrated verification commit: `6b70b994`

Code decision: **PASS for the integrated candidate**

Production release decision: **NO-GO pending founder-operated evidence**

Original finding disposition: **7 high resolved, 0 high open, 0 new critical or high findings**

## Executive verdict

The seven high-severity findings from the first review are resolved in code. The remediation wires every destination into real product paths, includes recovery identity and all selected blobs in production backups, bounds backup memory through durable payload stores, resumes jobs after router reconstruction, makes web rollback force a controlled reload after the active database closes, and moves browser WebDAV/S3 persistence into KMS-backed broker custody. The Plan 41 and Plan 43 lines are combined in the reviewed integration candidate at `6b70b994`.

The production launch verdict remains NO-GO. That is now an evidence and operations verdict, not an open Plan 41 code-finding verdict. Real OAuth registrations, a signed iCloud build, physical-device provider tests, deployed KMS and broker infrastructure, live restore drills, browser QA, store disclosures, and publication evidence were not available in this workspace and are not inferred from automated tests.

The original audit remains part of this report's history. The table below records each finding, the implemented correction, and the verification that changed its disposition.

## Scope and method

The re-audit reviewed the original packet range, remediation diff `07dce07a..f29ab80d`, and Plan 43 integration merge `6b70b994`. It inspected the product registries and connect flows, backup sources, router persistence, restore activation, broker/KMS boundary, migration ordering, and merge-conflict resolutions. Verification included all relevant typechecks and lints, five full package suites, mobile and web production builds, focused adversarial tests, transport negative controls, Meerkat parity, full workspace parity, the generated-artifact guard, and the function-quality gate.

No live provider credentials, signed iCloud build, physical devices, deployed PostgreSQL/KMS/S3 environment, or publication evidence were present. Environment-gated relay integration tests remain skipped and must be run in the founder-operated evidence phase.

## Finding disposition

| Finding | Status | Remediation and evidence |
|---|---|---|
| H1. Plan 41 was absent from the product integration line | **Resolved for integrated candidate** | `6b70b994` merges the complete Plan 43 tip `eaf69b18` into the remediated Plan 41 line. The merge preserves web push, transport diagnostics, archive intake, NCMEC, DMCA, hosted storage, OAuth broker, and storage UI. PostgreSQL migration collisions were resolved contiguously: hosted storage 13, OAuth broker 14, NCMEC filing 15, archive pin cursor 16. Full package and repository gates pass on the combined tree. Promotion to `main` remains a branch-governance step, not an unmerged feature dependency inside this candidate. |
| H2. Destination configuration was incomplete | **Resolved in code** | Mobile now uses native PKCE through `expo-auth-session` for Google, Dropbox, OneDrive, and Box, keeps secrets in SecureStore, and exposes iCloud, file provider, hosted storage, and connected server when configured. Web and mobile configured registries create hosted and connected adapters instead of permanent `null` factories. Foreground and background jobs share the same configured mobile registry. Product-flow, source, registry, broker, and negative-control tests pass. Missing provider registrations still produce an honest unavailable state. |
| H3. Production backups omitted identity and blob bytes | **Resolved in code** | Mobile and web backup runners now export a recoverable identity, enumerate the blob store including zero-byte objects, and stream database plus object classes into the backup. Production round-trip tests create a backup through the real runner and restore it through staged activation. Mobile tests also prove missing identity and missing required blob failures close. |
| H4. Backup orchestration retained the entire encrypted backup in memory | **Resolved in code** | Mobile uses a filesystem-backed payload store and web uses Blob/IndexedDB payload storage. The router plan retains descriptors, not every ciphertext buffer, and loads one payload at a time for upload and verification. Staged buffers are zeroed in `finally` blocks, including persistence failures. The adversarial 256 MiB streaming case and router/function gates pass. |
| H5. Persisted jobs could not resume after router reconstruction | **Resolved in code** | Router cursor v2 persists rehydratable job metadata and staged ciphertext references. A new router can reconstruct the executable context from the same database and payload store. Corrupt or legacy cursor state fails honestly. The restart test destroys the first router, creates a fresh router, and resumes the job to verified completion. |
| H6. Failed web activation left the active database handle closed | **Resolved in code** | Web activation now reports `activeDatabaseClosed` for every failure after close. The UI forces a controlled reload after rollback instead of returning to a live tree with a dead adapter. A fault-injection test passes a real active database handle, triggers post-close activation failure, verifies rollback, and verifies the forced-reload contract. |
| H7. Browser WebDAV/S3 secrets persisted in a same-origin vault | **Resolved against the binding custody decision** | New connections place WebDAV, S3, and connected-server secrets into the relay broker, where KMS envelope encryption is bound by subject and AAD. Browser storage retains only `broker://` references. Existing local-vault entries migrate one way, with rollback and broker revocation on failure, and local deletion occurs only after all shared references migrate. Each adapter operation requests the credential with its exact operation label; subject isolation, rate limits, tokenless audit, session metadata, revocation, KMS context, and deletion are test-pinned. |

## H7 trust-boundary clarification

WebDAV passwords and static S3 keys are long-lived credentials by nature. The broker returns the static secret to the browser for one requested operation and records a bounded operation session, but the session expiry does not cryptographically expire a secret after delivery. The material is transient in browser memory and is no longer persisted by the browser. This satisfies the Plan 41 browser-persistence decision and materially improves custody, but it is not equivalent to provider-issued temporary credentials. S3 deployments should prefer STS-style temporary credentials where supported, and the production disclosure and threat model must state this distinction exactly.

## Acceptance-criteria assessment after remediation

| Criterion group | Code status | Remaining proof |
|---|---|---|
| AC-41.1 | Pass in configured product code | Live authorization and reconnect matrix for each provider. |
| AC-41.2 to AC-41.4 | Pass in automated evidence | Live diagnostics and provider checksum observations. |
| AC-41.5 | Native module and product path pass automated checks | Signed iCloud entitlement build and physical iPhone backup/restore. |
| AC-41.6 to AC-41.8 | Product paths and conformance tests pass | Real Google, Dropbox, OneDrive, Box, SAF, Files, and browser-directory accounts/devices. |
| AC-41.9 | Adapter, SigV4, broker custody, migration, and operation-label tests pass | Live WebDAV/S3 compatibility, outage, rotation, and revoke evidence. |
| AC-41.10 | Hosted and connected product/server paths pass | Deployed signed descriptor, KMS, tenant isolation, quota, and deletion proof. |
| AC-41.11 | Pass | Live mirror interruption drill. |
| AC-41.12 | Pass in staged restore and rollback tests | Fresh-install and post-upgrade restore drills on release builds. |
| AC-41.13 | Pass in automated revoke, deletion, and restart-resume evidence | Live account switch, provider revoke, and recovery drill. |
| AC-41.14 | Code custody and disclosure surfaces align | Final privacy/store copy approval and publication. |

## Verification results

All final commands ran against integrated commit `6b70b994` in the isolated worktree.

| Verification | Result |
|---|---|
| `@mylife/sync` typecheck, lint, full test | Pass, clean lint, 186 files and 2,245 tests. |
| `@mylife/meerkat-relay` typecheck, lint, full test | Pass, clean lint, 185 files and 1,386 tests; 33 files and 180 live-environment tests skipped. |
| `@mylife/meerkat-app` typecheck, lint, full test | Pass, 127 files and 1,299 tests. |
| `@mylife/meerkat-web` typecheck, lint, full test | Pass, 119 files and 887 tests. |
| `@mylife/meerkat-icloud-storage` typecheck, lint, test | Pass, 1 file and 6 tests. |
| Combined package total | Pass, 618 files and 5,823 tests. |
| Mobile production export | Pass for iOS and Android. Metro retains the dependency-level `event-target-shim` exports fallback warning. |
| Web production build | Pass. Vite retains dependency externalization, dynamic/static import, and chunk-size warnings. |
| `pnpm check:meerkat-transport-nc` | Pass, including all planted negative controls. |
| `pnpm check:meerkat-parity` | Pass. |
| `pnpm check:parity` | Pass. |
| `pnpm check:generated-artifacts` | Pass. |
| `pnpm gate:function:changed` and staged pre-commit gate | Pass, including consumer mobile/web typechecks. |
| `git diff --check` | Pass. |

The first relay run shared the host with three other full Vitest suites and produced two SIGTERM status-143 assertions. Both process-boundary files passed immediately in isolation, and the complete relay suite then passed alone at normal package concurrency. No product failure reproduced.

## Additional integration quality corrections

The re-audit also corrected three merge-quality issues outside the original H1 through H7 implementation:

- Removed a duplicate `PostgresObjectDeletionJobStore` barrel export found by the first integrated typecheck.
- Renumbered Plan 43 migrations to 15 and 16 instead of allowing duplicate versions 13 and 14.
- Removed seven unused-import warnings from the touched Plan 41 and Plan 43 adversarial tests, leaving the relevant package lints clean.

## What remains strong

- Backup Format v1 retains deterministic golden vectors, typed corruption failures, zeroization, and streaming decode.
- Completion remains verification-gated; mirror failure cannot invalidate a valid primary.
- Provider adapters retain redirect refusal, resumable offsets, conflict rereads, provider-specific checksums, SigV4 vectors, and multipart abort behavior.
- OAuth and credential broker flows retain PKCE, state consumption, exact redirect allowlists, KMS envelopes, subject binding, rate limits, tokenless audit, and revocation.
- Hosted storage retains tenant isolation, ciphertext verification, quota accounting, deletion jobs, and signed connected-server challenge flow.
- Restore remains staged and journaled, with explicit recovery behavior on both native and web.
- Retention, repair, credential rotation, account deletion, discovery, scheduling, and foreground/background registry parity are now connected to the production paths they support.

## Remaining production launch gates

1. Register and approve production OAuth clients and redirect URIs for Google, Dropbox, OneDrive, and Box.
2. Produce signed iOS and Android builds, including the iCloud entitlement, and execute the physical-device matrix.
3. Deploy the broker and hosted services with real KMS, PostgreSQL, TLS, object storage, rate-limit, audit, backup, and recovery configuration.
4. Run each provider's authorize, write, verify, list, quota, interruption, resume, revoke, migrate, delete, and fresh-install restore journey.
5. Run live browser CSP, custody, reconnect, rollback/reload, and cross-device restore QA.
6. Run Plan 44 backup/restore, failover, canary, load, soak, and release-evidence ladders on the exact release SHA.
7. Approve and publish privacy, broker metadata, provider metadata, and store disclosures.
8. Promote the verified integration candidate through the normal protected branch and release workflow without bypassing CI.

## Final assessment

Plan 41's code remediation is complete on the integrated candidate. The seven original high-severity findings are closed with implementation and regression evidence, and no new critical or high code finding was identified in the re-audit. The honest final state is **code PASS, production launch NO-GO until founder-operated evidence is collected on the exact release candidate**.
