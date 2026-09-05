# Anki (AnkiWeb / AnkiMobile) — Deep Dive (vs MyFlash)

**Module:** flash
**Tier:** direct
**Founded:** 2006
**HQ:** Tokyo, Japan (Ankitects Pty Ltd — Damien Elmes)
**Status:** private (solo-dev; open-source desktop + iOS paid app)

## One-line
The open-source spaced-repetition gold standard used by the majority of US medical students; sustained by a one-time $24.99 iOS purchase funding a single-maintainer business for 18 years.

## Product
- Deck management, card types (basic, cloze, image occlusion via community add-on)
- SM-2 default scheduler; FSRS added 2023 (industry-leading retention algorithm)
- Massive community decks (MCAT, USMLE, language learning) on AnkiWeb
- Add-on ecosystem on desktop (2,000+ community add-ons)
- Platforms: Desktop (Win/Mac/Linux free), AnkiWeb (free sync), Android (AnkiDroid, free), iOS (AnkiMobile $24.99 one-time)
- Pricing: free everywhere except iOS ($24.99 one-time — AnkiMobile subsidizes the rest)
- Distinguishing UX: zero marketing polish, infinite depth; "powerful but ugly" reputation

## Financials (public-source only)
| Year | Revenue | ARR | Valuation | Source |
|------|---------|-----|-----------|--------|
| 2023 | ~$8M est. | N/A (one-time) | N/A | Baseline: MyLife competitor-financials doc |
| 2024 | ~$8M est. | N/A | N/A | App Store rank steady top-100 Education |
| 2025 | ~$8-10M est. | N/A | N/A | Post-FSRS launch retention boost |

**Revenue mix:** ~100% iOS one-time purchases ($24.99 × ~300-400K units/yr). No subs. No ads. No B2B.
**Profit / burn:** highly profitable — solo developer, minimal infra. Estimated 80%+ margin.
**Runway:** effectively infinite.

## Cap Table (best public reconstruction)
| Round | Date | Amount | Lead | Post-money | Ownership notes |
|-------|------|--------|------|------------|-----------------|
| Bootstrap | 2006 | $0 external | Damien Elmes | N/A | Sole proprietor → Ankitects Pty Ltd |

No institutional investors. No cofounders. No ESOP. 100% founder-owned.
Sources: ankiweb.net, Crunchbase (no rounds), Damien Elmes public statements on Anki forums.

## Funding History (round by round)
| Year | Stage | Amount | Lead investor | Other investors | Post-money valuation | Source |
|------|-------|--------|---------------|-----------------|---------------------|--------|
| 2006 | Self-funded | $0 | Damien Elmes | — | — | Ankitects press |
| — | — | $0 VC | — | — | — | never raised |

Total raised: $0 outside capital
Current stage: Solo-developer bootstrapped business (Ankitects Pty Ltd)

## Timeline to Success
| Year | Milestone | Signal |
|------|-----------|--------|
| 2006 | Damien Elmes released Anki 0.1 as open-source desktop app | spaced-repetition revival |
| 2010 | AnkiMobile iOS paid app launched ($24.99 one-time) | funding mechanism established |
| 2012 | Crossed majority of US med-student market (86% per 2019 AAMC survey) | category dominance |
| 2014 | AnkiDroid (Android community port) reached parity with iOS Apple | platform expansion |
| 2019 | AnkiWeb sync scaled; 5M+ active users est. | stable global scale |
| 2023 | FSRS algorithm added as default option | major scheduler upgrade |
| 2026 | Still solo-dev; still $24.99 iOS; estimated ~$8-10M revenue/yr | 20-year indie icon |

## Acquisition / Exit
Independent as of 2026-04. Most recent round: never raised. Damien Elmes has publicly stated no intent to sell, fundraise, or commercialize beyond the existing iOS one-time purchase. No public acquisition talks in 20 years.

## Users
- MAU: estimated 5-10M active users across all platforms (no official disclosure; 86% of US med students use Anki per 2019 AAMC survey)
- DAU: 2-3M est. (heavy power-user base)
- Geography: global, US + India + Europe + East Asia strong
- Conversion: iOS paid tier estimated ~5-10% of active users

## How they make money (precise)
1. **AnkiMobile iOS one-time purchase** $24.99 — the only monetization vehicle.
2. Desktop + Android + AnkiWeb sync remain free forever per founder's philosophy.
3. No ads, no data, no B2B, no foundation/grants accepted.

Unit economics: Damien runs AnkiWeb sync as a cost center funded by AnkiMobile. Highly asymmetric margin — iOS users effectively fund the commons.

## Wedge MyLife can exploit
- **UX gap is vast:** Anki is notoriously hostile to new users. MyFlash offers modern iOS/Android/Web UI + templates + AI card generation.
- **No built-in AI:** Anki FSRS is best-in-class for scheduling but has no AI card generation, no AI practice tests, no conversation practice. MyFlash ships all three.
- **No cross-module signals:** Anki is a silo. MyFlash pulls vocabulary from MyBooks, study decks from MyNotes, triggers review reminders via the hub.
- **iOS users already pay $24.99:** switching story is clean — MyFlash imports .apkg preserving schedule, so user keeps review history.
- **No community moat risk:** Anki's ecosystem lives on AnkiWeb shared decks — MyFlash offers deck import without breaking that library.

## Logo
`../assets/logos/anki.png` — 512x512 App Store icon (AnkiMobile).

## Logo Source
- URL: https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/30/6b/da/306bdac5-3088-c97f-c682-e4626bfc6b43/AppIcon-0-0-1x_U007emarketing-0-5-0-85-220.png/512x512bb.jpg
- License: Apple App Store marketing artwork, editorial / comparative use.

## Sources
- https://apps.ankiweb.net/
- https://apps.apple.com/us/app/ankimobile-flashcards/id373493387
- https://www.aamc.org/news/how-medical-students-study (Anki adoption in US med schools)
- MyLife baseline: docs/business-plan/competitor-financials-2024-2026.md §2
