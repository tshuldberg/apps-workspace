# 2026-07-12 - Meerkat Plan 25 (calls + rooms) foundation build

## What was done

Started execution of Plan 25 (voice/video calls + community rooms), the larger of the
two unbuilt launch-hard programs the 2026-07-12 production runbook confirmed absent.
Founder directive: "build calls/rooms now." Work is on `feature/meerkat-plan25-calls`
(worktree `.claude/worktrees/meerkat-plan25-calls`, branched from `feature/meerkat-plan43`
@ `89acfafc`). Every packet was Fable-reviewed against the engineering-locked plan and its
negative criteria before commit; the codeable server/protocol packets were implemented via
codex (gpt-5.5) wrappers, the dependency and deploy work directly.

## Landed packets (all gates green)

- **WP-25A** `296eec6f` - Phase 0 dependency migration: WebRTC runtime replaced with
  `@livekit/react-native-webrtc` 144.1.1 plus `@livekit/react-native` 2.11.1,
  `livekit-client` 2.20.1, `@livekit/react-native-expo-plugin` 1.0.2 (verified compatible
  with Expo 54 / RN 0.81.5). Data backend + LiveKit expo plugin wired; data path re-proven.
- **WP-25C** `19394009` - `packages/sync` room-admission protocol: signed RoomAdmissionRequest,
  strict field allowlist, 60s TTL cap, replay after signature, role-to-permission allowlist
  over the real WorkspaceMemberRole (owner/admin/member/viewer), unlinkable ephemeral
  participant ids (NC-25.3). 35 adversarial tests.
- **WP-25B** `3f2e6d5d` + barrels `f1cd996e` - `packages/sync` call-signal protocol: signature
  binds a sha512 commitment of the encrypted SDP/ICE payload, pair-secret-derived relay token
  distinct from mailbox tokens, 120s TTL cap, replay after signature, deterministic glare, fuzz
  safe. 38 tests.
- **WP-25F** `4a8ec00e` - owned `packages/meerkat-call-native` Expo module: iOS PushKit+CallKit
  with the report-before-completion App Store invariant enforced (server caller name never
  rendered), Android Core Telecom self-managed with isSupported() graceful degradation, config
  plugin, null bridge, UNVERIFIED-until-dev-build disclaimers. 28 TS tests.
- **WP-25E** `e735048a` - `packages/meerkat-relay` room-token service: membership verified
  before signature, nonce recorded only after signature, stale epoch/revision rejected,
  permission subset enforced, opaque HMAC room name whose admission-generation bump renames
  the room so a stale token cannot rejoin after a moderation revoke (NC-25.6), least-privilege
  LiveKit grants, ephemeral id as the only LiveKit identity field. Migration 0015 +
  `meerkat_room_token` role appended last; `livekit-server-sdk` pinned; optional HTTP mount on
  the community node. ~40 tests incl a real-JWT privacy decode.
- **WP-25D** `<call-session commit>` - `packages/sync` direct call media-session state machine:
  pure, injected-seam lifecycle driving the WP-25B signals and an injected WebRTC backend.
  NC-25.1: `connected` is set ONLY by a real backend connectionState event (per-kind matrix
  proves no signal or timer can). NC-25.2: every inbound signal passes verifyCallSignal before
  it can ring. Glare, encrypted-payload-only SDP/ICE, bounded ICE buffers, tick-driven
  deadlines, ICE restart. 45 tests. Sync suite 1,963 green.
- **WP-25I deploy topology** `<deploy commit>` - self-hosted LiveKit stack in
  `compose.production.yml`: redis 7.4.1 (distributed-mode store), livekit-server v1.8.4 (RTC
  media, opaque room+participant ids only), livekit/egress v1.8.4 (explicit moderator-only
  recording, NC-25.5). New `livekit.production.yaml`, `egress.production.yaml`, Caddy
  `LIVEKIT_DOMAIN` route. Compose validates 11 services.

## Verification

Sync 1,963 / relay 1,352 tests green; sync/relay/app/web typechecks green; meerkat parity
green; both consumer apps typecheck; compose.production.yml validates with a full env.

## Remaining (needs a running app, dev build, devices, or deployed LiveKit)

- Community-node bin wiring of the WP-25E room-token mount (a membership verifier backed by
  the node's real signed-membership state; must never fake membership). Env contract is in
  compose, called out as the remaining code step.
- WP-25G mobile direct-call UX, WP-25H web call UX twin, WP-25I room UI - all require a signed
  dev build (native call module + WebRTC runtime), a running app for five-state QA, and a live
  LiveKit for the room screens. Building these blind would violate the plan's no-fake-connected
  and five-state rules.
- WP-25J hardening/adversarial proof pack (layers on the above).
- Founder-ops: signed dev/EAS builds, physical two-device call matrix, LiveKit/Redis/TURN/Egress
  production deployment, recording storage policy, store VoIP/background disclosures.

## Notes / incident

One codex run went off-spec and wrote draft files onto sibling packet paths; handled by having
the owning packets absorb them as untrusted drafts, and re-running the stray packet with a
tightened only-these-files prompt. Two packets were committed directly by codex against
instructions; both were correctly scoped and passed post-hoc review, so kept.
