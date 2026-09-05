# Life360 — Deep Dive (vs MyPresence)

**Module:** presence
**Tier:** direct (location/life-sharing leader; family safety positioning)
**Founded:** 2008
**HQ:** San Mateo, CA, USA
**Status:** public (NASDAQ: LIF; dual-listed ASX:360)

## One-line
The dominant family-location-sharing network, monetizing via safety-as-a-service + Tile tracker hardware + auto-insurance data (Arity + Allstate), and a central cautionary tale for every privacy-first MyLife module.

## Product
- Location sharing Circles (real-time location, history, drive breadcrumbs)
- Crash detection + emergency dispatch + roadside assistance
- Driver reports (speed, braking, phone use) via Arity integration
- Tile tracker integration (acquired 2021) for things + pets
- SOS, emergency contacts, identity-theft protection (Gold+)
- Platforms: iOS, Android, Web (companion)
- Pricing: free (basic Circle, 2-day history) / Silver $7.99/mo / Gold $14.99/mo / Platinum $24.99/mo
- Distinguishing UX choice: the Circle concept — persistent social-graph geofencing with teens and parents as the real users

## Financials (public-source only)
| Year | Revenue | Subscription | Valuation | Source |
|------|---------|--------------|-----------|--------|
| 2023 | $304M | $222M | ~$1.5B | Life360 10-K 2023 |
| 2024 | $371M (+22% YoY) | N/D | ~$3B (post-IPO) | Life360 FY24 earnings Feb 2025 |
| 2025 | $450-480M guide | $350-360M guide | ~$4-5B market cap | Life360 FY25 guidance |

**Revenue mix:** subscriptions ~70%, hardware (Tile) ~10%, Arity data + ads ~15%, other ~5%.
**Profit / burn:** adjusted EBITDA profitable in 2024; targeting 35%+ adj EBITDA margin by 2027.
**Runway:** N/A (public, $100M+ cash).

## Cap Table (best public reconstruction)
| Round | Date | Amount | Lead | Post-money | Ownership notes |
|-------|------|--------|------|------------|-----------------|
| Series A | 2009 | $3.5M | BlueRun Ventures | N/D | Founders Chris Hulls + Alex Haro |
| Series B | 2013 | $10M | DCM | N/D | |
| Series C | 2015 | $50M | ADT | N/D | Strategic (home-security) |
| Series D | 2017 | $50M | GoPro/NBCUniversal + DCM | ~$400M | |
| ASX IPO | May 2019 | A$145.4M | — | ~A$700M | Dual-listed |
| US IPO (secondary) | Jun 2024 | $133M | Morgan Stanley, JPM | ~$1.6B at IPO | NASDAQ: LIF |
| Tile acquisition | Jan 2022 | $205M | — | N/A | All-stock + cash |

Insiders: Chris Hulls (CEO, founder), Alex Haro (co-founder). Major holders: Vanguard, BlackRock, Australian super funds from ASX listing.
Sources: Life360 SEC 10-K, ASX disclosures, press releases.

## Funding History (round by round)
| Year | Stage | Amount | Lead investor | Other investors | Post-money valuation | Source |
|------|-------|--------|---------------|-----------------|---------------------|--------|
| 2009 | Series A | $3.5M | BlueRun Ventures | — | N/D | Crunchbase |
| 2013 | Series B | $10M | DCM | — | N/D | Crunchbase |
| 2015 | Series C | $50M | ADT Corp | DCM, BlueRun | N/D | TechCrunch |
| 2017 | Series D | $50M | GoPro + NBCUniversal + DCM | — | ~$400M | TechCrunch |
| 2019 | ASX IPO | A$145.4M | — | — | ~A$700M | ASX prospectus |
| 2022 | Tile acquisition | $205M | — | — | N/A | Life360 8-K |
| 2024 | US IPO (NASDAQ) | $133M (secondary listing) | Morgan Stanley, JPM | — | ~$1.6B | SEC S-1 |

