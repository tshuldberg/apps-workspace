# Meerkat storage and workflow remediation, 2026-09-04

## Scope and provenance

Continued the current September 4 production review against `7a40639d1e364ee384f92f0debbd036d995e7b4c`. HEAD stayed there. Preserved the existing report/archive/settings/research changes. A concurrent session completed release-guard and permission-copy work, recorded in [its log](2026-09-04-meerkat-release-guard-polish.md); this session retained that work and added an explicit accepted release capability declaration. No commit, push, deployment, purchase, account-access change, or external message was performed.

## F1: authoritative browser writer

- `browser-database-adapter.ts` takes a lifetime Web Lock before loading SQLite. Browser boot initializes the secret vault under the same ownership boundary. A competing tab opens no database or transport engine and shows an explicit blocked screen.
- `Open here` reloads and attempts ownership after the prior tab closes. Ownership is never stolen or expired by a timer. Browsers without Web Locks fail closed with recovery guidance.
- IndexedDB version 5 fences old version-4 clients: their existing version-change handler closes their connection, and a subsequent version-4 open fails. A legacy client that refuses to close blocks the upgrade rather than permitting two writers.
- Final close waits for persistence and actual lock release. A failed close retains the database, pending revisions, and ownership. Restore closes the old image while retaining ownership until its required reload; resets also retain ownership through deletion. Isolated in-memory restore/verification images have separate ownership scopes.
- Transactions commit or roll back as a unit. A read-shaped query cannot mutate SQLite. The schema, signed rows, and deletes remain whole-image SQLite semantics, with one authoritative image.

**F1 acceptance:** deterministic second-writer rejection, inserts/deletes/rollback/takeover, failed boot release, read-path mutation rejection; real shared-IndexedDB tabs, blocked UI and takeover, reload, legacy-version fencing, and Chromium renderer crash. Actual signed-message/identity-key takeover is also tested. The original adapter fails the new unit and real-browser exclusion tests. Chromium crash preserves the last flushed revision; the deliberately pending revision is lost and was never reported saved.

**Limit:** synchronous edits remain memory-only until asynchronous persistence finishes. A forced process kill can lose visibly pending edits. Browser eviction, private-mode lifetime, physical storage failure, and deliberate site-data deletion are not backup guarantees. On rollout, users with unsaved legacy tabs should save/export and close them before opening the new version; the version fence prevents stale overwrites, but cannot make legacy in-memory work durable.

## F2: bounded persistence and honest recovery

- Database revisions track pending versus durable work. One in-flight writer drains revisions that arrived during a successful save. Failure retains all revisions and rejects `flush()`.
- At most four automatic attempts, with 1/2/4-second backoff. Further ordinary flush calls cannot restart an exhausted budget. Explicit `retryPersistence()` is the recovery action.
- A visible saving/unsaved surface provides retry and a pending SQLite export. The export explicitly contains unencrypted local messages, excludes keys/attachments, and is not a complete backup. Browser unload prompts protect pending work where supported.
- Database persistence first flushes the secret vault, preventing durable rows from referencing newly created keys still only in memory. The independent vault retains its merge/key-mismatch protection, now stops after four automatic failures with 0.5/1/2-second backoff, exposes explicit retry, and warns on unload with pending keys.
- Background callers consume rejected flush promises while the central state reports failure. Callers awaiting durability still receive rejection.

**F2 acceptance:** permanent injected quota failure stops, repeated ordinary flush calls stay bounded, transient failure backs off and recovers, manual recovery persists retained changes, changes during successful and failed writes survive, close rejects without relinquishing ownership, and vault failure prevents database persistence. Browser UI/export/retry are exercised over real IndexedDB. Original unit and browser controls produced 21 immediate attempts and a falsely successful flush; fixed controls reject after the first failed attempt. Quota errors are injected, not a disk-filling exercise.

## F3/F4: release controls and evidence

The concurrent F3 fix resolves actual EAS distribution and profile inheritance, including TestFlight, and fails unknown profiles closed. Production now explicitly declares `MEERKAT_RELEASE_CAPABILITIES=full-platform`; an unsupported private-only declaration fails. This does not authorize a private-only release. Such a lane still needs matching runtime capability gates and copy before relaxing requirements. Required missing configuration remains an error, not a placeholder service.

