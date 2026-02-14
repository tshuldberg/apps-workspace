import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  SectionList,
  TextInput,
  Switch,
  Animated as RNAnimated,
} from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Swipeable } from 'react-native-gesture-handler'
import BottomSheet, { BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet'
import * as Haptics from 'expo-haptics'
import { formatPrice } from '@marlin/shared'
import { alertApi } from '../../services/alert-api'
import type {
  Alert,
  AlertCondition,
  CreateAlertInput,
  DeliveryMethod,
} from '../../services/alert-api'
import { SymbolSearchModal } from '../../components/symbol-search-modal'
import type { SymbolSearchResult } from '../../components/symbol-search-modal'
import { colors, spacing, fontSize } from '../../constants/theme'

const CONDITION_LABELS: Record<AlertCondition, string> = {
  price_above: 'Price Above',
  price_below: 'Price Below',
  price_crosses: 'Price Crosses',
}

const CONDITIONS: AlertCondition[] = ['price_above', 'price_below', 'price_crosses']

function AlertRow({ alert, onDelete }: { alert: Alert; onDelete: () => void }) {
  const swipeableRef = React.useRef<Swipeable>(null)
  const isTriggered = alert.status === 'triggered'
  const isPaused = alert.status === 'paused'

  const statusColor = isTriggered
    ? colors.tradingGreen
    : isPaused
      ? colors.textMuted
      : colors.accent

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
        style={styles.deleteAction}
        onPress={() => {
          swipeableRef.current?.close()
          onDelete()
        }}
      >
        <RNAnimated.View style={{ transform: [{ scale }] }}>
          <Ionicons name="trash-outline" size={22} color="#fff" />
        </RNAnimated.View>
      </TouchableOpacity>
    )
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
    >
      <View style={styles.alertRow}>
        <View style={styles.alertLeft}>
          <View style={styles.conditionRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={styles.conditionText}>
              {CONDITION_LABELS[alert.condition]}
            </Text>
          </View>
          <Text style={styles.targetPrice}>
            Target: {formatPrice(alert.targetPrice)}
          </Text>
          <Text style={styles.currentPrice}>
            Current: {formatPrice(alert.currentPrice)}
          </Text>
        </View>
        <View style={styles.alertRight}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {alert.status.charAt(0).toUpperCase() + alert.status.slice(1)}
          </Text>
          <View style={styles.deliveryIcons}>
            {alert.delivery.includes('push') && (
              <Ionicons
                name="phone-portrait-outline"
                size={14}
                color={colors.textMuted}
                style={styles.deliveryIcon}
              />
            )}
            {alert.delivery.includes('email') && (
              <Ionicons
                name="mail-outline"
                size={14}
                color={colors.textMuted}
                style={styles.deliveryIcon}
              />
            )}
          </View>
        </View>
      </View>
    </Swipeable>
  )
}

