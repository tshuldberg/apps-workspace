# 06 - Retail Trading Workflows

> Practical workflows for day traders and swing traders — what they actually do, what screens they need, and what tools they demand from a platform.

---

## 1. Day Trader Workflows (Minute by Minute)

### Pre-Market (6:00 AM - 9:30 AM ET)

The trading day starts well before the opening bell. Most active day traders begin between 6:00 and 7:00 AM ET with a structured routine.

**6:00 - 7:00 AM: Macro Scan and News Review**
- Open the platform and check overnight futures (ES, NQ, RTY) for market direction bias.
- Review economic calendar: Fed speakers, CPI/PPI releases, jobs data, earnings before open.
- Scan headline news: Reuters, Bloomberg terminal, or a news feed widget embedded in the platform.
- Check pre-market movers list for stocks gapping up or down 3%+ on volume.

**7:00 - 8:30 AM: Gap Scanner and Watchlist Building**
- Run the gap scanner with filters: gap > 3%, pre-market volume > 100K shares, float < 50M (for small-cap momentum) or any float (for large-cap earnings plays).
- Example: Trader sees NVDA gapping up 6% pre-market on earnings beat. Pre-market volume is 12M shares. Added to watchlist immediately.
- Example: MARA gapping down 8% on Bitcoin weakness, 500K pre-market volume, float 165M. Added to short watchlist.
- For each watchlist candidate, mark key levels on the chart: previous day high/low, pre-market high/low, major support/resistance from daily chart.
- Narrow the watchlist to 3-5 actionable tickers. The scanner might surface 20-40 candidates, but focus is critical.

**8:30 - 9:30 AM: Level Setup and Mental Preparation**
- Draw horizontal lines at key price levels on each watchlist stock.
- Set price alerts at breakout/breakdown levels so the platform notifies the trader even if they are looking at a different chart.
- Review the trading plan: max risk per trade (typically 1-2% of account), max daily loss (often 3-5% of account), number of trades allowed.
- 5-15 minutes of mental rehearsal: visualize entries, stops, and targets for the top 2-3 setups.

### Market Open (9:30 - 10:30 AM ET) — The First Hour

This is the highest-volume, highest-volatility period. Most day traders make the majority of their daily P&L here.

**9:30 - 9:35 AM: Watch, Do Not Trade**
- Many experienced traders wait for the first 2-5 minutes to pass. The opening cross creates erratic price action. Spreads are wide. Fills are unpredictable.
- Watch how watchlist stocks react to the open. Does NVDA hold its pre-market high or sell off immediately? This tells you who is in control — buyers or sellers.

**9:35 - 9:45 AM: Opening Range Breakout Setups**
- The "opening range" is the high and low of the first 5-15 minutes. A breakout above the opening range high with volume is a long signal; below the low is a short signal.
- Example: NVDA opens at $142, trades between $140.50 and $143.20 for the first 10 minutes. At 9:42 AM it breaks $143.20 on a volume surge. Trader enters long at $143.25 with a stop at $142.00 (the opening range low) and a target at $146.00 (pre-market high).
- Order entry: Hit the buy hotkey (e.g., Shift+B for buy market, or Ctrl+B for buy at ask). Stop and target are entered as a bracket order — one click, three orders placed simultaneously.

**9:45 - 10:30 AM: Manage Positions and Take Follow-Up Trades**
- Trail stops as the position moves in favor. Move stop to breakeven once the trade is up 1R (one times the initial risk).
- Watch Level 2 and Time & Sales for signs of exhaustion: large orders hitting the bid, prints slowing down, bid/ask spread widening.
- If stopped out, review immediately: was the setup valid? Did execution follow the plan? Log the trade.
- Take a second or third trade if A+ setups present themselves. Avoid revenge trading after a loss.

### Mid-Day (10:30 AM - 2:30 PM ET) — The Chop Zone

Volume and volatility typically drop. Many day traders reduce position size or stop trading entirely during this window.

**10:30 AM - 12:00 PM: Consolidation Pattern Scanning**
- Switch from momentum plays to consolidation patterns: flags, pennants, and tight ranges forming on the 5-minute chart.
- Run an intraday scanner for stocks making new highs on above-average relative volume (RVOL > 2.0).
- Example: A stock that ran 10% at open is now consolidating in a tight range between $28.50 and $29.00 on the 5-minute chart. Volume is declining during the consolidation — this is healthy. A break above $29.00 with volume would trigger an entry.

