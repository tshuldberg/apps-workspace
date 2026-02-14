import React, { useCallback, useEffect, useState } from 'react'
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { formatPrice, formatPercent } from '@marlin/shared'
import { OrderSheet } from '../../components/order-sheet'
import { colors, spacing, fontSize } from '../../constants/theme'
import { apiClient } from '../../services/api-client'

interface Position {
  id: string
  symbol: string
  quantity: number
  avgCost: number
  currentPrice: number
  marketValue: number
  unrealizedPnl: number
  unrealizedPnlPercent: number
}

interface Order {
  id: string
  symbol: string
  side: 'buy' | 'sell'
  type: 'market' | 'limit' | 'stop'
  quantity: number
  price: number
  status: 'filled' | 'pending' | 'cancelled'
  filledAt: string | null
  createdAt: string
}

interface PortfolioSummary {
  totalValue: number
  dayPnl: number
  dayPnlPercent: number
  totalPnl: number
  totalPnlPercent: number
  buyingPower: number
}

// Mock data for development
const MOCK_SUMMARY: PortfolioSummary = {
  totalValue: 105_420.50,
  dayPnl: 1_234.50,
  dayPnlPercent: 1.18,
  totalPnl: 5_420.50,
  totalPnlPercent: 5.42,
  buyingPower: 44_579.50,
}

const MOCK_POSITIONS: Position[] = [
  {
    id: '1',
    symbol: 'AAPL',
    quantity: 50,
    avgCost: 185.2,
    currentPrice: 192.5,
    marketValue: 9625,
    unrealizedPnl: 365,
    unrealizedPnlPercent: 3.94,
  },
  {
    id: '2',
    symbol: 'NVDA',
    quantity: 20,
    avgCost: 680.0,
    currentPrice: 725.3,
    marketValue: 14506,
    unrealizedPnl: 906,
    unrealizedPnlPercent: 6.66,
  },
  {
    id: '3',
    symbol: 'TSLA',
    quantity: 15,
    avgCost: 255.0,
    currentPrice: 248.3,
    marketValue: 3724.5,
    unrealizedPnl: -100.5,
    unrealizedPnlPercent: -2.63,
  },
]

const MOCK_ORDERS: Order[] = [
  {
    id: '1',
    symbol: 'AAPL',
    side: 'buy',
    type: 'market',
    quantity: 10,
    price: 192.5,
    status: 'filled',
    filledAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    symbol: 'NVDA',
    side: 'buy',
    type: 'limit',
    quantity: 5,
    price: 720.0,
    status: 'pending',
    filledAt: null,
    createdAt: new Date().toISOString(),
  },
]

