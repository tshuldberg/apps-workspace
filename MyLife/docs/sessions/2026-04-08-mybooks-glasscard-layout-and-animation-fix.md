# 2026-04-08 — MyBooks GlassCard layout + animation driver fix

## Reported issues

User report on iPhone 16e simulator running the MyBooks home screen:

1. Quick Actions cards rendered as ultra-narrow columns with each label wrapping one letter per line. Icons were tiny or missing.
2. After scrolling to the bottom of the home screen and scrolling back up, a red LogBox notification appeared: `Cannot read property 'default' of undefined` (count climbed to 6). Once it appeared, the screen could not be scrolled or clicked anymore.

## Root causes

### Issue 1 — Quick Actions percent width collapse

`modules/books/src/ui/GlassCard.tsx` wraps content in `<Pressable><Animated.View>`. The user's `style` prop (including `width: '47%'`) was applied to the inner `Animated.View`. Percentage widths in React Native must resolve against a parent with a defined width, but the wrapping `Pressable` had no width set, so the percentage could not resolve and the cards collapsed to their minimum content width. The `47%` value worked everywhere else (e.g., `badges.tsx`) because those uses applied it to a plain `View`, not through a `Pressable`-wrapped component.

### Issue 2 — Mixed-driver Animated.parallel during scroll-cancelled press

`GlassCard` and `BookCard` ran their press feedback through `Animated.parallel`, mixing drivers:

```tsx
Animated.parallel([
  Animated.spring(scale,         { useNativeDriver: true }),    // native
  Animated.timing(borderOpacity, { useNativeDriver: false }),   // JS
])
```

When the user scrolled a `ScrollView` containing many `Pressable`s (the 16-card Quick Actions grid), the cursor/finger dragged across multiple Pressables in rapid succession, firing repeated `onPressIn`/`onPressOut` storms. Each storm started a fresh parallel animation. The native animated nodes manager disconnects nodes asynchronously, and the JS-side wrapper then tried to dereference an already-disconnected node, surfacing as the generic `Cannot read property 'default' of undefined` from the Animated runtime. This is the same family of bug fixed in commit `d9626903b` for `SkeletonRow`, just exposed through scroll-induced press cancellation rather than component unmount.

## Fixes

### `modules/books/src/ui/GlassCard.tsx`

- Added `splitStyle()` helper that splits an incoming `ViewStyle` into `outer` (layout-only keys: `width`, `height`, `min/max*`, `margin*`, `flex*`, `alignSelf`, `position`, `top/bottom/left/right`, `zIndex`) and `inner` (everything else).
- Outer styles now go on the `Pressable` wrapper so percentage widths resolve against the real grid parent.
- Inner styles still go on the `Animated.View`, plus `alignSelf: 'stretch'` so it fills the resolved Pressable width.
- Switched both spring(scale) animations from `useNativeDriver: true` to `useNativeDriver: false` so the parallel composition is JS-only. `borderColor`/`backgroundColor` interpolations cannot run on the native driver, so the spring had to come down to JS to match.
- Added an inline comment referencing the SkeletonRow fix so the pattern is discoverable.

### `modules/books/src/ui/BookCard.tsx`

- Same mixed-driver fix: switched the spring animations to `useNativeDriver: false` to match the JS-driven `bgColor` interpolation in the same `Animated.parallel` block. Preventive — `BookCard` is not on the home screen render path, but it carries the same anti-pattern and would have crashed under the same conditions on the library/discover screens.

### `apps/mobile/app/(books)/index.tsx`

Spec alignment with `docs/uiux-prompts/mybooks_home/code.html` (the spec source):

- `actionsGrid` gap → 16 (was 12) to match Tailwind `gap-4`.
- `actionCell`: `paddingVertical 24, paddingHorizontal 12, gap 12, justifyContent 'center'` to match `p-6 gap-3`.
- `actionCellDim`: smaller `p-4`, gap 8, smaller icon and label, opacity 0.5 to match the dashed Coming Soon row.
- `actionLabel` color → `#E4E1E9` (full text-on-surface) instead of secondary tan to match the spec.
- `actionIcon` paired `lineHeight 32` with `fontSize 28` (per the prior emoji-clipping fix pattern in this repo).
- Screen title set to `'The Curator'` to match the spec header.

## Verification

- `pnpm --filter @mylife/books typecheck` clean
- `pnpm check:parity` passes
- Mobile typecheck on the changed files clean
- Visual regression confirmed via screen recording from the user: 2-column grid with full labels and icons rendered correctly after the layout fix
- Animation fix verified by reasoning about driver semantics; user to confirm by rebuilding the simulator and re-running the scroll path

## Files changed

- `modules/books/src/ui/GlassCard.tsx`
- `modules/books/src/ui/BookCard.tsx`
- `apps/mobile/app/(books)/index.tsx`
- `memory.md`

## Pattern for future maintainers

If you see `Cannot read property 'default' of undefined` from a `ScrollView` containing `Pressable`s with press feedback, search the press handler for `Animated.parallel` with one `useNativeDriver: true` and one `useNativeDriver: false`. The fingerprint is animating `transform` or `opacity` (native-eligible) alongside `backgroundColor`, `borderColor`, `width`, or `height` (JS-only). Force both onto the JS side or split the animations into separate compositions.

There are 22 other mobile screens currently using `useNativeDriver: true` in this repo. They will only manifest the same bug if combined with a JS-driver animation in the same parallel composition. Worth a sweep, but not blocking.
