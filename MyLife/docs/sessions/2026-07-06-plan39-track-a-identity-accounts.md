# 2026-07-06 — Plan 39 Track A: Public persona identity + accounts (P1-P3)

Branch `feature/meerkat-public-base-feed`. Track A of Plan 39 (Meerkat public base feed). Three
phases, three commits, all gates green. Track B (P4-P7) is a separate agent/worktree.

## Commits
- `5a1fac96` P1 public persona protocol
- `b14e882c` P2 alias registry + accounts service
- `f7a24bc6` P3 verified public-account onboarding UI

## What shipped

### P1 — `packages/sync/src/protocol/public-persona.ts`
A fresh Ed25519 persona keypair (never the device key, NC-P2), derived from a 32-byte seed
(fromSeed) with only the seed stored in the SecretStore under a distinct shared-secret
namespace. `PersonaClaim` binds `alias + personaPubkey + humanityBinding`, persona-signed under
domain `meerkat-persona-v1`. Alias canonicalization is NFKC-fold + lowercase + ASCII
`[a-z0-9_]{3,20}` (the ASCII-only charset is the homoglyph defense). Leakage tests both
directions (NC-P2) + an NC-P1 static guard (no private mesh source imports the persona
protocol). 14 tests.

### P2 — `packages/meerkat-relay/src/persona-registry.ts` + `persona-session.ts` + store + HTTP
`PersonaRegistryService` over a durable `FilePersonaRegistryStore` (O_EXCL atomic uniqueness on
BOTH alias and persona key). Registration is humanity-gated with a reserve-then-redeem flow
(reserve the alias atomically BEFORE spending the humanity token, roll back on redeem failure —
no token burned on a lost race). GDPR delete (alias release + 30-day cooldown + session revoke +
persona returned for post-tombstone propagation) and export, both persona-signed with a
freshness window. `persona-session.ts` mints HMAC-SHA256 session bearers and exposes the
fail-closed verifier seam Track B consumes. 28 adversarial tests.

### P3 — mobile `apps/meerkat` + web `apps/meerkat-web`
`persona-core` twins drive the REAL registry (availability, register, session, GDPR) with honest
unconfigured/offline states; no fabricated status; the device key never crosses the wire.
Screens: persona/create (S3), persona/settings (S13), identity Public-persona section (S11);
web folds all three into `PublicPersonaSection` with verbatim, parity-locked copy. 11 mobile + 9
web persona-core tests.

## Session-verifier seam for Track B (P6 submit route)
From `@mylife/meerkat-relay`:
- `createPersonaSessionVerifier({ secret, now?, isRevoked? }): (token) => Promise<PersonaSessionVerdict>`
- pure `verifyPersonaSessionToken(token, secret, nowMs): PersonaSessionVerdict`
- `PersonaRegistryService.verifySession(token): Promise<PersonaSessionVerdict>`
- `PersonaSessionVerdict = { ok: true; personaPubkey; issuedAtMs; expiresAtMs } | { ok: false; reason: 'not_configured'|'malformed'|'bad_signature'|'expired'|'revoked' }`
Wire `isRevoked` to the registry store so a GDPR-deleted persona's bearer fails closed.

## Codex findings folded (all accepted, none dismissed)
- P1: `extractPersonaPrivateKeyHex` binds the seed to the expected persona pubkey (a peer/corrupt
  shared-secret ref can no longer yield a persona signing key).
- P2: one-alias-per-persona (two-key atomic), reject revoked keys at registration, no humanity
  token burned on a lost alias race.
- P3: GDPR delete + global wipe now remove the persona seed (collectSecretRefs reads
  `public_persona`; delete threads a secret deleter); export surfaces the JSON (clipboard on
  mobile, download on web); GDPR actions fail closed with `key_unavailable` instead of throwing.

## Decisions / founder flags
- Humanity binding hash switched sha256 -> sha512Hex (the one repo-wide hash available in
  RN/web/node) so client and server compute the commitment identically. No product impact.
- Session issuance requires proof-of-persona-key possession + registered + non-revoked. Humanity
  is anchored at REGISTRATION (one token spent); it is NOT re-checked per hourly session issuance
  (that would burn tokens). A deploy wanting a fresh humanity check on issuance can layer it in
  the P7 middleware — flag for founder/Track B.
- One persona = one alias (enforced). Multiple aliases per persona would be a product change.

## Deviations from the mockups
- S13 "Verification wallet: 27 passes" — the humanity wallet holds a single token, not a batch
  count, so the UI shows an honest "Verified on this device · refills when you verify" instead of
  a fabricated number.
- S3 suggestion chips not implemented (illustrative in the mockup); the alias input + live
  availability check are.
- Web consolidates S3/S11/S13 into one settings section (the web app has no router); copy is
  verbatim and parity-locked.

## A-B integration (2026-07-06, after Track B merge eaa8d3c0) — commit `667e8b8e`
Wired Track A sessions to Track B's public-submit route at the merge seam:
- P7 humanity gate on session issuance: persona-service-http mounts Track B's
  `createHumanityRouteGuard` on POST /persona/session/issue (`sessionHumanityGuard` +
  `sessionHumanityRequired`, default true). Issuing a session now spends one humanity token
  (plan text overrides the earlier Track A founder flag #1). Guard response is CORS-primed.
- Client twins attach the wallet `x-mk-humanity` on issuance, clear it on a spent/invalid
  outcome, and PRESERVE it on pre-guard failures (rate_limited/missing/unreachable).
- Bin fix: community-node.mjs POSTs `${SESSION_VERIFY_URL}/persona/session/verify`.
- New deployable `bin/meerkat-persona-service.mjs` (+ `start:persona-service`), env-driven,
  honest boot log, unique default port 8894.
- Integration e2e `plan39-public-write-e2e.test.ts`: real humanity + persona + community-node
  chain (verify -> register -> session -> app-unlock -> submit -> dual-verified page) + GDPR
  delete revokes the live session + persona_mismatch + P7 gate. `createPersonaSessionVerifier`
  isRevoked wired to the registry store.
Both bins agree on `MEERKAT_APP_UNLOCK_TOKEN_SECRET`. Codex folded (CORS, token preservation,
port). Relay 464, app 1026, web 688, parity green.

## Verification
sync 1771, relay 412, mobile app 1022, web 685 — all pass. `pnpm gate:function:changed` green,
`pnpm check:parity` green (incl. the new persona parity section). Config defaults leave the
persona service unconfigured (`MEERKAT_PERSONA_SERVICE_URL` / `VITE_MEERKAT_PERSONA_SERVICE_URL`)
so the public-account flow is honestly OFF until founder-ops deploys the service (P15).
