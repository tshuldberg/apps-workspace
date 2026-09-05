# SPEC: MyLife Cloud Sync -- Full Implementation Plan

**Date:** 2026-03-29
**Status:** Draft
**Estimated effort:** 8 phases, ~40 hours CC time

---

## 1. Current State (What Exists)

The cloud sync architecture is **90% designed, 0% wired**. All abstractions, types, hooks, and UI exist. The operational glue is missing.

### Built and Complete

| Component | Package | Status |
|-----------|---------|--------|
| Sync tier types (5 tiers) | `@mylife/sync` | Complete |
| `LocalOnlyProvider` | `@mylife/sync` | Complete |
| `P2PProvider` (protocol layer) | `@mylife/sync` | Complete |
| `CloudProvider` (abstract) | `@mylife/sync` | Complete |
| `SyncManager` (tier switching) | `@mylife/sync` | Complete |
| React hooks (`useSyncStatus`, etc.) | `@mylife/sync` | Complete |
| CRDT layer (Automerge) | `@mylife/sync` | Complete |
| Encryption (XSalsa20-Poly1305) | `@mylife/sync` | Complete |
| Device identity (Ed25519/X25519) | `@mylife/sync` | Complete |
| Pairing (6-digit codes, QR) | `@mylife/sync` | Complete |
| Changeset application (LWW) | `@mylife/sync` | Complete |
| Blob sync (block-based) | `@mylife/sync` | Complete |
| Sync database schema (16 tables) | `@mylife/sync` | Complete |
| Billing config (product catalog) | `@mylife/billing-config` | Complete |
| RevenueCat integration | `@mylife/subscription` | Complete (interface) |
| Stripe integration | `@mylife/subscription` | Complete (interface) |
| Auth service (Supabase Auth) | `@mylife/auth` | Complete |
| Entitlements model | `@mylife/entitlements` | Complete |
| Social client (Supabase) | `@mylife/social` | Complete |
| Mobile data-sync settings UI | `apps/mobile` | Complete |
| Web data-sync settings UI | `apps/web` | Complete |
| Cloud adapters: Surf | `@mylife/surf` | Complete (30+ functions) |
| Cloud adapters: Forums | `@mylife/forums` | Complete (22 functions) |
| Cloud adapters: Market | `@mylife/market` | Complete (30+ functions) |
| 19 test files for sync package | `@mylife/sync` | Complete |

### Missing (Must Build)

| Component | What's Needed | Phase |
|-----------|---------------|-------|
| PowerSync SDK install + bridge | Concrete `PowerSyncLike` impl | 1 |
| App root SyncManager init | Wire into `_layout.tsx` + `Providers.tsx` | 1 |
| Tier change handler wiring | Connect `useSetSyncTier()` to `SyncManager` | 1 |
| Payment -> sync trigger | Stripe/RevenueCat webhook triggers tier change | 1 |
| Supabase storage client impl | `getStorageUsedBytes()` concrete impl | 1 |
| PowerSync sync rules | Define which tables sync per module | 2 |
| Cloud adapters for 24 modules | `src/cloud/` directory per module | 3-5 |
| Supabase cloud schemas | `schema.sql` per module (RLS, indexes) | 3-5 |
| Cache table migrations | `_cache` tables for cloud modules | 3-5 |
| P2P WebRTC platform adapters | Expo + web concrete implementations | 6 |
| LAN discovery (mDNS) | `react-native-zeroconf` integration | 6 |
| Signaling server | WebRTC signaling relay | 6 |
| Self-host mode completion | Federation, multi-tenant, test suite | 7 |
| Entitlements server verification | Background refresh + signature check | 8 |

---

## 2. Architecture Overview

```
User Device (SQLite)
  │
  ├── LOCAL_ONLY (Tier 0) ──── No network. Data stays on device.
  │
  ├── P2P (Tier 1) ──── WebRTC direct to paired devices.
  │     │                No server. No account. E2E encrypted.
  │     ├── LAN: mDNS discovery + TCP/WebSocket
  │     └── WAN: WebRTC data channels (STUN/TURN)
  │
  └── CLOUD (Tiers 2-4) ──── PowerSync <-> Supabase.
        │                      Requires auth. Storage-metered.
        ├── free_cloud:    1 GB ($0/mo)
        ├── starter_cloud: 5 GB ($2.99/mo)
        └── power_cloud:  25 GB ($5.99/mo)
```

### Cloud Data Flow

```
┌──────────────────┐    PowerSync     ┌──────────────────┐
│  SQLite (device)  │ ◄──────────────► │  Supabase (cloud) │
│                   │   bidirectional  │                   │
│  bk_books         │   sync engine    │  bk_books         │
│  bg_envelopes     │                  │  bg_envelopes     │
│  md_medications   │                  │  md_medications   │
│  ...24 modules    │                  │  ...24 modules    │
└──────────────────┘                  └──────────────────┘
       │                                       │
       │ instant reads                         │ RLS policies
       │ offline writes                        │ per-user isolation
       │ change tracking                       │ auth.uid() gating
```

### Why PowerSync (Not Custom Sync)

PowerSync is purpose-built for this exact pattern:
- Watches SQLite writes, queues changes, uploads to Supabase
- Downloads Supabase changes, merges into SQLite
- Handles conflicts, retries, offline queue
- 3 lines to connect: `new PowerSyncDatabase(schema).connect(connector)`
- Eliminates ~5,000 lines of custom sync code

