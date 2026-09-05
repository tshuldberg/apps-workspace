# MyBooks Sprint 3: Feature Completion

## Context

A user tested MyBooks and found approximately 25 issues. Sprint 1 covered critical crashes. Sprint 2 covered quality-of-life fixes. This sprint covers 7 feature-level issues -- features that exist but are incomplete, broken, or need significant improvement.

**Important:** Read `CLAUDE.md` at the repo root and `modules/books/CLAUDE.md` before starting. Run `pnpm install` if needed. After all changes, run `pnpm gate:function:changed` before finalizing.

---

## Issue 1: Improve search result quality

### User Feedback
> "Search is unusable for finding specific books. I searched 'Vietnam' and got Stephen King results. The dates shown are weird too -- it says a book from 2020 was published in 1968."

### Problem
The Open Library search API at `modules/books/src/api/open-library.ts` sends a bare query to `/search.json?q=...` which returns loosely associated results. There is no client-side relevance ranking. The "wrong dates" complaint is actually about `first_publish_year` -- Open Library returns the earliest publication year for a *work* (e.g., the original 1968 edition), not the specific edition the user expects. This is technically correct but confusing.

### Files to Read
- `modules/books/src/api/open-library.ts` (line 185: the search URL construction)
- `modules/books/src/api/types.ts` (OLSearchDocSchema -- the fields available from the API)
- `modules/books/src/api/transform.ts` (line 53: `publish_year: doc.first_publish_year`)
- `apps/mobile/app/(books)/search.tsx` (lines 133-167: how results are rendered; line 153-157: year display)
- `modules/books/src/api/__tests__/open-library.test.ts`
- `modules/books/src/api/__tests__/transform.test.ts`

### Files to Modify
- `modules/books/src/api/open-library.ts` (improve search URL and add relevance ranking)
- `apps/mobile/app/(books)/search.tsx` (optional: improve result display)

### Implementation

**Step 1: Request structured fields from Open Library**

In `modules/books/src/api/open-library.ts`, update the `searchBooks` function (line 185):

Current:
```typescript
const url = `${BASE_URL}/search.json?q=${encodeURIComponent(query)}&limit=${limit}`;
```

Change to:
```typescript
const fields = 'key,title,author_name,author_key,first_publish_year,isbn,cover_edition_key,number_of_pages_median,subject,publisher,cover_i,edition_key,subtitle,language,edition_count';
const url = `${BASE_URL}/search.json?q=${encodeURIComponent(query)}&limit=${limit}&fields=${fields}`;
```

Adding `&fields=...` tells Open Library to return only these fields, which makes responses faster and gives us the structured data we need for ranking.

**Step 2: Add title-prefix search for title-like queries**

For queries that look like book titles (no author keywords, no ISBN), use the `title:` search prefix. Add a helper function:

```typescript
/**
 * Detect if a query looks like a title search (no obvious author/ISBN patterns).
 * Returns the modified query with 'title:' prefix for better relevance.
 */
function buildSearchQuery(rawQuery: string): string {
  const trimmed = rawQuery.trim();

  // ISBN pattern: 10 or 13 digits (possibly with dashes)
  if (/^[\d-]{10,17}$/.test(trimmed.replace(/-/g, ''))) {
    return `isbn:${trimmed.replace(/-/g, '')}`;
  }

  // If query contains " by " it's likely "Title by Author" -- use as-is
  if (/ by /i.test(trimmed)) {
    return trimmed;
  }

  // Default: wrap in title search for better relevance
  return `title:${trimmed}`;
}
```

Then update the URL construction:
```typescript
const searchQuery = buildSearchQuery(query);
const url = `${BASE_URL}/search.json?q=${encodeURIComponent(searchQuery)}&limit=${limit}&fields=${fields}`;
```

Update the cache key to still use the raw query so that cache hits work regardless of the prefix logic:
```typescript
const cacheKey = `${query}::${limit}`;
```

**Step 3: Add client-side relevance ranking**

Add a function after `searchBooks` that ranks results by title match quality:

```typescript
/**
 * Score a search result by relevance to the original query.
 * Higher score = more relevant.
 */
function relevanceScore(doc: OLSearchDoc, query: string): number {
  const q = query.toLowerCase().trim();
  const title = doc.title.toLowerCase();

  // Exact title match
  if (title === q) return 100;

  // Title starts with query
  if (title.startsWith(q)) return 80;

  // Title contains query as a substring
  if (title.includes(q)) return 60;

  // Word overlap: count how many query words appear in the title
  const queryWords = q.split(/\s+/).filter(w => w.length > 2);
  const titleWords = new Set(title.split(/\s+/));
  let overlap = 0;
  for (const word of queryWords) {
    if (titleWords.has(word)) overlap++;
  }
  if (queryWords.length > 0) {
    const overlapRatio = overlap / queryWords.length;
    if (overlapRatio > 0) return 20 + overlapRatio * 30;
  }

  // No meaningful overlap -- low relevance
  return 0;
}
```

