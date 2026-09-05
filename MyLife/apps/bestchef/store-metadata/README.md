# BestChef App Store metadata (plan 45 item 1.4, audit M13)

Per-locale App Store Connect (ASC) listing content for BestChef's 21 launch
locales, lives in-repo so translations flow through normal review instead of
being typed once into the ASC web console and never touched again.

## Mechanism: EAS Metadata, not fastlane

This repo is EAS-native (`eas.json` already has a `submit.production.ios`
profile with `ascAppId`) and `eas-cli` 18.8.1 ships `metadata:lint` /
`metadata:pull` / `metadata:push` (the "EAS Metadata" feature, currently
beta). There is no `fastlane/` directory anywhere in the repo. Given that,
EAS Metadata is the right mechanism:

- No new tool or Ruby/Bundler toolchain to install.
- Reuses the `submit.production` profile that already exists for `eas submit`.
- `eas metadata:push` reads `apps/bestchef/store.config.json` by default
  (the `submit.<profile>.metadataPath` field in `eas.json` overrides the
  path; we did not need to touch `eas.json` since the default path matches
  where the file lives).
- `eas metadata:lint` validates the config against ASC's actual schema
  without needing ASC API credentials, so the value gate below can run in
  CI with zero secrets.

Fastlane's `deliver` metadata-folder convention (`fastlane/metadata/<locale>/
name.txt`, etc.) was the documented alternative but was not chosen: it would
add a second submission toolchain alongside `eas submit`/`eas build`, and
this project has never used fastlane.

## Structure

```
apps/bestchef/
  store-metadata/
    en.json          # source of truth, one file per app locale
    es.json
    fr.json
    ...
    README.md         # this file
  scripts/
    generate-store-config.mjs   # store-metadata/*.json -> store.config.json
    check-store-metadata.mjs    # the gate: structure, char limits, staleness
  store.config.json    # generated; what `eas metadata:push` actually reads
