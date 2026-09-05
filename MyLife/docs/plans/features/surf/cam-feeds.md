# Feature Spec: Cam Feeds

## Metadata
- **Module:** surf
- **Priority Score:** 26 / 50 (B-Tier)
- **Scoring Breakdown:** Market 1 x3 + Switching 5 x3 + Complexity 1 x2 + CrossModule 1 x1 + PaidUser 5 x1
- **Sprint:** TBD
- **Estimated CC Time:** 5-7 hours
- **Depends On:** none
- **Blocks:** none

## Business Context

### Why This Feature Exists
Live surf cams are the single most compelling reason surfers pay for Surfline Premium ($119.99/yr). The ability to visually confirm conditions before driving to the beach is a daily-use feature for committed surfers. This is Surfline's moat. MySurf cannot compete for premium subscribers without some form of visual condition verification.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Surfline | Yes | Yes (premium for HD + rewind) | 950+ proprietary cameras, HD streaming, 2-day rewind, still snapshots every 10min |
| Magic Seaweed | No (acquired by Surfline) | N/A | Redirects to Surfline cams |
| Windy | No | N/A | No cam feature, weather visualization only |

### Target User
Daily surfers who check conditions before their session. Currently paying Surfline $119.99/yr primarily for cam access. MySurf offering cams (even community-sourced or lower coverage) removes the biggest reason to keep a Surfline subscription.

## Technical Context

### Where This Lives in MyLife

```
modules/surf/src/types.ts               -- CamFeedSchema, CamSnapshotSchema
modules/surf/src/db/schema.ts           -- sf_cam_feeds, sf_cam_snapshots tables
modules/surf/src/db/crud.ts             -- Cam CRUD functions
modules/surf/src/cloud/cams.ts          -- NEW: cloud cam queries
modules/surf/src/cloud/index.ts         -- Export cam functions
modules/surf/src/index.ts               -- Export new types and CRUD
modules/surf/src/definition.ts          -- V4 migration (or V5 if multi-region is V4)
apps/mobile/app/(surf)/cam/[id].tsx     -- Cam viewer screen
apps/mobile/app/(surf)/spot/[id].tsx    -- Add cam section to spot detail
apps/web/app/surf/spot/[slug]/cam/page.tsx -- Web cam viewer
```

### Wireframe Position

```
Hub Dashboard
  └── MySurf card
       └── Spots tab (existing)
            └── Spot Detail
                 └── Cam Feed section ← NEW (below forecast, above reviews)
                      └── Live stream / latest snapshot
                      └── Snapshot history (timeline scrubber)
       └── Map tab (existing)
            └── Cam icon overlay on spots with cameras ← NEW
```

### Data Model

```sql
-- Cam feed sources linked to spots
CREATE TABLE IF NOT EXISTS sf_cam_feeds (
  id TEXT PRIMARY KEY,
  spot_id TEXT NOT NULL REFERENCES sf_spots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stream_url TEXT,
  snapshot_url TEXT,
  source TEXT NOT NULL DEFAULT 'community',
  status TEXT NOT NULL DEFAULT 'active',
  orientation_deg REAL,
  resolution TEXT,
  is_premium INTEGER NOT NULL DEFAULT 0,
  last_checked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Periodic cam snapshots (stored as image URLs)
CREATE TABLE IF NOT EXISTS sf_cam_snapshots (
  id TEXT PRIMARY KEY,
  cam_id TEXT NOT NULL REFERENCES sf_cam_feeds(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  captured_at TEXT NOT NULL,
  conditions_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS sf_cams_spot_idx ON sf_cam_feeds(spot_id);
CREATE INDEX IF NOT EXISTS sf_cams_status_idx ON sf_cam_feeds(status);
CREATE INDEX IF NOT EXISTS sf_snapshots_cam_time_idx ON sf_cam_snapshots(cam_id, captured_at DESC);
```

**Source types:**
- `community` -- user-submitted cam URLs (e.g., YouTube live streams, personal IP cams)
- `partner` -- negotiated feeds from surf shops, hotels, or municipalities
- `public` -- publicly accessible DOT/harbor/lifeguard cameras

**Status values:** `active`, `offline`, `maintenance`, `removed`

### Dependencies
- **Internal:** `@mylife/db` (migration orchestration), Supabase Storage (snapshot image hosting)
- **External:** HLS/DASH video player library (e.g., `react-native-video` for mobile, `hls.js` for web), image CDN for snapshot hosting (Cloudflare R2 via existing Supabase storage)
- **Cross-Module:** None

## Functional Requirements