Export a wrapper that searches and sorts:

```typescript
/**
 * Search Open Library and return results ranked by title relevance.
 */
export async function searchBooksRanked(
  query: string,
  limit: number = 20,
): Promise<OLSearchResponse> {
  const response = await searchBooks(query, limit);

  // Sort docs by relevance to the original query
  const ranked = [...response.docs].sort(
    (a, b) => relevanceScore(b, query) - relevanceScore(a, query),
  );

  return { ...response, docs: ranked };
}
```

**Step 4: Use ranked search in the UI**

In `apps/mobile/app/(books)/search.tsx`, check which hook is used (`useOpenLibrarySearch` at line 6). Find the hook file:
- Likely at `apps/mobile/hooks/books/use-search.ts`

Update the hook to call `searchBooksRanked` instead of `searchBooks`. If the hook imports `searchBooks` directly, change the import to `searchBooksRanked`.

**Step 5: Clarify the publication year display**

The `first_publish_year` is the year the *work* was first published (any edition). This is correct for Open Library's data model but can be confusing. In the search result display (search.tsx lines 153-157), add a label:

```tsx
{doc.first_publish_year && (
  <Text variant="caption" color={colors.textTertiary}>
    First published {doc.first_publish_year}
  </Text>
)}
```

### Test Coverage
- Add tests in `modules/books/src/api/__tests__/open-library.test.ts`:
  - Test `buildSearchQuery` correctly prefixes title queries
  - Test `buildSearchQuery` detects ISBN patterns
  - Test `buildSearchQuery` passes through "by" queries unchanged
  - Test `relevanceScore` ranks exact matches highest
  - Test `relevanceScore` ranks substring matches above no-match

### Verification
1. Run `pnpm test -- modules/books/src/api/`
2. Run `pnpm typecheck`
3. Manual test: Search "Vietnam" -- results should prioritize books with "Vietnam" in the title
4. Manual test: Search "978-0-06-112008-4" -- should find The Alchemist via ISBN

---

## Issue 2: Build real discovery engine

### User Feedback
> "The Discover screen is useless. It just filters my own library by mood and genre. I want it to suggest NEW books I haven't read yet."

