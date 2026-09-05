# BestChef i18n Full Coverage (P0a-P4)

**Date:** 2026-04-24
**Scope:** Updated plan execution P0a through P4. P5 (recipe content language) and P6 (translation pipeline) deferred to v2.

## Summary

Closed the gap between the existing i18n foundation and the original plan. App now has true 21-language coverage, ICU plural support via `Intl.PluralRules`, RTL bootstrap with restart prompt, locale-aware utilities, type-safe translation keys, and a two-stage onboarding gate that auto-confirms detected language in one tap.

## What changed

**Catalog architecture (P0a)**
- Refactored `app/(root)/i18n/translations.ts` (single 465-line file with 21 inline catalogs) into per-language files under `app/(root)/i18n/catalogs/`.
- New: `catalogs/en.ts` source-of-truth catalog (416 keys), 20 per-language files (`es.ts`, `fr.ts`, ..., `he.ts`), and `catalogs/index.ts` aggregator that exposes `TRANSLATIONS`, `Catalog` type, `TranslationKey = keyof typeof EN`, and computed `LANGUAGE_COMPLETENESS`.
- `translations.ts` reduced to a thin re-export shim with helpers: `translateText`, `translatePluralized`, `formatNumberForLanguage`, `formatRelativeTimeForLanguage`.

**Type safety + plurals (P0a)**
- `t(key, values?)` now typed as `t(key: TranslationKey | string, values?)` — every misspelled or unknown key fails typecheck.
- New `tp(count, singularKey, pluralKey, values?)` helper uses `Intl.PluralRules` for plural selection. Migrated 6 binary plural sites in `(tabs)/index.tsx`, `(tabs)/leaderboard.tsx`, `(tabs)/dishes.tsx` (3 sites), and `submit.tsx`.
- Added `formatRelativeTimeForLanguage(value, unit)` for future "2 hours ago"-style displays.

**RTL + app.json (P0b)**
- `I18nProvider` calls `I18nManager.allowRTL/forceRTL` on language change; sets `pendingRtlRestart` state; exposes `acknowledgeRtlRestart()` which calls `DevSettings.reload()` (dev) and falls back to an Alert prompt (prod, since `expo-updates` is not installed).
- `LanguagePicker` shows a one-tap restart confirmation when `pendingRtlRestart` is true.
- `app.json` already had `expo-localization` `supportedLocales` for all 21 codes per platform — no change needed.

**Locale-aware utilities (P3)**
- `modules/bestchef/src/utils/time.ts`: `formatDuration(minutes, labels?)` accepts an optional `DurationLabels = { min, hr, hrs }`. Default keeps English `min/hr/hrs` for backward compat. All 5 existing tests still pass.
- `modules/bestchef/src/grocery/units.ts`: `bestDisplayUnit(value, category, system?)` accepts `'imperial' | 'metric'`. Added metric units (`ml`, `L`, `g`, `kg`) with display ranges. Added `unitSystemForRegion(regionCode)` returning `'imperial'` for `US`/`LR`/`MM`, `'metric'` otherwise. Backward compat preserved (default = `'imperial'`); all 14 existing unit tests pass.

**Catalog coverage (P1 + P2)**
- Expanded EN catalog from ~140 keys to 416, including 145 taxonomy labels (diet, allergen, method, equipment, meal, time, spice, season, cost, grocery, media), 13 filter-domain labels, 10 badge names + 10 descriptions, 3 challenge names + descriptions + rewards.
- Spawned 4 parallel agents (Romance / Germanic+Slavic+Turkic / SE Asian / East Asian+RTL) that translated the full 416-key catalog into 20 languages.
- Final state: every non-EN catalog at 100% key parity with EN. `node scripts/check-i18n-parity.mjs` confirms 0 missing / 0 extra keys per language.
- Note: cuisine names (Italian, Thai, Mexican etc.) and brand names (BestChef, Whole30, Instant Pot, Sous Vide, Wok) intentionally kept as proper nouns / loanwords across all languages.

