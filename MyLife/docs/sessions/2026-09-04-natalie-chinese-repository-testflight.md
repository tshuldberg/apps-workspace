# NatalieLearnsChinese repository and TestFlight setup

Date: 2026-09-04.

## Outcome

The existing standalone FlashCards app is now dedicated to Natalie, with a private
[GitHub repository](https://github.com/tshuldberg/NatalieLearnsChinese). Its history and
working directory remain in `/Users/trey/Desktop/Apps/FlashCards`; no duplicate app tree
or new MyLife runtime dependency was created. The separate MyFlash remote was untouched.

The screenshot requirements already existed: English-first Chinese cards, independent
1-5 pronunciation/recognition schedules, and optional guided writing. Her full voice note
has not arrived, so full product completion and her device acceptance are still pending.

## Changes

- Standalone app display name and study heading now identify NatalieLearnsChinese.
- Preserved Expo slug, project ID, bundle ID, scheme, and database for continuity.
- Created Apple app ID `6808803213`, external group `Natalie Beta`, beta description,
  and review details using the existing Apple account and review contact.
- Configured `eas.json` with the real app ID and explicit store-distribution profile.
- Added `docs/natalie-beta.md` and replaced the old internal-tester runbook with the
  external release workflow. Updated standalone AGENTS, README, PROJECT_LOG and errors log.
- Updated `/Users/trey/Desktop/Apps/AGENTS.md` project index and this MyLife memory entry.

## Release evidence

- [Signed iOS build 1.0.0 (3)](https://expo.dev/accounts/trebaybay/projects/flashcards/builds/28193dc2-20e4-4106-8a08-a3a4f6e19cdb): Finished; source `ef0f3da`.
- [Expo upload job](https://expo.dev/accounts/trebaybay/projects/flashcards/submissions/34c32eb2-2bca-4929-a843-010908206cc5): canceled during the provider outage.
- Direct Apple `altool` upload succeeded at 18:23 EDT, delivery `60a2c808-5d2e-4d80-9275-b90bcf5919b8`. Temporary key file removed after upload.
- Public link created: https://testflight.apple.com/join/dE5Ta9R5, enabled with one slot. Build 3 attached; installability pending Apple approval.
- [Apple TestFlight](https://appstoreconnect.apple.com/apps/6808803213/testflight/ios): build processed VALID, external review submitted at approximately 18:26 EDT, WAITING_FOR_BETA_REVIEW. Automatic notification enabled. Approval and installation remain pending.

## Verification

365 tests passed; app and package type checks passed; iOS export passed; bundled stroke
database verified (9,574 characters, 11/11 samples). No function logic changed, so the
function gate was skipped. MyLife `pnpm check:parity` and `pnpm check:generated-artifacts`
passed. Parity still reports known missing-standalone warnings and four skipped passthrough
tests; this does not prove the pending Chinese feature backport is complete.

## Issues and boundaries

GitHub SSH push failed; repo-local HTTPS with the existing gh credential helper worked.
EAS rejected `--what-to-test` as Enterprise-only; retry without the flag queued successfully.
Both issues are recorded in the standalone errors log. Expo also reported a submission
outage. The queued job was canceled and the downloaded, signed IPA uploaded directly
to Apple successfully. This workaround is recorded as resolved in the standalone log.

The installed Apple wrapper rejected an unnecessary notification update because it included read-only status fields. Existing automatic notification was already enabled; skipping that call allowed review submission. Recorded as mitigated in the standalone errors log.

No fresh device interaction was verified this session. Computer Use permissions were
pending; Apple configuration used the installed Expo Apple client instead. Existing
MyLife and Meerkat changes were preserved, and no MyLife changes were committed or pushed.

The full voice note, new requirements implementation, actual device acceptance, and
Apple approval remain distinct from a successful signed build. Trey shares the eventual
verified invitation himself; no message was sent to Natalie.

## Final repository state

Standalone changes committed and pushed to its dedicated private main branch. MyLife
and workspace documentation edits remain local because their working trees contained
unrelated concurrent changes. No additional study logic or hub backport was included.
