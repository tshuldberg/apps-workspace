import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { icons } from 'lucide-react-native';
import {
  DisclosureCallout,
  PaymentGlassCard,
  StatusBadge,
  assessPaymentsTransferRisk,
  buildPaymentsProfile,
  buildPaymentsSendFlowViewModel,
  createPaymentsDomainEngine,
  isPaymentsDomainError,
  type PaymentsExecutionContext,
  type PaymentsSendFlowSnapshot,
  type PaymentsSendRecipientCandidate,
  type PaymentsSendSubmissionState,
  type PaymentsTransferSpeed,
  type PaymentsWalletSnapshot,
} from '@mylife/payments';
import { colors } from '@mylife/ui';

const BackIcon = icons.ChevronLeft;
const SearchIcon = icons.Search;
const UserIcon = icons.UserRound;
const ShieldIcon = icons.ShieldCheck;
const SendIcon = icons.Send;
const RefreshIcon = icons.RefreshCw;
const AlertIcon = icons.TriangleAlert;
const CheckIcon = icons.CircleCheck;
const SpeedIcon = icons.Zap;

const SERVER_NOW = '2026-04-24T16:00:00.000Z';

const RECIPIENTS: PaymentsSendRecipientCandidate[] = [
  {
    id: 'avery',
    walletId: 'wallet_avery',
    ownerUserId: 'user_avery',
    displayName: 'Avery Stone',
    handle: '@avery',
    phone: '+15555550199',
    source: 'previous_counterparty',
    verificationState: 'verified',
    descriptor: 'Dinner split',
    lastInteractionAt: '2026-04-24T12:00:00.000Z',
  },
  {
    id: 'morgan',
    walletId: 'wallet_morgan',
    ownerUserId: 'user_morgan',
    displayName: 'Morgan Lee',
    email: 'morgan@example.com',
    source: 'email',
    verificationState: 'verified',
    descriptor: 'Email lookup',
  },
  {
    id: 'riley',
    walletId: 'wallet_riley',
    ownerUserId: 'user_riley',
    displayName: 'Riley Chen',
    handle: '@riley',
    phone: '+15555550222',
    source: 'contact',
    verificationState: 'review',
    descriptor: 'Phone contact',
  },
];

const SCENARIOS = [
  { id: 'ready', label: 'Ready' },
  { id: 'manual_review', label: 'Review' },
  { id: 'insufficient', label: 'Low balance' },
  { id: 'tier', label: 'Tier' },
  { id: 'hold', label: 'Hold' },
  { id: 'stale', label: 'Stale quote' },
  { id: 'timeout', label: 'Timeout' },
] as const;

type ScenarioId = (typeof SCENARIOS)[number]['id'];

function createDeterministicIdFactory(): (prefix: string) => string {
  let index = 0;
  return (prefix: string) => `${prefix}_${String(index += 1).padStart(4, '0')}`;
}

function sourceLabel(source: PaymentsSendRecipientCandidate['source']): string {
  switch (source) {
    case 'previous_counterparty':
      return 'Previous';
    case 'contact':
      return 'Contact';
    case 'handle':
      return 'Handle';
    case 'phone':
      return 'Phone';
    case 'email':
      return 'Email';
  }
}

function scenarioProfile(scenario: ScenarioId) {
  return buildPaymentsProfile({
    ownerUserId: 'user_sender',
    primaryWalletId: 'wallet_sender',
    handle: '@trey',
    displayName: 'Trey',
    identityStatus: scenario === 'tier' ? 'unsubmitted' : 'verified',
    verificationState: scenario === 'tier' ? 'unverified' : 'verified',
    approvedTier: scenario === 'tier' ? 'unverified' : 'basic',
    fields: {
      legalName: 'Trey Example',
      email: 'trey@example.com',
      phoneE164: '+15555550123',
      dateOfBirth: '1990-01-01',
      addressLine1: '1 Main St',
      city: 'Austin',
      regionCode: 'TX',
      postalCode: '78701',
      governmentIdLast4: '1234',
    },
  });
}

