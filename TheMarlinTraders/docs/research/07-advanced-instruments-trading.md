# 07 - Advanced Instruments & Trading Features

## Purpose

This document defines the feature requirements for options, futures, forex, cryptocurrency, and advanced multi-asset trading instruments within TheMarlinTraders platform. It covers options chain mechanics, Greeks computation, volatility analytics, multi-leg order construction, sector analysis, and earnings event workflows. Each section specifies the calculations, display formats, and user interactions required, along with competitive benchmarks from ThinkOrSwim (ToS) and Bloomberg Terminal.

---

## 1. Options Trading Features

### 1.1 Options Chain Display

The options chain is the primary interface for options traders. It must support rapid scanning of hundreds of strikes across multiple expirations.

**Layout Requirements:**

- **Dual-pane structure**: Calls on the left, puts on the right, with strike prices as the center spine dividing them. This is the standard layout used by ToS, Bloomberg OMON, and every professional platform.
- **Expiration navigation**: Tabbed or accordion-style headers showing `[Expiration Date] | [DTE] | [Multiplier]`. Users must be able to expand/collapse individual expirations and view multiple expirations simultaneously.
- **Column set (per side)**: Bid, Ask, Last, Mark (midpoint), Change, % Change, Volume, Open Interest, IV, Delta, Gamma, Theta, Vega. Users should be able to reorder, hide, or add columns.
- **In-the-money highlighting**: ITM strikes should have a distinct background shading (e.g., light blue for calls, light pink for puts). The ATM strike row should be visually distinguished with a border or bolder shading.
- **Strike filtering**: Filter by moneyness range (e.g., +/- 10 strikes from ATM), by minimum open interest, or by minimum volume. ToS allows showing "just a few strikes" or the full chain.
- **Mini-chart integration**: Hovering a strike should show a small sparkline of that contract's intraday price history.

**What ToS does well**: Extremely dense information display, ThinkScript-based custom columns, simultaneous multi-expiration viewing. **What ToS lacks**: The interface is cluttered and intimidating for newer traders; no modern responsive design.

**What Bloomberg does well**: OMON function provides institutional-grade chain data with real-time updates; OVME for options valuation. **What Bloomberg lacks**: Extremely expensive ($25,000+/year), no retail accessibility, no visual P&L diagrams inline.

### 1.2 Greeks Display

Greeks quantify option price sensitivity to underlying variables. They must be computed in real-time and displayed both per-contract and for aggregate portfolio positions.

**Individual Contract Greeks:**

| Greek | Formula Basis | Display Format | Update Frequency |
|-------|--------------|----------------|-----------------|
| Delta | dV/dS (Black-Scholes or binomial) | -1.00 to +1.00 (or -100 to +100) | Real-time with underlying |
| Gamma | d^2V/dS^2 | 0.00 to ~0.10 typically | Real-time |
| Theta | dV/dt | Negative dollar value per day | Real-time, displayed as daily decay |
| Vega | dV/d(sigma) | Dollar change per 1% IV move | Real-time |
| Rho | dV/dr | Dollar change per 1% rate move | Updated daily (low sensitivity) |

**Portfolio-Level Greeks:**

- Aggregate Delta, Gamma, Theta, Vega across all positions, weighted by quantity.
- Display as both raw values and "equivalent shares" (portfolio Delta * 100 = equivalent stock exposure).
- Greeks-at-a-glance dashboard showing total portfolio Greeks with color-coded risk gauges.

**Calculation Engine:**

- Use Black-Scholes-Merton for European-style options (index options like SPX).
- Use Cox-Ross-Rubinstein binomial tree (minimum 200 steps) for American-style options (equity options) to account for early exercise.
- Support dividend-adjusted pricing for stocks with known dividend schedules.
- Interest rate input should default to the current risk-free rate (Fed Funds or SOFR) and be user-adjustable.

### 1.3 Implied Volatility Analytics

IV is the market's consensus forecast of future price movement and is the single most important metric for options pricing.

**Per-Strike IV:**

- Compute IV by inverting the Black-Scholes formula using Newton-Raphson or Brent's method, given the market price of each option.
- Display as a percentage alongside bid/ask in the chain.
- Color-code IV relative to its 52-week range: green (low percentile), yellow (mid), red (high).

**IV Rank and IV Percentile:**

- **IV Rank** = `(Current IV - 52wk Low IV) / (52wk High IV - 52wk Low IV) * 100`. Displayed as 0-100.
- **IV Percentile** = percentage of trading days in the past year where IV was below the current level. Displayed as 0-100%.
- Both should appear prominently on the underlying's summary header.

