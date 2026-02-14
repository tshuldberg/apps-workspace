import type { StrategyTemplate } from './types.js'

// ---------------------------------------------------------------------------
// Built-in strategy templates
// ---------------------------------------------------------------------------
// Each template uses the strategy engine API:
//   onBar(bar, indicators, context) — called on each new bar
//   buy(qty)   — open a long position
//   sell(qty)  — close / open short position
//   position() — returns current position { side, qty, entryPrice }
//   indicators.sma(period), .ema(period), .rsi(period), .macd(...),
//   .bbands(period, stddev), .atr(period)
// ---------------------------------------------------------------------------

export const MA_CROSSOVER_TEMPLATE: StrategyTemplate = {
  id: 'tmpl-ma-crossover',
  name: 'MA Crossover',
  description:
    'Classic trend-following strategy that goes long when a fast moving average crosses above a slow moving average, and exits when it crosses below. Works best in trending markets.',
  language: 'typescript',
  category: 'trend',
  parameters: [
    { name: 'fastPeriod', type: 'number', default: 10, min: 2, max: 200, description: 'Fast MA period' },
    { name: 'slowPeriod', type: 'number', default: 30, min: 5, max: 500, description: 'Slow MA period' },
    { name: 'quantity', type: 'number', default: 100, min: 1, max: 100_000, description: 'Shares per trade' },
  ],
  code: `// MA Crossover Strategy
// Goes long when fastMA > slowMA, exits when fastMA < slowMA

function onBar(bar, indicators, context) {
  const { fastPeriod, slowPeriod, quantity } = context.params;

  const fastMA = indicators.sma(fastPeriod);
  const slowMA = indicators.sma(slowPeriod);

  if (fastMA === null || slowMA === null) return;

  const pos = position();

  // Entry: fast MA crosses above slow MA
  if (fastMA > slowMA && (!pos || pos.side !== 'long')) {
    if (pos && pos.side === 'short') {
      sell(pos.qty); // close short first
    }
    buy(quantity);
  }

  // Exit: fast MA crosses below slow MA
  if (fastMA < slowMA && pos && pos.side === 'long') {
    sell(pos.qty);
  }
}`,
}

export const RSI_MEAN_REVERSION_TEMPLATE: StrategyTemplate = {
  id: 'tmpl-rsi-mean-reversion',
  name: 'RSI Mean Reversion',
  description:
    'Mean-reversion strategy that buys when RSI dips into oversold territory and sells when it reaches overbought levels. Best suited for range-bound markets.',
  language: 'typescript',
  category: 'mean-reversion',
  parameters: [
    { name: 'rsiPeriod', type: 'number', default: 14, min: 2, max: 100, description: 'RSI lookback period' },
    { name: 'oversold', type: 'number', default: 30, min: 5, max: 50, description: 'Oversold threshold' },
    { name: 'overbought', type: 'number', default: 70, min: 50, max: 95, description: 'Overbought threshold' },
    { name: 'quantity', type: 'number', default: 100, min: 1, max: 100_000, description: 'Shares per trade' },
  ],
  code: `// RSI Mean Reversion Strategy
// Buys oversold, sells overbought

function onBar(bar, indicators, context) {
  const { rsiPeriod, oversold, overbought, quantity } = context.params;

  const rsi = indicators.rsi(rsiPeriod);
  if (rsi === null) return;

  const pos = position();

  // Entry: RSI drops below oversold
  if (rsi < oversold && (!pos || pos.side !== 'long')) {
    buy(quantity);
  }

  // Exit: RSI rises above overbought
  if (rsi > overbought && pos && pos.side === 'long') {
    sell(pos.qty);
  }
}`,
}

export const BREAKOUT_TEMPLATE: StrategyTemplate = {
  id: 'tmpl-breakout',
  name: 'Breakout',
  description:
    'Enters long when price breaks above the highest high of the lookback period with expanding volume. Uses ATR-based trailing stop for exits.',
  language: 'typescript',
  category: 'breakout',
  parameters: [
    { name: 'lookback', type: 'number', default: 20, min: 5, max: 200, description: 'Breakout lookback bars' },
    { name: 'atrPeriod', type: 'number', default: 14, min: 5, max: 50, description: 'ATR period for stop' },
    { name: 'atrMultiplier', type: 'number', default: 2, min: 0.5, max: 5, description: 'ATR multiplier for trailing stop' },
    { name: 'quantity', type: 'number', default: 100, min: 1, max: 100_000, description: 'Shares per trade' },
  ],
  code: `// Breakout Strategy
// Enters on new high-of-N breakout, trailing ATR stop for exits

function onBar(bar, indicators, context) {
  const { lookback, atrPeriod, atrMultiplier, quantity } = context.params;

  const highestHigh = indicators.highest('high', lookback);
  const atr = indicators.atr(atrPeriod);

  if (highestHigh === null || atr === null) return;

  const pos = position();

  // Entry: price breaks above the lookback high
  if (bar.close > highestHigh && (!pos || pos.side !== 'long')) {
    buy(quantity);
    context.trailingStop = bar.close - atr * atrMultiplier;
  }

  // Manage trailing stop
  if (pos && pos.side === 'long') {
    const newStop = bar.close - atr * atrMultiplier;
    if (newStop > (context.trailingStop || 0)) {
      context.trailingStop = newStop;
    }

    // Exit: price falls below trailing stop
    if (bar.close < context.trailingStop) {
      sell(pos.qty);
      context.trailingStop = 0;
    }
  }
}`,
}

