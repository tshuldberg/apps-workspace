# Meerkat Launch-Finish (ultracode) — 2026-07-01

Branch: `feature/meerkat-launch-finish` (off `main` via the Plan 19 P9 archive branch).
Execution: multi-agent Workflow (ultracode), read-only mapping pass then 6 build waves,
each adversarially verified and committed after a local gate. CI is down (GitHub billing);
local green is the gate throughout.

## What shipped (code-complete, verified locally)

| Wave | Commit | Scope |
|------|--------|-------|
| 1 | `3d8b288c` | **Plan 19 FF3** public-join end-to-end code: owner-side grant emission (`createPublicJoinGrant`) + `queuePublicJoinRequest` seal/park + reader wiring, mobile+web twins. `public_join_json` column added for takedown reconstruction. |
| 2a | `9747d744` | **Plan 20 host companion backend** (Ph 4b-6c): spawn/tunnel/lan/domain/off-host-probe/qr adapters + 127.0.0.1 control panel + `meerkat-host` bin + adopt-and-sync e2e. |
| 2b | `7d1a1565` | **Plan 20 host UI** (Ph 5a/6b/6d): first-run wizard + dashboard + pure honesty view-model (card only when `available:true`; constant lifecycle banner). |
| 3a | `b6e5c187` | **Plan 20 OS Share intake + Share Inbox** (Ph 9-10): iOS Share Extension/Android intents config + native intake glue + `mk_share` device-local tables + inbox routing; web drag-drop + capability-gated Web Share Target. |
| 3b | `4e4ee122` | **Plan 20 native transports** (Ph 11): real WebRTC/Nearby/BLE backends behind capability probes; WebRTC connected only from real ICE; BLE wake-only; web relay-only. |
| 4 | `e6976f5d` | **Plan 20 ship pass** (Ph 7+12): +109 parity guards; built the real missing web 5-state Connection card; `server.ts` tunnel-reachability re-verify (onExit reset + TTL); docs. |
| 5 | `fc65972a` | **Plan 21 P0 + P1-shape** (begin): pure DM protocol `dm-message`/`dm-mailbox`/`dm-receipt`; distinct `meerkat-dm-message-v1` domain (cross-domain isolation triple-verified); no new crypto. |

Plan status: **Plan 19 FF3 code-complete**, **Plan 20 code-complete (Phases 0-12)**,
**Plan 21 begun (P0)**. None moved to `done/` — each has a founder-ops gate below (per
its own DoD), so they honestly stay in the queue.

## Honesty boundary held everywhere
`DEFAULT_RELAY_URL` stays `''`. `cm_publications` is the sole `published_blob`. `mk_share_*`
are device-local (never in `MEERKAT_SYNC_PREFIXES`). Staged != sent. No peer count / online
dot / "connected to X" anywhere. A Simulated transport is never shown as a live rung. A
connection card/QR is never surfaced for an unverified/down host. Viewing the public archive
is free + anonymous. No crypto reimplemented in any new module.

## Founder-Ops Handoff (required for launch, NOT locally buildable)

### Dependencies / build
1. `pnpm install` at repo root to sync the lockfile for the declared native deps:
   `expo-share-intent@5.1.1`, `react-native-webrtc`, `@config-plugins/react-native-webrtc`.
   (Code is lazy-loaded so it runs without them; a `--frozen-lockfile` CI install fails until this runs.)
2. `expo prebuild` + a dev/EAS build so the config plugins apply: iOS Share Extension + App
   Group `group.com.mylife.meerkat`, data-protection/security-hardening, `react-native-webrtc`
   native + ICE/STUN/TURN.
3. Provision the iOS App Group `group.com.mylife.meerkat` on the Apple Developer account.

### Deploy (the single biggest launch blocker)
4. Deploy the first-party zero-knowledge default relay (Render/Fly), publish the relay image,
   then flip `DEFAULT_RELAY_URL` (via `app.config.ts` extra / `VITE_MEERKAT_DEFAULT_RELAY_URL`)
   ONLY after a real `GET /healthz` over TLS. This unblocks out-of-box pairing, DMs, and FF3 joins.
5. Deploy the always-on first-party community node + public directory — un-hides Public Social.
6. Desktop companion: per-OS `build:host` binary + code-signing/notarization; ship or fetch
   `cloudflared`; deploy the external off-host reachability endpoint (`HostServerDeps.reachabilityServiceUrl`).

### Device QA (not Expo-Go-testable — needs a dev build + 2 physical devices)
7. FF3 public-join over a real relay: A publishes open -> B redeems (roster row, zero key);
   A publishes request -> B queues -> A drains + approves -> B gets membership.
8. OS Share-sheet intake on real iOS + Android builds (text/url/image/pdf/audio/video/file).
9. Real WebRTC/Nearby DataChannel 2-device transfer + BLE wake; confirm "connected" only when
   the real channel opens. Desktop-companion LAN/WAN adopt.

## Codeable follow-ups (future sessions, not founder-ops)
- Plan 19: owner-side auto-approve handler wiring the parked public-join request through
  `openPublicJoinRequest` -> member add + key handoff (the mailbox dispatcher drops the kind
  fail-closed until then, so nothing is fabricated).
- Plan 21 remaining: Phase 2 dispatcher/drain, Phase 3-5 mobile store/provider/UI, Phase 6
  group epoch, Phase 7-8 attachments/block/report, Phase 9 web parity, Phase 10 hardening.
- Optional: web AdoptServerPanel (paste card + QR) to fully mirror the mobile adopt flow.

## Verification (local, CI down)
Every wave: adversarial verify + `pnpm gate:function:changed` on commit. Final suite state:
`@mylife/sync` 1403 tests / 109 files; `@mylife/meerkat-relay` 321; mobile 304 (one unrelated
timing-flake `saveFilesBulk`, green in isolation); web 176; `check-meerkat-parity` exit 0
(twin guards incl.); all four typechecks (sync/relay/mobile/web) clean.
