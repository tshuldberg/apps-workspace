# Life360 — Deep Dive (vs MyFriends)

**Module:** friends
**Tier:** adjacent (location-first; friend-list secondary)
**Founded:** 2008
**HQ:** San Francisco, USA
**Status:** public (NASDAQ: LIF, dual listing ASX: 360)

## One-line
The location-sharing app marketed as family safety, now a subscription + data-licensing business with 80M+ MAU; the friend list is a core primitive but the product optimizes for location and SOS features, not relationships.

## Product
- Real-time location sharing in "Circles" (friends + family)
- Place alerts (arrive/leave), driving reports, crash detection, SOS/Emergency Dispatch
- Tile hardware integration (acquired 2021) + Life360 Jiobit
- Platforms: iOS, Android, Web
- Pricing: free (basic location) / Silver $7.99/mo / Gold $14.99/mo / Platinum $24.99/mo
- Distinguishing UX: one-tap location + bundled physical tracker hardware

## Financials (public-source only)
| Year | Revenue | ARR | Valuation | Source |
|------|---------|-----|-----------|--------|
| 2023 | $305M | N/D | ~$1.5B mkt cap | Life360 10-K |
| 2024 | $371M | N/D | ~$3B mkt cap | 10-K FY2024 |
| 2025 | ~$450M est. | N/D | ~$4-5B mkt cap | Q1-Q3 2025 earnings |

**Revenue mix (2024):** ~70% subscriptions (Silver/Gold/Platinum), ~15% hardware (Tile), ~15% advertising + data licensing (controversial; Placer.ai partnership).
**Profit / burn:** first profitable full year 2024; accelerating margins in 2025.
**Runway:** N/A (public, cash-positive).

## Cap Table (best public reconstruction)
| Round | Date | Amount | Lead | Post-money | Ownership notes |
|-------|------|--------|------|------------|-----------------|
| Seed | 2008 | $0.5M | BlueRun Ventures | N/D | Chris Hulls + Alex Haro (founders) |
| Series A-D | 2009-2017 | ~$80M | ADT, DCM, Bessemer, GGV | N/D | Multiple institutional rounds |
| ASX IPO | May 2019 | ~$75M AUD | - | ~$500M AUD | Australian listing first |
| NASDAQ dual listing | Jun 2024 | $150M primary | - | ~$1.5B | US IPO for visibility |
| Tile acquisition | 2021 | $205M | - | N/A | Strategic M&A (stock + cash) |

Founders retain meaningful stakes; institutional holders diversified post-NASDAQ listing.
Sources: SEC filings, ASX filings, Life360 investor relations.

## Funding History (round by round)
(See also `competitors/presence/life360.md` for full detail; both files cover the same company.)

| Year | Stage | Amount | Lead investor | Other investors | Post-money valuation | Source |
|------|-------|--------|---------------|-----------------|---------------------|--------|
| 2009 | Series A | $3.5M | BlueRun Ventures | — | N/D | Crunchbase |
| 2013 | Series B | $10M | DCM | — | N/D | Crunchbase |
| 2015 | Series C | $50M | ADT Corp | DCM, BlueRun | N/D | TechCrunch |
| 2017 | Series D | $50M | GoPro + NBCUniversal + DCM | — | ~$400M | TechCrunch |
| 2019 | ASX IPO | A$145.4M | — | — | ~A$700M | ASX prospectus |
| 2022 | Tile acquisition | $205M | — | — | N/A | Life360 8-K |
| 2024 | NASDAQ IPO | $133M (secondary) | Morgan Stanley, JPM | — | ~$1.6B | SEC S-1 |

Total raised: ~$113M primary + $145M ASX + $133M NASDAQ
Current stage: Public (NASDAQ: LIF; ASX: 360)

## Timeline to Success
| Year | Milestone | Signal |
|------|-----------|--------|
| 2008 | Founded in San Francisco by Chris Hulls and Alex Haro; post-Katrina family-safety thesis | category creation |
| 2013 | Crossed 10M downloads | early scale |
| 2019 | IPO on ASX (May 2019) | Australian listing |
| 2022 | Tile acquisition ($205M, stock+cash) | hardware expansion |
| 2024 | US NASDAQ IPO (Jun 2024); first profitable full year; revenue $371M | major inflection |
| 2025 | 90M+ MAU, ~$450M revenue, $4-5B market cap | category leader by MAU |

## Acquisition / Exit
Independent as of 2026-04 (public). Life360 is a public company on two exchanges (NASDAQ: LIF, ASX: 360). No acquisition talks. Prior M&A: Life360 as acquirer (Tile $205M 2022, Jiobit 2021). Chris Hulls still founder-CEO.

## Users
- MAU: 80M+ (Q3 2024 disclosure)
- Paying subscribers: ~2M+ Circles (at one paying per Circle)
- Geography: US ~50%, strong in EU + AU + UK + Brazil
- Conversion: ~10-15% free-to-paid estimated

## How they make money (precise)
1. **Tiered subscriptions** $7.99/14.99/24.99 per month — unlocking longer location history, roadside assist, SOS support, identity theft protection.
2. **Hardware (Tile)** — Bluetooth trackers sold standalone + bundled with subscriptions.
3. **Advertising + data partnerships** — location data resale (anonymized aggregates, Placer.ai), in-app ads in free tier (scaled back post-PR backlash 2022 but restoring 2024).

Unit economics: subscription LTV high for family plans; hardware margins thin but strategic; data revenue is the margin booster + the reputational risk.

## Wedge MyLife can exploit
- **Location tracking ≠ relationship memory:** Life360 tells you where friends are; it does not tell you when you last connected meaningfully. MyFriends does.
- **Data sales history:** Life360 admitted selling location data in 2021-2022 (The Markup reporting); MyFriends is local-first, zero cloud profile.
- **Overlap with MyPresence, not MyFriends:** Life360's core function is presence; MyLife has a dedicated MyPresence module. MyFriends is specifically non-location — relationship CRM without surveillance.
- **Family-safety brand traps the adult friend use-case:** Life360's UX is parent-over-child; adult users find it creepy for pure friendships. MyFriends is designed for voluntary peer relationships.
- **Gift / life-event / birthday engines absent:** Life360 has zero on these dimensions.

## Logo
`../assets/logos/life360.png` — 512x512 App Store icon.

## Logo Source
- URL: https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/ff/93/26/ff932661-e9aa-e529-b49c-499a07898854/AppIcon-0-0-1x_U007ephone-0-1-0-0-85-220.png/512x512bb.jpg
- License: Apple App Store marketing artwork, editorial / comparative use.

## Sources
- https://investors.life360.com/ (10-K 2024)
- https://themarkup.org/privacy/2021/12/06/life360-popular-family-safety-app-is-selling-precise-location-data-on-its-tens-of-millions
- https://www.crunchbase.com/organization/life360
- https://apps.apple.com/us/app/life360/id384830320