export const MACD_MOMENTUM_TEMPLATE: StrategyTemplate = {
  id: 'tmpl-macd-momentum',
  name: 'MACD Momentum',
  description:
    'Momentum strategy using MACD histogram crossovers. Enters long when the MACD histogram turns positive (bullish momentum) and exits when it turns negative.',
  language: 'typescript',
  category: 'momentum',
  parameters: [
    { name: 'fastPeriod', type: 'number', default: 12, min: 2, max: 100, description: 'MACD fast EMA period' },
    { name: 'slowPeriod', type: 'number', default: 26, min: 5, max: 200, description: 'MACD slow EMA period' },
    { name: 'signalPeriod', type: 'number', default: 9, min: 2, max: 50, description: 'MACD signal line period' },
    { name: 'quantity', type: 'number', default: 100, min: 1, max: 100_000, description: 'Shares per trade' },
  ],
  code: `// MACD Momentum Strategy
// Enters on histogram crossover (negative to positive), exits on reversal

function onBar(bar, indicators, context) {
  const { fastPeriod, slowPeriod, signalPeriod, quantity } = context.params;

  const macd = indicators.macd(fastPeriod, slowPeriod, signalPeriod);
  if (!macd || macd.histogram === null) return;

  const prevHistogram = context.prevHistogram ?? 0;
  context.prevHistogram = macd.histogram;

  const pos = position();

  // Entry: histogram crosses from negative to positive (bullish momentum)
  if (prevHistogram <= 0 && macd.histogram > 0 && (!pos || pos.side !== 'long')) {
    buy(quantity);
  }

  // Exit: histogram crosses from positive to negative (fading momentum)
  if (prevHistogram >= 0 && macd.histogram < 0 && pos && pos.side === 'long') {
    sell(pos.qty);
  }
}`,
}

export const BOLLINGER_SQUEEZE_TEMPLATE: StrategyTemplate = {
  id: 'tmpl-bollinger-squeeze',
  name: 'Bollinger Band Squeeze',
  description:
    'Volatility contraction strategy that detects Bollinger Band squeezes (bandwidth narrowing) and trades the breakout direction. Enters when bandwidth expands after a squeeze.',
  language: 'typescript',
  category: 'volatility',
  parameters: [
    { name: 'bbPeriod', type: 'number', default: 20, min: 5, max: 100, description: 'Bollinger Band period' },
    { name: 'bbStdDev', type: 'number', default: 2, min: 0.5, max: 4, description: 'Standard deviation multiplier' },
    { name: 'squeezeThreshold', type: 'number', default: 0.04, min: 0.01, max: 0.2, description: 'Bandwidth threshold for squeeze detection' },
    { name: 'quantity', type: 'number', default: 100, min: 1, max: 100_000, description: 'Shares per trade' },
  ],
  code: `// Bollinger Band Squeeze Strategy
// Detects low-volatility squeezes and trades the expansion breakout

function onBar(bar, indicators, context) {
  const { bbPeriod, bbStdDev, squeezeThreshold, quantity } = context.params;

  const bb = indicators.bbands(bbPeriod, bbStdDev);
  if (!bb) return;

  // Bandwidth = (upper - lower) / middle
  const bandwidth = (bb.upper - bb.lower) / bb.middle;
  const prevBandwidth = context.prevBandwidth ?? bandwidth;
  const wasSqueezed = context.wasSqueezed ?? false;

  // Detect squeeze (bandwidth below threshold)
  const isSqueezed = bandwidth < squeezeThreshold;

  // Update state
  context.prevBandwidth = bandwidth;
  context.wasSqueezed = isSqueezed;

  const pos = position();

  // Entry: squeeze releases (bandwidth expands after being squeezed)
  if (wasSqueezed && !isSqueezed && bandwidth > prevBandwidth) {
    if (!pos) {
      // Breakout direction based on price relative to middle band
      if (bar.close > bb.middle) {
        buy(quantity);
      }
    }
  }

  // Exit: price reverts to opposite band or middle
  if (pos && pos.side === 'long' && bar.close < bb.middle) {
    sell(pos.qty);
  }
}`,
}

// ---------------------------------------------------------------------------
// Template registry
// ---------------------------------------------------------------------------

export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  MA_CROSSOVER_TEMPLATE,
  RSI_MEAN_REVERSION_TEMPLATE,
  BREAKOUT_TEMPLATE,
  MACD_MOMENTUM_TEMPLATE,
  BOLLINGER_SQUEEZE_TEMPLATE,
]

export function getStrategyTemplateById(id: string): StrategyTemplate | undefined {
  return STRATEGY_TEMPLATES.find((t) => t.id === id)
}

export function getStrategyTemplatesByCategory(
  category: StrategyTemplate['category'],
): StrategyTemplate[] {
  return STRATEGY_TEMPLATES.filter((t) => t.category === category)
}
