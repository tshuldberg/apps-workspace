# MyBooks Sprint 2: Quality of Life Bug Fixes

## Context

A user tested MyBooks and found approximately 25 issues. Sprint 1 covered critical crashes and broken features. This sprint covers 6 quality-of-life issues that affect daily usability but do not crash the app.

**Important:** Read `CLAUDE.md` at the repo root and `modules/books/CLAUDE.md` before starting. Run `pnpm install` if needed. After all changes, run `pnpm gate:function:changed` before finalizing.

---

## Issue 1: Fix badge "Thoughtful Reader" review count query

### User Feedback
> "The 'Thoughtful Reader' badge says 'Write 5 reviews' but it counts star ratings as reviews. I just tapped stars on 5 books and got the badge without writing a single word."

### Problem
The badge engine's `gatherBadgeStats` function counts any row in `bk_reviews` that has a non-null `rating` column. This means tapping a star rating (which creates/updates a review row with a `rating` value but no `review_text`) counts toward the "Thoughtful Reader" badge. The badge's description says "Write N reviews," which implies written review text, not just star taps.

### Files to Read
- `modules/books/src/badges/badge-engine.ts` (lines 51-55: the review count query)
- `modules/books/src/badges/definitions.ts` (badge ID constants)
- `modules/books/src/badges/types.ts` (BadgeStats interface)
- `modules/books/src/db/reviews.ts` (review schema -- note `review_text` column name)
- `modules/books/src/db/schema.ts` (search for `bk_reviews` CREATE TABLE to confirm column names)

### Files to Modify
- `modules/books/src/badges/badge-engine.ts`

### Exact Fix

In `modules/books/src/badges/badge-engine.ts`, find lines 51-55:

```typescript
// Review count
const reviewRows = db.query<{ count: number }>(
  `SELECT COUNT(*) as count FROM bk_reviews WHERE rating IS NOT NULL`,
);
const reviewCount = reviewRows.length > 0 ? reviewRows[0].count : 0;
```

Change the SQL query to:

```typescript
// Review count -- count actual written reviews, not just star ratings
const reviewRows = db.query<{ count: number }>(
  `SELECT COUNT(*) as count FROM bk_reviews WHERE review_text IS NOT NULL AND review_text != ''`,
);
const reviewCount = reviewRows.length > 0 ? reviewRows[0].count : 0;
```

The column name in `bk_reviews` is `review_text` (not `content`). Confirm this by checking `modules/books/src/db/reviews.ts` lines 19-20 where the `Review` type uses `review_text`.

### Badge Query Audit

After fixing the review query, audit ALL badge stat queries in `gatherBadgeStats` (lines 13-86) against their badge names/descriptions. The badge names from `definitions.ts` include badges in these categories:

- **volume** (VOLUME_10/25/50/100): queries `bk_reading_sessions WHERE status = 'finished'` -- correct
- **pages** (PAGES_1000/5000/10000/50000): queries `SUM(b.page_count)` for finished books -- correct
- **genre** (GENRE_3/5/10): queries `COUNT(DISTINCT value) FROM bk_mood_tags WHERE tag_type = 'genre'` for finished books -- correct
- **author** (AUTHOR_5/10/25): uses `countDistinctAuthors()` with JSON parsing -- correct
- **streak** (STREAK_7/30/100/365): uses `computeStreak()` -- correct
- **challenge** (CHALLENGE_1/5/10): queries `bk_challenges WHERE is_active = 0` -- verify this means "completed" not "deactivated." Check `modules/books/src/db/challenges.ts` for the schema. If `is_active = 0` includes manually deactivated challenges (not just completed ones), this may need a separate `is_completed` check.
- **review** (REVIEW_5/10/25/50): this is the fix above
- **journal** (JOURNAL_5/10/25): queries `COUNT(*) FROM bk_journal_entries` -- correct

Document any additional query fixes needed as comments in the code.

### Test File to Update
- `modules/books/src/badges/__tests__/badge-engine.test.ts`

In the existing test "awards review badge at 10 reviews" (around line 294), update the mock data key from `'bk_reviews WHERE rating'` to `'bk_reviews WHERE review_text'` to match the new query. The mock DB uses string pattern matching, so the key pattern must match a substring of the new SQL.

Add a new test case:

