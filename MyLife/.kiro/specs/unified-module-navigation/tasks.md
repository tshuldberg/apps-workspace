# Implementation Plan: Unified Module Navigation

## Overview

Replace 30 independently implemented module navigation layouts with a shared component system backed by navigation design tokens. Implementation proceeds bottom-up: tokens first, then individual components (ModuleHeader, ModuleTabBar, HamburgerMenu), then the composing ModuleLayoutWrapper, then incremental migration of all 30 mobile modules in batches, and finally web components and web module migration.

## Tasks

- [x] 1. Create navigation design tokens
  - [x] 1.1 Create `packages/ui/src/tokens/navigation.ts` with all token values from the design (headerHeight, tabBarHeight, tabBarBottomPadding, tabBarTopPadding, tabBarBlurIntensity, tabBarBorderRadius, inactiveTint, tabLabelFontSize, tabIconSize, contentPaddingHorizontal, tabBarHorizontalInset, headerPaddingHorizontal, webHeaderHeight, webContentMaxWidth, webContentPaddingHorizontal)
    - Export `navigation` const object and `NavigationTokens` type
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x] 1.2 Re-export navigation tokens from `packages/ui/src/tokens/index.ts` and `packages/ui/src/index.ts`
    - Add `export { navigation } from './navigation'` and `export type { NavigationTokens } from './navigation'` to both barrel files
    - _Requirements: 3.7_

  - [ ]* 1.3 Write unit tests for navigation tokens
    - Verify all required token keys are defined and are positive numbers (or valid color strings for inactiveTint)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 2. Implement ModuleHeader component (mobile)
  - [x] 2.1 Create `apps/mobile/components/ModuleHeader.tsx`
    - Implement `ModuleHeaderProps` interface (moduleId, title?, rightAccessory?, showHamburger?)
    - Render fixed-height header using `navigation.headerHeight` + top safe area inset from `useSafeAreaInsets()`
    - Left: back chevron + "Apps" label, navigates via `router.replace('/(hub)')`
    - Center: module display name in accent color from `colors.modules[moduleId]`
    - Right: hamburger icon (default) or custom `rightAccessory`
    - Fall back to "Module" name and `colors.accent` if moduleId is not found in MODULE_METADATA
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [ ]* 2.2 Write property test for ModuleHeader metadata resolution
    - **Property 1: Module metadata resolution correctness**
    - Generate random ModuleId values from the known set, verify resolved name matches `MODULE_METADATA[moduleId].name` and accent color matches `colors.modules[moduleId]`
    - **Validates: Requirements 1.3, 1.4, 2.3, 6.2**

  - [ ]* 2.3 Write unit tests for ModuleHeader
    - Test back button renders and calls `router.replace('/(hub)')` on press
    - Test hamburger icon renders by default, hidden when `showHamburger={false}`
    - Test header height matches `navigation.headerHeight`
    - Test safe area inset is respected
    - Test fallback behavior for invalid moduleId
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.7_

- [x] 3. Implement ModuleTabBar component (mobile)
  - [x] 3.1 Create `apps/mobile/components/ModuleTabBar.tsx`
    - Implement `ModuleTabBarProps` interface (accentColor, fab?)
    - Component receives standard `BottomTabBarProps` from `@react-navigation/bottom-tabs` (used as `tabBar` prop of Expo Router `<Tabs>`)
    - Render BlurView background with `navigation.tabBarBlurIntensity` and `navigation.tabBarBorderRadius`
    - Fixed height: `navigation.tabBarHeight` + bottom safe inset
    - Active tint: `accentColor` prop; inactive tint: `navigation.inactiveTint`
    - Icon size: `navigation.tabIconSize`; label: uppercase, `navigation.tabLabelFontSize`, letter-spacing 0.7
    - Optional FAB: render above center tab position when `fab` config is provided
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

  - [ ]* 3.2 Write property test for tab config rendering fidelity
    - **Property 2: Tab config rendering fidelity**
    - Generate random arrays of ModuleTab objects (length 1-8, random icon names and labels), render ModuleTabBar, verify rendered tab count and content matches input
    - **Validates: Requirements 2.1, 2.2**

  - [ ]* 3.3 Write property tests for content area offset calculations
    - **Property 3: Content area top offset calculation**
    - Generate random non-negative integers (0-100) for top safe area inset, verify content area top offset equals `navigation.headerHeight + inset`
    - **Validates: Requirements 4.1**
    - **Property 4: Content area bottom offset calculation**
    - Generate random non-negative integers (0-100) for bottom safe area inset, verify content area bottom offset equals `navigation.tabBarHeight + inset`
    - **Validates: Requirements 4.2**

  - [ ]* 3.4 Write unit tests for ModuleTabBar
    - Test inactive tint matches `navigation.inactiveTint`
    - Test height matches `navigation.tabBarHeight`
    - Test BlurView props match tokens
    - Test FAB renders when config provided, absent when not
    - Test tab press triggers navigation
    - _Requirements: 2.3, 2.4, 2.5, 2.6, 2.9, 2.10_