**12:00 - 2:30 PM: Reduced Activity**
- Many traders take a break. The "lunch chop" is real — price action becomes rangebound and stop-hunts are common.
- Use this time to review morning trades, update the journal, and scan for power hour setups.
- Some traders switch to the daily chart to identify swing trade candidates forming setups.

### Power Hour (3:00 - 4:00 PM ET) — Final Push

**3:00 - 3:45 PM: Final Setups**
- Volume picks up as institutional traders rebalance and mutual funds execute end-of-day orders.
- Look for stocks that consolidated mid-day and are now breaking out of their range.
- VWAP reclaim plays: a stock that sold off in the morning, consolidated at VWAP mid-day, and breaks above VWAP into the close is a classic power hour long.
- This is also when swing traders enter positions they want to hold overnight.

**3:45 - 4:00 PM: Close Positions**
- Day traders close all intraday positions before 4:00 PM. No overnight risk.
- Exception: some traders intentionally hold a small winner into after-hours if there is a catalyst (earnings after close).

### Post-Market (4:00 - 6:00 PM ET) — Review and Prepare

**4:00 - 5:00 PM: Trade Journaling**
- Log every trade: ticker, entry price, exit price, stop level, target, position size, P&L, R-multiple, and a screenshot of the chart at entry.
- Tag each trade: setup type (opening range breakout, flag breakout, VWAP reclaim), emotional state (confident, hesitant, revenge), market conditions (trending, choppy, news-driven).
- Write 2-3 sentences on what went right and what could improve.

**5:00 - 6:00 PM: Next Day Preparation**
- Run an end-of-day scanner for stocks setting up: daily chart breakouts approaching resistance, earnings the next morning, stocks with unusual options activity.
- Build a preliminary watchlist for the next day (to be refined during pre-market).
- Review the economic calendar for the next session.

---

## 2. Screen Layouts

### The Standard Multi-Monitor Day Trading Setup

Most serious day traders use 2-4 monitors. The layout is a critical productivity tool — seconds matter when managing live positions.

**Dual Monitor Setup (Minimum Viable)**
- **Left Monitor:** Main charting window — 1-minute and 5-minute charts of the active stock. VWAP, moving averages (9 EMA, 20 EMA), and volume bars visible. Below the chart: Level 2 order book and Time & Sales columns.
- **Right Monitor:** Top half is the watchlist with key columns (symbol, last price, % change, volume, RVOL, float). Bottom half is the order entry panel and real-time P&L dashboard showing open positions, unrealized gain/loss, and daily total.

**Quad Monitor Setup (Standard for Full-Time Traders)**
- **Center-Left:** Primary chart — the stock currently being traded. 1-minute candlestick chart with VWAP, EMAs, and volume. This is the execution screen.
- **Center-Right:** Secondary charts — 2-4 smaller charts showing watchlist stocks, each linked to a different symbol. These update in real time but are for monitoring, not active trading.
- **Far Left:** Scanner/screener results updating in real time. Pre-market gap scanner in the morning, intraday momentum scanner after the open. Below the scanner: news feed widget.
- **Far Right (or Top):** Level 2 + Time & Sales for the active stock. Below that: the order entry panel with position size calculator, account P&L, and bracket order controls. Economic calendar widget in a corner.

### Layout Features a Platform Must Support

- **Saved Layout Templates:** Traders switch between pre-market layout (scanner-heavy) and active trading layout (chart-heavy). One-click switching between saved templates is essential.
- **Symbol Linking:** Click a ticker in the watchlist and every linked panel (chart, Level 2, Time & Sales, order entry) updates to that symbol instantly. Link groups use color coding (blue group, red group) so some panels can be independent.
- **Grid Configurations:** 2-chart split, 4-chart grid, 6-chart grid, and fully custom arrangements where the user drags panel edges to resize. Traders rearrange constantly depending on how many stocks are in play.
- **Tear-off Panels:** Drag any panel (chart, watchlist, order entry) out of the main window and onto another monitor. The panel operates independently but stays synced.
- **Hotkey-Driven Navigation:** Ctrl+1 through Ctrl+6 to switch focus between chart panels. No reaching for the mouse when a position needs immediate attention.

---

## 3. Scanner / Screener Requirements

### Pre-Market Gap Scanner (4:00 AM - 9:30 AM ET)

This is the single most important scanner for momentum day traders. It finds stocks that gapped overnight due to news, earnings, or macro events.