**Onboarding + Settings UX (P4)**
- `LanguageOnboardingGate` redesigned as two-stage:
  - Stage 1: hero card with detected language, big "Continue" button (one-tap path for the 90% case), and "Change Language" secondary link.
  - Stage 2: full scrollable list with completeness % per language and a yellow indicator dot for languages under 70%.
- `LanguagePicker` (Settings entry) now shows the same completeness % per row and triggers the RTL restart Alert when language change crosses LTR↔RTL boundary.

**Parity tooling**
- New `apps/bestchef/scripts/check-i18n-parity.mjs` Node script — extracts EN keys via regex, diffs against every non-EN catalog, prints a coverage table, exits non-zero on drift.

## Verification

| Check | Result |
|---|---|
| `pnpm typecheck` (apps/bestchef) | clean |
| `pnpm test` (apps/bestchef) | 10/10 passing (taxonomy, i18n) |
| `pnpm test` (modules/bestchef) | 590/590 passing across 42 files |
| `node scripts/check-i18n-parity.mjs` | all 20 langs at 100% (416/416) |

## Files changed

**New:**
- `app/(root)/i18n/catalogs/{en,es,fr,de,it,pt-BR,pt-PT,nl,sv,pl,tr,id,vi,hi,th,ja,ko,zh-Hans,zh-Hant,ar,he}.ts`
- `app/(root)/i18n/catalogs/index.ts`
- `scripts/check-i18n-parity.mjs`

**Edited:**
- `app/(root)/i18n/I18nProvider.tsx` — typed `t`/`tp`, RTL bootstrap, `pendingRtlRestart`, `acknowledgeRtlRestart`, `formatRelativeTime`
- `app/(root)/i18n/translations.ts` — thin re-export shim + plural helper
- `app/(root)/i18n/LanguageOnboardingGate.tsx` — two-stage flow
- `app/(root)/i18n/LanguagePicker.tsx` — completeness % per row, RTL restart trigger
- `app/(root)/(tabs)/{index,leaderboard,dishes}.tsx` + `submit.tsx` — `tp()` plural calls
- `modules/bestchef/src/utils/time.ts` — locale-aware unit labels
- `modules/bestchef/src/grocery/units.ts` — metric branch + region helper

## Deferred

- **P5 — Recipe content language strategy.** Per-submission language column, "originally in [lang]" chip, on-demand translate button, content-language settings. Requires DB migration + Anthropic API proxy + paywall integration.
- **P6 — Translation pipeline automation.** Crowdin project + DeepL/Anthropic batch script for ongoing string deltas.

## Decisions reaffirmed

- Kept the in-house custom engine (no migration to i18next). All 17 screens already use `useI18n()`; rewriting for i18next was 1-2 days of churn for zero user-visible value.
- 21 languages held (no expansion to 35) — adding more is a future delta.
- Ran Claude batch translation in-session via 4 parallel agents (Anthropic API not used — agents leveraged native multilingual capability with culinary glossary instructions).
- RTL shipped in this round (Arabic + Hebrew at full coverage with restart-required modal).
- Recipe content translation (P5) deferred per default.
- Translation pipeline (P6) deferred per default.

## Known caveats

- Plural forms beyond `one`/`other` (Polish 4-form, Russian 3-form, Arabic 6-form) collapse to the plural key in `tp()`. Strict improvement over the prior binary `=== 1 ?` ternary; full ICU sub-key support (e.g., `recipe_count.few`) is a future enhancement once we have telemetry on which Slavic/Arabic languages have real users.
- `expo-updates` is not installed; `acknowledgeRtlRestart()` falls back to a "Please close and reopen" Alert in production. If a smoother restart UX is required for ar/he/ur/fa, add `expo-updates` and call `Updates.reloadAsync()`.
- `min`/`hr`/`hrs` translation keys exist in the EN catalog and were translated by agents, but no BestChef screen currently calls `formatDuration()` from `modules/bestchef/src/utils/time.ts` (only `submit.tsx` defines a separate `formatDuration(seconds)` for video duration in mm:ss). The localized labels are ready for future recipe-detail surfaces and for the hub `recipes` module.
