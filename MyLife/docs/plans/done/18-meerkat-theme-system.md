# Feature Spec: Meerkat Theme System (multi-preset + custom editor)

> Plan 18 of the Meerkat launch set. Full-function, no-deferral. The green "Open
> Burrow" look becomes one preset of many, plus a real custom theme editor and a
> portable share/import path, at full parity on mobile (`apps/meerkat`) and web
> (`apps/meerkat-web`).

## Metadata

- **Surface(s):** `apps/meerkat` (Expo Router), `apps/meerkat-web` (Vite React SPA), new shared package `packages/meerkat-theme` (`@mylife/meerkat-theme`, react-native-free).
- **Engine touch:** `@mylife/sync` only for the OPTIONAL signed-author attribution on exported themes (reuses existing Ed25519 signing; no new crypto). The base theme system needs no crypto.
- **Priority:** Launch-committed (review doc row: `Themes` "placeholder" -> must reach "real"). Complexity: **Large (2)** — dual-surface, real WCAG computation, custom editor, portable codec. Requires `/plan-eng-review` before build and `/plan-design-review` on the UI sections.
- **Estimated CC time:** 3.5-4.5 days (Phase 0-7 below).
- **Depends on:** none (pure UI/persistence layer; no dependency on social, DMs, billing, or connectivity). Reads only the already-shipped `mk_settings` key/value store and the live `AppThemeProvider` / web `ThemeProvider`.
- **Blocks:** **Launch readiness plan** (app-store screenshots, visual QA, and the "feels native beside Instagram/X/Reddit/TikTok/Discord/Telegram/Signal/WhatsApp" bar all assume the theme system has landed). Soft-blocks the **public social layer** and **connectivity/self-hosting** plans only in that they add new screens/settings rows that must consume `useAppThemeColors()` / the `--mk-*` vars rather than hardcoded colors.
- **Build order:** Can start immediately and run in parallel with social/DM/billing work because it owns its own files (`theme/*`, `packages/meerkat-theme`, the two Appearance surfaces). Merge BEFORE the launch-readiness plan. This plan and the connectivity plan touch the same settings *area* but different *files* (this plan owns Appearance; connectivity owns Transport), so coordinate by file ownership, not a shared edit (file-ownership note in the risks section).

---

## Business Context

### Why this feature exists

Meerkat ships exactly one palette today ("Open Burrow", `apps/meerkat/app/(root)/theme/tokens.ts:1-119`). A single hardcoded green look is a launch liability against the comparison set the review names (Instagram, X, Reddit, TikTok, Discord, Telegram, Signal, WhatsApp). Theming is table stakes for that cohort, and for a privacy-first, decentralized product it is also a values statement: the user owns their look the same way they own their keys and their data. A portable, copyable theme blob (no server, no account) is the decentralized analog of Telegram's shareable theme links and fits Meerkat's "controlled by you" ethos.

### Competitor landscape — which competitor's users this wins

| Competitor | Has theming? | Behind paywall? | Their implementation | What Meerkat takes |
|-----------|-------------|-----------------|----------------------|--------------------|
| **Telegram** | Yes | No | In-app theme editor; **shareable theme links** (`t.me/addtheme/...`); accent + background + message colors; light/dark | The direct analog. Meerkat's portable blob = Telegram's theme link, but **serverless** (copy/paste, QR, deep-link) — a decentralized win over a centralized link. |
| **Discord** | Yes | **Yes (Nitro)** | Limited preset themes + accent color gated behind Nitro ($9.99/mo); full theming only via unofficial client mods (BetterDiscord) | Meerkat ships a **full custom editor free** with the $4.99 one-time app — undercuts Nitro's theme gate. |
| **Reddit** | Partial | No | Old-reddit subreddit CSS (community-themed), app has only light/dark/auto | Meerkat gives the *user* control, not just the community. |
| **X / Signal / WhatsApp** | Minimal | No | Accent color (X), light/dark + chat wallpaper only (Signal/WhatsApp); no full palette control; weak high-contrast options | Meerkat's **WCAG-AA + dedicated High-Contrast preset** wins accessibility-driven users these apps underserve. |
| **Instagram / TikTok** | No (light/dark only) | n/a | OS-following light/dark | Meerkat looks *intentional* next to them. |

**Primary win:** Telegram power users who love shareable themes, plus Discord users who resent the Nitro theme gate, plus accessibility-first users (high-contrast / large-weight register) that Signal and WhatsApp leave behind.

### Target user

"A Telegram or Discord user who curates their look and shares it, who is switching to a private/decentralized app and does not want to lose self-expression or pay a subscription for an accent color. Also: a low-vision user who needs a real AA/AAA high-contrast option, not a vague 'dark mode'."

---

## Technical Context

### Current state (grounded, file:line)

**Exists today (net-new work extends, never replaces):**

