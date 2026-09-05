# Medisafe — Deep Dive (vs MyMeds)

**Module:** meds
**Tier:** direct (category leader, pharma-subsidized B2B model)
**Founded:** 2012
**HQ:** Boston, MA / Haifa, Israel
**Status:** private (Series C; ~$51.5M raised)

## One-line
The world's largest dedicated med-reminder platform, monetized via deep pharma partnerships (Sanofi, Merck) and a 2B+ doses database — consumer app free for the user but not the data subject.

## Product
- Med reminders, dose logging, refill tracking, pill identifier
- Drug interaction checker, caregiver alerts, family sync
- MedBot AI assistant (2023), clinical trial matching, conditions hub
- Pharma-branded "Just in Time Interventions" programs
- Pricing: free; Premium $4.99/mo or $39.99/yr
- Platforms: iOS, Android, Web (limited)

## Financials (public-source only)
| Year | Revenue | ARR | Valuation | Source |
|------|---------|-----|-----------|--------|
| 2023 | N/D (est. $10-15M) | N/D | N/D | pharma-deal estimates |
| 2024 | N/D (est. $15-20M) | N/D | N/D | industry reports |
| 2025 | N/D | N/D | N/D | — |

**Revenue mix:** B2B pharma partnerships ~70% (licensing, value-based adherence contracts), consumer subscriptions ~20%, anonymized data insights ~10%.
**Profit / burn:** unknown; took $30M Series C in Feb 2021 suggesting cash burn at that stage.
**Runway:** $51.5M cumulative raise; Series C 4+ years old suggests either profitability or a pending raise.

## Cap Table (best public reconstruction)
| Round | Date | Amount | Lead | Post-money | Ownership notes |
|-------|------|--------|------|------------|-----------------|
| Seed | 2013 | $1M | Lool Ventures + angels | N/D | Israeli seed |
| Series A | 2015 | $6M | Octopus Ventures | N/D | Boston relocation |
| Series B | 2017 | $14.5M | Octopus, OurCrowd | N/D | growth |
| Series C | Feb 2021 | $30M | Sanofi Ventures + ALIVE | N/D | pharma strategic lead |
| Total | — | $51.5M | — | N/D | — |

Notes: Founders Omri Shor (CEO) + Rotem Shor. Key strategic investor: Sanofi Ventures. Also Leumi Partners, Menorah Mivtachim, Consensus Business Group. ESOP not disclosed; estimated 12-18% given Israeli startup norms. Pharma partner list: Merck, Sanofi, and others.
Sources: Crunchbase, MobiHealthNews, VentureBeat, Medisafe press, PRNewswire.

## Funding History (round by round)
| Year | Stage | Amount | Lead investor | Other investors | Post-money valuation | Source |
|------|-------|--------|---------------|-----------------|---------------------|--------|
| 2013 | Seed | $1M | Lool Ventures | angels | N/D | Crunchbase |
| 2015 | Series A | $6M | Octopus Ventures | Lool | N/D | TechCrunch |
| 2017 | Series B | $14.5M | Octopus Ventures | OurCrowd | N/D | MobiHealthNews |
| 2021 Feb | Series C | $30M | Sanofi Ventures | ALIVE, Octopus, Leumi Partners | N/D | PRNewswire |

Total raised: ~$51.5M
Current stage: Series C (Feb 2021)

## Timeline to Success
| Year | Milestone | Signal |
|------|-----------|--------|
| 2012 | Founded by Omri + Rotem Shor in Israel | medication-adherence thesis |
| 2013 | Launched on iOS + Android | mobile-first |
| 2015 | Relocated HQ to Boston + Series A | US market entry |
| 2017 | Enterprise pharma partnerships (Merck) begin | B2B2C revenue |
| 2019 | 5M+ users milestone | consumer-scale validation |
| 2021 | Sanofi-led Series C; 10M+ users | strategic pharma validation |
| 2023 | 12M+ users; Medisafe Plus launched | consumer monetization expansion |
| 2026 | Estimated $40-60M ARR (pharma + consumer) | mature healthtech SaaS |

## Acquisition / Exit
Independent as of 2026-04. Most recent round: Series C Feb 2021. No known acquisition talks in public record; potential acquirers include pharma (Sanofi is already an investor), healthtech consolidators (Teladoc, Hims), or retail pharmacy players (CVS, Walgreens).

## Users
- 10M+ registered patients and caregivers
- 2B+ doses managed through the app
- 4B+ dosage behaviors in aggregated pharma database
- Geography: US primary + EU + Israel
- Conversion free→paid: N/D (marginal; B2B is the business)

## How they make money (precise)
1. **Pharma value-based contracts**: Medisafe's compensation tied to improved adherence metrics for specific drug franchises. Largest single line.
2. **Pharma licensing**: branded programs (e.g., "Take Back Your Care" for specific medications).
3. **Anonymized data insights**: dosage behavior datasets sold to pharma for market intelligence.
4. **Consumer Premium subscription**: small share ($39.99/yr).
5. **Clinical trial matching / patient services**: growing.

## Wedge MyLife can exploit
- **Pharma-subsidized economics require data sharing.** Medisafe cannot be genuinely private because its pharma deals depend on behavioral data. MyMeds is local SQLite only.
- **No vitals depth.** Medisafe tracks meds; MyMeds ships BP (AHA classification), glucose (TIR + A1c estimate), insulin (IOB), pain heatmap, CGM analytics, FODMAP, weather correlation — features Medisafe doesn't ship.
- **No cross-module correlation.** Medisafe can tell you adherence; MyMeds' `analytics/correlation.ts` correlates meds with mood, symptoms, activity.
- **No doctor report.** Medisafe exports simple CSV; MyMeds emits a curated markdown doctor/therapy report with wellness score (0-100).
- **Pricing.** $39.99/yr Medisafe Premium vs $99/yr MyLife suite covering meds + 30 other modules.
- **Note:** MyMeds does not yet ship RxNorm integration (future work per CLAUDE.md). Medisafe's drug DB is pharma-curated; MyMeds' 200+ pair interactions DB is curated but smaller — plan is to add RxNorm to close this gap.

## Logo
`../../assets/logos/medisafe.png` — JPEG (file has .png extension), 512x512, from iTunes CDN.

## Logo Source
URL: https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/4d/52/b5/4d52b532-17b1-c878-745b-c190153ecee9/AppIcon-0-0-1x_U007ephone-0-11-0-85-220.jpeg/512x512bb.jpg
License: Apple App Store CDN; trademark Medisafe Project Ltd.

## Sources
- [VentureBeat — Medisafe $30M Series C](https://venturebeat.com/business/medisafe-raises-30-million-to-promote-medication-adherence-using-ai-and-big-data)
- [Medisafe press — Sanofi-led Series C](https://www.prnewswire.com/news-releases/medisafe-secures-30m-in-series-c-funding-to-build-future-model-of-patient-support-301235234.html)
- [ALIVE VC — Medisafe Series C](https://alivevc.com/medisafe-raises-30-million-in-series-c-led-by-pharma-giant-sanofi/)
- [Crunchbase — Medisafe](https://www.crunchbase.com/organization/medisafe-project)
- [MobiHealthNews — $6M Series A](https://www.mobihealthnews.com/39650/medisafe-raises-6m-for-medication-adherence-app-relocates-to-boston)
