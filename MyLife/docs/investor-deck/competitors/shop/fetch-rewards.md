# Fetch Rewards — Deep Dive (vs MyShop)

**Module:** shop
**Tier:** direct (receipt capture + purchase journaling overlap)
**Founded:** 2013
**HQ:** Madison, WI
**Status:** private (late-stage VC-backed)

## One-line
America's largest receipt-scanning rewards app — 18M+ MAU scan every grocery/retail receipt to earn points, while Fetch monetizes the receipt data as CPG marketing intelligence.

## Product
- Scan any receipt (retail, grocery, restaurant) with phone camera
- Earn "Fetch Points" redeemable for gift cards
- Partner-brand bonus offers (brands pay to appear)
- Play, social, referral mechanics for engagement
- **Platforms:** iOS, Android
- **Pricing:** Free
- **Distinguishing UX:** fastest OCR + fastest redemption in receipt category

## Financials (public-source only)
| Year | Revenue | ARR | Valuation | Source |
|------|---------|-----|-----------|--------|
| 2023 | ~$200M est. | ~$200M | $2.5B (Nov 2021) | Crunchbase, Forbes |
| 2024 | ~$250M est. | ~$250M | ~$2.5B (flat since 2021) | Industry est. |
| 2025 | ~$300M est. | ~$300M | N/D (no new round) | Forbes / Bloomberg |

**Revenue mix:** ~90% brand-partner fees (brands pay Fetch to surface offers, target users, access receipt panel data), ~10% affiliate and ad-adjacent.
**Profit / burn:** burn rate reduced post-2022; reported "path to profitability" but not yet profitable per CEO interviews.
**Runway:** est. 18-24 months at 2024 burn given 2022 raise size.

## Cap Table (best public reconstruction)
| Round | Date | Amount | Lead | Post-money | Ownership notes |
|-------|------|--------|------|------------|-----------------|
| Seed | 2014 | $1M | Chicago angels | N/D | Founder Wes Schroll |
| Series A | 2017 | $10M | Greycroft | ~$40M | |
| Series B | 2019 | $30M | Greycroft | ~$150M | |
| Series C | 2021 | $210M | SoftBank Vision Fund | ~$1B | Unicorn round |
| Series D | Nov 2021 | $240M | SoftBank + existing | $2.5B | Growth round at peak |
| Debt/Line | 2023 | undisclosed | JPMorgan | N/A | Operational debt |

Notes: Founder Wes Schroll retains CEO role. SoftBank Vision Fund is largest institutional holder. Greycroft, Univision, and CPG strategic partners on cap table. ESOP estimated 15-18% post-Series D. Total equity raised ~$500M.
Sources: Crunchbase, Forbes SoftBank round coverage, WSJ Nov 2021 story, TechCrunch.

## Funding History (round by round)
| Year | Stage | Amount | Lead investor | Other investors | Post-money valuation | Source |
|------|-------|--------|---------------|-----------------|---------------------|--------|
| 2014 | Seed | $1M | Chicago angels | — | N/D | Crunchbase |
| 2017 | Series A | $10M | Greycroft | angels | ~$40M | Crunchbase |
| 2019 | Series B | $30M | Greycroft | ICONIQ | ~$150M | Crunchbase |
| 2021 | Series C | $210M | SoftBank Vision Fund | Greycroft, Univision | ~$1B | Forbes |
| 2021 Nov | Series D | $240M | SoftBank | existing + CPG partners | $2.5B | Forbes |
| 2023 | Debt/line | undisclosed | JPMorgan | — | N/A | press |

Total raised: ~$491M equity
Current stage: Series D ($2.5B flat valuation since Nov 2021; down-round risk)

## Timeline to Success
| Year | Milestone | Signal |
|------|-----------|--------|
| 2013 | Founded by Wes Schroll at Univ of Wisconsin-Madison | receipt-rewards student project |
| 2017 | Series A; "Fetch Points" redemption launched | monetization validation |
| 2020 | 7M+ users during pandemic grocery surge | viral moment |
| 2021 | SoftBank Series C + D ($450M combined) at $2.5B | unicorn status |
| 2022 | 17M MAU; industry "CPG panel" positioning | category leader |
| 2023 | Path-to-profitability cost cuts; JPM debt line | efficiency pivot |
| 2024 | 18M MAU, ~$250M revenue est. | scaled CPG-marketing platform |
| 2026 | No new primary round since Nov 2021 | valuation-overhang risk |

## Acquisition / Exit
Independent as of 2026-04. Most recent round: Series D Nov 2021 at $2.5B. No known acquisition talks in public record. At current revenue (~$300M) with $491M raised and SoftBank on cap table, acquisition interest plausible from CPG-data incumbents (NielsenIQ, IRI/Circana), retailer loyalty operators (Kroger, Walmart), or rewards-app rivals (Ibotta went public in 2024 at ~$2.5B).

## Users
- 18M+ MAU (2024 company statement)
- 30M+ total registered users
- ~$10B annual receipt volume scanned
- Geography: US-only
- Conversion: N/A (all users free; monetization is advertiser-paid)

## How they make money (precise)
Primary: CPG brands (P&G, Unilever, Kraft Heinz) pay Fetch for (a) targeted offers surfaced to users based on receipt history, (b) receipt-panel analytics (what brand/SKUs are selling in which zip codes). Deal structure: cost-per-receipt-scan of targeted SKU, or flat monthly panel fees. Secondary: retailer partnerships (Walmart, Kroger) for promoted placements. Fetch is essentially Nielsen/IRI but faster + sampled via consumers directly.

## Wedge MyLife can exploit
- **User is the product:** Fetch monetizes by selling your shopping data to the brands you buy. MyLife keeps receipts local, no data sale.
- **Gamified manipulation:** Fetch uses variable rewards and partner-offer surfacing to drive purchases users wouldn't otherwise make. MyLife's purchase journal is for reflection, not nudging.
- **US-only:** Fetch is locked to US receipts. MyLife works globally.
- **No warranty/return tracking:** Fetch only cares about the data moment of purchase. MyLife tracks warranty expiry and return windows.
- **Rewards are trivial:** Fetch users earn ~$5-20/mo in gift cards after heavy use. MyLife offers structured shopping memory worth far more than that in avoided duplicate purchases + warranty claims.

## Logo
`../assets/logos/fetch-rewards.png` — 512x512, sourced from App Store (fair-use editorial).

## Logo Source
- URL: https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/ee/ca/5c/eeca5c6e-5b22-5a61-6219-49ea65cb9e7d/AppIcon-0-0-1x_U007epad-0-0-0-1-0-0-85-220.png/512x512bb.jpg
- License: Apple App Store marketing artwork, editorial / comparative use.

## Sources
- https://www.fetch.com/
- https://www.crunchbase.com/organization/fetch-rewards
- https://www.forbes.com/sites/alexkonrad/2021/11/16/softbank-leads-240-million-fetch-rewards-round/
- https://techcrunch.com/2021/11/16/fetch-rewards-raises-240m/
- MyLife shop module scope: docs/investor-deck/modules/shop.md (note: shop is still P0 scaffold — wedge analysis is forward-looking)
