# Stock Market Mechanics & Fundamentals

> Reference document for TheMarlinTraders platform engineering team.
> Last updated: 2026-02-13

---

## 1. Order Types

### Basic Order Types

| Order Type | Behavior | Price Guarantee | Fill Guarantee |
|------------|----------|-----------------|----------------|
| **Market** | Executes immediately at best available price | No | Yes (in liquid markets) |
| **Limit** | Executes only at specified price or better | Yes | No |
| **Stop (Stop-Loss)** | Becomes a market order when stop price is reached | No | Yes (once triggered) |
| **Stop-Limit** | Becomes a limit order when stop price is reached | Yes | No |

- **Market Order** -- Buys at the lowest ask or sells at the highest bid. Fast execution, but subject to slippage in volatile or illiquid markets. The fill price may differ from the quoted price, especially for large orders that consume multiple levels of the order book.
- **Limit Order** -- A buy limit sits at or below the current market price; a sell limit sits at or above it. Guarantees price but not execution. Unexecuted limit orders rest in the order book as passive liquidity.
- **Stop Order** -- A sell stop below the current price triggers a market sell when breached (used as a stop-loss). A buy stop above the current price triggers a market buy (used for breakout entries). Once triggered, the order becomes a market order and is subject to slippage.
- **Stop-Limit Order** -- Combines a stop trigger with a limit constraint. When the stop price is hit, a limit order is placed at the specified limit price. Risk: in a fast-moving gap-down, the limit may never fill because the market blows through the limit price.

### Advanced Order Types

- **Trailing Stop** -- A stop order that adjusts automatically as the price moves in the trader's favor. Specified as a fixed dollar amount or percentage from the market price. The stop "trails" the highest (for longs) or lowest (for shorts) price reached. Example: a $2 trailing stop on a stock at $50 sets the initial stop at $48; if the stock rises to $55, the stop moves to $53.
- **OCO (One-Cancels-Other)** -- Two orders linked so that execution of one automatically cancels the other. Common pattern: a take-profit limit order paired with a stop-loss order. When either fills, the other is removed. Not all brokers support OCO natively.
- **Bracket Order** -- An entry order plus an attached OCO pair (take-profit + stop-loss). Creates a complete trade plan in a single submission. Example: buy 100 shares at $50, with a sell limit at $55 (profit target) and a sell stop at $47 (stop-loss).
- **Conditional / Contingent Orders** -- Orders triggered by external conditions such as another symbol's price, volume thresholds, or index levels. Broker-dependent; not standardized across platforms.

### Time-in-Force (TIF) Modifiers

| TIF Code | Name | Behavior |
|----------|------|----------|
| **DAY** | Day Order | Expires at the end of the current trading session if unfilled |
| **GTC** | Good 'Til Canceled | Remains active until filled or manually canceled (most brokers cap at 60-90 days) |
| **GTD** | Good 'Til Date | Remains active until a specified date |
| **IOC** | Immediate or Cancel | Fills as much as possible immediately; cancels any unfilled portion |
| **FOK** | Fill or Kill | Must fill entirely and immediately, or the entire order is canceled |
| **MOO** | Market on Open | Executes at the opening price of the session |
| **MOC** | Market on Close | Executes at or near the closing price of the session |
| **LOO** | Limit on Open | Limit order that participates only in the opening auction |
| **LOC** | Limit on Close | Limit order that participates only in the closing auction |

**Platform implication:** A trading platform must support at minimum DAY, GTC, and IOC for equities. Options and futures platforms typically need FOK and IOC. Supporting MOO/MOC/LOO/LOC requires integration with exchange auction mechanics.

---

## 2. Exchanges & Venues

### Major U.S. Equity Exchanges