- [x] 4. Implement HamburgerMenu component (mobile)
  - [x] 4.1 Create `apps/mobile/components/HamburgerMenu.tsx`
    - Implement `HamburgerMenuProps` interface (visible, onClose, currentModuleId)
    - Render as React Native `Modal` with slide animation from the right
    - Semi-transparent backdrop that dismisses on tap
    - List all enabled modules from `ModuleRegistry.getEnabled()` with icon + name
    - Highlight the current module
    - Include "Home" link to hub and "Settings" link
    - Glass morphism styling consistent with design system
    - Handle missing registry context gracefully (empty list with "No modules available")
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ]* 4.2 Write property test for hamburger menu module listing
    - **Property 5: Hamburger menu lists all enabled modules**
    - Generate random subsets of ModuleId values as "enabled modules", mock the registry, render HamburgerMenu, verify rendered module count matches enabled count
    - **Validates: Requirements 5.2**

  - [ ]* 4.3 Write unit tests for HamburgerMenu
    - Test opens/closes correctly based on `visible` prop
    - Test hub link present
    - Test settings link present
    - Test module tap navigates and closes
    - Test backdrop tap dismisses
    - Test empty state when registry context is missing
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 5. Checkpoint - Verify shared components
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement ModuleLayoutWrapper (mobile)
  - [x] 6.1 Create `apps/mobile/components/ModuleLayoutWrapper.tsx`
    - Implement `ModuleLayoutWrapperProps` interface (moduleId, children, fab?, headerTitle?, headerRightAccessory?, screenOptions?)
    - Wrap Expo Router `<Tabs>` with unified `screenOptions`
    - Set `header` to `<ModuleHeader moduleId={moduleId} />`
    - Set `tabBar` to `<ModuleTabBar accentColor={colors.modules[moduleId]} fab={fab} />`
    - Set `sceneStyle.backgroundColor` to `surfaceTiers.lowest`
    - Apply tabBarStyle dimensions from navigation tokens
    - Children are `<Tabs.Screen>` declarations (unchanged from current pattern)
    - Apply top offset (headerHeight + topSafeInset) and bottom offset (tabBarHeight + bottomSafeInset) to content area
    - Log warning and use fallback values for invalid moduleId
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 6.2 Write unit tests for ModuleLayoutWrapper
    - Test composes ModuleHeader, content area, and ModuleTabBar
    - Test scene background color is correct
    - Test works with Tabs.Screen children
    - Test FAB config passes through to ModuleTabBar
    - Test screenOptions overrides are applied
    - _Requirements: 6.1, 6.4, 6.5, 6.6_

- [x] 7. Migrate mobile modules - Batch 1 (simple modules: books, car, closet, fast, flash, garden, mail, market)
  - [x] 7.1 Migrate books, car, closet, fast `_layout.tsx` files to use ModuleLayoutWrapper
    - Replace inline Tabs config with `<ModuleLayoutWrapper moduleId="...">` wrapping `<Tabs.Screen>` declarations
    - Remove custom header, tabBarStyle, headerLeft, TabIcon components
    - Replace emoji icons with MaterialSymbol icon names from module registry
    - Keep ModuleErrorBoundary and ModuleLockGuard wrappers
    - _Requirements: 7.1, 7.2, 7.3, 7.5_

  - [x] 7.2 Migrate flash, garden, mail, market `_layout.tsx` files to use ModuleLayoutWrapper
    - Same pattern as 7.1
    - _Requirements: 7.1, 7.2, 7.3, 7.5_

- [x] 8. Migrate mobile modules - Batch 2 (meds, mood, nutrition, pets, presence, recipes, rsvp, subs)
  - [x] 8.1 Migrate meds, mood, nutrition, pets `_layout.tsx` files
    - _Requirements: 7.1, 7.2, 7.3, 7.5_

  - [x] 8.2 Migrate presence, recipes, rsvp, subs `_layout.tsx` files
    - _Requirements: 7.1, 7.2, 7.3, 7.5_

