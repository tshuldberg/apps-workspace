# Strava — Deep Dive (vs MyTrails)

**Module:** trails
**Tier:** direct (segment competition, activity recording) + adjacent (social)
**Founded:** 2009
**HQ:** San Francisco, California, USA
**Status:** private ($2.2B val, 2025)

## One-line
The social network for endurance athletes, built on GPS activity feeds, Segment leaderboards, and a freemium model that converts ~3-4% of its 135M+ users into $79.99/yr subscribers.

## Product
- GPS recording for run/bike/hike/ski/swim and 30+ sports
- Segments (user-defined road/trail sections with KOM/QOM leaderboards)
- Activity feed with kudos and comments (core moat)
- Route Builder (Premium) and Heatmap (global)
- Clubs, Challenges, Goals, Training Log
- Platforms: iOS, Android, Web, Garmin, Wahoo, Apple Watch, Wear OS
- Pricing: Free (basic recording + feed) / Subscription $11.99/mo or $79.99/yr (prices raised 2024)
- Distinguishing UX choice: Segments + kudos loop — competitive infrastructure layered over your daily ride

## Financials (public-source only)
| Year | Revenue | ARR | Valuation | Source |
|------|---------|-----|-----------|--------|
| 2023 | ~$163M | N/D | N/D | Multiple press estimates |
| 2024 | ~$300-415M range | N/D | N/D | industry sources vary widely |
| 2025 | ~$400-500M est. | ~$450M | $2.2B | 2025 funding round confirms val |

**Revenue mix:** subscriptions ~85%, advertising (brand/discovery) ~10%, API + partner integrations ~5%.
**Profit / burn:** near break-even; subscription price hike Nov 2024 aimed at profitability.
**Runway:** 3+ years post-2025 raise.

## Cap Table (best public reconstruction)
| Round | Date | Amount | Lead | Post-money | Ownership notes |
|-------|------|--------|------|------------|-----------------|
| Series A | 2010 | $3.5M | Sigma Partners | N/D | Mark Gainey, Michael Horvath founders |
| Series B-D | 2011-2017 | ~$70M cumulative | Sequoia, Madrone, Jackson Square | — | Sequoia leads multiple |
| Growth | 2020 | $110M | TCV + Sequoia | ~$1.5B | Pandemic-era ride boom |
| Growth | 2025 | N/D | undisclosed | $2.2B | Secondary + primary |

Founders: Mark Gainey, Michael Horvath (still on board). Major holders: Sequoia, TCV, Madrone, Jackson Square. ESOP: ~15% est.
Sources: Crunchbase, TechCrunch 2020 raise, Bloomberg 2025 round coverage.

## Funding History (round by round)
| Year | Stage | Amount | Lead investor | Other investors | Post-money valuation | Source |
|------|-------|--------|---------------|-----------------|---------------------|--------|
| 2010 | Series A | $3.5M | Sigma Partners | — | N/D | Crunchbase |
| 2011 | Series B | $4M | Sigma | — | N/D | Crunchbase |
| 2013 | Series C | $18.5M | Sequoia | Madrone | N/D | TechCrunch |
| 2017 | Series E | $37M | Madrone | Sequoia, Jackson Square | N/D | TechCrunch |
| 2020 | Growth | $110M | TCV + Sequoia | — | ~$1.5B | TechCrunch Nov 2020 |
| 2025 | Growth (primary + secondary) | N/D | Undisclosed | — | $2.2B | Bloomberg |

Total raised: ~$180M+ disclosed (plus 2025 undisclosed)
Current stage: Late-stage private (Sequoia, TCV, Madrone, Jackson Square; founders on board)

## Timeline to Success
| Year | Milestone | Signal |
|------|-----------|--------|
| 2009 | Mark Gainey and Michael Horvath founded Strava in SF | Harvard rowing reunion origin |
| 2011 | Running added (previously cycling-only); Segments core feature | multi-sport expansion |
| 2013 | Sequoia Series C | institutional validation |
| 2018 | Heatmap exposed US military base locations (The Guardian) | privacy scandal |
| 2020 | Pandemic ride boom; TCV $110M at ~$1.5B | unicorn status |
| 2023 | Fatmap acquisition (3D outdoor maps) | category M&A |
| 2024 | Price hike to $79.99/yr; user backlash; $163-415M revenue range reported | monetization shift |
| 2025 | $2.2B valuation round; ~$400-500M revenue est. | category leader |

## Acquisition / Exit
Independent as of 2026-04 (late-stage private). Most recent round: 2025 growth round at $2.2B. Prior M&A: Strava as acquirer (Fatmap 2023 for 3D maps). No public acquisition talks; Mark Gainey and Michael Horvath retain board seats. Likely exit: IPO in 2027-2028 window given scale and Sequoia/TCV pressure, or strategic sale to Apple (Health/Fitness+) or Garmin.

## Users
- 135M+ registered (company, 2025)
- MAU: ~40M est.
- Paying subs: ~3.5-4M est.
- Geography: US 35%, UK + EU heavy, Brazil + Japan growing
- Conversion rate: ~3-4% free→Premium

## How they make money (precise)
1. **Subscription** ($11.99/mo or $79.99/yr): Route Builder, Heatmap, Matched Runs, Live Segments, goals.
2. **Advertising**: brand-led discovery ads in feed and segment pages (since 2023).
3. **API + partner integrations**: Garmin, Wahoo, Zwift pay minimal integration fees; ecosystem loyalty lock-in is the real value.

Unit economics: massive data-center + ingestion cost for 1B+ activities/yr; gross margin est. 60-65% (lower than pure-SaaS due to compute).

## Wedge MyLife can exploit
- **Social pressure is the product**: Strava monetizes FOMO and public kudos. MyTrails is private-first; no public feed required.
- **Price hike exposure**: Strava raised prices 2024, caused loud user backlash on r/Strava. MyLife $99/yr for 30 modules undercuts.
- **Location data resale**: Strava's Heatmap infamously leaked US military base locations in 2018 (published aggregated GPS). MyTrails keeps every GPS point on device.
- **Non-athlete gap**: Strava alienates casual hikers who don't want to compete. MyTrails covers the full spectrum (packing, trips, reviews, recordings) without leaderboard pressure.
- **Cross-module**: Strava exists in isolation. MyTrails connects to MyTravel (trips), MyWorkouts (cardio cross-mapping), MyHub places.

## Logo
`../../assets/logos/strava.png` — Apple iTunes App Store artwork, 512x512 rendered.

## Logo Source
- URL: `https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/bf/8a/84/bf8a84a6-e1d8-89ca-db87-644f4c3ef136/AppIcon-0-0-1x_U007ephone-0-1-0-sRGB-85-220.png/512x512bb.jpg`
- License: Apple App Store artwork, used for identification/commentary.

## Sources
- https://www.crunchbase.com/organization/strava
- https://www.bloomberg.com/news/articles/2025 Strava funding (paywalled)
- https://blog.strava.com/press/strava-2024-year-in-sport/
- https://www.theguardian.com/technology/2018/jan/28/fitness-tracking-app-gives-away-location-of-secret-us-army-bases
