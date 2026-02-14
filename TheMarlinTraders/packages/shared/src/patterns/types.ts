/**
 * Pattern Recognition Types
 * Sprints 31-32: AI Chart Analysis
 */

import type { ScreenerFilter } from './screener-filter.js'

// ── Chart Pattern Types ────────────────────────────────────────────────────

export type ChartPattern =
  | 'head_and_shoulders'
  | 'inv_head_and_shoulders'
  | 'double_top'
  | 'double_bottom'
  | 'ascending_triangle'
  | 'descending_triangle'
  | 'symmetrical_triangle'
  | 'bull_flag'
  | 'bear_flag'
  | 'cup_and_handle'
  | 'rising_wedge'
  | 'falling_wedge'
  | 'channel_up'
  | 'channel_down'

export const CHART_PATTERNS: ChartPattern[] = [
  'head_and_shoulders',
  'inv_head_and_shoulders',
  'double_top',
  'double_bottom',
  'ascending_triangle',
  'descending_triangle',
  'symmetrical_triangle',
  'bull_flag',
  'bear_flag',
  'cup_and_handle',
  'rising_wedge',
  'falling_wedge',
  'channel_up',
  'channel_down',
]

export const PATTERN_LABELS: Record<ChartPattern, string> = {
  head_and_shoulders: 'Head & Shoulders',
  inv_head_and_shoulders: 'Inverse Head & Shoulders',
  double_top: 'Double Top',
  double_bottom: 'Double Bottom',
  ascending_triangle: 'Ascending Triangle',
  descending_triangle: 'Descending Triangle',
  symmetrical_triangle: 'Symmetrical Triangle',
  bull_flag: 'Bull Flag',
  bear_flag: 'Bear Flag',
  cup_and_handle: 'Cup & Handle',
  rising_wedge: 'Rising Wedge',
  falling_wedge: 'Falling Wedge',
  channel_up: 'Channel Up',
  channel_down: 'Channel Down',
}

export const PATTERN_DIRECTIONS: Record<ChartPattern, 'bullish' | 'bearish'> = {
  head_and_shoulders: 'bearish',
  inv_head_and_shoulders: 'bullish',
  double_top: 'bearish',
  double_bottom: 'bullish',
  ascending_triangle: 'bullish',
  descending_triangle: 'bearish',
  symmetrical_triangle: 'bullish', // default — depends on breakout direction
  bull_flag: 'bullish',
  bear_flag: 'bearish',
  cup_and_handle: 'bullish',
  rising_wedge: 'bearish',
  falling_wedge: 'bullish',
  channel_up: 'bullish',
  channel_down: 'bearish',
}

// ── Pattern Detection ──────────────────────────────────────────────────────

export interface KeyPoint {
  time: number
  price: number
}

export interface PatternDetection {
  pattern: ChartPattern
  confidence: number // 0-1
  startBar: number
  endBar: number
  keyPoints: KeyPoint[]
  priceTarget?: number
  stopLoss?: number
  direction: 'bullish' | 'bearish'
}

export interface PatternConfig {
  /** Minimum lookback bars for pattern detection. Default: 20 */
  lookbackPeriod?: number
  /** Pivot detection period (bars on each side). Default: 5 */
  pivotPeriod?: number
  /** Minimum confidence threshold to include. Default: 0.4 */
  minConfidence?: number
  /** Which pattern types to scan for. Default: all */
  enabledPatterns?: ChartPattern[]
  /** Price tolerance for matching levels (percentage). Default: 0.02 (2%) */
  priceTolerance?: number
}

export const DEFAULT_PATTERN_CONFIG: Required<PatternConfig> = {
  lookbackPeriod: 20,
  pivotPeriod: 5,
  minConfidence: 0.4,
  enabledPatterns: [...CHART_PATTERNS],
  priceTolerance: 0.02,
}

// ── Pivot Points ───────────────────────────────────────────────────────────

export interface PivotPoint {
  index: number
  price: number
  timestamp: number
}

export interface Trendline {
  slope: number
  intercept: number
  r2: number
  startIndex: number
  endIndex: number
}

// ── NLP Query ──────────────────────────────────────────────────────────────

export interface NLPQuery {
  rawText: string
  parsedFilters: ScreenerFilter[]
  parsedIndicators: string[]
  parsedActions: ('chart' | 'screen' | 'alert')[]
}

// ── Journal AI Insights ────────────────────────────────────────────────────

export interface JournalInsight {
  category: 'behavioral' | 'setup' | 'timing' | 'risk' | 'emotional'
  title: string
  description: string
  severity: 'info' | 'warning' | 'critical'
  dataPoints: number
}

export interface JournalAnalysis {
  insights: JournalInsight[]
  bestSetups: { setupType: string; winRate: number; avgPnl: number; count: number }[]
  worstSetups: { setupType: string; winRate: number; avgPnl: number; count: number }[]
  bestTradingDays: { day: string; winRate: number; avgPnl: number; count: number }[]
  worstTradingDays: { day: string; winRate: number; avgPnl: number; count: number }[]
  emotionalCorrelations: {
    emotion: string
    winRate: number
    avgPnl: number
    count: number
  }[]
  suggestions: string[]
}
