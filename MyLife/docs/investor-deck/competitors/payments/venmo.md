# Venmo — Deep Dive (vs MyPay)

**Module:** payments
**Tier:** direct (US social-payments leader)
**Founded:** 2009 (acquired by Braintree 2012, acquired by PayPal 2013)
**HQ:** New York, NY, USA (parent: PayPal Holdings, NASDAQ: PYPL)
**Status:** public subsidiary (PayPal)

## One-line
The default US social-payments verb ("Venmo me"); feeds, emojis, and splitting built on PayPal's bank-transfer rails, now aggressively monetizing via debit cards, Pay with Venmo, and business profiles.

## Product
- P2P with friend feed, emojis, split-the-bill, request money
- Venmo Debit Card (Mastercard) with cashback categories
- Venmo Credit Card (Synchrony Bank issuer) with 3-2-1% cashback
- Pay with Venmo at merchants (Sephora, KFC, Pizza Hut, Uber)
- Business profiles (free) + Tap to Pay for small merchants
- Crypto buy/sell (BTC, ETH, LTC, BCH)
- Teen accounts (launched 2023)
- Platforms: iOS, Android
- Pricing: free P2P from bank; 1.75% instant transfer fee; crypto spread; no monthly fee
- Distinguishing UX choice: the social feed — payments with emojis that look like Snapchat

## Financials (public-source only)
| Year | Revenue | TPV | Valuation | Source |
|------|---------|-----|-----------|--------|
| 2023 | ~$900M | ~$270B | part of PayPal ~$80B market cap | PayPal 10-K + analyst estimates |
| 2024 | ~$1.1B est. | ~$300B | PayPal ~$70B | Business of Apps, PayPal earnings |
| 2025 | ~$1.3B est. (+20% YoY) | ~$325B | PayPal ~$75B | CNBC Apr 2025, PayPal Q2 2025 commentary |

**Revenue mix:** debit card interchange ~45%, instant transfer fees ~25%, Pay with Venmo merchant fees ~15%, crypto spread ~10%, business profiles ~5% est.
**Profit / burn:** contributes positively to PayPal transaction margin.
**Runway:** N/A (PayPal subsidiary).

## Cap Table (best public reconstruction)
| Round | Date | Amount | Lead | Post-money | Ownership notes |
|-------|------|--------|------|------------|-----------------|
| Founding | 2009 | small | — | — | Andrew Kortina + Iqram Magdon-Ismail |
| Acquisition (into Braintree) | 2012 | ~$26M | Braintree | N/A | Venmo absorbed by Braintree |
| Acquisition (into PayPal) | Sep 2013 | $800M for Braintree parent | PayPal | N/A | Venmo is now a PayPal subsidiary |
| PayPal spin-off from eBay | Jul 2015 | IPO | — | ~$50B | PayPal becomes independent public co |

Insiders: None remaining (founders exited). Current owner: PayPal Holdings (NASDAQ: PYPL), ~$75B market cap.
Sources: TechCrunch, SEC EDGAR, PayPal 10-K.

## Funding History (round by round)
| Year | Stage | Amount | Lead investor | Other investors | Post-money valuation | Source |
|------|-------|--------|---------------|-----------------|---------------------|--------|
| 2009 | Seed | ~$1.2M | RRE Ventures | Betaworks, Lerer Ventures | N/D | Crunchbase |
| 2012 | Acquisition by Braintree | ~$26M | Braintree | — | N/A | TechCrunch |
| 2013 | Acquisition by PayPal (via Braintree) | $800M (Braintree) | PayPal | — | N/A | WSJ / TechCrunch |
| 2015 | PayPal spin from eBay | IPO | public market | — | ~$50B | SEC EDGAR |

Total raised as Venmo: ~$1.2M pre-Braintree
Current stage: Public subsidiary (PayPal Holdings, NASDAQ: PYPL)

