# Feature Spec: Offline Fallback

## Metadata
- **Module:** words
- **Priority Score:** 23 / 50 (B-Tier)
- **Scoring Breakdown:** Market [2] x3 + Switching [3] x3 + Complexity [3] x2 + CrossModule [1] x1 + PaidUser [1] x1
- **Sprint:** 5
- **Estimated CC Time:** 2-3 hours
- **Depends On:** Saved words persistence (must be complete; `wd_saved_words.lookup_data` provides the offline data source)
- **Blocks:** none

## Business Context

### Why This Feature Exists
MyWords currently requires a network connection for every lookup (`requiresNetwork: true` in the module definition). If the user is offline (airplane mode, subway, poor reception), the entire module is unusable. Dictionary.com offers a full offline dictionary with 300,000+ entries in their premium tier. For MyLife, we already store full `lookup_data` JSON for every saved word. The offline fallback surfaces this cached data when the network is unavailable, plus caches recent non-saved lookups in a local SQLite table. This transforms MyWords from a network-dependent reference tool into a progressively-capable dictionary that gets better the more you use it.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Dictionary.com | Yes | Premium ($2.99/mo) | Full offline dictionary download (300K+ words). Premium-only feature. Requires ~150MB storage. |
| Merriam-Webster | Partial | Free | Recently viewed words are cached for offline access. No full dictionary download. |
| WordReference | No | N/A | Fully online. No offline capability. |
| Google Translate | Yes | Free | Downloaded language packs for offline translation. 35-90MB per language. |

### Target User
Users who look up words in situations with unreliable connectivity: commuters on subways, travelers, students in lecture halls with spotty WiFi, readers who look up words on e-readers/tablets without cellular. Also, users in developing markets where mobile data is expensive or unreliable. The switching motivation (3/5) reflects that offline access is a key differentiator for Dictionary.com Premium. MyLife's approach is lighter-weight: cache what you've already looked up rather than downloading an entire dictionary.

## Technical Context

### Where This Lives in MyLife

```
modules/words/src/
  db/
    schema.ts                      -- Updated: V3 migration adds wd_lookup_cache table
    crud.ts                        -- Updated: new cache CRUD functions
  offline.ts                       -- NEW: offline fallback logic (cache check, stale handling)
  service.ts                       -- Updated: wrap lookupWord with offline fallback
  types.ts                         -- New OfflineLookupResult type
  definition.ts                    -- Add V3 migration, bump schemaVersion
  index.ts                         -- Export offline functions

apps/mobile/app/(words)/
  lookup.tsx                       -- Updated: offline indicator banner, cached result badge

apps/web/app/words/
  page.tsx                         -- Updated: offline indicator, cached result badge
```

### Wireframe Position

```
Hub Dashboard
  └── MyWords card
       └── Lookup tab
            └── [Offline banner: "You're offline. Showing cached results."] ← YOU ARE HERE
            └── [Search results with "Cached" badge if from local data]
       └── Saved tab (already works offline -- SQLite reads)
```

### Data Model

```sql
-- Migration V3: Lookup cache for offline fallback
CREATE TABLE IF NOT EXISTS wd_lookup_cache (
  id TEXT PRIMARY KEY NOT NULL,
  word TEXT NOT NULL,
  language_code TEXT NOT NULL,
  lookup_data TEXT NOT NULL,              -- full MyWordsLookupResult as JSON
  data_size_bytes INTEGER NOT NULL,       -- size of lookup_data for LRU eviction
  fetched_at TEXT NOT NULL,               -- when the API result was originally fetched
  last_accessed_at TEXT NOT NULL,         -- for LRU eviction
  access_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wd_lookup_cache_word_lang
  ON wd_lookup_cache(word, language_code);
CREATE INDEX IF NOT EXISTS idx_wd_lookup_cache_accessed
  ON wd_lookup_cache(last_accessed_at ASC);
CREATE INDEX IF NOT EXISTS idx_wd_lookup_cache_size
  ON wd_lookup_cache(data_size_bytes DESC);
```