**IV Surface / Smile Visualization:**

- **2D Skew Chart**: X-axis = strike price (or delta), Y-axis = IV. One line per expiration. Reveals put skew (OTM puts having higher IV than OTM calls), which is typical in equity markets because markets fall faster than they rise.
- **3D Volatility Surface**: X-axis = days to expiration, Y-axis = strike price (or moneyness), Z-axis = IV. Interactive rotation, zoom, and cross-section slicing.
- **IV Term Structure**: X-axis = expiration date, Y-axis = ATM IV. Shows whether near-term or far-term vol is higher (contango vs backwardation in vol).

**Historical IV vs Realized Volatility:**

- Overlay chart showing 30-day IV (forward-looking) vs 30-day HV (backward-looking, calculated as annualized standard deviation of log returns).
- When IV exceeds HV by a significant margin, highlight this as a "volatility premium" — a signal that options are relatively expensive. When HV exceeds IV, options are relatively cheap.

### 1.4 Strategy Builder (Multi-Leg Construction)

The strategy builder allows traders to construct, analyze, and execute complex options positions.

**Supported Strategies:**

| Category | Strategies |
|----------|-----------|
| Vertical Spreads | Bull call spread, bear put spread, bull put spread, bear call spread |
| Iron Strategies | Iron condor, iron butterfly |
| Butterflies | Long/short call butterfly, long/short put butterfly, broken-wing butterfly |
| Straddles/Strangles | Long straddle, short straddle, long strangle, short strangle |
| Calendar/Diagonal | Calendar spread (same strike, different exp), diagonal spread (different strike + exp) |
| Ratio Spreads | Call ratio spread, put ratio spread, ratio backspread |
| Synthetic | Synthetic long/short stock, collar, protective put, covered call |
| Custom | Arbitrary multi-leg combinations (up to 8 legs) |

**Construction Methods:**

1. **Template-based**: Select strategy from dropdown, auto-populate legs based on ATM or user-specified anchor strike.
2. **Click-to-add**: Click bid/ask on chain to add legs. System infers strategy type from the combination.
3. **Visual builder**: Drag-and-drop interface showing legs as colored bars on a strike/expiration grid.

**P&L Diagram:**

- X-axis = underlying price at expiration, Y-axis = profit/loss in dollars.
- Show breakeven points as vertical dashed lines with labeled values.
- Display max profit, max loss, and probability of profit (POP) as callout boxes.
- Support "current P&L" overlay showing the position's P&L curve at the current date (before expiration), not just at-expiration.
- Slider for "days to expiration" to animate how the P&L curve flattens as expiration approaches.
- Toggle for viewing P&L per-contract vs total position.

**What ToS does well**: The Analyze tab is best-in-class for P&L visualization with "today", "expiration", and custom date curves. Risk profile shows Greeks across price range. **What ToS lacks**: Strategy templates require manual strike selection; no one-click "optimal iron condor" based on probability targets.

### 1.5 Probability Analysis

- **Probability of Profit (POP)**: Calculated from the log-normal distribution assumption using current IV. Display as percentage on strategy analysis.
- **Expected Move**: `ATM Straddle Price * 0.85` for the nearest expiration. Display as +/- range on the price chart as shaded bands.
- **Probability Cones**: Project 1-standard-deviation and 2-standard-deviation price cones forward on the chart, based on current IV. The cone widens as time extends. This helps traders visualize expected price ranges.
- **Probability of Touch vs Probability of Expiring ITM**: Probability of touch is approximately 2x the probability of expiring ITM. Both should be available per strike.

### 1.6 Options Flow & Unusual Activity

Options flow tracking reveals institutional positioning and "smart money" behavior.

**Detection Criteria:**

- **Unusual Volume**: Flag when a contract's daily volume exceeds 2x its average daily volume AND exceeds 2x open interest.
- **Large Block Trades**: Off-exchange, privately negotiated orders typically exceeding $500K+ in premium. Display with `BLOCK` tag.
- **Intermarket Sweeps**: Orders routed across multiple exchanges simultaneously to fill large size quickly. These print as multiple smaller fills microseconds apart and are reassembled by the platform. Display with `SWEEP` tag.
- **Aggressive Trades**: Trades executed at or above the ask (bullish) or at or below the bid (bearish). Color-code green for ask-side, red for bid-side.

**Display Format:**

Table with columns: `Time | Ticker | Exp | Strike | C/P | Sentiment | Size | Premium | Type (Block/Sweep/Split) | OI | Vol/OI Ratio`

**Put/Call Ratio:**