function makeWallet(
  walletId: string,
  ownerUserId: string,
  overrides: Partial<PaymentsWalletSnapshot> = {},
): PaymentsWalletSnapshot {
  return {
    walletId,
    ownerUserId,
    status: 'active',
    defaultCurrency: 'USD',
    balances: {
      available: 12_840,
      pending: 0,
      reserved: 0,
      escrow: 0,
      ...(overrides.balances ?? {}),
    },
    complianceHold: 'none',
    sendLimitRemainingCents: 50_000,
    receiveLimitRemainingCents: 75_000,
    ...overrides,
  };
}

function scenarioWallet(scenario: ScenarioId): PaymentsWalletSnapshot {
  if (scenario === 'insufficient') {
    return makeWallet('wallet_sender', 'user_sender', {
      balances: {
        available: 650,
        pending: 0,
        reserved: 0,
        escrow: 0,
      },
    });
  }

  if (scenario === 'hold') {
    return makeWallet('wallet_sender', 'user_sender', {
      status: 'restricted',
      complianceHold: 'freeze',
    });
  }

  return makeWallet('wallet_sender', 'user_sender');
}

function scenarioQuote(scenario: ScenarioId): PaymentsSendFlowSnapshot['quote'] {
  if (scenario === 'stale') {
    return {
      quotedAt: '2026-04-24T15:30:00.000Z',
      expiresAt: '2026-04-24T15:45:00.000Z',
      providerDeadlineAt: '2026-04-24T16:04:00.000Z',
    };
  }

  if (scenario === 'timeout') {
    return {
      quotedAt: '2026-04-24T15:59:00.000Z',
      expiresAt: '2026-04-24T16:05:00.000Z',
      providerDeadlineAt: '2026-04-24T15:59:30.000Z',
    };
  }

  return {
    quotedAt: '2026-04-24T15:59:00.000Z',
    expiresAt: '2026-04-24T16:05:00.000Z',
    providerDeadlineAt: '2026-04-24T16:04:00.000Z',
  };
}

function createExecutionContext(wallet: PaymentsWalletSnapshot): PaymentsExecutionContext {
  const recipientWallets = Object.fromEntries(
    RECIPIENTS.map((recipient) => [
      recipient.walletId,
      makeWallet(recipient.walletId, recipient.ownerUserId ?? recipient.id),
    ]),
  );

  return {
    wallets: {
      ...recipientWallets,
      [wallet.walletId]: wallet,
    },
  };
}

function resultIcon(state: ReturnType<typeof buildPaymentsSendFlowViewModel>['state']) {
  if (state === 'succeeded' || state === 'replayed') {
    return CheckIcon;
  }
  if (state === 'pending_review' || state === 'failed') {
    return AlertIcon;
  }
  return SendIcon;
}

