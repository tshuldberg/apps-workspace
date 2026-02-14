# Technical Analysis & Charting — Complete Reference

> Research document for TheMarlinTraders platform. Covers chart types, technical indicators, drawing tools, pattern recognition, multi-timeframe analysis, and comparison/overlay features.

---

## 1. Chart Types

Every trading platform must support a range of chart types. Each type reveals different aspects of price action — trend clarity, noise filtering, volume integration, or time independence. The table below catalogs every chart type a TradingView-level platform should implement.

### 1.1 Standard Chart Types

| Chart Type | Construction | Best Use Case |
|---|---|---|
| **Candlestick (Japanese)** | Each candle shows Open, High, Low, Close (OHLC) for one period. A filled/red body means Close < Open; hollow/green means Close > Open. Wicks extend to high and low. | The default for most traders. Reveals intrabar sentiment, reversal patterns (doji, hammer, engulfing), and trend strength at a glance. |
| **OHLC Bars** | Vertical line from Low to High. Left tick = Open, right tick = Close. No filled body. | Preferred by futures and commodity traders who want the same OHLC data without the visual weight of candlestick bodies. Less cluttered at high density. |
| **Line** | Connects closing prices with a single continuous line. | Cleanest view of overall trend direction. Used in overlays and comparisons where multiple symbols must share one chart without clutter. |
| **Area (Mountain)** | Line chart with the region between the line and the x-axis filled with a gradient or solid color. | Visually emphasizes magnitude of price relative to zero or a baseline. Popular in portfolio dashboards and news-media charts. |
| **Baseline** | Line chart with a configurable reference level (e.g., VWAP or a fixed price). Area above baseline is green; area below is red. | Shows whether price is above or below a key reference in real time. Useful for mean-reversion strategies and VWAP-based intraday trading. |
| **Hollow Candles** | Like candlestick, but if Close > previous Close the body is hollow (outline only); if Close < previous Close the body is filled. Color encodes close-vs-open; fill encodes close-vs-previous-close. | Adds a second dimension of information versus standard candles: both intrabar direction and interbar direction are visible simultaneously. |
| **Colored Bars** | OHLC bars where the bar color reflects a condition (e.g., green if Close > Open, red otherwise), customizable per indicator. | Quick visual encoding of any boolean condition on standard OHLC bars. |
| **Step Line** | Horizontal segments at each closing price connected by vertical jumps. No diagonal lines. | Highlights discrete price levels and holding periods. Useful for instruments with low tick frequency or for plotting indicator levels. |

### 1.2 Non-Standard (Synthetic) Chart Types

Non-standard charts derive synthetic OHLC values from raw data. They filter noise, remove time, or reorganize data by price movement alone. Strategies backtested on non-standard charts can produce unrealistic results because the synthetic values differ from actual trade prices — platforms must warn users about this.

| Chart Type | Construction | Best Use Case |
|---|---|---|
| **Heikin-Ashi** | Synthetic candles where: HA_Close = (O+H+L+C)/4, HA_Open = (prev_HA_Open + prev_HA_Close)/2, HA_High = max(H, HA_Open, HA_Close), HA_Low = min(L, HA_Open, HA_Close). | Smooths out noise and makes trends easier to read. Long sequences of same-colored candles confirm trend; doji-like candles signal reversals. Not suitable for precise entry/exit since values are averaged. |
| **Renko** | Price-only bricks of a fixed "box size" (e.g., $2). A new brick is drawn only when price moves the full box size beyond the previous brick's close. Bricks are always at 45-degree angles. Time is ignored. | Eliminates time-based noise entirely. Clear trend visualization — consecutive same-color bricks = strong trend. Reversal requires price to move 2x box size in opposite direction. Used for support/resistance identification. |
| **Kagi** | A continuous vertical line that reverses direction when price moves by a user-defined "reversal amount." Thick lines (yang) indicate price above a prior swing high; thin lines (yin) indicate price below a prior swing low. No time axis. | Filters out small price fluctuations. Transitions between thick and thin lines generate buy/sell signals. Used for longer-term trend identification. |
| **Point & Figure (P&F)** | Columns of X's (rising prices) and O's (falling prices). Each X or O represents a fixed "box size." A new column starts when price reverses by a configurable number of boxes (typically 3). No time axis. | Pure price-action analysis. Generates clear support/resistance levels, breakout signals, and price targets. The 3-box reversal is the classic setting. |
| **Range Bars** | Each bar spans exactly N price units (e.g., 10 ticks). A new bar starts only when the range is filled. Time is not uniform. | Normalizes volatility across bars — every bar has the same range. Helps identify breakouts because a rapid succession of bars indicates high momentum. |
| **Tick Charts** | Each bar represents N trades (ticks), not N time units. In high-activity periods bars form quickly; in quiet periods they form slowly. | Reveals volume-of-activity patterns invisible on time charts. Scalpers use tick charts (e.g., 233-tick) to see institutional order flow. |
| **Volume Bars** | Each bar represents N contracts/shares traded. Similar to tick charts but aggregated by volume instead of trade count. | Ensures each bar carries equal "weight" of market participation. Useful for detecting accumulation/distribution phases. |
| **Line Break** | A series of vertical boxes based on price changes. A new box is drawn when the close exceeds the high (or low) of the prior N boxes (typically 3). | Filters out reversals that fail to exceed recent extremes. Clean trend signals with fewer whipsaws than standard charts. |

---

## 2. Technical Indicators

