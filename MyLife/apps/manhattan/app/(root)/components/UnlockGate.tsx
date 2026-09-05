import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { PRODUCTS } from '@mylife/billing-config';
import { Button, Card, Text } from '@mylife/ui';
import { useManhattanBilling, useManhattanUnlocked } from '../providers/ManhattanEntitlementsProvider';

const BACKGROUND = '#131318';

// Gates the app behind the standalone Manhattan unlock entitlement.
export function UnlockGate({ children }: { children: React.ReactNode }) {
  const unlocked = useManhattanUnlocked();
  const {
    purchaseManhattan,
    restorePurchases,
    refreshEntitlements,
    isConfigured,
    isTestMode,
    lastError,
  } = useManhattanBilling();
  const [busyAction, setBusyAction] = useState<'purchase' | 'restore' | 'refresh' | null>(null);

  if (unlocked) {
    return <>{children}</>;
  }

  const price = PRODUCTS.standaloneModules.manhattan.price;
  const priceLabel = `$${price.toFixed(2)}`;

  const handleUnlock = async () => {
    setBusyAction('purchase');
    try {
      const didUnlock = await purchaseManhattan();
      if (!didUnlock) {
        Alert.alert('Unlock Manhattan', lastError ?? 'The purchase did not unlock Manhattan.');
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleRestore = async () => {
    setBusyAction('restore');
    try {
      const didUnlock = await restorePurchases();
      Alert.alert(
        'Restore purchases',
        didUnlock
          ? 'Your Manhattan purchase was restored.'
          : 'No active Manhattan purchase was found for this store account.',
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleRefresh = async () => {
    setBusyAction('refresh');
    try {
      await refreshEntitlements();
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Text variant="heading" color="#E4E1E9" style={styles.title}>
          Unlock Manhattan
        </Text>
        <Text variant="body" color="#D6C3B5" style={styles.body}>
          A one-time {priceLabel} unlock gives you full access to Manhattan on
          this device.
        </Text>
        <Button
          title={busyAction === 'purchase' ? 'Opening store...' : `Unlock for ${priceLabel}`}
          onPress={() => { void handleUnlock(); }}
          disabled={!isConfigured || busyAction !== null}
        />
        <Button
          title={busyAction === 'restore' ? 'Restoring...' : 'Restore purchase'}
          onPress={() => { void handleRestore(); }}
          disabled={!isConfigured || busyAction !== null}
          variant="secondary"
        />
        <Button
          title={busyAction === 'refresh' ? 'Checking...' : 'Refresh entitlement'}
          onPress={() => { void handleRefresh(); }}
          disabled={busyAction !== null}
          variant="secondary"
        />
        {!isConfigured ? (
          <Text variant="caption" color="#FFB4AB" style={styles.caption}>
            Purchases are not configured on this build.
          </Text>
        ) : null}
        {lastError ? (
          <Text variant="caption" color="#FFB4AB" style={styles.caption}>
            {lastError}
          </Text>
        ) : null}
        <Text variant="caption" color="#9F8E81" style={styles.caption}>
          {isTestMode
            ? 'Development entitlement test mode is enabled for this build.'
            : 'Purchases are validated by the App Store or Play Store through RevenueCat.'}
        </Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: { gap: 16 },
  title: { textAlign: 'center' },
  body: { textAlign: 'center' },
  caption: { textAlign: 'center' },
});
