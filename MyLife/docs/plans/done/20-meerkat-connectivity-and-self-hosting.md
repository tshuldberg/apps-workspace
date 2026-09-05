# Feature Spec: Connectivity + Easy Non-Technical Self-Hosting

> Meerkat launch plan 20 of the 6-plan launch set. Adapts `docs/plans/templates/agent-feature-spec-template.md`
> to Meerkat's real structure: `apps/meerkat` (Expo Router mobile), `apps/meerkat-web` (Vite React SPA),
> `packages/sync` (`@mylife/sync` engine), `packages/meerkat-relay` (`@mylife/meerkat-relay` relay + nodes + deploy),
> `packages/ui` (`@mylife/ui`). UI uses the **Open Burrow** theme tokens (`apps/meerkat/.../theme/tokens.ts`,
> `MK_PALETTES { light, dark }`), not Cool Obsidian.

> **Harvest note (2026-06-28).** This plan also folds in two work streams harvested from the archived Apr-2026
> "Universal Share to Mesh" program (`docs/plans/archive/09-universal-share-to-mesh-delivery.md`,
> `docs/plans/archive/10-universal-share-mission-control.md`), retargeted from the hub (`apps/mobile`) + BestChef
> to `apps/meerkat` + `apps/meerkat-web` and stripped of the hub/BestChef module-resolver framing:
> **(A) OS Share-into-Meerkat** — an iOS Share Extension + App Group staging, Android `ACTION_SEND`/`ACTION_SEND_MULTIPLE`
> intent filters, a durable content-addressed share-intake model, and a "Share Inbox" that routes an incoming shared
> item into a community channel, a DM (plan 21), or files; web parity = file-picker/drag-drop intake + a PWA Web Share
> Target where supported. **(B) Real data transports** — wire the currently-SIMULATED WebRTC DataChannel / Nearby
> (Multipeer / Wi-Fi Direct) / BLE-wake backends in `@mylife/sync` into real native backends as ADDITIONAL real
> data/file transports beyond relay + LAN (**mobile-only for v1; the web client stays relay-only — browsers have no raw P2P sockets**), with honest availability probing and the deterministic ranked-transport
> selector; BLE stays wake-only. (Live-call WebRTC **media** is plan 25; here WebRTC is the **DataChannel** for
> data/file transfer.) No crypto is reimplemented: the share-intake and transport backends carry the existing
> frame-enveloped, handshaked, signed payloads unchanged.

## Reconciliation Status (2026-07-07)

Status: Done for codeable repository scope. Moved from `docs/plans/queue/` to
`docs/plans/done/` after verification against local `main` (`3807c60b` before this
docs-only reconciliation). Code anchors verified: `effectiveRelayUrl(db)` twins,
`expo-share-intent` and App Group config, mobile `RNWebRTCSession` data backend,
Share Inbox on both surfaces, host companion bins/build notes, public-directory and
community-node deployables, and parity guards. Remaining app group provisioning,
prebuild/EAS build, relay/node deploys, TURN provisioning, host signing, and
physical device QA are founder-ops in the runbook.

## Metadata

- **Surface(s):** `apps/meerkat` (mobile client + new iOS Share Extension target/Android intent filters + new Share Inbox), `apps/meerkat-web` (web client + file-picker/drag-drop intake + optional PWA Web Share Target), `packages/meerkat-relay` (relay + **first-party always-on community-node deploy** + new desktop host companion + deploy/ops), `packages/sync` (config + health-gate plumbing + a centralized `effectiveRelayUrl`/`resolveDefaultRelay` resolver + a durable share-intake model + **mobile-only real native backends for the simulated WebRTC/Nearby/BLE transports** (web stays relay-only); **no crypto change**).
- **Priority:** S-Tier launch blocker. Per `/tmp/meerkat-map/x-relay.md` §9, "No relay is deployed... This is the single biggest launch blocker." Out-of-box connectivity gates Full DMs, Public Social Layer, and Launch Readiness.
- **Estimated effort:** ~14-18 CC days (Large/Complex, Complexity 1). Phases 0-3 are app/engine + ops including the 21-read-site centralization and the stale-copy rewrite (~3-4 days); Phase 1.5 adds the first-party always-on community-node + public-directory deploy (~0.5 day ops); **Phase 7 is the connectivity/self-hosting honesty/parity/docs/ship pass (~1 day).** Phases 4-6 are the desktop host companion (a net-new surface, ~3-4 days). **Phases 8-11 are the harvested OS Share-into-Meerkat intake + Share Inbox routing and the real native data transports (~5-7 days, incl. the `react-native-webrtc` native dependency + its Expo config plugin THIS PLAN OWNS, an iOS Share Extension config plugin, Android intent filters, and three mobile-only native transport backends behind lazy-load capability probes).** Phase 12 is the share + transport honesty/parity/ship pass (~1 day). Total re-baselined upward from the original ~12-16 to absorb the added stream A+B scope (now including the owned native WebRTC layer) and to count Phase 7.
- **Depends on:**
  - **Theme system plan** (Open Burrow tokens) — soft dependency; reuse its tokens for any new UI. Can proceed in parallel; this plan only adds rows/cards inside existing themed screens.
  - Existing real substrate (all present today): relay `startRelayServer` (`packages/meerkat-relay/src/server.ts:111`), slim bin (`bin/meerkat-relay-server.mjs`), community node (`bin/meerkat-community-node.mjs`), seeder (`bin/meerkat-node.mjs`), deploy artifacts (`render.yaml`, `packages/meerkat-relay/deploy/fly.toml`, `packages/meerkat-relay/deploy/docker-compose.yml`, `packages/meerkat-relay/deploy/Caddyfile`), GHCR workflow (`.github/workflows/publish-relay-image.yml`), relay selector (`packages/sync/src/transport/relay-selector.ts`).
  - **Harvested-stream substrate (all present today):** simulated transports + ranked selector (`packages/sync/src/transport/{webrtc-transport,nearby-transport,ble-transport,transport-manager}.ts`); content-addressed blob store (mobile `apps/meerkat/app/(root)/data/{blob-store-core,expo-blob-store,community-files,file-request-core,file-save}.ts`; web `apps/meerkat-web/src/ui/files`, `src/lib/storage`); the existing web file-pick → blob path (`apps/meerkat-web/src/ui/channel/Composer.tsx`, `<input type="file">` → `attachAndSend`); and the **Manhattan precedent** for OS share intake (`apps/manhattan/package.json` `expo-share-intent@5.1.1`; `apps/manhattan/app.json:76-87` App Group `group.com.mylife.manhattan` + `iosActivationRules` + `androidIntentFilters`; `apps/manhattan/app/(root)/share/` intake route; App-Group data-protection config plugins `apps/manhattan/plugins/{withDataProtection,withSecurityHardening}.js`).
  - **Full DMs plan (plan 21)** — **soft dependency, harvested stream A only:** "route a shared item into a DM" targets the plan-21 DM surface (`apps/meerkat/app/(root)/(tabs)/messages.tsx`). The Share Inbox ships channel + files routing without it; the DM route lights up once plan 21 lands (degrade-honest: the DM target is hidden until the DM surface exists, never a dead button).
  - **Calls & rooms plan (plan 25)** — **shared-layer ownership, not a blocker:** **THIS plan OWNS the shared `react-native-webrtc` native layer** — the `apps/meerkat/package.json` dependency, its Expo config plugin declared inside `app.config.ts`, the ICE/STUN/TURN configuration, and the real WebRTC **DataChannel** DATA-transport backend (mobile-only; web stays relay-only) — and lands it first (Phase 11) as a HARD dependency. **Plan 25 CONSUMES that same layer for live-call WebRTC media (SFU/peer A-V) and does NOT re-add the dep/plugin/ICE config** — it references Plan 20 as the owner and extends the already-wired `WebRTCPeerSession` with media tracks. The **SFU/media server is Plan 25's own** (its own deploy/ops/scale/cost), co-located on the Plan 20 relay fleet but **not co-owned by Plan 20**; Plan 20 supplies only the relay signaling carrier (`env` token-group forward), TURN, and the `effectiveRelayUrl` resolver. The two surfaces are independent.
- **Blocks:**
  - **Full DMs plan** — DM delivery rides the mailbox + relay; a default connection makes DMs work out of the box.
  - **Public Social Layer plan** — its "Public feed inclusion is a paid hosted service... stays hidden until **a real hosted source exists**" (`apps/meerkat-web/src/lib/hosted-boundaries.ts:104-108`, mobile `apps/meerkat/app/(root)/data/hosted-boundaries.ts:103-109`) needs a deployed, **always-on, first-party** community-node + public-directory serving path. **This plan now stands that up** (Phase 1.5, net-new item 6): a first-party always-on community node + the plan-19 public-directory deployable, run on our infra — NOT the user's non-always-on desktop companion. Without this deploy, Public Social stays honestly hidden.
  - **Launch Readiness plan** — out-of-box connectivity is its top exit criterion.
- **Sibling (not blocking):** **Monetization + Billing plan** wires the PAID `$4.99/mo` hosted tier (`hosted-api.ts` Stripe + the `meerkat:hosted-relay` / `meerkat:community-node` entitlement gate). This plan ships the **free** default relay with the entitlement gate **OFF** (the slim bin already omits `hostedEntitlement`, `bin/meerkat-relay-server.mjs:28`), so the two plans share the entitlement-optional code path without conflict.
- **Build order:** **20 (this) → Full DMs → Public Social Layer → Launch Readiness.** Monetization may land before or after; theme system before for token reuse.

---

## Status Delta (2026-07-01, read first)

- CODE-COMPLETE, Phases 0-12, locally verified (branch feature/meerkat-launch-finish, commits 1182df39, e21ec49d, 9c91a512, 9747d744, 7d1a1565, b6e5c187, 4e4ee122, e6976f5d). All 12 phases' artifacts verified present 2026-07-01: health-gated effectiveRelayUrl choke point (packages/sync/src/transport/default-relay.ts + app wrappers, 15 mobile + 13 web call sites, zero raw fallbacks); env-configurable relay fair-use caps (resolveRelayLimits, packages/meerkat-relay/src/protocol.ts:107); 5-state Connection cards on BOTH surfaces (mobile components/ConnectionStatusCard.tsx with QR scan + adopt; web src/ui/sync/ConnectionStatusCard.tsx); desktop host companion (packages/meerkat-relay/host/: spawn, process-supervisor, host-config, tunnel, lan, domain, off-host-probe, reachability, qr, server, wizard + dashboard UI, 11 test files, bin/meerkat-host.mjs); durable share intake (packages/sync/src/share/) + iOS Share Extension / Android intents config (app.config.ts:83-97, expo-share-intent 5.1.1, App Group group.com.mylife.meerkat) + Share Inbox both surfaces + web share_target manifest; real WebRTC/Nearby/BLE backends behind capability probes (data/transport-backends.ts, webrtc-backend.ts, nearby-backend.ts, ble-backend.ts; BLE wake-only; web relay-only, parity-guarded); tunnel reachability re-verify with TTL + onExit reset (host/server.ts:85-233). check-meerkat-parity reports 176 OK checks.
- Remaining codeable (OPTIONAL, plan-compliant to skip): web QR-scan half of the adopt flow. RelayBar.tsx already accepts a pasted connection card or wss:// URL; no webcam/file QR reader exists in apps/meerkat-web (QrCodeSvg.tsx is a generator only). AC-6 scopes QR scan as mobile-only, so this is an enhancement, not a gap.
- Everything else remaining is founder-ops: (1) pnpm install at repo root to sync the lockfile for expo-share-intent@5.1.1, react-native-webrtc, @config-plugins/react-native-webrtc; (2) expo prebuild + dev/EAS build so config plugins apply; (3) provision iOS App Group group.com.mylife.meerkat; (4) deploy the default relay (render.yaml or packages/meerkat-relay/deploy/fly.toml), publish the GHCR image via .github/workflows/publish-relay-image.yml (relay-v* tag), flip MEERKAT_DEFAULT_RELAY_URL / VITE_MEERKAT_DEFAULT_RELAY_URL only after a real GET /healthz over TLS; (5) deploy the always-on community node + public directory node with persistent DATA_DIR; (6) desktop companion per-OS build:host binary + code signing/notarization, ship or fetch cloudflared, deploy the external off-host reachability endpoint (HostServerDeps.reachabilityServiceUrl, host/server.ts:183-187); (7) device QA: OS share intake on real builds, WebRTC/Nearby 2-device transfer + BLE wake, desktop companion LAN/WAN adopt from cellular. See the consolidated runbook at docs/guides/meerkat-founder-ops-runbook.md.

---

## Business Context

### Why this feature exists

Today both Meerkat surfaces ship with `DEFAULT_RELAY_URL = ''` on purpose (`apps/meerkat/app/(root)/data/sync-core.ts:103`, `apps/meerkat-web/src/lib/relay.ts:14`). The relay/node code is real, zero-knowledge, abuse-capped, and Docker-shippable, but **no relay is deployed and no URL is distributed**, so a fresh install can do nothing networked: it cannot pair by friend code, drain a mailbox, run a relay session, request a file back, or reach any community — until a human pastes a `wss://` URL into settings. A $4.99 paid app that opens to dead connectivity churns on first run.

This plan closes that gap in two honest halves:

1. **Default / free connectivity** — deploy a first-party, zero-knowledge default relay (Render/Fly), publish the public relay image, and wire a **health-gated** default into both clients so out-of-box pairing, our-main-server sharing, and (on mobile) same-Wi-Fi no-server LAN all work — without ever faking a `wss://` that might be down.
2. **One-tap secure self-hosting** — a non-technical desktop companion that turns a user's own computer into their relay + community node ("spin up a Discord from your laptop") with guided setup, automatic TLS/tunnel/NAT-traversal, and basic security hardening, reusing the real `bin/*` entrypoints and deploy artifacts.

### Which competitor's users this wins

| Competitor | What they offer | Friction we remove | Who we win |
|---|---|---|---|
| **Discord** | Free hosted servers, but Discord owns the data, reads metadata, can ban/deplatform, and you cannot self-host. | Self-hosting Discord is impossible. Meerkat lets a community own its server with one tap and zero-knowledge by construction. | Privacy-conscious community owners, mods burned by deplatforming, and groups who want to leave Discord but lack a sysadmin. |
| **Matrix / Synapse / Element** | Truly self-hostable + federated, but standing up a homeserver needs Postgres, reverse proxy, TLS, DNS, and ongoing ops — a sysadmin task. | We collapse "deploy a homeserver" into a double-click desktop app with a tunnel that yields a working `wss://` automatically. | Matrix's intended audience who bounced off the operational complexity. |
| **Signal** | Excellent E2E, but a single central server you cannot run, and group/community features are thin. | We give the same crypto posture plus member-run servers and real communities/feeds. | Signal users who want community spaces without a central operator. |
| **Mastodon** | Self-hostable social, but again a VPS + Postgres + Sidekiq + DNS chore, and the instance admin sees plaintext. | Zero-knowledge servers + one-tap host = a "personal instance" without the plaintext-admin trust problem or the ops. | Fediverse-curious users who want to host but not operate. |