---

## 3. Phase Plan

### Phase 1: Wire the Infrastructure (4 hours)

**Goal:** Make the existing CloudProvider actually work. No new modules go cloud yet; just prove the pipeline end-to-end with an existing cloud module (Surf).

#### 1a. Install PowerSync SDK

```bash
# Mobile
cd apps/mobile && pnpm add @powersync/react-native @powersync/common

# Web
cd apps/web && pnpm add @powersync/web @powersync/common

# Sync package (peer dep)
cd packages/sync && # add @powersync/common to peerDependencies
```

#### 1b. Create PowerSync Connector

New file: `packages/sync/src/providers/powersync-connector.ts`

```typescript
import type { PowerSyncLike, SupabaseStorageClient } from './cloud';

/**
 * Bridge between PowerSync SDK and our CloudProvider interface.
 * Platform-specific (mobile vs web) implementations inject
 * the actual PowerSync database instance.
 */
export function createPowerSyncBridge(
  psDb: AbstractPowerSyncDatabase,  // From @powersync/react-native or @powersync/web
): PowerSyncLike {
  return {
    connect: () => psDb.connect(/* connector */),
    disconnect: () => psDb.disconnect(),
    get connected() { return psDb.currentStatus.connected; },
    get currentStatus() { return psDb.currentStatus; },
  };
}

export function createSupabaseStorageClient(
  supabase: SupabaseClient,
): SupabaseStorageClient {
  return {
    async getStorageUsedBytes(): Promise<number> {
      const { data, error } = await supabase.rpc('get_user_storage_bytes');
      if (error) throw error;
      return data ?? 0;
    },
    async getSessionToken(): Promise<string | null> {
      const { data } = await supabase.auth.getSession();
      return data?.session?.access_token ?? null;
    },
  };
}
```

#### 1c. Define PowerSync Sync Rules

New file: `supabase/powersync.yaml`

This tells PowerSync which Supabase tables to sync and what filter to apply:

```yaml
bucket_definitions:
  user_data:
    # Sync all rows belonging to the authenticated user
    parameters: SELECT request.user_id() as user_id
    data:
      # Phase 1: Surf only (proof of concept)
      - SELECT * FROM sf_spots WHERE creator_id = bucket.user_id
      - SELECT * FROM sf_favorites WHERE user_id = bucket.user_id
      - SELECT * FROM sf_alerts WHERE user_id = bucket.user_id
      - SELECT * FROM sf_user_pins WHERE user_id = bucket.user_id
```

#### 1d. Wire SyncManager into App Root

**Mobile** (`apps/mobile/app/_layout.tsx`):
```typescript
// After AuthService init, add:
const syncManager = useMemo(() => {
  if (!supabaseClient || !authService) return null;
  return new SyncManager({
    createCloudProvider: (tier) => new CloudProvider({
      tier,
      powerSync: createPowerSyncBridge(powerSyncDb),
      supabaseStorage: createSupabaseStorageClient(supabaseClient),
    }),
    isAuthenticated: async () => {
      const state = authService.getState();
      return state.isAuthenticated;
    },
  });
}, [supabaseClient, authService]);

// Initialize default tier
useEffect(() => {
  syncManager?.initialize('local_only');
}, [syncManager]);

// Wire tier change handler for hooks
useEffect(() => {
  if (syncManager) {
    setTierChangeHandler((tier) => syncManager.switchTier(tier));
  }
}, [syncManager]);
```

**Web** (`apps/web/components/Providers.tsx`): Same pattern.

#### 1e. Wire Payment -> Sync Trigger

In both `data-sync.tsx` (mobile) and `data-sync/page.tsx` (web):

```typescript
async function handleTierUpgrade(tier: SyncTier) {
  if (tier === 'starter_cloud' || tier === 'power_cloud') {
    const priceId = tier === 'starter_cloud'
      ? PRODUCTS.storageTiers.starter.id
      : PRODUCTS.storageTiers.power.id;
    await paymentService.purchase(priceId);
  }
  // After payment succeeds:
  await setSyncTier(tier);
}
```

#### 1f. Supabase RPC for Storage Query

New migration: `supabase/migrations/YYYYMMDD_storage_tracking.sql`

```sql
CREATE OR REPLACE FUNCTION get_user_storage_bytes()
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE(SUM(pg_column_size(t.*)), 0)::BIGINT
  FROM (
    -- Union all user-owned tables
    SELECT * FROM sf_spots WHERE creator_id = auth.uid()
    UNION ALL
    SELECT * FROM sf_favorites WHERE user_id = auth.uid()
    -- ... add each synced table
  ) t;
$$;
```

#### 1g. Verification

- [ ] Start mobile app with Supabase env vars set
- [ ] Navigate to Settings > Data Sync
- [ ] Select "Free Cloud (1 GB)"
- [ ] Sign in with email/password
- [ ] Verify `useSyncStatus()` shows `{ tier: 'free_cloud', connected: true }`
- [ ] Create a surf favorite on device A, verify it appears on device B

**Files touched:** ~8 files modified, ~3 files created.

---

### Phase 2: PowerSync Sync Rules for Existing Cloud Modules (2 hours)

**Goal:** Define PowerSync sync rules for all 3 existing cloud modules (surf, forums, market) so their data syncs bidirectionally.

#### 2a. Expand `powersync.yaml`

Add sync rules for every table in forums and market:

```yaml
bucket_definitions:
  user_data:
    parameters: SELECT request.user_id() as user_id
    data:
      # Surf (24 tables)
      - SELECT * FROM sf_spots WHERE ...
      - SELECT * FROM sf_forecasts WHERE ...
      # Forums (14 tables)
      - SELECT * FROM fr_communities WHERE ...
      - SELECT * FROM fr_threads WHERE ...
      # Market (12 tables)
      - SELECT * FROM mk_listings WHERE ...
      - SELECT * FROM mk_conversations WHERE ...

  public_data:
    # No auth filter -- shared across all users
    data:
      - SELECT * FROM sf_spots WHERE is_public = true
      - SELECT * FROM fr_communities WHERE community_type = 'public'
      - SELECT * FROM mk_listings WHERE status = 'active'
```

#### 2b. Migrate Existing Cloud Modules from RPC to PowerSync

Currently, surf/forums/market use direct Supabase RPC calls (`supabase.from('table').select()`). With PowerSync, reads come from local SQLite and writes go through PowerSync's upload queue.

**Migration strategy:** Keep existing cloud adapters as-is for writes. Replace reads with local SQLite queries. PowerSync keeps local SQLite in sync with Supabase automatically.

This means the existing `src/cloud/client.ts` files stay but are used only for write operations. Read operations shift to the local cache tables that PowerSync populates.

**Files touched:** `powersync.yaml`, 3 module definition files (minor).

---

### Phase 3: Cloud-Enable Priority Modules -- Tier 1 (8 hours)

**Goal:** Add cloud sync to the 6 most-requested modules. These are modules where multi-device sync matters most.

**Priority modules (Tier 1):**

| Module | Why Cloud Matters | Tables | Estimated Cloud Adapter LOC |
|--------|------------------|--------|----------------------------|
| Budget | Multi-device spending tracking | 12 | ~800 |
| Meds | Medication adherence across devices | 10 | ~600 |
| Health | Share vitals with doctor/family | 14 | ~900 |
| Habits | Streak continuity across devices | 8 | ~500 |
| Books | Reading progress sync | 10 | ~600 |
| Workouts | Gym log on phone, review on web | 12 | ~800 |

#### Per-Module Work (Repeated 6x)

For each module, create:

1. **`src/cloud/schema.sql`** (~200-400 lines)
   - PostgreSQL tables with UUID PKs, `auth.users` FKs
   - RLS policies (users see only their own data)
   - Indexes for common queries
   - Triggers for `updated_at` timestamps

2. **`src/cloud/client.ts`** (~500-900 lines)
   - Mirror every local CRUD function as a Supabase query
   - Row type interfaces + mappers (snake_case -> camelCase)
   - All functions accept `SupabaseClient` as first param
   - `Result<T>` return pattern

3. **`src/cloud/index.ts`** (barrel export)

4. **Update `src/definition.ts`**
   - `storageType: 'sqlite'` stays (PowerSync handles sync transparently)
   - OR add `cloudEnabled: true` flag if we want explicit opt-in

5. **Add PowerSync sync rules** to `powersync.yaml`

6. **Deploy Supabase migration** for new cloud tables

**Key insight:** With PowerSync, we do NOT need separate cache tables or dual CRUD layers. PowerSync automatically mirrors Supabase tables into the existing SQLite database. The module's existing SQLite CRUD continues to work unchanged. PowerSync watches for local writes and syncs them to Supabase in the background.

This dramatically reduces per-module work from ~1,500 LOC (manual dual-layer) to ~400 LOC (cloud schema + sync rules only).

**Files touched per module:** 3-4 files created, 1 modified.

---

### Phase 4: Cloud-Enable Tier 2 Modules (6 hours)

**Modules (8 total):**

| Module | Tables | Notes |
|--------|--------|-------|
| Nutrition | 8 | Food diary sync |
| Recipes | 10 | Shared recipe collections |
| Journal | 6 | Private journal sync (high sensitivity) |
| Cycle | 6 | Menstrual tracking (high sensitivity, RLS critical) |
| Mood | 5 | Mood patterns across devices |
| Pets | 8 | Vet records sync |
| Car | 8 | Maintenance records sync |
| Notes | 8 | Note sync across devices |

Same pattern as Phase 3. The high-sensitivity modules (journal, cycle) get extra RLS scrutiny.

---

### Phase 5: Cloud-Enable Tier 3 Modules (4 hours)

**Remaining 10 modules:**

| Module | Tables | Notes |
|--------|--------|-------|
| Closet | 6 | Wardrobe sync |
| Fast | 4 | Fasting timer sync |
| Flash | 6 | Flashcard decks sync |
| Garden | 6 | Plant care sync |
| Homes | 10 | Already has Drizzle spec (adapt) |
| Mail | 4 | Email template sync |
| RSVP | 8 | Event planning sync |
| Stars | 6 | Astrology data sync |
| Trails | 8 | Hike/trail sync |
| Words | 6 | Vocabulary sync |
| Voice | 4 | Transcription sync |
| Subs | 6 | Subscription tracking sync |

---

### Phase 6: P2P Sync Activation (8 hours)

**Goal:** Activate the P2P sync path for users who want multi-device sync without cloud.

#### 6a. WebRTC Platform Adapters

**Mobile (Expo):**
```bash
pnpm add react-native-webrtc
```

Create `apps/mobile/lib/webrtc-adapter.ts` implementing the `TransportConnection` interface using `react-native-webrtc`.