- Mobile palette: `apps/meerkat/app/(root)/theme/tokens.ts` — `interface MkColors` (22 tokens, `tokens.ts:19-42`), `LIGHT`/`DARK` constants (`tokens.ts:44-111`), `MK_PALETTES = { light, dark }` (`tokens.ts:113`), active `MK_COLORS = MK_PALETTES.light` (`tokens.ts:119`), `MK_MONO`/`MK_SPACING`/`MK_RADIUS` (`tokens.ts:123-143`), `scopeColor`/`scopeLabel` (`tokens.ts:146-170`).
- Mobile provider: `apps/meerkat/app/(root)/providers/AppThemeProvider.tsx` — derives `mode` from `useColorScheme()` ONLY (`AppThemeProvider.tsx:39-40`); no persisted preference, no preset selection, no custom themes. Exposes `useAppThemeColors()` (`:21-23`), `useAppThemeMode()` (`:25-27`), `useMkStyles(factory)` (`:33-36`). Mounted ABOVE `DatabaseProvider` in the tree (`AppThemeProvider` wraps `DatabaseProvider`, `app/(root)/_layout.tsx:31-32`).
- Web palette: `apps/meerkat-web/src/ui/theme/palette.ts` — `MkColors` + `LIGHT`/`DARK`/`MK_PALETTES` ported verbatim with App-Isolation citation (`palette.ts:1-86`).
- Web CSS vars: `apps/meerkat-web/src/ui/theme/tokens.css` — `:root`/`[data-theme='light']` light block, `@media (prefers-color-scheme: dark)` + `[data-theme='dark']` dark block; also `--mk-radius-*`, `--mk-space-*`, `--mk-rail-width`, `--mk-sidebar-width` (`tokens.css:8-101`).
- Web provider: `apps/meerkat-web/src/ui/theme/ThemeProvider.tsx` — already has `ThemeMode = 'system'|'light'|'dark'`, persists to `localStorage` `mk-theme` (`ThemeProvider.tsx:16-18`), sets `documentElement.dataset.theme` (`:70-73`), exposes `useTheme()` (`:93-95`). **System/Light/Dark already real on web.**
- Web Appearance UI: `apps/meerkat-web/src/ui/settings/AppearanceSection.tsx` — System/Light/Dark button group only (`AppearanceSection.tsx:9-38`).
- Persistence substrate (both surfaces): `mk_settings (key TEXT PRIMARY KEY, value TEXT)` — mobile DDL `apps/meerkat/app/(root)/data/db.ts:36-40`, helpers `getSetting`/`setSetting`/`deleteSetting` at `db.ts:64-81`; web twin `apps/meerkat-web/src/lib/meerkat-data.ts:120-131` and `src/lib/schema.ts:33`. `mk_` tables are **deliberately outside the sync prefix map and never replicate** (`apps/meerkat/CLAUDE.md` "Table prefixes"; `db.ts:87` and `:107` "outside the sync prefix map").
- Hub Theme Profiles system (the reuse candidate): `@mylife/ui` exports `THEME_PRESETS`, `DEFAULT_THEME`, `ThemeProvider`, `ThemeProfileSchema`, `validateTheme`, `mergeTheme`, `themeToCSS`, `pickToken`, `resolveFont`, and 12 presets (`packages/ui/src/index.ts:22-81`). Schema at `packages/ui/src/themes/schema.ts:25-172`, utils at `packages/ui/src/themes/utils.ts`, presets at `packages/ui/src/themes/presets/*`.

**Net-new (this plan builds):** a preset library spanning registers, a full custom editor (CRUD + live preview), a portable export/import codec, persisted per-device selection + System/Light/Dark composing with any preset, and the Appearance screens on BOTH surfaces. **Mobile currently has NO manual theme control at all** — `AppThemeProvider` derives `mode` from `useColorScheme()` only, with no persisted preference, preset selection, or custom themes (`AppThemeProvider.tsx:39-40`; corroborated by `docs/reports/meerkat-production-review.html:816,825`). That is the biggest single gap this closes.

### Adopt `@mylife/ui` Theme Profiles vs port the schema — decision

**Decision: PORT the pattern into a new react-native-free package `@mylife/meerkat-theme`; do NOT adopt `@mylife/ui`'s `ThemeProfile` type directly.** Justification, from the real source:

1. **Token mismatch (lossy).** `@mylife/ui` `BaseColorsSchema` (`schema.ts:25-39`) lacks Meerkat's `surfaceHigh`, `accentDim`, `onAccent`, `info`, `dangerSoft/warningSoft/successSoft/infoSoft`, and `borderStrong` — 9 of Meerkat's 22 color tokens have no home in `BaseColorsSchema`; `glass`/`glassBorder` only map awkwardly onto a separate, differently-named/shaped `GlassSchema` (`cardFill/cardBorder/strongFill/strongBorder`). Adopting it would force every Meerkat screen (which reads those tokens via `useMkStyles`) onto a lossy mapping. Conversely `ThemeProfile` carries hub-only fields meaningless in Meerkat (`layout.dashboardStyle`, `moduleGridColumns`, `tabBarStyle: floating-pill|...`, `headerStyle: wordmark|logo|...`, `schema.ts:89-119`).
2. **Web cannot import it cleanly.** `apps/meerkat-web/package.json` does **not** depend on `@mylife/ui` (deps: `@mylife/db`, `@mylife/sync`, `react`, `react-dom`, `sql.js`). `@mylife/ui` components (`Card`, `Button`, the `ThemeProvider` barrel) pull `react-native`; adding it to a Vite SPA risks dragging RN into the web bundle. The mobile app deliberately "does NOT register in `@mylife/ui` tokens" (`tokens.ts:9-11`) precisely to keep this boundary.
3. **The valuable part ports cleanly.** What we actually want from `@mylife/ui` is the *shape of the system*, not the type: a Zod profile schema, a preset registry, `validateTheme`/`mergeTheme`/`resolveFont` utilities, and CSS-var emission (`themeToCSS`). We replicate that pattern over Meerkat's own `MkColors` superset. `@mylife/ui` has **no AI generator** (confirmed: no `generate*` symbol in `packages/ui/src/themes`), so there is nothing to adopt there — we build a real local generator instead (see Protocol section, "Generator").
4. **App-Isolation precedent.** The codebase already shares pure logic across both surfaces via RN-free modules duplicated with citation (`palette.ts`, `format.ts`, feed-status). A single shared **RN-free package** is the cleaner version of that pattern: one source of truth, no verbatim duplication drift, and the parity checker (`scripts/check-meerkat-parity.mjs`) can assert both apps import it. The package contains only pure TS (schema, presets, utils, codec, contrast math) — no React, no react-native — so both the Expo app and the Vite app import it safely.

`@mylife/meerkat-theme` becomes the single source of truth for the schema, presets, codec, and WCAG math. Each app keeps only its thin, platform-specific provider (RN context on mobile, CSS-var application on web).

