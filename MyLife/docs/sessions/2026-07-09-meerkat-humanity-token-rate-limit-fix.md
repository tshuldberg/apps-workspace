# Meerkat humanity-token rate-limit preservation

**Date:** 2026-07-09
**Branch:** `feature/meerkat-public-base-feed`
**Scope:** Fix the audited public-submit path where a pre-humanity per-IP rate limit discarded an unspent single-use humanity token on mobile and web.

## Why

`submitPublicPost` removes one token from the local humanity wallet before making the request. The community node's shared per-IP limiter runs before the humanity redemption gate. Its `429 { reason: "rate_limited" }` response was indistinguishable from the durable per-persona flood cap, which runs after redemption. Both clients therefore conservatively treated the early token as spent and could force unnecessary reverification.

## Changes

- `packages/meerkat-relay/src/community-node-http.ts`
  - Added optional rejection metadata to the shared per-IP admission helper.
  - The public submit route now returns `humanityTokenConsumed: false` only when its per-IP limiter rejects before humanity redemption.
  - Later/ambiguous `rate_limited` responses retain their previous shape.
- `apps/meerkat/app/(root)/data/public-post-client.ts`
  - Parses the optional marker and restores the token only for an exact pre-humanity 429 contract.
  - Preserves existing session/network restoration and post-redemption spend behavior.
- `apps/meerkat-web/src/lib/public-post-client.ts`
  - Added the same semantic behavior for web.
- Added focused relay, mobile, and web regression coverage.
- Extended `scripts/check-meerkat-parity.mjs` so both clients must retain the explicit restoration seam.

## Safety decision

The clients do not restore every `rate_limited` token. A field-absent, malformed, legacy, proxy-generated, or post-redemption 429 remains conservative because the per-persona flood cap can return the same reason after the humanity service has spent the token. The change is an additive response field, so existing clients and servers remain protocol-compatible; deploy the server before the updated clients to realize the fix immediately.

## Verification

- Red phase reproduced the defect in all three focused suites.
- Focused green phase: mobile 18, web 10, relay public-submit 34.
- Full mobile: 98 files, 1,079 tests; typecheck; Expo iOS + Android export.
- Full web: 95 files, 723 tests; typecheck; Vite production build.
- Full relay: 84 files, 575 tests; typecheck; production smoke.
- `pnpm check:meerkat-parity` passed.
- `pnpm check:generated-artifacts` passed.
- `git diff --check` passed.

## Remaining release work

This closes only the humanity-token rate-limit defect. The broader production audit remains NO-GO until the separate account deletion/export, raw blob deletion, launch-scope, CI, branch-integration, store/legal, deployment, real-device, and soak blockers are closed or explicitly resolved by the founder.