Indicators are mathematical transformations of price, volume, and/or time data overlaid on or displayed below the chart. Below is a comprehensive catalog organized by category, with formulas, default parameters, and trading applications.

### 2.1 Trend Indicators

Trend indicators help identify the direction and strength of the prevailing price movement.

| Indicator | Formula / Calculation | Default Params | Use Case |
|---|---|---|---|
| **SMA (Simple Moving Average)** | SMA(n) = Sum(Close, n) / n | 20, 50, 200 | Baseline trend identification. 50/200 SMA crossover ("golden cross" / "death cross") is a widely watched signal. |
| **EMA (Exponential Moving Average)** | EMA_today = Close * k + EMA_yesterday * (1-k), where k = 2/(n+1) | 12, 26, 50 | More responsive than SMA. Foundation of MACD. Faster signal generation for swing trading. |
| **WMA (Weighted Moving Average)** | Assigns linearly decreasing weights: most recent period gets weight n, next gets n-1, etc. WMA = Sum(weight_i * Close_i) / Sum(weight_i) | 20 | Middle ground between SMA and EMA. Less lag than SMA, different smoothing profile than EMA. |
| **DEMA (Double EMA)** | DEMA = 2 * EMA(Close, n) - EMA(EMA(Close, n), n) | 20 | Reduces lag further by subtracting the double-smoothed version. Used in fast-moving markets. |
| **TEMA (Triple EMA)** | TEMA = 3*EMA1 - 3*EMA2 + EMA3, where EMA1 = EMA(Close,n), EMA2 = EMA(EMA1,n), EMA3 = EMA(EMA2,n) | 20 | Maximum lag reduction among EMA variants. Best for highly responsive crossover systems. |
| **VWMA (Volume-Weighted MA)** | VWMA(n) = Sum(Close_i * Volume_i, n) / Sum(Volume_i, n) | 20 | Weights price by volume — high-volume bars influence the average more. Reveals the "true" average price traders paid. |
| **Hull MA (HMA)** | Step 1: WMA_half = WMA(Close, n/2). Step 2: WMA_full = WMA(Close, n). Step 3: raw = 2*WMA_half - WMA_full. Step 4: HMA = WMA(raw, sqrt(n)). | 9 | Alan Hull's design minimizes lag while maintaining smoothness. Excellent for trend detection in medium-timeframe swing trading. |
| **MACD** | MACD Line = EMA(Close,12) - EMA(Close,26). Signal Line = EMA(MACD Line, 9). Histogram = MACD Line - Signal Line. | 12, 26, 9 | Trend direction + momentum. Signal line crossovers generate buy/sell signals. Histogram shows acceleration/deceleration of trend. Divergences with price predict reversals. |
| **ADX / DI (Average Directional Index)** | +DM = max(High - prev_High, 0) if > -DM, else 0. -DM = max(prev_Low - Low, 0) if > +DM, else 0. Smooth over 14 periods. +DI = 100 * Smoothed(+DM) / ATR. -DI = 100 * Smoothed(-DM) / ATR. DX = 100 * abs(+DI - -DI) / (+DI + -DI). ADX = Smoothed(DX, 14). | 14 | ADX measures trend strength (0-100) without direction. +DI/-DI crossovers indicate direction. ADX > 25 = trending market; < 20 = ranging. Used to decide whether to apply trend-following or mean-reversion strategies. |
| **Parabolic SAR** | SAR_next = SAR_current + AF * (EP - SAR_current). AF starts at 0.02, increments by 0.02 at each new extreme, max 0.20. EP = extreme point (highest high in uptrend, lowest low in downtrend). | AF step: 0.02, max: 0.20 | Trailing stop that accelerates toward price. Dots flip from below to above price (or vice versa) to signal trend reversal. Best in strongly trending markets; generates whipsaws in ranges. |
| **Ichimoku Cloud** | Tenkan-sen = (9-period High + 9-period Low) / 2. Kijun-sen = (26-period High + 26-period Low) / 2. Senkou Span A = (Tenkan + Kijun) / 2, plotted 26 periods ahead. Senkou Span B = (52-period High + 52-period Low) / 2, plotted 26 periods ahead. Chikou Span = Close plotted 26 periods back. | 9, 26, 52 | Complete trading system in one indicator. Cloud (Kumo) shows support/resistance, Tenkan/Kijun crossovers generate signals, Chikou confirms. Cloud color shows future trend direction. Extremely popular in forex and crypto. |
| **Supertrend** | hl2 = (High + Low) / 2. Upper Band = hl2 + (multiplier * ATR(n)). Lower Band = hl2 - (multiplier * ATR(n)). Final band selection depends on previous close relative to previous bands. | ATR length: 10, multiplier: 3 | Simple trend-following overlay. Green line below price = uptrend; red line above = downtrend. Flips provide buy/sell signals. Cleaner than Parabolic SAR in trending markets. |
| **Aroon** | Aroon Up = 100 * (n - periods since n-period High) / n. Aroon Down = 100 * (n - periods since n-period Low) / n. | 25 | Measures how recently price made a new high or low. Aroon Up > 70 + Aroon Down < 30 = strong uptrend. Crossovers signal trend changes. Oscillator version = Aroon Up - Aroon Down. |

### 2.2 Momentum Indicators (Oscillators)

Momentum indicators oscillate between bounds and identify overbought/oversold conditions, divergences, and momentum shifts.

