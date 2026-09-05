# Feature Spec: Market Encryption Implementation

## Metadata
- **Module:** market
- **Priority Score:** 21 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 3 x3 + Complexity 1 x2 + CrossModule 2 x1 + PaidUser 2 x1
- **Sprint:** Sprint 2
- **Estimated CC Time:** 5-7 hours
- **Depends On:** Cloud client functions (market), UI screens (market)
- **Blocks:** None (encryption is a parallel enhancement to the existing messaging flow)

## Business Context

### Why This Feature Exists
MyMarket's spec (SPEC-mymarket.md) targets Signal-style end-to-end encrypted messaging as the secure communication layer between buyers and sellers. The module already has AES-GCM helpers in `encryption.ts` for passphrase-based encryption and Signal-style type definitions (SecureDevice, SignedPreKey, OneTimePreKey, SecureEnvelope, ConversationRequest) in `types.ts`. The cloud client already has `cloudRegisterSecureDevice`, `cloudGetRecipientPreKeyBundles`, `cloudGetSecureEnvelopes`, and `cloudSendSecureEnvelope`. What's missing is the actual Signal protocol client implementation that ties these together: the X3DH key agreement, Double Ratchet message encryption, session management, and the UI integration that makes encrypted messaging transparent to users.

This is the privacy differentiator against Facebook Marketplace. Meta reads all Marketplace messages. MyMarket's encrypted messaging means the server stores only ciphertext. Even if Supabase is compromised, message content remains private.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Facebook Marketplace | No | N/A | Messenger is NOT E2E encrypted by default for Marketplace conversations |
| OfferUp | No | N/A | In-app messaging, not encrypted, platform can read all messages |
| Signal | Yes (different product) | No | Gold standard: X3DH + Double Ratchet, open source, audited |
| WhatsApp | Yes | No | Signal Protocol for personal messages, metadata collected |
| Craigslist | No | N/A | Email relay only, no in-app messaging |

### Target User
Privacy-conscious buyers and sellers who don't want their negotiation messages readable by the platform, advertisers, or data brokers. Users who left Facebook specifically because of data harvesting.

## Technical Context

### Where This Lives in MyLife

```
modules/market/src/
  encryption.ts              -- Existing AES-GCM helpers (keep as fallback)
  crypto/
    x3dh.ts                  -- X3DH key agreement (initial session setup)
    double-ratchet.ts         -- Double Ratchet message encryption/decryption
    session-store.ts          -- Local session state persistence (SQLite)
    key-manager.ts            -- Prekey generation, rotation, and upload
    secure-messaging.ts       -- High-level API tying x3dh + ratchet + cloud together
    types.ts                  -- Crypto-specific internal types
    index.ts                  -- Barrel export
  db/
    schema.ts                 -- Add mk_sessions_cache, mk_identity_keys tables
```

### Wireframe Position

```
Hub Dashboard
  └── MyMarket card
       └── Messages tab
            └── Chat Thread
                 └── [Encryption shield icon] "End-to-end encrypted" ← YOU ARE HERE
```

Encryption is invisible to users by default. The only UI indicator is a small shield icon and "Messages are end-to-end encrypted" label in the chat thread header.

### Data Model

New local SQLite cache tables for session state:

```sql
-- Local identity key pair (one per device, never sent to server)
CREATE TABLE IF NOT EXISTS mk_identity_keys (
  id TEXT PRIMARY KEY DEFAULT 'local',
  public_key TEXT NOT NULL,
  private_key TEXT NOT NULL,
  registration_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Session state per conversation + device pair
CREATE TABLE IF NOT EXISTS mk_sessions_cache (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  remote_device_id TEXT NOT NULL,
  session_data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Prekey state tracking
CREATE TABLE IF NOT EXISTS mk_prekeys_cache (
  id INTEGER PRIMARY KEY,
  key_type TEXT NOT NULL CHECK (key_type IN ('signed', 'onetime', 'pq_onetime', 'pq_last_resort')),
  public_key TEXT NOT NULL,
  private_key TEXT NOT NULL,
  is_uploaded BOOLEAN NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Cloud tables already exist (from types.ts):
- `mk_secure_devices` -- Device registration with identity keys
- `mk_signed_prekeys` -- Signed prekeys per device
- `mk_one_time_prekeys` -- One-time prekeys per device
- `mk_secure_envelopes` -- Encrypted message envelopes

### Dependencies
- **Internal:** `@mylife/market` (cloud client secure messaging functions, types), `@mylife/db` (DatabaseAdapter for local session storage)
- **External:** Web Crypto API (SubtleCrypto for ECDH, HKDF, AES-GCM), no external crypto libraries needed (all primitives available in Web Crypto)
- **Cross-Module:** `@mylife/social` (conversation requests use social friend links for trust bootstrapping)

## Functional Requirements

### User Stories
1. As a buyer, I want my messages to the seller to be encrypted so the platform can't read them.
2. As a user, I want encryption to work automatically without any manual key management.
3. As a user, I want to verify that my conversation is secure via a safety number comparison.
4. As a user, I want my encryption keys to be generated and stored on-device, never uploaded in plaintext.

### Behavior Specification

**First-Time Setup (automatic, per device):**
1. On first Market module activation, generate identity key pair (Curve25519).
2. Generate signed prekey (rotated every 30 days).
3. Generate batch of 100 one-time prekeys.
4. Register device with cloud (`cloudRegisterSecureDevice`).
5. Upload signed prekey and one-time prekeys to server.
6. Store private keys locally in `mk_identity_keys` and `mk_prekeys_cache`.

**Starting a New Conversation (X3DH Key Agreement):**
1. Buyer taps "Message Seller" on a listing.
2. System creates a conversation request (`cloudCreateConversationRequest`).
3. Fetch recipient's prekey bundle (`cloudGetRecipientPreKeyBundles`).
4. Perform X3DH key agreement using recipient's identity key, signed prekey, and one-time prekey.
5. Derive initial root key and chain keys.
6. Initialize Double Ratchet session.
7. Encrypt first message with session keys.
8. Send as `SecureEnvelope` with type `prekey_signal_message`.

**Sending a Message (Double Ratchet):**
1. Load existing session state from `mk_sessions_cache`.
2. Perform ratchet step (advance sending chain).
3. Encrypt message body with derived message key (AES-256-GCM).
4. Package as `SecureEnvelope` (conversation_id, sender/recipient device IDs, ciphertext).
5. Send via `cloudSendSecureEnvelope`.
6. Update local session state.

**Receiving a Message:**
1. Fetch new envelopes from cloud (`cloudGetSecureEnvelopes`).
2. For `prekey_signal_message` (first message): perform X3DH from responder side, initialize session.
3. For `signal_message` (subsequent): load session, advance receiving chain.
4. Decrypt ciphertext with derived message key.
5. Display plaintext in chat thread.
6. Update local session state.
7. Mark envelope as delivered.

**Safety Number Verification:**
1. User taps shield icon in chat header.
2. System displays a numeric safety number (derived from both parties' identity keys).
3. Users can compare numbers out-of-band (phone call, in person) to verify no MITM.
4. Optional: QR code scanning for quick comparison.

### Edge Cases
- Recipient's one-time prekeys exhausted: fall back to identity key + signed prekey only (less forward secrecy for initial message)
- Recipient has multiple devices: encrypt and send to each device separately
- Session state corrupted/lost: re-establish session via new prekey message
- Device change: new identity key triggers safety number change notification
- Offline messages: envelopes queue on server, decrypted on next sync
- Very long message (>2000 chars): chunk or reject at input validation layer (per existing MessageSchema)
- Web Crypto unavailable (very old browser): fall back to existing AES-GCM passphrase encryption with clear warning
- Key rotation during active conversation: Double Ratchet handles this automatically (new DH ratchet step)

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Messages encrypt/decrypt transparently; users see plaintext in their chat thread
- [ ] **AC-2:** Shield icon + "End-to-end encrypted" label visible in chat thread header
- [ ] **AC-3:** Safety number screen accessible by tapping shield icon
- [ ] **AC-4:** New conversation bootstraps automatically without manual key exchange
- [ ] **AC-5:** Messages work across devices (each device has its own session)

### Technical Criteria
- [ ] **TC-1:** Private keys stored only in local SQLite, never sent to server
- [ ] **TC-2:** X3DH key agreement produces shared secret from identity + signed + one-time prekeys
- [ ] **TC-3:** Double Ratchet provides forward secrecy (compromised key doesn't expose past messages)
- [ ] **TC-4:** Each message encrypted with unique message key (never reused)
- [ ] **TC-5:** Server stores only ciphertext envelopes (no plaintext message content)
- [ ] **TC-6:** One-time prekeys consumed on use and replenished when count drops below 20
- [ ] **TC-7:** Signed prekey rotated every 30 days
- [ ] **TC-8:** Safety numbers derived deterministically from both identity keys (reproducible)
- [ ] **TC-9:** All crypto operations use Web Crypto API (SubtleCrypto), no external crypto libraries
- [ ] **TC-10:** Session state persisted in mk_sessions_cache (survives app restart)

### Negative Criteria
- [ ] **NC-1:** Must NOT send plaintext message bodies to the server
- [ ] **NC-2:** Must NOT upload private keys to any cloud service
- [ ] **NC-3:** Must NOT reuse message encryption keys
- [ ] **NC-4:** Must NOT claim "Signal-equivalent" until safety code verification and device-change handling ship (per SPEC-mymarket.md)
- [ ] **NC-5:** Must NOT break existing AES-GCM encryption (keep as fallback)

## UI Specification

### Mobile (Expo)
- Shield icon: small lock/shield icon in chat thread header, tinted with module accent `#14B8A6`
- "End-to-end encrypted" label: textSecondary `rgba(240,240,245,0.65)`, small font below thread title
- Safety number screen: full-screen modal showing 60-digit numeric code in groups of 5, QR code below
- No other UI changes; encryption is invisible to users during normal messaging

