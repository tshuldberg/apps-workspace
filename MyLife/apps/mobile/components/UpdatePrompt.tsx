import React, { useState } from 'react';
import { StyleSheet, View, Pressable, ActivityIndicator } from 'react-native';
import { Card, Text, colors, spacing, borderRadius } from '@mylife/ui';
import { PRODUCTS } from '@mylife/billing-config';
import { useEntitlements, usePayment } from './EntitlementsProvider';

/**
 * Banner shown on the hub dashboard or settings when the user's
 * update entitlement has expired (past Year 1, no annual update purchased).
 *
 * The app still works, but the user won't receive updates until they renew.
 */
export function UpdatePrompt() {
  const entitlements = useEntitlements();
  const { paymentService, refreshEntitlements } = usePayment();
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only show when updates are NOT entitled and user has made at least one purchase
  if (entitlements.updateEntitled || !entitlements.purchaseDate) {
    return null;
  }

  const handleRenew = async () => {
    if (!paymentService) return;
    setPurchasing(true);
    setError(null);

    try {
      const result = await paymentService.purchase('mylife_annual_update');
      if (result.success) {
        await refreshEntitlements();
      } else if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.content}>
        <Text variant="subheading" style={styles.title}>
          Your update period has expired
        </Text>
        <Text variant="caption" color={colors.textSecondary} style={styles.description}>
          Your app still works, but you will not receive new updates or features
          until you renew.
        </Text>
        {error && (
          <Text variant="caption" color={colors.danger} style={styles.error}>
            {error}
          </Text>
        )}
      </View>
      <Pressable
        style={({ pressed }) => [
          styles.renewButton,
          pressed && styles.renewButtonPressed,
          purchasing && styles.disabled,
        ]}
        onPress={() => void handleRenew()}
        disabled={purchasing}
      >
        {purchasing ? (
          <ActivityIndicator color={colors.text} size="small" />
        ) : (
          <Text style={styles.renewText}>
            Renew for ${PRODUCTS.annualUpdate.price.toFixed(2)}/year
          </Text>
        )}
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: colors.danger,
    borderWidth: 1,
  },
  content: {
    flex: 1,
    marginRight: spacing.md,
  },
  title: {
    marginBottom: spacing.xs,
  },
  description: {
    lineHeight: 18,
  },
  error: {
    marginTop: spacing.xs,
  },
  renewButton: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  renewButtonPressed: {
    backgroundColor: colors.surface,
  },
  renewText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  disabled: {
    opacity: 0.6,
  },
});
