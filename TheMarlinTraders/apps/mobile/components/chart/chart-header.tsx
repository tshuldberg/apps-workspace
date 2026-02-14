import React from 'react'
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native'
import type { Timeframe } from '@marlin/shared'
import { TIMEFRAMES, TIMEFRAME_LABELS, formatPrice, formatPercent } from '@marlin/shared'
import { colors, spacing, fontSize } from '../../constants/theme'

type ChartType = 'candle' | 'line' | 'bar'

interface ChartHeaderProps {
  symbol: string
  companyName?: string
  lastPrice?: number
  change?: number
  changePercent?: number
  timeframe: Timeframe
  chartType: ChartType
  onTimeframeChange: (tf: Timeframe) => void
  onChartTypeChange: (type: ChartType) => void
}

const CHART_TYPES: { type: ChartType; label: string }[] = [
  { type: 'candle', label: 'Candle' },
  { type: 'line', label: 'Line' },
  { type: 'bar', label: 'Bar' },
]

export function ChartHeader({
  symbol,
  companyName,
  lastPrice,
  change,
  changePercent,
  timeframe,
  chartType,
  onTimeframeChange,
  onChartTypeChange,
}: ChartHeaderProps) {
  const isPositive = (change ?? 0) >= 0
  const changeColor = isPositive ? colors.tradingGreen : colors.tradingRed

  return (
    <View style={styles.container}>
      {/* Symbol info */}
      <View style={styles.symbolRow}>
        <View style={styles.symbolInfo}>
          <Text style={styles.symbol}>{symbol}</Text>
          {companyName && (
            <Text style={styles.companyName} numberOfLines={1}>
              {companyName}
            </Text>
          )}
        </View>
        {lastPrice !== undefined && (
          <View style={styles.priceInfo}>
            <Text style={styles.lastPrice}>{formatPrice(lastPrice)}</Text>
            <View style={styles.changeRow}>
              {change !== undefined && (
                <Text style={[styles.change, { color: changeColor }]}>
                  {change >= 0 ? '+' : ''}
                  {formatPrice(Math.abs(change))}
                </Text>
              )}
              {changePercent !== undefined && (
                <Text style={[styles.change, { color: changeColor }]}>
                  {' '}
                  ({formatPercent(changePercent)})
                </Text>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Timeframe picker */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.timeframeScroll}
        contentContainerStyle={styles.timeframeContent}
      >
        {TIMEFRAMES.map((tf) => {
          const isActive = tf === timeframe
          return (
            <TouchableOpacity
              key={tf}
              style={[styles.timeframeChip, isActive && styles.timeframeChipActive]}
              onPress={() => onTimeframeChange(tf)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.timeframeText,
                  isActive && styles.timeframeTextActive,
                ]}
              >
                {TIMEFRAME_LABELS[tf]}
              </Text>
            </TouchableOpacity>
          )
        })}

        {/* Separator */}
        <View style={styles.separator} />

        {/* Chart type toggle */}
        {CHART_TYPES.map(({ type, label }) => {
          const isActive = type === chartType
          return (
            <TouchableOpacity
              key={type}
              style={[styles.timeframeChip, isActive && styles.timeframeChipActive]}
              onPress={() => onChartTypeChange(type)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.timeframeText,
                  isActive && styles.timeframeTextActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.navyBlack,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  symbolRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  symbolInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  symbol: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  companyName: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  priceInfo: {
    alignItems: 'flex-end',
  },
  lastPrice: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  change: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  timeframeScroll: {
    maxHeight: 40,
  },
  timeframeContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeframeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  timeframeChipActive: {
    backgroundColor: colors.navyMid,
  },
  timeframeText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: '500',
  },
  timeframeTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  separator: {
    width: 1,
    height: 20,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xs,
  },
})
