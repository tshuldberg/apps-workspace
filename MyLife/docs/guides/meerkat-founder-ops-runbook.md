# Meerkat Founder-Ops Runbook

Last updated: 2026-07-07. Consolidated from the Plan 19/20/21/22/23/25 audits, the
2026-07-01 launch-finish handoff, and the 2026-07-07 plan reconciliations. These are the actions ONLY the founder can do
(deploys, accounts, signing, hardware QA). Every item here gates launch; none is codeable
by an agent. Work top to bottom; the ordering matters.

## 0. Status snapshot (what this unblocks)

Code-complete, reconciled, or superseded Meerkat plans moved to `docs/plans/done/`
on 2026-07-07: 19, 20, 21, 22, 23, 24, 26, 27, 29, 37, and 39. Active queue work is now:

- Plan 25: calls and rooms are not started in code, but the plan is buildable.
- Plan 40: final launch gate, carrying the Plan 21 same-account device-linking UX,
  the Plan 23 global Downloads browser, web launch Playwright, store/legal metadata,
  Plan 25 evidence intake, and founder-ops evidence.
- Plan 41: user-controlled storage destinations, including local device, iCloud
  Drive, Google Drive, other retail storage providers, and connected servers.

Out of the box the app still has no live default connectivity until deploy/env work
below lands: `DEFAULT_RELAY_URL` remains inert by design and the clients dial through
the health-gated `effectiveRelayUrl(db)` choke point. Nothing below fakes readiness;
each step flips a real, health-gated capability.

## 1. Build and dependency ops (do first, ~1 hour + build queue)

1. DONE (verified 2026-07-04 audit). Lockfile is synced with the declared native deps
   (`expo-share-intent`, `react-native-webrtc`, `@config-plugins/react-native-webrtc`);
   a `--frozen-lockfile` CI install no longer fails on them.
2. Provision the iOS App Group `group.com.mylife.meerkat` on the Apple Developer account.
3. Provision the iCloud Drive / iCloud container entitlements required by Plan 41
   if the implementation uses native iCloud container access instead of Files-only
   provider access.
4. DONE (verified 2026-07-04 audit). `app.json` carries the real EAS `projectId`
   `c662e59e-1950-4b9e-ae0e-262bc3bbfdf1`; the `REPLACE_WITH_EAS_PROJECT_ID`
   placeholder is gone.
5. `expo prebuild` + a dev/EAS build so the config plugins apply: iOS Share Extension +
   App Group, data-protection hardening, `react-native-webrtc` native + ICE config.
   This build is the prerequisite for every device-QA item in section 5.

## 2. Deploy: connectivity spine (the single biggest launch blocker)

1. Publish the relay image: run `.github/workflows/publish-relay-image.yml` (tag `relay-v*`,
   GHCR). Verify the published image boots. Note: CI is currently down over GitHub billing;
   restore billing first.
2. Deploy the first-party zero-knowledge default relay: `render.yaml` (Render) or
   `packages/meerkat-relay/deploy/fly.toml` (Fly), TLS on.
3. Verify `GET /healthz` over TLS from an external network.
4. Only then flip the default URL: `MEERKAT_DEFAULT_RELAY_URL` (mobile, read by
   `apps/meerkat/app.config.ts`) and `VITE_MEERKAT_DEFAULT_RELAY_URL` (web). The client
   health gate (`effectiveRelayUrl`) keeps the default inert until a real probe passes, so a
   premature flip does not fake connectivity, but do not flip before 3 anyway.
   Unblocks: out-of-box pairing, DMs, FF3 public joins, background mailbox drain.
5. Deploy the always-on first-party community node (`bin/meerkat-community-node.mjs`) and the
   public directory node (`bin/meerkat-public-directory-node.mjs`), each with a persistent
   `DATA_DIR` volume. Put the edge per-IP rate limiter (Caddy config in
   `packages/meerkat-relay/deploy/Caddyfile`) in front of the open read routes.
   Unblocks: the Public Social layer un-hides (it is honestly hidden until a configured,
   responding directory source exists).
6. TURN server provisioning for WebRTC (`MEERKAT_TURN_URL` / `MEERKAT_TURN_USERNAME` /
   `MEERKAT_TURN_CREDENTIAL` env into `extra.iceServers`). Needed for real-world NAT
   traversal on the WebRTC data rung now, and by Plan 25 calls later.

## 3. Deploy: desktop host companion

