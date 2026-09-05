# Paprika Recipe Manager — Deep Dive (vs MyRecipes)

**Module:** recipes
**Tier:** direct
**Founded:** 2011
**HQ:** United States (Hindsight Labs LLC)
**Status:** private (indie, bootstrapped)

## One-line
The power-user's recipe organizer with one-time-purchase pricing, cross-device sync, web import, meal planning, and grocery lists — the canonical non-social cookbook app.

## Product
- Recipe library with ingredient scaling, categories, photos, bookmarklet web import
- Grocery lists (aisle-grouped, auto-combined), pantry, meal planner (daily/weekly/monthly)
- Cooking mode (screen-on, step highlighting, auto-detected timers)
- Paprika Cloud Sync across iOS, Android, Mac, Windows
- **Platforms:** iOS, Android, macOS, Windows
- **Pricing:** $4.99 mobile, $29.99 desktop (one-time purchase per platform); sync is free
- **Distinguishing UX:** zero subscriptions, offline-first, no social layer

## Financials (public-source only)
| Year | Revenue | ARR | Valuation | Source |
|------|---------|-----|-----------|--------|
| 2023 | ~$300-400K est. | N/A (one-time IAP) | N/D | Sensor Tower / Data.ai estimates |
| 2024 | ~$360K est. | N/A | N/D | MyLife baseline (competitor-financials-2024-2026.md) |
| 2025 | ~$400K est. | N/A | N/D | App Store charts, 52K+ iOS reviews |

**Revenue mix:** ~100% one-time IAP purchases (cross-platform unlocks). No ads, no subs, no B2B.
**Profit / burn:** estimated profitable (sub-10 person indie, no VC burn).
**Runway:** effectively infinite (no outside capital).

## Cap Table (best public reconstruction)
| Round | Date | Amount | Lead | Post-money | Ownership notes |
|-------|------|--------|------|------------|-----------------|
| Bootstrap | 2011 | $0 external | Founders | N/A | Hindsight Labs LLC, founder-owned |

Notes: No disclosed institutional investors. Hindsight Labs LLC is privately held by founders. No Crunchbase funding rounds listed. No ESOP disclosed.
Sources: Crunchbase (no rounds), App Store Connect, paprikaapp.com "About".

## Funding History (round by round)
| Year | Stage | Amount | Lead investor | Other investors | Post-money valuation | Source |
|------|-------|--------|---------------|-----------------|---------------------|--------|
| 2011 | Self-funded | founder savings | — | — | — | Crunchbase |
| — | — | $0 | — | — | — | no institutional round in 15 years |

Total raised: $0 (bootstrapped)
Current stage: Bootstrapped / profitable indie

## Timeline to Success
| Year | Milestone | Signal |
|------|-----------|--------|
| 2011 | Founded as Hindsight Labs LLC in the US | solo-indie launch |
| 2012 | Paprika Recipe Manager 1.0 shipped on Mac | desktop-first, unusual for era |
| 2014 | iOS + Android versions | cross-platform expansion |
| 2018 | Paprika 3 (major rewrite) | architectural refresh |
| 2022 | 50K+ iOS reviews | category-defining longevity |
| 2026 | 15 years in market, fully self-sustaining | indie-darling case study |

## Acquisition / Exit
Independent as of 2026-04. Most recent round: none (bootstrapped). No known acquisition talks in public record.

## Users
- MAU / DAU: N/D. Inferred 500K-1M MAU from 52K+ iOS reviews and 15 years in market.
- Geography: US-heavy, localized to 15+ languages (CS, DA, NL, EN, FI, FR, DE, HU, IT, JA, NB, PL, PT, ZH, ES, SV).
- Conversion: N/A (paid app, no free tier).

## How they make money (precise)
Primary: one-time paid app purchases, $4.99 mobile × ~80K units/yr = ~$400K gross, minus Apple/Google 30/15% fee. Secondary: desktop SKUs at $29.99 add ~$100-150K. No recurring revenue, no ads. Unit economics are simple: LTV ~= purchase price, CAC ~= organic / App Store search.

## Wedge MyLife can exploit
- **No AI import:** Paprika uses a rules-based parser; MyLife ships AI (Claude Vision) food recognition, video transcript, photo import — Paprika cannot match without rebuilding stack.
- **No cross-module orchestration:** Paprika is single-purpose. MyLife connects recipes → garden harvest → RSVP meal plans without siloing.
- **No voice cooking:** MyLife has voice commands for hands-free cooking mode.
- **Bundle price advantage:** MyLife suite at ~$7-10/mo includes recipes + 29 other modules. Paprika costs more than that per platform if you buy all SKUs.

## Logo
`../assets/logos/paprika.png` — 512x512, sourced from App Store (fair-use editorial).

## Logo Source
- URL: https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/a0/11/fa/a011fa7f-a52b-e7f6-b376-5287cd7c281d/AppIcon-0-0-1x_U007emarketing-0-8-0-0-85-220.png/512x512bb.jpg
- License: Apple App Store marketing artwork, editorial / comparative use.

## Sources
- https://www.paprikaapp.com/
- https://apps.apple.com/us/app/paprika-recipe-manager-3/id1303222868
- https://www.crunchbase.com/organization/hindsight-labs (no funding rounds listed)
- MyLife baseline: docs/business-plan/competitor-financials-2024-2026.md §14
