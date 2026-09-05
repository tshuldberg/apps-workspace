import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSegments } from 'expo-router';
import { PRODUCTS } from '@mylife/billing-config';
import { PrimaryButton, SecondaryButton } from './Buttons';
import { useMyNewsSubscription } from '../providers/SubscriptionProvider';
import { premiumGateView } from '../lib/premium-gate';
import { tokens } from '../theme/tokens';
import { ErrorText } from './ErrorText';

export function PremiumGate({ children }: { children: React.ReactNode }) {
  const subscription = useMyNewsSubscription();
  const segments = useSegments();
  const [busy, setBusy] = useState<'purchase' | 'restore' | 'refresh' | null>(null);

  // Legal documents, moderation notices, and account deletion/export are
  // obligations that must stay reachable in an unentitled or unconfigured
  // build. Every other route keeps its gating.
  const view = premiumGateView({
    isEntitled: subscription.isEntitled,
    isConfigured: subscription.isConfigured,
    status: subscription.status,
    segments: segments as readonly string[],
  });

  if (view === 'children') return <>{children}</>;

  if (view === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tokens.accent} size="large" />
        <Text style={styles.body}>Checking your MyNews access...</Text>
      </View>
    );
  }

  if (view === 'unavailable') {
    return (
      <View style={styles.center}>
        <View style={styles.card}>
          <Text style={styles.title}>MyNews access unavailable</Text>
          <Text style={styles.body}>Subscriptions are not available in this build.</Text>
          <Text style={styles.caption}>
            This build has no store connection, so it cannot open a paywall, make a purchase, or
            simulate access.
          </Text>
        </View>
      </View>
    );
  }

  const price = `$${PRODUCTS.standaloneModules.mynews.price.toFixed(2)}`;
  const run = async (action: 'purchase' | 'restore' | 'refresh') => {
    setBusy(action);
    try {
      if (action === 'purchase') await subscription.purchase();
      if (action === 'restore') await subscription.restore();
      if (action === 'refresh') await subscription.refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.center}>
      <View style={styles.card}>
        <Text style={styles.title}>Unlock MyNews</Text>
        <Text style={styles.body}>
          Read, publish under a signed byline, follow journalists, and work in the editing desk.
          MyNews is a one-time {price} purchase through your device store.
        </Text>
        <PrimaryButton
          label={busy === 'purchase' ? 'Opening store...' : `Unlock for ${price}`}
          onPress={() => void run('purchase')}
          loading={busy === 'purchase'}
          disabled={busy !== null}
        />
        <SecondaryButton
          label={busy === 'restore' ? 'Restoring...' : 'Restore purchase'}
          onPress={() => void run('restore')}
          disabled={busy !== null}
        />
        {subscription.status === 'error' ? (
          <SecondaryButton
            label={busy === 'refresh' ? 'Checking...' : 'Try again'}
            onPress={() => void run('refresh')}
            disabled={busy !== null}
          />
        ) : null}
        {subscription.lastError ? <ErrorText style={styles.error}>{subscription.lastError}</ErrorText> : null}
        <Text style={styles.caption}>
          Purchases and restores are verified by the App Store or Play Store through RevenueCat.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: tokens.bg,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  card: {
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: 18,
    padding: 22,
    gap: 16,
  },
  title: { color: tokens.text, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  body: { color: tokens.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  caption: { color: tokens.textTertiary, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  error: { color: tokens.danger, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});