The retained native pin is grounded in commit `46bb6ccf` and the concurrent session's inspection, not an assumption that the newest image works. F9's generated native permission text was inspected in that session. Neither is a fresh signed binary or physical permission-sheet result.

Read-only GitHub inspection still returned `enabled:false`. Latest listed Release Verify: [cancelled August 1](https://github.com/tshuldberg/MyLife/actions/runs/30716741802), SHA `43a357a3d8f761207d6400ddaf78beccea6bcc2b`. Local review found the existing workflow already includes PostgreSQL, S3-compatible storage, browser, image, and security jobs. No remote settings were changed and no workflow was dispatched. The current cause of Actions being disabled is unconfirmed.

### Remaining owner action for Release Verify

These steps require repository administration and a separately approved, committed candidate. The agent did not perform them.

1. In [MyLife > Settings > Actions > General](https://github.com/tshuldberg/MyLife/settings/actions), the administrator should find `Actions permissions`. Select the policy permitting selected actions (`Allow tshuldberg, and select non-tshuldberg, actions and reusable workflows`). The selection exposes allowed-action controls. Done when the selected policy permits the exact action references in `.github/workflows/release-verify.yml`; if controls are unavailable, the account or organization administrator must resolve the governing restriction. This policy choice belongs to the owner. [GitHub's policy documentation](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository).
2. On that same page, in the selected-actions controls, permit the checked-in references for `actions/checkout`, `actions/setup-node`, `pnpm/action-setup`, and `google/osv-scanner-action/osv-scanner-action`. For the current workflow, the exact values are `actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5`, `actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020`, `pnpm/action-setup@02f6c237bd2518259fed6c71566509edfb3f2b74`, and `google/osv-scanner-action/osv-scanner-action@19ec1116569a47416e11a45848722b1af31a857b`. Verify these still match the candidate, then click `Save`. Done when `gh api repos/tshuldberg/MyLife/actions/permissions` reports `enabled:true`. If saving is rejected, resolve the reported policy/access restriction; do not assume billing is the cause or broaden permissions without owner approval.
3. In [MyLife > Actions > Release Verify](https://github.com/tshuldberg/MyLife/actions/workflows/release-verify.yml), find `Run workflow`. After the candidate is committed and available remotely, select the branch containing the workflow and enter its exact 40-character commit SHA in the required `sha` input, then click `Run workflow`. A run appears in the list. Done when all required jobs actually execute and pass against that SHA, with the run URL attached to the candidate ledger. If a run is rejected or a job is skipped, inspect that run's reason and keep the release blocked. Local logs do not substitute for it.

## F5/F6: invitation and catch-up fixes

- Added byte-identical `invitation-intent-core.ts` twins and a parity lock. Intent is device-local in `mk_settings`, bounded before storage, and never itself grants trust, membership, or transport consent. Clearing an older invitation cannot clear a newer one.
- Mobile captures links even before purchase unlock; age and purchase gates still control preview. Both surfaces retain invitation intent through setup and restart. Web accepts a fragment-only handoff, keeping invite contents out of HTTP request URLs. A return action opens the existing verified preview, and a separate discard action clears it. Store installation is not assumed to preserve a link: return to the original invitation or paste/scan it again when the OS does not hand it back.
- Purchase screens acknowledge a waiting invitation. Web persistence failures retain the original fragment and surface unsaved storage state. The browser acceptance test loses the URL during a simulated purchase return and resumes from IndexedDB, with a fixture entitlement response only.
- Both queue providers persist pending approval retry intent before the first network attempt, including offline/failed attempts. Existing signed transport restrictions and missing-owner-key refusal still run first.
- Pending join notices distinguish local addition and queued approval from full membership/history access. Existing verified receipt code remains the source of delivery claims; no receipts were synthesized.
- Invite previews now expire while open and remove the Join action. Signatures are verified on initial preview and again in the actual join path, without re-verifying the entire descriptor every timer tick.
- Friend-code QR/copy appears only after a real publication acknowledgement. Copy explicitly says one use, server-controlled expiry, and possibly consumed/expired status. The protocol does not return an expiry timestamp, so no guessed countdown is shown. Publication remains explicit and sealed; no standing globally discoverable identity was introduced.
- Onboarding exposes the existing opt-in automatic-connection control. `Catch up now` runs the existing real round and shows a recoverable error. Background/push defaults and mandatory safety checks remain unchanged.

**Limits:** no new universal-link association, standing friend invitation protocol, camera scan implementation for web, true store-install handoff, physical purchase, sleeping-owner/device return matrix, background delivery, or stranger study is claimed. These remain F5/F6 acceptance work. The browser test proves durable intent plus failed-first-park retention; mobile has local tests, type checks and parity, not signed-device navigation proof.

## F7/F8/F10 disposition

- **F7:** build-time TURN credentials remain client-readable. No production credential TTL, scoped issuance, rotation, allocation quota, or spend ceiling was verified. Short-lived allocation credentials need shared sync/service implementation and actual provider acceptance. No secret values were collected. This remains open.
- **F8 threat model:** message bodies, local membership data, pending invite capabilities, and the SQLite recovery export are plaintext local data. Sealed file blocks and encrypted key-vault entries have different protection. An unlocked-device user, same-origin injected script, or privileged browser extension can read locally available data; a script can request use of non-extractable keys. OS/device protection does not make exported SQLite encrypted. Existing encrypted backup/export flows must be used for portable full recovery. Database encryption/app lock/redacted app-switcher requirements need an explicit launch-audience decision and subsequent native/browser verification. The new export warning states this boundary.
- **F10:** no search or feed-performance redesign was substituted for storage work. Final web build retains the large-chunk warning (index about 770 kB, sync 647 kB, LiveKit 531 kB before gzip). Device latency, accessibility, local search, and stranger-study work remain. Creator commerce and public-social expansion are separate programs.

## Verification

All commands ran from `/Users/trey/Desktop/Apps/MyLife`.

- Mobile full suite: **1,839 passed**. Web full suite: **1,243 passed**.
- New durability suite: nine deterministic tests. Secret-vault suite: fourteen tests, including bounded automatic retries and retained-key recovery. Invitation-intent suite: three tests, exercising both core twins.
- Browser suite: 17 passed / 1 relay-dependent skip; the added signed-message/key takeover check separately passed, for 18 distinct passing checks. Existing relay-dependent browser test is skipped without a configured relay. The tests use actual Chromium/SQLite/IndexedDB and injected failures; purchase responses are fixtures.
- Affected mobile/web type checks and lint: passed through `pnpm gate:function:changed`. Gate-discovered tests passed; untracked new test files were additionally included in full suites.
- Full `pnpm check:parity`, `pnpm check:generated-artifacts`, `pnpm check:web-barrel`, and `node scripts/check-meerkat-transport-nc.mjs`: passed.
- Web production build: passed with the existing large-chunk warning. Whitespace checks passed.
- Original-adapter negative controls: both deterministic and shared-IndexedDB browser regressions failed as intended. The fixture restored task-owned source bytes immediately afterward.
- Browser artifacts: `output/playwright/meerkat-remediation-2026-09-04/storage-unsaved.png`. The status surface was visually inspected; fallback text contrast was corrected. Native physical UI and Safari/Firefox were not exercised.

Temporary raw logs are `/tmp/meerkat-*`; essential results are preserved here and in the current report. Test-development failures included an obsolete catch-up copy lock, asynchronous IndexedDB/fake-clock timing, and two browser assertions that did not await UI/durability completion. These were corrected and rerun, not suppressed.

## Next priority

Freeze a reviewed candidate and restore exact-SHA Release Verify while continuing the signed-device invitation/purchase/return matrix. The next independent code program is scoped, revocable friend links with explicit expiry receipts and install/paste fallback, followed by temporary TURN allocation credentials. Keep mandatory verification and connection consent. General availability remains NO-GO.