export default function AlertsScreen() {
  const params = useLocalSearchParams<{ symbol?: string }>()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetVisible, setSheetVisible] = useState(false)
  const [symbolSearchVisible, setSymbolSearchVisible] = useState(false)

  // Create alert form state
  const [newSymbol, setNewSymbol] = useState(params.symbol ?? '')
  const [newCondition, setNewCondition] = useState<AlertCondition>('price_above')
  const [newTargetPrice, setNewTargetPrice] = useState('')
  const [pushEnabled, setPushEnabled] = useState(true)
  const [emailEnabled, setEmailEnabled] = useState(false)

  const bottomSheetRef = React.useRef<BottomSheet>(null)
  const snapPoints = useMemo(() => ['65%'], [])

  const loadAlerts = useCallback(async () => {
    try {
      setLoading(true)
      const data = await alertApi.list()
      setAlerts(data)
    } catch {
      // Use mock data for development
      setAlerts([
        {
          id: '1',
          symbol: 'AAPL',
          condition: 'price_above',
          targetPrice: 200,
          currentPrice: 192.5,
          status: 'active',
          delivery: ['push'],
          createdAt: new Date().toISOString(),
          triggeredAt: null,
        },
        {
          id: '2',
          symbol: 'AAPL',
          condition: 'price_below',
          targetPrice: 180,
          currentPrice: 192.5,
          status: 'active',
          delivery: ['push', 'email'],
          createdAt: new Date().toISOString(),
          triggeredAt: null,
        },
        {
          id: '3',
          symbol: 'TSLA',
          condition: 'price_crosses',
          targetPrice: 250,
          currentPrice: 248.3,
          status: 'active',
          delivery: ['push'],
          createdAt: new Date().toISOString(),
          triggeredAt: null,
        },
      ])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAlerts()
  }, [loadAlerts])

  // If opened from watchlist with a symbol, auto-open create sheet
  useEffect(() => {
    if (params.symbol) {
      setNewSymbol(params.symbol)
      setSheetVisible(true)
      setTimeout(() => bottomSheetRef.current?.expand(), 300)
    }
  }, [params.symbol])

  const groupedAlerts = useMemo(() => {
    const groups: Record<string, Alert[]> = {}
    for (const alert of alerts) {
      if (!groups[alert.symbol]) groups[alert.symbol] = []
      groups[alert.symbol]!.push(alert)
    }
    return Object.entries(groups).map(([symbol, data]) => ({
      title: symbol,
      data,
    }))
  }, [alerts])

  const handleDelete = useCallback(
    async (id: string) => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      try {
        await alertApi.delete(id)
      } catch {
        // Optimistic removal
      }
      setAlerts((prev) => prev.filter((a) => a.id !== id))
    },
    [],
  )

  const handleCreate = useCallback(async () => {
    if (!newSymbol || !newTargetPrice) return

    const delivery: DeliveryMethod[] = []
    if (pushEnabled) delivery.push('push')
    if (emailEnabled) delivery.push('email')

    const input: CreateAlertInput = {
      symbol: newSymbol.toUpperCase(),
      condition: newCondition,
      targetPrice: parseFloat(newTargetPrice),
      delivery,
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    try {
      const created = await alertApi.create(input)
      setAlerts((prev) => [...prev, created])
    } catch {
      // Add optimistically
      const mockAlert: Alert = {
        id: `${Date.now()}`,
        ...input,
        currentPrice: input.targetPrice * 0.95,
        status: 'active',
        createdAt: new Date().toISOString(),
        triggeredAt: null,
      }
      setAlerts((prev) => [...prev, mockAlert])
    }

    bottomSheetRef.current?.close()
    setSheetVisible(false)
    setNewSymbol('')
    setNewTargetPrice('')
    setNewCondition('price_above')
  }, [newSymbol, newCondition, newTargetPrice, pushEnabled, emailEnabled])

  const handleSymbolSelect = useCallback((result: SymbolSearchResult) => {
    setNewSymbol(result.symbol)
    setSymbolSearchVisible(false)
  }, [])

  const openCreateSheet = useCallback(() => {
    setSheetVisible(true)
    setTimeout(() => bottomSheetRef.current?.expand(), 100)
  }, [])

  const renderSectionHeader = useCallback(
    ({ section }: { section: { title: string } }) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
      </View>
    ),
    [],
  )

  const renderAlert = useCallback(
    ({ item }: { item: Alert }) => (
      <AlertRow alert={item} onDelete={() => handleDelete(item.id)} />
    ),
    [handleDelete],
  )

  return (
    <View style={styles.container}>
      {/* Alert list */}
      <SectionList
        sections={groupedAlerts}
        keyExtractor={(item) => item.id}
        renderItem={renderAlert}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={
          groupedAlerts.length === 0 ? styles.emptyList : styles.listContent
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="notifications-off-outline"
              size={48}
              color={colors.textMuted}
            />
            <Text style={styles.emptyTitle}>No alerts</Text>
            <Text style={styles.emptySubtitle}>
              Tap + to create a price alert
            </Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openCreateSheet} activeOpacity={0.8}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Create alert bottom sheet */}
      {sheetVisible && (
        <BottomSheet
          ref={bottomSheetRef}
          snapPoints={snapPoints}
          enablePanDownToClose
          onClose={() => setSheetVisible(false)}
          backgroundStyle={styles.sheetBackground}
          handleIndicatorStyle={styles.sheetHandle}
        >
          <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>
            <Text style={styles.sheetTitle}>Create Alert</Text>

            {/* Symbol picker */}
            <Text style={styles.fieldLabel}>Symbol</Text>
            <TouchableOpacity
              style={styles.symbolPicker}
              onPress={() => setSymbolSearchVisible(true)}
            >
              <Text
                style={[
                  styles.symbolPickerText,
                  !newSymbol && styles.symbolPickerPlaceholder,
                ]}
              >
                {newSymbol || 'Select symbol...'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Condition picker */}
            <Text style={styles.fieldLabel}>Condition</Text>
            <View style={styles.conditionPicker}>
              {CONDITIONS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.conditionOption,
                    c === newCondition && styles.conditionOptionActive,
                  ]}
                  onPress={() => setNewCondition(c)}
                >
                  <Text
                    style={[
                      styles.conditionOptionText,
                      c === newCondition && styles.conditionOptionTextActive,
                    ]}
                  >
                    {CONDITION_LABELS[c]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Target price */}
            <Text style={styles.fieldLabel}>Target Price</Text>
            <TextInput
              style={styles.priceInput}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              value={newTargetPrice}
              onChangeText={setNewTargetPrice}
              keyboardType="decimal-pad"
            />

            {/* Delivery methods */}
            <Text style={styles.fieldLabel}>Delivery</Text>
            <View style={styles.deliveryRow}>
              <Text style={styles.deliveryLabel}>Push Notification</Text>
              <Switch
                value={pushEnabled}
                onValueChange={setPushEnabled}
                trackColor={{
                  false: colors.navyMid,
                  true: colors.accent,
                }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.deliveryRow}>
              <Text style={styles.deliveryLabel}>Email</Text>
              <Switch
                value={emailEnabled}
                onValueChange={setEmailEnabled}
                trackColor={{
                  false: colors.navyMid,
                  true: colors.accent,
                }}
                thumbColor="#fff"
              />
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!newSymbol || !newTargetPrice) && styles.submitButtonDisabled,
              ]}
              onPress={handleCreate}
              disabled={!newSymbol || !newTargetPrice}
              activeOpacity={0.8}
            >
              <Text style={styles.submitButtonText}>Create Alert</Text>
            </TouchableOpacity>
          </BottomSheetScrollView>
        </BottomSheet>
      )}

      {/* Symbol search for create form */}
      <SymbolSearchModal
        visible={symbolSearchVisible}
        onClose={() => setSymbolSearchVisible(false)}
        onSelect={handleSymbolSelect}
        title="Select Symbol"
      />
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
  emptyList: {
    flex: 1,
  },
  sectionHeader: {
    backgroundColor: colors.navyDark,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  alertRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.navyBlack,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  alertLeft: {
    flex: 1,
  },
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  conditionText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  targetPrice: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 4,
    marginLeft: 16,
  },
  currentPrice: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
    marginLeft: 16,
  },
  alertRight: {
    alignItems: 'flex-end',
  },
  statusText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  deliveryIcons: {
    flexDirection: 'row',
    marginTop: 4,
  },
  deliveryIcon: {
    marginLeft: 6,
  },
  deleteAction: {
    backgroundColor: colors.tradingRed,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
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
  // Bottom sheet
  sheetBackground: {
    backgroundColor: colors.navyDark,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  sheetHandle: {
    backgroundColor: colors.textMuted,
    width: 40,
  },
  sheetContent: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl * 2,
  },
  sheetTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xl,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  symbolPicker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.navyBlack,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  symbolPickerText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  symbolPickerPlaceholder: {
    color: colors.textMuted,
    fontWeight: '400',
  },
  conditionPicker: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  conditionOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.navyBlack,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  conditionOptionActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  conditionOptionText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontWeight: '500',
  },
  conditionOptionTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  priceInput: {
    backgroundColor: colors.navyBlack,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  deliveryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  deliveryLabel: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: '#fff',
  },
})