```typescript
it('does not count star-only ratings toward review badge', () => {
  const badge = makeBadge({
    id: 'review_5',
    threshold: 5,
    category: 'review',
    name: 'Thoughtful Reader',
  });

  const { db } = createMockDb({
    'earned_at IS NULL': [badge],
    'COUNT(DISTINCT book_id)': [{ count: 0 }],
    'SUM(b.page_count)': [{ total: 0 }],
    'COUNT(DISTINCT value)': [{ count: 0 }],
    'DISTINCT b.authors': [],
    'DATE(started_at)': [],
    'DATE(created_at) as day': [],
    'bk_challenges WHERE is_active = 0': [{ count: 0 }],
    'bk_reviews WHERE review_text': [{ count: 0 }], // 0 written reviews even though star ratings exist
    'bk_journal_entries': [{ count: 0 }],
    'julianday': [{ min_days: null }],
    'ORDER BY category, threshold': [badge],
  });

  const result = evaluateBadges(db);
  expect(result.newlyEarned).toHaveLength(0);
});
```

### Verification
1. Run `pnpm test -- modules/books/src/badges/__tests__/badge-engine.test.ts`
2. Confirm all existing badge tests still pass
3. Confirm the new test passes

---

## Issue 2: Fix scroll position leak between book detail pages

### User Feedback
> "When I tap on a book and scroll down to read the details, then go back and tap another book, the second book is scrolled to the same spot. I have to manually scroll back to the top every time."

### Problem
The ScrollView in `book/[id].tsx` does not reset its scroll position when the route parameter `id` changes. React Native reuses the component instance when navigating between books via the same route pattern, so the ScrollView retains its scroll offset.

### Files to Read
- `apps/mobile/app/(books)/book/[id].tsx` (line 872: the ScrollView)

### Files to Modify
- `apps/mobile/app/(books)/book/[id].tsx`

### Exact Fix

1. At the top of the file (line 1), the imports already include `useCallback` and `useEffect`. Add `useRef` to the import:

```typescript
import React, { useState, useCallback, useEffect, useRef } from 'react';
```

2. Find the line where `ScrollView` is imported (line 2). It is already imported.

3. Inside the component function (after the existing hooks, around line 480 area), add a ScrollView ref:

```typescript
const scrollRef = useRef<ScrollView>(null);
```

4. Add a useEffect to reset scroll position when the book ID changes:

```typescript
useEffect(() => {
  scrollRef.current?.scrollTo({ y: 0, animated: false });
}, [id]);
```

5. On line 872, update the ScrollView to use the ref:

```tsx
<ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.content}>
```

### Test Coverage
No unit test exists for this screen. The fix is a one-line ref assignment and a 3-line useEffect. Manual verification is sufficient.

### Verification
1. Run `pnpm typecheck` to confirm no type errors
2. Manual test: Open book A, scroll halfway down, go back, open book B -- it should start at the top

---

## Issue 3: Move "Change Shelf" button to top of book detail

### User Feedback
> "The 'Move to Shelf' button is buried at the very bottom below social features. I have to scroll past reviews, tags, stats, and social stuff just to move a book to a different shelf. This is one of the most common things I do."

### Problem
The "Move to Shelf" button is at line 1213, at the bottom of the book detail page after the social features section. Users must scroll past the entire page to reach it. Additionally, the label says "Move to Shelf" which should be "Change Shelf" since the book is already on a shelf.

### Files to Read
- `apps/mobile/app/(books)/book/[id].tsx` (lines 1212-1215: the actions section; line 497: the Alert title; lines 882-884: the badge row where it should go)

### Files to Modify
- `apps/mobile/app/(books)/book/[id].tsx`

### Exact Fix

**Step 1: Rename the labels**

Find line 497:
```typescript
Alert.alert('Move to Shelf', 'Choose a shelf for this book.', options);
```
Change to:
```typescript
Alert.alert('Change Shelf', 'Choose a shelf for this book.', options);
```

Find line 1213:
```typescript
<Button variant="secondary" label="Move to Shelf" onPress={handleMoveToShelf} />
```
Change to:
```typescript
<Button variant="secondary" label="Change Shelf" onPress={handleMoveToShelf} />
```

**Step 2: Move the button to after the badge row**

Cut the "Change Shelf" Button from line 1213 (inside the `styles.actions` View).

Insert it after the badge row (after line 884, right after `</View>` for `styles.badgeRow`):

```tsx
<View style={styles.badgeRow}>
  <ShelfBadge name={shelfLabel} color={BOOKS_ACCENT} />
</View>

<Button variant="secondary" label="Change Shelf" onPress={handleMoveToShelf} />
```