**Web:**
Use native browser `RTCPeerConnection`. Create `apps/web/lib/webrtc-adapter.ts`.

#### 6b. Signaling Server

Minimal WebSocket relay for WebRTC offer/answer/ICE exchange:

```
deploy/signaling-server/
├── src/server.ts     # ~200 lines: room-based WebSocket relay
├── Dockerfile
└── fly.toml          # Deploy to Fly.io ($2/mo)
```

Users never send data through this server. It only relays WebRTC signaling messages (offer/answer/ICE candidates). All actual data goes peer-to-peer.

#### 6c. LAN Discovery

**Mobile:** Install `react-native-zeroconf` for mDNS.
**Web:** Not supported (browsers can't do mDNS). Use signaling server for web P2P.

#### 6d. Wire Pairing Flow

The pairing UI already exists in `data-sync.tsx`. Wire it to:
1. Generate 6-digit code via `@mylife/sync` pairing module
2. Display code / QR for scanning
3. On code entry, initiate X25519 key exchange
4. Store `PairedDevice` in sync database
5. Begin automatic sync on foreground resume

**Files touched:** ~6 new files, ~4 modified.

---

### Phase 7: Self-Host Completion (4 hours)

**Goal:** Make self-host mode production-ready so users can run their own Supabase.

#### 7a. Docker Compose for Self-Host

```yaml
# deploy/self-host/docker-compose.yml
services:
  supabase-db:
    image: supabase/postgres
    volumes: [./data/postgres:/var/lib/postgresql/data]

  supabase-auth:
    image: supabase/gotrue
    environment:
      - GOTRUE_DB_DRIVER=postgres

  powersync:
    image: journeyapps/powersync-service
    environment:
      - SUPABASE_URL=http://supabase-kong:8000

  mylife-api:
    build: ./api
    environment:
      - DATABASE_URL=postgres://...
```

#### 7b. Self-Host Setup CLI

```bash
npx @mylife/self-host init   # Generates .env, creates admin user
npx @mylife/self-host start  # docker compose up
npx @mylife/self-host backup # Snapshot PostgreSQL + SQLite
```

#### 7c. App Configuration

Users enter their self-host URL in Settings > Account > Self-Host:
- URL validated via health check endpoint
- Supabase client reconfigured to point at self-host
- PowerSync connector reconfigured
- Entitlements verified via self-host license key

---

### Phase 8: Entitlements Verification + Polish (4 hours)

- Background entitlement refresh (hourly)
- RSA signature verification on entitlement tokens
- Offline grace period (7 days without verification)
- Storage quota enforcement UI (warning at 80%, block at 100%)
- Sync conflict resolution UI (show conflicts, let user pick)

---

## 4. Media Pipeline: Video and Photo Sync (NEW)

### The Problem

Text sync is nearly free. But the moment users upload workout videos, recipe photos,
or pet pictures, storage and bandwidth costs jump 100-500x per user. A single 5-minute
1080p workout recording is larger than an entire year of text data across all 29 modules.

### Video Size Reference

| Quality | 5 min | 15 min | 60 min |
|---------|-------|--------|--------|
| 1080p raw | ~750 MB | ~2.2 GB | ~9 GB |
| 1080p compressed (H.265) | ~200 MB | ~600 MB | ~2.4 GB |
| 720p compressed (H.265) | ~100 MB | ~300 MB | ~1.2 GB |
| 480p phone-optimized | ~50 MB | ~150 MB | ~600 MB |

### Architecture: Media Never Touches PowerSync

```
User records workout video
  |
  v
Client-side compression (720p H.265, max 15 min)
  |
  v
Upload to Cloudflare R2 (zero egress)
  |
  v
Store metadata in SQLite: { r2Key, hash, size, mimeType, duration }
  |
  v
PowerSync syncs ONLY the metadata row (~200 bytes)
  |
  v
Other devices fetch video directly from R2 on demand (zero egress cost)
```

This means:
- PowerSync hosted data stays proportional to text, not media
- R2 handles storage ($0.015/GB/mo) with zero egress fees
- Videos stream device-to-device without touching the sync engine
- Deleting a video on one device syncs the metadata deletion, then a cleanup job removes from R2

### Client-Side Compression Strategy

All media uploads pass through a compression pipeline before leaving the device:

**Video:**
- Transcode to H.265 (HEVC) at 720p, 30fps
- Target bitrate: 2 Mbps (vs ~8 Mbps for raw 1080p)
- Max duration: 15 minutes per clip (configurable)
- Result: ~100-300 MB per clip vs 750 MB-2.2 GB raw
- Use expo-video-thumbnails for preview generation (sync thumbnail, not full video)

**Photos:**
- Resize to max 2048px on longest edge
- JPEG quality 80% (or WebP/AVIF where supported)
- Strip EXIF GPS data by default (privacy-first)
- Result: ~200-500 KB per photo vs 3-8 MB raw

**Compression reduces storage costs ~75% and makes the tier limits more generous.**

### Per-User Annual Cost With Video (Cloudflare R2)

| User Type | Recording Habit | Raw Storage/yr | After Compression | R2 Cost/yr |
|-----------|----------------|---------------|-------------------|-----------|
| Text-only | No media | 5 MB | 5 MB | $0.001 |
| Photo user | 200 photos/yr | 1.6 GB | 100 MB | $0.018 |
| Casual video | 1 vid/week, 5 min, 720p | 5.2 GB | 5.2 GB | $0.94 |
| Regular video | 3 vid/week, 10 min, 720p | 46.8 GB | 46.8 GB | $8.42 |
| Serious video | 5 vid/week, 15 min, 1080p->720p | 156 GB | ~40 GB | $7.20 |

With compression, a "serious" video user drops from 156 GB to ~40 GB (720p re-encode).
Still significant, but within the power tier's 25 GB limit if they manage their library.

### Modules That Generate Media

| Module | Media Type | Typical Size | Frequency |
|--------|-----------|-------------|-----------|
| **Workouts** | Progress photos, form-check videos | 200 KB-300 MB | 3-5x/week |
| **Recipes** | Dish photos, cooking videos | 200 KB-600 MB | 2-3x/week |
| **Pets** | Pet photos, vet scan uploads | 200 KB-5 MB | 1-2x/week |
| **Garden** | Plant progress photos | 200 KB-2 MB | 1-3x/week |
| **Car** | Damage photos, receipt scans | 200 KB-2 MB | Monthly |
| **Closet** | Outfit photos | 200 KB-2 MB | Daily |
| **Health** | Lab result scans | 200 KB-5 MB | Monthly |
| **Market** | Listing photos | 200 KB-5 MB | Per listing |
| **Trails** | Trail photos | 200 KB-5 MB | Per hike |
| **Journal** | Attached photos | 200 KB-2 MB | Occasional |

### Blended Media Cost at Scale (630K Cloud Users, With Compression)

| Segment | % of Users | Users | Avg Storage | Total | R2/mo |
|---------|-----------|-------|------------|-------|-------|
| Text-only | 70% | 441K | 5 MB | 2.2 TB | $33 |
| Photos only | 15% | 94.5K | 100 MB | 9.5 TB | $142 |
| Casual video | 8% | 50.4K | 5 GB | 252 TB | $3,780 |
| Regular video | 5% | 31.5K | 20 GB (compressed) | 630 TB | $9,450 |
| Serious video | 2% | 12.6K | 40 GB (compressed) | 504 TB | $7,560 |
| **Total** | | 630K | | **1,398 TB** | **$20,965/mo** |

With video users, media storage jumps to **$20,965/mo ($252K/yr)** on R2. This is now the
dominant cost, larger than text sync infrastructure.

### Media Cost Scenarios (Annual, 630K Cloud Users)

| Scenario | Text Sync Infra | R2 Media | Total | Per Cloud User/yr |
|----------|----------------|---------|-------|-------------------|
| No video (text + photos only) | $93.6K | $2.1K | **$95.7K** | **$0.15** |
| With casual video (8% of users) | $93.6K | $47.5K | **$141.1K** | **$0.22** |
| With all video tiers (15% of users) | $93.6K | $251.6K | **$345.2K** | **$0.55** |
| Self-hosted PS + all video | $55.7K | $251.6K | **$307.3K** | **$0.49** |

### Implementation: New Phase 1b -- Media Upload Pipeline (3 hours)

Add to Phase 1, after wiring the sync infrastructure:

**New package:** `packages/media/`

```typescript
// packages/media/src/compress.ts
interface CompressOptions {
  maxWidth: number;       // 2048 for photos, 1280 for video
  maxHeight: number;
  quality: number;        // 0.8 for photos
  videoBitrate: number;   // 2_000_000 for 720p
  maxDurationSec: number; // 900 (15 min)
  format: 'jpeg' | 'webp' | 'h265';
}

// packages/media/src/upload.ts
interface MediaUploadResult {
  r2Key: string;          // Content-addressed: sha256(file).ext
  hash: string;           // SHA-256 for dedup
  size: number;           // Compressed size in bytes
  mimeType: string;
  thumbnailR2Key?: string; // For video: first-frame thumbnail
}

async function uploadMedia(
  file: File | Blob,
  moduleId: ModuleId,
  options: CompressOptions,
): Promise<MediaUploadResult>

// packages/media/src/fetch.ts
async function fetchMedia(r2Key: string): Promise<Blob>
async function getMediaUrl(r2Key: string): Promise<string>  // Signed URL
```

**R2 bucket structure:**
```
mylife-media-{env}/
  {userId}/
    {moduleId}/
      {sha256hash}.jpg      # Photos
      {sha256hash}.mp4      # Videos
      {sha256hash}.thumb.jpg # Video thumbnails
```

**Integration with modules:**
- Each module stores media references as `r2_key TEXT` columns in SQLite
- PowerSync syncs the column value (a string), not the file
- On render, components call `getMediaUrl(r2Key)` to fetch/cache

**Files:** ~6 new files in `packages/media/`, R2 config, upload worker.

---

## 5. Pricing Strategy and Industry Markup Analysis

### What Storage Actually Costs vs. What Companies Charge

| Service | User Price/mo | Real Infra Cost/user/mo | Markup |
|---------|-------------|------------------------|--------|
| Obsidian Sync | $8.00 | ~$0.02-0.05 | 160-400x |
| YNAB (budget text data) | $14.99 | ~$0.01-0.03 | 500-1500x |
| iCloud 50 GB | $0.99 | ~$0.10-0.20 | 5-10x |
| iCloud 2 TB | $9.99 | ~$4-6 | 1.7-2.5x |
| Dropbox Plus 2 TB | $11.99 | ~$4-6 | 2-3x |
| Google One 100 GB | $1.99 | ~$0.20-0.40 | 5-10x |

**Pattern:** Text-only SaaS apps charge 100-1000x markup on infrastructure. Large storage
tiers are 2-3x markup. The value capture is on the sync functionality, not the raw storage.

### MyLife Pricing Options

#### Option A: Current Pricing (15-33x markup, standard SaaS)

| Tier | Limit | Price/mo | Infra Cost/mo | Markup |
|------|-------|---------|--------------|--------|
| Free | 1 GB | $0 | $0.03 | Loss leader |
| Starter | 5 GB | $2.99 | $0.09 | 33x |
| Power | 25 GB | $5.99 | $0.39 | 15x |

Revenue at 630K cloud users: **$5.65M/yr storage alone**
Total with hub + updates: **$14.0M/yr gross**

#### Option B: 3x Honest Markup (anti-enshittification play)

| Tier | Limit | Price/mo | Infra Cost/mo | Markup |
|------|-------|---------|--------------|--------|
| Free | 1 GB | $0 | $0.03 | Loss leader |
| Starter | 5 GB | $0.29 | $0.09 | 3x |
| Power | 25 GB | $1.19 | $0.39 | 3x |

Revenue at 630K cloud users: **$748K/yr storage**
Total with hub + updates: **$9.1M/yr gross**

This is the "show the math publicly" option. Price storage at 3x real cost, publish
the infrastructure breakdown. Nobody else does this. It aligns perfectly with the
Anti-Enshittification Pledge.

Trade-off: $3.9M/yr less revenue vs. a potentially viral marketing moment and
maximum trust alignment.

#### Option C: Hybrid (free text sync, paid media)

| Tier | What's Included | Price/mo |
|------|----------------|---------|
| Free | Text sync across all modules (unlimited) | $0 |
| Media | Photo sync (5 GB) | $0.99 |
| Media+ | Photo + video sync (25 GB) | $2.99 |

This separates "sync your data" (free, nearly zero cost) from "sync your media"
(paid, real infrastructure cost). It makes the free tier incredibly generous for
text-only users while charging fairly for the expensive resource (media storage).

#### Option D: $0.99/mo Flat (simplest)

One price. Includes 10 GB total (text + media). Covers 95%+ of users. Simple to
explain, simple to implement. 10x markup on average, 3x on heaviest users.

### Recommendation

**Option C (free text, paid media) aligns best with the product philosophy.**

Reasoning:
- Text sync costs ~$0.03/user/mo. Making it free costs almost nothing but differentiates
  massively against every competitor (YNAB charges $14.99/mo to sync budget text data).
- Media is where real costs live. Charging for it is fair and understandable.
- The free text tier gives every user multi-device sync out of the box. This alone would
  make MyLife the most generous app in 23 competitive categories.
- Media pricing at $0.99/$2.99 is still 3-10x cheaper than competitors.
- Revenue from media tiers ($0.99-2.99) funds infrastructure with healthy margin.

Revenue projection (Option C, 630K cloud users):

| Tier | Users | Price/mo | Annual Rev |
|------|-------|---------|-----------|
| Free text sync | 504K (80%) | $0 | $0 |
| Media ($0.99) | 94.5K (15%) | $0.99 | $1,122,660 |
| Media+ ($2.99) | 31.5K (5%) | $2.99 | $1,130,220 |
| **Storage total** | | | **$2,252,880** |
| + Hub unlock + annual updates | | | $8,394,900 |
| **Total gross** | | | **$10,647,780** |
| Apple/Google 30% cut | | | -$2,236,034 |
| Infrastructure (with video) | | | -$345,200 |
| **Net** | | | **$8,066,546** |

---

## 6. Cost Model at Scale (Revised 2026-03-29)

**Note:** Original estimates ($0.14/user/yr) were too optimistic. Revised after Codex
independent review and real pricing research. Key corrections: PowerSync hosted data
pricing ($1/GB/mo), Supabase Auth MAU overages ($0.00325/MAU), DB disk overages.

### Realistic Data Per User

Text data is much smaller than initially assumed:

| Module | Moderate User (1yr) | Heavy User (1yr) |
|--------|-------------------|-----------------|
| Budget | 500 txns = ~50 KB | 2,000 txns = ~200 KB |
| Books | 30 books = ~15 KB | 200 books = ~100 KB |
| Habits | 365 daily checks = ~35 KB | 10 habits x 365 = ~350 KB |
| Meds | 365 daily logs = ~30 KB | 5 meds x 365 = ~150 KB |
| Health | 365 entries = ~40 KB | 10 metrics x 365 = ~400 KB |
| Journal | 200 entries x 500 words = ~600 KB | 365 x 1000 words = ~2 MB |
| Notes | 100 notes = ~100 KB | 500 notes = ~500 KB |
| All other modules | ~200 KB | ~1 MB |
| **Total** | **~1.1 MB** | **~5 MB** |

**Realistic weighted average: 2-5 MB/user** (not 25 MB).

### Assumptions

- **Total users:** 2.1M (seed target from business plan)
- **Cloud adoption:** 30% opt into cloud sync (630K cloud users)
- **Average synced text data:** 5 MB/user (realistic), 15 MB/user (conservative)
- **Media storage:** Cloudflare R2 (zero egress), NOT synced through PowerSync
- **Media distribution:** 60% text-only, 25% light (100MB), 10% medium (500MB), 4% heavy (1GB), 1% power (5GB)

### Infrastructure Costs -- Three Scenarios

#### Scenario A: 5 MB/user text + R2 media (REALISTIC)

630K users x 5 MB = 3.15 TB synced data

| Line Item | Monthly Cost |
|-----------|-------------|
| Supabase Auth MAU (630K - 100K) x $0.00325 | $1,722 |
| Supabase DB disk (3,150 GB - 8 GB) x $0.125 | $393 |
| Supabase egress (~630 GB - 250 GB) x $0.09 | $34 |
| PowerSync hosted data (3,150 GB - 10 GB) x $1 | $3,140 |
| PowerSync synced data (~630 GB - 30 GB) x $1 | $600 |
| PowerSync connections | $140 |
| Supabase compute add-on | $200 |
| Cloudflare R2 media storage (blended) | $1,560 |
| Signaling server (Fly.io, P2P relay) | $10 |
| **Total** | **$7,799/mo = $93.6K/yr** |
| **Per cloud user** | **$0.15/yr** |
| **Per total user (2.1M)** | **$0.045/yr** |

#### Scenario B: 15 MB/user text + R2 media (CONSERVATIVE)

630K users x 15 MB = 9.45 TB synced data

| Line Item | Monthly Cost |
|-----------|-------------|
| Supabase + PowerSync (text sync) | $14,950 |
| Cloudflare R2 media | $1,560 |
| Signaling + misc | $210 |
| **Total** | **$16,720/mo = $200.6K/yr** |
| **Per cloud user** | **$0.32/yr** |

#### Scenario C: Self-hosted PowerSync (COST-OPTIMIZED)

Same as Scenario A but PowerSync self-hosted on Fly.io:

| Line Item | Monthly Cost |
|-----------|-------------|
| Supabase managed (Auth + DB) | $2,349 |
| PowerSync self-hosted (3 API + 3 Mongo + storage) | $521 |
| Cloudflare R2 media | $1,560 |
| Signaling + misc | $210 |
| **Total** | **$4,640/mo = $55.7K/yr** |
| **Per cloud user** | **$0.09/yr** |

### Media Cost Breakdown (Cloudflare R2, zero egress)

| User Type | Avg Media | R2 Storage/yr | Supabase Storage/yr | Savings with R2 |
|-----------|----------|--------------|--------------------|----|
| Text-only | 0 MB | $0.00 | $0.00 | -- |
| Light media | 100 MB | $0.018 | $0.034 | 47% |
| Medium media | 500 MB | $0.090 | $0.171 | 47% |
| Heavy media (workout vids) | 1 GB | $0.180 | $0.342 | 47% |
| Power user | 5 GB | $0.900 | $1.710 | 47% |

**Critical rule: media NEVER goes through PowerSync.** Sync only metadata (file hash, URL, dimensions). Store actual files in R2. This prevents media from inflating the PowerSync hosted data bill.

### Revenue at 2.1M Users

| Revenue Stream | Adoption | Annual Revenue |
|----------------|----------|---------------|
| Hub unlock ($19.99) | 15% of total | $6,297,000 |
| Annual update ($9.99) | 10% of total | $2,097,900 |
| Storage starter ($35.88/yr) | 4.5% of total (15% of cloud) | $3,388,140 |
| Storage power ($71.88/yr) | 1.5% of total (5% of cloud) | $2,264,760 |
| **Total gross** | | **$14,047,800** |
| Apple/Google 30% cut (mobile only, ~70% of rev) | | -$2,950,038 |
| Infrastructure (Scenario A) | | -$93,600 |
| **Net revenue** | | **$11,004,162** |

**Infrastructure is 0.7% of revenue (Scenario A) or 0.4% (Scenario C).** Cloud sync remains cheap at scale for a text-first product.

### Hidden Costs to Watch

These are the items Codex and pricing research flagged as commonly missed:

1. **PowerSync hosted data ($1/GB/mo)** -- the single biggest variable cost
2. **Supabase Auth MAU overages ($0.00325/MAU)** -- adds up past 100K
3. **Supabase DB disk ($0.125/GB)** -- scales with total data
4. **RLS performance** -- bad index/policy design shows up as compute pain, not a neat line item
5. **Private media egress** -- signed URLs behave like uncached egress, not CDN-cached
6. **Supabase connection pooling limits** -- up to 12,000 on 16XL compute tier
7. **PowerSync container scaling** -- ~1 API container per 100 concurrent connections if self-hosted
8. **NAT gateways on AWS** -- silent tax if you self-host there (Fly.io avoids this)
9. **PITR/backups/log drains/observability** -- not included in base pricing

### Break-Even Analysis (Scenario A)

| Scale | Monthly Infra | Annual Infra | Min Revenue to Break Even |
|-------|-------------|-------------|--------------------------|
| 100 cloud users | $0 (free tier) | $0 | $0 |
| 500 cloud users | ~$25 | $300 | 1 storage starter |
| 1,000 cloud users | ~$55 | $660 | 2 storage starters |
| 5,000 cloud users | ~$350 | $4,200 | 10 storage starters |
| 10,000 cloud users | ~$750 | $9,000 | 21 storage starters |
| 50,000 cloud users | ~$3,500 | $42,000 | 98 storage starters |

### TCO Comparison (per cloud user per year, text-only, 5MB/user)

| Stack | 10K users | 100K users | 1M users | Notes |
|-------|----------|-----------|---------|-------|
| Supabase + PowerSync managed | $0.38 | $0.40 | $0.43 | Current plan |
| Supabase + PowerSync self-hosted | $0.15 | $0.12 | $0.09 | Recommended long-term |
| Cloudflare D1 + Workers + R2 | $0.23 | $0.29 | $0.28 | Cheapest raw infra, most custom sync work |
| Firebase (Firestore) | $0.05 | $0.09 | $0.11 | Data model mismatch |
| Plain AWS (RDS + S3 + Lambda) | $0.16 | $0.12 | $0.10 | Highest ops burden |

---

## 5. Pricing Impact Analysis

### Can Free Users Get Cloud?

**Yes.** Even at the revised $0.15/user/yr (Scenario A):

1. **Text data is tiny.** A moderate user across all 29 modules generates ~1.1 MB/year. The 1GB free tier gives them ~900 years of headroom.

2. **Free tier infrastructure is free.** Supabase free tier (500MB DB, 50K MAU) and PowerSync free tier handle your first ~500 cloud users at $0.

3. **Upsell is natural.** Users hitting 1GB are likely storing media. The storage tier upsell ($2.99/mo) funds 240 free cloud users per paying subscriber.

### Does $5/yr (Original Plan) Still Work?

**Yes.** At $5/yr with 30% cloud adoption:

| Users | Annual Revenue | Annual Infra (Scenario A) | Margin |
|-------|---------------|-------------|--------|
| 10K | $50K | $9K | 82% |
| 100K | $500K | $48K | 90% |
| 1M | $5M | $93.6K | 98% |

The local-first architecture means non-cloud users cost $0. Cloud users cost $0.09-0.32/yr depending on data and hosting choices. $5/yr works at any scale.

### Current Pricing ($19.99 + $9.99/yr) is Even Better

Three revenue layers:
1. **Hub unlock** ($19.99 one-time) -- covers acquisition cost
2. **Annual update** ($9.99/yr) -- recurring base revenue
3. **Storage tiers** ($0/2.99/5.99 per month) -- infrastructure cost + profit

This separates "app value" from "cloud cost" cleanly. Infrastructure is self-funding from storage tier revenue alone.

---

## 8. Implementation Priority

```
NOW (Pre-launch):
  Phase 1:  Wire sync infrastructure ......... 4 hours
  Phase 1b: Media upload pipeline (R2) ....... 3 hours
  Phase 3:  Budget + Meds cloud adapters ..... 3 hours (subset)

POST-LAUNCH (When users request it):
  Phase 3: Remaining Tier 1 modules ......... 5 hours
  Phase 6: P2P sync activation .............. 8 hours
  Phase 2: PowerSync rules for forums/market  2 hours

GROWTH (1K+ cloud users):
  Phase 4: Tier 2 modules ................... 6 hours
  Phase 5: Tier 3 modules ................... 4 hours
  Phase 7: Self-host completion ............. 4 hours
  Phase 8: Polish ........................... 4 hours

SCALE (PowerSync bill > $2K/mo):
  Self-host PowerSync on Fly.io ............. 4 hours
```

**Total estimated effort: ~47 hours CC time.**

**Recommendation:** Do Phase 1 + 1b now so the "Data Sync" settings screen actually works
on launch and media uploads route to R2 from day one. Then enable cloud for Budget and Meds
first since those are the modules where multi-device sync has the highest user demand.

---

## 9. Key Decisions Needed

1. **PowerSync vs. custom sync?** Recommendation: PowerSync. It eliminates ~5,000 lines of custom sync code and handles offline queue, conflict resolution, and retry logic. Cost is reasonable ($49-199/mo at early scale).

2. **All modules cloud-eligible, or opt-in subset?** Recommendation: All modules. With PowerSync, enabling a module for cloud sync is just adding sync rules to `powersync.yaml` + deploying the Supabase schema. Per-module marginal cost is near zero.

3. **Free cloud tier size?** Recommendation: Free unlimited text sync, paid media tiers (Option C from Section 5). Text sync costs ~$0.03/user/mo, making it free is a massive differentiator at negligible cost. Media tiers at $0.99/$2.99 fund actual infrastructure.

4. **P2P before or after cloud?** Recommendation: Cloud first (easier, more reliable, infrastructure exists). P2P is a differentiator but requires WebRTC platform work + signaling server. Ship it post-launch.

5. **Media storage provider?** Recommendation: Cloudflare R2. Zero egress fees ($0.015/GB/mo storage only). A user with 1GB workout videos costs $0.18/yr on R2 vs $0.34/yr on Supabase Storage. At scale with video users streaming across devices, zero egress is the difference between viable and not.

6. **Client-side compression?** Recommendation: Yes, mandatory. Transcode video to 720p H.265 before upload. Resize photos to 2048px max, JPEG 80%. Reduces storage 75% and makes tier limits 4x more generous for users.

7. **PowerSync managed vs self-hosted?** Recommendation: Start managed (simpler), migrate to self-hosted when PowerSync hosted data bill exceeds ~$2K/month (~2TB). Self-hosted on Fly.io costs ~$500/mo for 3TB vs ~$3,140/mo managed.

8. **Pricing model?** Recommendation: Option C (free text sync, paid media). See Section 5. This is the strongest anti-enshittification play: "Your data syncs free. Storage for photos and videos starts at $0.99/mo." Revenue still covers infrastructure 6-8x over.
