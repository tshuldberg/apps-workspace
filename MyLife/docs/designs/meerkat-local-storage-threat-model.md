# Meerkat local storage threat model

Code assessment: 2026-09-05. Complements F8 in the [current readiness report](../reports/REPORT-meerkat-production-readiness-2026-09-04.md). This document records current boundaries and required acceptance, not approval for a high-risk audience.

## Current data boundaries

| Data | Implementation | Protection and limit |
|---|---|---|
| Messages, membership, settings and local metadata | Standard Expo SQLite on mobile; sql.js bytes in browser IndexedDB | Ordinary database rows are readable by the running app. No application database cipher or separate database-unlock secret is configured. Signatures establish authenticity, not local confidentiality. |
| Raw attachments and staged intake | Native blob files; browser `blobBytes` store | These paths can contain plaintext. A library item promoted into the sealed-share path has a different storage contract. Do not call all attachments sealed. |
| Sealed content | Shared sync sealed manifests, encrypted blocks and wrapped keys | Ciphertext is protected by its keys. An authorized running client can decrypt it. The database index, decrypted views and explicit exports are separate surfaces. |
| Device identity secrets | Native SecureStore service `com.mylife.meerkat.sync`; browser encrypted secret vault | Mobile config requests `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. Browser AES-GCM ciphertext and its non-extractable wrapping-key object share the origin's storage. The running app can request decryption; this is not a barrier against injected same-origin code. |
| Verification account secrets | Isolated native account service or corresponding browser vault entries | Keep account material separate from private identity. Encryption of secret entries does not encrypt message rows or establish account/persona unlinkability by itself. |
| Complete backup format | Shared `backup-format` encrypts database and object chunks before destination writes | The encrypted backup and recovery key have different confidentiality requirements. A backup is not proof of complete restoration until its selected data and identity restore successfully. Native preparation can create temporary ordinary SQLite snapshots. |
| Identity recovery | `sealRecovery` encrypts identity material with a separately held recovery key | This exports identity material, not all messages and attachment history. Possession of both key and backup enables identity recovery. |
| Emergency pending-database download | `DatabaseSaveStatus` exports `meerkat-unsaved.sqlite` | Unencrypted database only, with no key vault or attachment bytes. The UI warns that it is not a complete backup. Download initiation cannot prove the file reached durable storage. |

Sources: [mobile database boot](../../apps/meerkat/app/(root)/data/meerkat-db.ts), [DM schema](../../apps/meerkat/app/(root)/data/dm-core.ts), [community schema](../../apps/meerkat/app/(root)/data/community-core.ts), [browser stores](../../apps/meerkat-web/src/lib/storage/idb.ts), [browser vault](../../apps/meerkat-web/src/lib/storage/browser-secret-store.ts), [backup format](../../packages/sync/src/storage/backup-format.ts), [browser snapshot](../../apps/meerkat-web/src/lib/storage/local-snapshot.ts), [recovery UI](../../apps/meerkat-web/src/ui/settings/RecoverySection.tsx).

The concurrent S4 work moves native internal data into Application Support and separates explicit exports. That limits accidental Files exposure; it does not add database encryption. Its simulator evidence and remaining physical-device checks belong to the [current security audit](../reports/REPORT-meerkat-security-audit-2026-09-04.md). The iOS plugin requests `NSFileProtectionCompleteUntilFirstUserAuthentication`; the configuration is not proof of every migrated file's effective protection, nor a claim that every later screen lock makes the database inaccessible.

## Threats and remaining acceptance

| Threat | Current boundary | Required evidence or change |
|---|---|---|
| Someone uses an unlocked phone or open browser profile | The app can display local history. Purchase “App unlock” is an entitlement check, not a privacy lock. | Define a separate authenticated app-lock policy, timeout, notification behavior and recovery. Verify that deep links, background transitions and accessibility cannot bypass it. |
| Device theft, backup extraction or filesystem access | Device/browser protection varies; ordinary database copies remain ordinary files. | Signed iOS and Android tests must examine cold boot, first unlock, later lock, migration, temporary files and OS backup/restore. Do not infer physical protection from a simulator or config value. |
| Same-origin injected script or privileged browser extension | Running code can read database rows and invoke vault decryption. A non-extractable key does not stop use of the key. | Preserve input validation and content-security controls. Do not promise confidentiality after origin or browser compromise. Any future database cipher must explain when the key is present in memory. |
| App-switcher snapshot, screenshot or notification | Encryption of stored content does not hide rendered pixels. No privacy-lock/redacted-preview control was found in the root app layouts. | Native preview redaction and private notification defaults require implementation plus physical-device checks before claiming this protection. Preserve intentional sharing and explain platform limits. |
| Export shared, copied or retained elsewhere | Explicit ordinary downloads can disclose plaintext independently of app deletion. | Label the exact export type before creation; do not promise remote erasure. Check temporary cleanup, failed export recovery and restoration from encrypted backups. |
| Browser eviction, quota failure or process termination | The writer/retry design preserves the last durable revision and exposes pending edits; it cannot persist to unavailable storage. | Retain F1/F2 multi-tab and failure tests. Verify backup recovery. A force-killed pending revision is not a saved revision. |
| Deleted content remains in an old copy | Logical deletion, tombstones and key revocation have different effects. | Do not claim secure erasure of SQLite free pages, OS backups, screenshots or recipient exports without separate evidence. |

## Release decisions

For the supervised private pilot, preserve the current architecture and describe local data as protected by the device/browser plus the specific sealed-content and backup mechanisms above. Do not market an encrypted local message vault, biometric app lock, redacted recent-app preview, forensic erasure or protection on a compromised client.

Application-level database encryption, a separate app lock and native preview redaction remain engineering requirements to resolve before offering protection from unlocked-device or extracted-history threats. They are not silently waived for general availability. The release owner must explicitly select the launch threat model; high-risk use is outside the evidence gathered here.

A database-encryption change needs a shared key-lifecycle design before adoption: existing plaintext migration, interrupted migration rollback, browser unlock and memory lifetime, native background jobs, loss/recovery, key rotation, backup compatibility and raw attachment coverage. Extend the existing storage and sync seams; do not bolt on a second transport or custom cipher. A UI lock alone cannot satisfy these storage requirements.

## Verification record

This is a source-based threat assessment. No device data was extracted and no security setting was changed. Existing storage, encrypted-backup and browser-vault tests support their individual contracts; they do not establish the complete threat model. Physical protection and launch-policy acceptance remain open.