**Required Filters:**
- Gap percentage: minimum 3% (adjustable up to 10%+)
- Pre-market volume: minimum 50,000 shares (adjustable)
- Float: filter by small-cap (< 20M), mid-cap (20M-100M), or all
- Market cap: minimum $50M (filters out illiquid micro-caps)
- Price range: $2 - $500+ (most momentum traders focus on $5 - $50)
- Average daily volume: minimum 500K (ensures liquidity during regular hours)
- Sector filter: include/exclude specific sectors

**Output Columns:** Symbol, last price, gap %, pre-market volume, float, average volume, market cap, catalyst (news headline if available).

### Intraday Scanner (9:30 AM - 4:00 PM ET)

Continuously scans the market for emerging setups during trading hours.

**Key Scan Types:**
- **Volume Surge:** Stocks where current volume exceeds 2x, 3x, or 5x their average volume at that time of day (relative volume, or RVOL).
- **Price Momentum:** Stocks up more than 5% intraday on above-average volume.
- **New Highs/Lows:** Stocks making new 52-week highs or new intraday highs for the first time.
- **Breakout Scanner:** Stocks breaking above a user-defined resistance level or above the high of the day on volume.
- **Halt Scanner:** Stocks halted by the exchange (LULD halts) — traders prepare to trade the resumption.

**Critical Requirement: Real-Time Data**
Scanners must run on live data, not 15-minute delayed data. A stock that spiked 10% five minutes ago is old news. Traders need to see the spike as it happens — ideally within 1-2 seconds of the move.

### End-of-Day Scanner (3:30 PM - 8:00 PM ET)

Used to build the next day's watchlist.

**Scan Criteria:**
- Stocks that closed near their high of day (within 2%) on above-average volume — potential continuation the next morning.
- Stocks approaching a major resistance level on the daily chart.
- Stocks with earnings before/after the next session.
- Unusual options activity (high call/put volume relative to open interest).

### Custom Scanner Formulas

Power users want to write their own scan logic. Example: "Show me stocks where the 9 EMA just crossed above the 20 EMA on the 5-minute chart AND relative volume is above 2.0 AND price is above VWAP." This requires a formula editor or scripting language (like TradingView's Pine Script or ThinkorSwim's thinkScript).

---

## 4. Alert Systems

### Alert Types Traders Rely On

**Price Alerts**
- Price crosses above $185.00 (breakout alert)
- Price crosses below $42.50 (breakdown alert)
- Price enters range $100.00 - $105.00 (zone alert)

**Volume Alerts**
- Relative volume exceeds 3.0 (volume surge)
- Single candle volume exceeds 500K shares (block trade detection)

**Indicator Alerts**
- RSI crosses above 70 or below 30 (overbought/oversold)
- MACD histogram crosses zero (momentum shift)
- 9 EMA crosses 20 EMA on the 5-minute chart (moving average crossover)
- Price crosses VWAP from below (reclaim signal)

**Pattern Alerts**
- Consolidation breakout: price breaks the high of a range that lasted more than 30 minutes
- Trendline break: price crosses a drawn trendline

**News Alerts**
- Earnings release for watchlist stocks
- FDA approval/rejection for biotech watchlist
- SEC filings (13F, 8-K, insider transactions)
- Analyst upgrades/downgrades

### Alert Delivery

Traders need multiple delivery channels because they are not always at their desk:
- **In-app popup with sound** — the primary alert while actively trading. Customizable sounds per alert type (different tone for price alert vs. volume surge).
- **Push notification to mobile** — for when away from the desk. Must include the ticker, alert condition, and current price.
- **Email** — for non-urgent alerts (end-of-day scan results, overnight gap alerts).
- **SMS** — backup for critical alerts when push notifications might be delayed.
- **Webhook** — for traders who use automation. Trigger a webhook to Discord, Slack, or a custom bot.

### Alert Management

When a trader has 50-100 active alerts across their watchlist, management features become critical:
- **Folder organization:** Group alerts by category (breakout alerts, earnings alerts, swing setups).
- **Bulk edit:** Select 20 alerts and adjust a parameter (e.g., increase all breakout alert levels by 2%).
- **Snooze/pause:** Temporarily disable an alert without deleting it.
- **Alert history log:** View all triggered alerts with timestamps. "When did AAPL hit $190? Was it during power hour or mid-day?"
- **Expiration:** Set alerts to auto-delete after a date. A swing trade setup alert that has not triggered in two weeks is probably stale.

---

## 5. Order Entry Requirements

### Hot Keys (Non-Negotiable for Day Traders)

