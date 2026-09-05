# Meerkat UI/UX and theme refinements

Date: 2026-09-04. Scope: standalone Meerkat iOS/Android source and desktop/mobile browser UI. Existing workspace changes preserved; no deployment. Commit and branch push authorized by the user after the review.

## Result

18 built-in themes, each with light/dark variants, through the existing shared package. Added Tidepool, Alpine, Driftwood, Dune, Terracotta, Rosewater, Orchid, Iris, Cobalt, Graphite, Matcha and Citrus. Kept the six existing presets, default and local persistence model.

Both theme pickers now use conversation previews, collection filters, current-theme feedback and visible sharing. Native cards expand to one column for accessibility text. Web Settings is wider on desktop, with Appearance first and capability documentation collapsed. Navigation uses consistent SVG/Lucide-style icons; browser tabs use five columns. Native labels fit and announce five visible tabs, rather than 45 internal routes.

Shared fixes: 44-point native copy/composer controls and 48-point primary buttons, larger notices, 44px phone browser controls, 16px phone input text, focus indicators, reduced motion, topmost-dialog focus containment/restoration and sticky close controls. Native status bar follows selected theme; Appearance reserves its top safe area outside the scroll view. Theme sheets avoid the keyboard. Onboarding, Messages and own-device guidance use plain language while preserving storage/delivery semantics.

Expo Go QA exposed an existing optional-WebRTC import invariant. The loader now checks NativeModules.WebRTCModule before requiring the runtime. Missing runtimes stay unavailable; no protocol or cryptography changed. VM regression tests prove the unavailable package is not evaluated and a registered bridge still enables the backend.

## Files owned by this task

- `packages/meerkat-theme/src/presets/{index,launch}.ts`, `src/__tests__/launch-catalog.test.ts`.
- Native: `app/_layout.tsx`, `app/(root)/(tabs)/{_layout,appearance,messages}.tsx`, `components/{kit,OnboardingGate,OwnDeviceLinkCard}.tsx`, `components/chat/ChatComposer.tsx`, `providers/AppThemeProvider.tsx`.
- Native data: `data/{messages-core,dm-view-core,webrtc-backend}.ts`; tests `messages-core.test.ts`, new `webrtc-runtime-guard.test.ts`. The existing copy expectation was updated to the new copy without weakening behavior assertions.
- Web: `src/ui/app.css`, `settings/{AppearanceSection,SettingsOverlay}.tsx`, `settings/appearance.css`, `shell/{Modal,MobilePrimaryNav,NavigationIcon}.tsx`, `community/{CommunityRail,IdentityFooter}.tsx`, `messages/{MessagesView,OwnDeviceLinkPanel}.tsx`, `src/lib/dm-view-core.ts`.
- `scripts/check-meerkat-parity.mjs`: require the plain-language device-local storage sentence on both surfaces instead of a literal database-table name in UI copy. Existing unrelated script changes preserved.
- Root report pair, indexes, memory and errors ledger.

## Verification

Working directory for repository commands: `/Users/trey/Desktop/Apps/MyLife`.

- `FUNCTION_GATE_MAX_WORKERS=1 pnpm gate:function:changed`: full shared-working-tree gate run; final result recorded below. Includes package lint, types, selected tests and hub consumer typechecks.
- `FUNCTION_GATE_MAX_WORKERS=1 pnpm gate:function --dir apps/meerkat --tests app/__tests__/transport-availability.test.ts,app/__tests__/webrtc-runtime-guard.test.ts,app/__tests__/messages-core.test.ts,app/__tests__/dm-view-core.test.ts`: passes, 51 tests, native lint and both native TypeScript configurations.
- `pnpm --filter @mylife/meerkat-theme test`: 118 pass. Covers schema/contrast, uniqueness of all 18 palettes, sharing round trips and new-theme secondary/accent contrast.
- Native theme store, community core and leakage tests: 28 pass. Community-theme scope remains unchanged.
- `pnpm --filter @mylife/meerkat-web build`: passes. Existing large-chunk warning persists.
- `pnpm check:parity`: passes. `node scripts/check-meerkat-parity.mjs`: passes after updating the two lexical storage-copy checks.
- `pnpm check:generated-artifacts` and `git diff --check`: final results recorded below.

