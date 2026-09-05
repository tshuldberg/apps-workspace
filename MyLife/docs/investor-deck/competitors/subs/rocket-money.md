# Rocket Money — Deep Dive (vs MySubs)

**Module:** subs
**Tier:** direct (category leader in sub-cancellation)
**Founded:** 2015 (as Truebill), renamed Rocket Money 2022
**HQ:** Silver Spring, MD
**Status:** subsidiary (Rocket Companies, NYSE: RKT, acquired Dec 2021)

## One-line
The dominant US "save money by cancelling subscriptions" app — acquired by Rocket Companies for $1.275B in 2021, now 5M+ members with bill negotiation, budget, and net-worth tracking bolted on.

## Product
- Bank-linked subscription detection (aggregates via Plaid / Yodlee)
- One-tap subscription cancellation concierge (premium)
- Bill negotiation service (take ~40% of savings)
- Budget, net-worth, credit-score tracking
- Smart savings (auto-move funds to FDIC-insured savings)
- **Platforms:** iOS, Android, Web
- **Pricing:** Free tier (limited); Premium "pay what you want" $6-$14/mo
- **Distinguishing UX:** "we found X subscriptions you forgot about" hook drives installs; concierge cancellation is magical

## Financials (public-source only)
| Year | Revenue | ARR | Valuation | Source |
|------|---------|-----|-----------|--------|
| 2023 | ~$60M est. | ~$60M | $1.275B (acquisition, 2021) | MyLife baseline, Rocket 10-K disclosures |
| 2024 | ~$75M est. | ~$75M | N/A (subsidiary) | Rocket 10-K 2024 "Personal Finance" segment |
| 2025 | ~$90M est. | ~$90M | N/A | Estimate based on subscriber growth |

**Revenue mix:** ~55% Premium subscriptions ($6-14/mo × members), ~30% bill negotiation savings share (40% of saved amount), ~15% Smart Savings + lending/refi cross-sell to parent Rocket Mortgage.
**Profit / burn:** parent Rocket Cos. profitable overall; Rocket Money specifically not broken out but believed to be near breakeven given scale.
**Runway:** N/A (parent).

## Cap Table (best public reconstruction)
| Round | Date | Amount | Lead | Post-money | Ownership notes |
|-------|------|--------|------|------------|-----------------|
| Seed | 2015 | $1.5M | Social Leverage, angels | ~$5M | As Truebill, founders Haroon + Yahya Mokhtarzada + Idris |
| Series A | 2017 | $5M | Bessemer Venture Partners | ~$25M | |
| Series B | 2019 | $17M | Eldridge Industries | ~$75M | |
| Series C | Mar 2021 | $45M | Accel | ~$500M est. | Growth round |
| Series D | Oct 2021 | $45M | Accel (extension) | $1B est. | Unicorn |
| Acquisition | Dec 2021 | $1.275B cash | Rocket Companies | N/A | All-cash, Truebill became Rocket Money |

Notes: Founders Haroon Mokhtarzada (CEO), Yahya Mokhtarzada, Idris Mokhtarzada exited with substantial liquidity. Investors (Accel, Bessemer, Eldridge, Social Leverage) returned 8-10x. Post-acquisition, operates as Rocket Personal Finance segment.
Sources: Rocket Cos. 8-K Dec 2021, Crunchbase, TechCrunch acquisition coverage, WSJ.

## Funding History (round by round)
| Year | Stage | Amount | Lead investor | Other investors | Post-money valuation | Source |
|------|-------|--------|---------------|-----------------|---------------------|--------|
| 2015 | Seed | $1.5M | Social Leverage | angels | ~$5M | Crunchbase |
| 2017 | Series A | $5M | Bessemer Venture Partners | Social Leverage | ~$25M | TechCrunch |
| 2019 | Series B | $17M | Eldridge Industries | Bessemer, Cota | ~$75M | Forbes |
| 2021 Mar | Series C | $45M | Accel | Bessemer, Eldridge | ~$500M est. | TechCrunch |
| 2021 Oct | Series D (ext) | $45M | Accel | prior | ~$1B est. | TechCrunch |
| 2021 Dec | Acquisition | $1.275B cash | Rocket Companies (NYSE: RKT) | — | $1.275B | Rocket 8-K |