Day traders live and die by execution speed. Moving the mouse to a buy button, typing a price, and clicking confirm takes 3-5 seconds. Hot keys do it in under 0.5 seconds.

**Essential Hotkeys:**
- **Buy Market (Shift+B):** Instantly buy at the ask price. Position size determined by the pre-configured calculator.
- **Sell Market (Shift+S):** Instantly sell/flatten position at the bid price.
- **Buy Limit at Bid (Ctrl+B):** Place a limit order at the current best bid.
- **Buy Limit at Ask (Ctrl+A):** Place a limit order at the current ask.
- **Sell Half (Shift+H):** Sell 50% of the current position (scaling out of winners).
- **Flatten All (Ctrl+F):** Close every open position immediately. The panic button.
- **Cancel All Orders (Esc):** Remove all pending orders from the book.

Hotkeys must be fully customizable. Every trader has a different muscle-memory setup.

### Price Ladder / DOM (Depth of Market)

A vertical display showing every bid and ask price level with the number of shares at each level. Traders click directly on a price level to place a limit order there. They can also drag existing orders up or down the ladder to modify price. This is faster than retyping a new limit price.

### Position Sizing Calculator

This is the tool that keeps traders from blowing up their accounts.

**Inputs:**
- Account size: $50,000
- Risk per trade: 1% = $500
- Entry price: $25.00
- Stop-loss price: $24.50
- Stop distance: $0.50

**Calculation:** $500 / $0.50 = 1,000 shares

The calculator should auto-populate based on the chart's stop level. Trader clicks where they want their stop on the chart, and the position size updates automatically.

### Bracket Orders

A bracket order is three orders in one:
1. Entry order (buy 1,000 shares at $25.00 limit)
2. Stop-loss order (sell 1,000 shares at $24.50 stop)
3. Profit target order (sell 1,000 shares at $26.50 limit)

When the entry fills, the stop and target activate automatically. When either the stop or target fills, the other cancels automatically (OCO — one-cancels-other). This is how traders set up a trade and walk away from the screen without worrying about unmanaged risk.

### Chart-Based Order Modification

Traders want to drag their stop-loss and profit-target lines directly on the chart. Click the stop line, drag it from $24.50 to $24.75 (tightening the stop), release, and the order updates on the exchange. No ticket reentry required.

### Order Confirmation Toggle

Experienced traders want to skip the confirmation dialog for hotkey orders. Every millisecond counts. But new traders (and live accounts with large size) may want confirmation enabled. This must be a toggle per order type, not a global on/off.

---

## 6. Risk Management Tools

### Position Size Calculator (Expanded)

Beyond the basic calculation, advanced traders want:
- **Tiered risk:** Risk 0.5% on C-grade setups, 1% on B-grade, 2% on A+ setups.
- **Account heat:** Total exposure across all open positions. If the trader has 3 positions each risking 1%, account heat is 3%. Maximum account heat is usually capped at 5-6%.
- **Correlation check:** If the trader is long both AAPL and MSFT, they are effectively double-exposed to the tech sector. The platform should flag concentrated sector exposure.

### R-Multiple Tracking

The "R" is the dollar amount risked on a trade. If a trader risks $500 (1R) and makes $1,000, that is a +2R trade. If they lose $500, that is a -1R trade.

**Dashboard Display:**
- Average R per trade: +0.8R (healthy if above +0.3R)
- Largest win: +5.2R
- Largest loss: -1.5R (should always be close to -1R if stops are honored)
- R-distribution chart: histogram showing frequency of -1R, +1R, +2R, +3R outcomes

### Daily P&L with Loss Limit (Auto-Lock)

The most requested risk feature among retail day traders. Set a daily maximum loss (e.g., $1,000 or 2% of account). When the P&L for the day hits that threshold:
- All open positions are automatically closed.
- All pending orders are cancelled.
- The platform locks order entry for the remainder of the session.
- A summary screen appears: "Daily loss limit reached. P&L: -$1,000. Review your trades."

This prevents the catastrophic "revenge trading" spiral where a trader loses $500, gets emotional, doubles down, and turns a manageable loss into a $5,000 disaster.

### Performance Metrics Dashboard (Real-Time)

- Win rate (% of trades profitable)
- Profit factor (gross profit / gross loss — above 1.5 is solid)
- Average win vs. average loss ratio
- Expectancy per trade in dollars and R-multiples
- Current drawdown from equity peak
- Consecutive win/loss streaks
- Equity curve chart updated in real time after each trade

