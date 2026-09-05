import React, { useState } from 'react';
import { StyleSheet, View, Pressable, ActivityIndicator } from 'react-native';
import type { ModuleId } from '@mylife/module-registry';
import { Card, Text, Button, colors, spacing, borderRadius } from '@mylife/ui';
import { PRODUCTS } from '@mylife/billing-config';
import type { ProductId } from '@mylife/entitlements';
import { usePayment } from './EntitlementsProvider';

interface PurchaseGateProps {
  moduleId: ModuleId;
  moduleName: string;
  moduleIcon: string;
  accentColor: string;
  onPurchaseComplete?: () => void;
}

/**
 * Purchase gate shown when a user taps a locked premium module.
 *
 * Offers two purchase options:
 * 1. Hub unlock ($19.99) -- unlocks all modules
 * 2. Standalone module unlock ($4.99) -- unlocks just this module
 *
 * Also includes a "Restore Purchases" link for users who already purchased.
 */
export function PurchaseGate({
  moduleId,
  moduleName,
  moduleIcon,
  accentColor,
  onPurchaseComplete,
}: PurchaseGateProps) {
  const { paymentService, refreshEntitlements } = usePayment();
  const [purchasing, setPurchasing] = useState<'hub' | 'standalone' | 'restore' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hubPrice = PRODUCTS.hubUnlock.price;
  const standalonePrice =
    moduleId !== 'fast' && moduleId in PRODUCTS.standaloneModules
      ? PRODUCTS.standaloneModules[moduleId as keyof typeof PRODUCTS.standaloneModules].price
      : null;

  const handlePurchase = async (type: 'hub' | 'standalone') => {
    if (!paymentService) return;
    setPurchasing(type);
    setError(null);

    try {
      const productId: ProductId =
        type === 'hub'
          ? 'mylife_hub_unlock'
          : (`mylife_${moduleId}_unlock` as ProductId);

      const result = await paymentService.purchase(productId);
      if (result.success) {
        await refreshEntitlements();
        onPurchaseComplete?.();
      } else if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setPurchasing(null);
    }
  };

  const handleRestore = async () => {
    if (!paymentService) return;
    setPurchasing('restore');
    setError(null);

    try {
      await paymentService.restore();
      await refreshEntitlements();
      onPurchaseComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed');
    } finally {
      setPurchasing(null);
    }
  };

  const isLoading = purchasing !== null;

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        {/* Module icon and name */}
        <View style={styles.header}>
          <Text style={styles.icon}>{moduleIcon}</Text>
          <Text variant="heading" style={styles.moduleName}>{moduleName}</Text>
          <Text variant="caption" color={colors.textSecondary} style={styles.subtitle}>
            This module requires a purchase to unlock.
          </Text>
        </View>

        {/* Hub unlock button */}
        <Pressable
          style={({ pressed }) => [
            styles.purchaseButton,
            { backgroundColor: pressed ? `${accentColor}CC` : accentColor },
            isLoading && styles.disabled,
          ]}
          onPress={() => void handlePurchase('hub')}
          disabled={isLoading}
        >
          {purchasing === 'hub' ? (
            <ActivityIndicator color={colors.background} size="small" />
          ) : (
            <>
              <Text style={styles.purchaseButtonText}>Unlock All Modules</Text>
              <Text style={styles.priceText}>${hubPrice.toFixed(2)}</Text>
            </>
          )}
        </Pressable>

        {/* Standalone unlock button */}
        {standalonePrice !== null && (
          <Pressable
            style={({ pressed }) => [
              styles.standaloneButton,
              { borderColor: accentColor },
              pressed && { backgroundColor: `${accentColor}15` },
              isLoading && styles.disabled,
            ]}
            onPress={() => void handlePurchase('standalone')}
            disabled={isLoading}
          >
            {purchasing === 'standalone' ? (
              <ActivityIndicator color={accentColor} size="small" />
            ) : (
              <>
                <Text style={[styles.standaloneButtonText, { color: accentColor }]}>
                  Unlock {moduleName}
                </Text>
                <Text style={[styles.priceText, { color: accentColor }]}>
                  ${standalonePrice.toFixed(2)}
                </Text>
              </>
            )}
          </Pressable>
        )}

        {/* Error message */}
        {error && (
          <Text variant="caption" color={colors.danger} style={styles.error}>
            {error}
          </Text>
        )}

        {/* Restore purchases */}
        <Pressable
          style={styles.restoreButton}
          onPress={() => void handleRestore()}
          disabled={isLoading}
        >
          {purchasing === 'restore' ? (
            <ActivityIndicator color={colors.textSecondary} size="small" />
          ) : (
            <Text variant="caption" color={colors.textSecondary}>
              Restore Purchases
            </Text>
          )}
        </Pressable>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  icon: {
    fontSize: 56,
    marginBottom: spacing.sm,
  },
  moduleName: {
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    textAlign: 'center',
  },
  purchaseButton: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  purchaseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.background,
  },
  standaloneButton: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    backgroundColor: 'transparent',
    marginBottom: spacing.sm,
  },
  standaloneButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.6,
  },
  error: {
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  restoreButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
});