### Problem
`apps/mobile/app/(books)/discover.tsx` uses the `useDiscovery` hook which calls `discoverBooks()` from `modules/books/src/discovery/discovery-engine.ts`. That engine queries `bk_books` (the user's local library) with mood/genre/pace filters. It does NOT discover new books -- it only filters existing ones.

### Files to Read
- `apps/mobile/app/(books)/discover.tsx` (the entire file)
- `modules/books/src/discovery/discovery-engine.ts` (confirms it only queries local `bk_books`)
- `modules/books/src/discovery/types.ts`
- `modules/books/src/api/open-library.ts` (for external API access)
- `modules/books/src/db/mood-tags.ts` (to get the user's genre preferences)
- `modules/books/src/db/books.ts` (to check which books the user already owns)
- `apps/mobile/hooks/books/use-discovery.ts` (the hook that connects UI to engine)

### Files to Modify
- `modules/books/src/discovery/discovery-engine.ts` (add external discovery)
- `modules/books/src/discovery/types.ts` (add new types)
- `apps/mobile/app/(books)/discover.tsx` (add "Discover New" section)
- `apps/mobile/hooks/books/use-discovery.ts` (add external discovery hook)

### Implementation

**Step 1: Add a new function to fetch external book suggestions by subject**

Open Library has a subjects API: `https://openlibrary.org/subjects/{subject}.json?limit=10`

Add to `modules/books/src/api/open-library.ts`:

```typescript
/**
 * Fetch books by subject from Open Library's subjects API.
 * Returns a list of book works in the given subject category.
 */
export async function getBooksBySubject(
  subject: string,
  limit: number = 10,
): Promise<OLSubjectResponse> {
  const cacheKey = `subject:${subject}:${limit}`;
  const cached = getCached<unknown>(searchCache, cacheKey);
  if (cached !== undefined) {
    const result = OLSubjectResponseSchema.safeParse(cached);
    if (result.success) return result.data;
    searchCache.delete(cacheKey);
  }

  const url = `${BASE_URL}/subjects/${encodeURIComponent(subject.toLowerCase().replace(/ /g, '_'))}.json?limit=${limit}`;
  const data = await fetchJSON(url);
  const result = OLSubjectResponseSchema.safeParse(data);
  if (!result.success) {
    throw new Error('Open Library subjects API returned unexpected format');
  }
  setCache(searchCache, cacheKey, data, SEARCH_CACHE_TTL_MS);
  return result.data;
}
```

Add the Zod schema for the subjects response in `modules/books/src/api/types.ts`:

```typescript
export const OLSubjectWorkSchema = z.object({
  key: z.string(),
  title: z.string(),
  authors: z.array(z.object({
    name: z.string(),
    key: z.string(),
  })).optional(),
  cover_id: z.number().optional(),
  first_publish_year: z.number().optional(),
  edition_count: z.number().optional(),
});

export type OLSubjectWork = z.infer<typeof OLSubjectWorkSchema>;

export const OLSubjectResponseSchema = z.object({
  name: z.string(),
  work_count: z.number(),
  works: z.array(OLSubjectWorkSchema),
});

export type OLSubjectResponse = z.infer<typeof OLSubjectResponseSchema>;
```

**Step 2: Add a discovery function that suggests new books**

In `modules/books/src/discovery/discovery-engine.ts`, add:

```typescript
import { getBooksBySubject } from '../api/open-library';
import type { OLSubjectWork } from '../api/types';

export interface DiscoverySuggestion {
  key: string; // Open Library work key
  title: string;
  authors: string[];
  coverUrl: string | null;
  firstPublishYear: number | null;
  subject: string; // the genre that triggered this suggestion
}

/**
 * Get external book suggestions based on the user's top genres.
 * Filters out books already in the user's library.
 */
export async function discoverNewBooks(
  db: DatabaseAdapter,
  maxPerGenre: number = 5,
): Promise<DiscoverySuggestion[]> {
  // Get user's top genres from mood tags
  const genreRows = db.query<{ value: string; count: number }>(
    `SELECT value, COUNT(*) as count FROM bk_mood_tags
     WHERE tag_type = 'genre'
     GROUP BY value
     ORDER BY count DESC
     LIMIT 5`,
  );

  if (genreRows.length === 0) {
    // Fallback: use default genres
    genreRows.push(
      { value: 'Fiction', count: 0 },
      { value: 'Fantasy', count: 0 },
      { value: 'Science Fiction', count: 0 },
    );
  }

  // Get all existing Open Library IDs to filter out owned books
  const existingRows = db.query<{ open_library_id: string }>(
    `SELECT open_library_id FROM bk_books WHERE open_library_id IS NOT NULL`,
  );
  const existingOLIds = new Set(existingRows.map(r => r.open_library_id));

  const suggestions: DiscoverySuggestion[] = [];

  for (const genre of genreRows) {
    try {
      const response = await getBooksBySubject(genre.value, maxPerGenre * 2);

      for (const work of response.works) {
        // Extract OLID from key like "/works/OL12345W"
        const olid = work.key.replace(/^\/works\//, '');

        // Skip books already in library
        if (existingOLIds.has(olid)) continue;

        suggestions.push({
          key: work.key,
          title: work.title,
          authors: work.authors?.map(a => a.name) ?? [],
          coverUrl: work.cover_id
            ? `https://covers.openlibrary.org/b/id/${work.cover_id}-M.jpg`
            : null,
          firstPublishYear: work.first_publish_year ?? null,
          subject: genre.value,
        });

        if (suggestions.filter(s => s.subject === genre.value).length >= maxPerGenre) break;
      }
    } catch {
      // Skip genres that fail to fetch -- don't block the whole discovery
      continue;
    }
  }

  return suggestions;
}
```

Export `discoverNewBooks` and `DiscoverySuggestion` from `modules/books/src/discovery/index.ts` and the module barrel.

**Step 3: Create a hook for external discovery**

Add to `apps/mobile/hooks/books/use-discovery.ts` (or create a new hook file):

```typescript
export function useExternalDiscovery() {
  const db = useDatabase();
  const [suggestions, setSuggestions] = useState<DiscoverySuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const results = await discoverNewBooks(db);
      setSuggestions(results);
    } catch {
      // Silently fail -- discovery is non-critical
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { suggestions, loading, refresh };
}
```

**Step 4: Update the discover screen UI**

In `apps/mobile/app/(books)/discover.tsx`, add a "Discover New Books" section above the existing local filter section:

```tsx
{/* External Discovery Section */}
<View style={styles.section}>
  <Text variant="subheading">Recommended for You</Text>
  <Text variant="caption" color={colors.textSecondary}>
    Based on genres you read
  </Text>
  {externalLoading ? (
    <Text variant="caption" color={colors.textTertiary}>Loading suggestions...</Text>
  ) : externalSuggestions.length === 0 ? (
    <Text variant="caption" color={colors.textTertiary}>
      Add genre tags to your books to get personalized suggestions
    </Text>
  ) : (
    <FlatList
      horizontal
      data={externalSuggestions}
      keyExtractor={(item) => item.key}
      showsHorizontalScrollIndicator={false}
      renderItem={({ item }) => (
        <Pressable
          style={styles.suggestionCard}
          onPress={() => {/* navigate to add this book */}}
        >
          <BookCover coverUrl={item.coverUrl} size="medium" title={item.title} />
          <Text variant="caption" numberOfLines={1}>{item.title}</Text>
          <Text variant="caption" color={colors.textSecondary} numberOfLines={1}>
            {item.authors.join(', ')}
          </Text>
          <View style={styles.genreBadge}>
            <Text variant="caption" color={BOOKS_ACCENT} style={{ fontSize: 10 }}>{item.subject}</Text>
          </View>
        </Pressable>
      )}
    />
  )}