1. Per-OS binaries: `packages/meerkat-relay/host/build/build.mjs` + `sea-config.json`
   (`build:host`). Code-sign and notarize (macOS), sign (Windows).
2. Ship or fetch `cloudflared` (the tunnel dependency).
3. Deploy the external off-host reachability endpoint referenced by
   `HostServerDeps.reachabilityServiceUrl` (`host/server.ts:183-187`). Must be a genuinely
   external echo, never a self-fetch, so the dashboard's "verified reachable from the
   internet" stays honest.

## 4. Money, stores, and legal (parallel with 2-3; needed before live billing and store submission)

1. Apple App Store Connect + Google Play Console: create the app records; product
   `meerkat_app_unlock` ($4.99 one-time); sandbox testers. The product id is now
   locked in code.
2. Stripe account: products/prices for the hosted subscription (`$4.99/month` with
   hosted storage included), webhook endpoint, test mode first. The hosted service
   code now consumes these settings.
3. App Store Server API + Google Play Developer API credentials for server-side receipt
   validation (the cross-rail link-code flow).
4. Replace `ILLUSTRATIVE_UNIT_COSTS` in hosted pricing with real provider invoice numbers
   and flip `illustrative: false` before presenting hosted margin or cost claims.
5. Encryption export compliance: ECCN 5D992.c self-classification + the App Store Connect
   questionnaire; French declaration if distributing there.
6. Apple App Privacy nutrition label + Google Play Data Safety form.
7. Publish a privacy policy page and a Play data-deletion-instructions page (agents can
   draft; hosting + legal sign-off is yours).
8. Store UGC/moderation policy review before the public layer launches (report flows,
   blocking, moderation SLAs; both stores require this for UGC apps).
9. Deploy a real content-scanning service (AV/malware/CSAM hash matching) feeding
   `cm_archive_moderation` before the public archive accepts real submissions.
10. Store listing metadata: name, subtitle, description, keywords, screenshots, age rating.
    Copy must reflect current launch reality: verify-to-view public feed, $4.99
    one-time to post, hosted subscription optional, private mesh unaffected, calls not
    marketed until Plan 25 ships.
11. Google Cloud OAuth app for Plan 41 Google Drive: iOS, Android, and web client
    ids, test users, app verification status if broader Drive scopes are needed,
    and privacy copy aligned with encrypted-object storage.
12. Storage provider disclosures for Plan 41: App Store and Play forms must state
    that users can optionally connect third-party storage providers and that those
    providers receive encrypted object sizes/timing, not device private keys.

## 5. Device QA (needs the dev build from 1.4 + two physical devices)

Run each as a scripted exit demo; record pass/fail in `apps/meerkat/Tickets/`.

1. FF3 public join over the real relay: A publishes open, B redeems (roster row, zero key);
   A publishes request-mode, B queues, A drains + approves, B gets membership + key.
2. OS Share-sheet intake on real iOS and Android builds: text, url, image, pdf, audio,
   video, file, multi-item; survives extension exit and app kill.
3. WebRTC DataChannel and Nearby 2-device transfer; BLE wake ping; confirm "connected"
   appears only after real ICE/channel open. Desktop companion LAN/WAN adopt from a phone
   on cellular.
4. Background sync: OS-scheduled drain + data-only push wake on the dev build
   (`background_sync_enabled`), delivery timing on iOS.
5. DM end-to-end: 2-device send/receive/receipts, offline park + drain, group add/remove,
   and same-account device convergence once Plan 40 link-device UI is built.
6. Calls/rooms once Plan 25 lands: 1:1 voice/video cross-network, TURN traversal, 3+
   participant room via the SFU, screen share, recording indicator honesty.
7. Storage destinations once Plan 41 lands: local device backup/restore, iCloud
   Drive selection and restore, Google Drive OAuth/upload/restore/revoke, Android
   file-provider destination, quota exceeded, permission revoked mid-job, and
   connected server storage descriptor verification.
8. Proximity communities: local-only community refuses to sync over relay, syncs on
   shared Wi-Fi and Nearby.
9. The 48h external uptime monitor on the live relay before submission.

## 6. Order of operations summary

Section 1 -> section 2 (relay first, then nodes) -> section 3 anytime after 1 ->
section 4 in parallel -> finish active queue code (25, 40, 41) -> section 5 exit demos
as each feature is available -> store submission last. Plan 40 is the final gate.
