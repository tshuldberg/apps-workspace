# Cash App — Deep Dive (vs MyPay)

**Module:** payments
**Tier:** direct (US P2P + banking wedge)
**Founded:** 2013 (launched as Square Cash)
**HQ:** San Francisco, CA, USA (parent: Block, Inc. — NYSE: XYZ)
**Status:** public subsidiary (Block, Inc.)

## One-line
The US's most profitable consumer fintech wedge: free P2P that converted into bank + brokerage + BNPL + bitcoin rails, built for the unbanked and underbanked under the Block umbrella.

## Product
- Instant P2P to $Cashtag; request, pay, split
- Cash Card (prepaid Visa debit) with Boosts (merchant cashback)
- Cash App Savings (up to 4.50% APY) + Cash App Banking partner-backed DDA
- Direct deposit (paychecks 2 days early)
- Bitcoin buy/sell/withdraw; stock investing (fractional shares); Afterpay BNPL integration
- Cash App Taxes (free filing)
- Platforms: iOS, Android
- Pricing: free P2P (instant transfer fee 0.5-1.75%); no account minimum
- Distinguishing UX choice: $Cashtag as a public-facing payment handle (social, shareable, meme-friendly)

## Financials (public-source only)
| Year | Revenue | Gross Profit | Valuation | Source |
|------|---------|--------------|-----------|--------|
| 2023 | $14.7B | ~$4.6B | part of Block ~$40B market cap | Block 10-K 2023 |
| 2024 | $16.25B (+13.2% YoY) | $5.23B | Block ~$40-50B | Block 10-K 2024 |
| 2025 | ~$18.5B est. | ~$5.6B est. (Q1+Q2 run-rate) | Block ~$45B | CNBC (May 2025), Payments Dive |

**Revenue mix:** transaction-based (inflows from Cash Card + instant transfer fees) ~55%, bitcoin revenue pass-through ~30%, Cash for Business merchant fees ~10%, other (savings NII, Afterpay) ~5%.
**Profit / burn:** profitable at gross-profit level; parent Block profitable overall.
**Runway:** N/A (Block has $12B+ cash).

## Cap Table (best public reconstruction)
| Round | Date | Amount | Lead | Post-money | Ownership notes |
|-------|------|--------|------|------------|-----------------|
| Incubated inside Square | 2013 | — | — | — | Launched as Square Cash by Block (formerly Square) |
| Block IPO | Nov 2015 | IPO proceeds | Goldman + Morgan Stanley | ~$3B at IPO | NYSE: SQ (renamed XYZ in 2024) |
| — | ongoing | — | — | $40-50B market cap (2024-2025) | Public; Jack Dorsey remains significant insider + chairman |

Insiders: Jack Dorsey (founder, chairman), Amrita Ahuja (CFO). Major holders: Vanguard, BlackRock, T. Rowe Price.
Sources: Block 10-K filings, SEC EDGAR.

## Funding History (round by round)
| Year | Stage | Amount | Lead investor | Other investors | Post-money valuation | Source |
|------|-------|--------|---------------|-----------------|---------------------|--------|
| 2013 | Internal launch | — | Block (fka Square) | — | — | Block press |
| 2015 | IPO of parent Block | ~$243M primary | Goldman, Morgan Stanley | — | ~$3B at IPO | S-1 filing |
| 2018 | Parent secondary | — | public market | — | $40B+ peak | SEC EDGAR |
| 2022 | Afterpay acquisition (tuck-in) | $29B stock | Block | — | — | Block 8-K |

Total raised: all-equity launched inside Block; parent Block market cap ~$45B (2025)
Current stage: Public (Block, Inc., NYSE: XYZ — ticker renamed from SQ in 2024)

## Timeline to Success
| Year | Milestone | Signal |
|------|-----------|--------|
| 2013 | Launched as Square Cash; email-first P2P | initial product |
| 2015 | Rebranded to Cash App; $Cashtag introduced | viral handle system |
| 2017 | Added Bitcoin buy/sell | crypto wedge |
| 2018 | Cash Card (prepaid Visa debit) launched | interchange revenue begins |
| 2020 | Crossed 30M MAU during pandemic; stock investing launched | breakout year |
| 2021 | 44M MAU; became Block's largest gross profit line | peak growth |
| 2022 | Afterpay acquired ($29B stock) and integrated into Cash App | BNPL vertical |
| 2024 | Block ticker renamed SQ -> XYZ; 57M MAU plateau | maturation |
| 2025 | Revenue $18.5B est., MAU flat, Venmo closing gap | growth stall |

## Acquisition / Exit
- Not acquired: subsidiary of Block, Inc. (NYSE: XYZ), which is public since Nov 2015.
- Parent public since: 2015-11 IPO at $9/share
- Current status: core Block business unit; most valuable segment by gross profit since 2021
- Strategic rationale: grew organically inside Block as P2P complement to Square seller tools; Jack Dorsey repeatedly positioned it as Block's consumer wedge
- Founder outcome: Jack Dorsey still Block chairman (stepped down as CEO of Twitter/X, retained Block); Cash App lead Brian Grassadonia long-tenured

## Users
- MAU: 57M (Q1 2025, plateaued after years of growth)
- DAU: ~24M est.
- Cash Card monthly actives: ~25M
- Geography: 95%+ US; UK partial launch; no meaningful EU footprint
- Conversion: ~45% of MAUs use the Cash Card (a genuinely strong attach rate)

## How they make money (precise)
1. **Cash Card interchange** (Visa debit): ~1.1-1.5% on each swipe, biggest single line; 50%+ of gross profit.
2. **Instant deposit fees** (0.5-1.75% to move balance to bank in seconds).
3. **Bitcoin spread** (pass-through revenue, thin margin on $9B+ BTC volume).
4. **Cash for Business**: 2.75% fee on incoming payments for merchants.
5. **Afterpay BNPL** (acquired $29B deal, 2022): merchant fees.
6. **Savings NII + card-issuing float**: growing contribution.

Unit economics: Cash App gross margin ~32% (low because bitcoin inflates revenue). Banking-normalized margin 50%+.

## Wedge MyLife can exploit
- **Ads + bitcoin-dependent monetization:** Cash App's momentum slowdown (Q2 2025 CNBC) exposes dependence on card swipes. MyPay's disclosure-first FSM architecture is for a different audience who wants bank-grade controls, not meme-finance.
- **US-only:** Cash App has negligible EU presence. MyPay (designed dual-rail Unit + stablecoin per mypay_design_mission_control) can launch globally.
- **No suite integration:** Cash App sits alone; the app's only hooks are Bitcoin and investing. MyPay ties into MyBudget envelopes, MyMarket escrow, MySubs cancellation.
- **Privacy gap:** $Cashtag is public and searchable. MyPay disclosure schema emphasizes privacy-first UX.
- **Brand-safety concerns:** CashApp scam headlines are ongoing. MyPay's finite-state-machine + idempotency + ledger + reconciliation + replay architecture is positioned as bank-grade from day one.

## Logo
`../../assets/logos/cash-app.png` — Apple App Store icon, 512x512, converted PNG.

## Logo Source
- URL: iTunes Search API lookup (id=711923939) artworkUrl512
- License: trademark owner's app-store icon; used for identification in competitor analysis.

## Sources
- https://www.businessofapps.com/data/cash-app-statistics/
- https://www.cnbc.com/2025/05/01/venmo-gaining-ground-in-payments-as-cash-app-struggles.html
- https://www.paymentsdive.com/news/cash-app-profits-disappoint/747633/
- Block Inc. Form 10-K for fiscal years 2023, 2024 (SEC EDGAR)
