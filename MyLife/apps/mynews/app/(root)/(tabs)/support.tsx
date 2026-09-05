import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  splitReaderSupport,
  summarizeReaderSupportHistory,
  type ProfileView,
  type SupportReceipt,
} from '@mylife/mynews';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { useMyNewsAuth } from '../providers/AuthProvider';
import { useMyNewsCloud } from '../providers/CloudProvider';
import { tokens } from '../theme/tokens';
import {
  getMyNewsPaymentsRuntimeConfig,
  MYNEWS_PAYMENTS_UNAVAILABLE_COPY,
} from '../data/runtime-capabilities';
import {
  createSupportCheckout,
  fetchSupportReceipts,
  nextSupportConfirmation,
  type SupportConfirmation,
} from '../data/support-client';
import { ErrorText } from '../components/ErrorText';

const AMOUNTS = [500, 1_000, 2_500, 5_000] as const;

interface SupportTarget {
  profileId: string;
  handle: string;
  displayName: string;
}

function money(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
}

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ journalistId?: string; journalistHandle?: string }>();
  const auth = useMyNewsAuth();
  const cloud = useMyNewsCloud();
  const payments = useMemo(() => getMyNewsPaymentsRuntimeConfig(), []);
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [receipts, setReceipts] = useState<SupportReceipt[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [handleDraft, setHandleDraft] = useState('');
  const [target, setTarget] = useState<SupportTarget | null>(null);
  const [targetError, setTargetError] = useState<string | null>(null);
  const [targetBusy, setTargetBusy] = useState(false);
  const [amountCents, setAmountCents] = useState<number>(1_000);
  // The confirmed attempt, carrying the stable idempotency key. Null means the
  // reader has not confirmed this journalist/amount pair yet.
  const [confirmation, setConfirmation] = useState<SupportConfirmation | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    if (params.journalistId && params.journalistHandle) {
      setTarget({
        profileId: params.journalistId,
        handle: params.journalistHandle,
        displayName: `@${params.journalistHandle}`,
      });
      setHandleDraft(params.journalistHandle);
    }
  }, [params.journalistHandle, params.journalistId]);

  const hasSession = auth.status === 'anonymous' || auth.status === 'linked';

  const loadHistory = useCallback(async () => {
    if (!payments.ok || !cloud.port || !hasSession) {
      setProfile(null);
      setReceipts([]);
      return;
    }
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const mine = await cloud.port.getMyProfile();
      setProfile(mine);
      if (!mine) {
        setReceipts([]);
        return;
      }
      const token = await auth.getAccessToken();
      if (!token) throw new Error('Sign in to load support history.');
      setReceipts(await fetchSupportReceipts(payments.config, token, mine.id));
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingHistory(false);
    }
  }, [auth, cloud.port, hasSession, payments]);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory]),
  );

  const resolveTarget = useCallback(async () => {
    if (!cloud.port || !handleDraft.trim()) return;
    setTargetBusy(true);
    setTargetError(null);
    setTarget(null);
    try {
      const journalist = await cloud.port.getJournalistByHandle(
        handleDraft.trim().replace(/^@/, ''),
      );
      if (!journalist?.id) {
        setTargetError('No support-enabled journalist matches that handle.');
        return;
      }
      setTarget({
        profileId: journalist.id,
        handle: journalist.handle,
        displayName: journalist.displayName,
      });
      setConfirmation(null);
    } catch (error) {
      setTargetError(error instanceof Error ? error.message : String(error));
    } finally {
      setTargetBusy(false);
    }
  }, [cloud.port, handleDraft]);

  const createProfile = useCallback(async () => {
    const result = await auth.ensureSession();
    if (result.ok) router.push('/(root)/register' as never);
    else setHistoryError(result.error);
  }, [auth, router]);

  const confirmSupport = useCallback(() => {
    if (!target) return;
    setConfirmation((current) =>
      nextSupportConfirmation(current, {
        journalistProfileId: target.profileId,
        amountCents,
      }),
    );
  }, [amountCents, target]);

  const beginCheckout = useCallback(async () => {
    if (!payments.ok || !target || !profile || !confirmation) return;
    setCheckoutBusy(true);
    setCheckoutError(null);
    setCheckoutMessage(null);
    try {
      const token = await auth.getAccessToken();
      if (!token) throw new Error('Sign in before opening checkout.');
      // The confirmation's key is reused on every retry of this attempt, so a
      // failed or repeated press replays the same checkout instead of opening
      // another one.
      const checkoutUrl = await createSupportCheckout(payments.config, token, {
        journalistProfileId: confirmation.journalistProfileId,
        amountCents: confirmation.amountCents,
        idempotencyKey: confirmation.idempotencyKey,
      });
      await Linking.openURL(checkoutUrl);
      setCheckoutMessage(
        'Secure checkout opened. After payment, return here and refresh history for the verified receipt.',
      );
      setConfirmation(null);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : String(error));
    } finally {
      setCheckoutBusy(false);
    }
  }, [auth, confirmation, payments, profile, target]);

  if (!payments.ok) {
    return (
      <View style={styles.unavailable}>
        <Text style={styles.title}>Support journalists</Text>
        <Text style={styles.unavailableTitle}>{MYNEWS_PAYMENTS_UNAVAILABLE_COPY}</Text>
        <Text style={styles.body}>
          This build has no configured payment rail. No checkout, receipt, payout, or simulated
          support action is available.
        </Text>
      </View>
    );
  }

  const split = splitReaderSupport(amountCents);
  const history = profile ? summarizeReaderSupportHistory(receipts, profile.id) : null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
    >
      <Text style={styles.title}>Support journalists</Text>
      <Text style={styles.body}>
        Choose a journalist and amount. MyNews shows its 2% platform fee before checkout, and a
        verified receipt appears here only after the payment webhook records it.
      </Text>

      {!hasSession ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Create a support profile</Text>
          <Text style={styles.body}>A profile ties your provider receipt to your private history.</Text>
          <PrimaryButton label="Create profile" onPress={() => void createProfile()} />
        </View>
      ) : !profile && !loadingHistory ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Finish your profile</Text>
          <Text style={styles.body}>Choose a handle before opening payment checkout.</Text>
          <PrimaryButton
            label="Create MyNews profile"
            onPress={() => router.push('/(root)/register' as never)}
          />
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>1. Journalist</Text>
        <TextInput
          accessibilityLabel="Journalist handle"
          value={handleDraft}
          onChangeText={(value) => {
            setHandleDraft(value);
            setTarget(null);
            setTargetError(null);
            setConfirmation(null);
          }}
          placeholder="@journalist"
          placeholderTextColor={tokens.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        <SecondaryButton
          label={targetBusy ? 'Checking...' : 'Find journalist'}
          onPress={() => void resolveTarget()}
          disabled={targetBusy || !handleDraft.trim()}
        />
        {target ? (
          <Text style={styles.success}>
            Supporting {target.displayName} (@{target.handle})
          </Text>
        ) : null}
        {targetError ? <ErrorText style={styles.error}>{targetError}</ErrorText> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>2. Amount</Text>
        <View style={styles.amountGrid}>
          {AMOUNTS.map((amount) => (
            <Pressable
              key={amount}
              style={[styles.amount, amountCents === amount && styles.amountSelected]}
              onPress={() => {
                setAmountCents(amount);
                setConfirmation(null);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: amountCents === amount }}
            >
              <Text style={[styles.amountText, amountCents === amount && styles.amountTextSelected]}>
                {money(amount)}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.mathRow}>
          <Text style={styles.mathLabel}>Your support</Text>
          <Text style={styles.mathValue}>{money(split.grossCents)}</Text>
        </View>
        <View style={styles.mathRow}>
          <Text style={styles.mathLabel}>MyNews platform fee, 2%</Text>
          <Text style={styles.mathValue}>{money(split.platformFeeCents)}</Text>
        </View>
        <View style={styles.mathRow}>
          <Text style={styles.mathLabel}>Allocated to journalist</Text>
          <Text style={styles.mathValue}>{money(split.journalistNetCents)}</Text>
        </View>
        <Text style={styles.caption}>The payment provider may disclose its processing fees separately.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>3. Confirm</Text>
        {!confirmation ? (
          <PrimaryButton
            label="Review support"
            onPress={confirmSupport}
            disabled={!target || !profile}
          />
        ) : (
          <>
            <Text style={styles.body}>
              You are about to support {target?.displayName} with {money(split.grossCents)}. MyNews
              keeps {money(split.platformFeeCents)} and allocates {money(split.journalistNetCents)}
              to the journalist.
            </Text>
            <PrimaryButton
              label="Continue to secure checkout"
              onPress={() => void beginCheckout()}
              loading={checkoutBusy}
            />
            <SecondaryButton label="Change details" onPress={() => setConfirmation(null)} />
          </>
        )}
        {checkoutMessage ? <Text style={styles.success}>{checkoutMessage}</Text> : null}
        {checkoutError ? <ErrorText style={styles.error}>{checkoutError}</ErrorText> : null}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Verified receipts</Text>
          <Pressable onPress={() => void loadHistory()} accessibilityRole="button">
            <Text style={styles.link}>{loadingHistory ? 'Loading...' : 'Refresh'}</Text>
          </Pressable>
        </View>
        {historyError ? <ErrorText style={styles.error}>{historyError}</ErrorText> : null}
        {history && history.receipts.length > 0 ? (
          <>
            <Text style={styles.body}>Total supported: {money(history.totalSupportedCents)}</Text>
            {history.receipts.map((receipt) => (
              <View key={receipt.id} style={styles.receipt}>
                <Text style={styles.receiptAmount}>{money(receipt.grossCents, receipt.currency)}</Text>
                <Text style={styles.caption}>
                  Fee {money(receipt.platformFeeCents, receipt.currency)} · Journalist{' '}
                  {money(receipt.journalistNetCents, receipt.currency)}
                </Text>
                {receipt.refundedCents > 0 ? (
                  <Text style={styles.caption}>
                    Refunded {money(receipt.refundedCents, receipt.currency)}
                  </Text>
                ) : null}
                <Text style={styles.caption}>
                  {receipt.state.replace(/_/g, ' ')} · {new Date(receipt.createdAt).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </>
        ) : (
          <Text style={styles.caption}>
            {loadingHistory ? 'Loading verified receipts...' : 'No verified support receipts yet.'}
          </Text>
        )}
      </View>

      <SecondaryButton
        label="Journalist earnings and payouts"
        onPress={() => router.push('/(root)/earnings' as never)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.bg },
  content: { paddingHorizontal: 18, paddingBottom: 48, gap: 14 },
  unavailable: {
    flex: 1,
    backgroundColor: tokens.bg,
    justifyContent: 'center',
    padding: 28,
    gap: 10,
  },
  title: { color: tokens.text, fontSize: 28, fontWeight: '800' },
  unavailableTitle: { color: tokens.danger, fontSize: 18, fontWeight: '700' },
  body: { color: tokens.textSecondary, fontSize: 14, lineHeight: 21 },
  card: {
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: tokens.text, fontSize: 17, fontWeight: '700' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    color: tokens.text,
    backgroundColor: tokens.surface,
    fontSize: 15,
  },
  amountGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amount: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  amountSelected: { backgroundColor: tokens.accent, borderColor: tokens.accent },
  amountText: { color: tokens.text, fontSize: 14, fontWeight: '700' },
  amountTextSelected: { color: tokens.bg },
  mathRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  mathLabel: { color: tokens.textSecondary, fontSize: 14, flex: 1 },
  mathValue: { color: tokens.text, fontSize: 14, fontWeight: '700' },
  caption: { color: tokens.textTertiary, fontSize: 12, lineHeight: 18 },
  error: { color: tokens.danger, fontSize: 13, lineHeight: 19 },
  success: { color: tokens.success, fontSize: 13, lineHeight: 19 },
  link: { color: tokens.accent, fontSize: 14, fontWeight: '700' },
  receipt: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.border, paddingTop: 10 },
  receiptAmount: { color: tokens.text, fontSize: 16, fontWeight: '700' },
});