| Exchange | Operator | Market Share (~) | Notes |
|----------|----------|-----------------|-------|
| **NYSE** | Intercontinental Exchange (ICE) | ~22% | Largest by listed companies; designated market makers (DMMs); hybrid auction + electronic |
| **NASDAQ** | Nasdaq Inc. | ~18% | Fully electronic; three tiers: Global Select, Global, Capital |
| **NYSE Arca** | ICE | ~9% | Primarily ETFs; approved for 22-hour trading (targeting late 2026 launch) |
| **Cboe BZX** (formerly BATS) | Cboe Global Markets | ~12% | Known for competitive pricing and maker-taker rebates |
| **Cboe BYX** | Cboe Global Markets | ~5% | Inverted fee model (taker-maker) |
| **Cboe EDGX** | Cboe Global Markets | ~6% | Maker-taker model |
| **Cboe EDGA** | Cboe Global Markets | ~3% | Taker-maker model |
| **IEX** | IEX Group | ~3% | "Speed bump" (350-microsecond delay) to deter latency arbitrage; no maker-taker rebates |
| **MEMX** | Members Exchange | ~4% | Founded by consortium of brokers/market makers (2020); low-cost alternative |
| **LTSE** | Long-Term Stock Exchange | <1% | Focuses on long-term value; unique listing standards |
| **NYSE American** (formerly AMEX) | ICE | ~2% | Small-cap listings; floor-based with electronic integration |
| **MIAX Pearl Equities** | Miami International Holdings | ~2% | Newer entrant with competitive pricing |

### Off-Exchange Venues

- **Dark Pools** -- Private trading venues where order information is not displayed publicly before execution. Approximately 35-45% of U.S. equity volume now trades off-exchange (dark pools + broker internalization). Major dark pools include Crossfinder (Credit Suisse), SIGMA X (Goldman Sachs), and Liquidnet (institutional block trading).
- **ECNs (Electronic Communication Networks)** -- Automated systems matching buy and sell orders. Historically separate from exchanges, many ECNs have been acquired by exchange groups (e.g., Instinet by Nasdaq, BATS becoming Cboe). ECNs display their order books publicly, unlike dark pools.
- **ATS (Alternative Trading Systems)** -- The SEC regulatory category encompassing both dark pools and ECNs. Currently 30+ registered ATS operate in U.S. equities. Regulated under SEC Rule 300-303 of Reg ATS.
- **Wholesalers / Internalizers** -- Firms like Citadel Securities and Virtu Financial that execute retail order flow internally, often providing price improvement over the NBBO. This is the destination for most retail broker order flow via payment for order flow (PFOF) arrangements.

### Order Routing

When a retail trader places an order, the broker's Smart Order Router (SOR) evaluates:
1. **NBBO compliance** -- Must execute at or better than the national best bid/offer (Reg NMS Rule 611, the Order Protection Rule)
2. **Routing table economics** -- PFOF agreements, exchange rebate schedules, internalization opportunities
3. **Execution quality metrics** -- Fill rates, speed, price improvement statistics

Brokers must disclose routing practices quarterly via **SEC Rule 606** reports, showing where orders were sent and any material relationships (PFOF, rebates). Updated Rule 605 (compliance: August 1, 2026) expands execution quality disclosures to cover large broker-dealers with 100,000+ customer accounts.

---

## 3. Market Hours

### U.S. Market Sessions

| Session | Hours (Eastern Time) | Liquidity | Notes |
|---------|---------------------|-----------|-------|
| **Pre-Market** | 4:00 AM - 9:30 AM | Low | ECN-only at most brokers; wider spreads; limited order types (usually limit only) |
| **Regular Session** | 9:30 AM - 4:00 PM | High | Full exchange participation; all order types available |
| **After-Hours** | 4:00 PM - 8:00 PM | Low | Similar constraints to pre-market; earnings reactions often occur here |

**Opening & Closing Auctions:** The first and last 10-15 minutes of regular session trading see the highest volume. NYSE and NASDAQ run formal opening/closing auction processes. The closing auction alone accounts for approximately 10-12% of daily volume, and this share has been growing.

### Extended Hours Evolution (2026)

The U.S. market is transitioning toward near-continuous trading:
- **NYSE Arca** received SEC approval for 22-hour trading: Monday-Thursday 1:30 AM - 11:30 PM ET, Friday 1:30 AM - 8:00 PM ET. Targeting late 2026 launch, pending SIP and DTCC readiness.
- **NASDAQ** filed with the SEC in January 2026 for 23-hour trading: a "day session" from 4:00 AM to 8:00 PM ET, followed by a 1-hour maintenance pause, then an "overnight session." Expected readiness Q3 2026.
- **DTCC** plans nonstop clearing capability by end of 2026 to support extended-hours settlement.
- **SIPs** flagged intent for Sunday 8:00 PM ET through Friday 8:00 PM ET operations with brief nightly maintenance windows.

### Major Global Exchange Hours