### Dependencies
- **Internal:** `@mylife/words` (lookupWord, truncateLookupData), `@mylife/db` (DatabaseAdapter)
- **External:** None. Network connectivity detection via React Native's `NetInfo` (mobile) or `navigator.onLine` (web).
- **Cross-Module:** None directly, but offline cached data enriches the Flash bridge (flashcard creation works offline if the word was previously cached).

## Functional Requirements

### User Stories
1. As a commuter on the subway, I want to look up words I've previously searched so that I can keep reading without cellular data.
2. As a frequent user, I want my recent lookups cached automatically so that offline access happens without any manual action.
3. As a storage-conscious user, I want the cache to stay within a reasonable size so that it doesn't consume excessive device storage.
4. As a user coming back online, I want to see that cached results may be stale so that I know to refresh for the latest data.

### Behavior Specification

**Automatic cache-on-lookup (online):**
1. User looks up a word while online (existing flow)
2. After the API returns a successful result, system writes it to `wd_lookup_cache`
3. If the word+language already exists in cache: update `lookup_data`, `fetched_at`, `last_accessed_at`, increment `access_count`
4. If the cache exceeds the size limit (default: 50MB total data_size_bytes): evict least-recently-accessed entries until under limit
5. User sees no difference in the normal online flow (caching is transparent)

**Offline lookup flow:**
1. User opens Lookup tab while offline (or network request fails)
2. System detects offline state via NetInfo (mobile) or navigator.onLine (web)
3. Search bar shows an offline indicator banner: "You're offline. Showing cached results."
4. User types a word and taps search
5. System checks `wd_lookup_cache` for exact word+language match
6. If found: display the cached `MyWordsLookupResult` with a "Cached" badge and the `fetched_at` timestamp ("Cached 2 days ago")
7. If not found in cache: check `wd_saved_words` for the word (saved words always have `lookup_data`)
8. If found in saved words: display with "Saved" badge
9. If not found anywhere: show "Not available offline. This word hasn't been looked up before." with a prompt to search when back online
10. Update `last_accessed_at` and `access_count` on cache hit

**Offline browse (saved words):**
1. Saved tab already works fully offline (SQLite reads)
2. No changes needed for basic saved word browsing
3. "Look Up Again" button on saved word detail is disabled/hidden when offline

**Cache prefix search (offline autocomplete):**
1. When offline, the search bar offers autocomplete from cached words
2. As the user types, query `wd_lookup_cache` and `wd_saved_words` for words starting with the typed prefix
3. Show up to 10 suggestions from cache + saved words, deduped

**Coming back online:**
1. When connectivity is restored, the offline banner dismisses
2. Cached results remain valid until they expire or are evicted
3. If a user views a cached result and comes back online, a "Refresh" button appears to re-fetch from API

**Cache management (Settings tab):**
1. Settings tab shows "Offline Cache" section
2. Displays: "X words cached (Y MB used of 50 MB limit)"
3. "Clear Cache" button: deletes all `wd_lookup_cache` rows (does NOT affect saved words)
4. Cache limit slider: 10MB to 100MB, default 50MB

### Edge Cases

