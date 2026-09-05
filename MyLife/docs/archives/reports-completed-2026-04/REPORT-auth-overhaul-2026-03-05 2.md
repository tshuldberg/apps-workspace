# Auth Overhaul Report - 2026-03-05

## Objective

Redesign MyLife authentication with a dual-auth model (local-first by default, cloud opt-in per module), a new tiered password policy that favors passphrases, and a unified login UI across all apps.

## Password Policy

| Condition | Requirements |
|-----------|-------------|
| Under 16 characters | Min 8 chars + 1 uppercase + 1 lowercase + 1 digit + 1 special character |
| 16+ characters | Length alone is sufficient (no complexity requirements) |
| Always allowed | Letters, numbers, symbols, spaces |
| Recommendation | 4 random words as a passphrase (with or without spaces) |

## What Was Built

### 1. `@mylife/auth` package (`packages/auth/`)

Full shared auth package replacing the previous placeholder.

**Files created:**
- `src/password-validation.ts` -- `validatePassword()`, `getPasswordStrength()`, `generatePassphraseSuggestion()` with a curated 135-word list
- `src/local-auth.ts` -- SQLite-backed auth service with bcrypt hashing (10 rounds), session management (30-day TTL), register/login/logout/update-password/delete-account
- `src/types.ts` -- `AuthMode` ('local' | 'cloud'), `CloudProvider`, `PerModuleAuthConfig`, `AuthUser`, `AuthSession`, `AuthState`, `PasswordStrength`, Zod schemas (`EmailSchema`, `DisplayNameSchema`)
- `src/index.ts` -- Barrel exports
- `src/__tests__/password-validation.test.ts` -- 28 tests (all passing)
- `package.json` -- Dependencies: `@mylife/db`, `bcryptjs`, `zod`
- `tsconfig.json` -- TypeScript config extending base

**Database tables (hub_ prefix):**
- `hub_auth_users` (id, email, password_hash, display_name, created_at, updated_at)
- `hub_auth_sessions` (id, user_id, created_at, expires_at)

### 2. UI Components (`packages/ui/src/components/`)

Seven new components added to `@mylife/ui`:

| Component | Purpose |
|-----------|---------|
| `PasswordStrengthMeter` | 4-segment color bar (weak=red, fair=amber, strong=green, very_strong=bright green) |
| `PasswordInput` | TextInput + show/hide toggle + real-time strength meter + validation error list |
| `PassphraseRecommendation` | Card with "Try a passphrase instead" heading, generate button, suggestion display, "Use this" button |
| `AuthForm` | Unified sign-up/sign-in form for mobile (React Native). Props: `mode`, `onSubmit`, `error` |
| `ModuleAuthPicker` | Per-module local vs cloud toggle list with network-required hints |
| `OnboardingPage` | Reusable full-screen layout: hero (icon + title + subtitle), scrollable body, sticky footer |
| `OnboardingFlow` | 3-page privacy onboarding: "Your data stays yours" / "Some features need the internet" / "Protect your data" |

All components use the MyLife dark theme tokens and are cross-platform (React Native).

### 3. Privacy Onboarding Flow

**Page 1 -- "Your data stays yours"**
- All data stored locally on device
- Zero analytics, zero telemetry
- Works completely offline

**Page 2 -- "Some features need the internet"**
- MySurf fetches live wave and tide data
- MyWorkouts syncs across devices
- MyHomes connects to listing services
- Everything else stays fully offline

**Page 3 -- "Protect your data"**
- Password creation with PasswordInput + PassphraseRecommendation
- Create Account button disabled until password is valid

Pages 1 and 2 are skippable. Page 3 (password creation) is required.

### 4. Hub App Wiring

**Mobile (Expo):**
- `apps/mobile/app/(auth)/sign-up.tsx` -- Uses `AuthForm` + `registerUser` from `@mylife/auth`
- `apps/mobile/app/(auth)/sign-in.tsx` -- Uses `AuthForm` + `loginUser` from `@mylife/auth`
- `apps/mobile/app/(hub)/onboarding-privacy.tsx` -- Uses `OnboardingFlow`, routes to mode selection
- `apps/mobile/app/_layout.tsx` -- Added `(auth)` screen to Stack navigator

**Web (Next.js 15):**
- `apps/web/components/AuthForm.tsx` -- HTML/CSS implementation of the unified auth form (web-compatible, same UX as mobile)
- `apps/web/app/auth/sign-up/page.tsx` -- Uses `WebAuthForm` + `registerUser`
- `apps/web/app/auth/sign-in/page.tsx` -- Uses `WebAuthForm` + `loginUser`
- `apps/web/app/onboarding/privacy/page.tsx` -- Standalone 3-page onboarding flow

**Dependency additions:**
- `@mylife/auth` added to `apps/mobile/package.json`
- `@mylife/auth` added to `apps/web/package.json`
- `@mylife/auth` added to `packages/ui/package.json`