### Where this lives

```
packages/meerkat-theme/                 -- NEW @mylife/meerkat-theme (pure TS, RN-free)
  src/
    schema.ts                           -- MkThemeProfile Zod schema (superset of MkColors + shape + density + type-weight)
    presets/                            -- 6 preset families, each light+dark, AA-verified
      open-burrow.ts calm.ts social.ts playful.ts serious.ts high-contrast.ts index.ts
    derive.ts                           -- auto-derive secondary tokens (accentDim, soft fills, onAccent, borders, glass) from primaries
    contrast.ts                         -- WCAG relative-luminance + contrastRatio + ratesAA/ratesAAA (REAL math)
    generate.ts                         -- local deterministic palette generator from a seed color (no network, no "AI" claim)
    codec.ts                            -- portable blob encode/decode (base64url JSON + checksum + version), strict validate-on-import
    qr.ts                               -- pure-TS QR matrix encoder (blob string -> boolean[][]); apps render the matrix (mobile react-native-svg, web inline SVG). No network.
    resolve.ts                          -- resolveProfile(profile, mode) -> MkColors; applyMode; mirrorMode (derive opposite mode)
    index.ts
    __tests__/                          -- contrast, derive, codec, qr, generate, preset-AA suites (Node, no RN/DOM)

apps/meerkat/app/(root)/theme/
  tokens.ts                             -- EXTENDED: MkColors stays the canonical token type; re-export shared types
  theme-store.ts                        -- NEW: mk_themes CRUD + active-id/mode in mk_settings + boot mirror (JSON file + the synchronously-readable mk_settings/mk_themes row)
apps/meerkat/app/(root)/providers/
  AppThemeProvider.tsx                  -- EXTENDED: preset+custom+mode, exposes useThemeLibrary(); reads the active theme synchronously at mount (expo-sqlite getFirstSync) so the first frame is correct
apps/meerkat/app/(root)/(tabs)/
  appearance.tsx                        -- NEW hidden route: preset gallery + mode toggle + entry to editor/import + QR scan (expo-camera)
  theme-editor.tsx                      -- NEW hidden route: full custom editor (live preview)
  me.tsx                                -- EXTENDED: add "Appearance" row -> router.push('/appearance')

apps/meerkat-web/src/ui/theme/
  ThemeProvider.tsx                     -- EXTENDED: active preset/custom + mode; applies resolved profile as --mk-* vars at runtime
  theme-store.ts                        -- NEW: mk_themes CRUD via DatabaseAdapter + active-id/mode (mk_settings) + localStorage fast-read
apps/meerkat-web/src/ui/settings/
  AppearanceSection.tsx                 -- EXTENDED: preset gallery + mode toggle + open editor + import
  ThemeEditorOverlay.tsx                -- NEW: full custom editor overlay (web twin of theme-editor.tsx)
apps/meerkat-web/src/lib/
  schema.ts / meerkat-data.ts           -- EXTENDED: add mk_themes DDL + CRUD twins (CRUD/SQL-surface parity with mobile theme-store; platform glue differs)
```

### Dependencies

- **Internal:** `@mylife/db` `DatabaseAdapter` (already used by both apps) for `mk_themes` + `mk_settings`. `@mylife/sync` ONLY for the optional signed-author field on export (existing Ed25519 sign/verify; no new primitive). Mobile keeps `@mylife/ui` dep as-is (unused for theming).
- **External:** one new mobile dep for QR *scanning* — `expo-camera` (or `expo-barcode-scanner`), lazy-loaded so Expo Go / a missing module degrades to paste-only, never crashes. QR *generation* needs no dep: it is the bundled pure-TS `qr.ts` matrix encoder rendered with the already-present `react-native-svg` (mobile) / inline SVG (web). No fonts fetched over the network (font choice is an allow-list of system + already-bundled stacks; see security note). No cloud "AI". No analytics. No network for export/import.
- **Cross-surface:** mobile `theme-store.ts` is canonical; the web `theme-store.ts` + `meerkat-data.ts` twins must match the mobile **CRUD/SQL surface** verbatim (table DDL + the `mk_themes`/`theme_*` query strings), asserted by `scripts/check-meerkat-parity.mjs`. The platform glue (filesystem vs localStorage boot mirror, expo-sqlite vs sql.js, async vs sync read) differs by design and is out of the parity assertion.

---

## Data Model / SQLite schema, table prefix, sync policy

### New table `mk_themes` (prefix `mk_`, device_local, NEVER replicates)

```sql
CREATE TABLE IF NOT EXISTS mk_themes (
  id            TEXT PRIMARY KEY,          -- uuid v4 for custom themes; preset ids are reserved and never stored here
  name          TEXT NOT NULL,            -- user-facing label (rename target)
  profile_json  TEXT NOT NULL,            -- full MkThemeProfile JSON; validated with the Zod schema on every read
  base_preset_id TEXT,                    -- provenance: preset this was forked from, or NULL (made from scratch / imported)
  source        TEXT NOT NULL DEFAULT 'custom', -- 'custom' | 'imported' | 'generated'
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
```

### New `mk_settings` keys (existing key/value table, device_local)

- `theme_active_id` — preset id (e.g. `open-burrow`) or a custom uuid. Default `open-burrow`.
- `theme_mode` — `system` | `light` | `dark`. Default `system`. (Web already uses `localStorage` `mk-theme`; migrate that value into this row on first boot, keep `localStorage` mirror for FOUC-free pre-hydration.)

### Boot cache (fast-read, avoids first-frame flash)