---

## 7. Paper Trading

### What Traders Demand from Paper Trading

Paper trading is how nearly every retail trader learns. The gap between paper and live trading is already large due to emotional factors — the platform should not make it worse with unrealistic simulation.

**Realistic Fills**
- Fill at the bid (for sells) and ask (for buys), not the mid-price. Paper fills at mid-price train traders to expect better execution than they will actually get.
- Simulate partial fills on large orders. If the trader paper-buys 10,000 shares of a stock trading 50K shares/day, they should not get an instant fill on the entire order.
- Simulate slippage on market orders. A market buy should fill 1-2 cents above the ask during volatile moments.

**Identical Interface**
- Paper trading must use the exact same interface, hotkeys, charting, and order entry as live trading. If the paper account has a different layout or different buttons, the muscle memory does not transfer.
- Supported on all platforms: ThinkorSwim (paperMoney), TradeStation (simulated trading), and Webull all do this well.

**Separate Paper and Live Accounts**
- One-click toggle between paper and live accounts, but with a clear visual indicator (e.g., green border for live, yellow border for paper) to prevent accidentally placing a real order while thinking you are in paper mode.

**Performance Tracking for Paper Trades**
- Full analytics on paper trades: win rate, average R, equity curve, calendar P&L.
- This data helps the trader decide when they are ready to go live.

**Transition Workflow**
- When a trader is consistently profitable on paper (e.g., 3 months of positive expectancy), the platform should offer a guided transition: "Your paper account has a profit factor of 1.8 over 200 trades. Consider starting with 25% of your intended live position size."

---

## 8. Trade Journal and Analytics

### Automatic Trade Logging

Manual trade journaling is tedious and most traders abandon it within weeks. The platform must log trades automatically.

**Auto-Captured Fields:**
- Ticker, direction (long/short), entry price, exit price, position size, entry time, exit time, duration held.
- P&L in dollars and as a percentage.
- R-multiple (requires knowing the initial stop — either from a bracket order or a manual tag).
- Commissions and fees.
- Chart screenshot at entry (auto-captured when the order fills).

### Tagging System

After each trade, the trader adds context through tags:
- **Setup Type:** Opening range breakout, flag breakout, VWAP reclaim, pullback to EMA, earnings gap, reversal.
- **Emotional State:** Confident, anxious, FOMO, revenge, disciplined.
- **Market Conditions:** Trending (SPY strong), choppy (SPY rangebound), news-driven, low-volume.
- **Grade:** A+ (perfect setup and execution), B (good setup, minor execution error), C (marginal setup), F (should not have taken the trade).

Over time, the tagging system reveals patterns: "I have a 68% win rate on A-grade opening range breakouts but only 31% on trades tagged FOMO."

### Performance Dashboard

- **Calendar View:** Heat map of daily P&L. Green for winning days, red for losing days, intensity proportional to size. Instantly shows winning/losing streaks and days of the week that perform differently.
- **Equity Curve:** Line chart of cumulative P&L over time. The slope indicates consistency. Drawdown periods are shaded.
- **Win Rate by Setup Type:** Bar chart showing win rate and average R for each setup tag.
- **Time-of-Day Analysis:** What time do the best trades happen? Most traders discover their edge is concentrated in the first hour.
- **Holding Time Analysis:** Are quick scalps (< 5 minutes) more profitable than longer holds (30+ minutes)? The data answers this objectively.

### Export

All trade data exportable to CSV, Excel, or PDF. Many traders use external tools (TraderSync, TradesViz, Edgewonk) for deeper analysis, so interoperability matters. Export should include all fields: timestamps, prices, tags, R-multiples, and notes.

---

## 9. Mobile Trading Must-Haves

### What Traders Actually Do on Mobile

Mobile trading is for monitoring and quick reactions, not for primary analysis or complex setups.

**Essential Mobile Features:**
- **Chart Viewing:** Full interactivity — pinch to zoom, scroll through time, tap to see OHLCV for any candle. Indicators must be available (VWAP, EMAs, RSI) but the layout is simplified to one chart at a time.
- **Quick Order Entry:** Swipe-to-buy, swipe-to-sell, or a simple buy/sell button with a position size pre-loaded from the calculator. Bracket orders should be available in 2-3 taps.
- **Alert Management:** Create, edit, snooze, and delete alerts from the phone. View triggered alert history.
- **Watchlist Management:** Add/remove tickers, reorder, and view the same watchlist columns as desktop (price, % change, volume, RVOL).
- **Push Notifications:** Real-time alerts for price, volume, and news events. Notifications must arrive within seconds, not minutes.
- **Portfolio View:** Open positions with real-time P&L (per position and total). Unrealized and realized P&L for the day.