</View>
```

Keep the existing local discovery section below it with a header like "Filter Your Library."

### Test Coverage
- Add tests in `modules/books/src/discovery/__tests__/discovery-engine.test.ts`:
  - Test that `discoverNewBooks` filters out books already in the library
  - Test that it uses top genres from mood tags
  - Test the fallback when no genres exist
- Add tests in `modules/books/src/api/__tests__/open-library.test.ts`:
  - Test `getBooksBySubject` constructs correct URL
  - Test response parsing

### Verification
1. Run `pnpm test -- modules/books/`
2. Run `pnpm typecheck`
3. Manual test: Open Discover -- should show a "Recommended for You" section with books from Open Library
4. Manual test: Books already in library should not appear in suggestions

---

## Issue 3: Hide non-functional features from navigation

### User Feedback
> "There are buttons on the home screen for Social, Community, and Clubs that don't really work. Social says 'Coming Soon', Community shows empty challenges, and Clubs is basically a text file. These should be hidden or clearly marked."

### Problem
The Quick Actions grid on the home screen (`apps/mobile/app/(books)/index.tsx` lines 199-230) includes links to `social`, `community`, `clubs`, and `friends-challenge`. These features either show "Coming Soon" messages, have no real data sources, or are skeleton implementations.

### Files to Read
- `apps/mobile/app/(books)/index.tsx` (lines 199-230: Quick Actions grid)
- `apps/mobile/app/(books)/social.tsx` (shows "Coming Soon" when social is disabled)
- `apps/mobile/app/(books)/community.tsx` (shows community challenges but no real data)
- `apps/mobile/app/(books)/clubs.tsx` (local-only text records)
- `apps/mobile/app/(books)/friends-challenge.tsx` (check if functional)

### Files to Modify
- `apps/mobile/app/(books)/index.tsx`

### Implementation

**Option A: Add "Coming Soon" badges and group at the bottom**

In `apps/mobile/app/(books)/index.tsx`, split the Quick Actions into two groups: functional and coming-soon.

Replace the Quick Actions section (lines 199-231) with:

```tsx
{/* Quick Actions */}
<View style={styles.section}>
  <Text variant="subheading">Quick Actions</Text>
  <View style={styles.quickActionsGrid}>
    {[
      { icon: '\ud83c\udfaf', label: 'Challenges', route: '/(books)/challenges' },
      { icon: '\ud83d\udcd3', label: 'Journal', route: '/(books)/journal' },
      { icon: '\ud83d\udca1', label: 'Insights', route: '/(books)/insights' },
      { icon: '\u201c', label: 'Quotes', route: '/(books)/quotes' },
      { icon: '\u2728', label: 'For You', route: '/(books)/recommendations' },
      { icon: '\ud83d\udcda', label: 'Series', route: '/(books)/series' },
      { icon: '\ud83c\udfc5', label: 'Badges', route: '/(books)/badges' },
      { icon: '\ud83d\udd0d', label: 'Discover', route: '/(books)/discover' },
      { icon: '\ud83d\udcca', label: 'Share', route: '/(books)/share' },
      { icon: '\u2b50', label: 'Rate Books', route: '/(books)/rate-books' },
      { icon: '\ud83c\udf1f', label: "What's New", route: '/(books)/whats-new' },
      { icon: '\u2699\ufe0f', label: 'Settings', route: '/(books)/settings' },
    ].map((action) => (
      <Pressable
        key={action.label}
        style={styles.actionCard}
        onPress={() => router.push(action.route as never)}
      >
        <Text style={styles.actionIcon}>{action.icon}</Text>
        <Text variant="caption">{action.label}</Text>
      </Pressable>
    ))}
  </View>
</View>