- **Mobile (first-frame-correct, no hand-waving):** `AppThemeProvider` mounts ABOVE `DatabaseProvider`, and `expo-file-system/legacy` reads are **async**, so a JSON file alone cannot guarantee a correct first frame. The provider instead reads the active theme **synchronously at mount** via expo-sqlite's synchronous read API (`openDatabaseSync(...).getFirstSync(...)` over `mk_settings.theme_active_id` + the `mk_themes.profile_json` row, read-only, same `meerkat.db` file, no new dep), so the very first frame renders the persisted theme. The JSON mirror `documentDirectory/meerkat/theme-cache.json` (`{ activeId, mode, profile }`, rewritten on every apply/edit) is a redundant denormalized fallback. If the synchronous read is empty/unavailable, the first frame is the honest Open Burrow default resolved by `useColorScheme` — never a wrong-palette flash. The `mk_themes` row remains the durable source of truth.
- **Web:** `localStorage` keys `mk-theme-active`, `mk-theme-mode`, and `mk-theme-profile` (the resolved active profile JSON) for pre-hydration before `sql.js` loads. Same fallback to Open Burrow.

### Sync policy + security note (Critical)

- **`mk_themes` and the `theme_*` settings keys are `device_local` and MUST stay outside the sync prefix map.** They join `auto_update:` / `last_pulled:` as personal, row-only, never-replicated state (`db.ts:83-101` and `:103-123`, both annotated "outside the sync prefix map" at `:87` / `:107`). No `ConflictStrategy`, no `maxScope`, no entity-key registration — theming is not synced state. Copy must therefore say "saved on this device", never "synced to your devices".
- **The portable blob is the only cross-device/cross-user movement, and it is always user-initiated and public.** A theme carries no secrets, no keys, no identity beyond an optional self-asserted author name. If a future plan wants "publish a theme to a community", that is a separate `published_blob`-scoped object built on the EXISTING `createSealedShare`/`buildShareLink` primitives in `@mylife/sync` — out of this plan's default path, and explicitly capped so a theme can never escalate to `shared_workspace` silently. This honors the mesh-sync scope-cap model even though `mk_` tables sit outside the sync map.
- **Untrusted-input boundary (the real security surface).** An imported/pasted theme is untrusted JSON. The import path MUST: (1) strict-Zod-validate against `MkThemeProfileSchema`; (2) enforce a hard size cap (reject > 16 KB decoded); (3) accept ONLY strict color strings (`#rgb`/`#rrggbb`/`#rrggbbaa`/`rgb()`/`rgba()`) and numbers — never arbitrary strings — so a malicious theme cannot inject CSS/JS when web maps tokens to `--mk-*` custom-property *values*; (4) restrict `fonts` to an allow-list of bundled/system stacks (no remote font URLs, no `url()` values); (5) reject and surface a specific error on any failure (never partially apply). A validated theme is safe regardless of signature. **Privacy enforcement and input validation live in `@mylife/meerkat-theme` (below the UI); the editor/import UI is not the security boundary.**

---

## Protocol / Engine notes (`@mylife/sync` + the shared package)

The theme system needs **no cryptography for its core path** — themes are public, non-secret data. Two engine-adjacent pieces:

### Portable theme blob (codec.ts — pure TS, no crypto)

- **Encode:** `encodeThemeBlob(profile) -> string` = `meerkat-theme:v1:` + base64url(JSON.stringify(canonicalized profile)) + `:` + 8-hex CRC32 checksum of the JSON. Deep-link form: `meerkat://theme/import#<blob>` (uses the existing `meerkat` scheme, `app.json:7`). QR form: `qr.ts` (a real, bundled pure-TS QR matrix encoder — `react-native-svg` can only *draw*, it cannot compute a QR matrix) turns the blob string into a boolean matrix that mobile renders with `react-native-svg` (already present) and web renders as inline SVG. No network, no QR-generation dep. Blobs above the QR byte ceiling fall back to copy/deep-link with an honest "too long to QR" note.
- **Decode:** `decodeThemeBlob(str) -> ValidateResult` = parse the version tag, verify checksum (corruption guard, NOT security), base64url-decode, `JSON.parse`, then run the strict schema validation + size cap + color/font allow-list above. Returns `{ success, theme } | { success:false, errors[] }`.
- The checksum is integrity-against-corruption only; it is explicitly NOT a security control. Document that in-source.

### Optional signed author attribution (reuses `@mylife/sync`, no new crypto)

- Export can optionally attach `author: { name, publicKey, signature }` where `signature` is the device's existing Ed25519 signature over the canonical profile bytes, produced by the existing `signMessage` primitive (`@mylife/sync`, `packages/sync/src/index.ts:165` — the same Ed25519 path that backs `createSignedIdentityBundle`). Import verifies it with the existing `verifySignature` primitive (`packages/sync/src/index.ts:166`) and shows "Signed by <name> (verified)" vs "Unsigned theme".
- **Security analysis:** the signature attests *who authored* a theme; it is **not** a trust/safety boundary. The import path validates and sanitizes the theme identically whether or not a valid signature is present — a validated theme is safe; an invalid signature only downgrades the attribution label, it never blocks a safe theme nor admits an unsafe one. We do NOT reimplement signing; we call the existing primitive. No relay, no mailbox, no network is involved in export/import — copy must not imply a theme was "sent" to anyone.

### Local palette generator (generate.ts — deterministic, no network, no "AI" claim)

- `generatePalette(seed: hexColor, mode: 'light'|'dark') -> MkThemeProfile` derives a full, AA-targeting palette from one seed accent using HSL/relative-luminance math: pick `onAccent` by real contrast against the seed; derive surfaces by lightness steps; derive text by contrast against background; derive semantics by hue rotation off a neutral base; run `derive.ts` for the rest; then auto-correct any pair that fails AA by nudging lightness until `contrastRatio >= 4.5` (body) / `>= 3.0` (UI). It is fully local and deterministic. **UI copy says "Generate from a color", never "AI" or anything implying a server.** This satisfies the no-deferral rule (a real generator ships) and the honesty rule (no faked capability).

---

## Functional Requirements

