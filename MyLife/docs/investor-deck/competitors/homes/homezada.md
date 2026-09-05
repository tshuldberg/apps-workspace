# HomeZada — Deep Dive (vs MyHomes)

**Module:** homes
**Tier:** direct (homeowner management super-app)
**Founded:** 2011
**HQ:** El Dorado Hills, CA
**Status:** private (seed-funded)

## One-line
Homeowner "super-app" tracking inventory, maintenance, projects, and finances — the closest analogue to MyHomes' scope, with insurance + contractor data as the paid hooks.

## Product
- Property + room + inventory + appliance tracking with warranty
- Maintenance schedules, project tracker, budget vs actual
- Insurance documentation + coverage tracker
- Home finance: mortgage, taxes, utility bills
- Pricing: free Essentials; Premium $79/yr; Deluxe $149/yr
- Platforms: iOS, Android, Web

## Financials (public-source only)
| Year | Revenue | ARR | Valuation | Source |
|------|---------|-----|-----------|--------|
| 2023 | N/D | N/D | N/D | Owler |
| 2024 | $5-25M (range) | N/D | N/D | Owler, Crunchbase estimate |
| 2025 | N/D | N/D | N/D | Preqin |

**Revenue mix:** subscriptions ~80% (Essentials/Premium/Deluxe), B2B insurance partnerships ~20% (Wells Fargo, insurer partners).
**Profit / burn:** N/D. 25-100 employees (Crunchbase).
**Runway:** $2.4M seed raised total; longevity suggests cash-flow positive or very slow burn.

## Cap Table (best public reconstruction)
| Round | Date | Amount | Lead | Post-money | Ownership notes |
|-------|------|--------|------|------------|-----------------|
| Seed | 2015-2017 | ~$0.3M | various angels | N/D | early product |
| Seed (named) | ~2019 | $2.1M | Moneta Ventures | N/D | "$2M seed round" press |
| Total to date | — | $2.4M | Moneta, Wells Fargo, MassChallenge, InsurTech NY, Quesnay, Fourthwave (9 total) | N/D | small cap table |

Notes: Founders John + Beth Bodrozic. ~9 investors across small rounds. Low dilution given $2.4M total; founders likely retain majority. No ESOP disclosed.
Sources: Crunchbase, PitchBook, homezada.com/press, Dealroom.

## Funding History (round by round)
| Year | Stage | Amount | Lead investor | Other investors | Post-money valuation | Source |
|------|-------|--------|---------------|-----------------|---------------------|--------|
| 2015-2017 | Seed (early) | ~$0.3M | angels | — | N/D | Crunchbase |
| ~2019 | Seed (named) | $2.1M | Moneta Ventures | — | N/D | press |
| 2020-2024 | Accelerator + strategic | small | InsurTech NY, Wells Fargo, MassChallenge, Quesnay, Fourthwave | — | N/D | Crunchbase |

Total raised: ~$2.4M across 9 investors
Current stage: Seed-stage SaaS (no follow-on growth round disclosed)

## Timeline to Success
| Year | Milestone | Signal |
|------|-----------|--------|
| 2012 | Founded by John + Beth Bodrozic in Folsom, CA | home-management thesis |
| 2013 | Web-first product launch | home inventory + maintenance tracking |
| 2015 | iOS + Android apps | mobile expansion |
| 2019 | $2.1M Moneta-led seed | VC validation, small check |
| 2022 | Insurtech partnerships (InsurTech NY accelerator) | insurance-adjacent monetization |
| 2024 | Wells Fargo accelerator; B2B pivot | SMB + insurer channel |
| 2026 | Estimated <$5M ARR; small team | niche SMB/insurance play |

## Acquisition / Exit
Independent as of 2026-04. No disclosed acquisition talks. Most likely exit paths: (a) insurtech acquirer (Lemonade, Hippo, Jetty) looking for home-inventory data, (b) home-services consolidator (Angi, HomeAdvisor), or (c) a home-warranty/insurance strategic (AIG, Allstate).

## Users
- N/D (not disclosed)
- Est. "hundreds of thousands" per press; paid base likely 10-30k (given $5-25M rev range / $79-149 ARPPU)
- Geography: US primary
- Conversion free→paid: N/D

## How they make money (precise)
1. **Premium subscription** ($79/yr): inventory + maintenance + project + finance. Primary revenue line.
2. **Deluxe subscription** ($149/yr): adds deeper insurance, financial modeling, multiple properties.
3. **Insurance / service partnerships**: white-label deals with insurers and lenders (Wells Fargo investor relationship hints).
4. **B2B API** (emerging): integrations for real estate agents, insurers.

## Wedge MyLife can exploit
- **Cloud-dependent.** HomeZada cannot operate offline; MyHomes uses local SQLite + drizzle.
- **Tied to financing/insurer partnerships.** HomeZada's growth depends on cross-sell; MyHomes is privacy-first with no third-party data sharing.
- **No cross-module hub.** HomeZada cannot correlate home costs with MyBudget envelopes or MyCar maintenance — MyLife ties cost events back to MyBudget cards.
- **Dated UX.** HomeZada's reputation is "comprehensive but clunky"; MyHomes ships modern Cool Obsidian design system.
- **Pricing.** $79-$149/yr standalone vs $99/yr MyLife suite covering 31 modules.

## Logo
`../../assets/logos/homezada.png` — JPEG (file has .png extension), 512x512, from iTunes CDN.

## Logo Source
URL: https://is1-ssl.mzstatic.com/image/thumb/Purple122/v4/34/cf/5e/34cf5e4b-3cd0-236e-c58b-ad23fcadf9f2/AppIcon-0-0-1x_U007emarketing-0-0-0-6-0-0-sRGB-0-0-0-GLES2_U002c0-512MB-85-220-0-0.png/512x512bb.jpg
License: Apple App Store CDN; trademark HomeZada Inc.

## Sources
- [HomeZada homepage](https://www.homezada.com/)
- [Crunchbase — HomeZada $2.4M](https://www.crunchbase.com/organization/homezada)
- [HomeZada press — $2.1M seed](https://www.homezada.com/press/homezada-closes-a-two-million-seed-round-of-investment)
- [Owler — HomeZada revenue estimate](https://www.owler.com/company/homezada)
- [PitchBook — HomeZada profile](https://pitchbook.com/profiles/company/64889-11)