- Per-ticker and market-wide (CBOE equity P/C ratio).
- Display as real-time line chart. Extreme readings (>1.2 bearish, <0.6 bullish) should trigger visual alerts.

### 1.7 Max Pain

Max pain is the strike price where the maximum number of options (both calls and puts) would expire worthless, causing the most aggregate loss to option holders.

**Calculation:**

For each strike price K:
```
Total Pain(K) = SUM over all call strikes C where C < K: (K - C) * Call_OI(C)
              + SUM over all put strikes P where P > K: (P - K) * Put_OI(P)
```

The strike with the minimum Total Pain is the max pain price.

**Visualization:**

- Bar chart with strike prices on X-axis, total dollar pain on Y-axis.
- Overlay call OI and put OI as stacked bars at each strike.
- Vertical line marking the max pain strike with current price comparison.
- Updated daily after OCC publishes new open interest data (typically by 9:00 AM ET).

### 1.8 Historical Earnings Moves

- **Earnings Calendar**: Table showing upcoming earnings dates with consensus EPS, revenue estimates, and the options-implied expected move (ATM straddle * 0.85).
- **Past Reactions**: For each ticker, show the last 8-12 quarters of actual move vs expected move. Display as paired bar chart: expected (gray) vs actual (green if exceeded, red if fell short).
- **Chart Overlay**: Ability to overlay earnings dates on the price chart with markers showing the post-earnings gap direction and magnitude.
- **Whisper Numbers**: Where available, display consensus vs whisper estimate. Source from community-aggregated data.

---

## 2. Futures Trading Features

### 2.1 Contract Specifications

Display a structured spec sheet for each futures contract including:

| Field | Example (ES - E-mini S&P 500) |
|-------|-------------------------------|
| Exchange | CME |
| Tick Size | 0.25 points ($12.50/tick) |
| Contract Size | $50 x S&P 500 Index |
| Trading Hours | Sun-Fri 6:00p-5:00p ET (nearly 23 hours) |
| Expiration Months | March, June, September, December (quarterly) |
| Settlement | Cash-settled |
| Margin (Initial/Maintenance) | ~$13,200 / ~$12,000 (varies by broker) |

**Key Contracts to Support:**

- **Equity Index**: ES (E-mini S&P), NQ (E-mini Nasdaq), YM (E-mini Dow), RTY (E-mini Russell 2000)
- **Micro Contracts**: MES, MNQ, MYM, M2K (1/10th size of E-mini, critical for retail access)
- **Energy**: CL (Crude Oil), NG (Natural Gas), RB (RBOB Gasoline)
- **Metals**: GC (Gold), SI (Silver), HG (Copper), PL (Platinum)
- **Agriculture**: ZC (Corn), ZS (Soybeans), ZW (Wheat), ZL (Soybean Oil)
- **Interest Rates**: ZB (30Y T-Bond), ZN (10Y T-Note), ZF (5Y T-Note)
- **Currencies**: 6E (Euro FX), 6J (Japanese Yen), 6B (British Pound)

### 2.2 Continuous Contract Construction

Futures expire quarterly or monthly, creating gaps between contracts. Continuous contracts stitch together successive front-month contracts into a single tradable history.

**Methods:**

- **Back-Adjusted (Ratio or Difference)**: Adjusts historical prices to eliminate the gap at rollover. Preserves percentage moves and is correct for technical analysis. However, historical price levels are distorted (e.g., an ES chart might show a price of 2800 for a date when the actual price was 3200).
- **Unadjusted**: Simply splices contracts together without adjustment. Creates visible gaps at rollover points but preserves actual price levels.
- **Perpetual (Volume-Weighted)**: Blends the expiring and new front-month contracts using a volume-weighted average during the rollover window. Smoothest transition.

Users must be able to toggle between these modes. ToS uses back-adjusted by default. Bloomberg uses unadjusted by default with `CT` (continuous) modifiers.

### 2.3 Rollover Handling

- **Rollover Calendar**: Table showing upcoming rollover dates for all tracked contracts. Rollover typically occurs 5-8 trading days before expiration, when open interest shifts to the next contract.
- **Automatic Alerts**: Notify users holding expiring contracts 7 days, 3 days, and 1 day before rollover.
- **One-Click Roll**: Button to simultaneously close the expiring position and open an equivalent position in the next contract, submitted as a calendar spread order (reduces slippage vs two separate orders).

### 2.4 Spread Trading

- **Calendar Spreads**: Long one expiration, short another of the same contract. Display as a synthetic instrument with its own chart.
- **Inter-Commodity Spreads**: Long one commodity, short a correlated one (e.g., crack spread: long CL, short RB + HO). Display as spread chart.
- **Spread Margin**: CME recognizes certain spreads for reduced margin. Display the margin savings when constructing recognized spreads.

