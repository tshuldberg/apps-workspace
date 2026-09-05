# Meerkat UI/UX and themes review

2026-09-04. Implemented refinements, with browser and iOS simulator evidence.

Meerkat now offers **18 built-in themes**, each with light and dark palettes. The existing Open Burrow default, local theme storage, import/export and community-theme boundaries remain in place.

## Reviewed surfaces

Desktop and mobile browser: Feed, Messages, Public, My Library, community creation, Settings, Appearance and theme sharing. Native iOS: age gate, onboarding, Appearance and theme sharing. Independent source audit covered shared controls, safe areas and navigation.

## Findings and refinements

| Area | Before | Implemented |
|---|---|---|
| Theme choice | Six built-in presets. | 18 distinct light/dark presets in the existing shared package; local persistence and theme sharing retained. |
| Theme discovery | Placeholder-like previews; sharing hidden behind a long press on iOS. | Conversation previews, collection filters, selected-theme feedback, visible Share actions, single-column layout for large native text. |
| Desktop settings | Narrow scrolling panel with capability documentation before appearance. | Wider desktop panel, Appearance first as a disclosure, capability details behind their own disclosure, sticky close control. |
| Navigation | Five browser tabs used six grid columns; letters and emoji differed from iOS. | Five equal columns and shared line icons on desktop/phone web; readable native tab labels and correct 1-of-5 accessibility labels. |
| Keyboard access | Browser dialogs did not manage keyboard focus. | Initial focus, Tab containment, topmost-modal Escape handling and trigger focus restoration; visible focus indicators. |
| Touch and text | Several controls below 44 points; 14px phone browser inputs. | Larger shared native buttons, copy and composer controls; 44px browser touch controls, 16px phone fields and reduced-motion support. |
| iOS appearance | Status-bar glyphs followed the OS instead of selected theme; scrolled content could pass behind status text. | Status bar follows resolved app theme; native Appearance keeps the top safe area outside scrolling content. |
| Product copy | Messages and device linking exposed table names and defensive implementation claims. | Plain-language empty states and linking guidance on both surfaces. Device-local storage meaning remains guarded by parity checks. |
| Optional native runtime | Expo Go probing imported unsupported WebRTC code and displayed a red error overlay. | Check the registered WebRTCModule before importing the runtime; absent builds stay unavailable. Dedicated loader regression tests added. |

## Theme catalog

Open Burrow, Calm, Social, Playful, Serious, Tidepool, Alpine, Driftwood, Dune, Terracotta, Rosewater, Orchid, Iris, Cobalt, Graphite, Matcha, Citrus, High contrast.

The HTML twin includes an interactive preview using the actual resolved package colors. Preview conversations are sample content.

## Verification

- 118 shared theme tests pass, including 18 unique palettes, import/export round trips, light/dark body/button contrast, and new-theme secondary/accent text contrast.
- Both app TypeScript checks and the production web build pass. The existing build still warns about large JavaScript chunks.
- Browser checks: 320, 390, 768 and 1440px layouts without modal overflow; five mobile tabs; filtering, applying, sharing, reload persistence and keyboard focus containment/restoration.
- iPhone 16e / iOS 26.2 / Expo Go: current-source onboarding and Appearance inspected; light/dark switching, six-theme Calm filter, theme application and share-sheet actions tested. Accessibility-large text uses one column and share actions remain reachable. Native import validation and Cancel also pass with the keyboard open after the optional-runtime fix.
- Full function-quality and parity gates were run against the shared working tree. Final validation details and command logs are recorded in the session log.

## Launch verification still required

- This is a UI refinement review, not a launch approval. Physical iPhone/iPad/Android testing and a signed release build remain necessary, including VoiceOver navigation, keyboard dismissal, call/media permissions and delivery flows.
- Desktop evidence is the browser client. No separate native desktop client was verified. Android was reviewed through shared React Native source; no Android emulator/device was tested.
- Browser private surfaces used a local entitlement response fixture. No purchase, live public publishing or real two-device delivery is proven by these screenshots.
- Public browsing was reviewed in the honest unconfigured-service state. Populated public and remote-community screens need provider/device data for final launch review.
- Body/button AA checks cover specific color pairs. They are not an app-wide accessibility certification; older preset tertiary text and custom themes still need screen-level contrast review.

## Design references

Touch and readability refinements follow [Apple UI design guidance](https://developer.apple.com/design/tips/) and [Apple accessibility guidance](https://developer.apple.com/design/human-interface-guidelines/accessibility/). Color-pair checks use [WCAG contrast criteria](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum).

## Implementation and evidence

Primary code: `packages/meerkat-theme/src/presets/`, native `appearance.tsx`, `kit.tsx`, `AppThemeProvider.tsx`, tab layout and WebRTC loader; web `AppearanceSection.tsx`, `appearance.css`, `app.css`, shared Modal and navigation icons.

[Session log and validation commands](../sessions/2026-09-04-meerkat-ui-theme-polish.md). Screenshots are current implementation captures, not before/after comparisons. Existing workspace changes were preserved; no deployment was performed. The user authorized committing and pushing this session after the review.
