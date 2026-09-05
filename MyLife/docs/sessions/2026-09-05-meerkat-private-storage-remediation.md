# Meerkat security remediation: private storage

Date: 2026-09-05. Work began September 4 on `fix/meerkat-orphan-watchdog`. The working tree contains concurrent changes; no commit, push, deployment, or store upload was made by this task.

## Result

Implemented audit S4. Standalone iOS now stores SQLite, raw attachments, sealed blocks, local backups, backup-job payloads, snapshots, restore staging/rollback, and tile packs beneath `Library/Application Support/MeerkatPrivate/`. Explicit bulk exports use `Documents/Meerkat Exports/`. Existing exports outside the reserved internal subdirectories remain in place. This follows the distinction between [Files-visible Documents](https://developer.apple.com/documentation/BundleResources/Information-Property-List/UIFileSharingEnabled) and [Application Support](https://developer.apple.com/documentation/foundation/url/applicationsupportdirectory).

The shared foreground/headless boot recovers any legacy restore journal at its original paths, then moves internal entries before opening SQLite. Same-container renames preserve SQLite sidecars and resume after interruption. Preflight rejects conflicting source/destination copies without overwriting either. A completion marker rejects later reintroduction of internal files through Documents. Migration failure prevents database open; there is no fallback to public Documents on standalone iOS. Reset closes SQLite first and verifies deletion of both legacy and private internal files while retaining explicit exports.

Android keeps its existing app sandbox. Expo Go keeps its explicitly identified experience sandbox: its installed 54.0.6 host has neither Files-sharing plist key. An initial resolver restriction caused a visible Expo Go database error; the explicit environment/path exception fixed it without weakening standalone storage. Unexpected iOS paths still fail closed.

## Files

- `apps/meerkat/app/(root)/data/private-storage.ts`: root resolution, migration, reset paths.
- `meerkat-db.ts`, `local-restore-boot.ts`: pre-open migration and root-aware restore recovery.
- `expo-node-store.ts`, `expo-blob-store.ts`, `tile-packs.ts`: private internal IO; attachment-cache fallback is private.
- `local-snapshot.ts`, `local-restore.ts`, `storage-destinations/local-device-adapter.ts`, `storage-destinations/storage-job-payload-store.ts`: private backup/restore paths.
- `providers/DatabaseProvider.tsx`: close-before-delete and verified reset. `file-save.ts` and NodeProvider documentation: separated exports.
- `data/__tests__/private-storage.test.ts`, blob tests: migration failure/restart coverage and private blob directory checks.
- App AGENTS, protection-plugin comments, audit HTML/Markdown, indexes, memory and error log updated.

The web app has no iOS Files surface and required no storage-path change. Existing mobile/web sync and export semantics remain covered by the full parity suite.

## Verification

- 21 migration regressions pass using real temporary filesystem entries: each move interruption, marker failure, conflict preservation, legacy restore/WAL recovery, private restore recovery, source-survival detection, reset, and Expo Go/standalone separation.
- Existing restore/blob tests: 15 pass. Export/config checks: 32 pass.
- `FUNCTION_GATE_MAX_WORKERS=1 pnpm gate:function:changed`: exit 0 after the final runtime change. Mobile 203, web 139, relay 79, sync 17 selected tests pass; 6 relay integration tests skipped. Package lint/typechecks and hub consumer typechecks pass. These are selected regressions, not a new full-workspace test census.
- `pnpm check:parity`: exit 0. `pnpm check:generated-artifacts`: exit 0.
- S1 independent recheck: 10 authenticated recipient-authorization session tests pass. Account service/HTTP: 31 pass. Preview checks: mobile 79 and web 70 pass. Gitleaks 8.30.1 detects a synthetic GitHub-token canary with the repository configuration; expected exit 1 and redacted output.
- Expo Go reload reaches the existing Appearance screen, with the stored theme retained. A separate optional LiveKit loader still raises a dismissible missing-native-module overlay; the existing error-log row was reopened for that separate call-media path.
- Installed native Meerkat development build on iPhone 16e simulator, iOS 26.2, runs the current Metro bundle with Legacy Architecture. Its existing Documents database migrated through the actual Expo filesystem/SQLite adapters and the app rendered its entitlement screen. The private completion marker exists; the former main database, WAL and SHM are absent from Documents. `PRAGMA integrity_check` returns `ok`. Hashes of 118 of 120 prior tables are identical, including identity/content tables; settings and relay-probe tables changed during ordinary boot. The fixture had 56 baseline rows and no internal blob files, so this is native SQLite migration proof, not native bulk-blob migration proof.

Evidence: ignored `.gstack/security-reports/2026-09-05-meerkat-remediation/`. Native evidence contains hashes/counts, not message bodies or keys. The prior audit remains a dated baseline; its addendum records current remediation.

## Remaining acceptance

- S4 is implemented and locally verified, with native simulator evidence. A signed real-device upgrade must still establish Files visibility, attachment access, explicit bulk export, cold start, interrupted upgrade, backup/restore, reset, and locked-device protection. No real-device result is claimed. Historical copies already exported or backed up cannot be recalled by migration.
- The old layout mixed reserved internal subdirectories and exports beneath similarly named parents. Copies previously exported into a reserved internal directory can move with that directory; new exports use a distinct parent. Tests preserve ordinary existing exports, including on a case-insensitive filesystem layout.
- S2 remains a public-participation release blocker. Concurrent continuity changes now restrict direct reissuance; accepting an unrelated account's clean bearer at renewal still requires an account-bound proof design. A candidate next step is a renewal receipt bound to the original blinded issuance, with secure client persistence, deletion/reinstall recovery, migration, and privacy review. This session does not claim that protocol design or its security review is complete.
- S3 intentionally refuses unattested age signals until a trusted verification adapter exists. S5 still needs native decoder/network acceptance. Full device/provider/release evidence and final security acceptance remain open.

## Operational notes

Checks ran with one worker and without concurrent full suites. The initial simulator development server had stopped; a task-owned local Metro server was used for verification. No production service was tested or modified. The native development build expects port 8081; Expo Go's prior launch used port 8094. Both task-owned Metro processes were stopped after verification. A later desktop check exposed no available browser, so the updated self-contained HTML is linked from the report index. No purchase, provider sign-in, or message send was performed.