### 5. Bug Fixes During Implementation

- Fixed implicit `any` types in web onboarding page (strength meter segment lookups)
- Extracted `STRENGTH_SEGMENTS` typed constant to replace inline object literals
- Removed unused imports (`React`, `Text`, `colors`, `borderRadius`) from OnboardingFlow and ModuleAuthPicker
- Fixed deprecated `React.FormEvent` to `React.FormEvent<HTMLFormElement>` in web AuthForm

## Architecture Decisions

**Dual-auth model:** Local auth is the default. Cloud auth (Supabase, Clerk) is opt-in per module. Users choose which modules connect to the cloud via `ModuleAuthPicker`.

**Tiered password policy:** Follows NIST SP 800-63B guidance. Short passwords need complexity; long passphrases (16+ chars) rely on length alone. This removes the main friction point (special char requirements) while maintaining security.

**bcryptjs over native bcrypt:** Pure-JS implementation works in React Native, Expo, and Node.js without native bindings.

**Separate web AuthForm:** The `@mylife/ui` AuthForm uses React Native primitives. Web apps (Next.js) use an HTML/CSS re-implementation in `apps/web/components/AuthForm.tsx` that shares the same `@mylife/auth` validation logic. Same policy, same UX, different renderers.

**Passphrase word list:** 135 curated words, 4-7 letters each, common enough to remember. 4 words from 135 = ~330 million combinations. Generated via `crypto.getRandomValues()` for secure randomness.

## Verification

- `pnpm --filter @mylife/auth test` -- 28/28 tests pass
- `pnpm --filter @mylife/auth typecheck` -- Clean
- `pnpm --filter @mylife/ui typecheck` -- Clean
- `pnpm check:parity` -- Pass (pre-existing failures in MyMail and MyHealth are unrelated)

## Remaining Work (Future Sessions)

| Item | Description |
|------|-------------|
| Standalone validation | MyWorkouts, MySurf, MyHomes need their own copies of password validation in their `@myworkouts/shared` / `@mysurf/shared` packages (outside MyLife workspace) |
| First-launch detection | Check if `hub_auth_users` has rows to auto-redirect new users to onboarding |
| Auth state persistence | Store session ID in secure storage (mobile) or httpOnly cookie (web) and check on app launch |
| Per-module auth settings | Save local/cloud selections from ModuleAuthPicker to SQLite |
| Cloud auth integration | Wire Supabase auth for MySurf/MyWorkouts cloud mode, Clerk for MyHomes |
| Password reset flow | Local auth needs a recovery mechanism (security questions or recovery key) |
| Auth context provider | React context wrapping the auth state for use across all screens |

## Files Changed

```
packages/auth/src/password-validation.ts        (new)
packages/auth/src/local-auth.ts                  (new)
packages/auth/src/types.ts                       (new)
packages/auth/src/index.ts                       (rewritten)
packages/auth/src/__tests__/password-validation.test.ts (new)
packages/auth/package.json                       (updated)
packages/auth/tsconfig.json                      (new)
packages/ui/src/components/PasswordStrengthMeter.tsx    (new)
packages/ui/src/components/PasswordInput.tsx            (new)
packages/ui/src/components/PassphraseRecommendation.tsx (new)
packages/ui/src/components/AuthForm.tsx                 (new)
packages/ui/src/components/ModuleAuthPicker.tsx         (new)
packages/ui/src/components/OnboardingPage.tsx           (new)
packages/ui/src/components/OnboardingFlow.tsx           (new)
packages/ui/src/index.ts                               (updated)
packages/ui/package.json                               (updated)
apps/mobile/app/(auth)/sign-up.tsx                     (new)
apps/mobile/app/(auth)/sign-in.tsx                     (new)
apps/mobile/app/(hub)/onboarding-privacy.tsx           (new)
apps/mobile/app/(hub)/_layout.tsx                      (updated)
apps/mobile/app/_layout.tsx                            (updated)
apps/mobile/package.json                               (updated)
apps/web/components/AuthForm.tsx                       (new)
apps/web/app/auth/sign-up/page.tsx                     (new)
apps/web/app/auth/sign-in/page.tsx                     (new)
apps/web/app/onboarding/privacy/page.tsx               (new)
apps/web/package.json                                  (updated)
pnpm-lock.yaml                                        (updated)
```

## Team

- **auth-architect** (module-dev agent) -- Built `@mylife/auth` package (Task #1)
- **ui-researcher** (Explore agent) -- Researched marketing copy, theme tokens, existing patterns
- **ui-builder** (hub-shell-dev agent) -- Built password UI components (Task #2) and onboarding flow (Task #3)
- **team-lead** (coordinator) -- Fixed TS errors, created AuthForm + ModuleAuthPicker, wired hub auth routes (Task #4)