The wedge: **"Run your own Discord/Matrix in one tap, where even you (the host) can't read it."** No competitor offers one-tap self-hosting that is also zero-knowledge.

### Target user

- **Client side (both apps):** every paying user. The win is that the app connects on first run with no setup.
- **Host side (desktop companion):** the non-technical "community organizer" — a club president, a family elder, a group-chat admin — who would pay $4.99 once and wants their group on a server they control, but has never opened a terminal. Migration path: they currently run a free Discord; we let them move the group to their own laptop-hosted, zero-knowledge community in under five minutes.

---

## Current-State Grounding (what exists vs net-new)

### Already real (reuse, do not rebuild)

| Capability | Evidence (file:line) | State |
|---|---|---|
| Zero-knowledge WS relay (token pairing, verbatim ciphertext, mailbox, rendezvous, host registry) | `packages/meerkat-relay/src/hub.ts:137-279`, `src/server.ts:111-275` | REAL, ~110 tests |
| Slim production relay image (ws+zod only, no `@mylife/sync`) | `packages/meerkat-relay/Dockerfile`, `bin/meerkat-relay-server.mjs:21-34` | REAL, builds |
| `GET /healthz -> { ok, connections }` (the probe target) | `src/server.ts:120-132` | REAL |
| Relay admission + per-IP rate caps (10k conn / 64 per-client / 8 peers/token / 200 env per 10s / 30 rendezvous per 10s), honors `X-Forwarded-For` | `src/protocol.ts:17-66`, `src/hub.ts:92-131`, `src/server.ts:205-208` | REAL; `RELAY_LIMITS` is a frozen constant, but `RelayHub` **already** accepts `limits?: Partial<RelayLimits>` and merges it (`src/hub.ts:51,84`). The genuinely un-wired reads are the two **module-level** `RELAY_LIMITS` uses in `src/server.ts` (`maxFrameBytes` at `:136`, `maxConnections` at `:194`) |
| Always-on community node (signed per-member auth, durable revision monotonicity, per-community piece scoping, rate limits, optional notify/announce) | `src/community-node.ts:342-605`, `src/community-node-http.ts`, `bin/meerkat-community-node.mjs:39-128` | REAL logic; production image deferred ops |
| Desktop seeder node (pin/serve/verify/sweep web-seed) | `src/seeder-node.ts:36-90`, `src/seeder-http.ts:34-159`, `bin/meerkat-node.mjs` | REAL logic; image deferred ops |
| Entitlement gate (opt-in, `required:false` default) on relay + community node | `src/server.ts:34-56`, `src/community-node-http.ts:40-49`; crypto `packages/entitlements/src/meerkat-hosted.ts:151-211` | REAL, OFF by default |
| Relay selection: `selectRelay`/`rankRelays`/`probeRelays` over real `/healthz` HTTP probe, latency + load tie-break | `packages/sync/src/transport/relay-selector.ts:42-111` | REAL, **client list is empty today** |
| Deploy artifacts: root `render.yaml` (`autoDeploy:false`, `plan:starter`), `packages/meerkat-relay/deploy/fly.toml` (us region), `packages/meerkat-relay/deploy/docker-compose.yml` + `packages/meerkat-relay/deploy/Caddyfile` (Caddy commented out), `packages/meerkat-relay/deploy/.env.example` | listed files | REAL templates, **not deployed** |
| GHCR publish workflow (`workflow_dispatch` / `relay-v*` tag) | `.github/workflows/publish-relay-image.yml:19-23` | REAL, **never run** |
| Client effective-relay read pattern `getSetting(db, RELAY_URL_SETTING_KEY)?.trim() \|\| DEFAULT_RELAY_URL` (the **21 centralization targets**, replaced by `effectiveRelayUrl(db)` in Phase 0.5) | mobile `SyncProvider.tsx:468,573,648,736,793,834,853,957` (8) + `NodeProvider.tsx:297,317` (2) + `background-sync.ts:139,235` (2); web `MeerkatProvider.tsx:721,885,1057,1185,1200,1562,1636,1760,1825` (9) | REAL, falls through to `''`; **a raw `\|\| DEFAULT_RELAY_URL` cannot encode `default_relay_optout`** (a per-device DB row), so these must route through `effectiveRelayUrl(db)` |
| Mobile LAN rung (same-Wi-Fi, no relay) + mDNS | `apps/meerkat/.../data/lan-backend.ts`, `SyncProvider.tsx:1238-1274` | REAL, **dev build only** |
| Web env hooks `VITE_MEERKAT_HOSTED_RELAY_URL` / `_API_URL` / `_COMMUNITY_NODE_URL` | `apps/meerkat-web/src/vite-env.d.ts`, `src/lib/hosted-access.ts:7-9` | REAL, **unset; no `.env` files exist** |
| Web RelayBar (paste URL / "Deploy my own" + deploy-guide link) | `apps/meerkat-web/src/ui/sync/RelayBar.tsx:11-99` | REAL |
| Mobile relay URL field + "Pair by friend code" publish/resolve | `apps/meerkat/app/(root)/sync.tsx:313-398` | REAL |
| Hosted-services boundary matrix (honest "not connected" copy) | `apps/*/.../hosted-boundaries.ts:41-126` | REAL |
| Operator deploy guide | `docs/guides/deploy-a-meerkat-relay.md` | REAL |
| `$4.99/mo` hosted product config (distinct from one-time app) | `packages/billing-config/src/index.ts:135-139` | REAL config |

### Net-new in this plan