Browser via Playwright CLI, local Vite port 3194: Feed, Messages, Public unavailable state, My Library, community creation, Settings, Appearance and sharing. Private UI uses the existing test entitlement response pattern; it is not payment proof. Checked 320/390/768/1440px widths without modal overflow, 390px input text at 16px, five bottom tabs, six Calm presets, apply/share flow, stored Rosewater/light surviving reload, modal focus wrap/restore and 18 rendered preset actions. No real messages sent.

Native iPhone 16e, iOS 26.2, current source in Expo Go on port 8094: age-gate/onboarding and gallery inspection; light/dark switching and status glyphs; filter, theme application and sharing; accessibility-large single-column cards and scrollable share actions via Maestro. Simulator content size restored to its original medium setting. Import field/error/Cancel visibly remain above the keyboard. Maestro's exact TextInput selectors initially failed because XCUITest combines label and placeholder; a coordinate selected the observed field and entered invalid test input. No user theme was imported. The WebRTC overlay was independently fixed and absent on fresh launch.

Artifacts: `/Users/trey/.gstack/meerkat-desktop-final.jpg`, `meerkat-phone-final.jpg`, `meerkat-native-light.png`, `meerkat-native-dark.png`, `meerkat-native-large-text.png`, `meerkat-native-keyboard.png`. The HTML report embeds native and desktop screenshots and actual palette JSON; its light/dark/filter controls were exercised. Local report server: port 3196.

## Limits and decisions

UI work does not change the separate launch/security verdict. Signed-build and physical iPhone/iPad/Android verification, real payment/provider states, live delivery and call/media permissions remain. Android was source-reviewed only; desktop means the browser client. Public was unavailable under local configuration. No hub Meerkat module was found; the shared theme package and active mobile/web standalone pair are the parity targets. General screen-level contrast and full VoiceOver flows still need release-device review; tested color pairs are not whole-app certification.

The broad tree was already dirty. No unrelated source edits were staged or committed. Large generated screenshots remain outside tracked docs; the report embeds only selected evidence. Product design follows Apple touch/readability guidance and WCAG color-pair criteria, linked in the report.

## Final results

Full changed-function gate: PASS (468 selected tests across the shared dirty tree, package lint/types and both hub consumer typechecks). Focused native runtime gate: PASS, 51 tests. Full parity: PASS. Generated-artifact guard: PASS. Diff whitespace check: PASS. Web production build: PASS. Theme/typing and simulator evidence above remains scoped to UI functionality.

Raw command logs for this session: `/tmp/meerkat-ui-complete-gate.log`, `/tmp/meerkat-ui-final-parity.log`, `/tmp/meerkat-ui-last-native-gate.log`, `/tmp/meerkat-ui-verified-build.log`, `/tmp/meerkat-ui-import-verified.log`. Simulator keyboard automation initially attempted Cancel after its hideKeyboard command had already dismissed the sheet; a screenshot confirmed the gallery returned.

Final native import flow: PASS. Maestro opened Import, matched the combined TextInput label with a regex, entered an invalid code, verified the real inline error, tapped Cancel with the keyboard open, and verified the field disappeared. All six steps pass in `/tmp/meerkat-ui-import-verified.log`.

Commit preparation: isolated this session's hunks in shared dirty files. Run the pre-commit quality checks directly because the installed hook stashes entire app scopes containing concurrent work. Commit only the reviewed index, with hook stashing disabled for this invocation.

Commit validation: `FUNCTION_GATE_MAX_WORKERS=1 pnpm gate:function:changed --staged` passed (1,271 tests, app/package lint and types, hub consumer types). `pnpm check:web-barrel`, `pnpm check:esm-require`, `pnpm check:generated-artifacts` and staged whitespace checks passed. Log: `/tmp/meerkat-ui-commit-gate.log`. All checks ran against the shared working tree with staged file selection; unrelated working changes remain uncommitted.