### User Stories
1. As a surfer, I want to see a live cam feed for my favorite spot so I can check conditions visually before driving.
2. As a surfer, I want to browse recent snapshots for a spot so I can see how conditions changed throughout the day.
3. As a community member, I want to submit a public cam URL for a spot that doesn't have one yet.
4. As a premium user, I want access to higher-resolution streams and longer snapshot history.

### Behavior Specification

1. User navigates to a spot detail page
2. If the spot has cam feeds, a "Cam" section appears below the forecast section
3. The cam section shows:
   - **Live feed** (if stream_url is available): embedded video player with play/pause
   - **Latest snapshot** (if snapshot_url is available): full-width image with timestamp
   - **Snapshot timeline**: horizontal scrollable strip of thumbnails from the past 24 hours
4. User taps a snapshot thumbnail to see it full-screen with pinch-to-zoom
5. User taps "View all snapshots" to see a grid view of the past 7 days of snapshots
6. On the Map screen, spots with active cams show a small camera icon overlay on their pin
7. User can submit a cam URL via "Add Cam" button on spots without cameras -- goes to a submission form
8. Submitted cams go into a `pending` state until verified (manual or automated health check)

### Edge Cases

- **Stream URL is offline:** Show "Cam offline" badge with the last captured snapshot and timestamp. Do not show a broken player.
- **No cam for spot:** Show "No cam available" with "Submit a cam URL" CTA. Do not show an empty section.
- **HLS stream fails to load:** Fall back to latest snapshot with "Live stream unavailable" message.
- **Snapshot CDN is slow:** Show skeleton placeholders with progressive loading.
- **User submits invalid URL:** Validate URL format client-side. Server-side health check pings the URL within 60s.
- **Multiple cams per spot:** Show cam picker tabs (e.g., "North View", "South View"). Default to the first active cam.
- **Very old snapshots (>24h):** Show timestamp in relative format ("2 days ago") and a stale-data warning banner.
- **Offline mode:** Cache the 3 most recent snapshots per favorited spot for offline viewing. Live streams are not available offline.
- **Large snapshot images:** Thumbnails are 200px wide, full images are max 1920px. CDN handles resizing.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Spot detail shows "Cam" section when the spot has at least one active cam feed
- [ ] **AC-2:** Live stream plays inline with play/pause controls when stream_url is available
- [ ] **AC-3:** Latest snapshot displays with captured_at timestamp in relative format
- [ ] **AC-4:** Snapshot timeline shows thumbnails for the past 24 hours, scrollable horizontally
- [ ] **AC-5:** Tapping a snapshot opens it full-screen with pinch-to-zoom (mobile) or modal (web)
- [ ] **AC-6:** Map pins show camera icon overlay for spots with active cams
- [ ] **AC-7:** Spots without cams show "No cam available" with "Submit a cam" CTA
- [ ] **AC-8:** Cam submission form accepts a URL and optional name/description
- [ ] **AC-9:** Multiple cams per spot are selectable via tab-style picker

### Technical Criteria
- [ ] **TC-1:** Migration creates `sf_cam_feeds` and `sf_cam_snapshots` tables with indexes
- [ ] **TC-2:** Cam CRUD: create, list by spot, update status, delete
- [ ] **TC-3:** Snapshot CRUD: create, list by cam (paginated), delete old (>30 days)
- [ ] **TC-4:** Cloud adapter `cloudGetSpotCams(spotId)` returns active cams with latest 24h snapshots
- [ ] **TC-5:** Cloud adapter `cloudGetCamSnapshots(camId, hours)` returns paginated snapshot list
- [ ] **TC-6:** Cloud adapter `cloudSubmitCamFeed(spotId, url, name)` creates a pending cam entry
- [ ] **TC-7:** Snapshot images served via CDN with automatic thumbnail generation
- [ ] **TC-8:** Cam status health check: if stream_url returns non-200 for >1 hour, status flips to `offline`

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Broken video players must NOT appear -- fall back to snapshot on any stream error
- [ ] **NC-2:** Cam submissions must NOT go live without verification
- [ ] **NC-3:** Snapshot storage must NOT grow unbounded -- enforce 30-day retention

## UI Specification

### Mobile (Expo)

- **Cam section on spot detail:** Full-width card below forecast. Glass card (`rgba(255,255,255,0.04)`) with `rgba(255,255,255,0.10)` border.
  - Live stream: 16:9 aspect ratio video player with rounded corners, play button overlay
  - Snapshot: Full-width image with timestamp badge in bottom-right corner
  - Timeline: Horizontal FlatList of 80px square thumbnails with time labels
- **Camera icon on map:** Small `#3B82F6` camera badge on the spot pin marker
- **Full-screen viewer:** Dark background (`#0A0A0F`), image fills width, pinch-to-zoom enabled
- Background: `#0A0A0F`, accent: `#3B82F6`

