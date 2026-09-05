# Meerkat Plan 18 — Theme System (multi-preset + custom editor + portable themes)

Date: 2026-06-28 to 2026-06-29
Branch: `feature/mylife-improvements-sprints`
Plan: `docs/plans/done/18-meerkat-theme-system.md` (moved queue -> done on completion)

## What shipped

A full, production-grade theme system for Meerkat across mobile (`apps/meerkat`)
and web (`apps/meerkat-web`), at parity, built phase-by-phase (one phase at a
time per founder pacing). The green "Open Burrow" look becomes one preset of
many, plus a real custom editor, real WCAG enforcement, and a serverless
export/import path (copy / QR / deep link, optional signed author).

Plus, before building: a **queue-currency audit** (21-agent workflow) over all
20 queue plans found 10 already shipped/superseded; 8 moved to `done/`, 2 to a
new `archive/`, leaving the 10 genuinely-pending plans. The Meerkat launch set
(18-23) was verified to re-propose zero already-shipped work.

## Phases (all committed)

| Phase | Commit | Summary |
|-------|--------|---------|
| Queue triage | `d13684cc` | Audit + move 10 stale plans out of the queue |
| P0 | `0904665b`+`74280c98` | New RN-free `@mylife/meerkat-theme`: WCAG contrast math, color-math, derive (22-token), resolve, Zod schema. 35 TDD tests |
| P1 | `8070d164` | 6 AA-verified preset families (Open Burrow exact port + Calm/Social/Playful/Serious/High-Contrast). TC-4 AA iterator |
| P2 | `7723809f` | codec (portable blob + CRC + strict validate + 16KB cap), real ISO/IEC 18004 QR encoder, local AA-targeting generator |
| P3 | `4644adff` | Mobile persistence: `theme-store.ts` (mk_themes, device-local) + `AppThemeProvider` synchronous-boot (flash-free) + `useThemeLibrary()` |
| P4 | `de9a4d06` | Mobile UI: Appearance screen + custom editor + QrCode/QrScanner (expo-camera) |
| P5 | `485598fb` | Web persistence: verbatim store twin + css-vars (--mk-* application) + ThemeProvider + sql.js bridge |
| P6 | `d7e0af59` | Web UI: AppearanceSection + ThemeEditorOverlay + inline-SVG QR |
| P7 | `ce38fe59` | Parity gate, optional signed-author export (Ed25519 via @mylife/sync), mobile deep-link auto-open |

## Key architecture decisions

- **Port the pattern, do not adopt `@mylife/ui` ThemeProfile.** Its `BaseColorsSchema`
  lacks 9 of Meerkat's 22 tokens and the web app does not depend on `@mylife/ui`.
  A new pure-TS superset package is the single source of truth.
- **One shared engine, two platform providers.** The package is crypto-free, RN-free,
  DOM-free, deterministic. Mobile uses a short-lived expo-sqlite handle per op
  (no stale-after-reset). Web uses localStorage (FOUC-free) + a sql.js bridge below
  MeerkatProvider (theme provider sits above it).
- **Store twin parity.** `theme-store.ts` is byte-identical SQL on both surfaces,
  asserted by `check-meerkat-parity.mjs`.
- **QR is the one un-themed surface** (fixed black-on-white for scannability).
- **Signed author is crypto-free in the package** (injected verify fn); apps sign
  with the device's existing Ed25519 key. The signature binds to `canonicalThemeBytes`,
  so a signature cannot be reused across themes (adversarially verified).

## Honesty posture

Every surface says themes are saved on THIS device/browser and never sync on
their own; sharing makes a COPY (nothing sent/uploaded). AA chips are computed
from real `ratesAA`, never hardcoded. The generator is local math, never "AI".
The signed-author toggle ships unsigned (no fake signature) if the key is
unavailable; the import label is accurate.

## Verification

- Package: 116 tests (TDD throughout). Mobile: typecheck clean + 195 tests.
  Web: typecheck clean + 87 tests. `check:meerkat-parity` passes.
- Adversarial review every phase (feature-dev:code-reviewer). Findings fixed:
  P0 regex gaps, P2 codec DoS + newline, P3 stale-handle/id-guard, P4 share-throw,
  P5 strict-mode updater, P6 CSS collision + aria-label. P7 review fully clean.
- Native runtime is typecheck/bundle-only (no simulator). Tier-D remains: device
  QA, camera-scan, OS dark/light flip, VoiceOver/TalkBack on High-Contrast, and a
  live `/design-review` visual pass on both surfaces.

## Parallel work note

A separate session built **Plan 20 (connectivity/self-hosting)** in the same
working tree throughout. Every theme commit was scoped to theme files only; no
Plan 20 file was ever staged. `app.config.ts` spreads `app.json` as the static
base, so the theme camera plugin is honored.