| Exchange | Local Hours | ET Equivalent | Notes |
|----------|-------------|---------------|-------|
| **Tokyo (JPX/TSE)** | 9:00 AM - 3:25 PM JST | 7:00 PM - 1:25 AM ET | Lunch break 11:30 AM - 12:30 PM JST |
| **Shanghai (SSE)** | 9:30 AM - 3:00 PM CST | 8:30 PM - 2:00 AM ET | Lunch break 11:30 AM - 1:00 PM CST |
| **Hong Kong (HKEX)** | 9:30 AM - 4:00 PM HKT | 9:30 PM - 4:00 AM ET | Lunch break 12:00 PM - 1:00 PM HKT |
| **London (LSE)** | 8:00 AM - 4:30 PM GMT | 3:00 AM - 11:30 AM ET | Busiest global-US overlap: 9:30 AM - 11:30 AM ET |
| **Frankfurt (Xetra)** | 9:00 AM - 5:30 PM CET | 3:00 AM - 11:30 AM ET | |
| **Euronext Paris** | 9:00 AM - 5:30 PM CET | 3:00 AM - 11:30 AM ET | |
| **Sydney (ASX)** | 10:00 AM - 4:00 PM AEDT | 6:00 PM - 12:00 AM ET | |

**Key overlap:** The London-New York overlap (9:30 AM - 11:30 AM ET) is the highest-volume period globally for equities and forex, accounting for approximately 70% of daily FX volume.

**Forex market:** Effectively 24/5 -- opens Sunday 5:00 PM ET (Sydney session) and closes Friday 5:00 PM ET (New York close). No centralized exchange; trades via interbank network.

---

## 4. Market Microstructure

### The Order Book

The order book (also called the limit order book or LOB) is the list of all resting buy and sell limit orders for a security at a given venue, organized by price and time priority.

```
--- Ask Side (Sellers) ---
$50.10  x  200 shares    (3 orders)
$50.09  x  500 shares    (5 orders)
$50.08  x  1,200 shares  (8 orders)   <-- Best Ask (inside ask)
------- SPREAD: $0.02 -------
$50.06  x  800 shares    (6 orders)   <-- Best Bid (inside bid)
$50.05  x  400 shares    (4 orders)
$50.04  x  150 shares    (2 orders)
--- Bid Side (Buyers) ---
```

### Bid-Ask Spread

The spread is the difference between the best ask and best bid. For the example above: $50.08 - $50.06 = $0.02 spread. The spread represents the immediate cost of a round-trip trade (buy then sell, or vice versa). Tight spreads indicate liquid markets; wide spreads indicate illiquidity or uncertainty.

Typical spreads:
- **Large-cap stocks (AAPL, MSFT):** $0.01 (the minimum tick size, or 1 penny)
- **Mid-cap stocks:** $0.01 - $0.05
- **Small-cap / illiquid stocks:** $0.05 - $0.50+
- **Options:** Highly variable; $0.01 - $0.10 for penny-pilot names, $0.05 - $0.25+ for others

### Market Data Levels

| Level | Content | Use Case |
|-------|---------|----------|
| **Level 1 (L1)** | Best bid, best ask, last trade price, volume | Basic quotes; sufficient for most retail traders |
| **Level 2 (L2)** | Full depth of book: all bid/ask prices and sizes from a single exchange, typically top 5-30 levels | Active trading; seeing where large orders sit |
| **Level 3 (L3)** | Full book + ability to enter/modify quotes | Market makers only; not available to retail |

**Time & Sales (The Tape):** A real-time log of every executed trade showing timestamp, price, size, and the exchange where it executed. Traders use this to gauge buying vs. selling pressure. Trades at the ask indicate buying aggression; trades at the bid indicate selling aggression.

### NBBO (National Best Bid and Offer)

The NBBO is the composite best bid (highest across all exchanges) and best ask (lowest across all exchanges) for a security at any moment. It represents the tightest available spread nationwide.

- Calculated and disseminated by the SIPs (Securities Information Processors)
- Reg NMS Rule 611 (Order Protection Rule) prohibits executing trades at prices worse than the NBBO
- Exception: intermarket sweep orders (ISOs) can trade through the NBBO if simultaneously routing to protect displayed quotes

### Price Discovery

