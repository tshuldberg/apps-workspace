# Requirements Document

## Introduction

MyLife is a personal life hub with 30 modules (books, budget, car, closet, cycle, fast, flash, forums, garden, habits, health, homes, journal, mail, market, meds, mood, notes, nutrition, pets, presence, recipes, rsvp, stars, subs, surf, trails, voice, words, workouts). Each module currently implements its own header, tab bar, and content layout independently, resulting in inconsistent navigation heights, styling, spacing, and behavior across the mobile app. This feature standardizes all module navigation into a single unified system: one shared header component (with back-to-hub and hamburger menu), one shared bottom tab bar component (accepting per-module action configurations), and a safe content area that prevents overlap between header and footer.

## Glossary

- **Module_Header**: The shared top navigation bar rendered at the top of every open module screen on mobile
- **Module_Tab_Bar**: The shared bottom navigation bar rendered at the bottom of every open module screen on mobile
- **Content_Area**: The scrollable region between the Module_Header and Module_Tab_Bar where module screen content is displayed
- **Hub**: The central app selector screen listing all enabled modules, reachable via the back button
- **Hamburger_Menu**: A slide-out or overlay menu triggered by a three-line icon in the Module_Header, providing access to cross-module actions
- **Tab_Action_Config**: A per-module data structure that declares the tab items (icon, label, route) displayed in the Module_Tab_Bar for that module
- **Navigation_Token**: A design token in packages/ui defining standardized dimensions, spacing, and styling values for navigation components
- **Module_Layout_Wrapper**: A shared layout component that composes the Module_Header, Content_Area, and Module_Tab_Bar into a consistent screen structure for every module
- **Safe_Inset**: Device-specific safe area insets (status bar, home indicator) that navigation components must respect

## Requirements

### Requirement 1: Shared Module Header

**User Story:** As a user, I want every module to have the same top navigation bar so that I always know where to find the back button and menu regardless of which module I am in.

#### Acceptance Criteria

1. THE Module_Header SHALL render a back button on the left side that navigates the user to the Hub screen
2. THE Module_Header SHALL render a hamburger menu icon on the right side that opens the Hamburger_Menu
3. THE Module_Header SHALL display the current module name between the back button and the hamburger menu icon
4. THE Module_Header SHALL use the per-module accent color from the colors.modules token for the module name text
5. WHEN the user taps the back button, THE Module_Header SHALL navigate to the Hub screen using router.replace('/(hub)')
6. THE Module_Header SHALL apply a fixed height defined by the Navigation_Token header_height value
7. THE Module_Header SHALL respect the top Safe_Inset so that content does not render behind the device status bar
8. THE Module_Header SHALL be implemented as a single shared component in apps/mobile/components/ consumed by all 30 modules

### Requirement 2: Shared Module Tab Bar

**User Story:** As a user, I want the bottom navigation bar to look and feel the same in every module so that I have a consistent interaction pattern, with only the action items changing per module.

#### Acceptance Criteria

