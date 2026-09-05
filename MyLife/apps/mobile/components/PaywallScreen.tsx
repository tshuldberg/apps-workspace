import { useState } from 'react';
import { ScrollView, StyleSheet, View, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import type { ModuleId } from '@mylife/module-registry';
import { GA_MODULE_IDS } from '@mylife/module-registry';
import { Text, colors, spacing, borderRadius } from '@mylife/ui';
import { PRODUCTS } from '@mylife/billing-config';
import type { ProductId } from '@mylife/entitlements';
import { usePayment } from './EntitlementsProvider';

interface PaywallScreenProps {
  moduleId: ModuleId;
  moduleName: string;
  moduleIcon: string;
  accentColor: string;
}

const FEATURES = [
  { icon: '\u{1F513}', label: `Unlock all ${GA_MODULE_IDS.length} modules` },
  { icon: '\u{1F4F1}', label: 'iOS, Android, and Web' },
  { icon: '\u{1F512}', label: 'Privacy-first, offline-capable' },
  { icon: '\u{267E}\u{FE0F}', label: 'One-time purchase, yours forever' },
  { icon: '\u{1F504}', label: 'Free updates for 1 year' },
];

/**
 * Full-screen paywall shown when a user opens a premium module
 * without an active purchase. Offers hub unlock ($19.99) and
 * standalone module unlock ($4.99) with a feature list and
 * restore purchases option.
 */
export function PaywallScreen({
  moduleId,
  moduleName,
  moduleIcon,
  accentColor,
}: PaywallScreenProps) {
  const router = useRouter();
  const { paymentService, refreshEntitlements } = usePayment();
  const [purchasing, setPurchasing] = useState<'hub' | 'standalone' | 'restore' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hubPrice = PRODUCTS.hubUnlock.price;
  const standalonePrice =
    moduleId in PRODUCTS.standaloneModules
      ? PRODUCTS.standaloneModules[moduleId as keyof typeof PRODUCTS.standaloneModules]?.price ?? null
      : null;

  const isLoading = purchasing !== null;

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed');
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
    >
      {/* Module hero */}
      <View style={styles.hero}>
        <Text style={styles.heroIcon}>{moduleIcon}</Text>
        <Text style={[styles.heroTitle, { color: accentColor }]}>{moduleName}</Text>
        <Text style={styles.heroSubtitle}>
          Part of MyLife Pro
        </Text>
      </View>

      {/* Feature list */}
      <View style={styles.featureList}>
        {FEATURES.map((f) => (
          <View key={f.label} style={styles.featureRow}>
            <Text style={styles.featureIcon}>{f.icon}</Text>
            <Text style={styles.featureLabel}>{f.label}</Text>
          </View>
        ))}
      </View>

      {/* Hub unlock (primary CTA) */}
      <Pressable
        style={({ pressed }) => [
          styles.hubButton,
          { backgroundColor: pressed ? `${accentColor}CC` : accentColor },
          isLoading && styles.disabled,
        ]}
        onPress={() => void handlePurchase('hub')}
        disabled={isLoading}
      >
        {purchasing === 'hub' ? (
          <ActivityIndicator color={colors.background} size="small" />
        ) : (
          <View style={styles.buttonInner}>
            <View>
              <Text style={styles.hubButtonTitle}>Unlock Everything</Text>
              <Text style={styles.hubButtonSubtitle}>All modules, one purchase</Text>
            </View>
            <Text style={styles.hubPrice}>${hubPrice.toFixed(2)}</Text>
          </View>
        )}
      </Pressable>

      {/* Standalone unlock (secondary CTA) */}
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
            <View style={styles.buttonInner}>
              <Text style={[styles.standaloneButtonText, { color: accentColor }]}>
                Just {moduleName}
              </Text>
              <Text style={[styles.standalonePrice, { color: accentColor }]}>
                ${standalonePrice.toFixed(2)}
              </Text>
            </View>
          )}
        </Pressable>
      )}

      {/* Error */}
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      {/* Restore + back */}
      <View style={styles.footer}>
        <Pressable onPress={() => void handleRestore()} disabled={isLoading}>
          {purchasing === 'restore' ? (
            <ActivityIndicator color={colors.textSecondary} size="small" />
          ) : (
            <Text style={styles.linkText}>Restore Purchases</Text>
          )}
        </Pressable>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.linkText}>Back</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.lg,
    paddingTop: 60,
    paddingBottom: 48,
    alignItems: 'center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  heroIcon: {
    fontSize: 72,
    marginBottom: spacing.sm,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  featureList: {
    width: '100%',
    maxWidth: 360,
    marginBottom: spacing.xl,
    gap: 14,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  featureLabel: {
    fontSize: 15,
    color: colors.text,
    flex: 1,
  },
  hubButton: {
    width: '100%',
    maxWidth: 360,
    paddingVertical: 16,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.sm,
    minHeight: 56,
    justifyContent: 'center',
  },
  buttonInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hubButtonTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.background,
  },
  hubButtonSubtitle: {
    fontSize: 12,
    color: 'rgba(0,0,0,0.5)',
    marginTop: 2,
  },
  hubPrice: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.background,
  },
  standaloneButton: {
    width: '100%',
    maxWidth: 360,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    backgroundColor: 'transparent',
    marginBottom: spacing.sm,
    minHeight: 48,
    justifyContent: 'center',
  },
  standaloneButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  standalonePrice: {
    fontSize: 18,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.6,
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  linkText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});
