# 2026-07-09 Meerkat Plan 40 Remaining Review

## Current Status

Plan 40 has no obvious local feature code left to build before real-world evidence. The codeable Downloads and web launch E2E work was completed in commit `2a1bd51d`. This document is the step-by-step runbook for finishing the remaining tasks.

## Before You Start

1. Use branch `feature/meerkat-public-base-feed`.
2. Pull or merge the latest local work you intend to test.
3. Keep notes in a dated evidence folder, for example `docs/evidence/meerkat-plan40-2026-07-09/`.
4. Capture command output, screenshots, device names, OS versions, build identifiers, and relay URLs used.
5. Do not mark a task complete from seeded data, database edits, mocked relay state, or screenshots without the matching live run.

## Step 1: Same-Account Device Linking Evidence

### Goal

Prove that a user can export an identity backup on one real device and restore the same identity on another real device, and prove bad recovery material fails closed.

### Setup

1. Prepare two physical devices, named Device A and Device B in the evidence notes.
2. Install the same Meerkat build on both devices.
3. Start Device A from a fresh Meerkat install or reset app data.
4. Start Device B from a fresh Meerkat install or reset app data.

### Steps

1. On Device A, complete onboarding with a recognizable display name.
2. On Device A, record the identity safety code or fingerprint shown during onboarding or in the identity/settings surface.
3. On Device A, open Settings.
4. Open the recovery or identity backup section.
5. Copy or save both values:
   - Recovery key.
   - Encrypted identity backup.
6. Screenshot the recovery section with secrets redacted.
7. On Device B, choose `Already have a backup? Restore your identity`.
8. Paste the recovery key and encrypted identity backup from Device A.
9. Submit restore.
10. Confirm Device B enters the app as the same identity.
11. Compare Device B's safety code or fingerprint to Device A.
12. On Device B, create one community or send one message so the restored identity is visibly active.
13. Reset Device B again.
14. Try restore with an intentionally wrong recovery key or corrupted backup text.
15. Confirm the app shows an error and does not silently create or claim the Device A identity.

### Pass Criteria

- Device B shows the same safety code or fingerprint as Device A after valid restore.
- Device B can continue using the restored identity.
- A wrong key or corrupted backup fails with an honest error.
- No UI claims cloud backup or hosted recovery unless that service is actually connected.

### Evidence To Save

- Device A and Device B model and OS version.
- Build identifier.
- Redacted screenshot of Device A recovery export.
- Screenshot of Device B after successful restore with matching identity proof.
- Screenshot of failed bad-material restore.
- Short note describing the exact values compared, with secrets redacted.

## Step 2: Production Relay Launch Evidence

### Goal

Run the web launch E2E against a real WebSocket relay so the relay-dependent test executes instead of skipping.

### Setup

1. Obtain the production or staging relay WebSocket URL, for example `wss://relay.example.com`.
2. Confirm it is a real `ws://` or `wss://` URL reachable from this machine.
3. Keep the shell clean of stale relay env values.

### Steps

1. From the repo root, run the no-relay baseline:

   ```bash
   pnpm --filter @mylife/meerkat-web test:e2e
   ```

2. Confirm the baseline has 3 passed tests and 1 honestly skipped relay test.
3. Run the relay-backed suite:

   ```bash
   MEERKAT_E2E_RELAY_URL=wss://YOUR-RELAY-HERE pnpm --filter @mylife/meerkat-web test:e2e
   ```

4. Confirm the relay-dependent test is not skipped.
5. Save the full command output.
6. If the relay run fails, copy the failing test name, error text, relay URL used, and timestamp into `errors_log.md`, then fix the real defect before retrying.

### Pass Criteria

- All 4 Playwright tests pass when `MEERKAT_E2E_RELAY_URL` is set.
- The relay guard performs a real WebSocket handshake.
- No test is softened to pass against an absent or fake relay.

### Evidence To Save

- Relay URL used.
- Timestamp of run.
- Full terminal output.
- Screenshot or trace only if a browser failure occurs.

## Step 3: Downloads Real Artifact QA

### Goal

Prove the global Downloads browser works with real community files and local bytes, including present bytes, absent bytes, report/hide, request-again, and removed-file non-saveable states.

### Setup

1. Use at least one physical mobile device for mobile QA.
2. Use a desktop browser for web QA.
3. Use a real community and channel.
4. Use real files that are safe to store in the repo evidence notes, such as:
   - Small JPEG or PNG.
   - Small PDF or text file.
   - One file with an unsafe inline MIME type if available, to verify forced download on web.
5. Do not create file rows by editing SQLite or IndexedDB directly.

### Mobile Steps

1. Open Meerkat mobile.
2. Create or open a community with at least one channel.
3. Attach or share a real file through the normal app UI.
4. Open the community Files screen.
5. Tap the global Downloads entry point.
6. Confirm the Downloads screen opens.
7. Search for the file by name.
8. Filter `On device`.
9. Open the file.
10. Save the file.
11. Enter select mode.
12. Select multiple present files.
13. Run bulk save.
14. Report one file.
15. Confirm the reported file no longer appears in the normal Downloads list for that device.
16. Create an absent-byte state through normal UI behavior only, for example a second device that has the signed file message but not the blob bytes, or a visible remove-local-copy action if one exists.
17. Filter `Removed`.
18. Confirm the removed file cannot be selected or saved.
19. Tap request again.
20. Confirm the app either requests the file through a real available path or shows an honest reason it cannot request it.