{/* Coming Soon */}
<View style={styles.section}>
  <Text variant="subheading" color={colors.textSecondary}>Coming Soon</Text>
  <View style={styles.quickActionsGrid}>
    {[
      { icon: '\ud83d\udc65', label: 'Clubs', route: '/(books)/clubs' },
      { icon: '\ud83c\udf0d', label: 'Community', route: '/(books)/community' },
      { icon: '\ud83d\udc4b', label: 'Social', route: '/(books)/social' },
      { icon: '\ud83c\udfc6', label: 'Friends Challenge', route: '/(books)/friends-challenge' },
    ].map((action) => (
      <Pressable
        key={action.label}
        style={[styles.actionCard, styles.actionCardDisabled]}
        onPress={() => router.push(action.route as never)}
      >
        <Text style={[styles.actionIcon, { opacity: 0.4 }]}>{action.icon}</Text>
        <Text variant="caption" color={colors.textTertiary}>{action.label}</Text>
        <View style={styles.comingSoonBadge}>
          <Text variant="caption" color={colors.textTertiary} style={{ fontSize: 9 }}>Soon</Text>
        </View>
      </Pressable>
    ))}
  </View>
</View>
```

Add styles:

```typescript
actionCardDisabled: {
  opacity: 0.6,
},
comingSoonBadge: {
  position: 'absolute',
  top: 4,
  right: 4,
  backgroundColor: colors.surfaceElevated,
  borderRadius: 4,
  paddingHorizontal: 4,
  paddingVertical: 1,
},
```

### Test Coverage
No unit test needed -- this is a layout/navigation change.

### Verification
1. Run `pnpm typecheck`
2. Manual test: Open MyBooks home -- Quick Actions should show only functional features; Coming Soon section should show dimmed social features with "Soon" badges

---

## Issue 4: Fix community challenge tracking

### User Feedback
> "I joined a community challenge to read 5 books, but it never updates my progress even though I've finished 3 books since joining."

### Problem
Community challenges exist in the database (`bk_community_challenges` and `bk_community_challenge_participation`) and the UI can display/join them. However, the `updateCommunityProgress` function in `modules/books/src/community-challenges/engine.ts` is only called when a book is explicitly finished -- and it may not be wired into the reading session completion flow.

### Files to Read
- `modules/books/src/community-challenges/engine.ts` (the `updateCommunityProgress` function)
- `modules/books/src/community-challenges/types.ts`
- `modules/books/src/db/community-challenges.ts`
- `apps/mobile/hooks/books/use-community-challenges.ts` (check the hook)
- `apps/mobile/hooks/books/use-sessions.ts` (where book completion happens)
- `modules/books/src/challenges/challenge-engine.ts` (the personal challenge engine, which IS wired -- compare how it's called)

### Files to Modify
- `apps/mobile/hooks/books/use-sessions.ts` (wire `updateCommunityProgress` into the finish-book flow)

### Implementation

The personal challenge engine (`modules/books/src/challenges/challenge-engine.ts`) has `logBookCompletion` which is likely called when a session status changes to `finished`. Find where this is called and add `updateCommunityProgress` alongside it.

**Step 1: Find the session completion handler**

In `apps/mobile/hooks/books/use-sessions.ts`, look for where the session status is set to `finished`. There should be a function like `finishBook` or `updateSessionStatus`. Inside that function, after the session update:

```typescript
import { updateCommunityProgress } from '@mylife/books';

// After updating session to 'finished':
// Wire community challenge progress
try {
  const book = getBook(db, bookId); // get book to know page count
  updateCommunityProgress(db, bookId, book?.page_count ?? undefined);
} catch {
  // Community progress is non-critical -- don't block the finish flow
}
```

**Step 2: Verify the data flow**

Check `modules/books/src/community-challenges/engine.ts` line 38-64. The `updateCommunityProgress` function handles these challenge types:
- `books_count`: increments by 1 per finished book -- straightforward
- `pages_count`: increments by the book's page count -- needs `pageCount` param
- `genre_diversity`: recalculates from DB -- auto-updates
- `author_diversity`: recalculates from DB -- auto-updates
- `themed`: checks if book's tags match the challenge theme -- auto-checks

All of these work IF the function is called. The only missing piece is wiring it into the session completion flow.

### Test Coverage
- The existing test at `modules/books/src/community-challenges/__tests__/engine.test.ts` covers the engine logic
- Add an integration-style test that verifies `updateCommunityProgress` is called with the correct parameters when a book is finished

### Verification
1. Run `pnpm test -- modules/books/src/community-challenges/`
2. Run `pnpm typecheck`
3. Manual test: Join a community challenge, finish a book, verify the challenge progress updates

---

## Issue 5: Fix book clubs to support member management

### User Feedback
> "Book clubs are just a name and a description. There's no way to add members, track who's reading what, or even see if anyone else is in the club. It's basically a bookmark."

### Problem
Book clubs at `modules/books/src/clubs/` and `apps/mobile/app/(books)/clubs.tsx` + `club/[id].tsx` are local-only records. The `BookClub` type (check `modules/books/src/db/clubs.ts`) stores club metadata and a current book, but has no member model. The `club-engine.ts` handles book progression and history but no members.

Since social features require Supabase (opt-in), full multi-user clubs are a future feature. For now, implement local-only member tracking.

### Files to Read
- `modules/books/src/clubs/club-engine.ts` (the engine)
- `modules/books/src/clubs/types.ts` (ClubWithProgress)
- `modules/books/src/db/clubs.ts` (club CRUD, BookClub type)
- `modules/books/src/db/club-notes.ts` (existing note system)
- `modules/books/src/db/club-history.ts` (reading history)
- `modules/books/src/db/schema.ts` (search for `bk_book_clubs` and `bk_club_` tables)
- `apps/mobile/app/(books)/club/[id].tsx` (club detail UI)
- `apps/mobile/app/(books)/clubs.tsx` (clubs list UI)

### Files to Modify
- `modules/books/src/db/schema.ts` (add `bk_club_members` table)
- `modules/books/src/db/clubs.ts` (add member CRUD functions)
- `modules/books/src/clubs/club-engine.ts` (add member info to ClubWithProgress)
- `modules/books/src/clubs/types.ts` (add ClubMember type)
- `modules/books/src/definition.ts` (add migration for new table)
- `apps/mobile/app/(books)/club/[id].tsx` (add member list and add-member UI)

### Implementation

**Step 1: Add the members table**

In the schema, add a new migration that creates:

```sql
CREATE TABLE IF NOT EXISTS bk_club_members (
  id TEXT PRIMARY KEY,
  club_id TEXT NOT NULL REFERENCES bk_book_clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  current_page INTEGER DEFAULT 0,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(club_id, name)
);
```

Add this as a new migration in `modules/books/src/definition.ts`. Find the migrations array and add a new version (currently at version 8, so add version 9).

**Step 2: Add CRUD for members**

Create `modules/books/src/db/club-members.ts`:

```typescript
import type { DatabaseAdapter } from '@mylife/db';

