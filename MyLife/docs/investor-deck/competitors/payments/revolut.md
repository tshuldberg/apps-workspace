# Revolut — Deep Dive (vs MyPay)

**Module:** payments
**Tier:** direct (global neobank + multi-rail wallet)
**Founded:** 2015
**HQ:** London, UK
**Status:** private (growth-stage, profitable, IPO rumored)

## One-line
The global super-app neobank: multi-currency accounts, FX at interbank, stocks, crypto, savings, BNPL, and travel — the closest blueprint to MyPay's "wallet + everything" thesis, except as a standalone bank rather than a suite module.

## Product
- Multi-currency accounts (30+ currencies), interbank FX under EUR 1,000/mo on free plan
- Debit card (Visa/MC), virtual cards, disposable cards, Apple/Google Pay
- Savings accounts (up to 4.25% EUR), Pockets (sub-wallets), Joint accounts
- Stocks (fractional), crypto (60+ coins), commodities, ETFs
- Travel (eSIMs, lounges, travel insurance, stays)
- Revolut Business + merchant acquiring
- Revolut X (crypto exchange), Revolut Pay (checkout)
- Platforms: iOS, Android, Web
- Pricing: Free / Plus $3.99/mo / Premium $9.99/mo / Metal $14.99/mo / Ultra $45/mo
- Distinguishing UX choice: one app replaces 8 — bank + FX + stocks + crypto + travel + business

## Financials (public-source only)
| Year | Revenue | Profit (PBT) | Valuation | Source |
|------|---------|--------------|-----------|--------|
| 2023 | $2.2B (GBP 1.8B) | $545M (GBP 438M) | $33B (secondary, Aug 2024) | Revolut Annual Report 2023 |
| 2024 | $4.0B (+72% YoY) | $1.4B (+149% YoY) | $45B (Aug 2024 tender) | Revolut Annual Report 2024 |
| 2025 | $6.0B (+46% YoY) | $2.3B net | $75B (Nov 2025 share sale) | Revolut press release Feb 2026 |

**Revenue mix:** card & interchange ~35%, FX ~15%, wealth (stocks, crypto, commodities) ~20%, subscriptions (Plus/Premium/Metal/Ultra) ~15%, Business ~15%.
**Profit / burn:** deeply profitable since 2023; net profit $1.7B in 2025.
**Runway:** N/A (profitable, $6B revenue).

## Cap Table (best public reconstruction)
| Round | Date | Amount | Lead | Post-money | Ownership notes |
|-------|------|--------|------|------------|-----------------|
| Seed | 2015 | $2.3M | Balderton, Index, Seedcamp | ~$15M | Nik Storonsky + Vlad Yatsenko |
| Series A | 2017 | $66M | Index | ~$300M | |
| Series B | 2018 | $250M | DST Global | $1.7B | Unicorn |
| Series C | 2020 | $500M | TCV | $5.5B | |
| Series D | 2021 | $800M | SoftBank + Tiger Global | $33B | Peak ZIRP |
| Secondary tender | Aug 2024 | secondary | Coatue, D1, Tiger | $45B | Employee liquidity |
| Secondary tender | Nov 2025 | secondary | Coatue, Greenoaks, Dragoneer, Fidelity, NVentures | $75B | Highest European fintech valuation |

Insiders: Nik Storonsky (CEO) ~20%+ est., Vlad Yatsenko (co-founder) significant. Institutional: SoftBank, Tiger Global, Index, DST, TCV, Coatue, Greenoaks, Dragoneer, Fidelity, NVIDIA NVentures.
Sources: Revolut website, TechCrunch Nov 2025, Revolut Annual Report 2024.

## Funding History (round by round)
| Year | Stage | Amount | Lead investor | Other investors | Post-money valuation | Source |
|------|-------|--------|---------------|-----------------|---------------------|--------|
| 2015 | Seed | $2.3M | Balderton, Index, Seedcamp | Venrex, Point Nine | ~$15M | Crunchbase |
| 2017 | Series A | $10M (first close) + $66M B | Index Ventures | Balderton | ~$300M | TechCrunch |
| 2018 | Series C | $250M | DST Global | Index | $1.7B | TechCrunch (first UK fintech unicorn) |
| 2020 | Series D | $500M | TCV | — | $5.5B | Revolut press |
| 2021 | Series E | $800M | SoftBank + Tiger Global | Ribbit, TSG | $33B | TechCrunch |
| 2024 | Secondary tender | undisclosed | Coatue, D1, Tiger Global | — | $45B | FT / TechCrunch |
| 2025 | Secondary tender | undisclosed | Coatue, Greenoaks, Dragoneer, Fidelity, NVIDIA NVentures | — | $75B | TechCrunch Nov 2025 |