- **Network flapping:** If the network toggles between online and offline rapidly, debounce the state change (500ms) to avoid flickering the offline banner.
- **Partial network failure:** If the API call times out (after 5 seconds) but the device reports online, fall back to cache and show "Lookup failed. Showing cached result." with a retry button.
- **Cache exceeds limit during bulk lookups:** If a user looks up many words in succession, eviction runs after each insert. Eviction deletes the oldest-accessed entries first. Never evict entries that are also in `wd_saved_words` (saved words have their own `lookup_data` column).
- **Very large lookup_data entries:** Some words produce 80-100KB of JSON. The `data_size_bytes` column tracks this. Eviction prioritizes removing large, infrequently-accessed entries (score = `data_size_bytes / access_count`).
- **Cache table grows unbounded:** The eviction policy is enforced after every insert. Additionally, a periodic cleanup runs on module init: delete entries not accessed in 30 days.
- **Saved word lookup_data is null:** Possible if the word was saved from an in-memory cache before the API returned. In this case, fall back to `wd_lookup_cache`. If both are null, show "Not available offline."
- **Language not previously used offline:** If the user switches to a language they've never looked up words in, the cache will be empty for that language. Show the "Not available offline" state.
- **Module version upgrade:** Old cached `lookup_data` JSON may have a different shape. Parse gracefully with fallbacks for missing fields.
- **Concurrent cache writes:** SQLite handles concurrent writes via WAL mode. No special locking needed.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Looking up a word online automatically caches the result in `wd_lookup_cache`
- [ ] **AC-2:** An offline indicator banner appears on the Lookup tab when the device is offline
- [ ] **AC-3:** Looking up a previously-cached word offline shows the cached result with a "Cached [time ago]" badge
- [ ] **AC-4:** Looking up a saved word offline shows the result from `wd_saved_words.lookup_data` with a "Saved" badge
- [ ] **AC-5:** Looking up an uncached, unsaved word offline shows "Not available offline" message
- [ ] **AC-6:** Offline search provides autocomplete suggestions from cached and saved words
- [ ] **AC-7:** When connectivity is restored, the offline banner dismisses and a "Refresh" option appears on cached results
- [ ] **AC-8:** Settings tab shows cache size and word count with a "Clear Cache" button
- [ ] **AC-9:** Cache respects the size limit (default 50MB) by evicting least-recently-accessed entries
- [ ] **AC-10:** "Look Up Again" button on saved word detail is hidden/disabled when offline

### Technical Criteria
- [ ] **TC-1:** Migration V3 creates `wd_lookup_cache` table with all columns and indexes
- [ ] **TC-2:** Unique index on (word, language_code) prevents duplicate cache entries
- [ ] **TC-3:** Cache writes happen asynchronously after API response (do not block UI)
- [ ] **TC-4:** LRU eviction runs when total `data_size_bytes` exceeds configured limit
- [ ] **TC-5:** Stale entry cleanup removes entries not accessed in 30+ days on module init
- [ ] **TC-6:** API timeout of 5 seconds triggers cache fallback even when device reports online
- [ ] **TC-7:** Network state changes are debounced at 500ms
- [ ] **TC-8:** Cache prefix search returns results in <100ms for collections of 10,000+ entries

### Negative Criteria
- [ ] **NC-1:** Cache eviction must NOT delete lookup_data from `wd_saved_words` (those are separate, permanent)
- [ ] **NC-2:** Clearing the cache must NOT affect saved words in any way
- [ ] **NC-3:** The offline fallback must NOT attempt network calls when the device reports offline
- [ ] **NC-4:** Cache writes must NOT block the main thread or delay UI rendering
- [ ] **NC-5:** The module definition must still set `requiresNetwork: false` after this feature (it degrades gracefully)

## UI Specification

### Mobile (Expo)

**Offline Banner:**
- Horizontal bar at top of Lookup tab, below search bar
- Background: `rgba(255,69,58,0.15)` (danger tint at 15% opacity)
- Text: "You're offline. Showing cached results." in `rgba(240,240,245,0.65)` (textSecondary)
- Icon: wifi-off icon (Lucide) left-aligned
- Dismisses smoothly when connectivity restores (300ms fade)

**Cached Result Badge:**
- Small pill badge below the word title on lookup results
- "Cached 2 days ago" or "Saved" for results from saved words
- Background: `rgba(255,255,255,0.08)` (glassStrong), text: `rgba(240,240,245,0.65)`
- "Refresh" link (accent `#0EA5E9`) appears next to badge when back online

**Offline Autocomplete:**
- Same search bar dropdown as online autocomplete
- Results prefixed with cache/saved icon to distinguish source
- Max 10 suggestions, cache results first, then saved words

**Settings > Offline Cache:**
- Glass card section in Settings tab
- Title: "Offline Cache"
- Stats row: "247 words cached (12.3 MB / 50 MB)"
- Progress bar showing cache fullness, accent color fill
- "Clear Cache" destructive button (danger color)
- Cache limit slider: 10-100 MB with current value label

### Web (Next.js)