| Indicator | Formula / Calculation | Default Params | Use Case |
|---|---|---|---|
| **RSI (Relative Strength Index)** | RS = Avg Gain over n periods / Avg Loss over n periods. RSI = 100 - (100 / (1 + RS)). Uses Wilder's smoothing (exponential). | 14 | Range: 0-100. Overbought > 70, oversold < 30. Bullish/bearish divergences predict reversals. Failure swings provide high-probability signals. Most widely used oscillator. |
| **Stochastic Oscillator** | %K = 100 * (Close - Low_n) / (High_n - Low_n). %D = SMA(%K, 3). Slow Stochastic: Slow%K = Fast%D, Slow%D = SMA(Slow%K, 3). | %K period: 14, %D period: 3 | Range: 0-100. Overbought > 80, oversold < 20. %K/%D crossovers in extreme zones generate signals. Measures where price closed relative to its range. |
| **CCI (Commodity Channel Index)** | Typical Price = (H+L+C)/3. CCI = (Typical Price - SMA(Typical Price, n)) / (0.015 * Mean Deviation). | 20 | Unbounded oscillator (no fixed range). +100/-100 thresholds for overbought/oversold. Divergences work well. Originally designed for commodities but used universally. |
| **Williams %R** | %R = -100 * (Highest High_n - Close) / (Highest High_n - Lowest Low_n) | 14 | Range: -100 to 0. Overbought: -20 to 0. Oversold: -100 to -80. Mathematically inverse of Fast Stochastic %K. Fast-responding momentum gauge. |
| **ROC (Rate of Change)** | ROC = 100 * (Close - Close_n) / Close_n | 12 | Unbounded. Measures percentage change over n periods. Zero-line crossovers signal momentum shifts. Simpler alternative to MACD for pure momentum measurement. |
| **MFI (Money Flow Index)** | Typical Price = (H+L+C)/3. Raw Money Flow = TP * Volume. Positive/Negative MF separated by TP direction. Money Ratio = Positive MF / Negative MF. MFI = 100 - (100 / (1 + Money Ratio)). | 14 | "Volume-weighted RSI." Range: 0-100. Overbought > 80, oversold < 20. Incorporates volume into momentum — more reliable divergences than RSI alone. |
| **Ultimate Oscillator** | BP = Close - min(Low, prev Close). TR = max(High, prev Close) - min(Low, prev Close). Three averages: Avg7, Avg14, Avg28 of BP/TR. UO = 100 * [(4*Avg7) + (2*Avg14) + Avg28] / 7. | 7, 14, 28 | Larry Williams' multi-timeframe momentum oscillator. Reduces false signals by combining three timeframes. Buy/sell signals require divergence + oscillator break + confirmation. |
| **Awesome Oscillator (AO)** | AO = SMA(Median Price, 5) - SMA(Median Price, 34), where Median Price = (H+L)/2. | 5, 34 | Bill Williams' indicator. Histogram oscillates around zero. "Saucer" setups (pullback within trend), twin peaks (divergence), and zero-line crossovers generate signals. |
| **TRIX** | EMA1 = EMA(Close, n). EMA2 = EMA(EMA1, n). EMA3 = EMA(EMA2, n). TRIX = 100 * (EMA3 - prev EMA3) / prev EMA3. Signal = EMA(TRIX, signal_n). | 15, signal: 9 | Triple-smoothed rate of change. Filters out insignificant price movements. Zero-line and signal-line crossovers indicate trend changes. Very smooth — minimal whipsaws. |

### 2.3 Volume Indicators

Volume indicators confirm price movements and reveal accumulation/distribution dynamics invisible on price charts alone.

| Indicator | Formula / Calculation | Default Params | Use Case |
|---|---|---|---|
| **OBV (On-Balance Volume)** | If Close > prev Close: OBV = prev OBV + Volume. If Close < prev Close: OBV = prev OBV - Volume. If Close = prev Close: OBV unchanged. | N/A | Leading indicator. OBV divergence from price predicts reversals (e.g., price makes new high but OBV does not = bearish divergence). Confirms breakouts when OBV also breaks to new high. |
| **VWAP (Volume-Weighted Average Price)** | VWAP = Cumulative(Typical Price * Volume) / Cumulative(Volume). Resets on anchor period (session, week, month, etc.). Standard deviation bands optional. | Anchor: Session, Source: hlc3 | Institutional benchmark. Price above VWAP = bullish; below = bearish. Institutional traders target VWAP for execution — acts as intraday support/resistance. Standard deviation bands (1, 2, 3 SD) create dynamic channels. |
| **Volume Profile — Fixed Range** | Aggregates volume at each price level within a user-defined time window. Displays as a horizontal histogram beside the price axis. Key levels: POC (Point of Control = highest volume price), Value Area High/Low (covering ~70% of volume). | Row size: auto | Reveals where significant trading activity occurred in a specific range. POC acts as a magnet for price. Value Area boundaries act as support/resistance. Used by futures and options traders for entry/exit planning. |
| **Volume Profile — Session** | Same as Fixed Range but automatically resets and recalculates each trading session. | Row size: auto | Intraday traders use session VP to identify the developing POC and value area in real time. Useful for day trading index futures and forex. |
| **Volume Profile — Visible Range** | Same calculation but applied to whatever bars are currently visible on the chart. Dynamically recalculates as the user scrolls/zooms. | Row size: auto | Adapts to the trader's current view. Quick way to see volume distribution for any ad-hoc time window. |
| **Accumulation/Distribution (A/D)** | Money Flow Multiplier = [(Close - Low) - (High - Close)] / (High - Low). Money Flow Volume = MFM * Volume. A/D = prev A/D + Money Flow Volume. | N/A | Measures the cumulative flow of money into or out of a security. Rising A/D confirms uptrend; falling A/D confirms downtrend. Divergences signal potential reversals. |
| **Chaikin Money Flow (CMF)** | CMF = Sum(Money Flow Volume, n) / Sum(Volume, n), where Money Flow Volume uses the same A/D multiplier. | 20 | Bounded version of A/D over a lookback window. CMF > 0 = buying pressure; CMF < 0 = selling pressure. Useful for confirming breakouts — breakout with high CMF has higher probability of follow-through. |
| **Klinger Oscillator** | Combines volume, price trend, and high-low range into a volume force metric. KO = EMA(Volume Force, 34) - EMA(Volume Force, 55). Signal = EMA(KO, 13). | 34, 55, 13 | Designed to detect long-term money flow trends while remaining sensitive to short-term fluctuations. Signal line crossovers and zero-line crossovers generate signals. |

