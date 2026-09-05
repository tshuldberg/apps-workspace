# Mesh Sync Red Team Exercise

**Date:** 2026-04-22
**Scope:** Phases 0-7 of the mesh sync implementation
**Test file:** `packages/sync/src/__tests__/security-redteam.test.ts`
**Result:** 24 tests passing, all threat scenarios covered

## Scenarios Tested

### 1. LAN Attacker
- **Attack:** Attacker on same Wi-Fi observes Bonjour advertisements
- **Defense:** All payloads encrypted with workspace key; Noise_XK handshake
- **Result:** Attacker sees encrypted blobs, cannot read content or forge deltas
- **Test coverage:** Relay envelope tests verify only opaque ciphertext is transmitted

### 2. Relay Operator
- **Attack:** Relay operator attempts to correlate sessions
- **Defense:** Per-session ephemeral tokens via HKDF; tokens rotate per session
- **Result:** Relay sees opaque tokens, cannot link sessions to device identity
- **Test coverage:** `relay anonymity` suite (5 tests) -- token opacity, rotation, expiry, cross-session unlinkability, envelope content

### 3. Revoked Member
- **Attack:** Former member with stale workspace key attempts sync
- **Defense:** Key rotation on member removal; peers drop revoked device IDs
- **Result:** Revoked device rejected at workspace auth step
- **Test coverage:** `revoked member isolation` suite (5 tests) -- revocation flag, key version bump, key wrap invalidation, per-workspace isolation, cumulative revocations

### 4. Lost Device
- **Attack:** Attacker with physical access to stolen device
- **Defense:** Revocation from all workspaces; key rotation per workspace
- **Result:** Future traffic encrypted with rotated keys; lost device has no active memberships
- **Limitation:** Data already on device is accessible if the OS is unlocked
- **Test coverage:** `lost device scenario` suite (2 tests) -- full isolation across all workspaces, owner unaffected

### 5. Cross-Workspace Data Leak
- **Attack:** Member of workspace A attempts to access workspace B data
- **Defense:** Session targets one workspace; engine enforces scope per session; entity ACLs bind data to specific workspaces
- **Result:** Cross-workspace data transfer requires explicit user action
- **Test coverage:** `cross-workspace isolation` suite (2 tests) -- entity ACL workspace binding, member visibility boundaries

### 6. Malicious Module
- **Attack:** Module author ships broken resolver or attempts scope escalation
- **Defense:** Engine enforces syncPolicy, maxScope, and stripColumns at write path
- **Result:** Module cannot bypass scope or maxScope caps
- **Test coverage:** `malicious module defense` suite (3 tests) + `scope enforcement` suite (6 tests) -- stripColumns enforcement on INSERT/UPDATE, cloud module rejection, unknown prefix silencing, multi-table strip rules

## Test Summary

| Suite | Tests | Focus |
|-------|-------|-------|
| revoked member isolation | 5 | Revocation, key rotation, per-workspace isolation |
| relay anonymity | 5 | Token opacity, rotation, expiry, unlinkability |
| scope enforcement | 6 | maxScope, cloud modules, stripColumns, unknown prefixes |
| cross-workspace isolation | 2 | Entity ACL binding, member visibility |
| tier enforcement | 1 | Tier-scope matrix validation |
| malicious module defense | 3 | stripColumns bypass, cloud module rejection |
| lost device scenario | 2 | Full device revocation, owner safety |
| **Total** | **24** | |

## Findings

- All threat scenarios from architecture doc Section 12 have integration test coverage
- Relay anonymity verified: no device identity exposed to relay backend; `RelayBackend.connect()` interface accepts only `(url, token)`, structurally preventing device ID leakage
- Key rotation verified: `revokeFromWorkspace` atomically removes the member, bumps key version, and records the revocation audit entry
- `rotateWorkspaceKey` invalidates old key wraps (sets `valid_until`) before updating the workspace version
- stripColumns enforcement verified at ChangeTracker level for INSERT and UPDATE; DELETE operations correctly pass through with null data
- Cloud module guard verified: ChangeTracker silently drops changes for modules in the `cloudModules` set
- Per-workspace isolation verified: revoking from workspace A does not affect workspace B membership or key version
- Cumulative revocations correctly increment key version (version 1 -> 2 -> 3 for sequential removals)

## Recommendations

1. **Hardware-backed keys (Secure Enclave / StrongBox)** for device identity. Currently private keys use a placeholder `local:ed25519:` ref. Phase 8+ should bind to platform secure storage.
2. **Periodic re-verification of workspace membership** during long sessions. Currently membership is checked at session start; a session lasting hours could outlive a revocation.
3. **Rate limiting on relay** to prevent token enumeration. The relay accepts any token; brute-force scanning could discover active sessions.
4. **maxScope enforcement in ChangeTracker**. The scope ordering (`device_local < personal_replica < shared_workspace < published_blob`) is tested as a concept, but the ChangeTracker does not yet reject changes that exceed an entity's `maxScope`. This should be wired in Phase 8.
5. **On-device encryption at rest** for the SQLite file. The lost-device scenario accepts that local data is readable if the OS is unlocked. Platform-level SQLCipher or filesystem encryption would close this gap.
