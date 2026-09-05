# Out of Milk — Deep Dive (vs MyMarket)

**Module:** market
**Tier:** direct (grocery/shopping-list, ad-supported US)
**Founded:** 2010 (as Capigami)
**HQ:** Denver, CO, USA (now part of InMarket, Los Angeles)
**Status:** acquired (InMarket Media, June 2021)

## One-line
The granddaddy US grocery-list app, now a location-data and contextual-ad vehicle for InMarket's retail-media stack; the product is the data exhaust, not the lists.

## Product
- Grocery list, pantry list, to-do list (three stores)
- Barcode scan to add products, voice input
- Weekly ad/coupons surface (inMarket retail-media integration)
- Shared lists via account sync
- Platforms: iOS, Android, Web (web is thin)
- Pricing: free ad-supported / Out of Milk Pro $7.99/yr (or $0.99/mo)
- Distinguishing UX choice: simplicity — one-text-per-line entry, minimal friction vs Bring!'s icon catalog

## Financials (public-source only)
| Year | Revenue | ARR | Valuation | Source |
|------|---------|-----|-----------|--------|
| 2023 | N/D (bundled into InMarket) | N/D | N/A | InMarket private |
| 2024 | N/D (bundled) | N/D | N/A | InMarket private |
| 2025 | N/D (bundled) | N/D | N/A | InMarket private |

**Revenue mix:** retail-media ads + location-data licensing ~95% est., Pro subs ~5% est.
**Profit / burn:** N/D; InMarket is a profitable ad-tech firm per public filings around funding events.
**Runway:** N/A (subsidiary).

## Cap Table (best public reconstruction)
| Round | Date | Amount | Lead | Post-money | Ownership notes |
|-------|------|--------|------|------------|-----------------|
| Self-funded | 2010 | founder capital | — | — | Capigami LLC, Paul Barton (founder) |
| Acquisition | Jun 2021 | terms N/D | InMarket Media | N/A | 100% absorbed |

Founders: Paul Barton (CTO at acquisition). Institutional holder: InMarket Media (portfolio-held by Vista Equity Partners and private investors).
Sources: PR Newswire (Jun 2021), MarTech Series.

## Funding History (round by round)
| Year | Stage | Amount | Lead investor | Other investors | Post-money valuation | Source |
|------|-------|--------|---------------|-----------------|---------------------|--------|
| 2010 | Self-funded | founder capital | — | — | — | Crunchbase (Capigami LLC) |
| 2021 | Acquisition | undisclosed | InMarket Media | — | N/A | PR Newswire Jun 2021 |

Total raised: minimal (bootstrapped until acquisition)
Current stage: Acquired (absorbed into InMarket Media)

## Timeline to Success
| Year | Milestone | Signal |
|------|-----------|--------|
| 2010 | Founded in Denver by Paul Barton as Capigami; first release of Out of Milk | early Android-first list app |
| 2013 | Crossed 5M downloads; iOS version released | category leader on Android |
| 2018 | 15M+ downloads; weekly-ad / coupons surface added | moved toward ad-supported model |
| 2021 | Acquired by InMarket Media (June 2021); international users sunset | pivoted to pure retail-media play |
| 2024 | Integrated into InMarket's Moments attribution platform | data-exhaust monetization |
| 2026 | ~2-3M MAU US-only; retained brand inside InMarket | legacy list footprint |

## Acquisition / Exit
- Acquired by: InMarket Media (private, Los Angeles; portfolio of Vista Equity Partners)
- Date: 2021-06
- Price: undisclosed
- Current status inside parent: absorbed as data-ingestion surface inside InMarket Moments
- Strategic rationale: location + purchase-intent signal for InMarket's retail-media and attribution measurement businesses; grocery-list actions are closest-to-purchase intent data available
- Founder outcome: Paul Barton joined InMarket as CTO / senior engineering role

## Users
- Downloads: 20M+ lifetime (pre-acquisition claim, 2021)
- MAU: ~2-3M est. (US, declining per Android Police coverage of international shutdowns in 2021)
- DAU: N/D
- Geography: US 85%+ (international users were pushed off in June 2021 to cut cloud costs)
- Conversion rate: very low (<2%); the product is the ads, not the Pro tier

## How they make money (precise)
1. **Sponsored product placements** and weekly-ad tiles sold via InMarket's Moments platform to CPG advertisers.
2. **Location-SDK attribution**: the app ingests location data to attribute in-store visits for InMarket's attribution product.
3. **Out of Milk Pro** ($7.99/yr): ad removal, extra lists.

Unit economics: retail-media CPMs are high ($8-15) given purchase-intent; product serves as a feeder for InMarket's B2B measurement suite rather than direct consumer revenue.

## Wedge MyLife can exploit
- **Data-licensing business model:** the app exists to harvest shopping intent for ad-tech. MyMarket collects zero ads and zero telemetry.
- **Shrinking surface:** InMarket killed international users in 2021 to reduce costs. MyMarket is built for all regions from launch.
- **No recipe or meal-planning layer:** OOM is a list only; MyMarket sits inside a suite with MyRecipes + MyNutrition.
- **No marketplace:** MyMarket also ships a full Craigslist-competitive C2C marketplace with escrow and verification — OOM has none.

## Logo
`../../assets/logos/out-of-milk.png` — Apple App Store icon, 512x512, converted PNG.

## Logo Source
- URL: iTunes Search API lookup (id=564974992) artworkUrl512
- License: trademark owner's app-store icon; used for identification in competitor analysis.

## Sources
- https://outofmilk.com/
- https://www.prnewswire.com/news-releases/inmarket-acquires-out-of-milk-to-bolster-real-time-contextual-advertising-from-planning-to-purchase-301317186.html
- https://www.androidpolice.com/2021/06/23/out-of-milk-gives-its-international-users-the-boot/
- https://apps.apple.com/us/app/grocery-list-out-of-milk/id564974992