export interface ClubMember {
  id: string;
  club_id: string;
  name: string;
  current_page: number;
  joined_at: string;
}

export function addClubMember(db: DatabaseAdapter, id: string, clubId: string, name: string): ClubMember {
  const now = new Date().toISOString();
  db.execute(
    'INSERT INTO bk_club_members (id, club_id, name, joined_at) VALUES (?, ?, ?, ?)',
    [id, clubId, name, now],
  );
  return { id, club_id: clubId, name, current_page: 0, joined_at: now };
}

export function getClubMembers(db: DatabaseAdapter, clubId: string): ClubMember[] {
  return db.query<ClubMember>(
    'SELECT * FROM bk_club_members WHERE club_id = ? ORDER BY name',
    [clubId],
  );
}

export function updateMemberProgress(db: DatabaseAdapter, memberId: string, currentPage: number): void {
  db.execute(
    'UPDATE bk_club_members SET current_page = ? WHERE id = ?',
    [currentPage, memberId],
  );
}

export function removeClubMember(db: DatabaseAdapter, memberId: string): void {
  db.execute('DELETE FROM bk_club_members WHERE id = ?', [memberId]);
}
```

Export from `modules/books/src/db/index.ts` and the module barrel.

**Step 3: Update ClubWithProgress type**

In `modules/books/src/clubs/types.ts`, add:

```typescript
import type { ClubMember } from '../db/club-members';

export interface ClubWithProgress {
  club: BookClub;
  currentBookTitle: string | null;
  currentBookCoverUrl: string | null;
  daysRemaining: number | null;
  isOverdue: boolean;
  readingProgress: number | null;
  members: ClubMember[]; // NEW
}
```

Update `club-engine.ts` `getClubProgress` to include members.

**Step 4: Update the club detail UI**

In `apps/mobile/app/(books)/club/[id].tsx`, add a Members section:
- Show a list of members with their names and reading progress (current page)
- Add an "Add Member" button that opens a TextInput modal for the member name
- Each member row shows their progress bar against the current book's page count

### Test Coverage
- Add `modules/books/src/clubs/__tests__/club-members.test.ts` with CRUD tests
- Update `modules/books/src/clubs/__tests__/club-engine.test.ts` to include member data

### Verification
1. Run `pnpm test -- modules/books/src/clubs/`
2. Run `pnpm typecheck`
3. Manual test: Open a club, add members, update their page progress

---

## Issue 6: Fix quotes section UX

### User Feedback
> "Adding a quote requires selecting a book from a list, then typing everything manually. If I'm already reading a book, I should be able to just type the quote and it auto-links to my current book. The whole process has too many steps."

### Problem
The quote creation screen at `apps/mobile/app/(books)/quotes/new.tsx` requires: (1) select a book from a list of all books, (2) type the quote, (3) optionally add page number, chapter, and note. Step 1 is friction -- if the user is currently reading a book, it should be pre-selected. The book picker also only shows the first 20 books with no search (line 55).

### Files to Read
- `apps/mobile/app/(books)/quotes/new.tsx` (the full file, 137 lines)
- `apps/mobile/app/(books)/quotes.tsx` (the quotes list screen)
- `modules/books/src/db/quotes.ts` (quote CRUD)
- `apps/mobile/hooks/books/use-quotes.ts` (quote hook)
- `apps/mobile/hooks/books/use-sessions.ts` (to find currently reading books)

### Files to Modify
- `apps/mobile/app/(books)/quotes/new.tsx`

### Implementation

**Step 1: Auto-select the currently reading book**

In `quotes/new.tsx`, import the sessions hook and auto-select:

```typescript
import { useSessions } from '../../../hooks/books/use-sessions';

