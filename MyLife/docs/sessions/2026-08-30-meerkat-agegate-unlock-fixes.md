# 2026-08-30: Meerkat age-gate auto-advance + Unlock screen P0 fixes

## What

Two work packages, both surfaces, all changes left UNCOMMITTED in the working tree at the founder's request (commit permission declined; founder will commit).

### 1. Age gate birth-date auto-advance (this session, direct)

- `apps/meerkat/app/(root)/components/AgeGate.tsx`: Month advances focus to Day at 2 digits, Day to Year at 2 digits, Year blurs the keyboard at 4 digits. No auto-submit on the 4th year digit: an underage answer durably locks the device, so the user reviews before tapping Continue.
- `apps/meerkat-web/src/ui/onboarding/AgeGateOverlay.tsx`: same behavior with DOM refs.
- `apps/meerkat-web/src/ui/shell/Field.tsx`: `TextFieldProps` now extends `ComponentProps<'input'>` so React 19 ref-as-prop reaches the underlying `<input>`.

### 2. Unlock Meerkat screen (Fable 5 subagent `unlock-screen-fixer`, verified by lead)

Founder repro: reached Unlock via the create-community entitlement gate; "Unlock for $4.99" tap did nothing, then the whole app froze. Screenshot also showed the enabled buy button beside "The in-app purchase is not available in this build." and green status dots on blocker messages.

Root cause 1 (freeze): navigation/modal race in `OnboardingGate.chooseStart`'s locked branch. One tap (a) fired `markOnboardingComplete` whose SYNCHRONOUS listener made AppStack swap the whole `<Stack>` for `<Redirect href="/upgrade" />`, (b) raced an imperative `router.replace('/upgrade')`, and (c) unmounted the visible RN `<Modal>` outright, leaving a stuck invisible iOS modal window that swallowed all touches. `onPurchase` also had no try/catch.

Root cause 2 (billing dead even after key wiring, 58c6ffce): babel-preset-expo inlines `EXPO_PUBLIC_*` only as literal `process.env.NAME` member expressions; `app-unlock.ts` read the RevenueCat key off a captured `process.env` object, so the key is `undefined` in every production/TestFlight bundle.

Fixes: effect-driven entitlement gate keeps the Stack mounted (`_layout.tsx`); OnboardingGate modal hides instead of unmounting and queues navigation to `onDismiss`; `publicPurchaseEnv()` call-time member reads; upgrade screen fail-closed affordances via new pure `unlock-view-core.ts` (buy never renders beside the unavailable pill, purchasing phase, re-entry guards, try/catch, cancel-to-ready, back-chevron `canGoBack` fallback, footnote split into bullets, link-pill copy); `kit.tsx` HonestNotice `tone` prop (no more green dot on blockers); web `AppUnlockSection` now consumes Stripe `?unlock=success` with server-side confirmation (param alone never unlocks) and honest `?unlock=cancel` copy; parity script twin exception. New tests: `entitlement-gate-nav.test.ts`, `unlock-view-core.test.ts`, `stripe-return-honesty.test.ts`, extended `app-unlock.test.ts` (bans captured `process.env` at source level).

## Verification

- Mobile: typecheck clean, 1609 tests / 156 files pass.
- Web: typecheck clean, 1125 tests / 143 files pass.
- `node scripts/check-meerkat-parity.mjs`: all pass. `pnpm gate:function:changed`: exit 0.
- Lead re-ran parity + both typechecks independently after the agent finished: green.

## Founder actions (cannot be fixed from code)

1. Cut a new TestFlight build (`cd apps/meerkat && eas build --profile testflight --platform ios`, then `eas submit`); the installed build predates the RC key and every fix.
2. Device-verify: fresh install, pass age gate, tap "Create a community" while locked. Done when the onboarding sheet fades out, Unlock appears, and every button responds.
3. RevenueCat (key `appl_vYfzEgFOIcjKkUoLCGIQcGutIDG`): confirm product `meerkat_app_unlock` attached and IAP at least "Ready to Submit" in App Store Connect.
4. Optional: add `MEERKAT_HOSTED_API_URL` to `build.testflight.env` in `apps/meerkat/eas.json` to light up purchase linking in TestFlight.

## Remaining / adjacent

- DoWork has the identical env-capture bug at `apps/dowork/app/(root)/data/purchases.ts:128` (out of scope this session; logged Unresolved).
- Recursive prompt chain started: `apps/meerkat/docs/prompts/PROMPT-unlock-screen-001.md` (issue report, resolution report, lessons, next-session briefing with adjacent-sweep instruction, verbatim recursive clause; successor sessions write 002, 003, ... with merged learnings).

## Decisions

- No auto-submit on age-gate year completion (durable-lock safety).
- All work left uncommitted per founder's declined commit prompt.