### 2.4 Volatility Indicators

Volatility indicators measure the rate and magnitude of price changes, creating dynamic envelopes and signaling expansion/contraction regimes.

| Indicator | Formula / Calculation | Default Params | Use Case |
|---|---|---|---|
| **Bollinger Bands** | Middle = SMA(Close, n). Upper = Middle + (k * StdDev(Close, n)). Lower = Middle - (k * StdDev(Close, n)). Bandwidth = (Upper - Lower) / Middle. %B = (Close - Lower) / (Upper - Lower). | n=20, k=2 | Volatility envelope. Bands widen in high volatility, narrow in low ("squeeze"). Price touching upper band = overbought (in range); walking the band = strong trend. Squeeze + breakout is a high-probability setup. |
| **ATR (Average True Range)** | TR = max(High-Low, abs(High - prev Close), abs(Low - prev Close)). ATR = Wilder's smoothing of TR over n periods: ATR = [(prev ATR * (n-1)) + TR] / n. | 14 | Measures volatility magnitude (not direction). Used to set stop-losses (e.g., 2x ATR), position sizing, and as input to other indicators (Supertrend, Keltner). Higher ATR = more volatile. |
| **Keltner Channels** | Middle = EMA(Close, n). Upper = Middle + (k * ATR(m)). Lower = Middle - (k * ATR(m)). | EMA: 20, ATR: 10, multiplier: 2 | ATR-based volatility envelope (vs. Bollinger's standard deviation). Smoother than Bollinger Bands. Keltner inside Bollinger = squeeze. Breakout beyond Keltner after squeeze = strong directional move. |
| **Donchian Channels** | Upper = Highest High over n periods. Lower = Lowest Low over n periods. Middle = (Upper + Lower) / 2. | 20 | Purely price-based channels. Breakout above upper channel = buy signal (turtle trading). Richard Dennis and the Turtle Traders famously used 20-day and 55-day Donchian breakouts. |
| **Standard Deviation** | StdDev = sqrt(Sum((Close_i - SMA)^2, n) / n) | 20 | Raw volatility measurement. Used as building block for Bollinger Bands and Z-score analysis. Rising StdDev = expanding volatility. |
| **Historical Volatility (HV)** | Daily returns = ln(Close / prev Close). HV = StdDev(returns, n) * sqrt(252) for annualized. | 20 | Annualized volatility measure. Used in options pricing (comparison to implied volatility), risk management, and position sizing. HV << IV = options expensive (sell premium); HV >> IV = options cheap (buy premium). |
| **Choppiness Index** | CI = 100 * LOG10(Sum(ATR(1), n) / (Highest High_n - Lowest Low_n)) / LOG10(n) | 14 | Range: 0-100. High values (> 61.8) = choppy/ranging market. Low values (< 38.2) = trending market. Used as a filter: apply trend-following strategies only when CI is low; apply mean-reversion when CI is high. |

### 2.5 Custom / Composite Indicators

Modern platforms must support user-created indicators. The dominant approach is TradingView's Pine Script model.

**Pine Script Approach:**
- Domain-specific language designed for financial calculations.
- Declarative model: each script runs once per bar, left to right.
- Built-in functions for all standard indicators (`ta.sma()`, `ta.ema()`, `ta.rsi()`, etc.).
- `input()` function exposes parameters to the UI settings panel.
- `plot()`, `plotshape()`, `plotchar()` for visual output.
- `strategy.*` functions for backtesting (entry, exit, position sizing).
- Scripts can reference other timeframes via `request.security()`.
- Community marketplace for sharing/selling indicators.

**Implementation Requirements for a Platform:**
1. **Script editor** with syntax highlighting and autocomplete.
2. **Built-in function library** covering all standard indicators.
3. **Plotting API** for lines, histograms, shapes, fills, labels, and tables.
4. **Input system** for dynamic parameter adjustment via the settings panel.
5. **Multi-timeframe data access** without repainting issues.
6. **Backtesting engine** that executes strategy scripts against historical data.
7. **Community infrastructure** for publishing, versioning, and discovering scripts.
8. **Security sandboxing** to prevent malicious scripts from accessing user data or system resources.

---

## 3. Drawing Tools

Drawing tools allow traders to annotate charts with technical analysis constructs — trendlines, Fibonacci levels, wave counts, patterns, and measurement tools. A comprehensive platform needs the full spectrum below.

### 3.1 Lines & Channels

| Tool | Description |
|---|---|
| **Trendline** | Line segment connecting two price points. The most fundamental drawing tool — connects swing lows (uptrend support) or swing highs (downtrend resistance). |
| **Ray** | Line starting at a point and extending infinitely in one direction. Used when the trader expects a level to hold into the future. |
| **Extended Line** | Line extending infinitely in both directions through two points. Used for identifying long-range support/resistance angles. |
| **Horizontal Line** | Infinite horizontal line at a specific price. Marks key support/resistance, round numbers, and pivot levels. |
| **Vertical Line** | Infinite vertical line at a specific time. Marks events — earnings releases, FOMC meetings, session opens/closes. |
| **Parallel Channel** | Two parallel trendlines creating a price channel. Defines the trend's boundaries — bounces off channel lines generate trade signals. |
| **Regression Channel** | Linear regression line with equidistant upper/lower bounds based on standard deviation. Statistically derived channel showing the "best fit" trend with deviation bands. |
| **Flat Top/Bottom Channel** | Channel with one horizontal boundary and one angled boundary. Models ascending/descending triangles and other asymmetric patterns. |

### 3.2 Fibonacci Tools

Fibonacci tools map proportional price relationships based on the Fibonacci sequence ratios (23.6%, 38.2%, 50%, 61.8%, 78.6%, 100%, 161.8%, 261.8%, 423.6%).

| Tool | Description |
|---|---|
| **Fibonacci Retracement** | Horizontal levels between two price points (swing high/low) at Fibonacci ratios. Identifies potential support/resistance during pullbacks. 38.2%, 50%, and 61.8% are the most-watched levels. |
| **Fibonacci Extension** | Projects price targets beyond the initial move using Fibonacci ratios (100%, 161.8%, 261.8%). Used to set profit targets after a retracement completes. |
| **Fibonacci Fan** | Diagonal lines from a price point through Fibonacci retracement levels, creating a fan of trendlines. Dynamic support/resistance that changes slope over time. |
| **Fibonacci Arcs** | Semicircular arcs centered on a price point at Fibonacci distances. Combines price and time dimensions — support/resistance that curves with time. |
| **Fibonacci Time Zones** | Vertical lines at Fibonacci intervals from a starting point (1, 1, 2, 3, 5, 8, 13, 21, 34...). Predicts when future reversals or significant moves may occur based on Fibonacci time relationships. |
| **Fibonacci Circles** | Full circles at Fibonacci price distances. Combines price and time in all directions — useful for cyclical analysis. |
| **Fibonacci Spiral** | A logarithmic spiral based on the golden ratio. Esoteric tool used by some technical analysts to identify natural growth/decay patterns in price. |

### 3.3 Gann Tools

W.D. Gann's tools are based on the premise that price and time move in predictable geometric relationships.

| Tool | Description |
|---|---|
| **Gann Fan** | Multiple rays emanating from a price point at specific angles (1x1 = 45 degrees, 2x1, 1x2, etc.). Each ray represents a price/time ratio. The 1x1 line (45 degrees) is the most important — price above it = bullish, below = bearish. |
| **Gann Square** | A grid overlaying price and time in equal proportional units. Used to find price/time intersections that may act as turning points. |
| **Gann Box** | Rectangle defined by price and time ranges, divided into internal grid lines based on Gann proportions. Identifies internal support/resistance and timing levels within a defined range. |

### 3.4 Elliott Wave Tools

Elliott Wave theory posits that market prices unfold in recognizable wave patterns (5-wave impulse + 3-wave correction).

| Tool | Description |
|---|---|
| **Impulse Wave (12345)** | Labels for the five-wave motive pattern: waves 1, 2, 3, 4, 5. Includes guidelines: wave 2 cannot retrace beyond wave 1 start; wave 3 cannot be the shortest; wave 4 cannot overlap wave 1 territory. |
| **Corrective Wave (ABC)** | Labels for the three-wave corrective pattern. Subtypes: zigzag (5-3-5), flat (3-3-5), triangle (3-3-3-3-3). |
| **Degree Labeling** | Hierarchical wave degree labels: Grand Supercycle, Supercycle, Cycle, Primary, Intermediate, Minor, Minute, Minuette, Sub-Minuette. Each degree uses a different notation style (Roman numerals, numbers, letters). |
| **Wave Projections** | Fibonacci-based projections of wave targets. Wave 3 target from wave 1 length (typically 161.8%). Wave 5 target from waves 1-3. Wave C target from wave A. Auto-drawn when wave counts are placed. |

### 3.5 Pattern Templates

| Tool | Description |
|---|---|
| **XABCD Pattern** | Five-point harmonic pattern. Subtypes: Gartley (B at 61.8%, D at 78.6%), Butterfly (D beyond X), Bat (B at 38.2-50%), Crab (D at 161.8%), Shark. Each has specific Fibonacci ratio requirements at each point. |
| **Cypher Pattern** | Harmonic pattern: B at 38.2-61.8% of XA, C at 113-141.4% of XA, D at 78.6% of XC. |
| **Head & Shoulders Template** | Predefined shape for marking the left shoulder, head, right shoulder, and neckline of the H&S reversal pattern. |
| **Three Drives Pattern** | Harmonic pattern with three successive pushes at Fibonacci-related intervals. |

### 3.6 Shapes & Annotations

| Tool | Description |
|---|---|
| **Rectangle** | Rectangular highlight area between two price/time points. Marks consolidation zones, supply/demand areas, or order blocks. |
| **Circle / Ellipse** | Circular/elliptical highlight. Marks specific chart formations or points of interest. |
| **Triangle** | Three-point shape. Marks triangle patterns or custom areas. |
| **Arc** | Curved line between two points. Marks curved support/resistance. |
| **Polyline** | Multi-segment connected line. Freeform annotation for complex patterns. |
| **Text** | Standalone text label at any chart position. Notes, trade rationale, alerts. |
| **Callout** | Text with a connecting line to a specific price/time point. Annotates specific bars with explanations. |
| **Price Label** | Label showing a specific price value, anchored to the price axis. Marks target prices, entries, stops. |
| **Note / Anchored Note** | Extended text annotation anchored to a specific bar. Detailed trade analysis or journal entries attached to specific chart points. |
| **Signpost** | Vertical label with an icon (flag, arrow, etc.) at a specific bar. Marks key events (earnings, news, signals). |

### 3.7 Measurement Tools

| Tool | Description |
|---|---|
| **Price Range** | Measures vertical distance between two price levels. Shows absolute price change, percentage change, and number of bars. |
| **Date Range** | Measures horizontal distance between two time points. Shows duration in bars and calendar time. |
| **Date & Price Range** | Combined measurement showing both price and time dimensions between two points. Includes risk/reward ratio when measuring from entry to stop and target. |
| **Bars Pattern** | Copies a section of price bars and projects them forward as a "ghost feed." Used to visualize how a similar historical pattern would play out from the current position. |
| **Ghost Feed** | Overlay of historical price action projected forward in time. Compares current market structure to a past analogous period. |

---

## 4. Chart Pattern Recognition

Automated pattern recognition scans price data for classical chart formations. Algorithms use techniques including pivot point identification, trendline fitting, geometric template matching, Dynamic Time Warping (DTW), Hidden Markov Models (HMMs), and machine learning classifiers.

### 4.1 Reversal Patterns

Reversal patterns signal that the current trend is ending and price is likely to reverse direction.

| Pattern | Structure | Signal | Notes |
|---|---|---|---|
| **Head & Shoulders** | Three peaks: left shoulder, higher head, right shoulder of similar height. Neckline connects the two troughs. | Bearish reversal when price breaks below neckline. Target = head height projected below neckline. | One of the most reliable patterns (~89% success rate with confirmation). Inverse H&S is the bullish counterpart. |
| **Double Top** | Two peaks at approximately the same price level separated by a trough. | Bearish when price breaks below the trough (support). Target = pattern height projected below support. | Requires both peaks to be within ~3% of each other. ~73-88% accuracy. |
| **Double Bottom** | Two troughs at approximately the same level separated by a peak. | Bullish when price breaks above the peak (resistance). Target = pattern height projected above resistance. | Bullish counterpart of double top. Volume should increase on the breakout. |
| **Triple Top / Bottom** | Three peaks or troughs at approximately the same level. | Similar to double top/bottom but with stronger confirmation from the third test. | Rarer and more reliable than double tops/bottoms. |
| **Rounding Bottom (Saucer)** | Gradual, U-shaped decline and recovery over an extended period. | Long-term bullish reversal. Breakout above the rim of the "saucer." | Indicates slow accumulation and sentiment shift. Often takes months to form. |

### 4.2 Continuation Patterns

Continuation patterns indicate a temporary pause in the current trend before it resumes.

| Pattern | Structure | Signal | Notes |
|---|---|---|---|
| **Flag (Bull/Bear)** | Sharp move (flagpole) followed by a small rectangular consolidation that slopes against the trend. | Breakout in the direction of the flagpole. Target = flagpole length projected from breakout point. | ~91% reliability with confirmation. Duration typically 1-4 weeks. Volume declines during flag, expands on breakout. |
| **Pennant** | Sharp move followed by converging trendlines (small symmetrical triangle). | Same as flag — breakout in trend direction. | Shorter duration than flags. Often forms over 1-3 weeks. |
| **Wedge (Rising/Falling)** | Converging trendlines both sloping in the same direction. Rising wedge = bearish; falling wedge = bullish. | Breakout against the wedge direction. | Can be either reversal or continuation depending on context. Shrinking volume within the wedge is typical. |
| **Rectangle** | Price oscillates between horizontal support and resistance. | Breakout in the direction of the prior trend. Can also resolve as a reversal. | Duration varies. Volume pattern (increase on breakout) confirms direction. |
| **Ascending Triangle** | Flat upper resistance with rising lower trendline. | Bullish — buyers are increasingly aggressive (higher lows). Breakout above flat resistance. | Target = triangle height projected above resistance. ~75% bullish resolution. |
| **Descending Triangle** | Flat lower support with falling upper trendline. | Bearish — sellers are increasingly aggressive (lower highs). Breakdown below flat support. | Bearish counterpart of ascending triangle. |
| **Symmetrical Triangle** | Converging trendlines with no directional bias (lower highs + higher lows). | Typically continues in the direction of the prior trend. Can break either way. | Decreasing volume within triangle. Breakout should occur in the first 2/3 of triangle's length. |

### 4.3 Complex Patterns

| Pattern | Structure | Signal | Notes |
|---|---|---|---|
| **Cup & Handle** | U-shaped cup followed by a small downward-drifting consolidation (handle). | Bullish. Breakout above the handle resistance. Target = cup depth projected above breakout. | Duration: 7 weeks to 65 weeks (per O'Neil). Handle should retrace no more than 1/3 of cup depth. |
| **Diamond** | Broadening formation followed by a symmetrical triangle, creating a diamond shape. | Reversal (usually bearish at tops). Breakout below the lower trendline. | Rare pattern. Resembles a broadening top that then contracts. |
| **Broadening Formation (Megaphone)** | Diverging trendlines — higher highs and lower lows creating an expanding range. | Indicates increasing volatility and indecision. Often bearish when it appears at market tops. | Difficult to trade. Usually signals the end of a trend due to increasing instability. |

### 4.4 Candlestick Patterns

Single-bar and multi-bar candlestick patterns provide granular, bar-level reversal and continuation signals.

**Single Candle Patterns:**

| Pattern | Description | Signal |
|---|---|---|
| **Doji** | Open and close nearly equal. Long upper and lower shadows. | Indecision. Potential reversal when appearing after a strong trend. Subtypes: Standard, Long-Legged, Dragonfly (long lower shadow), Gravestone (long upper shadow). |
| **Hammer** | Small body at top, long lower shadow (2x+ body length), minimal upper shadow. Appears in downtrend. | Bullish reversal. Sellers drove price down but buyers recovered by close. |
| **Inverted Hammer** | Small body at bottom, long upper shadow, minimal lower shadow. Appears in downtrend. | Potential bullish reversal. Needs confirmation (next candle close above inverted hammer body). |
| **Shooting Star** | Small body at bottom, long upper shadow. Appears in uptrend. | Bearish reversal. Buyers pushed up but sellers drove it back down. Inverse of hammer. |
| **Hanging Man** | Identical shape to hammer but appears in uptrend. | Bearish reversal warning. Selling pressure is emerging despite the uptrend. |
| **Marubozu** | Full body with no shadows (or very small). | Strong conviction. Bullish marubozu = buyers controlled entire session; bearish = sellers controlled. |
| **Spinning Top** | Small body with roughly equal upper and lower shadows. | Indecision, like a doji but with a slightly larger body. |

**Double Candle Patterns:**

| Pattern | Description | Signal |
|---|---|---|
| **Bullish Engulfing** | Small red candle followed by a larger green candle whose body completely engulfs the prior body. | Strong bullish reversal at bottom of downtrend. |
| **Bearish Engulfing** | Small green candle followed by a larger red candle that engulfs the prior body. | Strong bearish reversal at top of uptrend. |
| **Piercing Line** | Red candle followed by green candle that opens below prior low but closes above the midpoint of the red body. | Bullish reversal. Less powerful than engulfing. |
| **Dark Cloud Cover** | Green candle followed by red candle that opens above prior high but closes below the midpoint of the green body. | Bearish reversal. Counterpart to piercing line. |
| **Tweezer Top / Bottom** | Two candles with matching highs (top) or matching lows (bottom). | Reversal signal at matching price level. |
| **Harami (Bullish/Bearish)** | Large candle followed by a small candle entirely within the first candle's body. | Potential reversal. "Inside bar" concept. Needs confirmation. |

**Triple Candle Patterns:**

| Pattern | Description | Signal |
|---|---|---|
| **Morning Star** | Large red candle, small-bodied candle (or doji) that gaps down, large green candle that closes above midpoint of first candle. | Strong bullish reversal. The star represents indecision, followed by buyer takeover. |
| **Evening Star** | Large green candle, small-bodied candle that gaps up, large red candle that closes below midpoint of first candle. | Strong bearish reversal. Inverse of morning star. |
| **Three White Soldiers** | Three consecutive long green candles, each opening within the prior candle's body and closing progressively higher. | Strong bullish continuation/reversal. Indicates sustained buying pressure. |
| **Three Black Crows** | Three consecutive long red candles, each opening within the prior body and closing progressively lower. | Strong bearish continuation/reversal. |
| **Three Inside Up/Down** | Harami pattern followed by a confirmation candle breaking in the reversal direction. | Confirmed harami reversal — more reliable than harami alone. |
| **Abandoned Baby** | Star pattern where the middle candle gaps away from both the first and third candles (no shadow overlap). | Very rare and very strong reversal signal. |

### 4.5 Algorithmic Detection Approaches

For a platform implementing automatic pattern detection:

1. **Pivot Point Detection**: Identify local highs/lows using lookback windows (e.g., a pivot high requires N bars of lower highs on each side).
2. **Trendline Fitting**: Connect pivot points and evaluate slope, duration, and number of touches.
3. **Template Matching**: Define geometric templates with allowed tolerances and scan for matches.
4. **Statistical Validation**: Score pattern quality based on symmetry, volume profile, and Fibonacci alignment.
5. **Machine Learning**: Train classifiers (CNN, LSTM, or transformer-based) on labeled pattern datasets for higher accuracy.
6. **Real-Time Scanning**: Run detection on each new bar close, with configurable sensitivity and minimum pattern size.

---

## 5. Multi-Timeframe Analysis

Multi-timeframe analysis (MTA) involves examining the same instrument across multiple timeframes simultaneously to align short-term entries with long-term trends.

### 5.1 Synced Multi-Chart Layouts

A platform must support:

- **Grid Layouts**: 2x1, 2x2, 3x1, 3x2, 4x2, and custom grid configurations. Each cell is an independent chart.
- **Symbol Linking**: When the user changes the symbol on one chart, all linked charts update. Uses a "link group" concept (colored dots) — charts in the same group share the symbol.
- **Crosshair Sync**: Moving the crosshair on one chart shows the corresponding time position on all other charts in the layout.
- **Drawing Sync**: Trendlines, Fibonacci levels, and other drawings can optionally be synced across all timeframes. A trendline drawn on the daily chart appears on the 4H chart at the same price/time coordinates.
- **Scroll/Zoom Sync**: Optional synchronization of horizontal scrolling and zoom level (time range).

### 5.2 Timeframe Hierarchy

The standard MTA approach uses three timeframes:

| Role | Purpose | Common Pairings |
|---|---|---|
| **Higher (Strategic)** | Identify the dominant trend direction | Weekly, Daily |
| **Middle (Tactical)** | Find entry zones and pattern setups | Daily, 4H |
| **Lower (Execution)** | Time precise entries and exits | 4H, 1H, 15M |

Typical pairings: W/D/4H (swing trading), D/4H/1H (position trading), 4H/1H/15M (intraday), 1H/15M/5M (day trading), 15M/5M/1M (scalping).

### 5.3 Multi-Timeframe Indicator Overlay

The ability to display a higher-timeframe indicator on a lower-timeframe chart is essential:

- **Higher-TF moving average on lower-TF chart**: e.g., Daily 200 EMA displayed on a 1H chart as a stepped line (updates only at daily bar close).
- **Request.security() model**: The indicator requests data from a different timeframe and plots it on the current chart. Must handle alignment carefully — the higher-TF value should not "repaint" (appear before the higher-TF bar closes).
- **Multi-Timeframe Dashboard Panels**: Summary panels showing indicator state (bullish/bearish/neutral) across multiple timeframes in a single table overlay.

### 5.4 Implementation Considerations

- **Data Management**: Each additional timeframe requires its own bar data series. Cache and precompute to avoid redundant API calls.
- **Repainting Prevention**: Higher-TF data must only update on the current chart when the higher-TF bar has closed. Use `barstate.isconfirmed` equivalent logic.
- **Visual Clarity**: Higher-TF elements should have distinct styling (thicker lines, different colors) to distinguish them from current-TF elements.

---

## 6. Comparison & Overlay

Comparing multiple instruments on a single chart reveals relative strength, correlations, and spread opportunities.

### 6.1 Symbol Overlay

- **Same Scale Overlay**: Adds a second symbol's price series directly onto the chart. Works best for instruments with similar price ranges. Each symbol gets its own Y-axis (left for primary, right for overlay).
- **Percentage Scale**: Converts both symbols to percentage change from a common starting point. Aligns their movements regardless of absolute price difference. Essential for comparing AAPL ($180) vs. MSFT ($400) on the same chart.
- **Normalized Scale**: Z-score normalization for comparing instruments with different volatility profiles.

### 6.2 Relative Performance Charts

- **Performance Chart**: Multiple symbols plotted as percentage change from a common reference time (e.g., start of year, start of chart). Instantly shows which symbols are outperforming/underperforming.
- **Baseline Comparison**: One symbol serves as the baseline (flat at 0%). All other symbols are plotted relative to the baseline's performance. Shows alpha generation (or lack thereof) relative to a benchmark.

### 6.3 Spread Charts

- **Price Spread**: Symbol A price minus Symbol B price. Plot: A - B. Used for pairs trading — when the spread deviates from its mean, trade the convergence.
- **Ratio Chart**: Symbol A price divided by Symbol B price. Plot: A / B. Rising ratio = A outperforming B. Used for sector rotation (e.g., XLK/SPY for tech relative strength).
- **Custom Expressions**: Support arbitrary arithmetic expressions combining multiple symbols: `(AAPL + MSFT) / 2`, `AAPL - 0.5 * SPY`, `GOLD * EURUSD`. Enables synthetic instrument creation.

### 6.4 Correlation Analysis

- **Rolling Correlation**: Pearson correlation coefficient between two symbols' returns over a rolling window (e.g., 20-day, 60-day). Values range from -1 (perfect inverse) to +1 (perfect positive).
- **Correlation Matrix**: Heat map showing pairwise correlations across multiple symbols. Essential for portfolio diversification analysis.
- **Beta Calculation**: Symbol's beta relative to a benchmark = Covariance(symbol, benchmark) / Variance(benchmark). Plotted as a rolling value.

### 6.5 Implementation Requirements

1. **Multiple Y-Axes**: Support left, right, and additional Y-axes with independent scaling.
2. **Percentage Mode Toggle**: One-click switch between absolute price and percentage change.
3. **Symbol Search in Overlay**: Quick search to add any symbol as an overlay.
4. **Color-Coded Legend**: Clear legend showing which color corresponds to which symbol.
5. **Independent Visibility Toggle**: Show/hide each overlaid symbol independently.
6. **Spread/Ratio Expression Parser**: Accept mathematical expressions like `AAPL/SPY` or `ES1!-NQ1!` as chart symbols.

---

## Summary

This document covers the complete feature set required for a TradingView-level charting platform:

- **16 chart types** spanning standard time-based, synthetic/filtered, and alternative aggregation methods
- **40+ technical indicators** across 5 categories with formulas, parameters, and trading applications
- **35+ drawing tools** including lines, Fibonacci, Gann, Elliott Wave, patterns, shapes, annotations, and measurement
- **30+ recognizable patterns** including reversal, continuation, complex, and candlestick formations
- **Multi-timeframe analysis** with synced layouts, indicator overlay, and repainting prevention
- **Comparison and overlay** features including spread charts, ratio charts, relative performance, and correlation analysis

Each feature should be implemented with configurable parameters, clear visual defaults, and user customization options. The platform's custom indicator system (analogous to Pine Script) allows users to extend the platform's capabilities beyond built-in indicators.