### Web Steps

1. Start the web app:

   ```bash
   pnpm --filter @mylife/meerkat-web dev
   ```

2. Open the local URL shown by Vite.
3. Complete onboarding or restore a test identity.
4. Join or create the same test community.
5. Open Files.
6. Click `All downloads`.
7. Confirm the Downloads screen opens.
8. Search for the file by name.
9. Filter `On device`.
10. Use `View` for a safe inline file.
11. Use `Save` for one file.
12. Select multiple present files and run bulk download.
13. Report one file and confirm it is hidden locally.
14. Confirm unsafe or unknown MIME types download instead of opening inline.
15. Confirm absent-byte rows show request-again or honest unavailable copy.

### Pass Criteria

- Settings and community Files both reach global Downloads.
- Search and status filters work.
- Present files can open and save.
- Bulk save/download works for present files.
- Reported files hide locally.
- Removed or absent-byte files cannot be selected or saved.
- Request-again never claims success unless bytes are actually restored.
- Web unsafe MIME types do not open inline.

### Evidence To Save

- Screenshots of mobile Downloads list, search, filter, bulk save, removed state, and request-again.
- Screenshots of web Downloads list, View/Save, bulk download, and removed state.
- Notes naming the exact community, channel, file names, file sizes, and devices used.
- Any failure added to `errors_log.md` with status `Unresolved` until fixed.

## Step 4: Store, Legal, And Hosted Ops

### Goal

Complete the external launch prerequisites that cannot be proven by local code alone.

### Hosted Service Steps

1. Deploy or verify the production relay service.
2. Deploy or verify the persona service.
3. Deploy or verify any community host or public node required by the launch path.
4. Configure production secrets through the approved secret store or dashboard.
5. Confirm no production secret is committed to the repo.
6. Run the relay-backed E2E from Step 2.
7. Save URLs, deployment IDs, health-check output, and owner.

### App Store Steps

1. Prepare App Store app metadata.
2. Fill privacy nutrition accurately.
3. Enable and document UGC flags where required.
4. Add review notes describing account creation, recovery, reporting, blocking, and moderation.
5. Attach screenshots from the real tested build.
6. Verify the $4.99 one-time app unlock and $4.99 monthly hosted tier wording stays consistent.

### Legal And Moderation Steps

1. Publish privacy policy URL.
2. Publish terms URL.
3. Publish account deletion instructions.
4. Publish community guidelines.
5. Register or confirm DMCA agent process.
6. Confirm NCMEC reporting process.
7. Confirm CSAM hash database vendor or internal process.
8. Confirm moderation inbox ownership and response SLA.
9. Confirm Turnstile, App Attest, or equivalent abuse gates are configured where required.

### Pass Criteria

- Production URLs exist and are reachable.
- Secrets are configured outside git.
- Store metadata does not overclaim delivery, backup, relay status, cloud storage, moderation automation, or public reach.
- Legal URLs are public and match shipped app behavior.
- Moderation and abuse processes have an owner and response path.

### Evidence To Save

- Store draft screenshots.
- Legal URL list.
- Deployment IDs and health-check output.
- Redacted secret inventory.
- Moderation/NCMEC/DMCA owner notes.

## Step 5: Final Screenshot And Evidence Pack

### Goal

Create one reviewable package that proves Plan 40 is ready for the final launch review.

### Steps

1. Create a dated evidence folder:

   ```bash
   mkdir -p docs/evidence/meerkat-plan40-2026-07-09
   ```

2. Add a `README.md` in that folder with:
   - Build IDs.
   - Device list.
   - Relay URL.
   - Commands run.
   - Tester names.
   - Date and timezone.
3. Add screenshots from Steps 1 through 4.
4. Add terminal output files:
   - Web no-relay E2E.
   - Web relay-backed E2E.
   - Any relevant typecheck or parity rerun.
5. Add a `failures.md` file listing any defects found and their linked `errors_log.md` rows.
6. Rerun final checks after any fixes:

   ```bash
   pnpm --filter @mylife/meerkat-app typecheck
   pnpm --filter @mylife/meerkat-web typecheck
   pnpm --filter @mylife/meerkat-web test:e2e
   MEERKAT_E2E_RELAY_URL=wss://YOUR-RELAY-HERE pnpm --filter @mylife/meerkat-web test:e2e
   pnpm check:meerkat-parity
   pnpm check:generated-artifacts
   pnpm check:parity --quiet
   ```

7. Update `memory.md` with the final evidence folder and pass/fail status.

### Pass Criteria

- Evidence folder can be reviewed without asking the tester what happened.
- All required screenshots and command outputs are present.
- Every failure is either fixed or clearly marked unresolved.
- Final parity and artifact checks pass after fixes.

## Current Open Local State

Uncommitted files are currently unrelated or pre-existing from the prior report flow:

- `memory.md`
- `packages/meerkat-relay/bin/meerkat-persona-service.mjs`
- `docs/reports/REPORT-meerkat-competitor-ads-2026-07-07.html`
- `docs/reports/REPORT-meerkat-final-review-2026-07-07.html`
- `docs/sessions/2026-07-07-meerkat-final-review-competitor-ads.md`