### Web (Next.js)

- **Cam section on spot detail:** Same layout, video uses `hls.js` for HLS streams or native `<video>` for MP4
- **Full-screen viewer:** Modal overlay with lightbox navigation between snapshots
- Route: `/surf/spot/[slug]/cam` for dedicated cam page with full history
- Same Cool Obsidian tokens via CSS variables

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton 16:9 card with shimmer animation | Cam data fetching |
| Empty | "No cam available" message + "Submit a cam" button | Spot has no cam feeds |
| Error | "Unable to load cam" + retry button | Network/CDN failure |
| Success | Live stream or latest snapshot + timeline thumbnails | Cam data loaded |
| Partial | Latest snapshot visible, stream shows "Live unavailable" | Stream offline, snapshots available |

## Test Requirements

### Unit Tests
- [ ] Cam CRUD: create cam feed, list by spot, update status, delete
- [ ] Snapshot CRUD: create snapshot, list by cam with time filter, delete old snapshots
- [ ] Cam status transitions: active -> offline -> active
- [ ] URL validation for cam submission
- [ ] Migration: sf_cam_feeds and sf_cam_snapshots tables created with correct schema

### Integration Tests
- [ ] Full flow: submit cam -> verify pending status -> activate -> query from spot detail
- [ ] Snapshot timeline: create 25 snapshots over 24h period -> query returns chronological list
- [ ] Multiple cams per spot: create 2 cams -> query returns both sorted by name

### QA Verification Script

1. Open the app on mobile
2. Navigate to a spot that has cam feeds configured
3. Verify the Cam section appears below the forecast -- corresponds to AC-1
4. If live stream is available, verify video plays with controls -- corresponds to AC-2
5. Verify latest snapshot shows with timestamp -- corresponds to AC-3
6. Scroll the snapshot timeline, verify thumbnails load -- corresponds to AC-4
7. Tap a snapshot thumbnail, verify full-screen view with zoom -- corresponds to AC-5
8. Navigate to Map, verify camera icon on spots with cams -- corresponds to AC-6
9. Navigate to a spot without cams, verify "No cam available" message -- corresponds to AC-7
10. Tap "Submit a cam", fill in URL and name, submit -- corresponds to AC-8
11. For a spot with multiple cams, verify tab picker works -- corresponds to AC-9

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- if module has standalone counterpart
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- MySurf has no cam or visual feed capability
- Spot detail shows forecast, buoy data, narratives, reviews, photos, and guides
- No video player infrastructure in the app

### After This Work
- `sf_cam_feeds` and `sf_cam_snapshots` tables exist
- Cam CRUD and cloud adapters implemented
- Spot detail shows cam section when feeds are available
- Map shows camera overlay icons
- Community cam submission flow works
- Video player (HLS) integrated for live streams
- Snapshot timeline with 24h history browsable

### Files Changed

- `modules/surf/src/types.ts` -- Add CamFeedSchema, CamSnapshotSchema, CamSourceSchema, CamStatusSchema
- `modules/surf/src/db/schema.ts` -- New table DDL and indexes
- `modules/surf/src/db/crud.ts` -- Cam and snapshot CRUD functions
- `modules/surf/src/cloud/cams.ts` -- New cloud adapter file for cam queries
- `modules/surf/src/cloud/index.ts` -- Export cam functions
- `modules/surf/src/definition.ts` -- Migration version bump
- `modules/surf/src/index.ts` -- Export new types and CRUD
- `apps/mobile/app/(surf)/cam/[id].tsx` -- New cam viewer screen
- `apps/mobile/app/(surf)/spot/[id].tsx` -- Add cam section
- `apps/web/app/surf/spot/[slug]/cam/page.tsx` -- New web cam page

### Known Limitations
- Initial launch relies on community-submitted and public cam URLs -- no proprietary camera network
- Live stream quality depends on the source URL -- MySurf does not transcode or host streams
- Snapshot capture requires a server-side worker (Supabase Edge Function or cron) to periodically screenshot streams
- Cam verification is initially manual -- automated health checks are a fast-follow
- No rewind/DVR capability in V1 -- only live + snapshot history

### Context for Next Agent
- The video player library choice is critical: `react-native-video` v6+ for mobile (supports HLS), `hls.js` for web. Both need to be added as dependencies.
- Snapshot image storage should use Supabase Storage with CDN (existing infrastructure from spot photos).
- The cam submission flow needs moderation -- consider a simple admin flag or crowd-sourced upvote threshold before activation.
- Surfline's moat is their proprietary camera network. MySurf's strategy is community-sourced + municipal/public cams + partner agreements. The tech is simpler than Surfline's but the content acquisition is the real challenge.