1. **A deployed first-party default relay** (ops) reachable at a real `wss://` URL, with monitoring.
2. **A published public relay image** (run the GHCR workflow / push `relay-v*`).
3. **Build-time default-relay config** wired into both apps without faking: web `VITE_MEERKAT_DEFAULT_RELAY_URL` (net-new env, declared in `apps/meerkat-web/src/vite-env.d.ts`, kept **distinct** from `VITE_MEERKAT_HOSTED_RELAY_URL`), mobile `extra.defaultRelayUrl` via `expo-constants`. **Mobile requires converting the static `apps/meerkat/app.json` (`extra` at `:69`) to `app.config.ts`** so `extra.defaultRelayUrl` can read `process.env` at build; a static `app.json` cannot interpolate env. `DEFAULT_RELAY_URL` reads the env at build, defaults to `''` (so an unconfigured build keeps today's honest behavior).
4. **A health-gated default-connection layer** in `@mylife/sync`/apps: a default relay is only treated as usable when its real `/healthz` probe passed; otherwise the existing honest "waiting / set a connection server" copy shows. Net-new pure helper `resolveDefaultRelay()`/`resolveDefaultRelaySync()` + a per-relay probe cache table, **exported from BOTH `packages/sync/src/index.native.ts` and `index.ts`** (the multi-node harness imports the native barrel).
5. **A single `effectiveRelayUrl(db)` resolver** that wraps `resolveDefaultRelaySync` and reads `relay_url` + `default_relay_optout` + the cached `mk_relay_probe` row, returning the effective dial string (`''` when opted out or no reachable URL). It **replaces all 21 raw `getSetting(...) || DEFAULT_RELAY_URL` read sites** (8 `SyncProvider.tsx`, 2 `NodeProvider.tsx`, 2 `background-sync.ts`; 9 web `MeerkatProvider.tsx`) so the opt-out + health gate actually govern every networked dial (this is what makes AC-4 satisfiable). Exported from both sync barrels alongside `resolveDefaultRelay`.
6. **A deployed first-party always-on community node + public directory** (ops): a community-node/seeder serving path on our own infra (not the user's non-always-on desktop companion) plus the plan-19 public-directory deployable, so Public Social has a real always-on hosted source to be un-hidden against. Reuses `bin/meerkat-community-node.mjs` + the `deploy/*` artifacts.
7. **Env-configurable free-tier fair-use caps** on the relay (`packages/meerkat-relay`): `RELAY_LIMITS` becomes overridable by env (clamped) via `resolveRelayLimits(env)`, wired into the two module-level reads in `src/server.ts:136,194` (the `RelayHub` merge path at `hub.ts:51,84` already exists), so the first-party free relay can run tighter per-IP budgets without code edits and self-hosts can pick a preset.
8. **Client connectivity UX (mobile + web parity):** a real "Connection" status card (default reachable / your-server / not reachable), a **connection card** paste **and QR scan** to adopt a self-hosted server, a "Host your own" entry that links the desktop companion + guide, and a **rewrite of the now-false stale copy** ("First-party hosted connection capacity is paid. There is no default") across `RelayBar.tsx`, `SyncDialog.tsx`, mobile `sync.tsx`, mobile `settings.tsx` (x2 HonestNotices), and `hosted-boundaries.ts` (mobile + web).
9. **The desktop host companion** (`packages/meerkat-relay/host/`): a double-clickable, cross-platform local control panel that supervises the real `bin/*` processes (relay + community node + seeder), runs a TLS tunnel / LAN / BYO-domain option, applies a security preset, and shows **real external-reachability status** (verified from an OFF-HOST vantage, not a self-probe) plus a shareable connection card + QR.

### Net-new — Harvested stream A: OS Share-into-Meerkat

10. **OS share intake config** (mobile native): an **iOS Share Extension** + **App Group** (`group.com.mylife.meerkat`) staging via an Expo config plugin, and **Android** `ACTION_SEND` / `ACTION_SEND_MULTIPLE` **intent filters**. Today `apps/meerkat/app.json` has NO share-intent plugin (`plugins: ["expo-router","expo-sqlite","expo-secure-store"]`, `:64-68`); the scheme is `meerkat` and bundle/package is `com.mylife.meerkat` (`:7,19,47`). Reuse the Manhattan precedent (`expo-share-intent@5.1.1`, App Group, `iosActivationRules`, `androidIntentFilters`) **declared inside the `app.config.ts`** that Phase 0 already converts `app.json` into (net-new item 3), so the extension config and the `extra.defaultRelayUrl` env-read live in one typed config. Supported content classes: text, url, image, audio, video, pdf, arbitrary file, and multi-item.
11. **A durable, content-addressed share-intake model + "Share Inbox" UI** (engine + both clients): device-local `mk_share_intake` + `mk_share_payload` tables (outside `MEERKAT_SYNC_PREFIXES`, never replicate) plus App-Group container staging on iOS; staged bytes are content-addressed into the **existing** real blob store (`data/blob-store-core.ts` / web `src/lib/storage`), not a parallel store. A new **Share Inbox** route (mobile `app/(root)/share-inbox/`, distinct from the existing seal/pin `(tabs)/share.tsx`; web a new `src/ui/inbox`) presents each staged item with an honest preview + permission/accept step and lets the user **route it into**: a **community channel** (`cm_messages` + `channel/[communityId]/[channelId].tsx`), a **DM** (plan 21 `messages.tsx`), or **files** (`community-files.ts` / blob store). Web parity: a **file-picker + drag-drop** intake (reusing the `Composer.tsx` `<input type="file">` → blob path) plus an **optional PWA Web Share Target** where the browser supports it (net-new `manifest.webmanifest` `share_target` + a service-worker handler; today `apps/meerkat-web` ships only `public/favicon.svg`, no manifest/SW) — hidden, never faked, where unsupported.

### Net-new — Harvested stream B: real data transports

12. **Real native backends for the simulated WebRTC/Nearby/BLE transports** (`packages/sync/src/transport/`): today `webrtc-transport.ts`, `nearby-transport.ts`, and `ble-transport.ts` define platform-agnostic backend interfaces but only ship `Simulated*Backend` (in-memory, no network/radio); no real backend is injected anywhere in the apps (`p2p.ts:79-80` falls back to `SimulatedWebRTCBackend`), so these layers move zero real bytes today. Only LAN (`LanSocketBackend`, MK-007) and relay (`WebSocketRelayBackend`, MK-008) are real-wired. Wire **real backends** as ADDITIONAL real data/file transports beyond relay+LAN: **WebRTC DataChannel** (`react-native-webrtc` on mobile), **Nearby** (iOS MultipeerConnectivity, Android Wi-Fi Direct / Wi-Fi Aware), and **BLE-wake** (CoreBluetooth / `android.bluetooth`, wake-only GATT notify). **These stream-B real data transports are MOBILE-ONLY for v1; the web client stays relay-only** — browsers have no raw P2P sockets, so there is no unwired web WebRTC data backend to ship (an honest platform scoping, not a deferral). Inject them through the existing `WebRTCBackend` / `NearbyPeerBackend` / `BleBackend` interfaces behind **lazy-load capability probes** (mirroring `data/lan-backend.ts`: null when the native module is absent, so Expo Go / web keep working), driven by the existing deterministic ranked selector `buildTransportLayerDialOrder` (`transport-manager.ts:61-89`; BLE excluded from `DATA_TRANSPORT_LAYER_IDS`). **Native-layer ownership:** the `react-native-webrtc` `apps/meerkat/package.json` dependency + its Expo config plugin (declared inside `app.config.ts`) + the dev/EAS-build requirement + the ICE/STUN/TURN config are net-new and **OWNED BY THIS PLAN** (Phase 11); this same shared WebRTC native layer is **consumed by Plan 25 for live-call media** (Plan 25 does NOT re-add the dep/plugin/ICE — it references Plan 20 as owner). **No crypto change:** the Noise handshake + frame envelope are transport-agnostic (`nearby-transport.ts:14-17`), so only the byte-moving backend is new.

---

## Data Model / Schema + Sync-Policy Changes

This plan is connectivity/infra; it **adds no synced entities** and **does not change `ConflictStrategy`, `COMMUNITY_SYNC_POLICY`, `MEERKAT_SYNC_POLICIES`, or any `maxScope` cap** (`apps/meerkat/.../data/sync-core.ts:42-70`). All new state is **device-local by construction** and never replicates.

### Mobile (`apps/meerkat`, prefix `mk_`, outside `MEERKAT_SYNC_PREFIXES`)

```sql
-- New: cache the LAST REAL health probe per relay URL so status copy is honest
-- (never fabricated). Display reads ok + probed_at; stale rows expire on read.
CREATE TABLE IF NOT EXISTS mk_relay_probe (
  url          TEXT PRIMARY KEY,
  ok           INTEGER NOT NULL,            -- 1 only if /healthz returned {ok:true}
  connections  INTEGER,                     -- coarse load from /healthz, nullable
  latency_ms   INTEGER,
  probed_at    TEXT NOT NULL                -- ISO; rows older than PROBE_TTL are ignored
);
```
New `mk_settings` keys (KV table already exists, `data/db.ts`): `default_relay_optout` (`'1'` when the user explicitly turns off the free default), `adopted_server_url` (a server adopted via connection card; this is just a convenience alias — the effective URL still flows through `relay_url`).

### Web (`apps/meerkat-web`, prefix `mk_`)

Identical `mk_relay_probe` table + identical `mk_settings` keys for parity, created in the web DB bootstrap (`MeerkatProvider.tsx` wiring).

### Share-intake (both apps, prefix `mk_`, device-local — harvested stream A)

The OS-share intake is **device-local by construction** and **never replicates** (same `mk_` exclusion from `MEERKAT_SYNC_PREFIXES` as `mk_relay_probe`). A staged item leaves the device only when the user explicitly routes + sends it through an existing real path (channel session / DM / file request) — at which point that path's own `sync_*` / `cm_*` rows are the source of truth, not these staging rows. Adapted (and slimmed) from the archived `ShareIntakeItem` / `SharePayloadItem` model, dropping the hub/BestChef `destinationModuleId` / `destinationResolverId` resolver fields in favor of three Meerkat destinations.

```sql
-- One row per incoming OS-shared item (text/url/image/audio/video/pdf/file/multi).
CREATE TABLE IF NOT EXISTS mk_share_intake (
  id            TEXT PRIMARY KEY,
  source        TEXT NOT NULL,              -- 'ios_share_extension' | 'android_share_intent' | 'web_share_target' | 'web_file_pick'
  source_app    TEXT,                       -- best-effort bundle id / display name when the OS provides it; nullable
  status        TEXT NOT NULL,              -- 'staged'|'reviewing'|'routed'|'discarded'|'expired'
  destination   TEXT,                       -- chosen route: 'channel'|'dm'|'files' (null until routed)
  dest_ref      TEXT,                       -- channelId / peerDeviceId / folder ref for the chosen destination
  created_at    TEXT NOT NULL,
  expires_at    TEXT NOT NULL               -- staged items are swept after TTL (cleanup job)
);
-- One row per payload inside a (possibly multi-item) share; bytes live in the existing blob store.
CREATE TABLE IF NOT EXISTS mk_share_payload (
  id            TEXT PRIMARY KEY,
  intake_id     TEXT NOT NULL,
  kind          TEXT NOT NULL,              -- 'text'|'url'|'image'|'audio'|'video'|'pdf'|'file'
  uti           TEXT,                       -- iOS Uniform Type Identifier when provided
  mime          TEXT,                       -- sniffed, not trusted from sender alone
  filename      TEXT,
  byte_length   INTEGER,
  text_value    TEXT,                       -- inline for text/url; null for files
  blob_hash     TEXT,                       -- content address into the existing blob store; null for inline text/url
  thumb_hash    TEXT                        -- optional preview blob; null when none
);
```

On iOS the extension stages provider-backed files into the App Group container (`group.com.mylife.meerkat`) before it exits; the containing app copies them into the content-addressed blob store and writes the `mk_share_*` rows on next foreground. On Android the receiver copies `EXTRA_STREAM` / `EXTRA_TEXT` URIs into app storage on a background thread, then the same model. A cleanup job sweeps `status IN ('staged','expired')` rows past `expires_at` plus their orphaned blobs.

### Host companion (`packages/meerkat-relay/host/`)

No SQLite. A plain JSON config on disk: `~/.meerkat-host/config.json` (`{ services: { relay, communityNode, seeder }, exposure: 'tunnel'|'lan'|'domain', securityPreset: 'private'|'open', caps, tunnel: {...} }`) plus in-memory runtime status. The community node keeps its existing `DATA_DIR/{pieces,descriptors}` volume (`bin/meerkat-community-node.mjs:52-54`).

### Security note (why device-local matters)

Relay config (`relay_url`, probe cache, adopted-server alias) is stored under the `mk_` prefix, which is **deliberately excluded from `MEERKAT_SYNC_PREFIXES`** (`sync-core.ts:50-55`) and **never replicates**. This is a security property, not an accident: if a peer could push your "connection server URL" over sync, a malicious paired device could silently redirect all of your traffic to a relay it controls (a metadata-harvesting / DoS pivot). Keeping connectivity config device-local closes that pivot. Even if it leaked, the relay is zero-knowledge and the handshake is fail-closed (a wrong relay can stall but cannot read or impersonate — see protocol analysis), but defense in depth keeps it off the wire.

---

## Protocol / Engine Changes in `@mylife/sync` and `@mylife/meerkat-relay`

**Mandate compliance:** no cryptography is reimplemented or modified. Identity, handshake, SAS, mailbox, group/epoch keys, sealed shares, frame envelope, inbound policy are untouched (`packages/sync/src/protocol/*`, `node/*`). Changes are config-resolution and admission-control only.

### 1. `@mylife/sync` — health-gated default-relay resolution (net-new, pure)

Add `packages/sync/src/transport/default-relay.ts`:

```ts
export interface DefaultRelayInput {
  configuredUrl: string;          // user-set relay_url (wins if present)
  defaultUrl: string;             // build-time default ('' when unconfigured)
  optedOut: boolean;              // mk_settings default_relay_optout
  probe: (url: string) => Promise<RelayProbe>;   // reuses probeRelays() internals
  lastProbe?: RelayProbe | null;  // cached mk_relay_probe row for synchronous display
}
export interface ResolvedRelay {
  url: string;                    // the effective URL ('' if none usable)
  source: 'user' | 'default' | 'none';
  reachable: boolean | 'unknown'; // 'unknown' until a probe completes
}
export async function resolveDefaultRelay(input: DefaultRelayInput): Promise<ResolvedRelay>;
export function resolveDefaultRelaySync(input: Omit<DefaultRelayInput,'probe'>): ResolvedRelay; // display-only, uses lastProbe
```

- A user-set `relay_url` always wins (`source:'user'`); the default is only consulted when no user URL is set and `!optedOut`.
- The default is reported `reachable:true` only after a real `/healthz` pass via the **existing** `probeRelays`/`selectRelay` (`relay-selector.ts:42-111`). Until then `reachable:'unknown'`; on failure `reachable:false`.
- This is a pure function (probe injected) so it is fully unit-testable and reuses the proven probe path.

**Both `resolveDefaultRelay` and `resolveDefaultRelaySync` are exported from BOTH `packages/sync/src/index.native.ts` AND `packages/sync/src/index.ts`** (today the barrels export `probeRelays`/`selectRelay` at `index.native.ts:726-732` and `index.ts:874-880` but not these new symbols). The native barrel export is mandatory because the Tier-C `support/multi-node-harness.ts` imports only from the native barrel; without it the AC-1 e2e cannot import the resolver.

**The single app-side `effectiveRelayUrl(db)` resolver (centralization, replaces the 21 read sites).** A thin synchronous helper (exported from the sync barrels, parameterized over a `getSetting`-style accessor + the app DB handle) that reads `relay_url`, `default_relay_optout`, and the cached `mk_relay_probe` row, calls `resolveDefaultRelaySync`, and returns the **effective dial string** (`''` when opted out, or when only the default exists and its last probe is not `reachable:true`). **Every networked dial replaces its raw `getSetting(db, RELAY_URL_SETTING_KEY)?.trim() || DEFAULT_RELAY_URL` with `effectiveRelayUrl(db)`:** mobile `SyncProvider.tsx:468,573,648,736,793,834,853,957`, `NodeProvider.tsx:297,317`, `background-sync.ts:139,235`; web `MeerkatProvider.tsx:721,885,1057,1185,1200,1562,1636,1760,1825`. This is the only way `default_relay_optout` (a per-device DB row, not encodable in the build-time `DEFAULT_RELAY_URL` constant) can gate the actual transport — without it AC-4 ("turn off the free default and the app stops using it") is unsatisfiable.

**Why net-new and not just a constant flip:** flipping `DEFAULT_RELAY_URL` to a hardcoded `wss://` would violate transport-honesty the moment that relay is briefly down (the app would imply connectivity it does not have), and a bare constant cannot honor the per-device opt-out. Health-gating + `effectiveRelayUrl(db)` makes the default *real-only* and *opt-out-respecting*: it is presented and dialed as a usable connection exactly when the engine confirms it and the user has not turned it off.

### 2. `@mylife/meerkat-relay` — env-configurable, clamped fair-use caps (net-new)

Today `RELAY_LIMITS` is a frozen constant (`src/protocol.ts:17-66`). Note: `RelayHub` **already** accepts and merges `limits?: Partial<RelayLimits>` (`src/hub.ts:51,84`), so the hub path is not the gap — the genuinely un-wired reads are the **two module-level `RELAY_LIMITS` uses in `src/server.ts`**: `maxPayload: RELAY_LIMITS.maxFrameBytes` (`:136`) and the global `liveSockets >= RELAY_LIMITS.maxConnections` admission check (`:194`). Add `resolveRelayLimits(env)` that overrides each field from env (`RELAY_MAX_CONNECTIONS`, `RELAY_MAX_PER_CLIENT`, `RELAY_MAX_PEERS_PER_TOKEN`, `RELAY_ENV_RATE`, `RELAY_RENDEZVOUS_RATE`, `RELAY_WINDOW_MS`, `RELAY_MAILBOX_MAX`, `RELAY_MAILBOX_TTL_MS`), each **clamped to a safe `[min,max]`** so an operator cannot set caps that enable amplification (too high) or break ordinary pairing (too low). `startRelayServer` computes the resolved limits once, passes them into the `RelayHub` (via the existing `limits` option) **and** uses them for the two `src/server.ts:136,194` module-level reads; the slim bin reads the env. Defaults unchanged when env is unset (today's behavior preserved). `/healthz` is **not** extended (zero-knowledge guarantee: `{ ok, connections }` only, `src/server.ts:127`).

**Security analysis (caps + admission):**
- Caps are DoS/abuse controls keyed by client IP (`_clientKey`, `src/hub.ts`), trusting `X-Forwarded-For` **only behind the TLS edge** (`src/server.ts:205-208`, `packages/meerkat-relay/deploy/Caddyfile:16-18`). The free first-party relay and tunnel hosts always sit behind a trusted edge (Render/Fly/Cloudflare/Caddy), so per-client caps apply per real client, not per proxy IP. Document this in the host preset: a relay exposed *directly* (no edge) must not trust the header.
- Clamping prevents two attacks: (a) an operator (or a tricked non-technical host) setting `RELAY_ENV_RATE` huge, turning the relay into a high-rate ciphertext amplifier/forwarder for a third party; (b) caps so low they DoS the host's own members. Clamp ranges are unit-tested.
- No new logged field, no new persisted state: the relay stays zero-knowledge and stateless (`packages/meerkat-relay/deploy/docker-compose.yml:27-32` read-only rootfs preserved).

### 3. Connection card (net-new, not crypto)

A "connection card" is a tiny, **non-secret, non-authenticating** payload the host shares with members: `{ v:1, relay:'wss://...', communityNode?:'https://...', name? }`, encoded as a copyable string and a QR. It is *only* a transport address. Security analysis: a relay URL is not a credential — pairing, SAS, and the signed-nonce handshake (`packages/sync/src/protocol/handshake.ts:54-229`) still happen out of band, so a malicious connection card can cause a **denial of service** (you connect to a useless/hostile relay) but **cannot** read messages (ciphertext only), learn who you talk to (per-session ephemeral tokens, `mailbox.ts:1-22`), or impersonate (handshake is fail-closed on unknown/revoked devices, `handshake.ts:101-104,161-164`). UI copy must state exactly this. The card is parsed/validated with Zod in `@mylife/meerkat-relay` (host side) and in each app (client side), rejecting non-`ws(s)` schemes.

### 4. `@mylife/sync` — real native backends for the simulated WebRTC/Nearby/BLE transports (harvested stream B; no crypto change)

**Mandate compliance:** identity, handshake, SAS, frame envelope, mailbox, sealed shares, inbound policy are untouched. `nearby-transport.ts:14-17` states the Noise handshake "works identically across LAN and nearby (transport-agnostic)"; the same holds for WebRTC. Only the byte-moving backend is implemented.

Today the three transports are interface + simulation only:

| Transport | Interface (real) | Backends that exist | Real path today |
|---|---|---|---|
| WebRTC DataChannel | `WebRTCBackend` (`webrtc-transport.ts:92-103`), real connection-state surface `onConnectionStateChange` (`:74`) | `SimulatedWebRTCBackend` only; `p2p.ts:79-80` defaults to it | NONE (in-memory) |
| Nearby (Multipeer / Wi-Fi Direct) | `NearbyPeerBackend` (`nearby-transport.ts:41-51`) | `SimulatedNearbyBackend` only (`:63`, no-op advertise/browse) | NONE (in-memory) |
| BLE wake | `BleBackend` (`ble-transport.ts:42-49`), wake-only GATT notify (`:18-26`) | `SimulatedBleBackend` only (`:61`) | NONE (in-memory) |

Implement injectable real backends (do NOT change the transport classes' logic, only provide a real `*Backend`):

- **WebRTC (mobile only):** a `react-native-webrtc`-backed `WebRTCBackend` on mobile, fulfilling the existing `WebRTCPeerSession` (incl. `createDataChannel`, `createOffer/createAnswer`, `onIceCandidate`, `onConnectionStateChange`). **The web client ships no WebRTC data backend — it stays relay-only for v1** (browsers have no raw P2P sockets; an unwired web backend would be dead code, so it is deliberately not specified). **Honesty invariant (load-bearing):** a connection is reported `connected` ONLY from the real `onConnectionStateChange === 'connected'` (ICE) signal, never a timer or optimistic flag. Signaling rides the existing relay/rendezvous (reuse `relay-transport.ts` / `rendezvous-client.ts`). ICE/STUN/TURN config is part of the shared WebRTC native layer this plan owns (below).
- **Nearby:** a MultipeerConnectivity-backed `NearbyPeerBackend` on iOS and a Wi-Fi Direct / Wi-Fi Aware one on Android; `onPeerFound` / `onIncomingSession` only fire from real OS callbacks.
- **BLE:** a CoreBluetooth / `android.bluetooth` `BleBackend` that ONLY advertises/scans the wake-up GATT notify payload `{deviceId, pendingModules[], totalBytes}` and escalates to a higher-bandwidth layer; it never carries file bytes.

**Shared WebRTC native layer — owned by THIS plan (cross-plan boundary).** The `react-native-webrtc` dependency in `apps/meerkat/package.json`, its Expo config plugin declared inside `apps/meerkat/app.config.ts` (the file Phase 0 converts `app.json` into so the plugin and `extra.defaultRelayUrl` env-read live in one typed config), the dev/EAS-build requirement (this native module is NOT Expo-Go-testable), and the ICE/STUN/TURN configuration are ALL net-new and **OWNED BY THIS PLAN** (Phase 11). This is the **same shared WebRTC native layer that Plan 25 (calls) consumes for live media** — Plan 25 does NOT re-add the dependency, the config plugin, or the ICE/TURN config; it references Plan 20 as the owner and extends the already-wired `WebRTCPeerSession` with media tracks. Conversely, the **SFU/media server is Plan 25's own deliverable** (its deploy/ops/scale/cost), co-located on the Plan 20 relay fleet but **not co-owned by Plan 20**; Plan 20 provides only the relay signaling carrier (`env` token-group forward), TURN, and the `effectiveRelayUrl` resolver. Landing this native layer first (here) is a HARD prerequisite for Plan 25, so the module is wired exactly once and never double-wired. **Web is out of scope for stream-B WebRTC data:** the web client stays relay-only for v1.

**Availability probing (honest):** each backend is lazy-loaded behind a capability check (mirrors `data/lan-backend.ts`: returns null when the native module is absent), and a layer is only offered to the ranked selector when its backend is present AND the path probes live. An absent or simulated backend yields `unavailable`, never a fake-available layer. The existing deterministic selector `buildTransportLayerDialOrder(preferredLayerIds, fallbackToDefaultLadder)` (`transport-manager.ts:64-89`) does the intersect + ladder-fallthrough; this plan only feeds it real availability and real backends. BLE stays excluded from `DATA_TRANSPORT_LAYER_IDS` (`:62`).

### 5. `@mylife/sync` — durable share-intake model (harvested stream A; not crypto)

A pure, IO-light share-intake helper set (parse/normalize/stage/route) that backs the `mk_share_*` tables and reuses the existing content-addressed blob store. No new envelope, no new key, no new wire protocol: routing an item is just calling the existing channel-message / DM / file-request send path with the staged blob. The model normalizes MIME/UTI, sniffs type (never trusts the sender-declared MIME), enforces a size guard, supports multi-item, and survives app restart (rows are durable, bytes are content-addressed). The iOS App Group handoff and Android background copy are platform glue in the apps; the model itself is platform-agnostic and unit-testable.

---

## Functional Requirements

### User stories

1. As a brand-new user, I open Meerkat and can pair with a friend by code and run a sync **without setting up any server**, because a free, zero-knowledge default connection server is already reachable.
2. As a privacy-minded user, I can turn the free default off and use only my own/community server, and the app respects that.
3. As a community organizer who has never used a terminal, I can download the Meerkat Host app, click "Start my community server," and get a shareable `wss://` link + QR my members paste in — and it actually works over the internet.
4. As a member, I can scan or paste a host's connection card and immediately use their server.
5. As any user, the app **never tells me I'm connected when I am not**: connection status comes from a real health probe and real recorded sessions, never a fabricated dot or peer count.
6. As a user reading a link, watching a video, or holding a file in another app, I can tap the OS Share Sheet, pick **Meerkat**, and have it land in a **Share Inbox** without losing the content — even if the share extension closes immediately.
7. From the Share Inbox I can **route** a shared item into a **community channel**, a **direct message**, or **files**, after a clear preview + permission step, and nothing leaves my device until I choose a destination and send.
8. On a desktop/web browser I can **drag-drop or pick a file** to do the same intake, and where my browser supports it Meerkat shows up as a **share target** — and where it does not, that option is simply absent, never a fake button.
9. When I'm near a friend or on the same network, Meerkat can move a real file over a **direct transport** (WebRTC DataChannel or nearby Wi-Fi) beyond just the relay — and it only shows a transport as "connected" when the real connection actually opened.

### Behavior specification

#### A. Out-of-box default connectivity (client)

1. On app start, the client computes the effective relay via `resolveDefaultRelay()`: user URL → else default (if set + not opted out) → else none.
2. If a default URL exists, the client kicks a real `/healthz` probe (debounced, via `probeRelays`), writes the result to `mk_relay_probe`, and updates a "Connection" status card.
3. Friend-code publish/resolve, manual sessions, mailbox drain, and file re-requests dial the effective URL via the centralized `effectiveRelayUrl(db)` (which replaces the 21 raw `getSetting(...) || DEFAULT_RELAY_URL` reads), so the health gate and per-device opt-out govern every networked action — not just the status card.
4. **Mobile only:** same-Wi-Fi LAN remains the no-server path (`lan-backend.ts`); the Connection card shows LAN as a separate, real rung when available (dev build).

#### B. Adopt a self-hosted server (client)

1. User taps "Use a community server" → chooses "Paste link" or "Scan QR."
2. The connection card is parsed/validated; on success the app sets `relay_url` (and optional community node URL) and probes it.
3. Status card flips to "Your community's server" with the real reachability from the probe.

#### C. One-tap self-hosting (desktop companion)

1. User opens Meerkat Host. First-run wizard: "What do you want to run?" → **Community server (recommended)** = relay + community node + seeder; or **Just a connection server** = relay only.
2. "How should people reach it?" → **Easiest (secure tunnel)** (default), **Same Wi-Fi only**, or **My own domain (advanced)**.
3. User clicks **Start**. The companion: spawns the real bins as child processes with the chosen security preset env; for tunnel mode, starts the tunnel and obtains a public `wss://`; confirms external reachability via an **off-host vantage** (a third-party echo/reachability service or the tunnel provider's status API), never a self-fetch of its own public URL (NAT hairpin / tunnel-edge-local-answer would false-positive).
4. On confirmed reachability, it shows the connection card (copyable + QR) and a real status panel (uptime, current connections from `/healthz`, exposure type).
5. Honest lifecycle copy: the server is reachable **only while this app is running and this computer is awake.**

### Edge cases

- **Default relay unconfigured at build** (`DEFAULT_RELAY_URL=''`): identical to today — every networked guard short-circuits; status shows "No connection server set." No regression, no fake.
- **Default relay deployed but momentarily down** (`/healthz` fails): status shows "Free connection server unreachable right now — pair on the same Wi-Fi or set your own server," never "connected."
- **User opted out of default** but set no URL: treated as none; honest empty state.
- **`ws://` default on an `https://` web origin:** browsers block mixed content; the web client rejects a non-`wss://` default at resolution and shows the insecure-URL notice (`RelayBar.tsx:82-86` pattern). Mobile may use `ws://` for LAN/testing.
- **Connection card with non-`ws(s)` scheme / malformed / huge:** Zod-rejected with "That doesn't look like a Meerkat connection card."
- **Probe race / app backgrounded mid-probe:** probe is abortable; a stale probe never overwrites a newer result (compare `probed_at`).
- **Self-host: port already in use:** companion picks the next free port and reflects the real bound port (mirrors `sync.tsx` LAN `:{port}` honesty).
- **Self-host: tunnel fails / no internet:** companion falls back to LAN exposure and says so; never shows a public URL it could not verify.
- **Self-host: laptop sleeps / app quits:** status flips to "Offline — your community can't reach this server until you reopen the app." Members' clients show the server unreachable via their own probe (not a fabricated state).
- **Self-host community node with no `DATA_DIR` write permission:** fail-closed with a plain-language fix ("Pick a folder Meerkat Host can write to").
- **Free-tier caps hit under load:** relay returns the existing `429`/`err` frames; client surfaces "The free connection server is busy — try again or use your own server." No silent drop.
- **`X-Forwarded-For` spoofing when a host runs the relay directly (no edge):** the "Same Wi-Fi only" and direct presets disable XFF trust; documented and defaulted safe.

---

## UI Specification (mobile + web parity)

All screens use Open Burrow tokens. Mobile: `MK_PALETTES.{light,dark}` via `useAppThemeColors()`/`useMkStyles` (`apps/meerkat/.../theme/tokens.ts`); web: the same palette as CSS variables. Honest copy is load-bearing and quoted exactly below.

### Screen 0 — Stale "no free default" copy rewrite (REQUIRED; both surfaces)

Shipping a free default relay makes today's live copy false. Every one of these sites currently asserts there is no free default / that first-party capacity is paid; each must be rewritten to distinguish the **free, zero-knowledge default connection server (a meeting point)** from the **paid `$4.99/mo` hosted tier (capacity / backup / public reach / always-on history)**. The rewrite is part of this plan's scope (Phase 3.6), not deferred:

| Site | Current (now-false) copy | Required new framing |
|---|---|---|
| `apps/meerkat-web/src/ui/sync/RelayBar.tsx:30-31` | "First-party hosted connection capacity is paid. There is no default." | "Meerkat ships a free, zero-knowledge default connection server. The paid tier ($4.99/mo) adds capacity, backup, public reach, and always-on history." |
| `apps/meerkat-web/src/ui/sync/SyncDialog.tsx:240` | "First-party hosted connection capacity is paid; your own server or a community server keeps private local use available." | Same free-default-vs-paid-capacity distinction. |
| `apps/meerkat/app/(root)/sync.tsx:397` (HonestNotice) | "First-party hosted connection capacity is paid; ..." | Same. |
| `apps/meerkat/app/(root)/(tabs)/settings.tsx:333` (HonestNotice, x2 with `:319`) | `:333` "First-party hosted connection capacity is paid; ..."; `:319` lists "hosted connection capacity ... are paid services" | `:333` same distinction; `:319` reword so "hosted connection capacity" reads as the **paid capacity/backup** tier, not "all connection is paid" (a free default now exists). |
| mobile `apps/meerkat/app/(root)/data/hosted-boundaries.ts` `hosted_relay` details | "paid service / URL required" framing | Keep the **paid** tier honest, but stop implying there is no free default. |
| web `apps/meerkat-web/src/lib/hosted-boundaries.ts:50,68` `hosted_relay` details | "The first-party hosted connection server is a paid service..." | Same; preserve byte-identical copy with mobile (AC-7) modulo the documented device↔browser swap. |

Honesty constraint: the free default is the **meeting point only**; backup, public reach, and always-on history remain the paid tier. Do NOT blur them — just stop claiming the free default does not exist.

### Screen 1 — "Connection" status card (NEW; client, both surfaces)

Placement: top of **mobile** `/sync` Engine area (`apps/meerkat/app/(root)/sync.tsx:200`) and inside the **web** Sync dialog Connection-server section (`apps/meerkat-web/src/ui/sync/SyncDialog.tsx:126`) and Settings → Connection server (`RelaySection.tsx`). Replaces nothing; augments the existing real status.

States (all 5):

| State | What user sees (verbatim proposed copy) |
|---|---|
| **Loading** (probe in flight, no cached result) | Title "Connection". Body: **"Checking the connection server…"** with a spinner. No status pill. |
| **Empty** (no default built in, no user URL) | Pill **"No connection server"**. Body: **"Pair on the same Wi-Fi, set a server below, or use a community server. Friend codes and offline delivery need a connection server."** |
| **Error** (default or user URL probed and `/healthz` failed) | Pill **"Unreachable"** (warning). Body: **"This connection server didn't answer just now. Try again, pair on the same Wi-Fi, or set a different server. Nothing is connected."** Button **"Check again"**. |
| **Success — free default reachable** | Pill **"Free server reachable"** (success). Body: **"You're using Meerkat's free, zero-knowledge connection server. It only ever sees scrambled bytes, never your messages or who you talk to. It is the meeting point, not delivery: a sync still needs the other device online."** Link **"Use my own server instead"**. |
| **Success — your/community server reachable** | Pill **"Your server reachable"** (success). Body shows the host name only. **"Meerkat will use this connection server. It carries encrypted data only."** |
| **Partial** (default reachable but user is mid-adopting a server, or LAN up + relay down on mobile) | Pill **"Local Wi-Fi only"** (info, mobile) or **"Switching servers…"**. Body: **"Same-Wi-Fi pairing works now. Internet sync is waiting on a reachable connection server."** |

Honesty guard: the pill text derives **only** from `mk_relay_probe` + real engine/session rows. It never says "connected to {friend}" and never shows a peer/online count (the web `StatusPill` "DO NOT SHOW" rule stays, `apps/meerkat-web/src/ui/shell/StatusPill.tsx:7`).

### Screen 2 — "Use a community server" (connection card adopt; NEW; both surfaces)

Placement: mobile in `sync.tsx` Manual-session panel near the URL field (`sync.tsx:358`); web in `RelayBar` as a third mode next to "I have a server URL" / "Deploy my own" (`RelayBar.tsx:36-49`).

- Two actions: **"Paste link"** (textarea, placeholder **"Paste a Meerkat connection card or wss:// URL"**) and **"Scan QR"** (mobile: camera; web: file/upload or webcam where available; if unavailable, hide the button — never fake it).
- States: Loading ("Reading the card…"); Empty (default mode hidden until opened); Error (**"That doesn't look like a Meerkat connection card. Ask the host to resend it."**); Success (**"Server added: {name}. Meerkat will try it for manual sessions. Compare safety codes with people, not servers."**); Partial (card parsed but probe pending: **"Server added. Checking if it's reachable…"**).
- HonestNotice (verbatim): **"A connection server can see when you connect and roughly how much data moves, never your messages, your contacts, or which community you're in. Adding a server is not the same as trusting a person: you still compare safety codes out of band."**

### Screen 3 — "Host your own" entry (NEW; both surfaces)

Placement: mobile Settings "Hosted services" / "Connection options" area (`apps/meerkat/app/(root)/(tabs)/settings.tsx:314-334`); web Settings → Connection options (`TransportSection.tsx`).

- Row: **"Host your own server"** → detail **"Run a free, zero-knowledge connection server (and a community) from your own computer. Phones and browsers can't host; you run it on a desktop or laptop."** Button **"Get Meerkat Host"** → opens the download page + `docs/guides/deploy-a-meerkat-relay.md`.
- States: this is a static informational row (Success state only), but the button's target link is real (download page or guide). If no download URL is configured for the build, the button reads **"Open the deploy guide"** and links the guide — never a dead "Download" that 404s.

### Screen 4 — Meerkat Host desktop companion (NEW surface; `packages/meerkat-relay/host/`)

A local control panel (served at `http://127.0.0.1:8799`, opened in the user's browser or a thin webview wrapper). Open Burrow tokens reused via `@mylife/ui` where possible.

**4a. Welcome / setup wizard**
- Step 1 "What do you want to run?": cards **"Community server (recommended)"** ("A connection server + always-on community feed + file serving. Best for running a group.") and **"Just a connection server"** ("The meeting point only. Lightest option.").
- Step 2 "How should people reach it?": **"Easiest — secure tunnel"** (default; "We open a secure tunnel and give you a public wss:// link. No router setup."), **"Same Wi-Fi only"** ("Only people on your network can reach it. No internet, no setup."), **"My own domain (advanced)"** ("Point a domain here and we get a certificate with Caddy.").
- Step 3 "Security": preset toggle **"Private (recommended)"** ("Tighter rate limits, sized for one community.") vs **"Open"** ("Higher limits if you expect many people."). Plain-language, maps to clamped env caps.

**4b. Running dashboard** — states:

| State | What host sees |
|---|---|
| **Loading** (starting) | **"Starting your server…"** with per-service lines ("Connection server… Community feed… File serving…") flipping to checks as each child process binds and `/healthz` answers. Real, per-process. |
| **Empty** (first run, nothing started) | Big **"Start my community server"** button + the wizard summary. |
| **Error** (a child failed / port in use / tunnel failed / no write perms) | Plain-language cause + one-click fix: **"Couldn't open a public link. Switched to Same-Wi-Fi for now."** / **"That folder isn't writable. Choose another for your community's data."** Never shows a public URL it didn't verify. |
| **Success** (verified reachable) | Status panel: **"Your server is live."** + the **real** external-reachability result ("Verified reachable from the internet" only after a real round-trip from an **off-host vantage** — a third-party echo/reachability service or the tunnel provider's status API — never a self-fetch, which NAT hairpin / tunnel-edge-local-answer would false-positive). Connection card (copyable + QR). Live counts: **"{n} connections right now"** (from `/healthz`), **uptime**, exposure type. Buttons: "Copy link", "Show QR", "Stop". |
| **Partial** (relay up, community node still indexing / tunnel still negotiating) | **"Connection server is live. Community feed is getting ready…"** — each line reflects the real per-process state; no aggregate "live" until the started services actually answer. |

**Honest lifecycle banner (always visible, verbatim):** **"This server runs on this computer. People can reach it only while Meerkat Host is open and this computer is awake. Close it or sleep the computer and your community can't connect until you reopen it. Meerkat Host never sees your community's messages — it only forwards scrambled data."**

### Screen 5 — Share Inbox (NEW; client, both surfaces — harvested stream A)

Placement: a NEW route, **distinct from the existing seal/pin `(tabs)/share.tsx`** — mobile `apps/meerkat/app/(root)/share-inbox/`, reachable from a deep link the iOS extension / Android intent opens and from a Settings/inbox entry; web a new `apps/meerkat-web/src/ui/inbox` opened by the file-picker, drag-drop, or a Web Share Target service-worker handoff. Each staged item is one card with a real preview (text snippet, link host, image/video thumbnail from the staged blob, file name + size). Open Burrow tokens.

States (all 5):

| State | What user sees (verbatim proposed copy) |
|---|---|
| **Loading** (extension/intent staging in flight) | **"Bringing in what you shared…"** with a spinner. No destination buttons yet. |
| **Empty** (inbox open, nothing staged) | **"Nothing shared yet. Use another app's Share button and pick Meerkat, or drop a file here."** |
| **Error** (unsupported type / too large / staging failed) | **"Couldn't bring that in: {plain reason}. Nothing was sent."** The item is retained for retry or discard, never silently dropped. |
| **Success** (one or more items staged) | Each card shows the preview + **"Send to…"** with three destinations: **"A community channel"**, **"A direct message"** (hidden until plan 21 ships — never a dead button), **"Files"**. A permission/preview line: **"This stays on your device until you choose where to send it."** |
| **Partial** (multi-item share, some staged, some still copying) | Per-item state; the aggregate never reads "ready" until every item has a real staged blob or inline value. |

Routing copy (verbatim, on confirm): **"Sending {n} item(s) to {destination}. They'll be encrypted before they leave this device."** Honesty guard: the card shows **"Sent"** / **"Delivered"** ONLY from a real `cm_messages` / DM / file-request row (NC-10), never from the `mk_share_intake.status` alone.

HonestNotice (verbatim): **"Sharing into Meerkat copies the item onto this device. It is not posted or sent anywhere until you pick a channel, a person, or Files. Meerkat never reads it in a cloud — it's encrypted on your device."**

### Screen 6 — Transports panel (NEW; client mobile, harvested stream B)

Placement: mobile Settings → Connection options, beneath the relay/LAN status, as an honest list of **real** transport availability. **This panel is mobile-only.** The web client stays relay-only for v1 (browsers have no raw P2P sockets, so no web WebRTC/Nearby/BLE data backend is wired and there is no web Transports panel) — an honest platform scoping, not a hidden deferral.

- Each rung is listed with its **real** availability from the capability probe: **Relay** (live), **Same Wi-Fi (LAN)** (dev build), **Direct internet (WebRTC)**, **Nearby (no internet)**, **Bluetooth wake** (wake-only). A rung whose native backend is absent reads **"Not available on this build"** — never "available" when only the simulated backend exists.
- Honest copy under WebRTC/Nearby: **"Used to move files directly device-to-device when a connection actually opens. Meerkat shows 'connected' only from the real connection, never a guess."** Under Bluetooth: **"Wake-up only. It nudges a nearby device to sync over Wi-Fi; it never carries your files."**
- States: Loading (probing), Success (per-rung availability), Empty (only Relay available), Error (a probe failed → that rung reads unavailable, no fake).

---

## Acceptance Criteria

### User-facing (AC)

- **AC-1:** On a build with a deployed default relay configured, a fresh install (no user URL) can publish a friend code, resolve a friend's code, and complete a manual relay session **without the user entering any URL**.
- **AC-2:** On a build with `DEFAULT_RELAY_URL=''` (unconfigured), behavior is identical to today: networked actions are gated and the Connection card shows the honest "No connection server" empty state. No fabricated status anywhere.
- **AC-3:** When the configured default relay's `/healthz` fails, the Connection card shows **"Unreachable"** with the exact error copy and a working "Check again" button; it never shows a success pill.
- **AC-4:** A user can turn off the free default (Settings, both surfaces) and the app stops using it — the value `effectiveRelayUrl(db)` returns becomes `''`, so no networked action dials it; with no user URL set, status returns to the honest empty state. (Satisfiable only because every dial routes through `effectiveRelayUrl(db)`, not a raw `|| DEFAULT_RELAY_URL`.)
- **AC-5:** Pasting a valid connection card (or `wss://` URL) sets the server and the status reflects the real probe result; an invalid card shows the exact rejection copy.
- **AC-6 (mobile):** "Scan QR" reads a host's connection-card QR and adopts the server; on a device without camera permission it shows recovery guidance, never a fake success.
- **AC-7 (parity):** AC-1 through AC-5 hold on **both** `apps/meerkat` and `apps/meerkat-web` with byte-identical honest copy (allowing the documented "device"↔"browser" swap, `hosted-boundaries.ts`).
- **AC-8 (host):** A non-technical user can, in ≤5 steps and with no terminal, start a relay + community node and obtain a `wss://` connection card that a second device (on a different network) actually connects through — verified by a real session row on the member device.
- **AC-9 (host honesty):** The host dashboard shows "Verified reachable from the internet" only after a real round-trip from an **off-host vantage** (a third-party echo/reachability service or the tunnel provider's own status API), never a self-issued fetch to its own public URL. A self-probe is rejected because NAT hairpinning or the tunnel edge answering locally would false-positive "reachable" without a true external path. Before verification it shows "Checking…"; if the off-host round-trip fails it shows the LAN-fallback state.
- **AC-10 (host lifecycle):** Stopping Meerkat Host (or sleeping the computer) flips the host status to offline and members' clients reflect unreachable via their own probe — no client shows the stopped server as reachable.
- **AC-11 (share-in, iOS):** From another app's iOS Share Sheet, the user can pick Meerkat and share text, url, image, audio, video, pdf, an arbitrary file, and a multi-item selection; the item stages into the App Group and appears in the Share Inbox **after the extension exits and even after an app kill** — no data loss.
- **AC-12 (share-in, Android):** `ACTION_SEND` and `ACTION_SEND_MULTIPLE` for the configured MIME types produce the same `mk_share_intake` model; content URIs are copied into app storage off the main thread.
- **AC-13 (route):** From the Share Inbox the user can route a staged item into a **community channel**, a **DM** (when plan 21 is present), or **files**, after a preview + permission step; the item leaves the device only on that explicit send, and the card shows "Sent/Delivered" only from a real engine/sync row.
- **AC-14 (web parity):** Web file-picker + drag-drop intake produces the same `mk_share_intake` model and routes identically with byte-identical honest copy; the PWA **Web Share Target** works where the browser supports it and is **absent (not faked)** where it does not.
- **AC-15 (real transports, mobile):** With a real native backend present and the path live, a **WebRTC DataChannel** or **Nearby** transport moves real file bytes between two **mobile** devices **beyond relay + LAN**; the transport is chosen by the deterministic ranked selector and the chosen layer + attempts are recorded. **Stream-B real data transports are mobile-only for v1; the web client stays relay-only** (no web WebRTC data backend is shipped, so there is no web transport-parity requirement here).
- **AC-16 (transport honesty):** A transport reads **"connected"** ONLY from the real backend connection/ICE state (WebRTC `onConnectionStateChange`), never a timer; a rung is offered ONLY when its native backend is actually available; BLE never moves file bytes (wake-only).

### Technical (TC)

- **TC-1:** `resolveDefaultRelay()` returns `source:'user'` whenever `relay_url` is non-empty, regardless of default; returns `source:'default'` only when no user URL, default non-empty, and `!optedOut`; else `source:'none'`.
- **TC-2:** `resolveDefaultRelay()` reports `reachable:true` only after a probe whose result came from the real `/healthz` `{ok:true}` path (`relay-selector.ts`); a network error yields `reachable:false`; pre-probe yields `'unknown'`.
- **TC-3:** `mk_relay_probe` rows older than `PROBE_TTL` are ignored for display (treated as `'unknown'`), forcing a re-probe; a newer probe never loses to an older one.
- **TC-4:** `resolveRelayLimits(env)` overrides each cap from env and **clamps** out-of-range values to `[min,max]`; unset env yields exactly today's `RELAY_LIMITS`.
- **TC-5:** The slim relay bin started with `RELAY_ENV_RATE` set enforces the overridden (clamped) rate; `/healthz` still returns only `{ ok, connections }` (no new field).
- **TC-6:** The web client refuses a non-`wss://` default on an `https` origin and surfaces the insecure-URL notice; mobile accepts `ws://` for LAN.
- **TC-7:** Connection-card parse accepts `{v:1,relay:'wss://…'}` and a bare `wss://` URL; rejects non-`ws(s)` schemes, missing `relay`, and oversized input, via Zod.
- **TC-8 (host):** The companion spawns the real `bin/meerkat-relay-server.mjs` (and `bin/meerkat-community-node.mjs` / `bin/meerkat-node.mjs` when selected) as child processes with the preset env, captures their real bound ports, and reports per-process liveness from each `/healthz`.
- **TC-9 (host):** The "Private" preset sets the clamped tighter caps; the community node `DATA_DIR` is the configured writable path; the relay is never started with a paid `hostedEntitlement.required:true` unless the user explicitly enables a paid gate (default open, `server.ts:35`).
- **TC-10 (host):** External-reachability is determined by a round-trip from an **off-host vantage** (third-party echo/reachability service or tunnel-provider status API), NOT a self-issued fetch (which NAT hairpin / tunnel-edge-local-answer would false-positive); a failure or an unavailable vantage never yields a "reachable" status (it falls back to "Checking…"/LAN).
- **TC-11:** No code path logs envelope contents, tokens, rendezvous records, message bodies, or relay URLs at info level; relay/community-node logs stay counts/paths only (preserve `bin/*` and `server.ts` log discipline).
- **TC-12:** The share-intake model parses text/url/file payloads, normalizes MIME/UTI, sniffs type (does not trust sender MIME), enforces the size guard, supports multi-item, and round-trips through `mk_share_intake` + `mk_share_payload` + the existing blob store; staged rows survive an app restart and are device-local (outside `MEERKAT_SYNC_PREFIXES`).
- **TC-13:** The iOS Share Extension config plugin declares App Group `group.com.mylife.meerkat` + activation rules for the configured content classes; the containing app reads the App Group container after the extension exits (Manhattan-precedent shape, `apps/manhattan/app.json:76-87`).
- **TC-14:** Android `ACTION_SEND` / `ACTION_SEND_MULTIPLE` intent filters are declared for the configured MIME types; multi-stream `EXTRA_STREAM` is handled.
- **TC-15:** Routing writes to the correct destination substrate — channel (`cm_messages` + blob), DM (plan-21 messages), or files (`community-files`/blob store) — by calling the existing send path; the `mk_share_*` staging rows never replicate.
- **TC-16:** The ranked-transport selector `buildTransportLayerDialOrder` intersects preferred + default ladder deterministically, excludes BLE from `DATA_TRANSPORT_LAYER_IDS`, and falls through to the next eligible layer on failure; the availability probe gates each layer so an absent/simulated backend is never dialed.
- **TC-17:** The real WebRTC backend reports `connected` only from `onConnectionStateChange`/ICE; an absent or simulated backend resolves `unavailable`, never a fake `connected`.
- **TC-18:** The BLE backend is wake-only (GATT notify `{deviceId, pendingModules[], totalBytes}`), escalates to a higher-bandwidth layer, and transfers no file bytes.

### Negative (NC)

- **NC-1:** The app MUST NOT display "connected", an online dot, a peer count, or a delivery/receipt claim derived from anything other than a real `/healthz` probe or a recorded `sync_*` row.
- **NC-2:** A configured-but-down default relay MUST NOT degrade to a success state or silently swallow the failure.
- **NC-3:** Relay config (`relay_url`, probe cache, adopted-server alias) MUST NOT be added to `MEERKAT_SYNC_PREFIXES` / any sync policy; it must never replicate to a peer.
- **NC-4:** The free default relay MUST NOT require a paid entitlement (it ships with the gate OFF); conversely, enabling the paid gate (Monetization plan) MUST remain a separate opt-in that fails closed.
- **NC-5:** `/healthz` MUST NOT gain any field beyond `{ ok, connections }` (zero-knowledge guarantee, `server.ts:127`; relay `CLAUDE.md` "never add a field").
- **NC-6 (host):** Meerkat Host MUST NOT hold or request any decryption key, MUST NOT decrypt, and MUST NOT show a public URL it has not verified reachable.
- **NC-7:** Caps override MUST NOT allow a value outside the clamp range (no amplifier configuration, no self-DoS).
- **NC-8:** Mobile MUST NOT attempt to bind a server socket; the app is **resolve-only** on mobile (no inbound HTTP server) and "host your own" always points to the desktop companion. (`node/host-registry.ts:120-122` is the `announceHeldContent` http-URL guard — it requires a host URL but does not itself prove a phone cannot bind; the real basis is that no app code starts a listening server on mobile.)
- **NC-9:** The share-intake/staging tables (`mk_share_intake`, `mk_share_payload`) MUST be device-local (`mk_` prefix, never in `MEERKAT_SYNC_PREFIXES`); a staged item MUST NOT auto-replicate and leaves the device only on an explicit user route + send.
- **NC-10:** The Share Inbox MUST NOT show "Sent" / "Delivered" / a receipt for a routed item except from a real engine/sync row; the `mk_share_intake.status` value alone MUST NOT drive a delivery claim.
- **NC-11:** A transport layer MUST NOT be presented or dialed unless its real native backend is available and the path probes live; WebRTC "connected" MUST come from the real ICE/connection-state signal, never a timer or optimistic flag; a build with only the simulated backend MUST show the rung as unavailable.
- **NC-12:** BLE MUST remain wake-only (no file/media bytes); and the new transport/share-intake backends MUST NOT reimplement crypto — the Noise handshake, SAS, frame envelope, and sealed shares stay in `@mylife/sync` and are reused unchanged.

---

## Test Plan (TDD; tests written first per phase)

Verification tiers: **A** = pure unit (Node, no IO). **B** = in-process integration (real DB / real `startRelayServer` in-process). **C** = automated e2e over a real booted relay (extend `packages/meerkat-relay/__tests__` multi-node harness, `support/multi-node-harness.ts`). **D** = manual / ops (device QA + a real deploy soak), tracked in `apps/meerkat/Tickets/`.

### Unit (Tier A)

- `default-relay.test.ts`: `resolveDefaultRelay` source precedence (TC-1), reachability gating (TC-2), opt-out, sync display path; probe TTL logic (TC-3).
- `relay-limits.test.ts` (`packages/meerkat-relay`): `resolveRelayLimits` override + clamp matrix (TC-4, NC-7); unset = defaults.
- `connection-card.test.ts`: Zod accept/reject matrix (TC-7); non-`wss` on https rejection helper (TC-6).
- Host: `host-config.test.ts` (config load/validate/preset→env mapping), `tunnel-url.test.ts` (parse/validate tunnel public URL), `reachability.test.ts` (external probe gating, TC-10).
- `share-intake.test.ts` (`@mylife/sync`): parse/normalize text/url/file, MIME/UTI normalization + type sniff, size guard, multi-item, status transitions (TC-12); device-local invariant (model never emits a sync row).
- `transport-selector.test.ts` (`@mylife/sync`): `buildTransportLayerDialOrder` intersect + ladder fallthrough determinism, BLE excluded from data layers, availability gating (TC-16); `webrtc-state.test.ts`: connected only from `onConnectionStateChange` (TC-17, NC-11); `ble-wake.test.ts`: wake-only, no data bytes (TC-18, NC-12).

### Integration (Tier B)

- `relay-limits-server.test.ts`: boot `startRelayServer` with env caps in-process, assert overridden rate enforced and `/healthz` shape unchanged (TC-5, NC-5). Also assert the `src/server.ts:136,194` module-level reads now consume the resolved limits (the two genuinely un-wired sites), not the frozen constant.
- `mk_relay_probe` round-trip in each app's DB (write probe → resolveSync reads it; stale ignored).
- **`effective-relay-url.test.ts` (opt-out gate, ties to AC-4):** with `default_relay_optout='1'` set and no user `relay_url`, assert `effectiveRelayUrl(db)` returns `''` (the app dials nothing); with optout cleared and a `reachable:true` cached probe, it returns the default URL; with a user URL set, it always returns that URL regardless of optout. This is the missing test proving opt-out changes the **actual dialed URL**, not just display.
- Host `process-supervisor.test.ts`: spawn the real slim relay bin as a child, read its bound port, confirm `/healthz`, kill, confirm offline (TC-8, AC-10). Community-node + seeder spawn with a temp `DATA_DIR` (TC-9). Note: relay `CLAUDE.md` gotcha — backgrounded tsx starves socket IO in sandboxes; run supervisor IO tests with explicit awaits, not detached shells.
- **`share-route.test.ts`** in each app's DB: stage an `mk_share_intake` + payload (text, url, file blob), route to a channel (`cm_messages` + attachment), a DM stub, and files; assert the staging rows never replicate and the destination row is the source of truth for "sent" (TC-15, NC-9, NC-10). Web: drag-drop / `<input type="file">` intake produces the identical model (AC-14).

### End-to-end (Tier C)

- Extend the multi-node harness: two independent nodes, **no URL set**, both resolve the same booted default relay via `resolveDefaultRelay`, then complete pairing + a manual session + an offline mailbox drain — proving out-of-box connectivity end to end (AC-1) on the app's real shipping path. **Prerequisite:** `resolveDefaultRelay` must be exported from `packages/sync/src/index.native.ts` (the harness imports only the native barrel per relay `CLAUDE.md`); the e2e cannot import it otherwise.
- Connection-card adoption e2e: node B adopts node A's host card (parsed) and syncs through it (AC-5, AC-8 protocol half).
- Down-relay e2e: point the default at a closed port, assert `reachable:false` and no session row is fabricated (NC-2).
- **Direct-transport e2e:** extend the multi-node harness so two engines complete a real file transfer over the **WebRTC DataChannel** backend (and, where a simulated-but-faithful Nearby backend stands in, the nearby layer) using the real ranked selector, proving the layer moves real bytes beyond relay/LAN (AC-15). A connection that never reaches `connected` state must NOT report a transfer (AC-16, NC-11). **Prerequisite:** the real-backend factories must be importable from `packages/sync/src/index.native.ts` (the harness imports only the native barrel).

### Manual / Ops (Tier D — remains manual)

- Deploy the first-party relay to Render (and/or Fly) from the existing artifacts; confirm `wss://.../healthz` over `https`; run a 24-48h warm soak (per `docs/designs/meerkat-relay-fleet-runbook.md`).
- **Deploy the first-party always-on community node + public directory** (Phase 1.5) from `bin/meerkat-community-node.mjs` + `deploy/*` with a persistent `DATA_DIR` volume; confirm it serves and stays up under our infra (not the desktop companion), so Public Social has the always-on hosted source its honesty gate requires.
- Run the GHCR publish workflow; `docker run` the published image on a clean host (`docs/guides/deploy-a-meerkat-relay.md:78-79`).
- Two physical devices on **different networks** pair + sync through the default relay (mobile + web), and through a laptop-hosted tunnel server (AC-8). Tracked in a new `apps/meerkat/Tickets/connectivity-qa.md`.
- Desktop companion: package + launch on macOS/Windows/Linux; verify code-signing/gatekeeper notes; verify tunnel reachability from a phone on cellular.
- **OS share-in device QA (requires a dev/TestFlight build — the Share Extension is not Expo-Go-testable):** share text from Notes, a URL from Safari, an image/video from Photos, audio from Voice Memos, a PDF/file from Files, and a multi-item selection into Meerkat on iOS; the Android equivalents via the system share sheet; confirm each lands in the Share Inbox after the extension exits and survives an app kill, then route one of each into a channel and into files (DM when plan 21 is present). Tracked in `apps/meerkat/Tickets/share-intake-qa.md`.
- **Web share-in QA:** drag-drop + file-picker intake in `apps/meerkat-web`; on a browser that supports the Web Share Target, share a file/text from another PWA/app and confirm Meerkat receives it; on an unsupported browser confirm the share-target option is simply absent (not a dead button).
- **Real-transport device QA:** two phones — same Wi-Fi and different networks — complete a real file transfer over the WebRTC DataChannel (and Nearby with internet disabled where the native module is present); confirm "connected" appears only when the real connection opens, and BLE only wakes a nearby device to escalate (never carries the file). Tracked in `apps/meerkat/Tickets/transport-qa.md`.

### gstack gates

- After every code change: `/function-gate-runner`, `/review` (SQL safety, scope drift, the honesty rule).
- After UI: `/browse` the Connection card + adopt-server + host dashboard, verifying all 5 states.
- Complexity ≤2: `/plan-eng-review` on this spec before building; `/office-hours` (builder) for the host-companion packaging approach (net-new surface).
- Engine: `/domain-engine-benchmarker` on `resolveDefaultRelay` + `resolveRelayLimits` (pure functions with clear contracts).
- Post-merge: `/parity-check` (mobile↔web copy), `/ship`, `/document-release` (update `docs/guides/deploy-a-meerkat-relay.md` + relay `CLAUDE.md`).

---

## Phased Build Plan (test-first within each phase)

**Phase 0 — Default-relay resolution + health-gate + centralization (engine, Tier A/B).**
0.1 Write `default-relay.test.ts` (red). 0.2 Implement `packages/sync/src/transport/default-relay.ts` (`resolveDefaultRelay`/`resolveDefaultRelaySync`) reusing `probeRelays` (`relay-selector.ts`), and **export both from BOTH `packages/sync/src/index.native.ts` AND `index.ts`** (native barrel is mandatory for the harness). 0.3 Add `mk_relay_probe` schema + helpers in both apps (mobile `data/db.ts`, web DB bootstrap); add `mk_settings` keys `default_relay_optout` + `adopted_server_url`. 0.4 Wire `DEFAULT_RELAY_URL` to read build env (web `import.meta.env.VITE_MEERKAT_DEFAULT_RELAY_URL` — **declare it in `apps/meerkat-web/src/vite-env.d.ts`, distinct from `VITE_MEERKAT_HOSTED_RELAY_URL`**; mobile `Constants.expoConfig.extra.defaultRelayUrl` — **convert `apps/meerkat/app.json` to `apps/meerkat/app.config.ts` first** so `extra.defaultRelayUrl` can read `process.env.MEERKAT_DEFAULT_RELAY_URL` at build), defaulting to `''`. Update `relay.ts:14` and `sync-core.ts:103` comments to describe health-gating (keep the empty-default-is-honest behavior).
0.5 **Centralize: implement `effectiveRelayUrl(db)` (in `@mylife/sync`, exported from both barrels) and replace ALL 21 read sites** — `SyncProvider.tsx:468,573,648,736,793,834,853,957`, `NodeProvider.tsx:297,317`, `background-sync.ts:139,235`, web `MeerkatProvider.tsx:721,885,1057,1185,1200,1562,1636,1760,1825` — swapping each `getSetting(...) || DEFAULT_RELAY_URL` for `effectiveRelayUrl(db)` so opt-out + health gate govern the real dial. Write `effective-relay-url.test.ts` (Tier B, opt-out → dialed `''`) first.

**Phase 1 — Deploy the first-party default relay + publish image (ops, Tier D).**
1.1 Deploy from `render.yaml` (flip `autoDeploy` per ops choice) and/or `packages/meerkat-relay/deploy/fly.toml`; obtain `wss://`. 1.2 Run `publish-relay-image.yml` (or push `relay-v*`); smoke the published image. 1.3 Set the build env for staging/prod (web `.env.production`; mobile `app.config.ts` `extra.defaultRelayUrl` via `process.env`). 1.4 Add the relay URL + image to the fleet runbook; set up `/healthz` monitoring + an alert.

**Phase 1.5 — Deploy the first-party always-on community node + public directory (ops, Tier D).**
1.5.1 Deploy `bin/meerkat-community-node.mjs` on our infra from `deploy/*` with a persistent `DATA_DIR` volume; obtain its `https://` base. 1.5.2 Deploy the plan-19 public-directory deployable pointed at this always-on node. 1.5.3 Confirm it stays up under our infra (a real always-on hosted source) so the Public Social honesty gate (`hosted-boundaries.ts` `public_feed`) can be un-hidden against it — NOT against the user's non-always-on desktop companion. 1.5.4 Add to the fleet runbook + monitoring. (This is the deliverable Plan 19 hard-depends on Plan 20 for.)

**Phase 2 — Env-configurable fair-use caps (relay, Tier A/B).**
2.1 Write `relay-limits.test.ts` + `relay-limits-server.test.ts` (red). 2.2 Add `resolveRelayLimits(env)` in `src/protocol.ts`; pass the resolved limits into `RelayHub` via the existing `limits` option (`hub.ts:51,84`) **and** wire the two un-wired module-level reads `src/server.ts:136` (`maxFrameBytes`) + `:194` (`maxConnections`); read env in `bin/meerkat-relay-server.mjs`. 2.3 Set the first-party free relay's env caps; document presets.

**Phase 3 — Client connectivity UX, mobile + web parity (Tier B + `/browse`).**
3.1 Connection status card in mobile `sync.tsx` + web `SyncDialog`/`RelaySection` (all 5 states). 3.2 "Use a community server" adopt flow (paste + QR) + `connection-card.test.ts`. 3.3 "Host your own" entry rows + real link targets. 3.4 Default-on/off toggle in Settings on **BOTH surfaces**: mobile `apps/meerkat/app/(root)/(tabs)/settings.tsx` and web `RelaySection.tsx`/`TransportSection.tsx` (writes `default_relay_optout`, which `effectiveRelayUrl(db)` reads). 3.5 `/parity-check` copy. 3.6 **Rewrite the stale "no free default / capacity is paid" copy** per Screen 0 across `RelayBar.tsx:30-31`, `SyncDialog.tsx:240`, mobile `sync.tsx:397`, mobile `(tabs)/settings.tsx:319` + `:333` (x2 HonestNotices), and `hosted-boundaries.ts` (mobile + web `:50,68`); keep mobile↔web byte-identical (AC-7).

**Phase 4 — Desktop host companion scaffold (Tier A/B).**
4.1 New `packages/meerkat-relay/host/` package: a Node control-panel server (serves a localhost UI) + a **process supervisor** that spawns the real `bin/*` as children (`process-supervisor.test.ts` first). 4.2 `host-config.json` load/validate/preset→env. 4.3 Per-process `/healthz` liveness panel (real). 4.4 Packaging target (double-clickable per OS; `node-sea`/`pkg` + a thin webview or default-browser open).

**Phase 5 — One-tap wizard + TLS/tunnel/NAT options + security presets (Tier B + Tier D).**
5.1 Wizard UI (services / exposure / security). 5.2 Tunnel integration (Cloudflare Tunnel `cloudflared` or equivalent) yielding a verified public `wss://`; LAN exposure via bind+mDNS; BYO-domain via the existing Caddy path (`packages/meerkat-relay/deploy/Caddyfile`). 5.3 **Off-host external-reachability probe** (`reachability.test.ts`): verify via a third-party echo/reachability service or the tunnel provider's status API, NOT a self-fetch of the host's own public URL (NAT hairpin / tunnel-edge-local-answer false-positives). 5.4 Security preset → clamped caps.

**Phase 6 — "Spin up a Discord" community node + connection card/QR (Tier B/C/D).**
6.1 Wire community node + seeder into the supervisor with a writable `DATA_DIR`; optional `NOTIFY_RELAY_URL` self-pointing. 6.2 Connection card generation (copyable + QR) shared with clients (close the loop with Phase 3 adopt). 6.3 Harness e2e: member adopts the host card and syncs (AC-8 protocol half). 6.4 Honest lifecycle copy + offline detection.

**Phase 7 — Connectivity/self-hosting honesty/parity/docs/ship.**
7.1 Full honesty sweep against NC-1..NC-8. 7.2 `/parity-check`, `/qa` both client surfaces. 7.3 Update `docs/guides/deploy-a-meerkat-relay.md` (add the one-tap Host path), relay `CLAUDE.md`, app `CLAUDE.md` transport-honesty section, `memory.md` + session log + `errors_log.md` if any gate failed. 7.4 `/ship` + `/document-release`. 7.5 Capture to Open Brain (context `"personal, mylife"`).

> **Harvested-stream phases (8-12).** Streams A (OS Share-into-Meerkat) and B (real data transports) are independent of the desktop host companion (Phases 4-6) — they touch the clients + `@mylife/sync`, not `packages/meerkat-relay/host/`. They can run in parallel with 4-6 after Phases 0-3 land (clients connect out of the box). Build order within: A is mostly app/engine + a config plugin; B is engine + native backends behind capability probes.

**Phase 8 — Durable share-intake model + content-addressed staging (engine/db, Tier A/B).**
8.1 Write `share-intake.test.ts` (red). 8.2 Implement the platform-agnostic intake model in `@mylife/sync` (parse/normalize/sniff/stage/route over the existing blob store) and **export the factory from BOTH `index.native.ts` and `index.ts`**. 8.3 Add `mk_share_intake` + `mk_share_payload` schema + helpers in both apps (mobile `data/db.ts`, web DB bootstrap), outside `MEERKAT_SYNC_PREFIXES`. 8.4 Add the cleanup/sweep job for expired staged rows + orphaned blobs.

**Phase 9 — iOS Share Extension + App Group + Android intent filters (native config, Tier A/D).**
9.1 Add the iOS Share Extension + App Group `group.com.mylife.meerkat` via the Expo config plugin **inside `apps/meerkat/app.config.ts`** (the file Phase 0 converts `app.json` into), reusing the Manhattan precedent (`expo-share-intent` shape: `iosActivationRules`, `iosAppGroupIdentifier`, `androidIntentFilters`). 9.2 Declare Android `ACTION_SEND` / `ACTION_SEND_MULTIPLE` filters for the configured MIME types. 9.3 App-Group container read-back on foreground + background URI copy on Android (`withDataProtection`-style data protection for the App Group, per Manhattan's plugin). 9.4 Device QA (dev/TestFlight build).

**Phase 10 — Share Inbox UI + routing + web parity (Tier B + `/browse`).**
10.1 New Share Inbox route (mobile `app/(root)/share-inbox/`, distinct from `(tabs)/share.tsx`; web `src/ui/inbox`) with all 5 states (Screen 5). 10.2 Route-to: community channel (`cm_messages` + blob), DM (plan-21 `messages.tsx`, hidden until present), files (`community-files`/blob). 10.3 Web file-picker + drag-drop intake (reuse `Composer.tsx` file→blob path) + **optional PWA Web Share Target** (net-new `manifest.webmanifest` `share_target` + service-worker handler; hidden where unsupported). 10.4 `share-route.test.ts` + `/parity-check` copy.

**Phase 11 — Real native data transports (WebRTC DataChannel / Nearby / BLE-wake) (Tier A/B/C/D).**
11.1 Write `transport-selector.test.ts` / `webrtc-state.test.ts` / `ble-wake.test.ts` (red). 11.2 **Add the shared WebRTC native layer THIS PLAN OWNS:** add `react-native-webrtc` to `apps/meerkat/package.json`, declare its Expo config plugin inside `apps/meerkat/app.config.ts` (the file Phase 0 converts `app.json` into), and add the ICE/STUN/TURN config; this requires a dev/EAS build (NOT Expo-Go-testable). **Plan 25 (calls media) consumes this SAME layer and must NOT re-add the dep/plugin/ICE config — it references Plan 20 as the owner.** 11.3 Implement the real `WebRTCBackend` (`react-native-webrtc`, **mobile only — web stays relay-only, no web WebRTC data backend**), `NearbyPeerBackend` (iOS Multipeer, Android Wi-Fi Direct/Aware), `BleBackend` (CoreBluetooth / `android.bluetooth`, wake-only), each injected through the EXISTING transport interfaces behind lazy capability probes (mirror `data/lan-backend.ts`). **Export the real-backend factories from `index.native.ts`** (harness prerequisite). 11.4 Honest availability feeding `buildTransportLayerDialOrder`; WebRTC `connected` only from `onConnectionStateChange`. 11.5 Transports panel UI (Screen 6, mobile-only). 11.6 Direct-transport harness e2e (AC-15) + device QA.

**Phase 12 — Share + transport honesty/parity/docs/ship.**
12.1 Honesty sweep against NC-9..NC-12 (device-local staging, no fake "sent", real-only transport availability, BLE wake-only, no crypto reimpl). 12.2 `/parity-check` + `/qa` both client surfaces for the Share Inbox + Transports panel. 12.3 Update `apps/meerkat/CLAUDE.md` transport-honesty section (add OS share-in + the now-real WebRTC/Nearby/BLE rungs), `apps/meerkat-web` notes, `memory.md` + session log + `errors_log.md` if any gate failed. 12.4 `/ship` + `/document-release`. 12.5 Capture to Open Brain (context `"personal, mylife"`).

---

## Edge Cases (consolidated)

Covered above in Behavior/Edge cases; the load-bearing ones: unconfigured default = today's honest behavior; down default = explicit unreachable, never success; `ws://` default blocked on web https; malformed connection card rejected; probe races never regress status; host port-in-use uses real bound port; tunnel failure → verified LAN fallback; laptop sleep/quit → real offline on both host and members; community-node `DATA_DIR` not writable → fail-closed; free-tier caps hit → honest "busy", no silent drop; direct-exposed relay disables XFF trust.

**Harvested-stream edge cases:** Share Extension exits before a large file finishes copying → stage what's safe, mark the rest still-copying, never report "ready" early; unsupported MIME / oversized item → honest "couldn't bring that in", item retained for retry/discard, never silently dropped; app killed after staging → rows + blobs are durable, the item reappears in the Inbox on relaunch; routing to a DM when plan 21 is absent → the DM target is hidden, not a dead button; Web Share Target on an unsupported browser → option absent (file-pick/drag-drop still works); a transport whose native backend is missing → rung reads "not available on this build", never simulated-as-available; WebRTC ICE never reaches `connected` → no transfer claim, fall through the ranked ladder; BLE-only nearby peer → wake-up + escalate, never a BLE file transfer; same friend reachable on multiple transports → the selector picks one mutual highest, the UI shows the real chosen layer only.

---

## Risks + Honesty Landmines

### Risks

1. **Free first-party relay = cost + abuse magnet.** A free, open, zero-knowledge relay invites bandwidth abuse. Mitigation: clamped per-IP caps (Phase 2), Render/Fly connection ceilings (`packages/meerkat-relay/deploy/fly.toml:41-45`), `/healthz` monitoring, and a documented ceiling beyond which new users are nudged to LAN or self-host. The relay forwards ciphertext only, so abuse is a cost/DoS risk, not a privacy risk.
2. **Tunnel dependency for self-hosting** (`cloudflared` or similar): third-party reliability, ToS, and licensing. Mitigation: tunnel is one of three exposure options; LAN and BYO-domain (Caddy) are first-class fallbacks; the chosen tunnel must be permissively licensed and bundleable, decided in `/office-hours` (Phase 4).
3. **Desktop companion is a net-new surface** (packaging, code-signing/notarization, auto-update, cross-OS). This is the largest scope risk and the reason for the Phase 4-6 split. Mitigation: a thin Node control-panel + default-browser/webview UI (no heavy Electron), reusing the real bins; packaging via `node-sea`/`pkg`. Code-signing is Tier-D ops.
4. **Mobile can't host** — a hard platform reality, not a gap. Mitigation: "Host your own" always routes to the desktop companion; no mobile server-bind is ever attempted (NC-8).
5. **`X-Forwarded-For` trust** depends on the edge. Mitigation: presets set XFF trust only behind a real edge; direct exposure disables it.

### Honesty landmines (the rule, applied)

- **L1 — Hardcoding a `wss://` default that may be down** = fake connectivity. Neutralized by health-gating: a default is "reachable" only after a real `/healthz` pass (Phase 0). `DEFAULT_RELAY_URL` defaults to `''`, so an un-deployed build never lies.
- **L2 — "Connected" from a reachable relay.** A reachable relay ≠ a present peer ≠ delivery. All success copy says "reachable / meeting point", never "connected to {friend}", and never shows a peer count (preserve `StatusPill` "DO NOT SHOW", `apps/meerkat-web/.../StatusPill.tsx:7`).
- **L3 — Host "live/public" before verification.** The companion shows public reachability only after a real round-trip from an **off-host vantage** (third-party echo / tunnel-provider status), never a self-fetch of its own public URL — a self-probe NAT-hairpins or is answered by the tunnel edge locally and would false-positive (AC-9, TC-10, NC-6).
- **L4 — "Spin up a Discord" implying always-on.** The persistent lifecycle banner states the desktop-hosted server is reachable only while the app is open and the computer awake; members see real unreachable when it's off (AC-10). The **always-on** social/public host is the separate first-party Phase 1.5 deploy on our infra, not the desktop companion.
- **L5 — Free vs paid blur — and the stale copy that says there IS no free default.** Today's live copy actively asserts the opposite of this plan: `RelayBar.tsx:30-31` "First-party hosted connection capacity is paid. There is no default."; `SyncDialog.tsx:240`, mobile `sync.tsx:397`, mobile `settings.tsx:333` repeat "First-party hosted connection capacity is paid"; `hosted-boundaries.ts` (`hosted_relay`) frames a URL as required. Shipping a free default makes all of this **false**. Phase 3.6 / Screen 0 rewrites every site to distinguish the **free, zero-knowledge default connection server (meeting point)** from the **$4.99/mo** hosted **capacity / backup / public-reach / always-on-history** tier. Keep them distinct, but stop claiming the free default does not exist. The free default ships with the entitlement gate OFF (NC-4), and its URL is kept **distinct from `VITE_MEERKAT_HOSTED_RELAY_URL`** so the `relayRequiresHostedPayment`/`canUseRelay` gate (`RelayBar.tsx:22`, `SyncDialog.tsx:129`, `hosted-access.ts:23-33`) never flags the free default as paid.
- **L6 — Counts.** Any "{n} connections" on the host dashboard comes from the real `/healthz` `connections` field, nowhere else (TC-8).
- **L7 — Staged ≠ sent (share-in).** A shared item sitting in the Share Inbox is on-device only; "Sent" / "Delivered" copy MUST come from a real `cm_messages` / DM / file-request row, never from `mk_share_intake.status` (NC-10). Staging rows never replicate (NC-9). And the Web Share Target / Share Extension are shown only where the OS/browser actually exposes them — no fake share-target button (AC-14).
- **L8 — Simulated transport ≠ real transport.** The WebRTC/Nearby/BLE transports move zero real bytes today (simulated backends only); the Transports panel and any "connected" state MUST derive from a real native backend that is actually present and (for WebRTC) a real ICE `connected` signal — never a timer, never the simulated fallback presented as live (NC-11). BLE stays wake-only (NC-12). This is the exact trap the relay `CLAUDE.md` warns about ("in-memory-only proofs have historically hidden dead transports; v1 shipped zero real bytes"): prove each new transport with a cross-client e2e moving real bytes.

---

## Sequencing / Dependency Note (relative to the 6 Meerkat launch plans)

| Plan | Relationship to this plan |
|---|---|
| **Theme system (Open Burrow)** | Soft pre-dependency: reuse its tokens for the new Connection card + host UI. This plan adds only rows/cards inside already-themed screens, so it is not blocked. |
| **Connectivity + self-hosting (THIS, 20)** | **Foundational.** Closes the #1 launch blocker (`x-relay.md` §9). Deploys the real serving path others assume. |
| **Public Social Layer (Plan 19)** | **Blocked by this.** Its "Public feed… stays hidden until a real hosted source exists" (web `hosted-boundaries.ts:104-108`, mobile `:103-109`) needs the **always-on first-party** community-node + public-directory serving path now in scope here as **Phase 1.5** (NOT the non-always-on desktop companion). Plan 19 declares a hard dependency on Plan 20 for "a real deployed relay + public directory + always-on serving host"; Phase 1.5 owns that. **Numbering inversion:** Plan 19 depends on Plan 20 despite the lower number — a numeric-order orchestrator would mis-sequence; build 20 (incl. Phase 1.5) before 19. |
| **Full DMs (Plan 21)** | **Blocked by this** for connectivity; **soft consumer for the harvested Share Inbox.** DM delivery rides the mailbox + relay; a default connection makes DMs work out of the box. The Share Inbox "send to a DM" route targets plan-21's `messages.tsx` and stays hidden until plan 21 lands (degrade-honest, never a dead button). Build after Phase 1-3. |
| **Calls & rooms (Plan 25)** | **Shared-layer owner, not blocking.** **THIS plan (Phase 11) OWNS the shared `react-native-webrtc` native layer** — the `apps/meerkat/package.json` dep, the Expo config plugin in `app.config.ts`, the ICE/STUN/TURN config, and the real WebRTC **DataChannel** DATA-transport backend (mobile-only; web stays relay-only) — and lands it first. **Plan 25 CONSUMES that same layer for live-call WebRTC media and must NOT re-add the dep/plugin/ICE config** (it references Plan 20 as owner, extending `WebRTCPeerSession` with media tracks). The **SFU/media server is Plan 25's own** (deploy/ops/scale/cost), co-located on the Plan 20 relay fleet but **not co-owned by Plan 20**; Plan 20 supplies only the relay signaling carrier (`env` token-group forward), TURN, and the `effectiveRelayUrl` resolver. Wired once, never parallel-wired. |
| **Monetization + Billing (Plan 22)** | **Sibling, not blocking.** It wires the PAID `$4.99/mo` hosted tier (`hosted-api.ts` Stripe + `meerkat:hosted-relay`/`meerkat:community-node` gate). This plan ships the FREE relay with the gate OFF and leaves the entitlement-optional code path intact, so Monetization layers on top without conflict. Can land before or after. |
| **WAN-smoke / Plan 23** | **Coordinate the `DEFAULT_RELAY_URL` contract.** Plan 23 still frames `DEFAULT_RELAY_URL` as a constant to "flip" (`23:469`/`23:479`; `T4.5` at `23:392`); this plan changes it to an env-read value gated by `effectiveRelayUrl`/`resolveDefaultRelay`. Plan 23's WAN-smoke gate must consume the new health-gated contract, not flip a constant. |
| **Launch Readiness** | **Blocked by this.** Out-of-box connectivity is its top exit criterion; depends on Phase 1 (real deploy) + Phase 3 (client UX) + Tier-D device QA. |

**Net:** ship Phases 0-3 first to unblock Full DMs and Launch Readiness; Phase 1.5 (first-party always-on community node + public directory) is what actually unblocks Public Social; Phases 4-6 (the desktop host companion) add the self-hosting differentiator; **Phases 8-11 (harvested: OS Share-into-Meerkat + Share Inbox and the real WebRTC/Nearby/BLE data transports) are independent of 4-6 and can run in parallel after 0-3** — they turn "connects out of the box" into "you can pull content in from anywhere and push real bytes over more than just the relay"; Monetization extends the entitlement gate already present.

---

## Handoff State

### Before this work
Both clients ship `DEFAULT_RELAY_URL=''`; no relay deployed; no public image published; out-of-box connectivity is inert. Relay/community-node/seeder/deploy artifacts are real but un-stood-up. Caps are hardcoded. No desktop host tool exists. **Harvested-stream baseline:** no OS share intake on `apps/meerkat` (`app.json` has no `expo-share-intent` plugin); no Android `ACTION_SEND` filters; no Share Inbox; `apps/meerkat-web` has no PWA manifest/service worker so no Web Share Target. The WebRTC/Nearby/BLE transports in `@mylife/sync` are interface + `Simulated*Backend` only and move zero real bytes; only LAN + relay are real-wired. Real blob store, the web file-pick→blob path, and the deterministic ranked selector already exist and are reused.

### After this work
A deployed, monitored, free first-party relay; a deployed first-party **always-on** community node + public directory (Phase 1.5); a published public image; health-gated default connectivity on both surfaces routed through a single `effectiveRelayUrl(db)` resolver (with a real opt-out); connection-card paste/QR adoption; env-configurable clamped fair-use caps; the stale "no free default" copy rewritten; and a non-technical desktop host companion that one-tap runs relay + community node + seeder with tunnel/LAN/domain exposure and off-host-verified reachability — all honest, all from real engine/DB/`/healthz` state. **Plus (harvested):** OS Share-into-Meerkat (iOS Share Extension + App Group, Android `ACTION_SEND`/`ACTION_SEND_MULTIPLE`, web file-pick/drag-drop + optional PWA Web Share Target) staging into a durable device-local content-addressed intake model, surfaced in a Share Inbox that routes an item into a community channel, a DM (plan 21), or files; and the previously-simulated WebRTC DataChannel / Nearby / BLE-wake transports backed by **mobile-only** real native backends behind honest capability probes (the web client stays relay-only for v1 — no web WebRTC data backend), on a `react-native-webrtc` native layer **this plan owns** (dep + Expo config plugin in `app.config.ts` + ICE/TURN, consumed by Plan 25 for media, never double-wired), driven by the existing deterministic ranked selector, BLE wake-only, "connected" only from real ICE state — moving real bytes beyond relay + LAN, with no crypto reimplemented.

### Files created / modified (representative)
- `packages/sync/src/transport/default-relay.ts` (new, `resolveDefaultRelay`/`resolveDefaultRelaySync`/`effectiveRelayUrl`) + `__tests__/default-relay.test.ts` + `effective-relay-url.test.ts` (new) — health-gated resolution + centralization.
- `packages/sync/src/index.native.ts` AND `packages/sync/src/index.ts` — **export `resolveDefaultRelay`, `resolveDefaultRelaySync`, `effectiveRelayUrl`** (native barrel mandatory for the harness).
- Mobile **21-read-site replacement**: `apps/meerkat/app/(root)/providers/SyncProvider.tsx` (8 sites), `providers/NodeProvider.tsx` (2), `data/background-sync.ts` (2) — each `|| DEFAULT_RELAY_URL` → `effectiveRelayUrl(db)`.
- `apps/meerkat/app/(root)/data/sync-core.ts` (env-read default + comment), `apps/meerkat/app/(root)/data/db.ts` (`mk_relay_probe` + `mk_settings` keys), `apps/meerkat/app/(root)/sync.tsx` (+`:397` copy) + `(tabs)/settings.tsx` (+`:333` copy, opt-out toggle) (Connection card, adopt, host entry), `apps/meerkat/app/(root)/data/hosted-boundaries.ts` (copy rewrite).
- **Mobile build env:** convert `apps/meerkat/app.json` → `apps/meerkat/app.config.ts` (so `extra.defaultRelayUrl` reads `process.env`).
- Web **9-read-site replacement** + `apps/meerkat-web/src/lib/relay.ts` (env-read default), `MeerkatProvider.tsx` (`mk_relay_probe` + `effectiveRelayUrl`), `src/ui/sync/{SyncDialog,RelayBar}.tsx` (copy rewrite), `src/ui/settings/{RelaySection,TransportSection}.tsx` (opt-out toggle), `src/lib/hosted-boundaries.ts` (copy rewrite), `src/vite-env.d.ts` (**add `VITE_MEERKAT_DEFAULT_RELAY_URL`, distinct from `_HOSTED_RELAY_URL`**).
- `packages/meerkat-relay/src/protocol.ts` (`resolveRelayLimits`), `src/server.ts` (consume at `:136,194`)/`src/hub.ts` (existing `limits` merge), `bin/meerkat-relay-server.mjs` (env), `__tests__/relay-limits*.test.ts` (new).
- `packages/meerkat-relay/host/**` (new): control-panel server, process supervisor, wizard UI, tunnel/exposure, off-host reachability probe, connection card/QR, packaging, tests.
- Ops/config: `render.yaml`/`deploy/*` env, run `publish-relay-image.yml`, **deploy always-on community node + public directory (Phase 1.5)**, web `.env.production`, mobile `app.config.ts`.
- **Harvested stream A (OS Share-into-Meerkat):** `packages/sync/src/share/` (new: intake model parse/normalize/sniff/stage/route) + `__tests__/share-intake.test.ts`; export the factory from `packages/sync/src/index.native.ts` AND `index.ts`. Mobile: `apps/meerkat/app.config.ts` (Share Extension + App Group `group.com.mylife.meerkat` config-plugin block + Android `ACTION_SEND`/`ACTION_SEND_MULTIPLE` filters, reusing the Manhattan precedent), `apps/meerkat/app/(root)/data/db.ts` (`mk_share_intake` + `mk_share_payload`), `apps/meerkat/app/(root)/share-inbox/` (new Inbox route, distinct from `(tabs)/share.tsx`), routing into `cm_messages`/blob, DM (`(tabs)/messages.tsx`), files (`community-files.ts`). Web: `apps/meerkat-web/src/ui/inbox` (new), `src/lib/MeerkatProvider.tsx` (`mk_share_*` bootstrap + reuse `Composer.tsx` file→blob path), `apps/meerkat-web/public/manifest.webmanifest` + a service-worker share-target handler (optional, capability-gated). QA: `apps/meerkat/Tickets/share-intake-qa.md`.
- **Harvested stream B (real data transports, mobile-only):** **Shared WebRTC native layer THIS PLAN OWNS** — `apps/meerkat/package.json` (add `react-native-webrtc` dependency) + `apps/meerkat/app.config.ts` (declare the `react-native-webrtc` Expo config plugin + ICE/STUN/TURN config; dev/EAS-build required, not Expo-Go-testable). `packages/sync/src/transport/` real backends for `webrtc-transport.ts` (`react-native-webrtc`, **mobile only — no web WebRTC data backend**), `nearby-transport.ts` (Multipeer / Wi-Fi Direct/Aware), `ble-transport.ts` (CoreBluetooth / `android.bluetooth`, wake-only), injected through the existing interfaces; export the real-backend factories from `index.native.ts`; new `__tests__/{transport-selector,webrtc-state,ble-wake}.test.ts`. Mobile app glue mirroring `data/lan-backend.ts` (lazy capability probe → null when absent) + a mobile-only Transports panel in `(tabs)/settings.tsx` (the web client ships no Transports panel; it stays relay-only). QA: `apps/meerkat/Tickets/transport-qa.md`. **Plan 25 (calls media) consumes this same `react-native-webrtc` native layer — it does NOT re-add the dep/plugin/ICE; it references Plan 20 as owner. The SFU/media server is Plan 25's own, co-located on the Plan 20 fleet but not co-owned here.**
- Docs: `docs/guides/deploy-a-meerkat-relay.md` (one-tap Host path), `packages/meerkat-relay/CLAUDE.md`, `apps/meerkat/CLAUDE.md` (add OS share-in + now-real WebRTC/Nearby/BLE rungs to the transport-honesty section), `apps/meerkat-web` notes, `memory.md`, session log, `apps/meerkat/Tickets/connectivity-qa.md`.

### Known limitations (intentional, honest — not dropped scope)
- A phone/browser still cannot host (platform reality); hosting is the desktop companion only.
- The free default relay is a meeting point, not always-on backup/storage; backup + public reach stay the paid tier (Monetization plan), and the boundary copy says so.
- Auto-dial / background presence remain out of scope here (separate engine work); copy continues to say "no automatic device dialing."
- The iOS Share Extension and the native WebRTC/Nearby/BLE backends are NOT Expo-Go-testable; they need a dev/TestFlight build — that QA is Tier-D ops, not a scope cut.
- The Web Share Target is browser-capability-gated (absent where unsupported); the always-available web intake is the file-picker + drag-drop. The DM destination depends on plan 21 and is hidden until it ships.
- Live-call WebRTC media is plan 25, not here; Phase 11 ships the WebRTC DataChannel for data/file transfer only. **This plan OWNS the shared `react-native-webrtc` native layer (dep + Expo config plugin in `app.config.ts` + ICE/TURN); Plan 25 consumes it for media without re-adding it, and the SFU/media server is Plan 25's own (co-located on the Plan 20 fleet, not co-owned here).** Huge-file / forever-archive ingest is plans 19 + 22, not here.
- **Stream-B real data transports (WebRTC DataChannel / Nearby / BLE-wake) are mobile-only for v1; the web client stays relay-only.** This is an honest platform scoping, not a deferral: browsers have no raw P2P sockets, so there is no unwired web WebRTC data backend to ship and no web Transports panel. Web parity for stream B is intentionally out of scope (no AC requires it).

### Context for the next agent
- Never flip `DEFAULT_RELAY_URL` to a bare hardcoded `wss://`, and never read `getSetting(...) || DEFAULT_RELAY_URL` directly — **always dial through `effectiveRelayUrl(db)`** (which wraps `resolveDefaultRelaySync`) so status stays health-gated AND the per-device `default_relay_optout` actually governs the transport. `DEFAULT_RELAY_URL` is only the build-time env value the resolver consults; it is not read at any networking site.
- Do not add fields to `/healthz` (zero-knowledge invariant) and do not switch the slim bin to the barrel import (`bin/meerkat-relay-server.mjs:8-11`).
- Keep relay config under the `mk_` prefix (never in `MEERKAT_SYNC_PREFIXES`).
- Relay test gotcha: backgrounded tsx starves socket IO in sandboxes — drive supervisor IO tests with explicit awaits.
- **Harvested streams:** do NOT change the transport classes' logic — only inject a real `WebRTCBackend`/`NearbyPeerBackend`/`BleBackend` through the EXISTING interfaces (the Noise handshake is transport-agnostic; no crypto change). **Stream-B real data transports are MOBILE-ONLY for v1 — do NOT wire a web WebRTC data backend; the web client stays relay-only (browsers have no raw P2P sockets).** **This plan OWNS the shared `react-native-webrtc` native layer:** add the dep to `apps/meerkat/package.json` and declare its Expo config plugin + ICE/STUN/TURN inside `apps/meerkat/app.config.ts` (the SAME file Phase 0 creates), requiring a dev/EAS build. Plan 25 (calls media) CONSUMES this same layer and must NOT re-add the dep/plugin/ICE — coordinate so the native module is wired exactly once. Never present the `Simulated*Backend` as a live rung; gate each layer on a real capability probe (mirror `data/lan-backend.ts`). WebRTC "connected" comes from `onConnectionStateChange` only. BLE is wake-only. Keep `mk_share_intake`/`mk_share_payload` out of `MEERKAT_SYNC_PREFIXES` (device-local like `mk_relay_probe`); a staged item is never "sent" until a real `cm_messages`/DM/file-request row exists. Stage the iOS Share Extension config inside the SAME `app.config.ts` that Phase 0 creates, reusing the Manhattan `expo-share-intent` precedent. Prove every new transport with a real-bytes cross-client e2e (the relay `CLAUDE.md` warns in-memory proofs hid dead transports before).
- All Open Brain captures use context `"personal, mylife"`.

## Status Delta (2026-07-04)

- Code-complete Phases 0-12, verified against code in the 2026-07-04 production audit.
- EAS projectId is real in `app.json` (`c662e59e-1950-4b9e-ae0e-262bc3bbfdf1`), and the lockfile carries `expo-share-intent` and `react-native-webrtc`.
- Remaining is founder-ops: relay/node deploys and env vars (default relay URL, TURN).
- Optional codeable extra: web QR-scan.
- The launch-finish branch is fully merged to main and pushed (merge bcb45871).
