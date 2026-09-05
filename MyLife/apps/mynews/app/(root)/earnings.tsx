import { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  summarizeJournalistPayout,
  type JournalistPayoutSummary,
  type PayoutAccountSummary,
} from '@mylife/mynews';
import { PrimaryButton, SecondaryButton } from './components/Buttons';
import { ScreenHeader } from './components/ScreenHeader';
import { useMyNewsAuth } from './providers/AuthProvider';
import { useMyNewsCloud } from './providers/CloudProvider';
import { tokens } from './theme/tokens';
import {
  getMyNewsPaymentsRuntimeConfig,
  MYNEWS_PAYMENTS_UNAVAILABLE_COPY,
} from './data/runtime-capabilities';
import {
  fetchJournalistLedger,
  fetchPayoutAccount,
  startPayoutOnboarding,
} from './data/support-client';
import { ErrorText } from './components/ErrorText';

type EarningsState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'not-journalist' }
  | { status: 'loaded'; payout: JournalistPayoutSummary; account: PayoutAccountSummary }
  | { status: 'error'; message: string };

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
}

export default function EarningsScreen() {
  const auth = useMyNewsAuth();
  const cloud = useMyNewsCloud();
  const payments = useMemo(() => getMyNewsPaymentsRuntimeConfig(), []);
  const [state, setState] = useState<EarningsState>({ status: 'loading' });
  const [onboarding, setOnboarding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!payments.ok) return;
    if ((auth.status !== 'anonymous' && auth.status !== 'linked') || !cloud.port) {
      setState({ status: 'signed-out' });
      return;
    }
    setState({ status: 'loading' });
    try {
      const profile = await cloud.port.getMyProfile();
      if (!profile || profile.kind !== 'journalist') {
        setState({ status: 'not-journalist' });
        return;
      }
      const token = await auth.getAccessToken();
      if (!token) throw new Error('Sign in to load earnings.');
      const [ledger, account] = await Promise.all([
        fetchJournalistLedger(payments.config, token, profile.id),
        fetchPayoutAccount(payments.config, token, profile.id),
      ]);
      setState({
        status: 'loaded',
        payout: summarizeJournalistPayout(ledger, account),
        account,
      });
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  }, [auth, cloud.port, payments]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const beginOnboarding = useCallback(async () => {
    if (!payments.ok) return;
    setOnboarding(true);
    setActionError(null);
    try {
      const token = await auth.getAccessToken();
      if (!token) throw new Error('Sign in to configure payouts.');
      const result = await startPayoutOnboarding(payments.config, token);
      if (result.url) await Linking.openURL(result.url);
      await load();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setOnboarding(false);
    }
  }, [auth, load, payments]);

  if (!payments.ok) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Earnings and payouts" />
        <View style={styles.center}>
          <Text style={styles.errorTitle}>{MYNEWS_PAYMENTS_UNAVAILABLE_COPY}</Text>
          <Text style={styles.body}>
            Earnings, onboarding, and payout controls are disabled because this build has no
            configured payment rail.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Earnings and payouts" />
      <ScrollView contentContainerStyle={styles.content}>
        {state.status === 'loading' ? (
          <Text style={styles.body}>Loading verified ledger entries...</Text>
        ) : state.status === 'signed-out' ? (
          <Text style={styles.body}>Sign in to view journalist earnings and payout status.</Text>
        ) : state.status === 'not-journalist' ? (
          <Text style={styles.body}>Create a journalist profile before configuring payouts.</Text>
        ) : state.status === 'error' ? (
          <View style={styles.card}>
            <ErrorText style={styles.error}>{state.message}</ErrorText>
            <SecondaryButton label="Try again" onPress={() => void load()} />
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.label}>Available</Text>
                <Text style={styles.amount}>
                  {money(state.payout.availableCents, state.payout.currency)}
                </Text>
              </View>
              <Metric label="Gross support" value={money(state.payout.grossCents, state.payout.currency)} />
              <Metric label="Platform fees" value={money(state.payout.platformFeeCents, state.payout.currency)} />
              {state.payout.platformFeeReversalCents > 0 ? (
                <Metric
                  label="Platform fee reversals"
                  value={money(state.payout.platformFeeReversalCents, state.payout.currency)}
                />
              ) : null}
              <Metric label="Refunds" value={money(state.payout.refundedCents, state.payout.currency)} />
              <Metric label="Dispute holds" value={money(state.payout.disputeHoldCents, state.payout.currency)} />
              <Metric label="Paid out" value={money(state.payout.paidOutCents, state.payout.currency)} />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Payout account</Text>
              <Text style={styles.status}>{state.account.state.replace(/_/g, ' ')}</Text>
              {state.account.statusReason ? (
                <ErrorText style={styles.error}>{state.account.statusReason}</ErrorText>
              ) : null}
              {state.account.state === 'verified' ? (
                <Text style={styles.success}>Your provider account is verified for payouts.</Text>
              ) : (
                <PrimaryButton
                  label={onboarding ? 'Opening provider...' : 'Continue payout setup'}
                  onPress={() => void beginOnboarding()}
                  loading={onboarding}
                />
              )}
              {actionError ? <ErrorText style={styles.error}>{actionError}</ErrorText> : null}
              <Text style={styles.caption}>
                Identity checks, tax details, bank details, and payout timing are handled by the
                configured payment provider. MyNews never displays the provider account reference.
              </Text>
            </View>

            <Pressable onPress={() => void load()} accessibilityRole="button">
              <Text style={styles.refresh}>Refresh verified ledger</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 18, gap: 14, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', padding: 28, gap: 10 },
  card: {
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  cardTitle: { color: tokens.text, fontSize: 17, fontWeight: '700' },
  body: { color: tokens.textSecondary, fontSize: 14, lineHeight: 21 },
  errorTitle: { color: tokens.danger, fontSize: 18, fontWeight: '700' },
  error: { color: tokens.danger, fontSize: 13, lineHeight: 19 },
  success: { color: tokens.success, fontSize: 13, lineHeight: 19 },
  status: { color: tokens.accent, fontSize: 18, fontWeight: '800', textTransform: 'capitalize' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  label: { color: tokens.textSecondary, fontSize: 14 },
  value: { color: tokens.text, fontSize: 14, fontWeight: '700' },
  amount: { color: tokens.accent, fontSize: 22, fontWeight: '800' },
  caption: { color: tokens.textTertiary, fontSize: 12, lineHeight: 18 },
  refresh: { color: tokens.accent, textAlign: 'center', fontSize: 14, fontWeight: '700' },
});