1. THE Module_Tab_Bar SHALL accept a Tab_Action_Config array to determine which tab items to display for the current module
2. THE Module_Tab_Bar SHALL render each tab item with an icon and a label as specified in the Tab_Action_Config
3. THE Module_Tab_Bar SHALL use the per-module accent color from colors.modules for the active tab tint
4. THE Module_Tab_Bar SHALL use a standardized inactive tint color defined in Navigation_Token
5. THE Module_Tab_Bar SHALL apply a fixed height defined by the Navigation_Token tab_bar_height value
6. THE Module_Tab_Bar SHALL render a BlurView background with consistent tint, intensity, and border radius values defined in Navigation_Token
7. THE Module_Tab_Bar SHALL respect the bottom Safe_Inset so that tab items do not render behind the device home indicator
8. THE Module_Tab_Bar SHALL be implemented as a single shared component in apps/mobile/components/ consumed by all 30 modules
9. WHEN a tab item is tapped, THE Module_Tab_Bar SHALL navigate to the route specified in that tab item's Tab_Action_Config entry
10. THE Module_Tab_Bar SHALL support an optional floating action button slot for modules that require a primary creation action (such as budget's add-transaction button)

### Requirement 3: Navigation Design Tokens

**User Story:** As a developer, I want all navigation dimensions and styling values defined as shared tokens so that changes propagate consistently across all modules.

#### Acceptance Criteria

1. THE Navigation_Token set SHALL define a header_height value used by the Module_Header
2. THE Navigation_Token set SHALL define a tab_bar_height value used by the Module_Tab_Bar
3. THE Navigation_Token set SHALL define a tab_bar_blur_intensity numeric value used by the Module_Tab_Bar BlurView
4. THE Navigation_Token set SHALL define a tab_bar_border_radius value used by the Module_Tab_Bar corner rounding
5. THE Navigation_Token set SHALL define an inactive_tint color value used by the Module_Tab_Bar for non-selected tabs
6. THE Navigation_Token set SHALL define a tab_label_font_size value and a tab_icon_size value
7. THE Navigation_Token set SHALL be exported from packages/ui/src/tokens/ alongside existing color and spacing tokens
8. THE Navigation_Token set SHALL define a content_padding_horizontal value used by the Content_Area

### Requirement 4: Non-Overlapping Content Area

**User Story:** As a user, I want the content between the header and footer to display without any visual overlap so that text and controls are always fully visible and tappable.

#### Acceptance Criteria

1. THE Module_Layout_Wrapper SHALL apply top padding or margin equal to the Module_Header rendered height plus the top Safe_Inset
2. THE Module_Layout_Wrapper SHALL apply bottom padding or margin equal to the Module_Tab_Bar rendered height plus the bottom Safe_Inset
3. THE Content_Area SHALL occupy the full vertical space between the Module_Header bottom edge and the Module_Tab_Bar top edge without overlapping either component
4. WHEN the Module_Tab_Bar is positioned absolutely, THE Module_Layout_Wrapper SHALL add bottom inset compensation to the Content_Area so that the last content item is not hidden behind the tab bar
5. THE Module_Layout_Wrapper SHALL use Navigation_Token values for all spacing calculations rather than hardcoded pixel values

### Requirement 5: Hamburger Menu

**User Story:** As a user, I want a hamburger menu available in every module so that I can access cross-module shortcuts and settings without returning to the hub first.

#### Acceptance Criteria

1. WHEN the user taps the hamburger menu icon, THE Hamburger_Menu SHALL open as an overlay or slide-out panel
2. THE Hamburger_Menu SHALL display a list of enabled modules as navigation shortcuts
3. THE Hamburger_Menu SHALL display a link to the Hub screen
4. THE Hamburger_Menu SHALL display a link to app-level settings
5. WHEN the user taps a module shortcut in the Hamburger_Menu, THE Hamburger_Menu SHALL navigate to that module and close the menu
6. WHEN the user taps outside the Hamburger_Menu or swipes it closed, THE Hamburger_Menu SHALL dismiss
7. THE Hamburger_Menu SHALL be implemented as a single shared component in apps/mobile/components/

### Requirement 6: Module Layout Wrapper

**User Story:** As a developer, I want a single layout wrapper component that composes the header, content area, and tab bar so that adding navigation to a module requires only providing a Tab_Action_Config.

#### Acceptance Criteria

1. THE Module_Layout_Wrapper SHALL compose the Module_Header, Content_Area, and Module_Tab_Bar into a single layout structure
2. THE Module_Layout_Wrapper SHALL accept a module identifier to resolve the correct accent color and module display name
3. THE Module_Layout_Wrapper SHALL accept a Tab_Action_Config array to pass to the Module_Tab_Bar
4. THE Module_Layout_Wrapper SHALL be usable as the Expo Router Tabs layout wrapper for each module's _layout.tsx file
5. WHEN a module's _layout.tsx adopts the Module_Layout_Wrapper, THE module SHALL remove all custom header, tab bar styling, and spacing logic previously defined inline
6. THE Module_Layout_Wrapper SHALL set the scene background color to the base surface color from the existing color tokens

### Requirement 7: Migration of Existing Modules

**User Story:** As a developer, I want all 30 existing module layouts migrated to the unified navigation system so that no module retains its own custom navigation implementation.

#### Acceptance Criteria

1. WHEN a module _layout.tsx is migrated, THE module SHALL use the Module_Layout_Wrapper instead of inline Tabs configuration for header and tab bar
2. WHEN a module _layout.tsx is migrated, THE module SHALL define its Tab_Action_Config as a static array declaring its tab items (icon, label, route)
3. WHEN all 30 modules are migrated, THE mobile app SHALL contain zero inline tabBarStyle, headerStyle, or header function overrides in any module _layout.tsx
4. IF a module has custom tab bar features (such as budget's floating action button), THEN THE Module_Tab_Bar SHALL support that feature through the optional FAB slot rather than a custom tab bar implementation
5. WHEN a module previously used emoji icons for tabs (such as journal and notes), THE migrated module SHALL use MaterialSymbol icons consistent with the unified icon system

### Requirement 8: Web Navigation Consistency

**User Story:** As a user on the web app, I want the per-module layout headers and content spacing to follow a consistent pattern so that the web experience feels as unified as mobile.

#### Acceptance Criteria

1. THE web module layout files (apps/web/app/{module}/layout.tsx) SHALL use a shared header component with consistent height, padding, and typography
2. THE web module layouts SHALL use Navigation_Token values for header height and content padding rather than hardcoded pixel values
3. THE web module layouts SHALL apply consistent negative margin compensation (to counteract the root layout padding) using a shared utility or wrapper
4. WHEN a web module layout is migrated, THE module SHALL remove custom inline header styling and use the shared web header component