### 2.5 Margin Requirements Display

- Show initial and maintenance margin per contract.
- Calculate total margin for a proposed position before order submission.
- Color-coded margin utilization bar: green (<50%), yellow (50-80%), red (>80%).
- Margin call warning when account equity drops below maintenance.

### 2.6 COT Data Visualization

The Commitment of Traders report, published weekly by the CFTC, shows positioning of Commercials (hedgers), Large Speculators (funds), and Small Speculators (retail).

**Display:**

- Stacked area chart or multi-line chart showing net positions for each group over time.
- Overlay with the futures price chart.
- Highlight extreme readings (net positioning beyond 2 standard deviations from the 3-year mean) as potential contrarian signals.
- Data delayed by 3 days (released Friday for the previous Tuesday's positions). The CFTC completed its backlog clearance by late 2025.

---

## 3. Forex Trading Features

### 3.1 Currency Pair Display

- **Pair convention**: Always display in standard convention (EUR/USD, not USD/EUR). The first currency is the base, the second is the quote.
- **Pricing precision**: Major pairs to 5 decimal places (1.08235), JPY pairs to 3 decimal places (149.523).
- **Pair categories**: Majors (EUR/USD, GBP/USD, USD/JPY, USD/CHF, AUD/USD, NZD/USD, USD/CAD), Crosses (EUR/GBP, GBP/JPY, EUR/AUD, etc.), Exotics (USD/TRY, USD/ZAR, USD/MXN, etc.).
- **Spread display**: Show bid/ask spread in pips alongside each pair. Highlight when spreads widen during off-hours or news events.

### 3.2 Pip Calculator

A pip (percentage in point) is the smallest standard price movement in a currency pair.

**Calculation:**

```
For most pairs: 1 pip = 0.0001
For JPY pairs:  1 pip = 0.01

Pip Value = (Pip Size / Exchange Rate) * Position Size * Quote Currency Rate
```

**Example**: EUR/USD at 1.0800, 1 standard lot (100,000 units):
```
Pip Value = (0.0001 / 1.0800) * 100,000 = $9.26 per pip
```

Display an interactive calculator with inputs for: pair, lot size, account currency. Auto-calculate pip value, margin required, and max position size based on account equity and risk percentage.

### 3.3 Lot Size Calculator

- **Standard Lot**: 100,000 units of base currency
- **Mini Lot**: 10,000 units
- **Micro Lot**: 1,000 units
- **Nano Lot**: 100 units (some brokers)

Calculator inputs: Account size, risk percentage (e.g., 1%), stop-loss distance in pips. Output: Recommended lot size.

```
Lot Size = (Account Size * Risk %) / (Stop Loss in Pips * Pip Value)
```

### 3.4 Swap Rates / Rollover Rates

When a forex position is held overnight, the trader pays or receives a swap rate based on the interest rate differential between the two currencies.

- Display daily swap rates (long and short) for each pair, sourced from the broker's feed.
- Calculate projected swap cost/income for a given position size over N days.
- Highlight pairs with positive carry (earn interest by holding) for carry trade analysis.

### 3.5 Economic Calendar Integration

Critical for forex traders who trade around macroeconomic releases.

**Key Events:**

| Event | Currency Impact | Typical Volatility |
|-------|----------------|-------------------|
| Non-Farm Payrolls (NFP) | USD | Very High |
| FOMC Rate Decision | USD | Very High |
| ECB Rate Decision | EUR | Very High |
| CPI (any G7 country) | Respective | High |
| GDP | Respective | High |
| PMI (Manufacturing/Services) | Respective | Medium |
| Retail Sales | Respective | Medium |

**Display:**

- Timeline view with events color-coded by impact level (red = high, orange = medium, yellow = low).
- Actual vs forecast vs previous values displayed post-release.
- Chart markers showing event times on the price chart.
- Countdown timers for upcoming high-impact events.

### 3.6 Currency Strength Meter

Measures the relative strength of each major currency against all others.

**Calculation:**

For each currency, compute its average percentage change against all other major currencies over a configurable lookback period (1h, 4h, 1D, 1W). Normalize to a 0-100 scale.

**Display:**

- Horizontal bar chart with currencies ranked strongest to weakest.
- Color gradient: green (strong) to red (weak).
- The optimal trade is to pair the strongest currency (long) against the weakest (short).

### 3.7 Correlation Matrix

Display a correlation matrix showing the Pearson correlation coefficient between all major pairs over configurable lookback periods (20, 50, 100, 200 days).

- Color-coded cells: dark green (+1.0) to dark red (-1.0), white at 0.
- Useful for diversification (avoiding highly correlated positions) and for hedging (finding negatively correlated pairs).
- Common high correlations: EUR/USD and GBP/USD (+0.85 typically), EUR/USD and USD/CHF (-0.90 typically).

### 3.8 Session Overlap Visualization

Forex markets trade 24/5 across four major sessions. Volume and volatility peak during session overlaps.

**Sessions:**

| Session | Hours (ET) | Key Pairs |
|---------|-----------|-----------|
| Sydney | 5:00 PM - 2:00 AM | AUD, NZD |
| Tokyo | 7:00 PM - 4:00 AM | JPY crosses |
| London | 3:00 AM - 12:00 PM | EUR, GBP, CHF |
| New York | 8:00 AM - 5:00 PM | USD pairs |

**Display:**

- Horizontal timeline bar showing all four sessions with overlap zones highlighted.
- Overlay on the price chart as background shading.
- Volume profile by session to show when liquidity is deepest.
- The London/New York overlap (8:00 AM - 12:00 PM ET) is the highest-volume period and should be visually emphasized.

---

## 4. Cryptocurrency Features

### 4.1 24/7 Market Handling

Unlike traditional markets, crypto trades continuously with no market close.

- **No "market hours" logic**: All chart patterns, indicators, and order types must function without assuming market open/close times.
- **Weekend continuity**: Charts should render seamlessly through weekends without gaps.
- **Session-based analysis**: Allow users to define custom "sessions" for volume profile and VWAP calculations (e.g., midnight-to-midnight UTC, or aligned with CME crypto futures hours for comparison).

### 4.2 Exchange-Specific Pricing

Crypto prices vary across exchanges due to liquidity differences, regional demand, and trading fees.

- **Multi-exchange price display**: Show bid/ask from Binance, Coinbase, Kraken, OKX, and Bybit side-by-side.
- **Composite/Index price**: Calculate a volume-weighted average price across exchanges as the "fair" reference price.
- **Arbitrage alerts**: When the spread between exchanges exceeds a configurable threshold (e.g., 0.5%), trigger an alert.
- **Exchange selection**: Users choose their primary exchange for charting and order routing.

### 4.3 On-Chain Metrics

On-chain data provides transparency unique to crypto — the ability to observe actual blockchain activity.

**Key Metrics:**

| Metric | Description | Signal |
|--------|-------------|--------|
| Exchange Inflows | Coins moving from wallets to exchanges | Potential sell pressure |
| Exchange Outflows | Coins moving from exchanges to wallets | Accumulation / HODLing |
| Whale Transactions | Transfers >$1M (or >100 BTC) | Large player activity |
| NVT Ratio | Network Value to Transactions (market cap / daily transaction volume) | High NVT = overvalued |
| MVRV Ratio | Market Value to Realized Value | >3.5 historically marks tops |
| Active Addresses | Unique daily active addresses | Network usage proxy |
| Stablecoin Supply Ratio | BTC market cap / stablecoin supply | Low = buying power available |

**Data Sources**: Glassnode, CryptoQuant, IntoTheBlock, Nansen. Integrate via their APIs or aggregate from on-chain nodes.

### 4.4 DeFi Protocol Integration

- **TVL Tracking**: Display Total Value Locked across major protocols (Aave, Uniswap, Lido, MakerDAO), sourced from DeFiLlama.
- **Yield Comparison**: Table of current APY across lending protocols for major assets (ETH, USDC, DAI).
- **Protocol Health Metrics**: Collateralization ratios, utilization rates, liquidation thresholds for lending protocols.
- DeFi TVL reached approximately $130-140 billion by early 2026, with Aave v3 on Ethereum representing ~80% of tracked lending capacity at $46B TVL.

### 4.5 Funding Rates (Perpetual Futures)

Perpetual futures contracts have no expiration and use funding rates to tether the perp price to the spot price.

- **Display**: Real-time funding rate as annualized percentage and as 8-hour payment.
- **Historical funding chart**: Time series of funding rates overlaid with price.
- **Interpretation**: Positive funding = longs pay shorts (bullish crowding). Negative funding = shorts pay longs (bearish crowding). Extreme readings are often contrarian signals.
- **Cross-exchange comparison**: Show funding rates across Binance, Bybit, OKX, dYdX, and Hyperliquid.

### 4.6 Liquidation Levels

In leveraged crypto trading, liquidation occurs when margin is insufficient to maintain a position.

- **Liquidation Heatmap**: Overlay on the price chart showing clusters of estimated liquidation levels based on open interest and common leverage ratios (5x, 10x, 25x, 50x, 100x). CoinGlass is the primary data source.
- **Cascade analysis**: When price approaches dense liquidation zones, forced liquidations can trigger cascading moves. Visualize these clusters as horizontal bands with intensity based on estimated size.
- **Real-time liquidation feed**: Streaming table of actual liquidations as they occur (ticker, exchange, size, long/short, price).

### 4.7 Dominance Charts

- **BTC Dominance**: Bitcoin's market cap as a percentage of total crypto market cap. Line chart over time. Rising dominance typically indicates risk-off (capital flowing from alts to BTC).
- **Altcoin Season Index**: Composite metric measuring whether top altcoins are outperforming BTC. Above 75 = "altcoin season", below 25 = "Bitcoin season".
- **Sector Dominance**: Market cap breakdown by sector (DeFi, L1s, L2s, Meme coins, RWA, AI tokens).

---

## 5. Multi-Leg Order Entry

### 5.1 Visual Order Construction

- **Chart-based entry**: Click on chart price levels to place legs. A vertical spread could be constructed by clicking two price levels on the chart and selecting "Bull Call Spread."
- **Options chain entry**: Click bid/ask prices in the chain to add legs to the order ticket. Each click adds a leg with auto-detected direction (buy at ask, sell at bid).
- **Active position adjustment**: Click on existing position markers on the chart to modify (roll, close, add leg).

### 5.2 Strategy Templates

One-click construction with intelligent defaults:

- **Iron Condor**: User selects probability of profit target (e.g., 70%), system auto-selects wing strikes and widths to match. Short strikes at ~16 delta, wings $5 wide.
- **Covered Call**: User selects stock position, system proposes OTM call at 30-delta for the nearest monthly expiration.
- **Calendar Spread**: User selects strike, system proposes front-month short and back-month long.
- Each template shows estimated fill price, margin requirement, max profit, max loss, and POP before submission.

### 5.3 Execution Modes

- **Package Execution**: Submit the entire multi-leg strategy as a single order. Exchange matches all legs simultaneously. Ensures no "legging risk" but may take longer to fill.
- **Leg-by-Leg Execution**: Execute each leg independently. Faster fills but introduces risk of partial execution and adverse price movement between legs. Require user confirmation and display risk warning.
- **Smart Routing**: When package execution is unavailable or spread markets are wide, the system can split into legs with delta-hedging between fills.

### 5.4 Adjustment Tools

- **Roll**: Close current position and open new position at a different strike/expiration in a single order. UI shows the net debit/credit of the roll.
- **Close Partial**: Close a subset of contracts while maintaining the rest. Auto-calculate new Greeks for the remaining position.
- **Add Leg**: Add a new leg to an existing multi-leg position (e.g., convert an iron condor into a broken-wing butterfly by moving one leg).
- **Greeks-Based Sizing**: Given a target portfolio Delta or Theta, calculate the number of contracts needed.

---

## 6. Volatility Analysis Suite

### 6.1 VIX and VIX Derivatives

- **VIX Display**: CBOE Volatility Index, derived from S&P 500 option prices. Display as a standalone chart with historical context.
- **VIX Term Structure**: Chart of VIX futures prices by expiration. Contango (upward slope) is normal; backwardation (inverted) signals panic.
- **VIX Derivatives**: Support charting and trading of VIX options and VIX futures (VX). Display theoretical fair value based on the term structure.

### 6.2 IV Term Structure

- X-axis = expiration date, Y-axis = ATM implied volatility.
- Overlay multiple dates to show how the term structure has shifted over time.
- Highlight inversions where near-term IV exceeds long-term IV (event-driven vol, such as pre-earnings).

### 6.3 Skew Charts

- **Strike Skew**: IV across strikes for a single expiration. Typical equity skew shows higher IV for OTM puts (crash protection demand) and lower IV for OTM calls.
- **Skew Index**: Quantify the difference between 25-delta put IV and 25-delta call IV. Display as a time series. Rising skew = increasing crash fear.
- **Risk Reversal**: The cost of the 25-delta call minus the 25-delta put. Standard institutional metric for directional vol betting.

### 6.4 Volatility Cones

Show the range of realized volatility across multiple lookback periods (10, 20, 30, 60, 90 days) as a cone chart with percentile bands.

- **Display**: For each lookback period, show the minimum, 25th percentile, median, 75th percentile, and maximum of historical realized volatility.
- **Current HV overlay**: Plot the current realized volatility for each lookback on top of the cone.
- **Interpretation**: If current HV is near the bottom of the cone, volatility is historically low and may mean-revert higher (and vice versa).

### 6.5 Historical Volatility vs Implied Volatility

- Dual-line chart: HV (calculated from actual price returns) vs IV (from option prices).
- When IV > HV: Options are "expensive" relative to actual movement. Favors selling strategies.
- When HV > IV: Options are "cheap". Favors buying strategies.
- Display the spread (IV - HV) as a separate histogram beneath the main chart.

### 6.6 Volatility Surface 3D

The full volatility surface is the most comprehensive vol visualization, combining strike skew and term structure into a single view.

- **3D mesh/wireframe**: X = days to expiration, Y = strike (or moneyness/delta), Z = implied volatility.
- **Interactive controls**: Rotate, zoom, pan. Click any point to see exact IV, strike, expiration.
- **Time-lapse**: Animate the surface over the past N days to see how it has shifted.
- **Anomaly detection**: Highlight regions where the surface deviates significantly from the fitted model (SABR or SVI parameterization), indicating potential mispricings.

**What Bloomberg does well**: The SURF function provides an institutional-grade 3D volatility surface with multiple model overlays. **What Bloomberg lacks**: No retail-accessible equivalent.

### 6.7 Variance Swap Approximation

For advanced users, display the theoretical variance swap strike (fair value of future realized variance):

```
K_var^2 = (2/T) * [integral of (C(K)/K^2) dK] for OTM calls and puts
```

This is approximated by summing over all available OTM option prices weighted by 1/K^2. Display as a single number that can be compared to current VIX levels. The VIX itself is calculated using a similar methodology.

---

## 7. Earnings & Events Analysis

### 7.1 Earnings Calendar

- Filterable table: Date, Ticker, Company Name, Market Cap, Sector, Time (Before/After Market), EPS Estimate, Revenue Estimate, Expected Move (from straddle pricing).
- Filter by: date range, sector, market cap tier, watchlist membership.
- Sort by expected move magnitude (highest vol events first).

### 7.2 Historical Earnings Reactions

- **Paired Bar Chart**: For each of the past 8-12 quarters, show Expected Move (gray bar) vs Actual Move (green or red bar).
- **Win rate for straddle buyers**: Percentage of quarters where the actual move exceeded the expected move. If consistently <50%, straddle selling is historically profitable for that ticker.
- **Chart overlay**: Price chart with vertical markers at each earnings date. Small arrows showing gap direction and magnitude.

### 7.3 Revenue & EPS Surprise Tracking

- Display actual vs consensus for both EPS and revenue.
- Calculate surprise percentage: `(Actual - Estimate) / |Estimate| * 100`.
- Show post-earnings drift: average 5-day and 20-day return after positive vs negative surprises for that ticker historically.

### 7.4 Conference Call Integration

- Link to earnings call transcript (sourced from SEC filings or third-party providers).
- AI-generated summary of key themes, guidance changes, and notable Q&A exchanges.
- Sentiment score derived from NLP analysis of management tone.

### 7.5 Sector Earnings Season Tracking

- Dashboard showing which sectors are reporting this week/month.
- Aggregate surprise ratio by sector (e.g., "Technology: 78% of companies beat EPS estimates").
- Sector-level expected move index (average ATM straddle IV across sector constituents).

---

## 8. Sector & Industry Analysis

### 8.1 Sector Rotation Model

Sector rotation follows the economic cycle: early cycle (Consumer Discretionary, Financials) -> mid cycle (Industrials, Technology, Materials) -> late cycle (Energy, Healthcare) -> recession (Consumer Staples, Utilities).

**Visualization:**

- **Circular/Clock Diagram**: 11 GICS sectors arranged around a clock face representing the economic cycle. Highlighted sector shows current cycle position based on leading economic indicators.
- **Relative Rotation Graph (RRG)**: Scatter plot with X-axis = relative strength (JdK RS-Ratio) and Y-axis = momentum (JdK RS-Momentum). Sectors rotate clockwise through four quadrants: Leading, Weakening, Lagging, Improving.
- **Capital Flow Timeline**: Animated or time-lapse view showing money flowing between sectors over weeks/months.

### 8.2 Industry Group Relative Strength

- Rank all 24 GICS industry groups by performance over configurable periods (1W, 1M, 3M, 6M, 1Y).
- Display as ranked horizontal bar chart with color coding.
- Mansfield Relative Strength (vs S&P 500) for each industry group, displayed as a line chart that can be overlaid on the sector ETF chart.

### 8.3 Heat Maps

- **By Sector**: S&P 500 heat map with each stock sized by market cap and colored by daily/weekly/monthly performance. Clickable to drill into individual stocks. TradingView's stock heatmap is the current benchmark with 17+ sortable criteria.
- **By Market Cap**: Nested rectangles (treemap) with large-caps as bigger blocks.
- **By Performance Period**: Toggle between 1D, 1W, 1M, 3M, YTD, 1Y performance.
- **Custom Metric Heat Maps**: Color by P/E ratio, dividend yield, RSI, earnings surprise, or other fundamental/technical metrics.

### 8.4 Breadth Indicators

Market breadth measures the internal health of a market move — whether a rally or decline is broad-based or concentrated in a few names.

| Indicator | Calculation | Display |
|-----------|-------------|---------|
| Advance/Decline Line | Cumulative (advancing - declining issues) | Line chart overlaid with index |
| Advance/Decline Ratio | Advancing / Declining issues | Daily bar chart |
| New Highs / New Lows | Count of 52-week highs vs lows | Dual bar chart |
| Bullish Percent Index | % of stocks with P&F buy signals | 0-100 scale, oversold <30, overbought >70 |
| % Above 200-DMA | Percentage of stocks above their 200-day moving average | 0-100% line chart |
| McClellan Oscillator | EMA(19) - EMA(39) of daily A/D differential | Oscillator chart |
| McClellan Summation Index | Cumulative sum of McClellan Oscillator | Line chart |

**By Sector**: All breadth indicators should be filterable by sector. A market rally with narrowing breadth (fewer stocks participating) is a bearish divergence signal.

---

## 9. Competitive Benchmarks Summary

### ThinkOrSwim (Charles Schwab)

| Strength | Weakness |
|----------|----------|
| Best-in-class options chain with ThinkScript custom columns | Dated, cluttered UI that overwhelms new users |
| Analyze tab P&L diagrams with date slider | No one-click strategy optimization by probability target |
| Probability analysis and probability cones on charts | No built-in options flow/unusual activity |
| Excellent paper trading (OnDemand replay) | No on-chain crypto metrics |
| ThinkScript: proprietary scripting for custom studies | Futures COT data requires manual setup |
| Free with $0 commissions + $0.65/contract | Mobile app significantly less capable than desktop |
| Probability of touch and probability of expiring ITM per strike | No 3D volatility surface visualization |

### Bloomberg Terminal

| Strength | Weakness |
|----------|----------|
| OMON: institutional options chain with real-time Greeks | $25,000+/year cost, inaccessible to retail |
| OVME: options valuation with multi-model support (BS, binomial, Monte Carlo) | No visual strategy builder with P&L diagrams |
| SURF: 3D volatility surface with SABR/SVI model overlays | No community/social features |
| SKEW: implied vol across strikes with historical overlays | No cryptocurrency support |
| COT: integrated COT data with visualization | Steep learning curve for keyboard-driven interface |
| ERN: comprehensive earnings analysis with surprise tracking | No probability cones on charts |
| FA: deep fundamental analysis tied to Bloomberg data | Cannot be accessed outside Bloomberg hardware/software |
| WEI: economic calendar with consensus data | No options flow/unusual activity detection |

### TheMarlinTraders Opportunity

The gap in the market is a platform that combines:
1. Bloomberg-depth analytics (volatility surface, Greeks modeling, COT data, earnings analysis)
2. ToS-quality options chain and strategy builder
3. Modern, clean UI accessible to both retail and professional traders
4. Built-in options flow and unusual activity (currently requires separate subscriptions to FlowAlgo, UnusualWhales, or SpotGamma)
5. Crypto-native features (on-chain metrics, funding rates, liquidation heatmaps) alongside traditional instruments
6. Forex-specific tools (session overlaps, pip calculator, correlation matrix) that are currently scattered across standalone websites

No single platform today delivers all of these. ToS is strong on options but weak on crypto and modern UX. Bloomberg is strong on everything traditional but prohibitively expensive and has no crypto or retail accessibility. TradingView is strong on charting and community but has limited options chain and no multi-leg execution. This is TheMarlinTraders' opportunity to build the unified platform that advanced multi-asset traders have been waiting for.

---

*Research completed: February 2026*
*Sources: CFTC COT reports, CBOE methodology papers, CME Group contract specifications, Bloomberg OMON/OVME/SURF documentation, ThinkOrSwim platform analysis, CryptoQuant and Glassnode on-chain data specifications, DeFiLlama TVL data, OptionStrat and UnusualWhales flow detection methodologies, MenthorQ volatility surface tools, TradingView heatmap documentation.*