function SummaryCard({ summary }: { summary: PortfolioSummary }) {
  const dayPositive = summary.dayPnl >= 0
  const totalPositive = summary.totalPnl >= 0

  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>Portfolio Value</Text>
      <Text style={styles.summaryValue}>
        ${summary.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </Text>

      <View style={styles.pnlRow}>
        <View style={styles.pnlItem}>
          <Text style={styles.pnlLabel}>Today</Text>
          <Text
            style={[
              styles.pnlValue,
              { color: dayPositive ? colors.tradingGreen : colors.tradingRed },
            ]}
          >
            {dayPositive ? '+' : ''}${Math.abs(summary.dayPnl).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </Text>
          <Text
            style={[
              styles.pnlPercent,
              { color: dayPositive ? colors.tradingGreen : colors.tradingRed },
            ]}
          >
            {formatPercent(summary.dayPnlPercent)}
          </Text>
        </View>

        <View style={styles.pnlDivider} />

        <View style={styles.pnlItem}>
          <Text style={styles.pnlLabel}>Total</Text>
          <Text
            style={[
              styles.pnlValue,
              { color: totalPositive ? colors.tradingGreen : colors.tradingRed },
            ]}
          >
            {totalPositive ? '+' : ''}${Math.abs(summary.totalPnl).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </Text>
          <Text
            style={[
              styles.pnlPercent,
              { color: totalPositive ? colors.tradingGreen : colors.tradingRed },
            ]}
          >
            {formatPercent(summary.totalPnlPercent)}
          </Text>
        </View>

        <View style={styles.pnlDivider} />

        <View style={styles.pnlItem}>
          <Text style={styles.pnlLabel}>Buying Power</Text>
          <Text style={styles.pnlValueNeutral}>
            ${summary.buyingPower.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </Text>
        </View>
      </View>
    </View>
  )
}

function PositionRow({
  position,
  onPress,
}: {
  position: Position
  onPress: () => void
}) {
  const isPositive = position.unrealizedPnl >= 0
  const pnlColor = isPositive ? colors.tradingGreen : colors.tradingRed

  return (
    <TouchableOpacity style={styles.positionRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.positionLeft}>
        <Text style={styles.positionSymbol}>{position.symbol}</Text>
        <Text style={styles.positionQty}>
          {position.quantity} shares @ {formatPrice(position.avgCost)}
        </Text>
      </View>
      <View style={styles.positionRight}>
        <Text style={styles.positionValue}>
          ${position.marketValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </Text>
        <View
          style={[
            styles.pnlBadge,
            {
              backgroundColor: isPositive
                ? colors.tradingGreenBg
                : colors.tradingRedBg,
            },
          ]}
        >
          <Text style={[styles.pnlBadgeText, { color: pnlColor }]}>
            {isPositive ? '+' : ''}${Math.abs(position.unrealizedPnl).toFixed(2)} (
            {formatPercent(position.unrealizedPnlPercent)})
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

function OrderRow({ order }: { order: Order }) {
  const isBuy = order.side === 'buy'
  const statusColors: Record<string, string> = {
    filled: colors.tradingGreen,
    pending: colors.accent,
    cancelled: colors.textMuted,
  }

  return (
    <View style={styles.orderRow}>
      <View style={styles.orderLeft}>
        <View style={styles.orderSideRow}>
          <View
            style={[
              styles.sideBadge,
              { backgroundColor: isBuy ? colors.tradingGreenBg : colors.tradingRedBg },
            ]}
          >
            <Text
              style={{
                fontSize: fontSize.xs,
                fontWeight: '700',
                color: isBuy ? colors.tradingGreen : colors.tradingRed,
              }}
            >
              {order.side.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.orderSymbol}>{order.symbol}</Text>
          <Text style={styles.orderType}>{order.type}</Text>
        </View>
        <Text style={styles.orderDetails}>
          {order.quantity} shares @ {formatPrice(order.price)}
        </Text>
      </View>
      <Text style={[styles.orderStatus, { color: statusColors[order.status] ?? colors.textMuted }]}>
        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
      </Text>
    </View>
  )
}

export default function PortfolioScreen() {
  const [summary, setSummary] = useState<PortfolioSummary>(MOCK_SUMMARY)
  const [positions, setPositions] = useState<Position[]>(MOCK_POSITIONS)
  const [orders, setOrders] = useState<Order[]>(MOCK_ORDERS)
  const [refreshing, setRefreshing] = useState(false)
  const [orderSheetSymbol, setOrderSheetSymbol] = useState<string | null>(null)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const [s, p, o] = await Promise.all([
        apiClient.get<PortfolioSummary>('/trpc/paper.summary'),
        apiClient.get<Position[]>('/trpc/paper.positions'),
        apiClient.get<Order[]>('/trpc/paper.recentOrders'),
      ])
      setSummary(s)
      setPositions(p)
      setOrders(o)
    } catch {
      // Keep mock data
    }
    setRefreshing(false)
  }, [])

  const selectedPosition = positions.find((p) => p.symbol === orderSheetSymbol)

  const renderHeader = useCallback(
    () => (
      <>
        <SummaryCard summary={summary} />

        {/* Positions section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Positions</Text>
          <Text style={styles.sectionCount}>{positions.length}</Text>
        </View>

        {positions.length === 0 && (
          <View style={styles.emptySection}>
            <Text style={styles.emptySectionText}>No open positions</Text>
          </View>
        )}

        {positions.map((pos) => (
          <PositionRow
            key={pos.id}
            position={pos}
            onPress={() => setOrderSheetSymbol(pos.symbol)}
          />
        ))}

        {/* Orders section header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          <Text style={styles.sectionCount}>{orders.length}</Text>
        </View>

        {orders.length === 0 && (
          <View style={styles.emptySection}>
            <Text style={styles.emptySectionText}>No recent orders</Text>
          </View>
        )}
      </>
    ),
    [summary, positions, orders],
  )

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <OrderRow order={item} />}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        contentContainerStyle={styles.listContent}
      />

      {/* Order sheet */}
      {orderSheetSymbol && (
        <OrderSheet
          symbol={orderSheetSymbol}
          currentPrice={selectedPosition?.currentPrice ?? 0}
          onClose={() => setOrderSheetSymbol(null)}
          onOrderSubmitted={onRefresh}
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
  listContent: {
    paddingBottom: 100,
  },
  // Summary card
  summaryCard: {
    margin: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.navyDark,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 4,
    letterSpacing: -0.5,
  },
  pnlRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    justifyContent: 'space-between',
  },
  pnlItem: {
    flex: 1,
    alignItems: 'center',
  },
  pnlDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  pnlLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginBottom: 4,
  },
  pnlValue: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  pnlValueNeutral: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  pnlPercent: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    marginTop: 2,
  },
  // Sections
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.navyDark,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sectionCount: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: '500',
  },
  emptySection: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptySectionText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
  },
  // Position row
  positionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  positionLeft: {
    flex: 1,
  },
  positionSymbol: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  positionQty: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  positionRight: {
    alignItems: 'flex-end',
  },
  positionValue: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  pnlBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  pnlBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  // Order row
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  orderLeft: {
    flex: 1,
  },
  orderSideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sideBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  orderSymbol: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  orderType: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  orderDetails: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 4,
  },
  orderStatus: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
})