Price discovery is the process by which market participants determine a security's fair value through the interaction of buy and sell orders. Key mechanisms:
- **Continuous trading:** Orders matching throughout the day move prices to reflect new information
- **Auctions:** Opening and closing auctions aggregate orders to find a single clearing price at concentrated liquidity points
- **Information flow:** Earnings, macro data, analyst actions, and news drive order flow imbalances that move prices

---

## 5. Asset Classes

### Equities (Stocks)

- **Common Stock** -- Represents ownership in a corporation with voting rights (typically 1 share = 1 vote) and residual claim on earnings/assets. Dividends are not guaranteed. Most actively traded asset class.
- **Preferred Stock** -- Hybrid security with fixed dividend payments (like bonds) and equity upside. No voting rights (usually). Higher claim on assets than common in liquidation. Often callable by the issuer.

**Key specs:** Traded in shares. Minimum tick size: $0.01 for stocks priced above $1.00, $0.0001 for sub-dollar stocks. No expiration. Settlement: T+1.

### ETFs (Exchange-Traded Funds)

Baskets of securities (stocks, bonds, commodities, etc.) traded as a single unit on exchanges. Creation/redemption mechanism keeps ETF prices close to net asset value (NAV). Over 3,000 ETFs trade in the U.S. Treated identically to stocks for order routing and settlement purposes.

### Options

A contract giving the buyer the right (not obligation) to buy (call) or sell (put) the underlying at a specified price (strike) before or on a specified date (expiration).

| Specification | Standard Equity Option |
|--------------|----------------------|
| **Contract size** | 100 shares per contract |
| **Premium** | Quoted per share (multiply by 100 for contract cost) |
| **Strike intervals** | $1, $2.50, or $5 depending on underlying price |
| **Expiration cycles** | Weekly (Friday), monthly (3rd Friday), quarterly, LEAPS (up to ~2.5 years) |
| **Exercise style** | American (exercisable any time before expiration) for equities; European (only at expiration) for index options |
| **Settlement** | Stock-settled for equity options (shares delivered); cash-settled for index options |
| **Tick size** | $0.01 for series priced under $3.00; $0.05 for series priced $3.00+ (penny pilot classes use $0.01 for all) |

**The Greeks:** Delta (directional sensitivity), gamma (rate of delta change), theta (time decay), vega (volatility sensitivity), rho (interest rate sensitivity). Critical for options pricing and risk management.

### Futures

A standardized contract to buy or sell an asset at a predetermined price on a specific future date. Both buyer and seller are obligated.

| Specification | Example: E-mini S&P 500 (ES) |
|--------------|------------------------------|
| **Contract size** | $50 x S&P 500 Index value |
| **Tick size** | 0.25 index points = $12.50 per tick |
| **Trading hours** | Nearly 24 hours (Sunday 6 PM - Friday 5 PM ET, daily halt 5-6 PM ET) |
| **Expiration** | Quarterly (March, June, September, December -- "H, M, U, Z") |
| **Settlement** | Cash-settled (no physical delivery for index futures) |
| **Margin** | Initial margin ~$12,000-15,000 per contract; maintenance margin ~$11,000-13,000 |

**Rollover:** As the front-month contract approaches expiration, volume migrates to the next contract month. Most index futures rollover occurs on the Thursday before the second Friday of the expiration month ("roll week"). Traders must close the expiring contract and open the new one, or face delivery/settlement.

**Other major futures:** Crude Oil (CL), Gold (GC), 10-Year Treasury Notes (ZN), Euro FX (6E), Corn (ZC), Micro E-mini S&P (MES -- 1/10th the size of ES).

### Forex (Foreign Exchange)

| Specification | Detail |
|--------------|--------|
| **Major pairs** | EUR/USD, USD/JPY, GBP/USD, USD/CHF, AUD/USD, USD/CAD, NZD/USD |
| **Cross pairs** | EUR/GBP, EUR/JPY, GBP/JPY (no USD leg) |
| **Lot sizes** | Standard lot = 100,000 units; Mini = 10,000; Micro = 1,000 |
| **Pip** | Smallest standard price increment: 0.0001 for most pairs; 0.01 for JPY pairs |
| **Pip value** | ~$10 per pip for a standard lot on EUR/USD |
| **Spread** | EUR/USD: 0.1-1.0 pips; exotic pairs: 3-20+ pips |
| **Leverage** | Up to 50:1 in the U.S. (CFTC limit); up to 30:1 in EU (ESMA limit) |
| **Hours** | 24/5 -- Sunday 5 PM ET to Friday 5 PM ET |
| **Settlement** | Spot: T+2; futures: contract expiration |