Total raised pre-acquisition: ~$113M
Current stage: Acquired (Rocket Companies, Dec 2021)

## Timeline to Success
| Year | Milestone | Signal |
|------|-----------|--------|
| 2015 | Founded as Truebill by Haroon, Yahya, Idris Mokhtarzada | subscription-cancellation thesis |
| 2017 | Series A; 100K+ users cancelling subscriptions | product-market fit |
| 2019 | Expanded into budgeting + bill negotiation | feature expansion |
| 2021 Mar | Series C at ~$500M; ~$100M ARR reported | scale validation |
| 2021 Oct | Series D at ~$1B; unicorn status | growth-investor top tick |
| 2021 Dec | Acquired by Rocket Companies for $1.275B cash | category-defining exit |
| 2022 | Rebranded Truebill to Rocket Money | parent-integration |
| 2024 | 5M+ members inside Rocket ecosystem | cross-sell into mortgage |

## Acquisition / Exit
- Acquired by: Rocket Companies (NYSE: RKT)
- Date: 2021-12-20
- Price: $1.275B all-cash
- Current status inside parent: Rebranded as Rocket Money in 2022; operates as part of Rocket Personal Finance segment alongside Rocket Mortgage and Rocket Loans
- Strategic rationale: cross-sell personal-finance customers into mortgage origination; subscription-cancellation is highest-frequency financial-app surface area
- Founder outcome: Mokhtarzada brothers retained leadership post-acquisition, substantial cash liquidity; Haroon continues as GM of Rocket Money

## Users
- 5M+ members (Rocket Cos. investor presentations)
- ~2M+ premium subscribers (estimated based on revenue)
- Savings delivered: $880M+ cumulative (company marketing)
- Geography: US-only
- Conversion: ~30-40% to some paid feature (premium or bill negotiation)

## How they make money (precise)
Primary: Premium subscriptions at "choose your price" $6-14/mo — avg ~$8/mo × 2M subs = ~$190M theoretical but estimates are lower (~$75M) given free-tier retention and churn. Secondary: bill negotiation commission at 40% of saved amount (one-time per bill, $30-200 per success). Tertiary: lead-gen into Rocket Mortgage refinancing — single-largest strategic value to parent. Quaternary: Smart Savings with yield take-rate.

## Wedge MyLife can exploit
- **Bank credential risk:** Rocket Money requires Plaid-linked bank auth — a significant privacy and security surface. MyLife subs is manual-entry by default.
- **Data harvesting by parent:** Rocket's broader data moat includes mortgage intent, credit behavior, spending. MyLife never cross-sells or routes data to a lender.
- **Cancellation concierge can mishandle:** user complaints about missed cancellations exist. MyLife doesn't cancel — it reminds you to cancel before renewal.
- **US-only:** Rocket Money is limited by US banking APIs. MyLife works globally.
- **Bundle math:** Rocket Money Premium at $96-168/yr vs MyLife suite at ~$100/yr gives subs tracker + 29 other modules.
- **Parent-company strategic conflict:** Rocket Money exists to feed Rocket Mortgage leads; product roadmap shaped by that. MyLife subs has no lending conflict.

## Logo
`../assets/logos/rocket-money.png` — 512x512, sourced from App Store (fair-use editorial).

## Logo Source
- URL: https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/49/75/c8/4975c87d-f4f1-c4b0-007d-e20fb13dcc7f/AppIcon-0-0-1x_U007ephone-0-1-85-220.png/512x512bb.jpg
- License: Apple App Store marketing artwork, editorial / comparative use.

## Sources
- https://www.rocketmoney.com/
- https://ir.rocketcompanies.com/financials/sec-filings
- https://techcrunch.com/2021/12/21/truebill-acquisition-rocket-companies-1-27-billion/
- https://www.crunchbase.com/organization/truebill
- MyLife baseline: docs/business-plan/competitor-financials-2024-2026.md §29
