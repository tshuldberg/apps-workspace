import type { Timeframe } from '../types/index.js'

export const TIMEFRAMES: readonly Timeframe[] = [
  '1m',
  '5m',
  '15m',
  '30m',
  '1h',
  '4h',
  '1D',
  '1W',
  '1M',
] as const

export const DEFAULT_SYMBOL = 'AAPL'

export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  '1m': '1 Min',
  '5m': '5 Min',
  '15m': '15 Min',
  '30m': '30 Min',
  '1h': '1 Hour',
  '4h': '4 Hour',
  '1D': 'Daily',
  '1W': 'Weekly',
  '1M': 'Monthly',
}

export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '4h': 14400,
  '1D': 86400,
  '1W': 604800,
  '1M': 2592000,
}

export {
  DEFAULT_KEYBINDINGS,
  KEYBINDING_CATEGORIES,
  type Keybinding,
  type KeybindingCategory,
} from './default-keybindings.js'