The bottom actions View should now only contain the Delete button:
```tsx
<View style={styles.actions}>
  <Button variant="ghost" label="Delete from Library" onPress={handleDelete} />
</View>
```

### Test Coverage
No unit test for this UI layout. Manual verification is sufficient.

### Verification
1. Run `pnpm typecheck`
2. Manual test: Open any book -- the "Change Shelf" button should appear right below the shelf badge, before the rating section

---

## Issue 4: Fix star rating rendering (half-stars split vertically)

### User Feedback
> "The stars look weird -- half stars are split vertically (top half filled, bottom half empty) instead of horizontally (left half filled, right half empty). It looks broken."

### Problem
The `StarRating` component at `packages/ui/src/components/StarRating.tsx` renders half-stars by overlaying a clipped full star on top of an empty star. The clipping uses `width: size / 2` with `overflow: 'hidden'` to show only the left half of the filled star. This approach is correct in concept (horizontal clip), but there may be a rendering issue with how the star character renders at different sizes or on certain devices.

### Files to Read
- `packages/ui/src/components/StarRating.tsx` (the entire file, 111 lines)

### Files to Modify
- `packages/ui/src/components/StarRating.tsx`

### Analysis and Fix

The current `Star` component (lines 18-51) renders half-stars as:
1. An absolutely-positioned empty star (full width)
2. A `View` with `width: size / 2` and `overflow: 'hidden'` containing a filled star

The issue is that the Unicode star character (U+2605) may not render at exactly `size` pixels wide, causing the clip boundary to not align with the visual center of the star glyph. On some devices/fonts, the star glyph has padding or is narrower than the font size, so clipping at `size / 2` cuts through the star at an unexpected point.

**Fix approach:** Replace the Unicode character approach with a more reliable rendering using two half-Views for the half-star state. The key fix is to ensure the clip boundary aligns with the visual center of the star.

Replace the `Star` component (lines 18-51) with:

```typescript
function Star({
  fill,
  size,
}: {
  fill: 'full' | 'half' | 'empty';
  size: number;
}) {
  const fontSize = size;
  const textStyle: TextStyle = { fontSize, lineHeight: size + 2, textAlign: 'center' };
  const charWidth = size; // Unicode star renders within the em square

  if (fill === 'full') {
    return (
      <View style={{ width: charWidth, height: size + 2, alignItems: 'center' }}>
        <RNText style={[textStyle, { color: STAR_COLOR }]}>{'\u2605'}</RNText>
      </View>
    );
  }

  if (fill === 'empty') {
    return (
      <View style={{ width: charWidth, height: size + 2, alignItems: 'center' }}>
        <RNText style={[textStyle, { color: STAR_EMPTY_COLOR }]}>{'\u2605'}</RNText>
      </View>
    );
  }

  // Half star: left half filled, right half empty
  // Render both characters at full width, clip each to show only its half
  return (
    <View style={{ width: charWidth, height: size + 2, flexDirection: 'row' }}>
      {/* Left half: filled */}
      <View style={{ width: charWidth / 2, height: size + 2, overflow: 'hidden' }}>
        <RNText style={[textStyle, { color: STAR_COLOR, width: charWidth }]}>{'\u2605'}</RNText>
      </View>
      {/* Right half: empty */}
      <View style={{ width: charWidth / 2, height: size + 2, overflow: 'hidden' }}>
        <RNText style={[textStyle, { color: STAR_EMPTY_COLOR, width: charWidth, marginLeft: -(charWidth / 2) }]}>{'\u2605'}</RNText>
      </View>
    </View>
  );
}
```

The key changes:
- All star states now use a fixed-width container (`width: charWidth`) to prevent layout shifts
- The half-star uses `flexDirection: 'row'` with two equally-sized clips
- The right half uses a negative `marginLeft` to shift the star character left so only its right half is visible
- `textAlign: 'center'` ensures the glyph is centered within its container
- This ensures the split is always horizontal (left/right), never vertical (top/bottom)

Also update the interactive star section (lines 77-95) to match the new container sizing. The interactive Pressable areas should also use `charWidth` consistently:

```typescript
stars.push(
  <View key={i} style={[styles.star, { flexDirection: 'row', width: size, height: size + 2 }]}>
    <Pressable
      onPress={() => handlePress(i, true)}
      style={{ width: size / 2, height: size + 2 }}
    >
      <View style={{ width: size, height: size + 2, overflow: 'hidden' }}>
        <Star fill={fill} size={size} />
      </View>
    </Pressable>
    <Pressable
      onPress={() => handlePress(i, false)}
      style={{ width: size / 2, height: size + 2, overflow: 'hidden' }}
    >
      <View style={{ width: size, height: size + 2, marginLeft: -(size / 2) }}>
        <Star fill={fill} size={size} />
      </View>
    </Pressable>
  </View>,
);
```

