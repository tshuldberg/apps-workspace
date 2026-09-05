# MyLife P2P Sync Specification

> **Spec Version:** 1.0
> **Last Updated:** 2026-03-11
> **Status:** Draft
> **Author:** Claude (research) + Trey (direction)
> **Scope:** Cross-device peer-to-peer data sync for all 27 MyLife modules, hub tables, and blob storage

---

## 1. Product Overview

### 1.1 What This Is

MyLife P2P Sync is a device-to-device data synchronization system that lets users keep their MyLife data in sync across phone, tablet, laptop, and desktop without any cloud server ever seeing their data.

It draws directly from BitTorrent's peer-to-peer model: your devices "seed" your data to each other. Changes propagate through your personal device mesh. No central server stores your data. No company can read your budget, your health records, or your journal.

### 1.2 Why This Matters

MyLife's privacy promise today is: "your data stays on your device." That's true, but it also means your data is trapped on one device. If you lose your phone, you lose everything. If you want to use MyLife on your laptop and your phone, you can't.

Every competitor solves this with cloud sync, which means a server somewhere has a copy of your data. iCloud, Google Drive, Firebase, Supabase -- they all require trusting a third party with your most personal information.

P2P sync solves multi-device without breaking the privacy promise. Your data travels directly between your devices, encrypted end-to-end. The math guarantees that no intermediary can read it. Not us, not your ISP, not anyone.

### 1.3 The BitTorrent Parallel

| BitTorrent Concept | MyLife P2P Equivalent |
|---|---|
| Torrent file / magnet link | Module sync manifest (content-addressed hash of module state) |
| Seeder | Any device with current data that is online |
| Leecher | Any device that needs to catch up on changes |
| Piece selection (rarest-first) | CRDT operation exchange (send what the peer is missing) |
| Swarm | Your personal device mesh (3-5 devices, all yours) |
| Tracker | Signaling server (finds your devices, sees zero data) |
| DHT | mDNS local discovery (finds devices on same WiFi, no server) |
| Choking/unchoking | Sync priority (active module syncs first, background modules queue) |
| Info-hash | SHA-256 content address of each data block |
| Piece verification | Merkle tree verification of sync integrity |

### 1.4 Elevator Pitch

> "MyLife syncs your data between your devices without ever touching a server. Like BitTorrent, but for your personal data. Your phone seeds to your laptop. Your laptop seeds to your tablet. End-to-end encrypted. We literally cannot see your data, because it never passes through us."

---

## 2. Architecture

### 2.1 Layer Stack

```
┌─────────────────────────────────────────────────────────────┐
│  Application Layer                                           │
│  MyLife App (Expo mobile / Next.js web)                      │
│  27 modules, each producing structured data + optional blobs │
├─────────────────────────────────────────────────────────────┤
│  Sync Engine Layer                                           │
│  - Change tracker: monitors SQLite writes per module         │
│  - CRDT manager: wraps module data in Automerge documents    │
│  - Blob manager: content-addressed store for media/files     │
│  - Conflict resolver: CRDT-native, automatic, deterministic  │
├─────────────────────────────────────────────────────────────┤
│  Transport Layer                                             │
│  - LAN: mDNS discovery + direct TCP/WebSocket                │
│  - WAN: WebRTC data channels (STUN/TURN for NAT traversal)  │
│  - Background: push notification triggers (APNs/FCM)         │
├─────────────────────────────────────────────────────────────┤
│  Encryption Layer                                            │
│  - Transport: Noise Protocol Framework (NK pattern)          │
│  - Data at rest: XChaCha20-Poly1305                          │
│  - Key exchange: X25519 Diffie-Hellman                       │
│  - Device identity: Ed25519 signing keypair                  │
├─────────────────────────────────────────────────────────────┤
│  Storage Layer                                               │
│  - expo-sqlite / better-sqlite3 (relational queries)         │
│  - Automerge binary documents (sync state per module)        │
│  - Content-addressed blob store (SHA-256 keyed files)        │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

```
User edits budget on Phone
        │
        ▼
SQLite write (bg_transactions INSERT)
        │
        ▼
Change tracker detects write to module "budget"
        │
        ▼
CRDT manager records operation in Automerge document for "budget"
        │
        ▼
Sync engine checks: any peers online?
        │
    ┌───┴───┐
    │       │
  LAN?    WAN?
    │       │
    ▼       ▼
  mDNS    WebRTC
  scan    signaling
    │       │
    ▼       ▼
  Direct   ICE
  TCP      negotiation
    │       │
    └───┬───┘
        │
        ▼
Automerge sync protocol exchanges missing operations
        │
        ▼
Laptop receives operations, applies to its Automerge doc
        │
        ▼
Laptop's sync engine writes changes to its SQLite (bg_transactions INSERT)
        │
        ▼
Laptop UI reactively updates
```

### 2.3 The Dual-Write Pattern

MyLife already uses SQLite for all data. P2P sync does NOT replace SQLite. Instead, it adds a parallel CRDT layer:

```typescript
// When the user creates a budget transaction:

// 1. Write to SQLite (fast local queries, existing code unchanged)
db.execute(
  'INSERT INTO bg_transactions (id, amount, ...) VALUES (?, ?, ...)',
  [id, amount, ...]
);