- [x] 9. Migrate mobile modules - Batch 3 (surf, trails, voice, words, workouts, cycle, forums, health)
  - [x] 9.1 Migrate surf, trails, voice, words `_layout.tsx` files
    - _Requirements: 7.1, 7.2, 7.3, 7.5_

  - [x] 9.2 Migrate workouts, cycle, forums, health `_layout.tsx` files
    - _Requirements: 7.1, 7.2, 7.3, 7.5_

- [x] 10. Migrate mobile modules - Batch 4 (complex modules: notes, journal, habits, stars, budget)
  - [x] 10.1 Migrate notes and journal `_layout.tsx` files
    - These modules use emoji icons extensively; replace all with MaterialSymbol icon names
    - _Requirements: 7.1, 7.2, 7.3, 7.5_

  - [x] 10.2 Migrate habits `_layout.tsx` to use ModuleLayoutWrapper
    - Remove custom HabitsTabsHeader, TabBarBackground, TabIcon, PlaceholderTabButton components
    - Preserve QuickCheckFAB overlay logic (rendered outside ModuleLayoutWrapper, not via the tab bar FAB slot)
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 10.3 Migrate stars `_layout.tsx` to use ModuleLayoutWrapper
    - Remove custom StarsHeader, TabBarBackground, StarsTabIcon components
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 10.4 Migrate budget `_layout.tsx` to use ModuleLayoutWrapper with FAB slot
    - Pass `fab` config to ModuleLayoutWrapper for the add-transaction FAB
    - Remove custom BudgetTabsHeader, TabBarBackground, AddTransactionFab, SubscriptionsTabButton components
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 11. Checkpoint - Verify all mobile migrations
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Deprecate BackToHubButton
  - [x] 12.1 Add deprecation notice to `apps/mobile/components/BackToHubButton.tsx`
    - Add `@deprecated` JSDoc tag pointing to ModuleHeader as the replacement
    - Verify no module `_layout.tsx` files still import BackToHubButton (it may still be used in non-layout screens)
    - _Requirements: 7.1, 7.3_

- [x] 13. Implement web navigation components
  - [x] 13.1 Create `apps/web/components/ModuleHeader.tsx` (web version)
    - Implement `WebModuleHeaderProps` interface (moduleId, title?, navLinks?, maxWidth?)
    - Render consistent header bar with module name, optional nav links
    - Use `navigation.webHeaderHeight` for height
    - Glass morphism background via `backdrop-filter: blur()`
    - _Requirements: 8.1, 8.2_

  - [x] 13.2 Create `apps/web/components/ModuleLayoutWrapper.tsx` (web version)
    - Implement `WebModuleLayoutWrapperProps` interface (moduleId, children, navLinks?, maxWidth?)
    - Apply `margin: '-32px'` to counteract root layout padding
    - Render WebModuleHeader at top
    - Wrap children in content container with `navigation.webContentPaddingHorizontal` and `navigation.webContentMaxWidth`
    - Set background to `var(--background)`
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ]* 13.3 Write unit tests for web components
    - Test web header renders with correct height from tokens
    - Test negative margin is applied
    - Test content max-width is respected
    - Test navLinks render correctly
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 14. Migrate web module layouts
  - [x] 14.1 Migrate a representative set of web module layouts (books, notes, habits, stars) to use web ModuleLayoutWrapper
    - Replace inline header styling with shared WebModuleLayoutWrapper
    - Remove custom inline header implementations
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 14.2 Migrate remaining web module layouts to use web ModuleLayoutWrapper
    - Apply same pattern to all other web module layout.tsx files
    - Budget web layout has a unique sidebar pattern; wrap only the header portion, preserve sidebar
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 15. Final checkpoint - Full verification
  - Ensure all tests pass, ask the user if questions arise.
  - Run static analysis: verify all 30 mobile module `_layout.tsx` files have no inline `tabBarStyle`, `headerStyle`, or `header:` overrides
  - Verify all module `navigation.tabs` entries use MaterialSymbol icon names (no emoji characters)
  - Verify `packages/ui/src/tokens/navigation.ts` exports all required token keys

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using fast-check
- Unit tests validate specific examples and edge cases
- Mobile module migration is split into 4 batches: simple modules first, complex modules (notes, journal, habits, stars, budget) last
- Budget module requires special FAB slot handling
- Habits module has a QuickCheckFAB that lives outside the tab bar and should be preserved separately
- BackToHubButton deprecation happens after all migrations to avoid breaking intermediate states