- Same offline banner using `navigator.onLine` event listener
- Cached result badge on lookup results
- Settings section for cache management
- Same autocomplete behavior

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Online Normal | Standard lookup with no badge | Online + fresh API result |
| Online Cached Update | Standard result + cache updates silently | Online + result auto-cached |
| Offline Banner | Yellow-tinted banner + wifi-off icon | Device offline detected |
| Offline Cache Hit | Cached result + "Cached 2 days ago" badge | Offline + word in cache |
| Offline Saved Hit | Saved result + "Saved" badge | Offline + word in saved words |
| Offline Miss | "Not available offline" + suggestion to search later | Offline + word not cached |
| Timeout Fallback | "Lookup failed. Showing cached result." + retry | Online but API timed out |
| Reconnecting | Banner fades, "Refresh" links appear on cached results | Connectivity restored |
| Cache Full | Eviction happens silently; no user-visible change | Cache exceeds size limit |
| Cache Cleared | Toast: "Cache cleared" + stats reset | User taps "Clear Cache" |

## Test Requirements

### Unit Tests
- [ ] `cacheLookuResult(db, word, languageCode, lookupData)`: creates cache entry with correct data_size_bytes
- [ ] `cacheLookuResult(db, word, languageCode, lookupData)`: updates existing entry if word+lang match
- [ ] `getCachedLookup(db, word, languageCode)`: returns cached result and updates last_accessed_at
- [ ] `getCachedLookup(db, word, languageCode)`: returns null for uncached word
- [ ] `evictLruEntries(db, maxBytes)`: deletes least-recently-accessed entries until under limit
- [ ] `evictLruEntries(db, maxBytes)`: does not evict entries for words that exist in wd_saved_words
- [ ] `evictStaleEntries(db, maxAgeDays)`: deletes entries not accessed in 30+ days
- [ ] `getCachePrefixMatches(db, prefix, languageCode, limit)`: returns matching cached words
- [ ] `getCachePrefixMatches(db, prefix, languageCode, limit)`: merges results from cache and saved words
- [ ] `getCacheStats(db)`: returns word count and total size in bytes
- [ ] `clearCache(db)`: deletes all wd_lookup_cache rows
- [ ] `clearCache(db)`: does not affect wd_saved_words
- [ ] `lookupWordWithFallback(db, input, isOnline)`: calls API when online
- [ ] `lookupWordWithFallback(db, input, isOnline)`: returns cached result when offline
- [ ] `lookupWordWithFallback(db, input, isOnline)`: returns saved word data when offline and not in cache
- [ ] `lookupWordWithFallback(db, input, isOnline)`: returns null when offline with no cached/saved data
- [ ] `lookupWordWithFallback(db, input, isOnline)`: caches API result after successful online lookup

### Integration Tests
- [ ] Full cache flow: look up word online -> go offline -> look up same word -> verify cached result shown
- [ ] Saved fallback: save word -> clear cache -> go offline -> look up word -> verify saved data shown
- [ ] Eviction flow: fill cache to limit -> look up new word -> verify oldest entry evicted
- [ ] Stale cleanup: insert entry with old accessed date -> run cleanup -> verify entry removed
- [ ] Prefix search: cache 5 words starting with "se" -> search "se" offline -> verify all returned

### QA Verification Script
1. Open the app on iOS simulator
2. Navigate to Words > Lookup tab
3. Search for "ephemeral" (online)
4. Verify: result displays normally -- corresponds to caching (AC-1 transparent)
5. Search for "ubiquitous" (online)
6. Enable airplane mode on the simulator
7. Verify: offline banner appears on Lookup tab -- corresponds to AC-2
8. Type "eph" in search bar
9. Verify: autocomplete suggests "ephemeral" from cache -- corresponds to AC-6
10. Search for "ephemeral"
11. Verify: cached result shown with "Cached [time]" badge -- corresponds to AC-3
12. Save "ubiquitous" to saved words (should already be possible from in-memory)
13. Search for "ubiquitous"
14. Verify: result shown with "Saved" badge -- corresponds to AC-4
15. Search for "antidisestablishmentarianism" (never looked up)
16. Verify: "Not available offline" message -- corresponds to AC-5
17. Disable airplane mode
18. Verify: offline banner dismisses, "Refresh" appears on cached results -- corresponds to AC-7
19. Navigate to Words > Settings tab
20. Verify: "Offline Cache" section shows word count and size -- corresponds to AC-8
21. Tap "Clear Cache"
22. Enable airplane mode again
23. Search for "ephemeral"
24. Verify: "Not available offline" (cache was cleared, but if saved it shows) -- confirms NC-2

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to Lookup tab offline and online, verify banner states, cached badges, autocomplete
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Post-merge:
- [ ] `/parity-check` -- words module parity
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Words module requires network for all lookups (`requiresNetwork: true`)
- In-memory cache with 5min TTL provides no persistence
- Saved words have `lookup_data` column but it's only used on the saved word detail screen
- No offline detection or fallback logic exists
- No `wd_lookup_cache` table exists