### Web (Next.js)
- Same shield icon and label in chat thread header
- Safety number page: centered card with numeric code and QR code
- Fallback banner: if Web Crypto unavailable, show amber warning "Encrypted messaging unavailable in this browser"

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Initializing | Brief "Setting up encryption..." in chat | First message in new conversation |
| Encrypted | Shield icon + "End-to-end encrypted" | Normal encrypted conversation |
| Fallback | Warning banner: "Using basic encryption" | Web Crypto unavailable |
| Key Changed | Info banner: "Safety number changed" | Recipient registered new device |
| Verified | Green checkmark on shield | Safety number manually verified |

## Test Requirements

### Unit Tests
- [ ] X3DH key agreement: produces matching shared secret on both sides
- [ ] X3DH without one-time prekey: falls back to identity + signed prekey only
- [ ] Double Ratchet: encrypt then decrypt roundtrip produces original plaintext
- [ ] Double Ratchet: out-of-order messages decrypt correctly (within window)
- [ ] Double Ratchet: forward secrecy (old keys cannot decrypt new messages)
- [ ] Key manager: generates correct number of prekeys
- [ ] Key manager: detects low prekey count and triggers replenishment
- [ ] Safety number: deterministic from same key pair
- [ ] Safety number: changes when either identity key changes
- [ ] Session store: persists and retrieves session state from SQLite

### Integration Tests
- [ ] Full flow: device setup -> prekey upload -> start conversation -> X3DH -> encrypted message roundtrip
- [ ] Multi-device: message encrypted separately for each recipient device
- [ ] Session recovery: delete local session -> next received prekey message re-establishes session
- [ ] Key rotation: signed prekey rotation doesn't break existing sessions

### QA Verification Script

1. Open Market module, navigate to Messages
2. Start a new conversation with a seller
3. Send a message -- verify it appears in chat -- AC-1
4. Verify shield icon + "End-to-end encrypted" label in header -- AC-2
5. Tap shield icon -- verify safety number screen appears -- AC-3
6. Verify conversation started without manual key setup -- AC-4
7. Check Supabase mk_secure_envelopes table -- verify only ciphertext stored, no plaintext -- TC-5
8. Check local SQLite mk_identity_keys -- verify private key exists locally -- TC-1
9. Send 5 messages -- check each mk_secure_envelopes row has different ciphertext -- TC-4
10. Switch to second device, open same conversation
11. Verify messages readable on second device -- AC-5
12. On the first device, verify "Safety number changed" banner if second device is new -- State Coverage
13. Compare safety numbers on both devices -- verify they match -- TC-8

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- Complexity=1. Run on this spec BEFORE building.

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for X3DH and Double Ratchet logic

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- AES-GCM passphrase encryption exists in `encryption.ts` (symmetric, requires shared passphrase)
- Signal-style type definitions exist in `types.ts` (SecureDevice, SignedPreKey, OneTimePreKey, SecureEnvelope)
- Cloud client has 5 secure messaging functions (register device, get bundles, send/get envelopes, create request)
- No actual protocol implementation exists (X3DH, Double Ratchet, session management)

### After This Work
Full Signal-style E2E encryption pipeline: X3DH key agreement, Double Ratchet messaging, local session persistence, automatic key management, and safety number verification. Messages are encrypted client-side, server stores only ciphertext.

### Files Changed
- `modules/market/src/crypto/x3dh.ts` -- X3DH key agreement implementation
- `modules/market/src/crypto/double-ratchet.ts` -- Double Ratchet message encryption
- `modules/market/src/crypto/session-store.ts` -- SQLite session persistence
- `modules/market/src/crypto/key-manager.ts` -- Prekey generation, rotation, upload
- `modules/market/src/crypto/secure-messaging.ts` -- High-level encrypt/decrypt API
- `modules/market/src/crypto/types.ts` -- Internal crypto types
- `modules/market/src/crypto/index.ts` -- Barrel export
- `modules/market/src/db/schema.ts` -- Add mk_identity_keys, mk_sessions_cache, mk_prekeys_cache
- `modules/market/src/definition.ts` -- Add V3 migration for new cache tables
- `modules/market/src/index.ts` -- Export crypto module
- `modules/market/src/__tests__/crypto.test.ts` -- X3DH + Double Ratchet tests

### Known Limitations
- Post-quantum prekeys (Kyber1024) defined in types but not implemented (deferred to future spec)
- Sealed sender (hide sender identity from server) not implemented in MVP
- Attachment encryption not included (text messages only)
- Group conversations not supported (1:1 only)
- No key backup/recovery mechanism (lost device = lost session state, but new sessions can be established)

### Context for Next Agent
The type definitions in types.ts are extensive and already cover the Signal protocol data model. Use Web Crypto API exclusively (no libsignal or other external crypto). The cloud client functions for secure messaging already exist; you're implementing the client-side protocol that generates the data those functions transport. Keep the existing AES-GCM encryption.ts as a fallback path.
