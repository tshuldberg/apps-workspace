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
  TimelineStepper,
  buildPaymentsProfile,
  buildPaymentsRequestFlowViewModel,
  createPaymentsDomainEngine,
  isPaymentsDomainError,
  type PaymentsExecutionContext,
  type PaymentsRequestActionId,
  type PaymentsRequestAntiAbuseConstraints,
  type PaymentsRequestFlowSnapshot,
  type PaymentsRequestMode,
  type PaymentsRequestRecord,
  type PaymentsRequestSubmissionState,
  type PaymentsRequestTargetCandidate,
  type PaymentsRequestStatus,
  type PaymentsWalletSnapshot,
} from '@mylife/payments';
import { colors } from '@mylife/ui';

const BackIcon = icons.ChevronLeft;
const SearchIcon = icons.Search;
const UserIcon = icons.UserRound;
const LinkIcon = icons.Link;
const BellIcon = icons.Bell;
const XIcon = icons.X;
const CheckIcon = icons.CircleCheck;
const SendIcon = icons.Send;
const ClockIcon = icons.Clock;
const RequestIcon = icons.HandCoins;

const SERVER_NOW = '2026-04-24T16:00:00.000Z';
const LINK_URL = 'https://pay.mylife.app/r/coffee-2026';

const TARGETS: PaymentsRequestTargetCandidate[] = [
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
    source: 'known_user',
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

const ANTI_ABUSE: PaymentsRequestAntiAbuseConstraints = {
  maxUses: 1,
  maxAmountCents: 50_000,
  expiresWithinHours: 72,
  reminderCooldownHours: 24,
  maxReminders: 2,
  rateLimitKey: 'requester:user_sender',
};

const SCENARIOS = [
  { id: 'direct', label: 'Direct' },
  { id: 'link', label: 'Link' },
  { id: 'paid', label: 'Paid' },
  { id: 'declined', label: 'Declined' },
  { id: 'expired', label: 'Expired' },
  { id: 'canceled', label: 'Canceled' },
  { id: 'blocked_link', label: 'Blocked link' },
] as const;

type ScenarioId = (typeof SCENARIOS)[number]['id'];

function createDeterministicIdFactory(): (prefix: string) => string {
  let index = 0;
  return (prefix: string) => `${prefix}_${String(index += 1).padStart(4, '0')}`;
}

function sourceLabel(source: PaymentsRequestTargetCandidate['source']): string {
  switch (source) {
    case 'previous_counterparty':
      return 'Previous';
    case 'contact':
      return 'Contact';
    case 'known_user':
      return 'MyLife';
    case 'payment_link':
      return 'Link';
  }
}

function actionIcon(actionId: PaymentsRequestActionId) {
  switch (actionId) {
    case 'remind':
      return BellIcon;
    case 'cancel':
    case 'decline':
      return XIcon;
    case 'accept':
      return CheckIcon;
  }
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
      available: 25_000,
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

function requesterProfile() {
  return buildPaymentsProfile({
    ownerUserId: 'user_sender',
    primaryWalletId: 'wallet_sender',
    handle: '@trey',
    displayName: 'Trey',
    identityStatus: 'verified',
    verificationState: 'verified',
    approvedTier: 'basic',
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

function makeRequest(input: {
  id: string;
  status: PaymentsRequestStatus;
  payerWalletId?: string | null;
  payerDisplayName?: string | null;
  paymentLink?: boolean;
  createdAt?: string;
  terminalAt?: string | null;
  acceptedTransferId?: string | null;
}): PaymentsRequestRecord {
  return {
    requestId: input.id,
    idempotencyKey: `request_${input.id}`,
    requesterWalletId: 'wallet_sender',
    payerWalletId: input.paymentLink ? null : input.payerWalletId ?? 'wallet_avery',
    status: input.status,
    amountCents: 2_450,
    currency: 'USD',
    expiresAt:
      input.status === 'expired'
        ? '2026-04-24T15:30:00.000Z'
        : '2026-04-25T16:00:00.000Z',
    memo: 'Dinner split',
    metadata: {
      paymentLink: input.paymentLink ?? false,
      source: 'phase_3c_mobile_demo',
    },
    createdAt: input.createdAt ?? '2026-04-24T14:00:00.000Z',
    paidAt: input.status === 'paid' ? input.terminalAt ?? '2026-04-24T15:15:00.000Z' : null,
    declinedAt:
      input.status === 'declined' ? input.terminalAt ?? '2026-04-24T15:15:00.000Z' : null,
    expiredAt:
      input.status === 'expired' ? input.terminalAt ?? '2026-04-24T15:30:00.000Z' : null,
    canceledAt:
      input.status === 'canceled' ? input.terminalAt ?? '2026-04-24T15:15:00.000Z' : null,
    lastReminderAt: null,
    reminderCount: 0,
    requesterDisplayName: 'Trey',
    payerDisplayName:
      input.paymentLink ? 'Off-network payer' : input.payerDisplayName ?? 'Avery Stone',
    paymentLinkId: input.paymentLink ? 'link_demo_001' : null,
    paymentLinkUrl: input.paymentLink ? LINK_URL : null,
    acceptedTransferId:
      input.status === 'paid'
        ? input.acceptedTransferId ?? 'pay_transfer_0001'
        : null,
  };
}

function scenarioRequest(scenario: ScenarioId): PaymentsRequestRecord | null {
  switch (scenario) {
    case 'paid':
      return makeRequest({ id: 'request_paid', status: 'paid' });
    case 'declined':
      return makeRequest({ id: 'request_declined', status: 'declined' });
    case 'expired':
      return makeRequest({
        id: 'request_expired',
        status: 'expired',
        paymentLink: true,
      });
    case 'canceled':
      return makeRequest({ id: 'request_canceled', status: 'canceled' });
    case 'direct':
    case 'link':
    case 'blocked_link':
      return makeRequest({
        id: scenario === 'link' || scenario === 'blocked_link'
          ? 'request_link'
          : 'request_direct',
        status: 'open',
        paymentLink: scenario === 'link' || scenario === 'blocked_link',
      });
  }
}

function createExecutionContext(wallet: PaymentsWalletSnapshot): PaymentsExecutionContext {
  const payerWallets = Object.fromEntries(
    TARGETS.map((target) => [
      target.walletId ?? target.id,
      makeWallet(target.walletId ?? target.id, target.ownerUserId ?? target.id),
    ]),
  );

  return {
    wallets: {
      ...payerWallets,
      wallet_guest: makeWallet('wallet_guest', 'user_guest', {
        balances: {
          available: 8_000,
        },
      }),
      [wallet.walletId]: wallet,
    },
  };
}

export default function PaymentsRequestScreen() {
  const router = useRouter();
  const [scenario, setScenario] = useState<ScenarioId>('direct');
  const [mode, setMode] = useState<PaymentsRequestMode>('known_user');
  const [targetQuery, setTargetQuery] = useState('');
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>('avery');
  const [amountText, setAmountText] = useState('24.50');
  const [note, setNote] = useState('Dinner split');
  const [expiresAt, setExpiresAt] = useState('2026-04-25T16:00:00.000Z');
  const [submission, setSubmission] = useState<PaymentsRequestSubmissionState>({
    status: 'idle',
  });
  const [localRequest, setLocalRequest] = useState<PaymentsRequestRecord | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>('request_direct');

  const profile = useMemo(() => requesterProfile(), []);
  const wallet = useMemo(() => makeWallet('wallet_sender', 'user_sender'), []);
  const engine = useMemo(
    () =>
      createPaymentsDomainEngine({
        now: () => new Date(SERVER_NOW),
        createId: createDeterministicIdFactory(),
      }),
    [],
  );
  const baseRequest = useMemo(() => scenarioRequest(scenario), [scenario]);
  const existingRequests = useMemo(
    () => [
      ...(localRequest ? [localRequest] : []),
      ...(baseRequest ? [baseRequest] : []),
    ],
    [baseRequest, localRequest],
  );
  const activeRequestId = localRequest?.requestId ?? selectedRequestId;
  const snapshot = useMemo<PaymentsRequestFlowSnapshot>(
    () => ({
      requesterProfile: profile,
      wallet,
      targets: TARGETS,
      serverNow: SERVER_NOW,
      systemMode: 'operational',
      antiAbuse:
        scenario === 'blocked_link'
          ? {
              ...ANTI_ABUSE,
              maxUses: 3,
              rateLimitKey: '',
            }
          : ANTI_ABUSE,
      existingRequests,
      selectedRequestId: activeRequestId,
      acceptancePayerWalletId:
        mode === 'payment_link' ? 'wallet_guest' : 'wallet_avery',
      submission,
      draft: {
        mode,
        targetQuery,
        selectedTargetId: mode === 'known_user' ? selectedTargetId : null,
        amountText,
        note,
        expiresAt,
        clientSubmissionId: `mobile-request-${scenario}`,
      },
      partnerBankName: 'Thread Bank',
      custodialEntityName: 'MyPay Custody Partner',
      supportContact: 'support@mylife.app',
    }),
    [
      activeRequestId,
      amountText,
      existingRequests,
      expiresAt,
      mode,
      note,
      profile,
      scenario,
      selectedTargetId,
      submission,
      targetQuery,
      wallet,
    ],
  );
  const viewModel = useMemo(
    () => buildPaymentsRequestFlowViewModel(snapshot),
    [snapshot],
  );

  useEffect(() => {
    setSubmission({ status: 'idle' });
    setLocalRequest(null);
  }, [amountText, expiresAt, mode, note, scenario, selectedTargetId, targetQuery]);

  const applyScenario = (nextScenario: ScenarioId) => {
    const nextMode =
      nextScenario === 'link' ||
      nextScenario === 'blocked_link' ||
      nextScenario === 'expired'
        ? 'payment_link'
        : 'known_user';
    const nextRequest = scenarioRequest(nextScenario);

    setScenario(nextScenario);
    setMode(nextMode);
    setSelectedTargetId(nextMode === 'known_user' ? 'avery' : null);
    setTargetQuery('');
    setAmountText(nextScenario === 'blocked_link' ? '24.50' : '24.50');
    setNote(nextMode === 'payment_link' ? 'Shared payment link' : 'Dinner split');
    setExpiresAt(
      nextScenario === 'blocked_link'
        ? '2026-04-25T16:00:00.000Z'
        : nextScenario === 'expired'
          ? '2026-04-24T15:30:00.000Z'
          : '2026-04-25T16:00:00.000Z',
    );
    setSelectedRequestId(nextRequest?.requestId ?? null);
    setLocalRequest(null);
    setSubmission({ status: 'idle' });
  };

  const handleCreate = () => {
    if (!viewModel.commandPreview || !viewModel.canCreate) {
      return;
    }

    setSubmission({ status: 'submitting' });
    try {
      const result = engine.execute(
        viewModel.commandPreview.command,
        createExecutionContext(wallet),
      );
      if (result.kind === 'request') {
        const target = TARGETS.find((item) => item.id === selectedTargetId);
        const createdRequest: PaymentsRequestRecord = {
          ...result.request,
          createdAt: SERVER_NOW,
          requesterDisplayName: profile.displayName,
          payerDisplayName:
            mode === 'payment_link'
              ? 'Payment link payer'
              : target?.displayName ?? 'MyLife payer',
          paymentLinkId: mode === 'payment_link' ? 'link_created_001' : null,
          paymentLinkUrl: mode === 'payment_link' ? LINK_URL : null,
          reminderCount: 0,
          lastReminderAt: null,
        };
        setLocalRequest(createdRequest);
        setSelectedRequestId(createdRequest.requestId);
      }
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

  const updateActiveRequest = (updates: Partial<PaymentsRequestRecord>) => {
    const current = viewModel.detail
      ? existingRequests.find((request) => request.requestId === viewModel.detail?.requestId)
      : null;

    if (!current) {
      return;
    }

    setLocalRequest({
      ...current,
      ...updates,
      updatedAt: SERVER_NOW,
    });
    setSelectedRequestId(current.requestId);
  };

  const handleAccept = () => {
    const command = viewModel.detail?.acceptanceCommand;
    if (!command) {
      return;
    }

    try {
      const result = engine.execute(command, createExecutionContext(wallet));
      if (result.kind === 'transfer') {
        updateActiveRequest({
          status: 'paid',
          paidAt: SERVER_NOW,
          acceptedTransferId: result.transfer.transferId,
        });
      }
    } catch (error) {
      setSubmission({
        status: 'error',
        error: isPaymentsDomainError(error)
          ? error
          : {
              code: 'invalid_command',
              message: error instanceof Error ? error.message : String(error),
            },
      });
    }
  };

  const handleAction = (actionId: PaymentsRequestActionId) => {
    switch (actionId) {
      case 'accept':
        handleAccept();
        break;
      case 'remind':
        updateActiveRequest({
          lastReminderAt: SERVER_NOW,
          reminderCount:
            (existingRequests.find((request) => request.requestId === viewModel.detail?.requestId)
              ?.reminderCount ?? 0) + 1,
        });
        break;
      case 'cancel':
        updateActiveRequest({
          status: 'canceled',
          canceledAt: SERVER_NOW,
        });
        break;
      case 'decline':
        updateActiveRequest({
          status: 'declined',
          declinedAt: SERVER_NOW,
        });
        break;
    }
  };

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
          <Text style={styles.subtitle}>Request money or create a payment link</Text>
        </View>
      </View>

      <View style={styles.scenarioRow}>
        {SCENARIOS.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityState={{ selected: scenario === item.id }}
            style={[styles.chip, scenario === item.id && styles.chipActive]}
            onPress={() => applyScenario(item.id)}
          >
            <Text style={[styles.chipText, scenario === item.id && styles.chipTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <PaymentGlassCard eyebrow="Mode" title="Choose request path">
        <View style={styles.modeRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: mode === 'known_user' }}
            style={[styles.modeButton, mode === 'known_user' && styles.modeButtonActive]}
            onPress={() => {
              setMode('known_user');
              setSelectedTargetId('avery');
            }}
          >
            <UserIcon
              size={17}
              color={mode === 'known_user' ? '#061511' : '#BAE6FD'}
              strokeWidth={2}
            />
            <Text
              style={[
                styles.modeButtonText,
                mode === 'known_user' && styles.modeButtonTextActive,
              ]}
            >
              MyLife user
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: mode === 'payment_link' }}
            style={[styles.modeButton, mode === 'payment_link' && styles.modeButtonActive]}
            onPress={() => {
              setMode('payment_link');
              setSelectedTargetId(null);
            }}
          >
            <LinkIcon
              size={17}
              color={mode === 'payment_link' ? '#061511' : '#BAE6FD'}
              strokeWidth={2}
            />
            <Text
              style={[
                styles.modeButtonText,
                mode === 'payment_link' && styles.modeButtonTextActive,
              ]}
            >
              Payment link
            </Text>
          </Pressable>
        </View>
      </PaymentGlassCard>

      {mode === 'known_user' ? (
        <PaymentGlassCard eyebrow="Payer" title="Choose who to request from">
          <View style={styles.inputShell}>
            <SearchIcon size={17} color="rgba(245,251,248,0.58)" strokeWidth={2} />
            <TextInput
              value={targetQuery}
              onChangeText={setTargetQuery}
              placeholder="Handle, phone, email, contact"
              placeholderTextColor="rgba(245,251,248,0.40)"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.textInput}
            />
          </View>
          <View style={styles.targetList}>
            {viewModel.targetSearch.results.length > 0 ? (
              viewModel.targetSearch.results.map((target) => (
                <Pressable
                  key={target.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedTargetId === target.id }}
                  style={[
                    styles.targetRow,
                    selectedTargetId === target.id && styles.targetRowActive,
                  ]}
                  onPress={() => setSelectedTargetId(target.id)}
                >
                  <View style={styles.targetAvatar}>
                    <UserIcon size={17} color="#A7F3D0" strokeWidth={2} />
                  </View>
                  <View style={styles.targetText}>
                    <Text style={styles.targetName}>{target.displayName}</Text>
                    <Text style={styles.targetMeta}>
                      {target.handle ?? target.email ?? target.phone ?? target.descriptor}
                    </Text>
                  </View>
                  <StatusBadge tone="info" label={sourceLabel(target.source)} />
                </Pressable>
              ))
            ) : (
              <Text style={styles.emptyText}>{viewModel.targetSearch.emptyState}</Text>
            )}
          </View>
        </PaymentGlassCard>
      ) : (
        <PaymentGlassCard eyebrow="Payment link" title="Shareable request">
          <View style={styles.linkBox}>
            <LinkIcon size={18} color="#BAE6FD" strokeWidth={2} />
            <Text style={styles.linkText}>{LINK_URL}</Text>
          </View>
          <Text style={styles.helperText}>
            Link acceptance still creates a normal send transfer from the payer wallet to your wallet.
          </Text>
        </PaymentGlassCard>
      )}

      <PaymentGlassCard eyebrow="Details" title="Amount, note, and expiry">
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
          <View style={[styles.inputShell, styles.expiryInput]}>
            <ClockIcon size={17} color="rgba(245,251,248,0.58)" strokeWidth={2} />
            <TextInput
              value={expiresAt}
              onChangeText={setExpiresAt}
              placeholder="Expiry ISO timestamp"
              placeholderTextColor="rgba(245,251,248,0.40)"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.textInput}
            />
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

      <PaymentGlassCard eyebrow="Preview" title="Request rules and timeline start">
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
        <DisclosureCallout disclosure={viewModel.preview.guardrailDisclosure} />
        {viewModel.policyNotice ? (
          <DisclosureCallout disclosure={viewModel.policyNotice.disclosure} />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !viewModel.canCreate }}
          disabled={!viewModel.canCreate}
          style={[
            styles.primaryButton,
            !viewModel.canCreate && styles.primaryButtonDisabled,
          ]}
          onPress={handleCreate}
        >
          <RequestIcon
            size={17}
            color={viewModel.canCreate ? '#061511' : 'rgba(245,251,248,0.38)'}
            strokeWidth={2}
          />
          <Text
            style={[
              styles.primaryButtonText,
              !viewModel.canCreate && styles.primaryButtonTextDisabled,
            ]}
          >
            {viewModel.submitLabel}
          </Text>
        </Pressable>
      </PaymentGlassCard>

      {viewModel.result ? (
        <PaymentGlassCard eyebrow="Result" title={viewModel.result.title}>
          <Text style={styles.resultBody}>{viewModel.result.body}</Text>
          <DisclosureCallout disclosure={viewModel.result.disclosure} />
        </PaymentGlassCard>
      ) : null}

      {viewModel.detail ? (
        <PaymentGlassCard eyebrow="Request detail" title={viewModel.detail.title}>
          <View style={styles.detailHeader}>
            <View>
              <Text style={styles.detailAmount}>{viewModel.detail.amountLabel}</Text>
              <Text style={styles.detailSubtitle}>{viewModel.detail.subtitle}</Text>
            </View>
            <StatusBadge tone={viewModel.detail.lifecycleState === 'paid' ? 'success' : 'info'} label={viewModel.detail.statusLabel} />
          </View>
          {viewModel.detail.expiresAtLabel ? (
            <Text style={styles.helperText}>Expires {viewModel.detail.expiresAtLabel}</Text>
          ) : null}
          <DisclosureCallout disclosure={viewModel.detail.disclosure} />
          <TimelineStepper steps={viewModel.detail.timeline} />
          <View style={styles.actionGrid}>
            {viewModel.detail.actions.map((action) => {
              const Icon = actionIcon(action.id);
              return (
                <Pressable
                  key={action.id}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !action.enabled }}
                  disabled={!action.enabled}
                  style={[
                    styles.actionButton,
                    action.enabled && styles.actionButtonEnabled,
                  ]}
                  onPress={() => handleAction(action.id)}
                >
                  <Icon
                    size={16}
                    color={action.enabled ? '#BAE6FD' : 'rgba(245,251,248,0.32)'}
                    strokeWidth={2}
                  />
                  <Text
                    style={[
                      styles.actionButtonText,
                      !action.enabled && styles.actionButtonTextDisabled,
                    ]}
                  >
                    {action.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.hookRow}>
            {viewModel.detail.relatedHooks.map((hook) => (
              <View key={hook.id} style={styles.hookPill}>
                <SendIcon size={14} color="#BAE6FD" strokeWidth={2} />
                <Text style={styles.hookLabel}>{hook.label}</Text>
              </View>
            ))}
          </View>
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
    gap: 5,
  },
  title: {
    color: '#F5FBF8',
    fontSize: 32,
    fontWeight: '800',
  },
  subtitle: {
    color: 'rgba(245,251,248,0.62)',
    fontSize: 14,
    fontWeight: '600',
  },
  scenarioRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: 'rgba(245,251,248,0.06)',
    borderColor: 'rgba(245,251,248,0.12)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  chipActive: {
    backgroundColor: '#A7F3D0',
    borderColor: '#A7F3D0',
  },
  chipText: {
    color: 'rgba(245,251,248,0.66)',
    fontSize: 12,
    fontWeight: '800',
  },
  chipTextActive: {
    color: '#061511',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(56,189,248,0.10)',
    borderColor: 'rgba(56,189,248,0.20)',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 12,
  },
  modeButtonActive: {
    backgroundColor: '#A7F3D0',
    borderColor: '#A7F3D0',
  },
  modeButtonText: {
    color: '#BAE6FD',
    fontSize: 13,
    fontWeight: '800',
  },
  modeButtonTextActive: {
    color: '#061511',
  },
  inputShell: {
    alignItems: 'center',
    backgroundColor: 'rgba(245,251,248,0.07)',
    borderColor: 'rgba(245,251,248,0.12)',
    borderRadius: 16,
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
    fontWeight: '600',
    minHeight: 46,
  },
  targetList: {
    gap: 10,
  },
  targetRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(245,251,248,0.05)',
    borderColor: 'rgba(245,251,248,0.09)',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  targetRowActive: {
    backgroundColor: 'rgba(0,195,137,0.14)',
    borderColor: 'rgba(0,195,137,0.28)',
  },
  targetAvatar: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,195,137,0.14)',
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  targetText: {
    flex: 1,
    gap: 3,
  },
  targetName: {
    color: '#F5FBF8',
    fontSize: 14,
    fontWeight: '800',
  },
  targetMeta: {
    color: 'rgba(245,251,248,0.56)',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    color: 'rgba(245,251,248,0.58)',
    fontSize: 13,
    lineHeight: 19,
  },
  linkBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(56,189,248,0.10)',
    borderColor: 'rgba(56,189,248,0.20)',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  linkText: {
    color: '#BAE6FD',
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
  },
  helperText: {
    color: 'rgba(245,251,248,0.64)',
    fontSize: 13,
    lineHeight: 19,
  },
  amountGrid: {
    gap: 10,
  },
  amountInput: {
    minHeight: 58,
  },
  expiryInput: {
    minHeight: 58,
  },
  currencyPrefix: {
    color: '#A7F3D0',
    fontSize: 22,
    fontWeight: '900',
  },
  amountTextInput: {
    fontSize: 24,
    fontWeight: '900',
  },
  noteInput: {
    backgroundColor: 'rgba(245,251,248,0.07)',
    borderColor: 'rgba(245,251,248,0.12)',
    borderRadius: 16,
    borderWidth: 1,
    color: '#F5FBF8',
    fontSize: 15,
    fontWeight: '600',
    minHeight: 78,
    padding: 14,
    textAlignVertical: 'top',
  },
  previewGrid: {
    gap: 10,
  },
  previewLine: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  previewLabel: {
    color: 'rgba(245,251,248,0.58)',
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  previewValue: {
    color: '#F5FBF8',
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
  },
  previewDanger: {
    color: '#FCA5A5',
  },
  previewPositive: {
    color: '#A7F3D0',
  },
  previewWarning: {
    color: '#FDE68A',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#A7F3D0',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 16,
  },
  primaryButtonDisabled: {
    backgroundColor: 'rgba(148,163,184,0.12)',
  },
  primaryButtonText: {
    color: '#061511',
    fontSize: 14,
    fontWeight: '900',
  },
  primaryButtonTextDisabled: {
    color: 'rgba(245,251,248,0.38)',
  },
  resultBody: {
    color: 'rgba(245,251,248,0.70)',
    fontSize: 14,
    lineHeight: 21,
  },
  detailHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailAmount: {
    color: '#F5FBF8',
    fontSize: 28,
    fontWeight: '900',
  },
  detailSubtitle: {
    color: 'rgba(245,251,248,0.60)',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(245,251,248,0.06)',
    borderColor: 'rgba(245,251,248,0.11)',
    borderRadius: 16,
    borderWidth: 1,
    flexBasis: '47%',
    flexDirection: 'row',
    flexGrow: 1,
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 12,
  },
  actionButtonEnabled: {
    backgroundColor: 'rgba(56,189,248,0.12)',
    borderColor: 'rgba(56,189,248,0.22)',
  },
  actionButtonText: {
    color: '#BAE6FD',
    fontSize: 12,
    fontWeight: '900',
  },
  actionButtonTextDisabled: {
    color: 'rgba(245,251,248,0.34)',
  },
  hookRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hookPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(56,189,248,0.12)',
    borderColor: 'rgba(56,189,248,0.22)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  hookLabel: {
    color: '#BAE6FD',
    fontSize: 12,
    fontWeight: '800',
  },
});
