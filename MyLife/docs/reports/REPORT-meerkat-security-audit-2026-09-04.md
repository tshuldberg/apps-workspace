# Meerkat security and privacy audit

Date: 2026-09-04. **Decision: do not release on the current security evidence.** Status: DONE_WITH_CONCERNS.

At the audit baseline, the principal blocker was a recipient-authorization defect in sync: a paired friend is treated as a personal replica, and outgoing community rows are not checked against that friend's membership. The account service also permits evasion of credential revocation and accepts self-declared age as store verification. iOS exposes private working files through Files. Passing tests do not invalidate these findings.

This is a broad source and local-test audit, not a certification or a production penetration test. It covers the mobile app, web app, shared sync package, relay/account/storage services, native adapter seams, dependency graph, relevant Git history, and release configuration. Manual inspection was risk-directed, not a claim that every line received review. The audit itself changed no product code and attacked no external service. Subsequent implementation is recorded below.

## Remediation addendum, September 4

Follow-through after this audit: S1 recipient authorization now has explicit ownership, signed community filtering, scoped acknowledgements and blob checks. Ten authenticated session regressions pass; six of the original seven fail on the reviewed implementation. S3 now refuses unsupported age assertions and reports unattested adult records as unknown. S5 now feeds bounded local raster bytes to decoders. S6 defaults and exact fixture exclusions are validated with a positive canary. S2 remains protocol-blocking; S4 has since received the private-storage migration described below. Native/provider evidence and final security acceptance remain outstanding. See the [current production follow-through](REPORT-meerkat-production-readiness-2026-09-04.md#follow-through) and [session](../sessions/2026-09-04-meerkat-relay-security-remediation.md). The findings below retain the original audit evidence.

September 5: the atomic issuance-history guard closes direct-route and recreation resets for retained history. S2 remains open for same-epoch borrowed-bearer binding, lost/expired-pass recovery and previously deleted history. Lost-response replay and current/next-period presentation now have mobile/web regression coverage. Final account suites pass 34 mobile and 41 web cases, including vault-flush failure, completed scratch recovery and cross-session exclusion. Eight real PostgreSQL 16 integration cases passed; no deployed service was migrated. See the [continuation](../sessions/2026-09-05-meerkat-issuance-continuity.md).

### September 5: interrupted-request recovery

Mobile and web now recover an already authorized mint response after signing in again to the original account/server, including a lost next-period renewal once that period begins. A dedicated authenticated route can only replay the exact retained issuance digest; it cannot allocate another pass. Client secret state pins account and service before replay, and account switching sends no original blinded request. Original blinding material stays in the keychain or encrypted browser vault. Older servers fail closed and preserve scratch.

Focused suites pass 42 mobile, 50 web, 57 relay/account-boundary, 19 shared-protocol and 9 real PostgreSQL cases. The changed-function gate, full parity, three private-mesh account-isolation tests and generated-artifact guard pass. A real-key counterexample proves that disclosing or proving a blinding factor alone does not bind a borrowed bearer to its original issuance. That protocol flaw, complete pass loss, expired-period recovery and legacy-deletion policy remain open. See the [recovery implementation and acceptance log](../sessions/2026-09-05-meerkat-session-recovery.md).

### September 5: issuer key integrity

Further account-service inspection found and reproduced three key-lifecycle defects: competing workers could select different period keys, interrupted public-key publication could leave issuance stuck, and saved public/private key mismatches were accepted. The service now uses only the durable insertion winner, derives and checks its public half, completes missing publication, and rejects conflicts before consuming issuance quota. It never silently replaces a published key.

All three regressions fail on the pre-fix implementation. The repaired service passes 72 focused tests and 11 real PostgreSQL cases, including concurrent issuer instances and restart recovery. The changed-function gate, full parity and generated-artifact guard pass. This strengthens S2's recovery path but does not resolve borrowed-pass renewal binding. See the [key-integrity session](../sessions/2026-09-05-meerkat-epoch-key-integrity.md).

### September 5: final local security pass

Issuance, renewal and exact-response recovery now recheck account eligibility inside the quota mutation on memory, file and PostgreSQL stores. Expired/malformed active entitlements fail closed, including when a restriction or expiry occurs after the early service check. Account status and mobile/web mint affordances respect expiry.

A new two-account regression also established that account deletion could revoke another account's copied public pass. That path is now closed: deletion removes the account and local secrets but cannot authorize revocation of an unproven bearer. Both clients omit public passes and state that other copies remain valid through their period and grace interval. Ownership-bound voluntary revocation remains a protocol requirement.

S6's release job now tests positive and clean scanner controls before accepting a source scan. A deliberately disabled-default configuration is rejected. Fresh scans reported no findings in mobile app, web source, sync source and relay source. These local scans do not replace exact-candidate CI or native/container artifact scans.

Final focused verification: 71 service/HTTP/eligibility/key/privacy tests, 46 mobile/account-isolation tests, 51 web tests and 12 real PostgreSQL tests pass. The required function gate and full parity pass. The generated-artifact guard is blocked by an unrelated tracked 9.50 MB argument-atlas HTML report; this session leaves that concurrent deliverable intact. The [session](../sessions/2026-09-05-meerkat-security-final-local-pass.md) records evidence and exact blockers. An [unreviewed renewal-binding proposal](../designs/meerkat-renewal-binding-proposal-2026-09-05.md) is ready for protocol review, not deployment. The registered iPhone remains offline and no local container engine was available. The audit is still incomplete overall and remains NO-GO.

### September 5: private-storage remediation

S4 is implemented and locally verified. Standalone iOS now migrates internal SQLite, attachments, blocks, backups and restore files into Application Support before opening the database. Conflicting copies fail closed; interruption recovery preserves SQLite sidecars. New explicit exports use `Documents/Meerkat Exports/`. Android and the explicitly identified Expo Go development sandbox retain their existing storage roots.

The installed native simulator build ran the actual migration: the old Documents database and sidecars are absent, the private marker/database exist, SQLite integrity is `ok`, and the app rendered. Hashes of 118 of 120 existing tables match, including identity/content tables; settings and relay-probe rows changed during boot. This fixture had no internal blob files. Twenty-one migration regressions cover move interruptions, conflicts, legacy/private restore recovery, source deletion, reset and development-host isolation. The final function gate, full parity and generated-artifact guard pass. See the [implementation and evidence log](../sessions/2026-09-05-meerkat-private-storage-remediation.md).

| Finding | Current implementation status | Remaining acceptance |
|---|---|---|
| S1 | Recipient authorization hardened; 10 authenticated-session regressions rechecked | Two-device release acceptance |
| S2 | Continuity/recovery and atomic eligibility hardened; unproven deletion revocation removed | Ownership-bound renewal/self-revocation, complete loss/expired-period recovery and legacy-history policy; release blocking |
| S3 | Unsupported age claims fail closed | Trusted verification adapter and persisted-state acceptance |
| S4 | Private storage implemented; native simulator migration verified | Signed real-device upgrade, Files/export, attachment, backup and locked-device checks |
| S5 | Bounded validated local raster path; mobile/web regressions rechecked | Native decoder/network acceptance |
| S6 | Default detectors and release canary enforced; current source scans clean | Exact-candidate CI and artifact scans |

The security release decision remains **NO-GO**. A simulator migration does not establish physical-device protection, erase prior exported copies, or close the remaining protocol and operational evidence gaps.

## Evidence baseline

- Repository: `/Users/trey/Desktop/Apps/MyLife`, branch `fix/meerkat-orphan-watchdog`, base HEAD `7a40639d1e364ee384f92f0debbd036d995e7b4c`.
- The working tree already contained substantial changes and continued changing during the audit. Findings refer to the inspected working files, not pristine HEAD or a deployed binary. The test results below belong to their execution window and are not final-candidate release proof.
- Code census: mobile 453 source/test files; web 437; sync 414; relay 444; three native support packages 28. The four main suites were executed in full. Platform/source scans included JavaScript, TypeScript, Swift, Kotlin, SQL, and configuration.
- Evidence and safe fixture probes are retained under ignored `.gstack/security-reports/2026-09-04-meerkat/`. Source hashes identify the principal finding locations. Large scanner output remains local, not in tracked reports.
- Existing readiness reports were context only. This specialist audit supplements the [production assessment](REPORT-meerkat-production-readiness-2026-09-04.md), and adds security blockers to its existing NO-GO.

## Findings

Original audit snapshot. Current remediation statuses appear in the addendum above.

| ID | Severity | Confidence | Verification | Finding |
|---|---|---|---|---|
| S1 | High | 9/10 | Source trace; no end-to-end adversarial reproduction | Friend sync can disclose unrelated community rows and personal read/progress state |
| S2 | High | 10/10 | Genuine credential primitives, synthetic service fixture | Revoked pass holders can bypass renewal through direct issuance |
| S3 | Medium | 10/10 | Synthetic service fixture | Client assertions can overwrite store-minor status with store-adult status |
| S4 | Medium | 9/10 | App configuration, installed native source, Apple documentation | iOS Files exposes the internal database and raw attachments |
| S5 | Medium | 8/10 | Injected policy-bypass proof; native exploitation conditional | Preview image URLs bypass the page network guard |
| S6 | Low | 10/10 | Controlled scanner comparison | Repository Gitleaks configuration loads no detection rules |

There are two high, three medium, and one low findings. S5 establishes a code-level policy bypass, not successful extraction from a real device. No critical vulnerability or real leaked credential was established. These are priorities for remediation, not a count of every possible vulnerability.

### S1. Paired friends are authorized as personal replicas

**Category:** broken access control and information disclosure. **Status:** unresolved, release blocking.

Source locations:

- [Mobile SyncProvider](../../apps/meerkat/app/(root)/providers/SyncProvider.tsx), lines 833-839 enables the community module; lines 2546-2583 put verified friend bundles into the normal paired-device table.
- [NativeSyncEngine](../../packages/sync/src/engine/sync-engine.native.ts), lines 260-271 and 399-410 construct responder and initiator options without a workspace or an own-device authorization distinction.
- [Sync session](../../packages/sync/src/protocol/sync-session.ts), lines 495-504 treats presence in `pairedDevices` as personal-device authorization; lines 557-560 selects `personal_replica` when no workspace is supplied.
- The same file, lines 580-625, filters outgoing snapshots by table scope cap and community transport policy. It does not check the receiving device's membership in the row's community. Lines 1291-1303 and 2039-2074 use those decisions to send data.
- [Community policy and schema](../../apps/meerkat/app/(root)/data/community-core.ts), lines 181-184, 223-226, 472-479, and 506-526 declare channel messages, personal read state, personal library progress, and plaintext message bodies.
- [Web provider](../../apps/meerkat-web/src/lib/MeerkatProvider.tsx), lines 1424-1431 also constructs `NativeSyncEngine` for the same enabled modules. The defect therefore affects the shared mobile/web session path.

Attack scenario:

1. A user pairs a friend's valid device, granting a normal friend connection. The user also belongs to a separate private community.
2. The friend's device participates in a real permitted sync session. The sender chooses personal scope from the missing workspace and accepts pairing as authorization.
3. The sender serializes eligible community rows, including rows from the separate community, without checking whether this friend may receive them.
4. A recipient client can inspect the decrypted session payload before its own database or UI rejects or hides a foreign-community row.

The pairing/encryption handshake remains meaningful against outsiders and relay operators. It does not restrict what the authenticated recipient can read. Signature checks on the receiving app cannot undo disclosure that happened before those checks. A `personal_replica` maximum protects nothing if a friend's session has already been misclassified as personal. Transport restrictions still apply, so a local-only community is not claimed to leak over a forbidden relay.

**Impact:** unintended disclosure of private community message bodies and eligible community metadata, plus personal read/progress rows present in the snapshot. This finding does not claim that `dm_` or `mk_` tables replicate, or that wrapped epoch keys become plaintext. The person-identity module is not enabled in these constructors, so no `pi_` disclosure is asserted.

**Remediation:** make verified ownership of another personal device a separate authorization from friendship. For friend sessions, check each outgoing row's community and channel audience against the recipient before serialization. Fail closed for missing descriptors or authorization. Apply the same filter to acknowledgements, tombstones and referenced blobs, and recheck membership changes. Preserve per-community transport restrictions. Implement both surfaces through `packages/sync`, not through divergent UI filtering.

**Acceptance evidence required:** two independent person identities, a third unrelated community, real authenticated session capture, and assertions that unauthorized plaintext never enters outgoing batches. Cover removals, private channels, personal read/progress state, old pairing records, both session directions, and all live transport adapters. Existing scope tests are insufficient because they explicitly supply a shared-workspace context that these app constructors omit.

### S2. Direct issuance avoids revoked-pass renewal enforcement

**Category:** broken access control, moderation evasion. **Status:** unresolved, public-layer release blocking.

[Account service](../../packages/meerkat-relay/src/account-service.ts), lines 432-440, accepts issuance for the current epoch and the next epoch during renewal. Only `renewCredential`, lines 557-563, checks the submitted expiring credential's revocation and flags the account. [HTTP routes](../../packages/meerkat-relay/src/account-service-http.ts), lines 280-329, expose the separate paths.

Attack scenario:

1. An authenticated, entitled user receives a credential that is later revoked by moderation.
2. Instead of calling the renewal route, the user calls the direct issuance route for the next permitted epoch.
3. The account has no renewal flag because the revoked credential was never submitted there. A new blind signature is issued.
4. The user finalizes and presents the new credential, which the real verifier accepts in the new epoch.

**Proof:** an in-memory service fixture used genuine RSA blind-signature preparation, issuance, unblinding and verification. The epoch-0 credential was revoked; direct epoch-1 issuance succeeded; the account remained unflagged; the epoch-1 credential verified. No production account or service was used.

**Impact:** the intended account-backed moderation restriction can be evaded across epochs without another account. Existing per-epoch quotas still apply; this is not arbitrary same-epoch unlimited minting or a private-message decryption vulnerability.

**Remediation:** enforce one coherent issuance/renewal policy at every entry point, using issuance history across epoch rollover and deletion/recovery. A simplistic requirement to submit any clean old bearer is insufficient because the service cannot prove that bearer belongs to the authenticated account. Resolve that protocol tradeoff without silently creating an account/persona join. Include revocation and recovery semantics in the privacy design review.

**Acceptance evidence required:** revoked holders cannot regain access via either route, rollover, account recreation, credential loss recovery, or a borrowed clean bearer. Clean eligible users retain a supported recovery path. Cryptographic unlinkability claims must match the resulting protocol.

### S3. Client-supplied age is promoted to store verification

**Category:** integrity and verification bypass. **Status:** unresolved, public-layer release blocking.

[Age-signal HTTP route](../../packages/meerkat-relay/src/account-service-http.ts), lines 265-274, accepts `signal` and `source` from an authenticated request. [Account service](../../packages/meerkat-relay/src/account-service.ts), lines 283-298, writes them without provider attestation. The minor issuance block at line 460 consumes this status. [Mobile account client](../../apps/meerkat/app/(root)/data/account-core.ts), lines 799-804, can turn the resulting adult status into a store-sourced local pass, while preserving already locked records.

Attack scenario:

1. A user obtains an ordinary account session.
2. The user submits `adult` and an accepted store source, including after an existing `store_minor` record.
3. The service records `store_adult` despite receiving no signed age evidence from that store.

**Proof:** the synthetic service fixture changed a prior `store_minor` record to `store_adult` using only the account session. This proves status forgery, not a bypass of an already locked local first-launch age record.

**Impact:** server decisions rely on fabricated store verification, and the default minor restriction loses integrity.

**Remediation:** accept store verification only after validating provider evidence bound to the account. Keep self-declared age distinct. Prevent unauthenticated or client-only updates from weakening verified restrictions. Where no provider evidence is available, retain an honest unknown state.

**Acceptance evidence required:** a valid bearer alone cannot assert store-adult status; forged, replayed and account-mismatched evidence is rejected; valid evidence works; minor and locked-state restrictions survive downgrade attempts.

### S4. Private iOS working files are available through Files

**Category:** local information disclosure. **Status:** unresolved.

[App configuration](../../apps/meerkat/app.json), lines 39-40, enables both `UIFileSharingEnabled` and `LSSupportsOpeningDocumentsInPlace`. [Database boot](../../apps/meerkat/app/(root)/data/meerkat-db.ts), line 127, opens Expo SQLite's default location. The installed Expo iOS module, `expo-sqlite/ios/SQLiteModule.swift:28`, resolves that directory to `Documents/SQLite`. Community message bodies are plaintext there. [Raw blob store](../../apps/meerkat/app/(root)/data/expo-blob-store.ts), lines 23 and 115, puts base64 raw attachments under `Documents/meerkat/blobs`. Base64 is not encryption.

Apple documents that enabling these two keys exposes all documents through the local file provider. [Apple Launch Services reference](https://developer.apple.com/library/archive/documentation/General/Reference/InfoPlistKeyReference/Articles/LaunchServicesKeys.html).

Attack scenario:

1. Someone has access to the unlocked device's Files UI, a trusted computer's app file sharing, or a user-granted file/directory capability in another app.
2. They access Meerkat's exposed internal database or blob files alongside intentional exports.
3. They inspect raw channel bodies or decode raw attachment bytes without using Meerkat's normal views.

This is not remote unauthenticated access, an unrestricted sandbox bypass, or an in-app biometric-lock bypass. Keychain secrets remain separately protected. Sealed library blocks are ciphertext and are not claimed to decrypt through Files.

**Remediation:** move the active database, raw blobs, and restore staging/rollback data into private Application Support. Reserve Documents for explicit exports. Migrate existing installations and update reset, backup and restore paths together. Keep native keychain protection.

**Acceptance evidence required:** disposable iOS installation with fixture messages and attachments; verify that Files and trusted-computer sharing expose only deliberate exports. Verify upgrade migration and restore. Physical-device reproduction was not performed during this audit.

### S5. Preview images bypass network-target validation

**Category:** client-side request forgery and potential disclosure. **Status:** code defect verified; native exploitation conditional.

[Link preview parser](../../apps/meerkat/app/(root)/data/link-preview.ts), lines 202-207, accepts any HTTP(S) `og:image`; lines 364-372 passes it to the image downscaler and embeds returned JPEG bytes. [Native downscaler](../../apps/meerkat/app/(root)/data/link-preview-image.ts), lines 60 and 65, passes the URL to Expo. The channel screen supplies this hook and attaches its output when sending. [Settings](../../apps/meerkat/app/(root)/data/db.ts), lines 193-201, defaults previews on.

Page URLs use a private-address guard and manual redirect checks; image URLs bypass that policy. The installed Android image-loader chain delegates to Glide. An injected fixture proved that image targets rejected by the page guard still reached the image hook and were embedded when it returned a synthetic JPEG.

Attack scenario, conditional on native access:

1. A sender shares an attacker-controlled public page in a community containing the attacker.
2. That page names a reachable internal image as its preview image.
3. If the native loader can fetch it, Meerkat embeds the image into the outgoing community preview.

**Limits that materially affect severity:** Android release configuration denies cleartext and trusts system certificate authorities. Ordinary HTTP camera theft and invalid/self-signed certificate bypass are not established. A successful HTTPS case needs a certificate accepted by that device, such as an appropriately provisioned internal service, and decodable image content. The installed iOS manipulator appears to require local file readability before loading, so iOS exploitation is not established. Arbitrary internal text or metadata JSON is not converted into an image. No real network extraction occurred in the probe.

**Remediation:** apply the same target policy to preview images, download through a controlled path that validates every redirect, and hand only local image bytes to the decoder. Preserve TLS restrictions. Match mobile and web shared parsing. Do not infer that changing the parser alone solves DNS-to-private-address cases.

**Acceptance evidence required:** reject direct blocked images and redirect-to-blocked images before native loading; exercise real Android/iOS loaders against disposable public/private fixtures and confirm that no prohibited request occurs. Document residual DNS-resolution behavior.

### S6. Gitleaks configuration silently removes default rules

**Category:** security tooling integrity. **Status:** unresolved control weakness; not evidence of a leaked secret.

[Root configuration](../../.gitleaks.toml), lines 1-9, defines only an allowlist and no rules or default-rule extension. Gitleaks v8.30.1 returned exit 0 and zero findings for a synthetic nonfunctional token under this config. The same fixture returned exit 1 with the built-in `github-pat` detector under default rules. The [Gitleaks configuration documentation](https://github.com/gitleaks/gitleaks#configuration) describes extending its defaults.

Failure scenario: a developer or future security gate invokes Gitleaks from the repository expecting normal rules; a recognizable committed credential is silently missed because no detector is configured. No current Gitleaks invocation was found in the inspected workflows, hooks or package scripts, so this is not described as an observed CI bypass.

**Remediation:** add `[extend]` with `useDefault = true`, retain narrowly justified allowlists, and add a controlled nonfunctional-token smoke check. Then integrate the working scanner into the intended release gate. No real secret requiring rotation was found in this audit.

## What the verification did and did not establish

| Check | Fresh result | Interpretation |
|---|---|---|
| Shared sync suite | 208 files; 2,637 passed, 3 skipped | Existing cryptographic/session/storage tests pass; does not prove app recipient selection |
| Mobile suite | 166 files; 1,842 passed | Existing app behavior checks pass |
| Web suite | 153 files; 1,246 passed | Existing web behavior checks pass |
| Relay suite | 214 files passed, 35 skipped; 1,653 tests passed, 189 skipped | Service fixtures pass; external integration coverage remains incomplete |
| Combined | **7,378 passed; 192 skipped** | Evidence from the execution window, not a final release binary |
| Four package typechecks | Passed | Includes mobile test TypeScript configuration |
| Account adversarial fixture | Two expected weaknesses reproduced | Uses real credential cryptography with fake account/provider state |
| Preview fixture | Three blocked targets reached image hook | No native network or device extraction claim |
| Secret-scanner control | Configured scan missed fixture; default scan detected it | Original config's clean result was discarded |
| Explicit default-rule history scan | 566 commits, approximately 49.95 MB; 25 raw candidates | Reviewed candidates were test material, placeholders, expressions or comments; no real secret established |
| Explicit default-rule current scan | 1,925 source/config files, approximately 19.83 MB; 22 raw candidates | Same classification; environment examples only in the scoped tracked environment-file census |
| Production dependency audit | Workspace: 7 high, 2 moderate, 0 critical advisory records | Only two image-size advisories mapped to scoped Meerkat importer paths; see below |
| Full parity gate | **Failed**: `public-join-client.ts` mobile/web drift | Mobile uses hosted relay factory, web uses raw backend; concurrent work remains to align |
| Generated artifact gate | Passed | Report output is small and contains no generated performance dump |

No function logic was changed by this task, so `pnpm gate:function:changed` is not applicable. Running that change-based gate here would also sweep unrelated concurrent edits. Unit suites, typechecks, parity and report checks were run explicitly.

### Dependency and release checks

The lockfile is tracked. Fresh `pnpm audit --prod --json` succeeded in querying the registry and returned advisories; the old CI comment claiming the npm audit endpoint is unavailable did not describe this run. Advisory path analysis matters: the fast-uri and qs records belonged to other workspace importers and are not Meerkat findings.

The two Meerkat-path advisories are [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) and [GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq), concerning image-size 1.2.1 parser hangs in ICNS and JXL/HEIF processing. Their paths run through Expo/Metro tooling, not an established shipped Meerkat image parser. The registry reported no patched version. They remain a build-input exposure to track, not two proven high-severity mobile runtime exploits. The audit did not execute malicious files. Native Pods, Android artifacts, operating-system packages and built container images were not vulnerability-scanned here.

Reviewed workflow action references are pinned to commit hashes. The main CI uses read permissions, and CODEOWNERS covers workflows. Production platform images use a non-root user, frozen production dependency installation with install scripts disabled, and a pinned Node base digest. Production compose adds read-only filesystems, dropped capabilities and private networking to app services. Database configuration requires verified TLS in production and rejects URL parameters that could override it. These are source-level controls; live branch protection, registry provenance, deployed image versions, firewall state, and secret-store access were not inspected.

Repository-local skill/hook patterns were checked at a basic level; no app-runtime LLM tool execution or demonstrated credential-exfiltration path was identified in the inspected paths. Global agent plugins were not audited. Semgrep, OSV Scanner and container scanners were not installed locally; their scans were not represented as completed. Gitleaks was downloaded from its official release and checksum-verified into temporary audit storage.

## Threat model and privacy boundaries

Assets requiring protection include device signing/Diffie-Hellman secrets, group epoch keys, private messages and attachments, personal reading state, account sessions, anonymous passes, storage-provider credentials, public persona state, moderation evidence and backups.

| Boundary | Main adversary | Controls observed | Unresolved risk or evidence gap |
|---|---|---|---|
| Device to paired friend | Valid but curious or malicious paired peer | Signed identity, authenticated encrypted session, signed batches | S1: recipient authorization is not the same as pairing |
| Device to relay | Malicious relay or network observer | Pairwise envelope, required encryption, no silent negotiation downgrade, signed batches | Size/timing/IP metadata remains observable; operational logs need deployed verification |
| Community authority | Removed member or forged content author | Signed descriptors/events, inbound validation, epoch mismatch refusal | Outgoing S1 bypass; real removal/private-channel leakage tests required |
| Verification account to public identity | Abusive user or colluding service operator | Blind issuance, separate account tables/keychain service, verifier-only public checks | S2/S3; renewal and stable-pass linkability described below |
| Local app to OS and Files | Unlocked-device accessor or granted file consumer | OS sandbox/keychain; Android backup disabled | S4; physical wipe, backup exclusion and screenshots need device checks |
| Content to renderer | Malicious community content | Props-based React rendering; EPUB script disabling, sandbox/CSP, archive caps | S5; native decoders and WebView navigation require device/browser adversarial coverage |
| Storage client to providers | Malicious provider or unauthorized account | Encrypted backup format, authenticated objects, broker ownership checks, same-origin redirect restriction | Real provider OAuth, deletion, restore, TLS and revocation checks skipped here |
| Developer to release | Compromised dependency or workflow change | Pinned actions, frozen lockfile, minimal token scopes, image scanner configuration | S6; no live branch-protection or final-image attestation proof |

This table covers spoofing, tampering, repudiation, disclosure, denial of service and privilege escalation at the major seams. The audit did not perform volumetric or resource-exhaustion tests; availability checks were limited to source and existing tests.

### Data classification

| Data | Observed placement and protection | Exposure boundary |
|---|---|---|
| Device private keys | Isolated OS keychain on mobile; encrypted browser secret vault | Compromised unlocked endpoint remains outside cryptographic protection |
| Account bearer, pass and pending mint | Separate account keychain service on mobile | Renewal carries old credential to account service |
| Channel bodies and raw attachments | Local SQLite and raw blob store; session encryption in transit | Plaintext local working data; S1 and S4 |
| Sealed library items/backups | Encrypted content objects with verified metadata and wrapped keys | Authorized holders can intentionally export decrypted copies |
| Provider refresh credentials | Broker-side sealed vault; per-subject lookup | Deployment secret/key management and actual provider lifecycle need verification |
| Public content/moderation records | Public publishing and scanning services | Public content is intentionally public; moderation evidence is sensitive |
| Read/watch state | Personal-replica tables | Must never be disclosed to a merely paired friend |

### Privacy claims that need precise wording

- Blind issuance is not unconditional unlinkability. Renewal sends a finished old credential with the account session. An operator with runtime access plus matching public moderation evidence can link that old pass to the account. The [existing architecture](../designs/meerkat-account-verification-architecture.md), line 94, explicitly acknowledges this. It is a documented trust tradeoff, not a new undisclosed storage join.
- The same epoch credential is reused for public actions. Verifiers can correlate those presentations. Separate database tables do not prevent correlation by a party observing both requests.
- Encrypted transport does not hide network addresses, traffic timing and sizes. Public content hosts necessarily see content submitted for public scanning. Calls and rooms have distinct security modes; server-transit room media is not equivalent to private end-to-end messages.
- Local SQLite/plaintext working files are not automatically encrypted by the sync protocol. Browser same-origin code execution would also have access to the running app's decrypted state; a nonextractable vault wrapping key does not solve malicious code executing in that origin.
- Sender previews make network requests; receivers render the supplied local preview. The sender preview setting defaults on. BYO-key library enrichment is a separate explicit action.

## OWASP coverage summary

| Category | Outcome |
|---|---|
| A01 Access control | S1 and S2 confirmed; broker subject checks and service authorization paths reviewed |
| A02 Cryptography | Real primitives and existing tamper/downgrade tests pass; no new primitive break established; endpoint and metadata limits remain |
| A03 Injection | Parameterized SQL and renderer boundaries inspected; no confirmed SQL/command injection; EPUB/native validation remains bounded |
| A04 Insecure design | Pairing/ownership confusion, renewal policy and self-reported verification require design correction |
| A05 Misconfiguration | S4 and S6; TLS/CSP/container configuration reviewed in source |
| A06 Components | Fresh registry audit triaged by importer; native/container scans outstanding |
| A07 Authentication | SSO, account sessions, pairing and OAuth inspected; S3 affects verification integrity |
| A08 Data integrity | Mandatory batch signatures and signed community events tested; live release provenance unverified |
| A09 Logging | Redaction tests pass; no demonstrated account-plus-persona log join; live logs not inspected |
| A10 Request forgery | S5; page literal/redirect guard and provider-origin restrictions present; DNS and native redirects need validation |

## Remediation order and release exit criteria

1. **S1 first:** implement recipient authorization centrally, then prove unauthorized data never reaches the wire. Pause privacy-sensitive external pilots until this is fixed and verified.
2. **S2 and S3 before public participation:** close every pass-issuance bypass and require authentic verification evidence. Resolve privacy/recovery tradeoffs explicitly.
3. **S4 before mobile distribution:** separate private storage from exports and test an existing-install migration on iOS.
4. **S5 before enabling automatic image previews in release:** use a validated fetch-to-local-bytes path and test real native behavior. Preserve honest copy and user control.
5. **S6 and release evidence:** repair scanner defaults, prove detection with a safe fixture, align current parity drift, scan final dependency/native/container artifacts, and run checks on the exact candidate.

Before release, additionally require two-device identity, pairing/removal and private-channel exercises; native LAN/Nearby/WebRTC and background/push behavior; real provider backup/restore/deletion; service role/TLS/operational-log review; and device Files/backup/deletion verification. These were not executed against live credentials or physical hardware in this audit.

There is no quantified posture trend: earlier broad reviews do not provide a comparable security-finding fingerprint baseline. Current code evidence takes precedence over their previous green checks.

**This AI-assisted audit is not a substitute for a professional security audit.** It can miss subtle vulnerabilities and does not certify production safety. Commission an independent cryptographic/protocol review and penetration test before making strong privacy guarantees.
