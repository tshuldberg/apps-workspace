# Meerkat security audit, 2026-09-04

Performed the requested comprehensive security/privacy review of the current dirty working tree at base HEAD 7a40639d1e364ee384f92f0debbd036d995e7b4c. Product code was read-only. The CSO skill supplied the audit and independent-verification method. No CodeRabbit, remote attack, deployment, commit or push occurred.

Canonical deliverable: [security report](../reports/REPORT-meerkat-security-audit-2026-09-04.md), with its self-contained [HTML twin](../reports/REPORT-meerkat-security-audit-2026-09-04.html). Six findings: two high, three medium, one low. Native exploitation of S5 remains conditional; S1 is source-traced, not an end-to-end exploit reproduction. Independent source reviews supported the principal candidates; one verifier failed before a final response, and the root agent independently completed S1's source trace without claiming a runtime proof.

## Files owned by this task

- New report Markdown/HTML and this session log.
- Updated docs/reports/README.md, docs/README.md, apps/meerkat/docs/README.md.
- Updated root memory.md and errors_log.md, preserving existing concurrent edits.
- Ignored local evidence: .gstack/security-reports/2026-09-04-meerkat/ (audit.json, source hashes, scanner reports, safe probes and test logs).

## Verification

Run from /Users/trey/Desktop/Apps/MyLife:

```sh
pnpm --filter @mylife/sync test
pnpm --filter @mylife/meerkat-app test
pnpm --filter @mylife/meerkat-web test
pnpm --filter @mylife/meerkat-relay test
pnpm --filter @mylife/meerkat-app --filter @mylife/meerkat-web --filter @mylife/sync --filter @mylife/meerkat-relay typecheck
pnpm check:parity
pnpm audit --prod --json
```

Results: 7,378 passed, 192 skipped; four typechecks passed. Full parity failed specifically because mobile/public-join-client.ts uses a hosted relay factory while web uses the raw backend. This arose in the concurrently changing tree and was recorded without modifying that product work. The npm advisory query returned seven high and two moderate workspace records; two image-size toolchain advisories map to Meerkat, and runtime exploitation was not established.

Gitleaks v8.30.1 was downloaded from the official GitHub release and checksum-verified. Root config proved to disable all detectors, so its clean history result was discarded. Reran with an explicit upstream default rule file: 566 commits (~49.95 MB), 25 raw candidates; 1,925 current source/config files (~19.83 MB), 22 candidates. Reviewed hits were fixtures, placeholders, expressions or comments, not established real secrets. No rotation was indicated.

To repeat the safe account fixture, use the existing relay tsx installation:

```sh
cd /Users/trey/Desktop/Apps/MyLife/packages/meerkat-relay
pnpm exec tsx /Users/trey/Desktop/Apps/MyLife/.gstack/security-reports/2026-09-04-meerkat/account-boundary-proof.ts
```

Expected: both synthetic weakness confirmations, exit 0. It uses in-memory account stores and genuine blind credentials, without network or real accounts. If imports fail after paths change, update the fixture's local source paths; do not substitute live services.

No function logic changed, so the function-change gate was skipped. Generated-artifact and report integrity results are appended below after generation.

## Remaining work and decisions

Remediate recipient authorization first. Resolve issuance/recovery unlinkability tradeoffs, require authentic provider age evidence, migrate private iOS storage, and validate preview image fetches. Repair Gitleaks and align parity. Repeat checks against an immutable release candidate. Physical devices, deployed services, native/container scans, real OAuth/storage deletion and restore, live role grants and logs remain unverified.

Scope was audit/reporting, so no speculative security fix was applied. Privacy limitations already documented in the account architecture, including renewal-time correlation, are separated from new defects in the report.

## Final artifact checks

`pnpm check:generated-artifacts` passed. Report local links, HTML self-containment, no-em-dash text, and memory length (77 lines) verified. HTML opened in the desktop browser. No product logic or unrelated changes were staged, committed or pushed.