export default function PaymentsSendScreen() {
  const router = useRouter();
  const [scenario, setScenario] = useState<ScenarioId>('ready');
  const [recipientQuery, setRecipientQuery] = useState('');
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>('avery');
  const [amountText, setAmountText] = useState('24.50');
  const [note, setNote] = useState('Dinner split');
  const [speed, setSpeed] = useState<PaymentsTransferSpeed>('standard');
  const [authSatisfied, setAuthSatisfied] = useState(false);
  const [submission, setSubmission] = useState<PaymentsSendSubmissionState>({
    status: 'idle',
  });

  const senderProfile = useMemo(() => scenarioProfile(scenario), [scenario]);
  const wallet = useMemo(() => scenarioWallet(scenario), [scenario]);
  const engine = useMemo(
    () =>
      createPaymentsDomainEngine({
        now: () => new Date(SERVER_NOW),
        createId: createDeterministicIdFactory(),
        riskGuard:
          scenario === 'manual_review'
            ? (input) =>
                assessPaymentsTransferRisk({
                  ...input,
                  sourceProfile: {
                    ownerUserId: senderProfile.ownerUserId,
                    walletId: senderProfile.primaryWalletId,
                    identityId: 'identity_sender',
                    countryCode: senderProfile.countryCode,
                    walletType: senderProfile.walletType,
                    tierAssessment: senderProfile.tierAssessment,
                  },
                  sanctionsParties: [
                    {
                      partyId: 'party_recipient',
                      role: 'recipient',
                      walletId:
                        input.command.type === 'send'
                          ? input.command.destinationWalletId
                          : null,
                      displayName: 'Potential Match',
                      screeningState: 'potential_match',
                      screeningReference: 'screen_demo_001',
                    },
                  ],
                })
            : undefined,
      }),
    [scenario, senderProfile],
  );
  const snapshot = useMemo<PaymentsSendFlowSnapshot>(
    () => ({
      senderProfile,
      wallet,
      recipients: RECIPIENTS,
      serverNow: SERVER_NOW,
      systemMode: 'operational',
      quote: scenarioQuote(scenario),
      manualReview:
        scenario === 'manual_review'
          ? {
              required: true,
              reason: 'Recipient screening can place this payment into manual review before funds move.',
            }
          : null,
      authPolicy: 'biometric',
      submission,
      draft: {
        recipientQuery,
        selectedRecipientId,
        amountText,
        note,
        speed,
        clientSubmissionId: 'mobile-send-demo-2026-04-24',
        authSatisfied,
      },
      partnerBankName: 'Thread Bank',
      custodialEntityName: 'MyPay Custody Partner',
      supportContact: 'support@mylife.app',
    }),
    [
      amountText,
      authSatisfied,
      note,
      recipientQuery,
      scenario,
      selectedRecipientId,
      senderProfile,
      speed,
      submission,
      wallet,
    ],
  );
  const viewModel = useMemo(
    () => buildPaymentsSendFlowViewModel(snapshot),
    [snapshot],
  );

  useEffect(() => {
    setSubmission({ status: 'idle' });
  }, [amountText, note, recipientQuery, scenario, selectedRecipientId, speed]);

  const handleSubmit = (forceReplay = false) => {
    if (!viewModel.commandPreview || (!viewModel.canSubmit && !forceReplay)) {
      return;
    }

    setSubmission({ status: 'submitting' });
    try {
      const result = engine.execute(
        viewModel.commandPreview.command,
        createExecutionContext(wallet),
      );
      setSubmission({ status: 'result', result });
    } catch (error) {
      if (isPaymentsDomainError(error)) {
        setSubmission({ status: 'error', error });
        return;
      }
      setSubmission({
        status: 'error',
        error: {
          code: 'invalid_command',
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  };

  const ResultIcon = resultIcon(viewModel.state);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to wallet"
          style={styles.iconButton}
          onPress={() => router.back()}
        >
          <BackIcon size={20} color="#F5FBF8" strokeWidth={2} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>{viewModel.title}</Text>
          <Text style={styles.subtitle}>Wallet transfer from available balance</Text>
        </View>
      </View>

      <View style={styles.scenarioRow}>
        {SCENARIOS.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityState={{ selected: scenario === item.id }}
            style={[styles.chip, scenario === item.id && styles.chipActive]}
            onPress={() => {
              setScenario(item.id);
              setAuthSatisfied(false);
            }}
          >
            <Text style={[styles.chipText, scenario === item.id && styles.chipTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <PaymentGlassCard eyebrow="Recipient" title="Choose who gets paid">
        <View style={styles.inputShell}>
          <SearchIcon size={17} color="rgba(245,251,248,0.58)" strokeWidth={2} />
          <TextInput
            value={recipientQuery}
            onChangeText={setRecipientQuery}
            placeholder="Handle, phone, email, contact"
            placeholderTextColor="rgba(245,251,248,0.40)"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.textInput}
          />
        </View>
        <View style={styles.recipientList}>
          {viewModel.recipientSearch.results.length > 0 ? (
            viewModel.recipientSearch.results.map((recipient) => (
              <Pressable
                key={recipient.id}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedRecipientId === recipient.id }}
                style={[
                  styles.recipientRow,
                  selectedRecipientId === recipient.id && styles.recipientRowActive,
                ]}
                onPress={() => setSelectedRecipientId(recipient.id)}
              >
                <View style={styles.recipientAvatar}>
                  <UserIcon size={17} color="#A7F3D0" strokeWidth={2} />
                </View>
                <View style={styles.recipientText}>
                  <Text style={styles.recipientName}>{recipient.displayName}</Text>
                  <Text style={styles.recipientMeta}>
                    {recipient.handle ?? recipient.email ?? recipient.phone ?? recipient.descriptor}
                  </Text>
                </View>
                <StatusBadge tone="info" label={sourceLabel(recipient.source)} />
              </Pressable>
            ))
          ) : (
            <Text style={styles.emptyText}>{viewModel.recipientSearch.emptyState}</Text>
          )}
        </View>
      </PaymentGlassCard>

      <PaymentGlassCard eyebrow="Amount" title="Payment details">
        <View style={styles.amountGrid}>
          <View style={[styles.inputShell, styles.amountInput]}>
            <Text style={styles.currencyPrefix}>$</Text>
            <TextInput
              value={amountText}
              onChangeText={setAmountText}
              placeholder="0.00"
              placeholderTextColor="rgba(245,251,248,0.40)"
              keyboardType="decimal-pad"
              style={[styles.textInput, styles.amountTextInput]}
            />
          </View>
          <View style={styles.speedRow}>
            {viewModel.speed.options.map((option) => (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityState={{ selected: speed === option.id }}
                style={[styles.speedButton, speed === option.id && styles.speedButtonActive]}
                onPress={() => setSpeed(option.id)}
              >
                <SpeedIcon
                  size={15}
                  color={speed === option.id ? '#061511' : '#BAE6FD'}
                  strokeWidth={2}
                />
                <Text
                  style={[
                    styles.speedButtonText,
                    speed === option.id && styles.speedButtonTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Add a note"
          placeholderTextColor="rgba(245,251,248,0.40)"
          multiline
          style={styles.noteInput}
        />
      </PaymentGlassCard>

      <PaymentGlassCard eyebrow="Preview" title="Fee, speed, and balance impact">
        <View style={styles.previewGrid}>
          {viewModel.preview.lines.map((line) => (
            <View key={line.id} style={styles.previewLine}>
              <Text style={styles.previewLabel}>{line.label}</Text>
              <Text
                style={[
                  styles.previewValue,
                  line.emphasis === 'danger' && styles.previewDanger,
                  line.emphasis === 'positive' && styles.previewPositive,
                  line.emphasis === 'warning' && styles.previewWarning,
                ]}
              >
                {line.value}
              </Text>
            </View>
          ))}
        </View>
        <DisclosureCallout disclosure={viewModel.preview.disclosure} />
        {viewModel.policyNotice ? (
          <DisclosureCallout disclosure={viewModel.policyNotice.disclosure} />
        ) : null}
      </PaymentGlassCard>

      <PaymentGlassCard eyebrow="Confirm" title={viewModel.confirmation.label}>
        <View style={styles.confirmHeader}>
          <View style={styles.confirmIcon}>
            <ShieldIcon size={18} color="#A7F3D0" strokeWidth={2} />
          </View>
          <View style={styles.confirmText}>
            <Text style={styles.confirmTitle}>
              {viewModel.confirmation.satisfied ? 'Step-up complete' : 'Step-up required'}
            </Text>
            <Text style={styles.confirmBody}>
              {viewModel.confirmation.reason ?? 'Ready to submit with the current command fingerprint.'}
            </Text>
          </View>
        </View>
        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: authSatisfied }}
            style={[styles.secondaryButton, authSatisfied && styles.secondaryButtonActive]}
            onPress={() => setAuthSatisfied((current) => !current)}
          >
            <ShieldIcon
              size={17}
              color={authSatisfied ? '#061511' : '#BAE6FD'}
              strokeWidth={2}
            />
            <Text
              style={[
                styles.secondaryButtonText,
                authSatisfied && styles.secondaryButtonTextActive,
              ]}
            >
              {authSatisfied ? 'Confirmed' : 'Run check'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !viewModel.canSubmit }}
            disabled={!viewModel.canSubmit}
            style={[
              styles.primaryButton,
              !viewModel.canSubmit && styles.primaryButtonDisabled,
            ]}
            onPress={() => handleSubmit()}
          >
            <SendIcon
              size={17}
              color={viewModel.canSubmit ? '#061511' : 'rgba(245,251,248,0.38)'}
              strokeWidth={2}
            />
            <Text
              style={[
                styles.primaryButtonText,
                !viewModel.canSubmit && styles.primaryButtonTextDisabled,
              ]}
            >
              {viewModel.submitLabel}
            </Text>
          </Pressable>
        </View>
      </PaymentGlassCard>

      {viewModel.result ? (
        <PaymentGlassCard eyebrow="Result" title={viewModel.result.title}>
          <View style={styles.resultRow}>
            <View style={styles.resultIcon}>
              <ResultIcon size={20} color="#061511" strokeWidth={2.4} />
            </View>
            <View style={styles.resultText}>
              <Text style={styles.resultBody}>{viewModel.result.body}</Text>
              {viewModel.result.transferId ? (
                <Text style={styles.resultMeta}>
                  {viewModel.result.transferStatus} · {viewModel.result.eventType} ·{' '}
                  {viewModel.result.transferId}
                </Text>
              ) : null}
            </View>
          </View>
          <DisclosureCallout disclosure={viewModel.result.disclosure} />
          {viewModel.result.state !== 'failed' ? (
            <Pressable
              accessibilityRole="button"
              style={styles.replayButton}
              onPress={() => handleSubmit(true)}
            >
              <RefreshIcon size={16} color="#BAE6FD" strokeWidth={2} />
              <Text style={styles.replayButtonText}>Replay after reconnect</Text>
            </Pressable>
          ) : null}
        </PaymentGlassCard>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    gap: 18,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(245,251,248,0.08)',
    borderColor: 'rgba(245,251,248,0.14)',
    borderRadius: 18,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: '#F5FBF8',
    fontSize: 32,
    fontWeight: '800',
  },
  subtitle: {
    color: 'rgba(245,251,248,0.66)',
    fontSize: 14,
    fontWeight: '600',
  },
  scenarioRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderColor: 'rgba(245,251,248,0.12)',
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 38,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  chipActive: {
    backgroundColor: '#A7F3D0',
    borderColor: '#A7F3D0',
  },
  chipText: {
    color: 'rgba(245,251,248,0.72)',
    fontSize: 12,
    fontWeight: '800',
  },
  chipTextActive: {
    color: '#061511',
  },
  inputShell: {
    alignItems: 'center',
    backgroundColor: 'rgba(245,251,248,0.06)',
    borderColor: 'rgba(245,251,248,0.12)',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  textInput: {
    color: '#F5FBF8',
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    minHeight: 48,
  },
  recipientList: {
    gap: 10,
  },
  recipientRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(245,251,248,0.05)',
    borderColor: 'rgba(245,251,248,0.10)',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 68,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  recipientRowActive: {
    backgroundColor: 'rgba(0,195,137,0.16)',
    borderColor: 'rgba(0,195,137,0.34)',
  },
  recipientAvatar: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,195,137,0.16)',
    borderRadius: 16,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  recipientText: {
    flex: 1,
    gap: 3,
  },
  recipientName: {
    color: '#F5FBF8',
    fontSize: 15,
    fontWeight: '800',
  },
  recipientMeta: {
    color: 'rgba(245,251,248,0.58)',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    color: 'rgba(245,251,248,0.64)',
    fontSize: 14,
    lineHeight: 20,
  },
  amountGrid: {
    gap: 12,
  },
  amountInput: {
    minHeight: 62,
  },
  currencyPrefix: {
    color: '#A7F3D0',
    fontSize: 22,
    fontWeight: '900',
  },
  amountTextInput: {
    fontSize: 28,
    fontWeight: '900',
  },
  speedRow: {
    flexDirection: 'row',
    gap: 10,
  },
  speedButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(56,189,248,0.12)',
    borderColor: 'rgba(56,189,248,0.22)',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 44,
  },
  speedButtonActive: {
    backgroundColor: '#BAE6FD',
    borderColor: '#BAE6FD',
  },
  speedButtonText: {
    color: '#BAE6FD',
    fontSize: 13,
    fontWeight: '800',
  },
  speedButtonTextActive: {
    color: '#061511',
  },
  noteInput: {
    backgroundColor: 'rgba(245,251,248,0.06)',
    borderColor: 'rgba(245,251,248,0.12)',
    borderRadius: 18,
    borderWidth: 1,
    color: '#F5FBF8',
    fontSize: 14,
    fontWeight: '700',
    minHeight: 82,
    paddingHorizontal: 14,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  previewGrid: {
    gap: 10,
  },
  previewLine: {
    alignItems: 'center',
    backgroundColor: 'rgba(245,251,248,0.05)',
    borderColor: 'rgba(245,251,248,0.10)',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 14,
  },
  previewLabel: {
    color: 'rgba(245,251,248,0.62)',
    fontSize: 13,
    fontWeight: '700',
  },
  previewValue: {
    color: '#F5FBF8',
    fontSize: 15,
    fontWeight: '900',
  },
  previewPositive: {
    color: '#A7F3D0',
  },
  previewWarning: {
    color: '#FED7AA',
  },
  previewDanger: {
    color: '#FECACA',
  },
  confirmHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  confirmIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,195,137,0.16)',
    borderRadius: 16,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  confirmText: {
    flex: 1,
    gap: 4,
  },
  confirmTitle: {
    color: '#F5FBF8',
    fontSize: 15,
    fontWeight: '900',
  },
  confirmBody: {
    color: 'rgba(245,251,248,0.66)',
    fontSize: 13,
    lineHeight: 19,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: 'rgba(56,189,248,0.28)',
    borderRadius: 17,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
  },
  secondaryButtonActive: {
    backgroundColor: '#BAE6FD',
    borderColor: '#BAE6FD',
  },
  secondaryButtonText: {
    color: '#BAE6FD',
    fontSize: 14,
    fontWeight: '900',
  },
  secondaryButtonTextActive: {
    color: '#061511',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#A7F3D0',
    borderRadius: 17,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryButtonDisabled: {
    backgroundColor: 'rgba(148,163,184,0.12)',
    borderColor: 'rgba(148,163,184,0.22)',
    borderWidth: 1,
  },
  primaryButtonText: {
    color: '#061511',
    fontSize: 14,
    fontWeight: '900',
  },
  primaryButtonTextDisabled: {
    color: 'rgba(245,251,248,0.38)',
  },
  resultRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  resultIcon: {
    alignItems: 'center',
    backgroundColor: '#A7F3D0',
    borderRadius: 18,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  resultText: {
    flex: 1,
    gap: 6,
  },
  resultBody: {
    color: 'rgba(245,251,248,0.76)',
    fontSize: 14,
    lineHeight: 20,
  },
  resultMeta: {
    color: 'rgba(245,251,248,0.52)',
    fontSize: 12,
    fontWeight: '700',
  },
  replayButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderColor: 'rgba(56,189,248,0.28)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 14,
  },
  replayButtonText: {
    color: '#BAE6FD',
    fontSize: 13,
    fontWeight: '900',
  },
});