### Test Coverage
No existing unit test for StarRating. This is a visual fix. Manual verification on device is required.

### Verification
1. Run `pnpm typecheck`
2. Manual test: Rate a book 2.5 stars -- the third star should show left half gold, right half dark
3. Verify all five states look correct: 0, 0.5, 1.0, 2.5, 5.0 stars

---

## Issue 5: Fix challenge page count input visibility

### User Feedback
> "When I try to create a new challenge and type the target number, I can't see what I'm typing. The text is invisible. Also there's no way to cancel creating a challenge other than tapping outside the modal."

### Problem
In `apps/mobile/app/(books)/challenges.tsx`, the `CreateModal` component has two `TextInput` fields (lines 147-174). The inputs use `styles.input` which sets `color: colors.text` (line 196). The text color IS set correctly to `colors.text` (`#F0F0F5`), so the issue may be that the input style is being overridden or the `color` is not being applied on the specific platform.

More likely issue: The target TextInput (line 167-174) uses `keyboardType="number-pad"` but the styling looks correct. Double-check that the `color` property in `styles.input` is actually `colors.text`. Looking at line 196:
```
input: { backgroundColor: colors.surfaceElevated, borderRadius: 12, padding: spacing.sm, color: colors.text, fontFamily: 'Inter', fontSize: 16 },
```

The color IS set. The real issue might be that on some iOS versions, the number pad input renders with system styling that overrides the color. Add explicit `selectionColor` and ensure the text is visible.

The second issue is clear: there's no Cancel button. The modal's only button is "Start" (line 175). Dismissal requires tapping the overlay (line 144), which is not obvious.

### Files to Read
- `apps/mobile/app/(books)/challenges.tsx` (the entire file, 200 lines)

### Files to Modify
- `apps/mobile/app/(books)/challenges.tsx`

### Exact Fix

**Step 1: Ensure text visibility in inputs**

Update both `TextInput` components in the `CreateModal` to explicitly set text color and selection color:

For the name input (around line 147):
```tsx
<TextInput
  style={styles.input}
  value={name}
  onChangeText={setName}
  placeholder="Challenge name"
  placeholderTextColor={colors.textTertiary}
  selectionColor={BOOKS_ACCENT}
/>
```

For the target input (around line 167):
```tsx
<TextInput
  style={styles.input}
  value={target}
  onChangeText={setTarget}
  placeholder="Target value"
  placeholderTextColor={colors.textTertiary}
  keyboardType="number-pad"
  selectionColor={BOOKS_ACCENT}
/>
```

**Step 2: Add Create and Cancel buttons**

Replace the single `<Button>` at line 175:

```tsx
<Button variant="primary" label="Start" onPress={onCreate} />
```

With a two-button layout:

```tsx
<View style={styles.buttonRow}>
  <Button variant="ghost" label="Cancel" onPress={onClose} />
  <Button variant="primary" label="Create" onPress={onCreate} />
</View>
```

**Step 3: Add the `buttonRow` style** to the StyleSheet (add inside `StyleSheet.create`):

```typescript
buttonRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
```

**Step 4: Verify the input color is truly visible**

If the text is still invisible after these changes, the issue may be that `colors.text` is very close to the input background. Check:
- `colors.text` = `#F0F0F5` (white-ish)
- `colors.surfaceElevated` = `#1A1A24` (dark)

These should have excellent contrast. If the text is still invisible, the issue is likely a React Native platform bug with `keyboardType="number-pad"` on certain iOS versions. In that case, try adding `textContentType="none"` and `autoComplete="off"` to the TextInput.

### Test Coverage
No existing tests for this screen. The fix involves style and button additions.

### Verification
1. Run `pnpm typecheck`
2. Manual test: Open Challenges, tap "+" or "Create Challenge", type in name and target -- text should be visible (white on dark)
3. Verify the "Cancel" button dismisses the modal
4. Verify the "Create" button creates the challenge and dismisses the modal

---

## Issue 6: Improve shelf display with book previews

### User Feedback
> "The shelves are just text labels in a horizontal scroll. I can't tell what's in each shelf without tapping them one by one. Can I at least see how many books are in each shelf?"