### Crypto

- **Spot trading** -- Direct buying/selling of cryptocurrency on exchanges (Coinbase, Kraken, Binance). Settlement is typically near-instant on the exchange, with on-chain settlement varying by blockchain (Bitcoin ~10 min, Ethereum ~12 sec).
- **Perpetual Futures ("Perps")** -- Futures contracts with no expiration date, unique to crypto. Use a funding rate mechanism (periodic payments between longs and shorts) to keep the perp price anchored to spot. Available on Binance, Bybit, dYdX, etc. Leverage up to 100x+ on some platforms.
- **Trading hours:** 24/7/365 -- no market close, no holidays.

### Bonds

- **Government bonds** -- U.S. Treasuries (T-bills: <1 year; T-notes: 2-10 years; T-bonds: 20-30 years). Quoted as percentage of par (face value), e.g., 99.50 = $995 per $1,000 face.
- **Corporate bonds** -- Issued by companies; credit risk varies. Investment-grade (BBB- and above) vs. high-yield/junk (BB+ and below).
- **Municipal bonds** -- Issued by state/local governments; often tax-exempt.
- **Settlement:** T+1 for Treasuries; T+1 for corporate and municipal bonds (changed from T+2 in May 2024).

### Indices

Indices (S&P 500, Dow Jones Industrial Average, NASDAQ Composite, Russell 2000) are not directly tradable. Exposure is obtained through:
- Index futures (ES, NQ, YM, RTY)
- Index options (SPX, NDX -- cash-settled, European-style)
- ETFs tracking the index (SPY, QQQ, IWM)

---

## 6. Market Data Flow

### The Data Pipeline

```
Exchanges (NYSE, NASDAQ, Cboe, etc.)
        |
        v
Securities Information Processors (SIPs)
  - CTA/CQS (Tape A: NYSE-listed, Tape B: regional/Arca-listed)
  - UTP/UQDF (Tape C: NASDAQ-listed)
        |
        v
Data Vendors / Aggregators
  (Bloomberg, Refinitiv, Polygon, Alpaca, IEX Cloud, Databento)
        |
        v
End Users
  (Brokers, trading platforms, retail traders, institutional desks)
```

### SIP Details

The two SIPs consolidate quote and trade data from all 16 U.S. equity exchanges:

- **CTA (Consolidated Tape Association):** Operated by NYSE. Tape A covers NYSE-listed securities; Tape B covers securities listed on NYSE Arca, NYSE American, and regional exchanges. Disseminates via CQS (quotes) and CTS (trades).
- **UTP (Unlisted Trading Privileges Plan):** Operated by NASDAQ. Tape C covers NASDAQ-listed securities. Disseminates via UQDF (quotes) and UTDF (trades).

The SIPs compute and publish the **NBBO** by comparing best bid/ask across all exchanges in real time.

### Latency Tiers

| Tier | Latency | Source | Cost |
|------|---------|--------|------|
| **Co-located direct feeds** | 1-10 microseconds | Exchange proprietary feeds at co-location facilities | $10,000-50,000+/month per exchange |
| **SIP feeds** | 50-200 microseconds | CTA/UTP consolidated tape | $2,000-17,000/month depending on use |
| **Vendor feeds** | 1-50 milliseconds | Bloomberg, Refinitiv, Polygon, etc. | $100-5,000/month |
| **Retail broker feeds** | 100-500 milliseconds | Broker-provided via API or UI | Often free (subsidized by PFOF) |
| **Free delayed feeds** | 15+ minutes delayed | Yahoo Finance, Google Finance, etc. | Free |

### Direct Market Access (DMA)

Institutional traders bypass the broker's order routing logic and send orders directly to exchange matching engines. Requires:
- Exchange membership or sponsored access agreement
- Pre-trade risk checks (SEC Rule 15c3-5, the "Market Access Rule")
- Typically co-located servers for minimal latency
- Significant capital and compliance infrastructure

**Platform implication:** Most retail trading platforms use vendor feeds (Polygon, IEX Cloud, Alpaca) in the 1-50ms latency tier. Real-time streaming via WebSocket is standard. Historical data is sourced separately, often from the same vendors.