// 2. Record in CRDT (for sync)
syncEngine.recordChange('budget', {
  table: 'bg_transactions',
  operation: 'INSERT',
  row: { id, amount, ... },
  timestamp: Date.now(),
  deviceId: thisDevice.id,
});
```

This means:
- **Existing module code does not change.** All 27 modules keep using SQLite exactly as they do today.
- **Sync is additive.** It's a new package (`@mylife/sync`) that hooks into the database layer.
- **Queries stay fast.** SQLite handles reads. Automerge handles sync. Each does what it's best at.

---

## 3. Device Identity and Pairing

### 3.1 Device Identity

Each device generates a permanent identity on first launch:

```typescript
interface DeviceIdentity {
  /** Ed25519 public key, used as device ID */
  publicKey: Uint8Array;       // 32 bytes
  /** Ed25519 private key, stored in secure enclave / keychain */
  privateKey: Uint8Array;      // 64 bytes
  /** Human-readable device name */
  displayName: string;         // e.g., "Trey's iPhone", "MacBook Pro"
  /** X25519 public key for Diffie-Hellman key agreement */
  dhPublicKey: Uint8Array;     // 32 bytes
  /** Created timestamp */
  createdAt: string;           // ISO 8601
}
```

**Key storage:**
- iOS: Keychain Services (kSecClassKey, kSecAttrAccessibleAfterFirstUnlock)
- Android: Android Keystore (hardware-backed where available)
- Web: IndexedDB with Web Crypto API non-extractable keys

### 3.2 Device Pairing

Two devices pair by exchanging public keys via QR code scan or short numeric code:

**QR Code Flow (primary):**
1. Device A displays a QR code containing: `{ publicKey, dhPublicKey, displayName, localIP?, pairingNonce }`
2. Device B scans the QR code
3. Device B sends its own identity to Device A (over LAN if same network, or via signaling server)
4. Both devices derive a shared secret via X25519(dhPrivateA, dhPublicB)
5. Both devices store each other's identity in `sync_paired_devices` table
6. Pairing is complete. Future connections authenticate via Ed25519 signatures.

**Numeric Code Flow (fallback, for when camera is unavailable):**
1. Device A displays a 6-digit code and its public key fingerprint
2. User types the 6-digit code on Device B
3. Devices connect via signaling server, verify the code matches
4. PAKE (Password-Authenticated Key Exchange, specifically SPAKE2) derives a shared secret from the code
5. Devices exchange public keys over the PAKE-encrypted channel

### 3.3 Paired Devices Table

```sql
CREATE TABLE IF NOT EXISTS sync_paired_devices (
  device_id TEXT PRIMARY KEY NOT NULL,      -- Ed25519 public key (hex)
  display_name TEXT NOT NULL,
  dh_public_key TEXT NOT NULL,              -- X25519 public key (hex)
  shared_secret TEXT NOT NULL,              -- Derived symmetric key (encrypted at rest)
  last_seen_at TEXT,
  last_sync_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  paired_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 4. Sync Protocol

### 4.1 Module Sync Documents

Each module's data is wrapped in an Automerge document:

```typescript
interface ModuleSyncDocument {
  moduleId: ModuleId;          // 'books', 'budget', etc.
  schemaVersion: number;       // matches module migration version
  tables: {
    [tableName: string]: {
      [rowId: string]: Record<string, unknown>;
    };
  };
  blobRefs: {
    [blobId: string]: {
      hash: string;            // SHA-256 of blob content
      size: number;
      mimeType: string;
      createdAt: string;
    };
  };
  metadata: {
    lastModifiedAt: string;
    lastModifiedByDevice: string;
    changeCount: number;
  };
}
```

### 4.2 Change Tracking

The sync engine hooks into the DatabaseAdapter to track changes:

```typescript
interface ChangeRecord {
  id: string;                  // ULID
  moduleId: ModuleId;
  table: string;               // e.g., 'bg_transactions'
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  rowId: string;               // primary key of affected row
  data: Record<string, unknown> | null; // row data (null for DELETE)
  deviceId: string;
  timestamp: number;           // monotonic clock
  synced: boolean;             // has this been sent to all peers?
}
```

Change tracking table:

```sql
CREATE TABLE IF NOT EXISTS sync_change_log (
  id TEXT PRIMARY KEY NOT NULL,
  module_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  row_id TEXT NOT NULL,
  data_json TEXT,
  device_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  synced INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS sync_change_log_unsynced_idx
  ON sync_change_log (synced, timestamp ASC);

CREATE INDEX IF NOT EXISTS sync_change_log_module_idx
  ON sync_change_log (module_id, timestamp ASC);
```

### 4.3 Sync Session Protocol

When two devices connect:

```
Device A                          Device B
   │                                 │
   │──── HELLO(deviceId, nonce) ────>│
   │                                 │
   │<─── HELLO(deviceId, nonce) ─────│
   │                                 │
   │  [Mutual auth via Ed25519 signatures over nonces]
   │  [Derive session key via X25519 + HKDF]
   │                                 │
   │──── SYNC_STATE(moduleStates) ──>│
   │     { budget: v42, books: v18 } │
   │                                 │
   │<─── SYNC_STATE(moduleStates) ───│
   │     { budget: v40, books: v19 } │
   │                                 │
   │  [Compare: budget A>B, books B>A]
   │                                 │
   │──── CHANGES(budget, v40..v42) ─>│
   │     [Automerge sync messages]   │
   │                                 │
   │<─── CHANGES(books, v18..v19) ───│
   │     [Automerge sync messages]   │
   │                                 │
   │──── ACK(budget: v42) ──────────>│
   │                                 │
   │<─── ACK(books: v19) ────────────│
   │                                 │
   │  [If blobs referenced, transfer blob data]
   │                                 │
   │──── BLOB_OFFER(hash, size) ────>│
   │                                 │
   │<─── BLOB_REQUEST(hash) ─────────│
   │                                 │
   │──── BLOB_DATA(hash, chunks) ───>│
   │                                 │
   │<─── BLOB_ACK(hash) ────────────│
   │                                 │
   │──── DONE ──────────────────────>│
   │<─── DONE ──────────────────────│
```

### 4.4 Conflict Resolution

CRDTs handle conflicts automatically. Specific strategies per data type:

| Data Pattern | CRDT Strategy | Example |
|---|---|---|
| Single-value fields | Last-Writer-Wins Register (LWW) | Budget transaction amount edited on two devices |
| Collections (rows) | Add-Wins Set | Adding books to library on two devices simultaneously |
| Counters | G-Counter / PN-Counter | Reading session page count, fast timer elapsed |
| Ordered lists | RGA (Replicated Growable Array) | Recipe ingredient order |
| Rich text | Peritext / Yjs Text CRDT | Journal entries, notes |
| Deletion | Tombstone with TTL | Deleted budget transaction stays tombstoned for 30 days |

**Conflict visibility:** While CRDTs auto-resolve, users can optionally view a "Sync History" screen showing recent merges, especially for LWW conflicts where one value "won":

```
Sync History
─────────────
Mar 11, 10:42 AM
  Budget: "Groceries" amount changed on both devices
  Kept: $47.23 (from iPhone, 10:41 AM)
  Discarded: $45.00 (from MacBook, 10:40 AM)
```

---

## 5. Transport Layer

### 5.1 LAN Transport (Phase 1)

**Discovery:** mDNS/DNS-SD (Bonjour)

```typescript
// Service advertisement
const SERVICE_TYPE = '_mylife-sync._tcp';
const SERVICE_PORT = 42424;

// Advertise this device
mdns.advertise({
  type: SERVICE_TYPE,
  port: SERVICE_PORT,
  txt: {
    deviceId: identity.publicKeyHex.slice(0, 16), // fingerprint
    version: '1',
  },
});

// Discover peers
mdns.browse(SERVICE_TYPE, (peer) => {
  if (isPairedDevice(peer.txt.deviceId)) {
    connectToPeer(peer.address, peer.port);
  }
});
```

**Connection:** Direct TCP with Noise Protocol encryption

- Device A connects to Device B's advertised IP:port
- Noise NK handshake (Device A knows Device B's static public key from pairing)
- All subsequent data encrypted with the session key
- Bidirectional sync over the encrypted channel

**React Native libraries:**
- `react-native-zeroconf` for mDNS
- `react-native-tcp-socket` for TCP connections
- Custom Noise Protocol implementation or `noise-protocol` npm package

### 5.2 WAN Transport (Phase 2)

**Discovery:** WebSocket signaling server

```typescript
// Signaling server (minimal Node.js service)
// Sees: device fingerprints, encrypted SDP/ICE candidates
// Does NOT see: any user data, module contents, sync payloads

interface SignalingMessage {
  from: string;        // device fingerprint (first 16 chars of public key)
  to: string;          // target device fingerprint
  payload: string;     // encrypted SDP offer/answer or ICE candidate
}
```

**Connection:** WebRTC data channels

1. Device A sends encrypted SDP offer to signaling server, addressed to Device B's fingerprint
2. Signaling server relays to Device B (if online)
3. Device B decrypts, generates SDP answer, sends back via signaling server
4. ICE candidates exchanged (STUN for NAT traversal)
5. Direct WebRTC data channel established
6. Signaling server is no longer involved
7. All sync data flows directly between devices

**NAT Traversal Stack:**
1. Try direct connection (both on public IPs) -- ~5% of cases
2. Try STUN-assisted UDP hole punching -- ~70% of cases
3. Try TCP hole punching -- ~10% additional cases
4. Fall back to TURN relay -- remaining ~15% of cases

**STUN servers:** Use public servers (Google: `stun:stun.l.google.com:19302`, or self-hosted)
**TURN server:** Self-hosted `coturn` instance. Sees encrypted data only. Cost: $5-10/month on a small VPS.

### 5.3 Background Sync (Phase 2)

**The iOS problem:** iOS kills background connections after ~30 seconds. P2P requires both devices online simultaneously.

**Solution: Push-triggered sync**

```
Device A makes a change
        │
        ▼
Sync engine creates encrypted notification:
  encrypt(sharedKey, { moduleId: 'budget', changeCount: 3, timestamp })
        │
        ▼
Sends to Push Relay Server:
  POST /notify { deviceToken: B_token, payload: <encrypted blob> }
        │
        ▼
Push Relay forwards via APNs/FCM to Device B
  (Relay sees: device token + opaque encrypted bytes. Zero user data.)
        │
        ▼
Device B receives push notification
        │
        ▼
iOS grants ~30 seconds of background execution
        │
        ▼
Device B connects to Device A via WebRTC
        │
        ▼
Automerge sync completes (typical: <1 second for KB-sized changes)
        │
        ▼
Device B goes back to sleep
```

**Push Relay Server specification:**

```typescript
// Entire server is ~100 lines
interface PushRelayConfig {
  maxPayloadSize: 4096;        // bytes, encrypted notification payload
  maxDevicesPerUser: 10;
  notificationTTL: 86400;      // 24 hours, then discard
  rateLimitPerDevice: 60;      // max notifications per hour
}

// Endpoints
POST /register    { deviceFingerprint, pushToken, platform }
POST /notify      { targetFingerprint, encryptedPayload }
DELETE /register  { deviceFingerprint }

// Storage: in-memory map of fingerprint -> pushToken
// No persistent storage of user data. No database.
// Server can be restarted at any time with zero data loss.
```

### 5.4 Local Discovery Methods (Phase 3)

| Method | Range | Platform Support | Use Case |
|---|---|---|---|
| mDNS/Bonjour | Same WiFi network | iOS, Android, macOS, Windows, Linux | Primary LAN discovery |
| Bluetooth LE | ~10-30 meters | iOS, Android | Device pairing, small data sync |
| WiFi Direct | ~200 meters | Android (good), iOS (limited) | High-bandwidth local sync without router |
| Multipeer Connectivity | ~30 meters | iOS/macOS only | Apple ecosystem local sync |

---

## 6. Encryption Specification

### 6.1 Cryptographic Primitives

| Purpose | Algorithm | Key Size | Library |
|---|---|---|---|
| Device identity signing | Ed25519 | 256-bit | tweetnacl / libsodium |
| Key agreement | X25519 | 256-bit | tweetnacl / libsodium |
| Symmetric encryption | XChaCha20-Poly1305 | 256-bit key, 192-bit nonce | tweetnacl / libsodium |
| Key derivation | HKDF-SHA-256 | Variable | Web Crypto API / node:crypto |
| Content hashing | SHA-256 | 256-bit | Web Crypto API / node:crypto |
| Password-authenticated key exchange | SPAKE2 | 256-bit | spake2-js |

### 6.2 Key Hierarchy

```
Master Identity Key (Ed25519)
  │
  ├── Device Signing Key (Ed25519, same as identity)
  │     Used for: signing sync messages, authenticating to peers
  │
  ├── Device DH Key (X25519, derived from Ed25519 seed)
  │     Used for: Diffie-Hellman key agreement during pairing
  │
  └── Per-Peer Shared Secret (X25519 output + HKDF)
        │
        ├── Transport Encryption Key (HKDF-derived, rotated per session)
        │     Used for: encrypting sync protocol messages
        │
        ├── Push Notification Key (HKDF-derived, static per peer pair)
        │     Used for: encrypting push relay payloads
        │
        └── Blob Encryption Key (HKDF-derived, static per peer pair)
              Used for: encrypting blob transfers
```

### 6.3 Threat Model

| Threat | Mitigation |
|---|---|
| Signaling server compromise | Server sees only encrypted SDP/ICE. Cannot read sync data. |
| Push relay compromise | Relay sees only encrypted opaque payloads. Cannot read content. |
| TURN relay eavesdropping | All data encrypted end-to-end before reaching TURN. Relay sees ciphertext. |
| ISP/WiFi snooping | Transport encryption (Noise/DTLS). All payloads are ciphertext. |
| Stolen device | Device keys in secure enclave/keychain. App data encrypted at rest. Revoke device from another paired device. |
| MITM during pairing | QR code exchange is out-of-band. Numeric code uses SPAKE2 (PAKE). Both resist MITM. |
| Compromised long-term key | Session keys derived via ephemeral DH. Past sessions have forward secrecy. |

### 6.4 Device Revocation

When a device is lost or compromised:

1. User opens MyLife on any remaining paired device
2. Goes to Settings > Sync > Paired Devices
3. Taps "Remove Device" on the lost device
4. The removed device's entry is marked `is_active = 0` in `sync_paired_devices`
5. A revocation record is created and synced to all remaining devices
6. All remaining devices re-derive shared secrets excluding the revoked device
7. The revoked device can no longer authenticate to any peer

```sql
CREATE TABLE IF NOT EXISTS sync_device_revocations (
  device_id TEXT PRIMARY KEY NOT NULL,
  revoked_by_device_id TEXT NOT NULL,
  reason TEXT,
  revoked_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 7. Blob Sync (Content-Addressed Storage)

### 7.1 What Counts as a Blob

| Module | Blob Types | Typical Size |
|---|---|---|
| Books | Cover images, ePub files | 100KB - 50MB |
| Budget | Receipt photos | 1-5MB |
| Health | Medical document scans | 1-10MB |
| Journal | Photo attachments | 1-10MB |
| Nutrition | Food photos (AI analysis) | 1-5MB |
| Pets | Pet photos | 1-5MB |
| Recipes | Recipe photos | 1-5MB |
| Workouts | Form recording videos | 10-100MB |
| Voice | Audio recordings | 1-50MB |

### 7.2 Content-Addressed Store

```typescript
interface BlobStore {
  /** Store a blob, returns its content address */
  put(data: Uint8Array, mimeType: string): Promise<BlobRef>;

  /** Retrieve a blob by its content address */
  get(hash: string): Promise<Uint8Array | null>;

  /** Check if a blob exists locally */
  has(hash: string): Promise<boolean>;

  /** List all blob refs for a module */
  listByModule(moduleId: ModuleId): Promise<BlobRef[]>;

  /** Delete a blob (only if no module references it) */
  prune(hash: string): Promise<void>;
}

interface BlobRef {
  hash: string;        // SHA-256 hex
  size: number;        // bytes
  mimeType: string;
  storedAt: string;    // ISO 8601
}
```

**Storage layout:**

```
~/.mylife/blobs/
  ab/
    ab3f7c8d9e...  (first 2 chars as directory, rest as filename)
  cd/
    cd1a2b3c4d...
```

### 7.3 Blob Sync Protocol

Blobs sync separately from CRDT data, using a BitTorrent-inspired block transfer:

1. CRDT sync completes first (module metadata, including blob refs)
2. Receiving device checks which blob hashes it's missing
3. Requests missing blobs from the peer
4. Large blobs are chunked (256KB blocks)
5. Each block is verified against a Merkle tree
6. Blocks can be requested out of order (like BitTorrent pieces)
7. Multiple blobs can transfer in parallel

**Sync priority:**
- Thumbnails and small images: sync immediately
- Large files (ePubs, videos): sync on WiFi only, or on user request
- Users can configure per-module blob sync policy (always / WiFi only / manual)

### 7.4 Blob Sync Settings

```sql
CREATE TABLE IF NOT EXISTS sync_blob_policy (
  module_id TEXT PRIMARY KEY NOT NULL,
  policy TEXT NOT NULL DEFAULT 'wifi_only'
    CHECK (policy IN ('always', 'wifi_only', 'manual', 'never')),
  max_blob_size_bytes INTEGER DEFAULT 52428800,  -- 50MB default
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 8. Database Schema Additions

### 8.1 New Hub Tables (sync_ prefix)

All sync tables use the `sync_` prefix, consistent with the hub table prefix convention.

```sql
-- Device identity (one row, this device)
CREATE TABLE IF NOT EXISTS sync_device_identity (
  id TEXT PRIMARY KEY NOT NULL CHECK (id = 'self'),
  public_key TEXT NOT NULL,
  private_key_ref TEXT NOT NULL,  -- keychain/keystore reference, NOT raw key
  dh_public_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Paired devices
CREATE TABLE IF NOT EXISTS sync_paired_devices (
  device_id TEXT PRIMARY KEY NOT NULL,
  display_name TEXT NOT NULL,
  dh_public_key TEXT NOT NULL,
  shared_secret_ref TEXT NOT NULL,  -- keychain/keystore reference
  last_seen_at TEXT,
  last_sync_at TEXT,
  last_sync_module TEXT,
  bytes_sent INTEGER NOT NULL DEFAULT 0,
  bytes_received INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  paired_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Change log for outbound sync
CREATE TABLE IF NOT EXISTS sync_change_log (
  id TEXT PRIMARY KEY NOT NULL,
  module_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  row_id TEXT NOT NULL,
  data_json TEXT,
  device_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  synced INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS sync_change_log_unsynced_idx
  ON sync_change_log (synced, timestamp ASC);

CREATE INDEX IF NOT EXISTS sync_change_log_module_idx
  ON sync_change_log (module_id, timestamp ASC);

-- Per-module sync state (tracks what each peer has)
CREATE TABLE IF NOT EXISTS sync_peer_module_state (
  device_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  last_synced_version INTEGER NOT NULL DEFAULT 0,
  last_synced_at TEXT,
  automerge_heads TEXT,  -- JSON array of Automerge head hashes
  PRIMARY KEY (device_id, module_id)
);

-- Device revocations
CREATE TABLE IF NOT EXISTS sync_device_revocations (
  device_id TEXT PRIMARY KEY NOT NULL,
  revoked_by_device_id TEXT NOT NULL,
  reason TEXT,
  revoked_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Blob metadata
CREATE TABLE IF NOT EXISTS sync_blobs (
  hash TEXT PRIMARY KEY NOT NULL,
  size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  module_id TEXT NOT NULL,
  ref_count INTEGER NOT NULL DEFAULT 1,
  stored_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS sync_blobs_module_idx
  ON sync_blobs (module_id);

-- Blob sync policy per module
CREATE TABLE IF NOT EXISTS sync_blob_policy (
  module_id TEXT PRIMARY KEY NOT NULL,
  policy TEXT NOT NULL DEFAULT 'wifi_only'
    CHECK (policy IN ('always', 'wifi_only', 'manual', 'never')),
  max_blob_size_bytes INTEGER DEFAULT 52428800,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sync session log (audit trail)
CREATE TABLE IF NOT EXISTS sync_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  peer_device_id TEXT NOT NULL,
  transport TEXT NOT NULL CHECK (transport IN ('lan', 'wan_webrtc', 'wan_relay')),
  direction TEXT NOT NULL CHECK (direction IN ('push', 'pull', 'bidirectional')),
  modules_synced TEXT NOT NULL,     -- JSON array of module IDs
  changes_sent INTEGER NOT NULL DEFAULT 0,
  changes_received INTEGER NOT NULL DEFAULT 0,
  bytes_sent INTEGER NOT NULL DEFAULT 0,
  bytes_received INTEGER NOT NULL DEFAULT 0,
  blobs_sent INTEGER NOT NULL DEFAULT 0,
  blobs_received INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'partial', 'failed')),
  error TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 8.2 Migration

This is a hub-level migration (not per-module):

```typescript
const SYNC_MIGRATION: Migration = {
  version: 1,
  description: 'Add P2P sync tables',
  up: [
    CREATE_SYNC_DEVICE_IDENTITY,
    CREATE_SYNC_PAIRED_DEVICES,
    CREATE_SYNC_CHANGE_LOG,
    CREATE_SYNC_CHANGE_LOG_INDEXES,
    CREATE_SYNC_PEER_MODULE_STATE,
    CREATE_SYNC_DEVICE_REVOCATIONS,
    CREATE_SYNC_BLOBS,
    CREATE_SYNC_BLOB_POLICY,
    CREATE_SYNC_SESSIONS,
  ],
  down: [
    'DROP TABLE IF EXISTS sync_sessions',
    'DROP TABLE IF EXISTS sync_blob_policy',
    'DROP TABLE IF EXISTS sync_blobs',
    'DROP TABLE IF EXISTS sync_device_revocations',
    'DROP TABLE IF EXISTS sync_peer_module_state',
    'DROP TABLE IF EXISTS sync_change_log',
    'DROP TABLE IF EXISTS sync_paired_devices',
    'DROP TABLE IF EXISTS sync_device_identity',
  ],
};
```

---

## 9. Package Structure

### 9.1 New Package: @mylife/sync

```
packages/sync/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts                    # Public API
│   ├── types.ts                    # All type definitions
│   │
│   ├── identity/
│   │   ├── device-identity.ts      # Generate/load device keypair
│   │   ├── pairing.ts              # QR code + numeric code pairing
│   │   └── revocation.ts           # Device revocation logic
│   │
│   ├── crdt/
│   │   ├── document-manager.ts     # Per-module Automerge documents
│   │   ├── change-tracker.ts       # SQLite write interception
│   │   ├── conflict-reporter.ts    # Optional conflict visibility
│   │   └── schema-adapter.ts       # Map SQLite rows to CRDT operations
│   │
│   ├── transport/
│   │   ├── lan-discovery.ts        # mDNS service advertisement/browsing
│   │   ├── lan-transport.ts        # Direct TCP connections on LAN
│   │   ├── webrtc-transport.ts     # WebRTC data channel connections
│   │   ├── signaling-client.ts     # WebSocket client for signaling server
│   │   └── transport-manager.ts    # Auto-select best transport
│   │
│   ├── encryption/
│   │   ├── noise-handshake.ts      # Noise NK handshake implementation
│   │   ├── keys.ts                 # Key derivation (HKDF), key storage
│   │   └── encrypt.ts              # XChaCha20-Poly1305 encrypt/decrypt
│   │
│   ├── blob/
│   │   ├── blob-store.ts           # Content-addressed local blob storage
│   │   ├── blob-sync.ts            # Block-level blob transfer protocol
│   │   └── blob-policy.ts          # Per-module sync policy enforcement
│   │
│   ├── protocol/
│   │   ├── handshake.ts            # HELLO + auth exchange
│   │   ├── sync-session.ts         # Full sync session orchestration
│   │   ├── message-codec.ts        # Binary message encoding/decoding
│   │   └── push-relay-client.ts    # Push notification relay client
│   │
│   ├── engine/
│   │   ├── sync-engine.ts          # Top-level sync coordinator
│   │   ├── sync-scheduler.ts       # When/how often to sync
│   │   └── sync-status.ts          # Observable sync state for UI
│   │
│   └── __tests__/
│       ├── identity.test.ts
│       ├── crdt.test.ts
│       ├── protocol.test.ts
│       ├── blob.test.ts
│       └── engine.test.ts
```

### 9.2 Signaling Server: @mylife/sync-relay

```
infrastructure/sync-relay/
├── package.json
├── Dockerfile
├── src/
│   ├── index.ts                    # Entry point
│   ├── relay.ts                    # WebSocket relay logic (~100 lines)
│   ├── push.ts                     # APNs/FCM push forwarding
│   └── rate-limit.ts              # Per-device rate limiting
└── deploy/
    ├── fly.toml                    # Fly.io deployment config
    └── docker-compose.yml          # Self-host option
```

---

## 10. User Interface

### 10.1 Settings > Sync

```
┌─────────────────────────────────┐
│ ← Settings                      │
│                                  │
│ ┌─ Sync ────────────────────┐   │
│ │                            │   │
│ │  Status: ● Synced          │   │
│ │  Last sync: 2 minutes ago  │   │
│ │                            │   │
│ │  ─────────────────────────│   │
│ │                            │   │
│ │  Paired Devices            │   │
│ │                            │   │
│ │  📱 Trey's iPhone          │   │
│ │     ● Online · Synced      │   │
│ │                            │   │
│ │  💻 MacBook Pro            │   │
│ │     ○ Offline · 1hr ago    │   │
│ │                            │   │
│ │  📱 iPad Air               │   │
│ │     ● Online · Syncing...  │   │
│ │                            │   │
│ │  ─────────────────────────│   │
│ │                            │   │
│ │  [+ Pair New Device]       │   │
│ │                            │   │
│ │  ─────────────────────────│   │
│ │                            │   │
│ │  Module Sync Settings  >   │   │
│ │  Sync History          >   │   │
│ │  Blob Storage Policy   >   │   │
│ │                            │   │
│ └────────────────────────────┘   │
└─────────────────────────────────┘
```

### 10.2 Module Sync Settings

```
┌─────────────────────────────────┐
│ ← Module Sync                   │
│                                  │
│  Sync All Modules    [  ON  ]   │
│                                  │
│  ─ Per-Module Override ────────  │
│                                  │
│  📚 MyBooks                      │
│     Data: ● Sync  Blobs: WiFi   │
│                                  │
│  💰 MyBudget                     │
│     Data: ● Sync  Blobs: WiFi   │
│                                  │
│  📓 MyJournal                    │
│     Data: ● Sync  Blobs: Manual │
│                                  │
│  💪 MyWorkouts                   │
│     Data: ● Sync  Blobs: Never  │
│     (Form videos are large)     │
│                                  │
└─────────────────────────────────┘
```

### 10.3 Pairing Flow

```
Screen 1: "Pair a New Device"
┌─────────────────────────────────┐
│                                  │
│   Scan this QR code from your   │
│   other device running MyLife   │
│                                  │
│        ┌──────────────┐         │
│        │   QR CODE    │         │
│        │   ████████   │         │
│        │   ████████   │         │
│        │   ████████   │         │
│        └──────────────┘         │
│                                  │
│   Or enter this code manually:  │
│         847 291                  │
│                                  │
│   [I want to scan instead]      │
│                                  │
└─────────────────────────────────┘

Screen 2: "Device Paired!"
┌─────────────────────────────────┐
│                                  │
│          ✓ Paired!              │
│                                  │
│   💻 MacBook Pro                │
│   is now syncing with this      │
│   device.                       │
│                                  │
│   Initial sync: 27 modules     │
│   ████████████░░░ 68%           │
│   12.4 MB of 18.2 MB           │
│                                  │
│   [Done]                        │
│                                  │
└─────────────────────────────────┘
```

---

## 11. Public Content Distribution (MyLife Torrents)

### 11.1 Vision

Beyond personal sync, the P2P infrastructure powers a broader content distribution system. Anyone can publish content, generate a shareable link, and let others download it directly from them, boosted by anyone else who chooses to seed it. This is the full BitTorrent model applied to legitimate content distribution.

**Use cases:**
- An indie filmmaker shares their movie. Fans who download it automatically seed it to others.
- A creator sells a digital product (course, template pack, music). Buyers get an access link that downloads via P2P.
- A MyLife user exports their recipe collection as a shareable package. Friends download it. Their devices seed it to other friends.
- A developer distributes an app update. Early downloaders seed to later ones, reducing server bandwidth to near zero.
- An educator shares a flashcard deck. Students download and seed it across campus.

### 11.2 How It Works

```
Creator                         Consumer                        Community Seeder
   │                               │                                │
   │  1. Create content             │                                │
   │  2. Generate manifest          │                                │
   │     (hash tree + metadata)     │                                │
   │  3. Get shareable link:        │                                │
   │     mylife://t/abc123          │                                │
   │                                │                                │
   │──── Share link ───────────────>│                                │
   │                                │                                │
   │                                │  4. Open link in MyLife        │
   │                                │  5. Connect to creator's       │
   │                                │     device via P2P             │
   │                                │  6. Download content           │
   │<──── Request pieces ──────────│                                │
   │──── Send pieces ──────────────>│                                │
   │                                │                                │
   │                                │  7. Consumer now seeds too     │
   │                                │                                │
   │                                │──── Available as seeder ──────>│
   │                                │                                │
   │                                │           Later consumer:      │
   │                                │           Downloads from BOTH  │
   │                                │<───── pieces from consumer     │
   │                                │           AND creator          │
   │<──────────────────────────────│           AND community seeder  │
```

### 11.3 Content Manifest (The "Torrent File")

Every published piece of content gets a manifest -- analogous to a .torrent file:

```typescript
interface ContentManifest {
  /** Unique identifier, derived from content hash */
  infoHash: string;              // SHA-256 of the content metadata

  /** Human-readable metadata */
  title: string;
  description: string;
  creator: {
    publicKey: string;           // Ed25519 public key of creator
    displayName: string;
    signature: string;           // Creator's signature over the manifest
  };

  /** Content structure */
  files: {
    path: string;                // e.g., "movie.mp4" or "deck/cards.json"
    size: number;                // bytes
    hash: string;                // SHA-256 of complete file
    mimeType: string;
  }[];

  /** Piece information (BitTorrent-style) */
  pieceLength: number;           // bytes per piece (typically 256KB - 4MB)
  pieces: string[];              // SHA-256 hash of each piece, in order
  totalSize: number;             // total bytes across all files

  /** Merkle root for v2-style verification */
  merkleRoot: string;            // root of SHA-256 Merkle tree over pieces

  /** Access control */
  access: 'public' | 'link' | 'paid' | 'encrypted';
  price?: {
    amount: number;
    currency: string;            // 'USD'
    paymentMethods: ('stripe' | 'lightning' | 'applepay')[];
  };

  /** Optional: encryption key (encrypted to buyer's public key for paid content) */
  encryptedKey?: string;

  /** Discovery */
  tags: string[];
  category: string;
  createdAt: string;             // ISO 8601
  version: number;               // manifest version, for updates

  /** Tracker/coordination */
  trackers: string[];            // WebSocket tracker URLs for peer discovery
  webSeeds: string[];            // HTTP URLs for fallback download (creator's server)
}
```

### 11.4 Shareable Links

Three link formats:

**1. MyLife Deep Link (in-app):**
```
mylife://t/abc123def456
```
Opens MyLife app, resolves info-hash `abc123def456` via tracker/DHT, begins download.

**2. Web Link (universal):**
```
https://share.mylife.app/t/abc123def456
```
Opens a web page showing content metadata + download button. If MyLife is installed, deep links into the app. If not, offers web-based download via WebTorrent (browser P2P).

**3. Magnet-Style URI (interoperable):**
```
magnet:?xt=urn:mylife:abc123def456&dn=My+Indie+Film&tr=wss://tracker.mylife.app
```
Compatible with the magnet URI scheme. Could interoperate with WebTorrent clients.

### 11.5 Seeding Model

**Automatic seeding:** When you download content, you automatically seed it to others (like BitTorrent). This is opt-in with configurable limits:

```typescript
interface SeedingPolicy {
  /** Master toggle */
  enabled: boolean;

  /** Bandwidth limits */
  maxUploadKbps: number;            // 0 = unlimited
  maxUploadPerContentMB: number;    // stop seeding after uploading this much

  /** Storage limits */
  maxSeedStorageMB: number;         // total space for seeded content
  autoDeleteAfterDays: number;      // stop seeding after N days

  /** Network restrictions */
  seedOnCellular: boolean;          // default: false
  seedOnWiFiOnly: boolean;          // default: true
  seedWhileCharging: boolean;       // default: true (always seed while plugged in)

  /** Per-content override */
  pinned: string[];                 // info-hashes to always seed (no auto-delete)
}
```

**Seeding UI:**

```
┌─────────────────────────────────┐
│ ← Seeding                       │
│                                  │
│  You're helping distribute:     │
│                                  │
│  🎬 "Coastal Dreams" (2.1 GB)  │
│     Seeded: 4.7 GB total        │
│     Peers: 12 downloading       │
│     ▲ 340 KB/s                  │
│     [Stop Seeding]              │
│                                  │
│  📚 "React Flashcards" (8 MB)  │
│     Seeded: 124 MB total        │
│     Peers: 3 downloading        │
│     ▲ 45 KB/s                   │
│     [Stop Seeding]              │
│                                  │
│  ─────────────────────────────  │
│  Total uploaded: 12.4 GB        │
│  Content stored: 2.3 GB / 5 GB │
│  [Seeding Settings]             │
│                                  │
└─────────────────────────────────┘
```

### 11.6 Paid Content Distribution

Creators can sell digital content through MyLife's P2P network:

**Flow:**

```
Creator publishes paid content ($4.99)
        │
        ▼
Manifest created with access: 'paid', price: { amount: 4.99, currency: 'USD' }
Content encrypted with a symmetric content key
        │
        ▼
Creator shares link: https://share.mylife.app/t/abc123
        │
        ▼
Buyer opens link, sees preview (title, description, file list, price)
        │
        ▼
Buyer taps "Buy for $4.99"
        │
        ▼
Payment processed (Stripe / Apple Pay / Lightning)
        │
        ▼
Payment server issues a signed access token:
  { infoHash, buyerPubKey, contentKey (encrypted to buyer), receipt }
        │
        ▼
Buyer's MyLife app receives the content key
        │
        ▼
Buyer downloads encrypted pieces via P2P (from creator + other seeders)
        │
        ▼
Buyer decrypts locally using the content key
        │
        ▼
Buyer can now seed the ENCRYPTED pieces to others
(Seeders cannot read the content -- they only relay encrypted blocks)
```

**Key insight:** Seeders distribute encrypted data. They never have the decryption key. Only buyers who paid get the key. This means community seeding works for paid content without piracy risk. Seeders help distribute but can't access what they're distributing.

**Payment split:**
- Creator: 85-90%
- MyLife platform fee: 10-15% (covers payment processing + tracker infrastructure)
- Apple/Google (if in-app): standard 15-30% on top (for App Store purchases)

### 11.7 Content Tracker

For public content distribution, a tracker coordinates the swarm (which peers have which pieces):

```typescript
// Tracker server (extends the signaling server)
interface TrackerEndpoints {
  // Announce: "I have content X, here's my connection info"
  'POST /announce': {
    infoHash: string;
    peerId: string;
    event: 'started' | 'stopped' | 'completed';
    uploaded: number;
    downloaded: number;
    left: number;        // bytes remaining
    port: number;
    connectionInfo: string; // encrypted SDP for WebRTC
  };

  // Get peers: "Who else has content X?"
  'GET /peers/:infoHash': {
    peers: {
      peerId: string;
      connectionInfo: string;
      isSeeder: boolean;
    }[];
  };

  // Scrape: "How healthy is content X's swarm?"
  'GET /scrape/:infoHash': {
    seeders: number;
    leechers: number;
    completed: number;   // total completed downloads
  };
}
```

**DHT as tracker alternative:** For decentralization, content can also be discovered via a Kademlia DHT (like BitTorrent's mainline DHT). The tracker is optional but provides faster initial peer discovery.

### 11.8 Web Seeds (Fallback)

Creators can optionally provide HTTP URLs as "web seeds" -- direct download links that supplement P2P:

- If no peers are online, the content can still be downloaded from the web seed
- As more peers join, load shifts from the web seed to the P2P swarm
- Web seeds are useful for the initial bootstrap (when the creator is the only seeder)
- Creators can use any CDN, S3 bucket, or personal server as a web seed

### 11.9 Content Categories

```typescript
type ContentCategory =
  | 'film'           // Movies, short films, documentaries
  | 'music'          // Albums, singles, podcasts
  | 'education'      // Courses, tutorials, flashcard decks
  | 'book'           // eBooks, PDFs, audiobooks
  | 'software'       // Apps, tools, open source releases
  | 'template'       // Design templates, code templates, recipe packs
  | 'dataset'        // Open data, research datasets
  | 'game'           // Indie games, game mods
  | 'art'            // Digital art, photography, 3D models
  | 'other';
```

### 11.10 Content Publishing Flow

```
┌─────────────────────────────────┐
│ ← Publish Content               │
│                                  │
│  Title: [My Indie Film        ] │
│                                  │
│  Description:                   │
│  [A short film about coastal  ] │
│  [communities and surfing     ] │
│                                  │
│  Files:                         │
│  🎬 coastal-dreams.mp4  2.1 GB │
│  📄 subtitles-en.srt    42 KB  │
│  🖼️ poster.jpg          1.2 MB  │
│  [+ Add Files]                  │
│                                  │
│  Category: [Film           ▼]  │
│  Tags: [indie, surf, documentary│
│                                  │
│  Access:                        │
│  ○ Public (free, anyone)        │
│  ○ Link only (free, need link)  │
│  ● Paid ($4.99)                 │
│  ○ Encrypted (invite only)      │
│                                  │
│  [Publish]                      │
│                                  │
└─────────────────────────────────┘
```

### 11.11 Database Schema for Content Distribution

```sql
-- Published content (content you created/published)
CREATE TABLE IF NOT EXISTS torrent_published (
  info_hash TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  access TEXT NOT NULL CHECK (access IN ('public', 'link', 'paid', 'encrypted')),
  price_cents INTEGER,
  currency TEXT DEFAULT 'USD',
  total_size INTEGER NOT NULL,
  piece_length INTEGER NOT NULL,
  pieces_json TEXT NOT NULL,         -- JSON array of piece hashes
  merkle_root TEXT NOT NULL,
  files_json TEXT NOT NULL,          -- JSON array of file entries
  manifest_json TEXT NOT NULL,       -- full signed manifest
  content_key TEXT,                  -- symmetric key (for paid/encrypted content)
  trackers_json TEXT NOT NULL DEFAULT '["wss://tracker.mylife.app"]',
  web_seeds_json TEXT DEFAULT '[]',
  download_count INTEGER NOT NULL DEFAULT 0,
  revenue_cents INTEGER NOT NULL DEFAULT 0,
  published_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Downloaded content (content you fetched from others)
CREATE TABLE IF NOT EXISTS torrent_downloads (
  info_hash TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  creator_public_key TEXT NOT NULL,
  creator_display_name TEXT,
  total_size INTEGER NOT NULL,
  downloaded_size INTEGER NOT NULL DEFAULT 0,
  piece_count INTEGER NOT NULL,
  pieces_completed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'downloading'
    CHECK (status IN ('downloading', 'completed', 'paused', 'seeding', 'stopped')),
  manifest_json TEXT NOT NULL,
  content_key TEXT,                  -- decryption key (if paid, received after purchase)
  access_token TEXT,                 -- signed receipt for paid content
  storage_path TEXT NOT NULL,        -- local path to downloaded files
  downloaded_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seeding state (what you're actively seeding)
CREATE TABLE IF NOT EXISTS torrent_seeding (
  info_hash TEXT PRIMARY KEY NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  bytes_uploaded INTEGER NOT NULL DEFAULT 0,
  peers_served INTEGER NOT NULL DEFAULT 0,
  last_upload_at TEXT,
  pin_forever INTEGER NOT NULL DEFAULT 0,
  auto_delete_at TEXT,               -- when to stop seeding
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Piece availability (which pieces we have for each torrent)
CREATE TABLE IF NOT EXISTS torrent_pieces (
  info_hash TEXT NOT NULL,
  piece_index INTEGER NOT NULL,
  hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'missing'
    CHECK (status IN ('missing', 'downloading', 'verified')),
  verified_at TEXT,
  PRIMARY KEY (info_hash, piece_index)
);

CREATE INDEX IF NOT EXISTS torrent_pieces_status_idx
  ON torrent_pieces (info_hash, status);

-- Peer connections (active swarm peers for each torrent)
CREATE TABLE IF NOT EXISTS torrent_peers (
  info_hash TEXT NOT NULL,
  peer_id TEXT NOT NULL,
  connection_info TEXT,
  is_seeder INTEGER NOT NULL DEFAULT 0,
  bytes_downloaded_from INTEGER NOT NULL DEFAULT 0,
  bytes_uploaded_to INTEGER NOT NULL DEFAULT 0,
  connected_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_active_at TEXT,
  PRIMARY KEY (info_hash, peer_id)
);

-- Payment records (for paid content)
CREATE TABLE IF NOT EXISTS torrent_payments (
  id TEXT PRIMARY KEY NOT NULL,
  info_hash TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_method TEXT NOT NULL,
  payment_provider_id TEXT,          -- Stripe charge ID, Lightning invoice, etc.
  buyer_public_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'refunded', 'failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seeding policy
CREATE TABLE IF NOT EXISTS torrent_seeding_policy (
  id TEXT PRIMARY KEY NOT NULL CHECK (id = 'config'),
  enabled INTEGER NOT NULL DEFAULT 1,
  max_upload_kbps INTEGER NOT NULL DEFAULT 0,
  max_seed_storage_mb INTEGER NOT NULL DEFAULT 5120,
  auto_delete_days INTEGER NOT NULL DEFAULT 30,
  seed_on_cellular INTEGER NOT NULL DEFAULT 0,
  seed_while_charging INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 11.12 Package Structure Addition

```
packages/sync/src/
  ...existing sync code...
  │
  ├── torrent/
  │   ├── manifest.ts              # Create/parse/verify content manifests
  │   ├── publisher.ts             # Content publishing flow
  │   ├── downloader.ts            # Piece selection, download orchestration
  │   ├── seeder.ts                # Seeding engine, upload management
  │   ├── piece-manager.ts         # Piece verification, Merkle tree validation
  │   ├── tracker-client.ts        # Announce/get-peers/scrape
  │   ├── swarm-manager.ts         # Peer connection management for content swarms
  │   ├── paid-content.ts          # Payment flow, key exchange for paid content
  │   ├── web-seed.ts              # HTTP fallback download
  │   └── deep-link.ts             # mylife:// and https://share.mylife.app link handling
```

### 11.13 Content Distribution vs Personal Sync

These are two distinct systems sharing the same transport layer:

| Aspect | Personal Sync (Sections 1-10) | Content Distribution (Section 11) |
|---|---|---|
| Who connects | Your own devices (3-5) | Any MyLife user (unlimited swarm) |
| Data type | Module data (SQLite rows) | Files (movies, courses, decks, etc.) |
| Sync model | CRDT merge (all changes) | BitTorrent piece transfer (immutable content) |
| Encryption | End-to-end between your devices | Optional (public content is unencrypted; paid content is encrypted) |
| Identity | Device keypairs (paired privately) | Creator public keys (published openly) |
| Discovery | mDNS (LAN) + signaling server (WAN) | Tracker + DHT (public swarm discovery) |
| Conflict resolution | CRDT auto-merge | N/A (immutable pieces, no conflicts) |
| Seeding | Your devices seed to each other | Community seeds to everyone |

They share: WebRTC transport, encryption primitives, content-addressed storage, piece verification.

---

## 12. Implementation Phases (Updated)

### Phase 1: LAN Sync (No Servers Required)

**Scope:** Same-WiFi sync between paired devices
**Effort:** 8-10 weeks
**Dependencies:** None (uses only local networking)

**Deliverables:**
- `@mylife/sync` package with identity, CRDT, LAN transport, encryption, and engine modules
- Device pairing via QR code
- mDNS device discovery
- Direct TCP sync with Noise encryption
- Automerge CRDT sync for all 27 modules
- Change tracking hook in DatabaseAdapter
- Settings UI for sync status and paired devices
- Blob sync for same-network transfers
- 100+ tests

**What users get:** "Open MyLife on your phone and laptop on the same WiFi. They sync automatically. No account needed."

### Phase 2: Internet Sync (Minimal Servers)

**Scope:** Sync across different networks, background sync
**Effort:** 6-8 weeks
**Dependencies:** Phase 1 complete

**Deliverables:**
- WebRTC data channel transport
- Signaling server (`@mylife/sync-relay`)
- Push relay for background sync triggers (APNs/FCM)
- STUN/TURN NAT traversal
- Sync scheduler (battery-aware, network-aware)
- Fly.io / self-host deployment for relay services

**What users get:** "Your phone at the office syncs with your laptop at home. Changes arrive within minutes, even when the app is in the background."

### Phase 3: Social P2P Sharing

**Scope:** Share data between different MyLife users
**Effort:** 6-8 weeks
**Dependencies:** Phase 2 complete, social package integration

**Deliverables:**
- Cross-user sharing protocol (share recipe collections, workout plans)
- Shared Automerge documents with per-user permissions
- Friend-to-friend encrypted data exchange
- "Seeding" model: users host shared content for their friends' devices
- Selective sharing UI per module

**What users get:** "Share your recipe collection with your partner. They get a live-updating copy. You both seed it to each other's devices. No server involved."

### Phase 4: Content Distribution (MyLife Torrents)

**Scope:** Public and paid content distribution via P2P swarms
**Effort:** 10-12 weeks
**Dependencies:** Phase 2 complete (WebRTC transport + tracker infrastructure)

**Deliverables:**
- Content manifest creation and signing
- Publish flow UI (select files, set price, generate link)
- BitTorrent-style piece selection and download engine
- Seeding engine with configurable bandwidth/storage limits
- Tracker server (announce, get-peers, scrape)
- DHT-based peer discovery (decentralized fallback)
- Shareable links: `mylife://t/...`, `https://share.mylife.app/t/...`, magnet URIs
- Web seed support (HTTP fallback downloads)
- Seeding UI (see what you're seeding, stats, controls)
- Download manager UI (progress, peers, speed)
- Content category browsing
- 150+ tests

**What users get:** "Share anything via P2P. Publish a film, sell a course, distribute a flashcard deck. Anyone who downloads helps distribute it to others. No server hosting costs."

### Phase 5: Paid Content and Creator Economy

**Scope:** Monetization layer for content creators
**Effort:** 6-8 weeks
**Dependencies:** Phase 4 complete

**Deliverables:**
- Payment integration (Stripe, Apple Pay, Lightning Network)
- Content encryption for paid content (seeders relay encrypted blocks, only buyers decrypt)
- Creator dashboard (revenue, download stats, swarm health)
- Access token issuance and verification
- Refund/dispute handling
- Creator payout system
- Revenue split configuration (creator % vs platform %)
- Content licensing metadata (CC, personal use, commercial use)

**What users get:** "Sell your digital content directly. No middleman takes 30%. Buyers download via P2P. Community seeding means your server costs are near zero."

### Phase 6: Advanced Features

**Scope:** Power user and edge case handling
**Effort:** 4-6 weeks
**Dependencies:** Phase 3 complete

**Deliverables:**
- Bluetooth LE sync (no WiFi needed)
- Selective module sync per device (phone gets everything, tablet only gets books and recipes)
- Sync conflict inspection and manual resolution UI
- Data export from sync layer (full backup as encrypted archive)
- Multi-user family hub (shared family device mesh)
- Sync analytics dashboard (bytes transferred, sync frequency, peer health)
- Content recommendation engine (trending in MyLife, popular by category)
- Creator verification/profiles
- Playlist/bundle support (group multiple content items)

---

## 13. Server Cost Model

### 12.1 Self-Operated Infrastructure

**Personal Sync (Phases 1-3):**

| Component | Service | Monthly Cost | Purpose |
|---|---|---|---|
| Signaling server | Fly.io (shared-cpu-1x, 256MB) | $1.94 | WebRTC signaling relay |
| Push relay | Same Fly.io instance | $0 (bundled) | APNs/FCM notification forwarding |
| STUN | Google public STUN | $0 | NAT type detection |
| TURN relay | Fly.io (shared-cpu-1x, 256MB) | $5.70 | Fallback relay for ~15% of connections |
| Domain + TLS | Cloudflare | $0 | DNS + free TLS |
| **Subtotal** | | **~$8/month** | Regardless of user count |

**Content Distribution (Phases 4-5):**

| Component | Service | Monthly Cost | Purpose |
|---|---|---|---|
| Tracker server | Fly.io (shared-cpu-2x, 512MB) | $5.70 | Swarm coordination for public content |
| Share link page | Cloudflare Pages | $0 | Static preview page for share.mylife.app |
| Payment server | Fly.io (shared-cpu-1x, 256MB) | $3.57 | Stripe/Lightning payment processing |
| Content DB | Fly.io Postgres (1 shared CPU) | $6.94 | Manifest index, payments, creator accounts |
| **Subtotal** | | **~$16/month** | Scales with tracker load |

**Combined total: ~$24/month** for the full P2P platform at launch.

**Scaling projections:**

| Users | Personal Sync | Content Distribution | Total |
|---|---|---|---|
| 1,000 | ~$8/month | ~$16/month | ~$24/month |
| 10,000 | ~$15/month | ~$30/month | ~$45/month |
| 100,000 | ~$50/month | ~$100/month | ~$150/month |
| 1,000,000 | ~$200/month | ~$400/month | ~$600/month |

For comparison, hosting 1M users' data on Supabase/Firebase: $5,000-20,000/month. P2P is 10-30x cheaper because the users' own devices do the heavy lifting.

### 12.2 Revenue Model for Content Distribution

| Revenue Source | How It Works | Projected |
|---|---|---|
| Paid content platform fee | 10-15% of each sale | Scales with creator economy |
| MyLife Pro subscription | One-time $5 (unlocks all modules + sync + publishing) | Core revenue |
| Featured content placement | Creators pay for visibility in browse/discover | Future |
| Creator Pro tools | Advanced analytics, multi-format publishing, priority tracker | Future |

**Key insight:** Content distribution is nearly free to operate because the community seeds content. The only real costs are tracker coordination and payment processing. Unlike YouTube/Vimeo/hosting platforms, MyLife never stores or serves the actual content. The swarm handles distribution.

---

## 14. Testing Strategy

### 13.1 Unit Tests

- CRDT operations: insert, update, delete, merge, conflict resolution
- Encryption: key generation, key derivation, encrypt/decrypt roundtrip
- Protocol: message encoding/decoding, handshake simulation
- Blob store: put/get/has/prune, content addressing verification
- Change tracker: SQLite write interception accuracy

### 13.2 Integration Tests

- Two in-memory sync engines connecting via mock transport
- Full sync session: pairing, handshake, CRDT exchange, blob transfer
- Conflict scenarios: simultaneous edits on two simulated devices
- Device revocation: verify revoked device cannot reconnect
- Schema migration: sync between devices on different schema versions

### 13.3 End-to-End Tests

- Two Expo apps on simulator, same WiFi, full pairing and sync flow
- WebRTC sync between mobile simulator and Next.js web app
- Background sync triggered by push notification (requires physical device)
- Large blob transfer (100MB video) with progress tracking

---

## 15. Privacy Compliance

### 14.1 Data Processing Disclosure

For App Store and Play Store privacy labels:

- **Data collected:** None. All data stays on device.
- **Data shared with third parties:** None.
- **Data used for tracking:** None.
- **Signaling server:** Processes only encrypted connection metadata (IP addresses + encrypted SDP). No user content. Logs rotated every 24 hours.
- **Push relay:** Processes only device tokens + encrypted opaque payloads. No user content. No persistent storage.

### 14.2 GDPR / CCPA

- No personal data is processed by any MyLife server
- No data controller/processor relationship exists (user is sole controller)
- Right to deletion: user deletes from device, data is gone. No server-side residue.
- Data portability: full export available from the app (CSV/JSON/Markdown per module)

### 14.3 Self-Hosting Option

Users who want zero dependence on MyLife infrastructure can self-host:
- Signaling server: Docker image, runs on any VPS or Raspberry Pi
- Push relay: same Docker image, requires APNs/FCM credentials
- TURN: standard coturn, Docker image provided
- Total self-host: one Docker Compose file, one command to deploy

---

## 16. Open Questions

### Personal Sync

1. **Automerge vs Yjs:** This spec recommends Automerge for structured data. Should we use Yjs for journal/notes modules (better rich text CRDT) and Automerge for everything else? Or standardize on one?

2. **Initial sync UX:** When pairing a device that has no data with one that has months of data, the initial sync could take minutes. What's the right UX? Progressive sync (show modules as they complete) vs blocking screen?

3. **Web app sync:** The Next.js web app can sync via WebRTC while the browser tab is open, but it can't "seed" in the background. Is this acceptable, or do we need a desktop app (Electron/Tauri) for persistent web sync?

4. **Family sharing model:** Should family members share a single device mesh (all data syncs to everyone), or should sharing be per-module (share recipes but not budget)?

5. **Backup strategy:** P2P sync is not backup (if all devices are lost, data is gone). Should we offer an optional encrypted backup to user-provided storage (iCloud Drive, Google Drive, NAS) as a safety net?

6. **Expo Go compatibility:** WebRTC requires a native module (`react-native-webrtc`), which doesn't work in Expo Go. Phase 1 (LAN only) could work with TCP sockets. Is it acceptable to require EAS Build for Phase 2?

### Content Distribution

7. **Copyright and DMCA:** If someone distributes copyrighted content through MyLife Torrents, how do we handle takedowns? Do we implement a DMCA-style process on the tracker? The decentralized nature (DHT) makes full takedown impossible by design, but the tracker server is a controllable point.

8. **Content moderation:** Do we review published content, or is the platform fully open? Options range from "anything goes" (legal risk) to "curated marketplace" (resource-intensive) to "creator-verified, community-reported" (middle ground).

9. **App Store compliance:** Apple and Google have strict rules about apps that enable file sharing. The content distribution feature may need to be web-only or carefully positioned. Apple specifically prohibits "apps that are primarily a BitTorrent client." MyLife is primarily a personal app suite with P2P sync; content distribution is a secondary feature. This distinction matters.

10. **Platform fee vs open protocol:** Should the content distribution protocol be fully open (anyone can build a client) or MyLife-exclusive? An open protocol drives adoption but limits monetization. A closed protocol protects revenue but limits growth.

11. **Seeder incentives:** Beyond goodwill, should seeders receive anything? Options: reputation score, priority access to popular content, reduced subscription price, or cryptocurrency/Lightning micropayments per GB seeded.

12. **Content size limits:** Should there be a maximum content size? A 50GB film vs a 5MB flashcard deck have very different infrastructure demands. Mobile users especially need protection from accidental large downloads.

13. **Versioning/updates:** When a creator updates their content (v2 of a course, director's cut of a film), how does this propagate? New manifest with reference to the old one? Incremental diff? Full re-download?

---

## 17. References

### Academic
- Cohen, B. (2003). "Incentives Build Robustness in BitTorrent." Workshop on Economics of P2P Systems.
- Kleppmann, M. et al. (2019). "Local-first software: You own your data, in spite of the cloud." Onward! 2019, ACM.
- Shapiro, M. et al. (2011). "Conflict-free Replicated Data Types." SSS 2011.
- Kleppmann, M. & Beresford, A.R. (2017). "A Conflict-Free Replicated JSON Datatype." IEEE TPDS.
- Maymounkov, P. & Mazieres, D. (2002). "Kademlia: A Peer-to-peer Information System Based on the XOR Metric." IPTPS.

### Protocol Specifications
- BEP 3: The BitTorrent Protocol Specification
- BEP 5: DHT Protocol (Kademlia-based)
- BEP 52: The BitTorrent Protocol Specification v2
- Noise Protocol Framework (noiseprotocol.org)
- WebRTC (w3.org/TR/webrtc)
- Automerge Sync Protocol (automerge.org)

### Implementations Referenced
- Syncthing: syncthing.net (MIT license, P2P file sync)
- Automerge: automerge.org (MIT license, CRDT library)
- libp2p: libp2p.io (MIT/Apache 2.0, modular P2P networking)
- WebTorrent: webtorrent.io (MIT license, browser BitTorrent)
- Briar: briarproject.org (GPL, P2P encrypted messaging)