### Problem
The `ShelfTabs` component at `apps/mobile/components/books/ShelfTabs.tsx` renders shelf names as horizontal chip/tab buttons. There is no book count or visual preview of shelf contents. Users must tap each shelf to see what's inside.

### Files to Read
- `apps/mobile/components/books/ShelfTabs.tsx` (47 lines)
- `apps/mobile/app/(books)/library.tsx` (how shelves are used -- line 131)
- `modules/books/src/db/shelves.ts` (shelf type definition, to understand what data is available)

### Files to Modify
- `apps/mobile/components/books/ShelfTabs.tsx`
- `apps/mobile/app/(books)/library.tsx` (pass book counts to ShelfTabs)

### Implementation: Option A -- Book count badges on shelf tabs

This is the simpler approach that keeps the existing horizontal tab layout.

**Step 1: Update the ShelfTabs Props interface**

In `apps/mobile/components/books/ShelfTabs.tsx`, update the Props:

```typescript
interface Props {
  shelves: Shelf[];
  activeShelfId: string | null;
  onSelect: (id: string | null) => void;
  bookCounts?: Record<string, number>; // shelf_id -> book count
  totalCount?: number; // count for "All" tab
}
```

**Step 2: Update the component to show counts**

```typescript
export function ShelfTabs({ shelves, activeShelfId, onSelect, bookCounts, totalCount }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      <Pressable
        style={[styles.tab, activeShelfId === null && styles.tabActive]}
        onPress={() => onSelect(null)}
      >
        <Text
          variant="caption"
          color={activeShelfId === null ? colors.modules.books : colors.textSecondary}
        >
          All{totalCount !== undefined ? ` (${totalCount})` : ''}
        </Text>
      </Pressable>
      {shelves.map((shelf) => {
        const count = bookCounts?.[shelf.id];
        return (
          <Pressable
            key={shelf.id}
            style={[styles.tab, activeShelfId === shelf.id && styles.tabActive]}
            onPress={() => onSelect(shelf.id)}
          >
            <Text
              variant="caption"
              color={activeShelfId === shelf.id ? colors.modules.books : colors.textSecondary}
            >
              {shelf.icon ? `${shelf.icon} ` : ''}{shelf.name}{count !== undefined ? ` (${count})` : ''}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
```

**Step 3: Compute and pass book counts from library.tsx**

In `apps/mobile/app/(books)/library.tsx`, you need to compute how many books are on each shelf. You will need a function that counts books per shelf from the database.

Check if `modules/books/src/db/shelves.ts` has a function like `getBookCountsPerShelf`. If not, add one:

```typescript
// In modules/books/src/db/shelves.ts, add:
export function getBookCountsPerShelf(
  db: DatabaseAdapter,
): Record<string, number> {
  const rows = db.query<{ shelf_id: string; count: number }>(
    `SELECT shelf_id, COUNT(*) as count FROM bk_book_shelves GROUP BY shelf_id`,
  );
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.shelf_id] = row.count;
  }
  return counts;
}
```

Export it from `modules/books/src/index.ts` if needed.

In `library.tsx`, compute the counts and pass them:

```typescript
// Inside LibraryScreen, after the existing hooks:
const bookCounts = useMemo(() => {
  // Import and call getBookCountsPerShelf
  return getBookCountsPerShelf(db);
}, [db, books]); // re-compute when books change

// In the JSX:
<ShelfTabs
  shelves={shelves}
  activeShelfId={activeShelf}
  onSelect={setActiveShelf}
  bookCounts={bookCounts}
  totalCount={allBooks.length}
/>
```

Make sure to import `getBookCountsPerShelf` from `@mylife/books` and add it to the module's barrel export.

### Test Coverage
- Add a test in `modules/books/src/db/__tests__/shelves.test.ts` for the new `getBookCountsPerShelf` function
- No UI test needed for the ShelfTabs visual change

### Verification
1. Run `pnpm typecheck`
2. Run `pnpm test -- modules/books/src/db/__tests__/shelves.test.ts`
3. Manual test: Open Library -- each shelf tab should show its book count in parentheses, e.g. "Want to Read (12)"

---

## Final Checklist

After completing all 6 issues:

1. Run `pnpm typecheck` -- must pass with no errors
2. Run `pnpm test -- modules/books/` -- all books module tests must pass
3. Run `pnpm gate:function:changed` -- must pass
4. Run `pnpm check:parity --quiet` -- must pass
5. Do NOT commit unless the user explicitly asks for it

If any gate fails, fix the issue before moving to the next item.