// Inside QuoteNewScreen:
const { sessions } = useSessions();

// Find the most recently updated "reading" session
const currentlyReading = useMemo(() => {
  const reading = sessions
    .filter(s => s.status === 'reading')
    .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''));
  return reading.length > 0 ? reading[0] : null;
}, [sessions]);

// Auto-select the currently reading book if no book is selected
useEffect(() => {
  if (!selectedBookId && currentlyReading) {
    setSelectedBookId(currentlyReading.book_id);
  }
}, [currentlyReading, selectedBookId]);
```

**Step 2: Add search/filter to the book picker**

Replace the simple `books.slice(0, 20)` list with a searchable list:

```typescript
const [bookSearch, setBookSearch] = useState('');

const filteredBooks = useMemo(() => {
  if (!bookSearch.trim()) return books.slice(0, 30);
  const q = bookSearch.toLowerCase();
  return books.filter(b =>
    b.title.toLowerCase().includes(q) ||
    b.authors.toLowerCase().includes(q)
  ).slice(0, 30);
}, [books, bookSearch]);
```

In the JSX, add a search input above the book list:

```tsx
{showBookPicker && (
  <View style={styles.bookList}>
    <TextInput
      style={styles.bookSearchInput}
      value={bookSearch}
      onChangeText={setBookSearch}
      placeholder="Search your books..."
      placeholderTextColor={colors.textTertiary}
    />
    {filteredBooks.map((b) => (
      <Pressable
        key={b.id}
        style={styles.bookItem}
        onPress={() => { setSelectedBookId(b.id); setShowBookPicker(false); setBookSearch(''); }}
      >
        <Text variant="body" numberOfLines={1}>{b.title}</Text>
      </Pressable>
    ))}
  </View>
)}
```

**Step 3: Add "Quick Add" shortcut**

If a book is already selected (especially via auto-select), make the quote content the only required field. The save button should be more prominent. Remove the requirement to explicitly select a book if one is auto-selected.

Also, change the save button text to provide clearer feedback:

```tsx
<Button
  variant="primary"
  label={selectedBook ? `Save to ${selectedBook.title.slice(0, 20)}...` : 'Save Quote'}
  onPress={handleSave}
  disabled={!selectedBookId || !content.trim()}
/>
```

### Test Coverage
No existing tests for this screen. The changes are primarily UX improvements.

### Verification
1. Run `pnpm typecheck`
2. Manual test: Navigate to Quotes > +, verify the currently reading book is pre-selected
3. Manual test: Type a quote and save -- it should attach to the auto-selected book

---

## Issue 7: Fix "For You" recommendations and half-star icon

### User Feedback
> "The For You page shows a weird star icon next to 'Rate at least 5 books to unlock recommendations'. The star looks broken -- split horizontally. Also I've rated more than 5 books and it still shows this message."

### Problem
Two issues:
1. The star icon on the empty state (line 25 of `recommendations.tsx`) renders `\u2b50` which is the Unicode "White Medium Star" -- this should render fine, but the user says it looks broken. This might be the same half-star rendering issue from Sprint 2 Issue 4 if the StarRating component is used elsewhere on this screen.
2. The recommendations engine at `modules/books/src/recommendations/engine.ts` (lines 77-83) checks `allReviews.length < 5` where allReviews are fetched with `WHERE rating IS NOT NULL AND rating >= 0.5`. If the user has rated 5+ books but some ratings are below 0.5, they won't count.

### Files to Read
- `apps/mobile/app/(books)/recommendations.tsx` (the full file)
- `modules/books/src/recommendations/engine.ts` (lines 74-92: the minimum ratings check)
- `modules/books/src/db/reviews.ts` (how ratings are stored)
- `apps/mobile/components/books/RecommendationCard.tsx` (check for any star rendering)
- `apps/mobile/hooks/books/use-recommendations.ts` (the hook)

### Files to Modify
- `apps/mobile/app/(books)/recommendations.tsx` (fix the empty state icon)
- `modules/books/src/recommendations/engine.ts` (verify the ratings threshold logic)
- `apps/mobile/hooks/books/use-recommendations.ts` (if needed)

### Implementation

**Step 1: Fix the empty state star icon**

In `apps/mobile/app/(books)/recommendations.tsx`, line 25:
```tsx
<Text style={styles.icon}>{'\u2b50'}</Text>
```

The `\u2b50` character is fine. However, `styles.icon` (line 78) just sets `fontSize: 48`. This should render correctly. The user may be confusing this with the StarRating component elsewhere. Verify this renders correctly on device.

If the issue persists, replace the Unicode star with a simpler emoji or icon:
```tsx
<Text style={styles.icon}>{'\ud83d\udcda'}</Text>
```
This uses the books emoji instead, which is more thematically appropriate.

**Step 2: Debug the "5 ratings required" logic**

In `modules/books/src/recommendations/engine.ts`, lines 78-83:

```typescript
const allReviews = db.query<ReviewRow>(
  `SELECT book_id, rating FROM bk_reviews WHERE rating IS NOT NULL AND rating >= 0.5`,
  [],
);