### After This Work
- V3 migration creates `wd_lookup_cache` table with LRU eviction support
- `offline.ts` provides `lookupWordWithFallback()`, `cacheLookuResult()`, `getCachedLookup()`, `evictLruEntries()`, `getCachePrefixMatches()`, `getCacheStats()`, `clearCache()`
- `service.ts` updated to auto-cache every successful lookup
- Lookup tab shows offline banner, cached result badges, and offline autocomplete
- Module definition updated: `requiresNetwork: false` (graceful degradation)
- Settings tab shows cache management section

### Files Changed
- `modules/words/src/db/schema.ts` -- V3 migration SQL for `wd_lookup_cache` table and indexes
- `modules/words/src/db/crud.ts` -- Cache CRUD functions (write, read, evict, stats, clear, prefix search)
- `modules/words/src/offline.ts` -- NEW: offline fallback orchestrator (lookupWordWithFallback)
- `modules/words/src/service.ts` -- Updated: auto-cache after successful API lookups
- `modules/words/src/types.ts` -- New OfflineLookupResult type with source indicator
- `modules/words/src/definition.ts` -- Add V3 migration, bump schemaVersion, set `requiresNetwork: false`
- `modules/words/src/index.ts` -- Export offline functions
- `modules/words/src/__tests__/offline.test.ts` -- NEW: offline fallback tests
- `apps/mobile/app/(words)/lookup.tsx` -- Offline banner, cached badges, autocomplete from cache
- `apps/mobile/app/(words)/settings.tsx` -- Cache management section
- `apps/web/app/words/page.tsx` -- Offline banner, cached badges

### Known Limitations
- **Not a full offline dictionary:** Unlike Dictionary.com Premium, we don't ship a 150MB dictionary database. Only previously-looked-up words are available offline. This is a progressive cache, not a download.
- **No offline Word Helper:** The Word Helper feature requires the Datamuse API for contextual suggestions. It does not work offline. An offline synonym lookup from cached data could be a future enhancement.
- **No offline alphabetical browse:** Alphabetical browsing requires the Datamuse API. Offline browse is limited to saved words and cached lookups via prefix search.
- **Cache is device-local:** Clearing app data or switching devices loses the cache. No cloud sync by design (privacy-first).
- **Stale data risk:** Cached definitions could become outdated if API providers update their data. The "Cached [time ago]" badge and "Refresh" button mitigate this.

### Context for Next Agent
- The existing in-memory cache in `service.ts` (lookupCache Map) should be kept as-is. The SQLite cache is a separate persistence layer. On lookup: check in-memory first (fast path), then SQLite cache (offline fallback), then API (online).
- `truncateLookupData()` already exists in `crud.ts` for capping JSON size. Reuse it for cache entries.
- Network detection: use `@react-native-community/netinfo` on mobile, `navigator.onLine` + `online`/`offline` events on web. Abstract behind a `useNetworkStatus()` hook.
- The `requiresNetwork` flag in the module definition should change to `false` after this feature ships. The hub should not block module access when offline.
- Migration version numbering: V1 = saved words (done), V2 = flash_card_id (flashcard integration), V3 = lookup cache (this feature). Coordinate with the flashcard integration spec to avoid version conflicts.