### User stories

1. As a new user, I want to pick from several built-in looks (calm, vibrant, playful, serious, high-contrast, plus the default Open Burrow) so Meerkat feels like mine and looks at home next to the apps I already use.
2. As a returning user, I want my theme and my System/Light/Dark choice to persist on this device across relaunch.
3. As a low-vision user, I want a real high-contrast theme that the app *proves* meets AA, not a vague label.
4. As a tinkerer, I want to build my own theme (accent, surfaces, text, semantics, corner radius, density, heading weight), preview it live, and save/rename/delete it.
5. As a Telegram refugee, I want to export my theme as a portable blob (copy text, QR, or deep link) and import someone else's — with no account and no server.
6. As a careful user, I want assurance that importing a theme can never run code, leak data, or sync my look to other devices without my say.

### Behavior specification (the happy path + branches)

**Pick a preset (both surfaces):**
1. User opens Me -> "Appearance" (mobile, `router.push('/appearance')`) or Settings -> "Appearance" (web overlay).
2. Sees a gallery of preset cards, each a live mini-preview (a tab bar + a card + accent button rendered in that preset's resolved colors for the current mode), the preset name, a register tag ("Calm" / "Vibrant" / ...), and an **"Accessible (AA)"** badge computed by the real `ratesAA` function — never hardcoded.
3. A System / Light / Dark segmented control sits above the gallery; changing it re-resolves every preview and the live app immediately.
4. Tap/click a preset -> it applies instantly app-wide, the card shows a selected check, the choice writes `theme_active_id` + the boot cache. No reload, no flash.

**Build a custom theme (both surfaces):**
1. From Appearance, tap "Create custom theme" (optionally "Fork this preset" from a preset's overflow) -> opens the editor with the chosen base.
2. Editor shows a **live preview pane** (real Meerkat chrome: tab bar, a channel card, an accent button, a HonestNotice row, a semantic notice) that updates on every change.
3. Primary axes (always visible): Accent, Background, Surface, Text, the four semantics (Danger/Warning/Info/Success), Corner radius (sm/md/lg presets or a slider), Density (compact/cozy/comfortable -> spacing multiplier), Heading weight (600/700/800). Secondary tokens (accentDim, surfaceElevated/High, textSecondary/Tertiary, soft fills, borders, glass, onAccent) are auto-derived live by `derive.ts`, with an "Advanced" disclosure exposing and overriding every one of the 22 color tokens.
4. A live **contrast readout** shows the real computed ratio for text-on-background, text-on-surface, and onAccent-on-accent, each with an AA/Below-AA chip from `ratesAA`. A "Generate from a color" button seeds a full palette via `generatePalette` (local).
5. "Mirror to dark/light" derives the opposite-mode variant so the theme works in both modes.
6. Save -> name prompt -> writes an `mk_themes` row (uuid), applies it, returns to Appearance with the new theme selected. Rename / Delete available from the theme's overflow. Deleting the active theme falls back to Open Burrow.

**Export / Import (both surfaces):**
1. Theme overflow -> "Share theme" -> sheet/overlay shows the portable blob string with Copy, a QR, and "Copy deep link"; an "Include signed author name" toggle (off by default).
2. "Import a theme" -> paste field (or "Scan QR" on mobile / camera-less paste on web, plus deep-link `meerkat://theme/import#...` handling). On decode success: a preview + "Add to my themes". On failure: a specific error.

### Edge cases

- **No custom themes yet:** Appearance gallery still shows all presets; the "My themes" sub-section shows the empty state, never a fake row.
- **Active custom theme deleted:** fall back to Open Burrow, persist the fallback, toast "Theme deleted. Using Open Burrow."
- **Corrupt/oversized/invalid imported blob:** reject with the exact failing field(s); never partially apply; never crash.
- **Theme that fails AA:** still saveable (user's choice) but shows an honest "Below AA on body text" warning chip; presets themselves must all pass AA (enforced by a test, below).
- **OS scheme flips while mode = System:** every screen re-resolves live (mobile via `useColorScheme`, web via the `matchMedia` listener already in `ThemeProvider.tsx:57-63`).
- **First frame before DB loads (mobile):** the provider's synchronous expo-sqlite read (`getFirstSync`) supplies the active theme on the first frame; if the read is empty/unavailable, the first frame is Open Burrow resolved by `useColorScheme`. Never a flash to a wrong palette — at worst the honest default.
- **Web pre-hydration (sql.js not ready):** `localStorage` mirror applies the resolved `--mk-*` vars immediately; DB reconciles after load.
- **Single-mode theme (only light defined) applied in dark:** `resolveProfile` falls back to the defined mode and the UI flags "This theme defines Light only" rather than rendering broken dark colors.
- **Theme JSON from a newer schema version:** decode rejects unknown `version` with "Made in a newer version of Meerkat" rather than silently dropping fields.
- **Reset app / clear node (Settings danger zone):** themes are device-local; clearing local data removes `mk_themes` and resets to Open Burrow. Document this in the reset confirmation copy.

---

## UI Specification — both surfaces, all 5 states, exact copy

All UI consumes the resolved Open Burrow tokens for the *current* preset (mobile via `useMkStyles`/`useAppThemeColors`, web via `--mk-*` vars). No new color is hardcoded. Mono stays `MK_MONO` for blob strings/keys only.

### Mobile (Expo) — `appearance.tsx` and `theme-editor.tsx` (hidden routes)

**Appearance screen** — title **"Appearance"**, subtitle **"Choose a look. Saved on this device."** (honesty: device-local, not synced).
- Segmented control: **System** / **Light** / **Dark**, with note **"System follows your device. Light and Dark override it on this device."**
- Section **"Themes"**: 2-column grid of live preset preview cards; each shows the name, a register tag, and a real **"AA"** chip (green when `ratesAA` passes, neutral "Below AA" otherwise). Selected card shows a check.
- Section **"My themes"**: custom rows with overflow (Apply / Rename / Share / Delete); plus a primary button **"Create custom theme"** and a secondary **"Import a theme"**.

**Theme editor screen** — title **"Custom theme"**. Sticky live preview at top; scrollable controls below; sticky footer **"Save theme"** / **"Cancel"**. Contrast readout row uses the real ratio, e.g. **"Body on background: 6.2:1 · AA"** / **"Body on surface: 3.9:1 · Below AA"**.

| State | What the user sees | Trigger |
|-------|--------------------|---------|
| Loading | Preset grid as 6 skeleton cards; "My themes" as one shimmer row. Copy: **"Loading your themes…"** | DB/boot-cache read in flight |
| Empty | All presets render normally; "My themes" shows **"No custom themes yet. Create one or import a friend's."** with the Create/Import buttons | No `mk_themes` rows |
| Error | Inline notice **"Couldn't load your saved themes. Presets still work."** + **"Try again"**; presets remain usable | `mk_themes` read throws |
| Success | Full gallery + custom list; tapping applies instantly | Data loaded |
| Partial | Presets shown immediately; "My themes" still resolving shows a single shimmer row beneath them (never a fake count) | Presets ready, custom list slow |

Import errors (exact copy): malformed -> **"That doesn't look like a Meerkat theme."**; checksum -> **"This theme code looks corrupted. Ask for a fresh copy."**; too large -> **"That theme is too large to import."**; schema -> **"That theme is missing or has invalid colors and can't be used."**; newer version -> **"That theme was made in a newer version of Meerkat."** Honesty footer on the Share sheet: **"This makes a copy you can paste or scan. Nothing is sent or uploaded, and your themes never sync between devices on their own."**

### Web (Vite) — `AppearanceSection.tsx` (extended) + `ThemeEditorOverlay.tsx`

Mirrors mobile within the existing settings overlay. Keeps the current System/Light/Dark group (`AppearanceSection.tsx:9-32`) and adds: the preset gallery (CSS-grid of live `--mk-*`-driven preview cards), the "My themes" list, "Create custom theme" + "Import a theme", and the editor overlay. The note text becomes **"System follows your device appearance. Light and Dark override it on this browser. Themes are saved on this browser and never sync on their own."** All five states use the same copy as mobile. The editor overlay renders a live preview using the same resolved-profile-to-vars path so what you see is exactly the applied result.

State parity table (web): identical to the mobile table above, with "browser" substituted for "device" and overlay/inline equivalents of skeletons.

---

## Acceptance Criteria

### User-facing (AC)
- [ ] **AC-1:** Mobile Me -> Appearance opens a screen with System/Light/Dark and a preset gallery (today mobile has no theme control at all).
- [ ] **AC-2:** Selecting a preset on either surface reskins the entire app instantly with no reload and no flash to a wrong palette.
- [ ] **AC-3:** The chosen preset and the System/Light/Dark mode survive an app relaunch (mobile) / page reload (web).
- [ ] **AC-4:** System mode follows the OS appearance live; flipping OS dark/light updates the app without interaction.
- [ ] **AC-5:** Every preset shows a light and a dark variant; the High-Contrast preset is visibly the strongest contrast and is tagged AA (AAA where achieved).
- [ ] **AC-6:** The custom editor changes the live preview on every control change and the AA/Below-AA chips reflect the real computed ratio.
- [ ] **AC-7:** A custom theme can be saved, renamed, applied, and deleted; deleting the active one falls back to Open Burrow with a toast.
- [ ] **AC-8:** "Generate from a color" produces a complete, AA-passing palette from a single seed.
- [ ] **AC-9:** A theme can be exported as a copyable blob, a QR (rendered from the bundled `qr.ts` encoder), and a `meerkat://theme/import#…` link, and re-imported on the other surface to resolve to the **same theme profile — identical `--mk-*` token values across surfaces** (asserted by a Tier-A/B round-trip), with a Tier-D visual check confirming the looks match (RN and CSS are different rendering engines, so "identical pixels" is not asserted).
- [ ] **AC-10:** Importing a malformed/corrupt/oversized/newer-version blob shows the specific honest error and changes nothing.
- [ ] **AC-11:** All theme copy states the look is saved on this device/browser and is never auto-synced or "sent".

### Technical (TC)
- [ ] **TC-1:** `mk_themes` rows and `theme_*` keys persist via `DatabaseAdapter` on both surfaces and round-trip through `getSetting`/`setSetting` + the new CRUD.
- [ ] **TC-2:** `decodeThemeBlob` rejects (a) bad version, (b) bad checksum, (c) >16 KB, (d) non-color/non-number token values, (e) remote/`url()` fonts, (f) schema-invalid — each with a distinct error; it never throws.
- [ ] **TC-3:** `contrastRatio` matches WCAG reference values within 0.01 for known pairs (e.g. #000/#fff = 21.0); `ratesAA` thresholds are 4.5 (normal) / 3.0 (large/UI).
- [ ] **TC-4:** Every built-in preset passes AA for body-on-background, body-on-surface, and onAccent-on-accent in BOTH modes (enforced by a test that iterates `PRESETS`).
- [ ] **TC-5:** `generatePalette(seed, mode)` output passes the same AA assertions for any seed in a fuzz set.
- [ ] **TC-6:** The **CRUD/SQL surface** of mobile `theme-store.ts` and web `theme-store.ts`/`meerkat-data.ts` (the `mk_themes` DDL, column list, and the `mk_themes`/`theme_*` query strings) is parity-identical and asserted by `scripts/check-meerkat-parity.mjs` (extended to cover them). The platform glue differs by design — mobile expo-sqlite `DatabaseAdapter` + filesystem boot mirror, web sql.js + localStorage boot mirror — so parity is scoped to the SQL/CRUD surface, not the whole file.
- [ ] **TC-7:** Applying a theme persists to `mk_themes`/`theme_*` (durable) and the boot mirror. On cold start, mobile reads the active theme **synchronously** (expo-sqlite `getFirstSync`) and web reads localStorage before hydration, so the first frame renders the persisted non-default theme; if the synchronous source is empty/unavailable, the first frame is the honest Open Burrow default (never a wrong-palette flash).
- [ ] **TC-8:** Optional signed-author export verifies on import; an invalid signature downgrades the label only and never blocks a valid theme.
- [ ] **TC-9:** `qr.ts` encodes the blob string into a QR matrix that decodes back to the exact same blob string (pure-TS encoder round-trip, Tier A). Mobile camera scan of a rendered matrix (`expo-camera`) is exercised at Tier D (hardware).

### Negative (NC)
- [ ] **NC-1:** Themes MUST NOT replicate: no `mk_themes`/`theme_*` value ever leaves the device via any sync session (`mk_` stays outside the sync prefix map).
- [ ] **NC-2:** An imported theme MUST NOT be able to inject CSS or JS on web (token values are constrained to colors/numbers; no raw CSS, no `url()`).
- [ ] **NC-3:** No theme copy implies transport: never "synced", "sent", "uploaded", "shared with N people", or any peer/delivery count.
- [ ] **NC-4:** An AA badge MUST NOT appear unless `ratesAA` returns true on the real computed ratio (no hardcoded "AA").
- [ ] **NC-5:** The generator MUST NOT make a network call and MUST NOT be described as "AI" or server-backed.
- [ ] **NC-6:** Changing a theme MUST NOT touch identity, keys, communities, messages, or any `cm_`/`sync_`/`mp_` data.

---

## Build Plan (phased, test-FIRST / TDD)

Each phase: write failing tests first, then implement to green, then `/function-gate-runner` + `/review`. UI phases add `/browse`.

- **Phase 0 — Shared package skeleton (`@mylife/meerkat-theme`).** TDD: write `contrast.test.ts` (WCAG reference pairs), `derive.test.ts`, `resolve.test.ts` first. Implement `schema.ts` (MkThemeProfile = MkColors superset + shape + density + type-weight + light/dark variants), `contrast.ts`, `derive.ts`, `resolve.ts`, `index.ts`, wire `package.json`/tsconfig. Gate: package builds, Node tests green, zero RN/DOM imports.
- **Phase 1 — Presets + AA enforcement.** TDD: write the preset-AA iterator test (TC-4) FIRST (it fails with no presets). Author the 6 families (Open Burrow ported from `tokens.ts`, plus Calm/Social/Playful/Serious/High-Contrast), each light+dark, until the AA test passes. Add `presets/index.ts` (`PRESETS` registry + `DEFAULT_PRESET_ID = 'open-burrow'`).
- **Phase 2 — Codec + QR encoder + generator.** TDD: `codec.test.ts` (TC-2 round-trip + every rejection), `qr.test.ts` (TC-9 matrix encode -> decode round-trip), and `generate.test.ts` (TC-5 fuzz AA) FIRST. Implement `codec.ts` (encode/decode/checksum/strict-validate/size-cap/color+font allow-list), `qr.ts` (pure-TS QR matrix encoder + byte-ceiling fallback), and `generate.ts`.
- **Phase 3 — Mobile persistence + provider.** TDD: `theme-store.test.ts` (CRUD + active/mode + boot-mirror round-trip, Node with in-memory adapter) FIRST. Add `mk_themes` DDL to `data/db.ts`, implement `theme/theme-store.ts`, extend `AppThemeProvider.tsx` (active preset/custom + mode, `useThemeLibrary()`), wire the **synchronous boot read** (expo-sqlite `openDatabaseSync`/`getFirstSync` at provider mount) plus the redundant JSON mirror. No screen yet; verify via tests + a temporary debug toggle, including a cold-start first-frame check.
- **Phase 4 — Mobile UI.** Build `appearance.tsx` + `theme-editor.tsx`, add the Me row, register the hidden routes in `(tabs)/_layout.tsx`. Render export QR from `qr.ts` with `react-native-svg`, and wire QR scan via lazy-loaded `expo-camera` (paste-only fallback when the module is absent). All 5 states + exact copy. `/browse` is N/A on native; use the iOS simulator screenshot check + manual state walk. Gate + `/review`.
- **Phase 5 — Web persistence + provider.** Mirror Phase 3's **CRUD/SQL surface** (DDL + query strings) verbatim into `meerkat-web/src/lib/schema.ts` + `meerkat-data.ts` + `ui/theme/theme-store.ts`, with web-specific glue (sql.js + a localStorage boot mirror instead of expo-sqlite + filesystem); extend `ThemeProvider.tsx` to apply the resolved profile as runtime `--mk-*` vars (presets and custom share one path), keeping tokens.css as the no-JS Open Burrow fallback. localStorage fast-read for pre-hydration. TDD with the web test setup (`fake-indexeddb`, sql.js).
- **Phase 6 — Web UI.** Extend `AppearanceSection.tsx`, add `ThemeEditorOverlay.tsx`; render the export QR from the same `qr.ts` matrix as inline SVG (paste/deep-link import only — no web camera scan). All 5 states + copy. `/browse` the settings overlay, click every control, verify all 5 states + a preset switch + a custom save + an import-error.
- **Phase 7 — Parity, deep-link, signed export, hardening.** Wire `meerkat://theme/import#…` deep-link handling (mobile `expo-linking`, web hash route); add the optional signed-author export via the existing `@mylife/sync` sign/verify; extend `scripts/check-meerkat-parity.mjs` to assert both apps import `@mylife/meerkat-theme` and that the store twins match. Final `/function-gate-runner`, `/review`, `/parity-check`, and a `/design-review` pass on both surfaces.

---

## Test Plan (unit / integration / e2e + verification tiers)

- **Unit (Tier A, automated, Node — `@mylife/meerkat-theme/__tests__`):** contrast reference values (TC-3); derive determinism; resolveProfile mode fallback; codec round-trip + all six rejections (TC-2); QR matrix encode -> decode round-trip (TC-9); generator AA fuzz (TC-5); preset-AA iteration over both modes (TC-4). All pure, no RN/DOM.
- **Integration (Tier B, automated):** mobile `theme-store` CRUD + active/mode + cache round-trip against an in-memory `DatabaseAdapter`; web twin CRUD against sql.js + `fake-indexeddb`; "delete active theme falls back to Open Burrow"; "import valid blob -> appears in My themes"; parity script asserts twins match (TC-6).
- **E2E / UI (Tier C, web automated via `/browse`; mobile semi-automated):** web — open settings, switch preset (verify `--mk-*` vars changed on `documentElement`), toggle mode, create+save a custom theme, export blob, import it back, trigger each import error, verify all 5 states. Mobile — simulator walk of the same flows with screenshots (no `/browse` on native).
- **Manual / ops (Tier D, remains manual):** real cross-device portability (export on phone, import on a second phone by scanning the rendered QR with `expo-camera` — hardware camera path), real OS dark/light flip on a physical device, VoiceOver/TalkBack pass on the High-Contrast preset, and a true visual side-by-side against Telegram/Discord theme screens for the "feels native" bar (and confirming the imported theme *looks* the same across RN and CSS — the part AC-9 leaves to visual check). Color-perception/AAA judgement and the subjective "register" feel of each preset stay human-reviewed (`/plan-design-review` + `/design-review`).

**Reachable tier for this plan: A-C automated; D (cross-device portability, accessibility hardware, subjective design parity) stays manual/ops.**

---

## Risks + honesty landmines

- **Honesty landmine — "syncs across your devices."** Themes are device-local. Any copy that says or implies a theme follows you to other devices is a violation. Mitigation: NC-1/NC-3 + the fixed footer copy; the parity/honesty grep should flag "sync" near theme strings.
- **Honesty landmine — fake AA badge.** Showing "AA" without the real computed ratio fakes a capability. Mitigation: NC-4 + TC-3/TC-4; the badge is a pure function of `ratesAA`.
- **Honesty landmine — "AI" / "send theme".** The generator is local math, not AI; export is a copy, not a transmission. Mitigation: NC-5 + Share-sheet footer copy; no network call in `generate.ts`/`codec.ts`.
- **Security risk — theme as an injection vector (web).** Tokens become CSS custom-property values; an unconstrained string could attempt CSS injection. Mitigation: NC-2 + the strict color/number/font allow-list validation in `codec.ts`, enforced below the UI.
- **First-frame flash (mobile) because `AppThemeProvider` mounts above `DatabaseProvider` and `expo-file-system` reads are async.** Mitigation: the provider reads the active theme **synchronously** at mount via expo-sqlite's `getFirstSync` (no async wait, no new dep, same db file), so the persisted theme renders on the first frame; the JSON file is only a redundant mirror; honest Open Burrow default when the synchronous read is empty/unavailable (TC-7).
- **Parity drift between the two store twins.** Mitigation: shared package for all logic; only the thin store + provider differ; parity script extended (TC-6) to assert both.
- **Preset register subjectivity.** "Vibrant/playful/serious" are taste calls that could miss the "feels native beside Instagram/X/…" bar. Mitigation: `/plan-design-review` before build and `/design-review` after; Tier-D side-by-side.
- **Schema-version forward-compat.** Imported themes from future versions. Mitigation: explicit version gate + "made in a newer version" error (edge case + TC-2).

---

## Sequencing vs the other Meerkat launch plans

- **Independent of and non-blocking to:** the public social layer, full DMs, and monetization/billing — none of their data or transport is touched. They can build in parallel. Their *new screens/settings rows* must consume `useAppThemeColors()` / `--mk-*` vars (a one-line convention, not a dependency).
- **Settings-area coordination (same area, different files — not a real conflict):** the connectivity + self-hosting plan (20) edits its own Settings files (`settings.tsx`, `TransportSection.tsx`), **not** `AppearanceSection.tsx`; and on mobile this plan adds its entry to `me.tsx`, not `settings.tsx`. So the two plans touch the settings *area* but disjoint files. Use file-ownership zones if both are active: this plan owns `AppearanceSection.tsx`, `appearance.tsx`, `theme-editor.tsx`, `ThemeEditorOverlay.tsx`, `theme/*`, `packages/meerkat-theme`, and the `me.tsx` Appearance row.
- **Blocks launch readiness:** app-store screenshots, the "native beside the big apps" visual bar, and accessibility sign-off all assume themes have landed. Merge this before the launch-readiness plan starts its visual QA.
- **Theme-system plan = this doc.** It is the lowest-risk, most parallelizable of the set and a good early win that de-risks the launch-readiness visual gate.

## Handoff State

### Before
One hardcoded Open Burrow palette; mobile has no theme control; web has System/Light/Dark only (`AppearanceSection.tsx`); no presets, no custom editor, no portable themes.

### After
A shared `@mylife/meerkat-theme` package (schema, 6 AA-verified preset families x light+dark, derive/contrast/generate/codec), persisted per-device preset + mode + custom themes on both surfaces, a full custom editor with live preview and real WCAG readouts, and a serverless export/import path (copy/QR/deep-link, optional signed author) — at mobile/web parity, with theming kept device-local and below-UI input validation.

### Known limitations (honest, not deferrals)
- Themes are intentionally device-local; cross-device movement is the explicit, user-initiated portable blob (by design, per the privacy model) — not an automatic sync.
- Publishing a theme to a community as a `published_blob` is a separate future object on existing `@mylife/sync` share primitives, out of this plan's default path.