Total raised: ~$113M primary pre-ASX + $145M ASX + $133M NASDAQ
Current stage: Public (NASDAQ: LIF; ASX: 360)

## Timeline to Success
| Year | Milestone | Signal |
|------|-----------|--------|
| 2008 | Founded by Chris Hulls and Alex Haro in San Francisco as GigaOM-era family-safety app | post-Katrina family safety thesis |
| 2013 | Crossed 10M downloads; Series B | category leader |
| 2016 | Driver-report features + Arity partnership announced | data-monetization wedge |
| 2019 | IPO on Australian Securities Exchange (ASX: 360) at A$4.79 | public via ASX |
| 2022 | Tile acquisition ($205M, all-stock+cash) — hardware pivot | expanded TAM |
| 2024 | US NASDAQ IPO (Jun 2024, secondary listing at $27/share); revenue $371M | major milestone |
| 2025 | Crossed 90M MAU; ~$450M revenue; 2.4M+ paying Circles | category dominance |
| 2026 | Targeting 35%+ adj EBITDA margin by 2027 | margin inflection phase |

## Acquisition / Exit
Independent as of 2026-04 (public). Most recent round: NASDAQ IPO Jun 2024. Life360 is a public company — no acquisition talks disclosed. Prior M&A activity: Life360 as acquirer (Tile $205M 2022, Jiobit 2021) not target. Chris Hulls remains founder-CEO 16+ years in.

## Users
- MAU: 91.6M (Q3 2025, +19% YoY) — the highest in the category
- Paying Circles: 2.4M+ (Q1 2025) — each Circle = 1 subscription covering a family
- Geography: US ~70%, Rest of World ~30%
- Conversion rate: ~3% MAU to paying Circles (but Circle owners represent households of 4-5)

## How they make money (precise)
1. **Subscriptions** ($7.99-$24.99/mo): Silver (driver reports, 30-day location history), Gold (crash detection, SOS, roadside, ID-theft, 30-day history), Platinum (disaster response, travel).
2. **Arity / Allstate data-licensing partnership**: anonymized driving data resold for insurance underwriting; the data-exhaust revenue line.
3. **Tile hardware** (trackers sold direct and via retail).
4. **Display ads** on free tier (reintroduced 2023).
5. **Roadside assistance** (partner share).

Unit economics: gross margin on subs ~70%+; ARPPC (per paying Circle) ~$140/yr and rising.

## Wedge MyLife can exploit
- **Ads + data-licensing model:** Life360 monetizes the location graph itself (Arity). MyPresence is privacy-first with zero telemetry.
- **Multiple privacy controversies:** the 2021 MarkUp report on location-data sales reshaped Life360's disclosures. MyPresence is SQLite-local by default.
- **Not a digital-wellbeing tool:** Life360 tracks where bodies are. MyPresence tracks where attention is (phone usage, pickups, focus sessions, accountability partners).
- **Teen coercion dynamic:** Life360 is famously parents-watching-teens. MyPresence is self-directed (commitment contracts, rewards, streaks).
- **Suite integration:** Life360 is a silo. MyPresence feeds into MyHabits (phone-free streaks as habits), MyMood (correlate pickup count with mood), MyHealth.
- **Pricing gap:** Life360 Gold is $180/yr vs MyLife $99/yr for all 30 modules.

## Logo
`../../assets/logos/life360.png` — Apple App Store icon, 512x512, converted PNG.

## Logo Source
- URL: iTunes Search API lookup (id=384830320) artworkUrl512
- License: trademark owner's app-store icon; used for identification in competitor analysis.

## Sources
- https://investors.life360.com/news-releases/news-release-details/life360-reports-record-q4-and-fy-2024-results
- https://www.globenewswire.com/news-release/2025/02/27/3034369/0/en/Life360-Reports-Record-Q4-and-FY-2024-Results.html
- https://investors.life360.com/news-releases/news-release-details/life360-reports-record-q3-2025-results
- Life360 Form 10-K (SEC EDGAR)
