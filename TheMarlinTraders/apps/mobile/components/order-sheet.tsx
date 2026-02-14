import React, { useCallback, useMemo, useState } from 'react'
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native'
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet'
import * as Haptics from 'expo-haptics'
import { formatPrice } from '@marlin/shared'
import { apiClient } from '../services/api-client'
import { colors, spacing, fontSize } from '../constants/theme'

type OrderSide = 'buy' | 'sell'
type OrderType = 'market' | 'limit' | 'stop'

interface OrderSheetProps {
  symbol: string
  currentPrice: number
  onClose: () => void
  onOrderSubmitted?: () => void
}

const QUICK_QTY = [1, 5, 10, 25, 100]

export function OrderSheet({
  symbol,
  currentPrice,
  onClose,
  onOrderSubmitted,
}: OrderSheetProps) {
  const bottomSheetRef = React.useRef<BottomSheet>(null)
  const snapPoints = useMemo(() => ['70%'], [])

  const [side, setSide] = useState<OrderSide>('buy')
  const [orderType, setOrderType] = useState<OrderType>('market')
  const [quantity, setQuantity] = useState(1)
  const [limitPrice, setLimitPrice] = useState('')
  const [stopPrice, setStopPrice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isBuy = side === 'buy'
  const sideColor = isBuy ? colors.tradingGreen : colors.tradingRed

  const effectivePrice =
    orderType === 'limit' && limitPrice
      ? parseFloat(limitPrice)
      : orderType === 'stop' && stopPrice
        ? parseFloat(stopPrice)
        : currentPrice

  const estimatedCost = effectivePrice * quantity

  const adjustQuantity = useCallback((delta: number) => {
    setQuantity((prev) => Math.max(1, prev + delta))
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }, [])

  const handleSubmit = useCallback(async () => {
    setSubmitting(true)
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    try {
      await apiClient.post('/trpc/paper.submitOrder', {
        symbol,
        side,
        type: orderType,
        quantity,
        limitPrice: orderType === 'limit' ? parseFloat(limitPrice) : undefined,
        stopPrice: orderType === 'stop' ? parseFloat(stopPrice) : undefined,
      })
    } catch {
      // Paper trading — accept optimistically
    }

    setSubmitting(false)
    onOrderSubmitted?.()
    onClose()
  }, [symbol, side, orderType, quantity, limitPrice, stopPrice, onClose, onOrderSubmitted])

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.sheetHandle}
    >
      <BottomSheetView style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.symbol}>{symbol}</Text>
          <Text style={styles.currentPrice}>{formatPrice(currentPrice)}</Text>
        </View>

        {/* Side toggle */}
        <View style={styles.sideToggle}>
          <TouchableOpacity
            style={[
              styles.sideButton,
              isBuy && { backgroundColor: colors.tradingGreen },
            ]}
            onPress={() => setSide('buy')}
            activeOpacity={0.8}
          >
            <Text
              style={[styles.sideButtonText, isBuy && styles.sideButtonTextActive]}
            >
              Buy
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.sideButton,
              !isBuy && { backgroundColor: colors.tradingRed },
            ]}
            onPress={() => setSide('sell')}
            activeOpacity={0.8}
          >
            <Text
              style={[styles.sideButtonText, !isBuy && styles.sideButtonTextActive]}
            >
              Sell
            </Text>
          </TouchableOpacity>
        </View>

        {/* Order type */}
        <View style={styles.orderTypeRow}>
          {(['market', 'limit', 'stop'] as OrderType[]).map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.orderTypeButton,
                type === orderType && styles.orderTypeButtonActive,
              ]}
              onPress={() => setOrderType(type)}
            >
              <Text
                style={[
                  styles.orderTypeText,
                  type === orderType && styles.orderTypeTextActive,
                ]}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quantity */}
        <Text style={styles.fieldLabel}>Quantity</Text>
        <View style={styles.quantityRow}>
          <TouchableOpacity
            style={styles.qtyButton}
            onPress={() => adjustQuantity(-1)}
          >
            <Text style={styles.qtyButtonText}>-</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.qtyInput}
            value={String(quantity)}
            onChangeText={(t) => {
              const n = parseInt(t, 10)
              if (!isNaN(n) && n > 0) setQuantity(n)
            }}
            keyboardType="number-pad"
          />
          <TouchableOpacity
            style={styles.qtyButton}
            onPress={() => adjustQuantity(1)}
          >
            <Text style={styles.qtyButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Quick-select quantities */}
        <View style={styles.quickQtyRow}>
          {QUICK_QTY.map((q) => (
            <TouchableOpacity
              key={q}
              style={[
                styles.quickQtyButton,
                q === quantity && { borderColor: sideColor },
              ]}
              onPress={() => {
                setQuantity(q)
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              }}
            >
              <Text
                style={[
                  styles.quickQtyText,
                  q === quantity && { color: sideColor },
                ]}
              >
                {q}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Limit price */}
        {orderType === 'limit' && (
          <>
            <Text style={styles.fieldLabel}>Limit Price</Text>
            <TextInput
              style={styles.priceInput}
              placeholder={formatPrice(currentPrice)}
              placeholderTextColor={colors.textMuted}
              value={limitPrice}
              onChangeText={setLimitPrice}
              keyboardType="decimal-pad"
            />
          </>
        )}

        {/* Stop price */}
        {orderType === 'stop' && (
          <>
            <Text style={styles.fieldLabel}>Stop Price</Text>
            <TextInput
              style={styles.priceInput}
              placeholder={formatPrice(currentPrice)}
              placeholderTextColor={colors.textMuted}
              value={stopPrice}
              onChangeText={setStopPrice}
              keyboardType="decimal-pad"
            />
          </>
        )}

        {/* Estimated cost */}
        <View style={styles.estimateRow}>
          <Text style={styles.estimateLabel}>Estimated {isBuy ? 'Cost' : 'Proceeds'}</Text>
          <Text style={styles.estimateValue}>
            ${estimatedCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: sideColor }]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          <Text style={styles.submitText}>
            {submitting
              ? 'Submitting...'
              : `${isBuy ? 'Buy' : 'Sell'} ${quantity} ${symbol}`}
          </Text>
        </TouchableOpacity>
      </BottomSheetView>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: colors.navyDark,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  sheetHandle: {
    backgroundColor: colors.textMuted,
    width: 40,
  },
  content: {
    padding: spacing.xl,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  symbol: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  currentPrice: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  sideToggle: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sideButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.navyMid,
  },
  sideButtonText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.textMuted,
  },
  sideButtonTextActive: {
    color: '#fff',
  },
  orderTypeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  orderTypeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  orderTypeButtonActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  orderTypeText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: '500',
  },
  orderTypeTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  qtyButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.navyMid,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyButtonText: {
    fontSize: fontSize.xl,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  qtyInput: {
    flex: 1,
    height: 44,
    backgroundColor: colors.navyBlack,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  quickQtyRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  quickQtyButton: {
    flex: 1,
    paddingVertical: spacing.xs,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickQtyText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
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
    marginBottom: spacing.lg,
  },
  estimateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginBottom: spacing.lg,
  },
  estimateLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  estimateValue: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  submitButton: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: '#fff',
  },
})
