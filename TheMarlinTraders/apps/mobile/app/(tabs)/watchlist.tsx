import React, { useCallback, useState, useRef } from 'react'
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Animated as RNAnimated,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Swipeable } from 'react-native-gesture-handler'
import { useWatchlistStore } from '@marlin/data/src/stores/watchlist-store'
import type { WatchlistSymbol } from '@marlin/data/src/stores/watchlist-store'
import { formatPrice, formatPercent } from '@marlin/shared'
import { Sparkline } from '../../components/sparkline'
import { SymbolSearchModal } from '../../components/symbol-search-modal'
import type { SymbolSearchResult } from '../../components/symbol-search-modal'
import { colors, spacing, fontSize } from '../../constants/theme'

// Mock price data for display (real app would fetch from API)
function getMockPriceData(symbol: string) {
  const seed = symbol.charCodeAt(0) + symbol.charCodeAt(1)
  const base = 50 + (seed % 400)
  const change = ((seed % 20) - 10) * 0.5
  const sparkline = Array.from({ length: 20 }, (_, i) =>
    base + Math.sin(i * 0.5 + seed) * (seed % 10) + i * change * 0.02,
  )
  return {
    lastPrice: base + change,
    change,
    changePercent: (change / base) * 100,
    sparkline,
  }
}

function WatchlistRow({
  item,
  onPress,
  onAddAlert,
  onRemove,
}: {
  item: WatchlistSymbol
  onPress: () => void
  onAddAlert: () => void
  onRemove: () => void
}) {
  const swipeableRef = useRef<Swipeable>(null)
  const priceData = getMockPriceData(item.symbol)
  const isPositive = priceData.change >= 0

  const renderLeftActions = (
    _progress: RNAnimated.AnimatedInterpolation<number>,
    dragX: RNAnimated.AnimatedInterpolation<number>,
  ) => {
    const scale = dragX.interpolate({
      inputRange: [0, 80],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    })
    return (
      <TouchableOpacity
        style={styles.swipeActionLeft}
        onPress={() => {
          swipeableRef.current?.close()
          onAddAlert()
        }}
      >
        <RNAnimated.View style={{ transform: [{ scale }] }}>
          <Ionicons name="notifications-outline" size={22} color="#fff" />
          <Text style={styles.swipeActionText}>Alert</Text>
        </RNAnimated.View>
      </TouchableOpacity>
    )
  }

  const renderRightActions = (
    _progress: RNAnimated.AnimatedInterpolation<number>,
    dragX: RNAnimated.AnimatedInterpolation<number>,
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    })
    return (
      <TouchableOpacity
        style={styles.swipeActionRight}
        onPress={() => {
          swipeableRef.current?.close()
          onRemove()
        }}
      >
        <RNAnimated.View style={{ transform: [{ scale }] }}>
          <Ionicons name="trash-outline" size={22} color="#fff" />
          <Text style={styles.swipeActionText}>Remove</Text>
        </RNAnimated.View>
      </TouchableOpacity>
    )
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      overshootLeft={false}
      overshootRight={false}
    >
      <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
        {/* Symbol + name */}
        <View style={styles.rowLeft}>
          <Text style={styles.rowSymbol}>{item.symbol}</Text>
          <Text style={styles.rowName} numberOfLines={1}>
            {item.name}
          </Text>
        </View>

        {/* Sparkline */}
        <View style={styles.sparklineContainer}>
          <Sparkline
            data={priceData.sparkline}
            width={60}
            height={28}
            positive={isPositive}
          />
        </View>

        {/* Price + change */}
        <View style={styles.rowRight}>
          <Text style={styles.rowPrice}>{formatPrice(priceData.lastPrice)}</Text>
          <View
            style={[
              styles.changeBadge,
              {
                backgroundColor: isPositive
                  ? colors.tradingGreenBg
                  : colors.tradingRedBg,
              },
            ]}
          >
            <Text
              style={[
                styles.changeText,
                { color: isPositive ? colors.tradingGreen : colors.tradingRed },
              ]}
            >
              {formatPercent(priceData.changePercent)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Swipeable>
  )
}

export default function WatchlistScreen() {
  const { lists, activeListId, addSymbol, removeSymbol, setActiveList } =
    useWatchlistStore()
  const [refreshing, setRefreshing] = useState(false)
  const [searchVisible, setSearchVisible] = useState(false)

  const activeList = lists.find((l) => l.id === activeListId)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    // Simulate data reload
    await new Promise((r) => setTimeout(r, 1000))
    setRefreshing(false)
  }, [])

  const handleSymbolPress = useCallback((symbol: string) => {
    router.push({ pathname: '/(tabs)/chart', params: { symbol } })
  }, [])

  const handleAddAlert = useCallback((symbol: string) => {
    router.push({ pathname: '/(tabs)/alerts', params: { symbol } })
  }, [])

  const handleRemove = useCallback(
    (itemId: string) => {
      if (activeListId) {
        removeSymbol(activeListId, itemId)
      }
    },
    [activeListId, removeSymbol],
  )

  const handleAddSymbol = useCallback(
    (result: SymbolSearchResult) => {
      if (!activeListId) return
      const newItem: WatchlistSymbol = {
        id: `${Date.now()}`,
        symbolId: Date.now(),
        symbol: result.symbol,
        name: result.name,
        position: activeList?.items.length ?? 0,
      }
      addSymbol(activeListId, newItem)
    },
    [activeListId, activeList, addSymbol],
  )

  const renderItem = useCallback(
    ({ item }: { item: WatchlistSymbol }) => (
      <WatchlistRow
        item={item}
        onPress={() => handleSymbolPress(item.symbol)}
        onAddAlert={() => handleAddAlert(item.symbol)}
        onRemove={() => handleRemove(item.id)}
      />
    ),
    [handleSymbolPress, handleAddAlert, handleRemove],
  )

  return (
    <View style={styles.container}>
      {/* Watchlist tabs */}
      {lists.length > 1 && (
        <View style={styles.tabBar}>
          {lists.map((list) => (
            <TouchableOpacity
              key={list.id}
              style={[
                styles.tabItem,
                list.id === activeListId && styles.tabItemActive,
              ]}
              onPress={() => setActiveList(list.id)}
            >
              <Text
                style={[
                  styles.tabText,
                  list.id === activeListId && styles.tabTextActive,
                ]}
              >
                {list.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Symbol list */}
      <FlatList
        data={activeList?.items ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        contentContainerStyle={
          (activeList?.items.length ?? 0) === 0
            ? styles.emptyList
            : styles.listContent
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="list-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No symbols yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap + to add symbols to your watchlist
            </Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setSearchVisible(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Search modal */}
      <SymbolSearchModal
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onSelect={handleAddSymbol}
        title="Add to Watchlist"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navyBlack,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  tabItem: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: colors.accent,
  },
  tabText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    fontWeight: '500',
  },
  tabTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 100,
  },
  emptyList: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.navyBlack,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  rowSymbol: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  rowName: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  sparklineContainer: {
    width: 60,
    height: 28,
    marginHorizontal: spacing.sm,
  },
  rowRight: {
    alignItems: 'flex-end',
    minWidth: 90,
  },
  rowPrice: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  changeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  changeText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  swipeActionLeft: {
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    paddingHorizontal: spacing.md,
  },
  swipeActionRight: {
    backgroundColor: colors.tradingRed,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    paddingHorizontal: spacing.md,
  },
  swipeActionText: {
    color: '#fff',
    fontSize: fontSize.xs,
    fontWeight: '600',
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl * 3,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: spacing.lg,
  },
  emptySubtitle: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
})
