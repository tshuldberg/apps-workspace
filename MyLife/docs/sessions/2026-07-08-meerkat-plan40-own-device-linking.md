# Meerkat Plan 40 Own-Device Linking UX

Date: 2026-07-08
Branch: `feature/meerkat-plan40-own-device-linking`
Worktree: `.claude/worktrees/main-merge`

## Summary

Started Plan 40 Section 1 by implementing the visible same-account "link this second device" flow on both Meerkat mobile and web. The UI reuses the existing pairing, SAS, mailbox, `dm_own_devices`, `linkOwnDeviceCore`, and provider-level `linkOwnDevice` paths. No new transport was added, and no `dm_` table was moved into personal-replica sync.

## Built

- Added shared pure own-device status helpers for mobile and web. They summarize four honest states: no link, linked but waiting, mirrored rows arrived, and mirrored rows plus signed receipts arrived.
- Added real database status reads from `dm_own_devices`, `dm_messages`, and `dm_delivery`, counting only actual linked-device authored rows and signed receipt rows.
- Added candidate gating for paired devices: active, not revoked, SAS-verified, and not already linked.
- Added mobile `OwnDeviceLinkCard` and wired it into Messages and Settings.
- Added web `OwnDeviceLinkPanel` and wired it into Messages and Settings.
- Added mailbox-check actions that call the existing foreground drain and report only actual drain results.
- Extended the mobile foreground-drain result with `dmReceipts` so receipt arrivals refresh the visible status just like web.
- Extended the Meerkat parity script to lock the new mobile and web own-device surfaces and shared helper parity.

## Honesty Boundaries

- With no linked own device, the UI says direct messages are local to this device.
- A link only records an existing paired device in `dm_own_devices` on the current device.
- The UI does not claim convergence after linking alone.
- The UI claims convergence only after real mirrored DM rows and signed receipts from linked own devices are present locally.
- The copy states that two-way mirroring requires running the same link from the other device.

## Verification

- `pnpm --filter @mylife/meerkat-app test -- dm-own-device-status.test.ts`
- `pnpm --filter @mylife/meerkat-web test -- web-dm-own-device-status.test.ts`
- `pnpm --filter @mylife/meerkat-app typecheck`
- `pnpm --filter @mylife/meerkat-web typecheck`
- Web browser QA at `http://localhost:5174/`: onboarding, Messages own-device panel, Check mailbox now, and Settings own-device panel. Console had no app errors.
- `pnpm check:meerkat-parity`
- `pnpm gate:function:changed`
- `pnpm check:generated-artifacts`
- `pnpm check:parity --quiet`

## Open Section 1 Evidence

- AC-40.1 still needs real mobile-to-web and web-to-mobile linking without developer tools.
- AC-40.2 still needs physical or browser-plus-device proof that outbound DM rows and verified receipts mirror through the existing mailbox path.
- AC-40.4 still needs two-device live-relay QA for offline park, drain, read receipt, and group-DM receipt exclusion.

## Notes

The first Meerkat parity rerun caught a duplicate `mobileSettingsScreen` declaration in `scripts/check-meerkat-parity.mjs`. That was fixed in the same session and logged in `errors_log.md` as resolved.
