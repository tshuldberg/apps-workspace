# Apple Health — Deep Dive (vs MyHealth)

**Module:** health
**Tier:** direct (platform default)
**Founded:** 2014 (announced WWDC)
**HQ:** Cupertino, CA
**Status:** public (part of Apple Inc., NASDAQ: AAPL)

## One-line
The default health aggregator on 1B+ iPhones — zero marginal cost to the user, unbeatable distribution, and increasingly the API layer every other health app builds on.

## Product
- Aggregates activity, sleep, heart, mobility, cycle, meds, vitals, symptoms, mental wellbeing, nutrition, respiratory
- HealthKit SDK: read/write permissions for third-party apps
- Health Records: FHIR-backed connection to 800+ US health systems
- Apple Watch integrations: ECG, AFib history, blood oxygen, fall detection, sleep stages, medication reminders
- Pricing: free, bundled with iOS/iPadOS/watchOS
- Platforms: iPhone, iPad (iOS 17+), Apple Watch

## Financials (public-source only)
| Year | Revenue | ARR | Valuation | Source |
|------|---------|-----|-----------|--------|
| 2023 | $0 standalone (bundled) | N/A | part of $3.3T AAPL | Apple 10-K |
| 2024 | $0 standalone | N/A | part of $3.5T AAPL | Apple 10-K |
| 2025 | $0 standalone | N/A | part of AAPL market cap | Apple 10-K |

**Revenue mix:** N/A (indirectly lifts iPhone + Services through HealthKit partnerships, Apple Watch attach).
**Profit / burn:** attributed to Apple's Services + Wearables segments. Health drives Apple Watch ($15B+/yr category).
**Runway:** N/A (parent has $60B+ cash).

## Cap Table (best public reconstruction)
| Round | Date | Amount | Lead | Post-money | Ownership notes |
|-------|------|--------|------|------------|-----------------|
| N/A (product, not entity) | — | — | — | — | Apple Inc. common stock; top holders Vanguard, BlackRock, State Street, Buffett-era Berkshire holdings |

Notes: Apple Health is not a separate company. Apple holds 100%. There are no rounds, no ESOP attribution, no insider cap on the product itself.
Sources: Apple 10-K (FY2024), SEC Form 13F institutional filings.

## Funding History (round by round)
| Year | Stage | Amount | Lead investor | Other investors | Post-money valuation | Source |
|------|-------|--------|---------------|-----------------|---------------------|--------|
| N/A | Product of Apple Inc. | N/A | N/A | — | N/A (Apple ~$3T market cap) | Apple 10-K |

Total raised: N/A (first-party Apple product)
Current stage: Shipped as part of iOS (2014+), watchOS, iPadOS, macOS

## Timeline to Success
| Year | Milestone | Signal |
|------|-----------|--------|
| 2014 Jun | Apple Health + HealthKit announced at WWDC | first-party mobile health platform |
| 2014 Sep | Launched with iOS 8 | pre-installed on every iPhone |
| 2015 | Apple Watch launch + Activity rings integration | wearable halo |
| 2018 | ECG + atrial fibrillation detection (Series 4) | FDA clearance |
| 2020 | Health Sharing with family members | social layer |
| 2022 | Medications tracking + interaction warnings | medication-reminder adjacency |
| 2024 | iOS 18 Health AI features; Vitals app on Watch | AI health-insights pivot |
| 2026 | Pre-installed on 1.4B+ active iPhones | ubiquitous baseline |

## Acquisition / Exit
N/A (Apple Health is a first-party Apple product, not an acquisition target). Apple Inc. (NASDAQ: AAPL) is the parent; any strategic change would be an internal Apple decision. Apple Health itself has historically absorbed smaller acquired technologies (e.g., Gliimpse 2016 for health data aggregation, Beddit 2017 for sleep tracking).

## Users
- 1B+ iPhone active users globally (Apple disclosed late 2023)
- 35k+ healthcare/medical apps on App Store leveraging HealthKit (Statista 2024)
- 800+ US health systems connected to Health Records
- Apple Watch: ~150M active users est. (Counterpoint)
- Conversion: N/A (free default)

## How they make money (precise)
Apple Health itself is a loss-leader. Monetization is indirect:
1. **iPhone sell-through**: health/fitness is a top-3 reason to upgrade.
2. **Apple Watch attach**: watch is an accessory to Health; ~$15B/yr Wearables revenue.
3. **Services lift**: Apple Fitness+ ($9.99/mo), Apple One bundles.
4. **Platform moat**: every third-party health app must integrate HealthKit, reinforcing iOS stickiness.

## Wedge MyLife can exploit
- **Not truly cross-platform.** Apple Health does not exist on Android or web. MyHealth ships all three.
- **No doctor-report generator.** Users export dense PDFs no clinician reads. MyHealth's `src/reports/doctor-report.ts` emits curated markdown.
- **No cross-domain correlation UX.** Health shows siloed charts; it does not tell the user "your mood dropped the weeks you slept <6 hours." MyHealth ships Pearson correlation as a first-class feature.
- **No consolidation narrative.** Health is an aggregator; it does not also give you Medisafe-style dosing, Bearable-style symptom tagging, or SOS grounding. MyHealth absorbs meds + fast + cycle + sleep + vitals + mind.
- **No data portability story.** Apple does not let the user own their Health data outside Apple's ecosystem. MyHealth is SQLite on device, exportable as CSV + markdown.

## Logo
`../../assets/logos/apple-health.png` — PNG, 196x196, Wikimedia Commons.

## Logo Source
URL: https://upload.wikimedia.org/wikipedia/commons/4/4e/Health_icon_iOS_12.png
License: fair use (Apple trademark; Wikipedia infobox). Trademark Apple Inc.

## Sources
- [Apple Health (Wikipedia)](https://en.wikipedia.org/wiki/Health_(Apple))
- [HealthKit developer docs](https://developer.apple.com/documentation/healthkit)
- [Statista — iOS health apps 2024](https://www.statista.com/statistics/779910/health-apps-available-ios-worldwide/)
- [Apple Developer — Health Records](https://developer.apple.com/documentation/healthkit/accessing-health-records)