```

`store-metadata/<appLocale>.json` uses the app's own i18n locale codes
(`en`, `es`, `pt-BR`, `zh-Hans`, ...) so the file set lines up 1:1 with
`apps/bestchef/app/(root)/i18n/catalogs/` and stays flat and diffable for
translators. Each file has 6 fields:

| Field | ASC limit |
|---|---|
| `name` | 30 chars (must be exactly `"BestChef"` in every locale) |
| `subtitle` | 30 chars |
| `description` | 4000 chars |
| `keywords` | 100 chars (comma-separated string here; converted to an array for ASC) |
| `promotionalText` | 170 chars |
| `releaseNotes` | 4000 chars |

`scripts/generate-store-config.mjs` reads all 21 files, maps each app
locale to its ASC locale code (table below), reshapes field names to the
EAS Metadata `AppleInfo` contract (`title` not `name`, `promoText` not
`promotionalText`, `keywords` as a string array), adds the shared
`privacyPolicyUrl`, and writes `store.config.json`. Run it after editing any
`store-metadata/*.json` file:

```bash
node apps/bestchef/scripts/generate-store-config.mjs
```

`scripts/check-store-metadata.mjs` is the gate (wired into root
`pnpm check:store-metadata`, which runs inside `pnpm check:parity`). It
checks:

1. All 21 expected locale files exist, no extras.
2. Every file has all 6 fields, non-empty.
3. Every field is within its ASC character limit.
4. No placeholder text (`TODO`, `TBD`, `FIXME`, `lorem ipsum`,
   `[bracketed tokens]`, etc. - case-sensitive on the all-caps tokens so
   the legitimate Spanish/Portuguese/Italian word "todo/toda" is never a
   false positive).
5. `store.config.json` is not stale relative to the per-locale source
   files (regenerates in memory and diffs), so the file EAS actually
   reads can never silently drift from the reviewed source.

## Locale mapping: app locale -> ASC locale

Taken from `eas-cli`'s own language table
(`submit/ios/utils/language.js`, itself derived from fastlane's
`languageMapping.json`), which is the authoritative list `eas
metadata:push` validates against. All 21 of BestChef's app locales map
directly to an ASC-supported language; none needed folding to a nearby
locale.

| App locale | ASC locale | Notes |
|---|---|---|
| `en` | `en-US` | |
| `es` | `es-ES` | ASC also offers `es-MX`; `es-ES` used as the single Spanish-language listing (matches the app's one `es` catalog, not split by region) |
| `fr` | `fr-FR` | |
| `de` | `de-DE` | |
| `it` | `it` | ASC has no regional Italian variant |
| `pt-BR` | `pt-BR` | |
| `pt-PT` | `pt-PT` | |
| `nl` | `nl-NL` | |
| `sv` | `sv` | |
| `pl` | `pl` | |
| `tr` | `tr` | |
| `id` | `id` | |
| `vi` | `vi` | |
| `hi` | `hi` | |
| `th` | `th` | |
| `ja` | `ja` | |
| `ko` | `ko` | |
| `zh-Hans` | `zh-Hans` | ASC's internal API locale is `cmn-Hans`; the public/itc code `zh-Hans` is what `eas metadata:push` and the ASC web UI both use |
| `zh-Hant` | `zh-Hant` | same note as zh-Hans (`cmn-Hant` internally) |
| `ar` | `ar-SA` | |
| `he` | `he` | |

`ASC_LOCALE_MAP` in `generate-store-config.mjs` is the single source of
truth for this table; the check script imports it rather than duplicating
it.

## Translation quality

All 20 non-English locales are machine-translated (natural, market-adapted
phrasing, not literal word-for-word), grounded in the real English source
copy and the app's actual shipped feature set (browse dishes, vote on
recipes, submit recipes, chef profiles, challenges, and the private kitchen:
saved recipes, grocery lists, pantry tracking, receipt/photo import,
expiration reminders, cook mode). No translation claims a feature the app
does not have (no payments, no creator earnings, no Android, no cross-app
tracking).

**This set is pending F5 professional review.** Before public launch, have a
native-speaker reviewer (or professional localization vendor) pass over all
20 files, with particular attention to:

- Arabic (`ar`) and Hebrew (`he`): RTL rendering of the bullet list in
  `description` inside ASC's preview.
- `pt-BR` vs `pt-PT`: regional word choices (nota fiscal vs. talão, cardápio
  vs. ementa) should be reconfirmed against current market usage.
- Keyword fields in every locale: translators optimizing for real search
  volume in that market may want to swap terms within the 100-char budget.

## F6 founder runbook

Everything above is done once, in-repo, and covered by the value gate. What
remains is founder-only ASC-side setup (item F6). This is the exact
sequence:

### 1. ASC API key (one-time, per Apple Developer account)

`eas metadata:push` needs an App Store Connect API key with the
**App Manager** or **Admin** role (metadata write access):

1. In App Store Connect: Users and Access -> Integrations -> App Store
   Connect API -> Team Keys -> Generate API Key. Name it something like
   "EAS Metadata / Submit". Note the Key ID and Issuer ID, and download
   the `.p8` private key file (Apple only lets you download it once).
2. Either let `eas metadata:push` prompt interactively for the key on
   first run (it will ask for the Key ID / Issuer ID / `.p8` path and
   store it via `eas credentials`), or configure it non-interactively
   with the standard EAS env vars before running:
   ```bash
   export EXPO_ASC_API_KEY_PATH=/path/to/AuthKey_XXXXXXXXXX.p8
   export EXPO_ASC_KEY_ID=XXXXXXXXXX
   export EXPO_ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ```
   These are the same credentials already needed for `eas submit` against
   the `production` profile's `ascAppId` (`6763167108`), so if EAS
   submission was already set up, this may already be configured.

### 2. Push the metadata

Before pushing, regenerate `store.config.json` from source and run the
gate one more time:

```bash
node apps/bestchef/scripts/generate-store-config.mjs
node apps/bestchef/scripts/check-store-metadata.mjs
```

Then, from `apps/bestchef/`:

```bash
npx eas metadata:lint --profile production   # validates against ASC schema, no credentials needed
npx eas metadata:push --profile production   # actually writes to ASC (needs the API key from step 1)
```

`metadata:push` updates the localized listing fields (name, subtitle,
description, keywords, promotional text, release notes, privacy policy
URL) for the next editable app version in ASC. It does not submit a build
for review by itself; that is still `eas submit` (already configured).

**Blocker to close before the push will actually pass Apple human review:**
`privacyPolicyUrl` is set to `https://bestchef.app/privacy` in every
locale (the real, product-defined URL the app's own onboarding gate and
settings screen already point at, per `apps/bestchef/legal/README.md`).
That page is not hosted yet (tracked separately as legal-corpus item
P0-08 / founder item F2). `eas metadata:push` will succeed at the API
level regardless, but Apple reviewers do check that privacy policy links
resolve, so F2 (hosting `apps/bestchef/legal/*.md`) must land before this
push is submitted for review, not just before it is technically run.

### 3. ASC-side items this pipeline does not cover

EAS Metadata's `AppleInfo` contract is per-locale listing copy only. These
are account-level or one-time ASC settings, set once in the web console
(or via `eas metadata` app-level fields, which are not localized and were
left out of `store.config.json` deliberately, alongside categories/
age-rating, since those are singular founder decisions, not per-locale
content):

**Age rating questionnaire.** Recommend **12+**. Justification, grounded
in the app's actual shipped moderation posture:
- BestChef has open user-generated content: dish submissions, recipe
  submissions, vote-proof photos, comments, and chef profiles
  (`apps/bestchef/legal/guidelines.md`, `ReportMenu`/`bc_flags` moderation
  pipeline documented in `apps/bestchef/CLAUDE.md`).
- Apple's own guidance places "Infrequent/Mild" user-generated content
  with active moderation (report/flag flow, moderation queue, blocks) at
  12+, not 17+, which is reserved for unmoderated or frequent/intense UGC
  (dating, unmoderated chat, gambling, mature/graphic content). BestChef's
  UGC is food photos/recipes/comments with an active report-and-moderate
  pipeline and per-country minimum-age enforcement at onboarding
  (`apps/bestchef/legal/privacy.md`: 16 in Germany, per-country elsewhere).
- No gambling, no unmoderated chat, no mature content categories apply.
- Answer "Yes, infrequent/mild" for User-Generated Content; "No" for
  every other content category (violence, sexual content, horror,
  gambling, alcohol/tobacco/drugs, mature/suggestive themes).

**Privacy labels (App Privacy section in ASC).** Must match
`apps/bestchef/docs/att-privacy-manifest-audit-2026-07-11.md`, which
audited `app.json`'s `ios.privacyManifests` and found the claims accurate:
- **Data Used to Track You:** None. (`NSPrivacyTracking: false`, no ATT
  prompt, no advertising/analytics SDKs in dependencies.)
- **Data Linked to You:** Email Address, Photos or Videos, Other User
  Content, Coarse Location, User ID - each for App Functionality only
  (account identity, dish/recipe submissions, chef profile, city
  auto-detect), matching the `NSPrivacyCollectedDataTypes` entries in
  `app.json`.
- **Data Not Linked to You:** none declared beyond the above; do not add
  categories not present in `app.json`'s privacy manifest.
- **Data Used to Track You:** answer "No" across the board; this app does
  not track per the audit's verdict.

If the ASC privacy-label questionnaire and `app.json`'s
`NSPrivacyCollectedDataTypes` ever diverge, that is a real bug: fix
whichever one is wrong and update the audit doc in the same PR.

### F6 checklist

- [ ] ASC API key generated and available to `eas metadata:push`
      (interactive prompt or `EXPO_ASC_*` env vars)
- [ ] `apps/bestchef/legal/*.md` hosted and `https://bestchef.app/privacy`
      returns 200 (F2, tracked separately)
- [ ] `node apps/bestchef/scripts/generate-store-config.mjs` run, `git
      diff` on `store.config.json` reviewed
- [ ] `npx eas metadata:lint --profile production` green
- [ ] `npx eas metadata:push --profile production` run
- [ ] Age rating questionnaire completed in ASC web console: 12+,
      Infrequent/Mild User-Generated Content = Yes, all else = No
- [ ] App Privacy labels completed in ASC web console per the table above
- [ ] Categories and screenshots/previews set in ASC (not covered by this
      pipeline; `AppleInfo.screenshots`/`previews` support exists in EAS
      Metadata if screenshot automation is wanted later)