if (allReviews.length < 5) {
  return {
    insufficientData: true,
    minimumRatingsRequired: 5,
    ...
  };
}
```

This counts reviews where `rating >= 0.5`. Since the StarRating component in `packages/ui/src/components/StarRating.tsx` uses half-star increments (0.5, 1.0, 1.5, ..., 5.0), any tap should produce a value >= 0.5. The minimum is 0.5 (one half-star tap).

Possible causes for the user's issue:
- Reviews exist with `rating` set to `0` (not null, but zero) -- these don't count
- Reviews exist with `rating` set to `null` (user tapped stars then cleared) -- these don't count
- The rating was saved but the review row wasn't properly created

Check the hook file `apps/mobile/hooks/books/use-recommendations.ts` to verify how `computeRecommendations` is called. It might be using a stale database reference or caching old results.

**Step 3: Add a more helpful empty state**

Update the insufficient data state in `recommendations.tsx`:

```tsx
if (recommendations.insufficientData) {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.icon}>{'\ud83d\udcda'}</Text>
      <Text variant="subheading" color={colors.textSecondary}>
        Rate at least {recommendations.minimumRatingsRequired} books to unlock recommendations
      </Text>
      <Text variant="body" color={colors.textTertiary} style={{ textAlign: 'center' }}>
        Tap the stars on any book's detail page to rate it. Your ratings help us suggest books you'll love.
      </Text>
      <Button
        variant="primary"
        label="Rate Your Books"
        onPress={() => router.push('/(books)/rate-books')}
      />
    </View>
  );
}
```

This gives the user a clear call to action (navigate to the rate-books screen).

**Step 4: Verify the data pipeline**

Trace the full path from StarRating tap to review storage to recommendation engine:

1. `StarRating` component (`packages/ui/src/components/StarRating.tsx`): `handlePress` calculates `starIndex + 0.5` or `starIndex + 1` and calls `onChange(newRating)`
2. In `book/[id].tsx`, `handleRatingChange` should call `updateReview` or `createReview` with the rating value
3. The review is stored in `bk_reviews.rating` column
4. `computeRecommendations` queries `bk_reviews WHERE rating IS NOT NULL AND rating >= 0.5`

Check step 2 -- find `handleRatingChange` in `book/[id].tsx` (search for it) and verify it correctly saves the rating to the database. If it creates a review but doesn't set the `rating` field, that would explain the bug.

### Test Coverage
- Add a test in `modules/books/src/recommendations/__tests__/engine.test.ts`:
  - Test that `computeRecommendations` returns `insufficientData: true` when fewer than 5 reviews have ratings
  - Test that it returns `insufficientData: false` when exactly 5 reviews have ratings >= 0.5
  - Test that reviews with `rating = 0` are not counted toward the minimum

### Verification
1. Run `pnpm test -- modules/books/src/recommendations/`
2. Run `pnpm typecheck`
3. Manual test: Rate 5 books with at least 0.5 stars each, then open For You -- recommendations should appear
4. Manual test: Verify the empty state looks correct with the new icon and call-to-action button

---

## Final Checklist

After completing all 7 issues:

1. Run `pnpm typecheck` -- must pass with no errors
2. Run `pnpm test -- modules/books/` -- all books module tests must pass
3. Run `pnpm gate:function:changed` -- must pass
4. Run `pnpm check:parity --quiet` -- must pass
5. Do NOT commit unless the user explicitly asks for it

Priority order if time is limited:
1. Issue 1 (search quality) -- highest user-facing impact
2. Issue 3 (hide non-functional features) -- prevents user confusion
3. Issue 7 (recommendations fix) -- unblocks a core feature
4. Issue 2 (discovery engine) -- new capability
5. Issue 6 (quotes UX) -- quality of life
6. Issue 4 (community challenge tracking) -- wiring fix
7. Issue 5 (club members) -- new feature addition, largest scope

If any gate fails, fix the issue before moving to the next item.