---

## 7. Regulatory Landscape

### Key Regulatory Bodies

- **SEC (Securities and Exchange Commission)** -- Primary federal regulator for securities markets. Oversees exchanges, broker-dealers, investment advisers, and mutual funds. Enforces securities laws (Securities Act of 1933, Securities Exchange Act of 1934).
- **FINRA (Financial Industry Regulatory Authority)** -- Self-regulatory organization (SRO) for broker-dealers. Administers licensing exams (Series 7, 63, etc.), conducts examinations, enforces rules, and operates trade reporting facilities.
- **CFTC (Commodity Futures Trading Commission)** -- Regulates futures and options on futures, commodity pools, and forex. Oversees CME Group, Cboe Futures Exchange, and ICE Futures.
- **OCC (Options Clearing Corporation)** -- Central clearing counterparty for U.S. listed options. Guarantees performance of every options contract.

### Key Regulations

**Regulation NMS (National Market System):**
- **Rule 611 (Order Protection Rule):** Prohibits trade-throughs -- executing at prices inferior to protected quotations displayed by other exchanges. Requires intermarket order routing.
- **Rule 610 (Access Rule):** Caps access fees at $0.003/share for taking liquidity. Prevents locked/crossed markets.
- **Rule 605:** Requires market centers to publish monthly execution quality statistics. Expanded in 2024 amendments; compliance deadline August 1, 2026.
- **Rule 606:** Requires brokers to publish quarterly reports detailing order routing destinations and material relationships (PFOF, rebates).

**Regulation SHO (Short Selling):**
- **Locate requirement:** Before short selling, broker must locate shares available to borrow.
- **Close-out requirement:** Failures to deliver must be closed out by T+3 (for threshold securities) or T+5.
- **Rule 201 (Alternative Uptick Rule / Short Sale Circuit Breaker):** If a stock drops 10% or more from prior close, short sales are restricted to prices above the current best bid for the remainder of that day plus the next full trading day. Prevents piling-on during sharp declines.

**Pattern Day Trader (PDT) Rule:**
- Currently: accounts executing 4+ day trades within 5 business days in a margin account are flagged as pattern day traders, requiring a minimum equity of $25,000.
- **2026 update:** In September 2025, the FINRA Board approved amendments to eliminate the PDT designation and the $25,000 minimum equity requirement. Instead, an intraday margin rule will apply standard maintenance margin rules to intraday exposure. As of February 2026, this rule change is in the SEC comment/approval process (comments were due February 4, 2026). Expected implementation later in 2026 or early 2027.
- Cash accounts are not subject to PDT rules but are subject to free-riding restrictions and T+1 settlement constraints.

### Market Circuit Breakers

**Market-Wide Circuit Breakers (S&P 500-based):**

| Level | Trigger | Before 3:25 PM ET | At/After 3:25 PM ET |
|-------|---------|-------------------|---------------------|
| **Level 1** | S&P 500 drops **7%** from prior close | 15-minute trading halt | No halt |
| **Level 2** | S&P 500 drops **13%** from prior close | 15-minute trading halt | No halt |
| **Level 3** | S&P 500 drops **20%** from prior close | Trading halted for remainder of day | Trading halted for remainder of day |

Thresholds are recalculated daily based on the prior day's closing S&P 500 value.

**Limit Up-Limit Down (LULD) -- Individual Security Circuit Breaker:**

| Tier | Securities | Price Band |
|------|-----------|------------|
| **Tier 1** | S&P 500, Russell 1000, select ETFs | 5% for stocks > $3.00; lesser of $0.15 or 75% for stocks <= $3.00 |
| **Tier 2** | All other NMS stocks | 10% for stocks > $3.00; lesser of $0.15 or 75% for stocks <= $3.00 |

If a stock's price touches the LULD band and doesn't return within 15 seconds, trading pauses for 5 minutes. Double-wide bands apply during the first 15 minutes and last 25 minutes of the regular session. LULD only applies during regular trading hours (9:30 AM - 4:00 PM ET).

**Other Halts:**
- **Regulatory halts (T1):** Pending news, SEC/exchange-initiated
- **Volatility halts (LULD):** Automatic price band breaches
- **IPO halts:** Pre-opening of newly listed securities
- **MWCB halts:** Market-wide circuit breaker triggers

