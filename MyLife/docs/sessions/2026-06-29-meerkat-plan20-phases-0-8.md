# Meerkat Plan 20 — connectivity + self-hosting: Phases 0, 2, 3, 4-core, 8

Date: 2026-06-29 (continues 2026-06-28)
Branch: `feature/mylife-improvements-sprints` (shared with a parallel Plan 18 theme session)
Plan: `docs/plans/queue/20-meerkat-connectivity-and-self-hosting.md`
Founder directive: build all remaining codeable phases autonomously; honesty/no-fake mandate stands.

## Commits (this program)

| Phase | Commit | What |
|---|---|---|
| 0 | `22ab05ee` | Health-gated default-relay resolver + 21-site centralization |
| 2 | `63180791` | Env-configurable, clamped fair-use relay caps |
| 3 (mobile+codec) | `a3ff7278` | Connection card codec + status card + adopt + opt-out + Screen-0 copy |
| 3 (web) | `0212cdbd` | Web card adopt + opt-out + probe writer + Screen-0 copy |
| 8 | `98138c36` | Durable OS share-intake model + device-local store |
| 4 (core) | (this) | Desktop host companion supervisor + config + reachability |

## Phase 0 — engine spine (DONE)
`@mylife/sync` `default-relay.ts`: `resolveDefaultRelay` / `resolveDefaultRelaySync` /
`effectiveRelayUrl` (both barrels, 16 tests). Device-local `mk_relay_probe` cache
(TTL + race guard) + `default_relay_optout` / `adopted_server_url` keys + a thin
`effectiveRelayUrl(db)` wrapper per app. ALL 21 raw
`getSetting||DEFAULT_RELAY_URL` dial sites centralized so the opt-out + a real
`/healthz` gate govern the actual dial (AC-4). `DEFAULT_RELAY_URL` is env-read
(mobile `app.config.ts` extra / web `VITE_MEERKAT_DEFAULT_RELAY_URL`), defaults
`''` = today's honest behaviour (AC-2, L1). Adversarial review: P0 none; P1-1
fixed (Tier-B wiring proof both apps); P2-1 carried to Phase 3.

## Phase 2 — fair-use caps (DONE)
`resolveRelayLimits(env)` overrides 8 caps, each clamped to a safe `[min,max]`
(no amplifier-high, no self-DoS-low; unset == defaults). `startRelayServer`
resolves once (explicit `options.limits` win; else clamped `process.env`) and
feeds the hub + the two formerly un-wired `server.ts` reads. Slim bin +
Dockerfile + image-deps invariant untouched. `/healthz` unchanged (NC-5).
Tier-A clamp matrix (12) + Tier-B live-server enforcement (4). Presets documented.

## Phase 3 — client connectivity UX (DONE; visual QA deferred)
Connection-card codec (TC-7, 11 tests). Mobile `ConnectionStatusCard` (5 honest
states, real probe-on-mount = the P2-1 fix) + `AdoptServerPanel` (paste/QR) +
opt-out toggle + honest host-your-own row. Web RelayBar card-adopt + RelaySection
opt-out + MeerkatProvider boot probe-writer + display refresh. Screen-0 stale-copy
rewrite across 7 sites: stopped the now-false "capacity is paid / there is no
default" claim, framed the paid tier as EXTRA capacity, deferred reachability to
the live card, and never asserts a default that `''` lacks.
**Deferred (needs a running app + gstack browser daemon):** `/browse` visual QA
of the 5 status states + the QR scan flow.

## Phase 8 — share-intake engine (DONE)
`@mylife/sync` `share/share-intake.ts` (pure normalize: url-vs-text, magic-byte
MIME sniff that ignores sender MIME, size guard, multi-item; TC-12, 10 tests) +
`share-intake-store.ts` (`mk_share_intake`/`mk_share_payload` DDL + stage/list/
route/discard/sweep; device-local outside `MEERKAT_SYNC_PREFIXES`, NC-9; routed
status flips without delete, NC-10; sweep returns only truly-orphaned blob hashes;
5 tests). Placed in `@mylife/sync` as a shared generator (parity-by-construction);
both apps call `ensureShareIntakeTables` in their bootstrap.

## Phase 4 — desktop host companion (CORE DONE; UI/tunnel/packaging remain)
`packages/meerkat-relay/host/`: `host-config.ts` (Zod config + `presetToRelayEnv`
private/open -> clamped RELAY_* env, never a paid gate + `buildHostConnectionCard`
reusing the codec; TC-9), `reachability.ts` (`gateReachability` reachable only from
a real OFF-HOST round-trip, self-vantage rejected; TC-10, AC-9, L3),
`process-supervisor.ts` (`HostSupervisor` spawns the real bins via injected spawn,
reads each REAL bound port from its listening log, reports liveness from
`/healthz`, flips offline on stop; TC-8, AC-10). 15 tests with injected deps
(deterministic, no real child processes). `host/README.md` scopes the rest.

## Remaining Plan 20 work (honest accounting)

**Codeable but visual/device-QA-gated:**
- **Phase 5-6** — the host control-panel HTTP server + wizard/dashboard UI, the
  `cloudflared` tunnel integration, the real `node:child_process` spawn + off-host
  probe service wiring, and `node-sea`/`pkg` packaging + code-signing. (Net-new
  surface + Tier-D ops; the honest reachability + supervisor core is done + tested.)
- **Phase 10** — the Share Inbox route (mobile) + web inbox UI + routing a staged
  item into a channel / DM (hidden until Plan 21) / files. Builds on the Phase 8
  engine; the routing wiring is real but the 5 visual states need `/browse` QA.
- **Phase 9** — the iOS Share Extension + App Group config plugin + Android
  `ACTION_SEND` intent filters inside `app.config.ts`. NOT Expo-Go-testable; needs
  a dev/TestFlight build (Tier-D), per the plan's own honest limitation.
- **Phase 11** — the real `react-native-webrtc` / Multipeer / BLE-wake backends
  behind lazy capability probes, and the owned `react-native-webrtc` native layer
  (dep + config plugin + ICE/STUN/TURN). The transport classes + the deterministic
  selector (`buildTransportLayerDialOrder`) + the simulated backends already exist;
  the real backends are NOT Expo-Go-testable and require a dev/EAS build, and the
  plan + `@mylife/sync` CLAUDE.md explicitly warn against shipping a transport
  proven only in-memory ("v1 shipped zero real bytes"). Adding an uninstalled
  `react-native-webrtc` dep would also break `pnpm install --frozen-lockfile`, so
  the dep add itself is an install/build ops step. Deliberately NOT written
  speculatively here.

**Tier-D founder ops (not codeable):** Phase 1 (deploy the first-party relay +
publish the image), Phase 1.5 (deploy the always-on community node + public
directory — unblocks Plan 19), plus all device/2-network QA and the relay/host
deploys. Set `MEERKAT_DEFAULT_RELAY_URL` / `VITE_MEERKAT_DEFAULT_RELAY_URL` only
after the relay answers `wss://.../healthz` over TLS, AND after the Phase-10/9 UI
ships — until then the honest empty/no-default states hold.

## Verification at this checkpoint (all green)
- `@mylife/sync`: 1222 tests. `@mylife/meerkat-relay`: 168 tests (incl. 15 host).
- `@mylife/meerkat-app` + `@mylife/meerkat-web`: typecheck clean; web 87 tests.
- `gate:function:changed` (incl. hub consumer typechecks) + `check-meerkat-parity`
  green on every commit. No em dashes.