### What Traders Say They Will NOT Do on Mobile

Based on trader discussions across forums and communities:
- **Complex technical analysis:** Drawing trendlines, Fibonacci retracements, or multi-indicator analysis on a 6-inch screen is frustrating and error-prone.
- **Multi-chart layouts:** The whole point of multi-chart setups is simultaneous comparison. A single phone screen cannot replicate this.
- **Scalping:** Scalpers need sub-second execution, Level 2, Time & Sales, and hotkeys. None of this works well on a phone.
- **Journal review and deep analytics:** Small screen makes charts and tables hard to read. Save this for desktop or tablet.

### Mobile as a Safety Net

The most common mobile trading scenario: the trader is away from their desk, an alert fires on their phone, they check the chart, and either close an existing position or set a new alert. They are not opening new complex positions — they are managing risk while away from the primary setup.

---

## 10. Swing Trader Workflows

Swing traders operate on a different cadence than day traders — holding positions for days to weeks rather than minutes to hours.

### Weekly Routine

**Sunday Evening (30-60 Minutes): Comprehensive Scan**
- Run end-of-week screeners on the daily and weekly charts.
- Scan for: stocks breaking out of multi-week bases, stocks pulling back to the 20-day or 50-day moving average on declining volume, stocks with earnings in the coming week.
- Build a watchlist of 20-30 candidates. This is the "universe" for the week.
- Set alerts at key breakout and breakdown levels for each candidate.

**Daily Morning (15-30 Minutes): Focused Review**
- Check overnight gaps on watchlist stocks.
- Review pre-market action: did any candidates gap through a key level?
- Narrow the watchlist to 5-10 "in the zone" stocks — those closest to triggering an entry.
- Check open positions: any stops need adjusting? Any targets hit overnight?

**During Market Hours: Passive Monitoring**
- Swing traders do not need to watch every tick. They set alerts and bracket orders in advance.
- Check the platform 2-3 times during the day, primarily at open (9:30-10:00 AM), mid-day (12:00 PM), and close (3:30-4:00 PM).
- Enter new positions when alerts fire and the setup is confirmed on the chart.

**Daily Evening (15 Minutes): Journal and Adjust**
- Log any new trades or exits.
- Adjust stops on winning positions (trail stops higher as the trend continues).
- Remove stale alerts for stocks that have moved past their setup window.

### Swing Trade Watchlist Management

Swing traders typically maintain two tiers:
- **Broad Watchlist (50-200 stocks):** Refreshed weekly. These are all the stocks that could potentially produce a setup in the next 1-2 weeks. Built from sector scans, relative strength rankings, and pattern recognition.
- **Focus List (5-20 stocks):** Refreshed daily. These are stocks with active, near-term setups — within 1-3 days of triggering an entry.

The platform must support multiple named watchlists with drag-and-drop reordering, custom columns, and the ability to share watchlists between devices (desktop and mobile sync).

---

## Summary: Features a Trading Platform Must Nail

| Category | Day Trader Priority | Swing Trader Priority |
|---|---|---|
| Scanner / Screener | Real-time intraday, gap scanner | End-of-day, weekly pattern scans |
| Chart Layout | Multi-chart grid, symbol linking | Single chart with daily/weekly views |
| Order Entry | Hotkeys, sub-second execution | Bracket orders, alert-triggered entry |
| Risk Management | Daily loss limit, auto-lock | Position size calculator, sector exposure |
| Alerts | Price, volume, indicator — instant delivery | Price, pattern — overnight/multi-day |
| Journal | Auto-log every trade, tag and grade | Auto-log entries/exits, track hold duration |
| Mobile | Monitor positions, emergency exits | Check alerts, review charts, enter orders |
| Paper Trading | Realistic fills, same interface as live | Less critical (swing trades are slower) |
| Screen Layout | 2-4 monitors, saved templates | 1-2 monitors, simpler layouts |

The platform that serves retail traders well is one that integrates all of these workflows into a single environment — scanner results feed into the watchlist, the watchlist feeds into the chart, the chart feeds into the order entry, the order entry feeds into the journal, and the journal feeds into the analytics dashboard. Every disconnected handoff (copying a ticker from one app to another, manually logging a trade in a spreadsheet) is friction that costs traders time and accuracy.