## Timeline to Success
| Year | Milestone | Signal |
|------|-----------|--------|
| 2009 | Founded by Andrew Kortina and Iqram Magdon-Ismail at Penn; originally SMS-based | college-era origin story |
| 2010 | Pivoted to mobile P2P app | product-market fit emerges |
| 2012 | Acquired by Braintree for $26M | micro-exit |
| 2013 | Braintree (and Venmo) acquired by PayPal for $800M | category consolidator |
| 2015 | PayPal spun from eBay; Venmo becomes PayPal subsidiary | new parent |
| 2018 | Venmo crossed $62B TPV; debit card launched | monetization begins |
| 2019 | "Venmo" entered the dictionary as a verb | cultural milestone |
| 2020 | Pandemic boost; crossed 70M users; crypto launched 2021 | breakout |
| 2024 | Debit card MAU +40% YoY; Credit Card via Synchrony | monetization inflection |
| 2025 | Revenue $1.3B est., 95M US accounts, TPV ~$325B | closing on Cash App |

## Acquisition / Exit
- Acquired by: Braintree (Sep 2012, ~$26M), then by PayPal (Sep 2013 via Braintree, $800M deal)
- Date: 2013-09 (PayPal/Braintree close)
- Price: $800M cash (paid for Braintree parent; Venmo was a sub-asset)
- Current status inside parent: standalone brand, core PayPal consumer unit
- Strategic rationale: PayPal acquired Braintree primarily for Venmo's viral P2P growth + Braintree's developer payments stack; Venmo has since become PayPal's primary consumer growth engine
- Founder outcome: Andrew Kortina and Iqram Magdon-Ismail both exited PayPal; Kortina later founded Fin, Magdon-Ismail worked on crypto projects

## Users
- Active accounts: ~95M US (2024-2025)
- MAU: ~60-70M est.
- Debit card MAU: +40% YoY in Q1 2025
- Geography: 99%+ US (only P2P product in Venmo's home market)
- Conversion to monetized products: debit card attach rate ~30%, still expanding

## How they make money (precise)
1. **Debit card interchange** (Mastercard): ~1.3% per swipe, primary monetization engine.
2. **Instant transfer fee** (1.75% of amount, $0.25 min, $25 max) to move to bank immediately.
3. **Pay with Venmo** merchant fees (~2.9% + $0.30 per transaction).
4. **Credit card** (Synchrony-issued): interchange + revolving interest share.
5. **Crypto spread** on BTC/ETH/LTC/BCH buys/sells.

Unit economics: Venmo's revenue per active is ~$13-15/yr (well below Cash App's ~$80/yr per MAU), but PayPal's monetization push in 2024-2025 accelerated take rate growth.

## Wedge MyLife can exploit
- **Public feed privacy drama:** Venmo's feed defaults caused multiple privacy scandals (Biden/Harris Venmo accounts exposed). MyPay is private-by-default with explicit disclosure UX tone control.
- **No savings/yield:** Venmo does not pay interest. MyPay (dual-rail Unit BaaS + stablecoin in design) can layer yield or stablecoin returns.
- **US-only:** Venmo has no EU/Asia footprint. MyPay designed provider-factory supports multi-rail launches.
- **No cross-module integration:** Venmo is a wallet island. MyPay connects to MyBudget envelopes (sink money into category budgets), MyMarket (escrow), MySubs (subscription ledger), MyPets (expense categorization).
- **Bank-grade ops missing:** Venmo relies on PayPal's rails and has exposure to account freezes and dispute escalations. MyPay's FSM-backed ledger + reconciliation + replay architecture is positioned as bank-grade.

## Logo
`../../assets/logos/venmo.png` — Apple App Store icon, 512x512, converted PNG.

## Logo Source
- URL: iTunes Search API lookup (id=351727428) artworkUrl512
- License: trademark owner's app-store icon; used for identification in competitor analysis.

## Sources
- https://www.businessofapps.com/data/venmo-statistics/
- https://www.cnbc.com/2025/04/29/venmo-revenue-grows-as-paypals-monetization-push-gains-traction.html
- https://www.statista.com/statistics/763617/venmo-total-payment-volume/
- PayPal Holdings Form 10-K (SEC EDGAR)
