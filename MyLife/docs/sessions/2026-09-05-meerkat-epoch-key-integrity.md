# Meerkat security: durable issuer key consistency

Date: 2026-09-05. Follow-through on account-service integrity and S2 recovery. Local work only; no deployment, commit, push or database migration in this session. Prior remediation and concurrent workspace edits were preserved.

## Fixed

The account service previously trusted a locally generated signing key after an insert that can lose to another worker. Two workers could therefore return different public keys for the same epoch (credential validity period). A later request could sign under a different saved private key, producing an unusable pass after consuming its issuance quota. Separately, a crash after saving the private key but before publishing its public half left the period unavailable indefinitely. Existing public/private mismatches were not checked before issuance.

Three deterministic regressions reproduced those defects on the pre-fix service. All three now pass.

- `packages/meerkat-relay/src/account-service.ts`: always read back the key that won durable insertion; derive its public half; complete missing publication after interruption; confirm publication and reject any conflicting existing key before the issuance quota mutation. Published keys are never silently overwritten.
- `src/blind-credential-server.ts`: use Node's existing private/public key import and export functions, accepting only the issuer's RSA-2048 key parameters. Malformed, wrong-algorithm, unsupported-size/exponent or wrongly sealed keys fail closed. This is key handling in the existing Node adapter, not a new blind-signature protocol. [Node crypto reference](https://nodejs.org/docs/latest-v22.x/api/crypto.html#cryptocreatepublickeykey).
- `src/__tests__/account-epoch-keys.test.ts`, `src/__tests__/blind-credential-server.test.ts`, and `src/postgres/__tests__/account-store.integration.test.ts`: independent worker/store instances, restart, interrupted publication, dropped writes, mismatched publication, invalid keys and genuine blind-signature verification. The persisted winner survives and clients receive a pass that verifies under the public bridge key.

No client protocol or storage schema changed. Mobile and web both consume this same issuer. No account/persona identifier or credential serial mapping was added.

## Verification

| Check | Result |
|---|---|
| Pre-fix deterministic control | All 3 new regression cases fail |
| Focused service, HTTP, key lifecycle, crypto adapter and account privacy wall | 72 tests pass |
| Real PostgreSQL 16 account integration | 11 tests pass, including competing issuer workers and missing-publication recovery |
| Relay TypeScript | Pass |
| Required changed-function gate | Pass, including package and shared consumer typechecks |
| Full parity and generated-artifact checks | Pass |

Tests ran sequentially with one worker. PostgreSQL used an owned temporary cluster on loopback with a random port and a dedicated test database. The test database and cluster were stopped and removed. Evidence lives under ignored `.gstack/security-reports/2026-09-05-meerkat-epoch-key-integrity/`.

## Remaining

S2's borrowed-bearer renewal binding, complete credential loss/expired-period recovery and previously deleted issuance-history policy remain unresolved. The new repair prevents key inconsistency and recovers incomplete publication; it does not rotate an already conflicting published key or repair credentials already issued under a losing key. Such persisted conflicts return `not_configured` and require a reviewed recovery decision. Existing pending client requests blinded under the correct stored key can retry normally.

Physical-device/provider evidence and exact-candidate release acceptance from the audit remain outstanding. Security release status remains NO-GO.