Total raised: ~$1.6B primary (plus multi-billion secondary rounds)
Current stage: Late-stage private; full UK bank license granted 2024; IPO widely rumored 2026-2027

## Timeline to Success
| Year | Milestone | Signal |
|------|-----------|--------|
| 2015 | Founded in London by Nik Storonsky (ex-Lehman, Credit Suisse) and Vlad Yatsenko (ex-Deutsche Bank) | fintech veterans |
| 2017 | Crossed 1M customers; Series A at $300M | product-market fit |
| 2018 | Became UK's first fintech unicorn at $1.7B | category leader |
| 2021 | SoftBank/Tiger Series E at $33B; peak ZIRP valuation | Europe's most valuable fintech |
| 2023 | First profitable year ($545M PBT on $2.2B revenue) | unit economics validated |
| 2024 | Granted full UK banking license (after 3-year wait); revenue doubled to $4B | regulatory moat |
| 2025 | Revenue $6B, profit $2.3B, valuation $75B | largest European fintech by valuation |
| 2026 | 65M+ customers globally; IPO preparations reported | pre-IPO phase |

## Acquisition / Exit
Independent as of 2026-04. Most recent round: Nov 2025 secondary tender at $75B. No acquisition talks disclosed; CEO Nik Storonsky has publicly committed to IPO as end-state (targeting US listing per FT reporting). Full UK bank license (2024) makes acquisition harder regulatorily.

## Users
- Customers: 65M+ globally (2025)
- Geography: UK ~25%, EU ~45%, US ~5%, rest of world ~25%
- Business customers: 1M+ (Revolut Business $1B annualized revenue 2025)
- Paying (Plus+) subs: ~7M+ est. (10%+ attach rate)

## How they make money (precise)
1. **Card interchange** (Visa/Mastercard): ~0.2% EU intra, ~1.2% cross-border; largest single line.
2. **FX spread** above free allowance; FX subscription tiers unlock more.
3. **Wealth** (equities ~0.25% commission above free tier, crypto spread, commodities).
4. **Subscription tiers** ($4-45/mo): meaningful share of MAU pays.
5. **Business** (Business plans $0-1050/mo + acquiring fees).
6. **Lending** (personal loans, BNPL, mortgages in select markets).

Unit economics: revenue per customer ~$92 (2025, up from $40 in 2023). Take-rate discipline + subscription attach = bank-grade margins at fintech scale.

## Wedge MyLife can exploit
- **Regulated-bank seriousness:** Revolut is a full bank in Lithuania + UK (2024) — moated, but slow. MyPay can remain wallet-first across multiple BaaS partners without balance-sheet exposure.
- **Suite-scale vs bank-scale:** Revolut charges $4-45/mo for the app; MyLife's $99/yr suite includes MyPay alongside 29 other modules.
- **No consumer-life integration:** Revolut has Pockets but not MyBudget envelopes, MyMarket escrow, MyPets expense categorization, MySubs cancellation, or MyTravel trip planning. MyPay's cross-module data is the moat.
- **Identity surface:** Revolut requires identity (KYC for bank-tier). MyPay's provider-factory means progressive KYC based on tier needed.
- **Regional focus:** Revolut is UK/EU first; US remains sub-scale. MyPay can pick its launch rail per region.

## Logo
`../../assets/logos/revolut.png` — Apple App Store icon, 512x512, converted PNG.

## Logo Source
- URL: iTunes Search API lookup (id=932493382) artworkUrl512
- License: trademark owner's app-store icon; used for identification in competitor analysis.

## Sources
- https://www.revolut.com/en-US/annual-report/2024/
- https://techcrunch.com/2025/11/24/revolut-hits-75b-valuation-in-new-capital-raise/
- https://www.fintechfutures.com/digital-banking/revolut-scores-1.4bn-profit-over-2024-revenue-jumps-to-4bn
- https://www.revolut.com/en-US/news/revolut_reports_record_profit_of_2_3bn_for_2025_as_revenue_surges_to_6bn/
