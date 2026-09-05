# Welltory — Deep Dive (vs MyHealth)

**Module:** health
**Tier:** direct (HRV-led wellness tracker)
**Founded:** 2016
**HQ:** San Francisco, CA
**Status:** private (VC + debt-funded; no Y Combinator involvement)

## One-line
HRV-first health app that fuses 1,000+ wearable signals into a stress/energy score, now pivoting to an AI health companion.

## Product
- HRV measurement via phone camera (PPG) + wearable sync
- Stress + energy score; correlation with sleep, activity, mood, weather
- 1,000+ device integrations; Harvard Medical research partnerships
- AI health companion (launched 2024)
- Pricing: free trial; Premium ~$9.99/mo or ~$69.99/yr (varies by geo)
- Platforms: iOS, Android, Apple Watch

## Financials (public-source only)
| Year | Revenue | ARR | Valuation | Source |
|------|---------|-----|-----------|--------|
| 2023 | ~$14M | N/D | N/D | thevertical.la founder interview |
| 2024 | ~$21M est. (70% YoY growth) | ~$21M | N/D | Kona Equity, Deloitte Fast 500 #202 |
| 2025 | N/D (growth continuing) | N/D | N/D | Athletech News |

**Revenue mix:** subscriptions ~95%, B2B wellness partnerships ~5% (estimate based on Harvard/research tie-ups).
**Profit / burn:** unknown; took $2M debt Sep 2024 from Braavo Capital suggesting growth investment.
**Runway:** $2M credit facility + prior equity — 12-24 months of runway at current burn.

## Cap Table (best public reconstruction)
| Round | Date | Amount | Lead | Post-money | Ownership notes |
|-------|------|--------|------|------------|-----------------|
| Seed | 2017 | $1M | undisclosed | N/D | product-market fit |
| Series A | 2020 | ~$3M | undisclosed | N/D | wellness expansion |
| Growth equity | pre-2024 | topped up total to ~$14.4M | N/D | N/D | Crunchbase total |
| Debt (Braavo) | Sep 2024 | $2M line | Braavo Capital | N/A | AI companion launch |

Notes: Founders Pavel Pravdin, Jane Smorodnikova. Total raised ~$14.4M equity + $2M debt. No single named institutional lead in public databases. Limited VC transparency.
Sources: Crunchbase, PitchBook, Deloitte Technology Fast 500, HITConsultant.

## Funding History (round by round)
| Year | Stage | Amount | Lead investor | Other investors | Post-money valuation | Source |
|------|-------|--------|---------------|-----------------|---------------------|--------|
| 2017 | Seed | $1M | undisclosed | angels | N/D | Crunchbase |
| 2020 | Series A | ~$3M | undisclosed | N/D | N/D | PitchBook |
| pre-2024 | Growth equity | top-up to ~$14.4M total | N/D | — | N/D | Crunchbase total |
| 2024 Sep | Debt facility | $2M | Braavo Capital | — | N/A | HITConsultant |

Total raised: ~$14.4M equity + $2M debt
Current stage: Series A / Growth (2024 debt)

## Timeline to Success
| Year | Milestone | Signal |
|------|-----------|--------|
| 2016 | Founded by Pavel Pravdin + Jane Smorodnikova | HRV-wellness thesis |
| 2017 | Seed round; iOS launch using iPhone camera HRV | novel biometric approach |
| 2019 | Deloitte Technology Fast 500 | rapid-growth validation |
| 2020 | Series A + pandemic-era wellness tailwind | growth acceleration |
| 2022 | 5M+ downloads; Apple Watch integration | platform expansion |
| 2024 | Braavo debt facility for AI companion launch | AI-wellness pivot |
| 2026 | Estimated $10-15M ARR | mid-stage health/wellness app |

## Acquisition / Exit
Independent as of 2026-04. Most recent round: $2M Braavo debt (Sep 2024). No known acquisition talks in public record; potential strategic acquirers include wearable companies (Fitbit/Google, Oura, Garmin), wellness platforms (Calm, Headspace), or HRV-focused competitors (WHOOP).

## Users
- 10M users on wellness app (2024)
- 16M users across 24 countries (total cumulative)
- 4.8★ app rating
- MAU/DAU: N/D

## How they make money (precise)
1. **Welltory Premium subscription** (~$70-100/yr): primary revenue. Unlocks advanced HRV, full correlation engine, AI companion.
2. **In-app upsells / one-time features**: secondary.
3. **B2B research/wellness partnerships** (Harvard, corporate wellness): small share, strategic for credibility.

## Wedge MyLife can exploit
- **Single-signal framing (HRV).** Welltory lives or dies on camera HRV accuracy; MyHealth fuses meds, fast, cycle, sleep, vitals, mind into a 0-100 composite.
- **No doctor-report generator.** Welltory exports charts, not a curated markdown for a clinician. MyHealth ships `src/reports/doctor-report.ts`.
- **No sleep-stage + smart alarm + snore detection stack.** Welltory does not replace AutoSleep/SnoreLab; MyHealth does.
- **Cloud-only.** Welltory data rides their backend; MyHealth's SQLite is on device.
- **Single-app pricing.** Welltory is $70+/yr standalone; MyLife suite is $99/yr for 31 modules.

## Logo
`../../assets/logos/welltory.png` — JPEG (file has .png extension), 512x512, from iTunes CDN.

## Logo Source
URL: https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/77/bd/06/77bd06c6-35bf-06cb-3397-a2b3aeaef11c/AppIcon_free-0-0-1x_U007ephone-0-1-0-85-220.png/512x512bb.jpg
License: Apple App Store CDN; trademark Welltory Inc.

## Sources
- [thevertical.la — "$14M revenue after VC rejection"](https://thevertical.la/sales/bootstrappers-welltory-reached-14-mln-in-revenue/)
- [Athletech News — Welltory Deloitte Fast 500 2024](https://athletechnews.com/welltory-named-to-deloittes-2024-technology-fast-500/)
- [Kona Equity — Welltory $21M](https://www.konaequity.com/company/welltory-4869856445/)
- [Yahoo Finance — Welltory $2M credit line](https://finance.yahoo.com/news/welltory-secures-2-million-credit-060000270.html)
- [Crunchbase — Welltory](https://www.crunchbase.com/organization/welltory)