---

## 8. Settlement & Clearing

### Settlement Cycle

U.S. equities moved from T+2 to **T+1 settlement on May 28, 2024**. This means trades executed on Monday settle (ownership and cash transfer) on Tuesday.

| Asset | Settlement Cycle |
|-------|-----------------|
| U.S. equities & ETFs | T+1 |
| U.S. corporate & municipal bonds | T+1 |
| U.S. Treasuries | T+1 |
| U.S. listed options | T+1 |
| Mutual funds | T+1 to T+2 |
| Futures | Daily mark-to-market; final settlement at expiration |
| Forex (spot) | T+2 |

### DTCC (Depository Trust & Clearing Corporation)

The DTCC is the central infrastructure provider for U.S. securities settlement:

- **NSCC (National Securities Clearing Corporation):** Clears and settles equities, ETFs, corporate/municipal bonds. Acts as central counterparty (CCP) -- becomes the buyer to every seller and the seller to every buyer, guaranteeing trade completion even if one party defaults. Nets multilateral obligations to reduce the total number and value of settlements.
- **DTC (Depository Trust Company):** Central securities depository. Holds securities in book-entry form (electronic, not physical certificates). Processes transfers between accounts.
- **FICC (Fixed Income Clearing Corporation):** Clears and settles government securities and mortgage-backed securities.

### Netting

NSCC nets all trades multilaterally. Instead of settling each trade individually (thousands per day per participant), firms receive a single net obligation per security per day. This reduces settlement risk and capital requirements dramatically. T+1 reduces the netting window, which has modestly increased capital requirements relative to T+2 but significantly reduced counterparty risk.

### Margin Accounts vs. Cash Accounts

| Feature | Cash Account | Margin Account |
|---------|-------------|----------------|
| **Buying power** | Limited to settled cash | Up to 2x (Reg T initial margin = 50%) |
| **Day trading buying power** | Settled cash only | 4x maintenance margin excess (for PDT accounts) |
| **Short selling** | Not allowed | Allowed (with locate) |
| **Options** | Limited strategies (covered calls, cash-secured puts, long options) | Full range of strategies including spreads, naked writing |
| **Interest** | None | Charged on borrowed funds (broker's margin rate) |
| **Maintenance margin** | N/A | 25% of position value minimum (FINRA); brokers may require 30-50% |
| **Margin call** | N/A | Must deposit funds or liquidate if equity falls below maintenance level |
| **Free-riding risk** | Yes -- cannot use unsettled proceeds to buy and sell same security | No -- margin loan covers settlement gap |

**Regulation T (Reg T):** Sets the initial margin requirement at 50% for equities. Investors must deposit at least 50% of the purchase price when buying on margin. Set by the Federal Reserve Board.

**Portfolio Margin:** Available to qualified accounts (typically $125,000+ minimum). Uses risk-based calculations (similar to TIMS/SPAN) rather than Reg T's fixed percentages. Can provide significantly more leverage for hedged/diversified portfolios. Requires broker approval.

---

## Glossary of Key Acronyms

| Acronym | Full Name |
|---------|-----------|
| ATS | Alternative Trading System |
| CCP | Central Counterparty |
| CQS | Consolidated Quote System |
| CTA | Consolidated Tape Association |
| CTS | Consolidated Trade System |
| DMA | Direct Market Access |
| DMM | Designated Market Maker |
| DTC | Depository Trust Company |
| DTCC | Depository Trust & Clearing Corporation |
| ECN | Electronic Communication Network |
| FICC | Fixed Income Clearing Corporation |
| FINRA | Financial Industry Regulatory Authority |
| IOC | Immediate or Cancel |
| ISO | Intermarket Sweep Order |
| LOB | Limit Order Book |
| LULD | Limit Up-Limit Down |
| MWCB | Market-Wide Circuit Breaker |
| NAV | Net Asset Value |
| NBBO | National Best Bid and Offer |
| NMS | National Market System |
| NSCC | National Securities Clearing Corporation |
| OCC | Options Clearing Corporation |
| OCO | One-Cancels-Other |
| PDT | Pattern Day Trader |
| PFOF | Payment for Order Flow |
| SIP | Securities Information Processor |
| SOR | Smart Order Router |
| UTP | Unlisted Trading Privileges |
