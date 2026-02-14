import React, { useCallback, useMemo, useState } from 'react'
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { OHLCV, Timeframe } from '@marlin/shared'
import { DEFAULT_SYMBOL, TIMEFRAME_LABELS } from '@marlin/shared'
import { SkiaChart } from '../../components/chart/skia-chart'
import { ChartHeader } from '../../components/chart/chart-header'
import { SymbolSearchModal } from '../../components/symbol-search-modal'
import type { SymbolSearchResult } from '../../components/symbol-search-modal'
import { OrderSheet } from '../../components/order-sheet'
import { colors, spacing, fontSize } from '../../constants/theme'

type ChartType = 'candle' | 'line' | 'bar'

// Generate mock OHLCV data for development
function generateMockData(symbol: string, count: number): OHLCV[] {
  const seed = symbol.charCodeAt(0) + (symbol.charCodeAt(1) ?? 0)
  const basePrice = 50 + (seed % 400)
  const bars: OHLCV[] = []
  let price = basePrice

  const now = Date.now()
  for (let i = count - 1; i >= 0; i--) {
    const change = (Math.random() - 0.48) * price * 0.02
    price += change
    if (price < 1) price = 1

    const high = price + Math.random() * price * 0.01
    const low = price - Math.random() * price * 0.01
    const open = low + Math.random() * (high - low)
    const close = low + Math.random() * (high - low)

    bars.push({
      open,
      high,
      low,
      close,
      volume: Math.floor(1_000_000 + Math.random() * 10_000_000),
      timestamp: now - i * 86400_000,
    })
  }

  return bars
}

const ACTIVE_INDICATORS = [
  { id: 'sma20', label: 'SMA 20', color: '#3b82f6' },
  { id: 'ema50', label: 'EMA 50', color: '#eab308' },
  { id: 'bb', label: 'BB(20,2)', color: '#8b5cf6' },
]

export default function ChartScreen() {
  const params = useLocalSearchParams<{ symbol?: string }>()
  const [symbol, setSymbol] = useState(params.symbol ?? DEFAULT_SYMBOL)
  const [timeframe, setTimeframe] = useState<Timeframe>('1D')
  const [chartType, setChartType] = useState<ChartType>('candle')
  const [searchVisible, setSearchVisible] = useState(false)
  const [orderSheetVisible, setOrderSheetVisible] = useState(false)

  const data = useMemo(() => generateMockData(symbol, 200), [symbol])
  const lastBar = data[data.length - 1]
  const prevBar = data[data.length - 2]
  const currentPrice = lastBar?.close ?? 0
  const priceChange = lastBar && prevBar ? lastBar.close - prevBar.close : 0
  const changePercent = prevBar ? (priceChange / prevBar.close) * 100 : 0

  const handleSymbolSelect = useCallback((result: SymbolSearchResult) => {
    setSymbol(result.symbol)
    setSearchVisible(false)
  }, [])

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <TouchableOpacity
        style={styles.searchBar}
        onPress={() => setSearchVisible(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <Text style={styles.searchPlaceholder}>Search symbol...</Text>
      </TouchableOpacity>

      {/* Chart header with symbol info and timeframe picker */}
      <ChartHeader
        symbol={symbol}
        lastPrice={currentPrice}
        change={priceChange}
        changePercent={changePercent}
        timeframe={timeframe}
        chartType={chartType}
        onTimeframeChange={setTimeframe}
        onChartTypeChange={setChartType}
      />

      {/* Chart */}
      <View style={styles.chartContainer}>
        <SkiaChart data={data} timeframe={timeframe} symbol={symbol} />
      </View>

      {/* Indicator chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.indicatorScroll}
        contentContainerStyle={styles.indicatorContent}
      >
        {ACTIVE_INDICATORS.map((ind) => (
          <View key={ind.id} style={styles.indicatorChip}>
            <View style={[styles.indicatorDot, { backgroundColor: ind.color }]} />
            <Text style={styles.indicatorLabel}>{ind.label}</Text>
          </View>
        ))}
        <TouchableOpacity style={styles.addIndicatorButton}>
          <Ionicons name="add" size={16} color={colors.accent} />
          <Text style={styles.addIndicatorText}>Add</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Quick actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={[styles.tradeButton, { backgroundColor: colors.tradingGreen }]}
          onPress={() => setOrderSheetVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.tradeButtonText}>Trade {symbol}</Text>
        </TouchableOpacity>
      </View>

      {/* Symbol search modal */}
      <SymbolSearchModal
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onSelect={handleSymbolSelect}
      />

      {/* Order sheet */}
      {orderSheetVisible && (
        <OrderSheet
          symbol={symbol}
          currentPrice={currentPrice}
          onClose={() => setOrderSheetVisible(false)}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navyBlack,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.navyDark,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  searchPlaceholder: {
    color: colors.textMuted,
    fontSize: fontSize.md,
  },
  chartContainer: {
    flex: 1,
    minHeight: 300,
  },
  indicatorScroll: {
    maxHeight: 36,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  indicatorContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  indicatorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 4,
    backgroundColor: colors.navyDark,
    gap: 4,
  },
  indicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  indicatorLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  addIndicatorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    gap: 2,
  },
  addIndicatorText: {
    fontSize: fontSize.xs,
    color: colors.accent,
    fontWeight: '500',
  },
  quickActions: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tradeButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tradeButtonText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: '#fff',
  },
})
