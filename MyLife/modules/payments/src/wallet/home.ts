import type {
  PaymentsPaymentProfile,
  PaymentsTierAssessment,
} from '../compliance/types';
import {
  explainPaymentsLimitBlock,
} from '../compliance/tiers';
import type {
  PaymentsBalanceBucket,
} from '../cloud/rpc';
import type {
  PaymentsComplianceHoldEffect,
  PaymentsWalletSnapshot,
  PaymentsWalletStatus,
} from '../engine/types';
import type {
  CurrencyCode,
  PaymentActivityItem,
  PaymentDisclosure,
  PaymentVerificationState,
} from '../types';
import {
  createPaymentsDisclosureCallout,
  formatPaymentsMoney,
} from '../compliance/disclosures/content';
import {
  buildPaymentsLegalCopyBlocks,
} from '../compliance/disclosures/legal';
import type {
  PaymentsLegalCopyBlock,
  PaymentsLegalCopyBlockId,
} from '../compliance/disclosures/types';

export type PaymentsWalletHomeSystemMode = 'operational' | 'degraded';

export type PaymentsWalletBalanceHeroState =
  | 'brand_new'
  | 'zero'
  | 'available'
  | 'pending'
  | 'held';

export type PaymentsWalletQuickActionId =
  | 'send'
  | 'request'
  | 'add_money'
  | 'withdraw';

export type PaymentsWalletExtensionHookId =
  | 'cards'
  | 'remittance'
  | 'disputes';

export type PaymentsLinkedAccountKind = 'bank' | 'card' | 'external_wallet';

export type PaymentsLinkedAccountState =
  | 'none'
  | PaymentVerificationState
  | 'failed';

export interface PaymentsWalletLinkedAccount {
  id: string;
  label: string;
  institutionName?: string | null;
  kind: PaymentsLinkedAccountKind;
  verificationState: Exclude<PaymentsLinkedAccountState, 'none'>;
  last4?: string | null;
  primary?: boolean;
}

export interface PaymentsWalletRealtimeSource {
  connected: boolean;
  balanceChannel: string;
  activityChannel: string;
  pollingFallbackMs: number;
  lastEventAt?: string | null;
}

export interface PaymentsWalletHomeProfile {
  displayName?: string | null;
  handle?: string | null;
  verificationState: PaymentVerificationState;
  tierAssessment: PaymentsTierAssessment;
}

export interface PaymentsWalletHomeSnapshot {
  profile: PaymentsWalletHomeProfile | PaymentsPaymentProfile | null;
  wallet: PaymentsWalletSnapshot | null;
  linkedAccounts: PaymentsWalletLinkedAccount[];
  recentActivity: PaymentActivityItem[];
  systemMode?: PaymentsWalletHomeSystemMode;
  systemMessage?: string | null;
  accountHoldReason?: string | null;
  locale?: string;
  generatedAt?: string;
  serverRefreshedAt: string;
  realtime?: Partial<PaymentsWalletRealtimeSource> | null;
  productName?: string | null;
  partnerBankName?: string | null;
  custodialEntityName?: string | null;
  supportContact?: string | null;
}

export interface PaymentsWalletQuickAction {
  id: PaymentsWalletQuickActionId;
  label: string;
  enabled: boolean;
  reason: string | null;
}

export interface PaymentsWalletExtensionHook {
  id: PaymentsWalletExtensionHookId;
  label: string;
  status: 'ready_for_slice' | 'blocked_by_wallet';
}

export interface PaymentsWalletBalanceHero {
  state: PaymentsWalletBalanceHeroState;
  availableCents: number;
  pendingCents: number;
  currency: CurrencyCode;
  title: string;
  subtitle: string;
  pendingIndicator: string | null;
  canSend: boolean;
  canSendReason: string;
  disclosure: PaymentDisclosure;
  legalCopyBlocks: PaymentsLegalCopyBlock[];
}

export interface PaymentsWalletLinkedAccountSummary {
  state: PaymentsLinkedAccountState;
  title: string;
  subtitle: string;
  primaryAccount: PaymentsWalletLinkedAccount | null;
}

export interface PaymentsWalletRealtimePath {
  connected: boolean;
  balanceChannel: string;
  activityChannel: string;
  pollingFallbackMs: number;
  lastRefreshedAt: string;
  lastEventAt: string | null;
}

export interface PaymentsWalletHomeViewModel {
  title: 'MyPay';
  handleLabel: string;
  settingsEntryLabel: string;
  readOnly: boolean;
  readOnlyBanner: PaymentDisclosure | null;
  balanceHero: PaymentsWalletBalanceHero;
  quickActions: PaymentsWalletQuickAction[];
  recentActivity: PaymentActivityItem[];
  activityEmptyState: {
    title: string;
    body: string;
  };
  linkedAccountSummary: PaymentsWalletLinkedAccountSummary;
  realtimePath: PaymentsWalletRealtimePath;
  extensionHooks: PaymentsWalletExtensionHook[];
  isBrandNew: boolean;
}

const DEFAULT_CURRENCY: CurrencyCode = 'USD';
const DEFAULT_POLLING_FALLBACK_MS = 30_000;

function balanceCents(
  wallet: PaymentsWalletSnapshot | null,
  bucket: PaymentsBalanceBucket,
): number {
  return wallet?.balances[bucket] ?? 0;
}

function hasAccountHold(
  wallet: PaymentsWalletSnapshot | null,
  systemMode: PaymentsWalletHomeSystemMode,
): boolean {
  if (!wallet) {
    return false;
  }
  return (
    systemMode === 'degraded' ||
    wallet.status === 'restricted' ||
    wallet.status === 'frozen' ||
    (wallet.complianceHold ?? 'none') !== 'none'
  );
}

function walletStatusReason(status: PaymentsWalletStatus): string {
  switch (status) {
    case 'pending':
      return 'Wallet activation is still pending.';
    case 'restricted':
      return 'Wallet access is restricted while review is open.';
    case 'frozen':
      return 'Wallet access is frozen while review is open.';
    case 'closed':
      return 'This wallet is closed.';
    case 'active':
      return 'Wallet is active.';
  }
}

function holdEffectLabel(hold: PaymentsComplianceHoldEffect | undefined): string | null {
  switch (hold) {
    case 'send_only':
      return 'Sending is paused while review is open.';
    case 'receive_only':
      return 'Receiving is paused while review is open.';
    case 'freeze':
      return 'Money movement is paused while review is open.';
    case 'none':
    case undefined:
      return null;
  }
}

function resolveCanSend(input: {
  wallet: PaymentsWalletSnapshot | null;
  profile: PaymentsWalletHomeProfile | PaymentsPaymentProfile | null;
  availableCents: number;
  readOnly: boolean;
  accountHoldReason?: string | null;
}): { canSend: boolean; reason: string } {
  if (!input.wallet) {
    return {
      canSend: false,
      reason: 'Create a wallet and complete basic verification before sending money.',
    };
  }

  if (input.readOnly) {
    return {
      canSend: false,
      reason:
        input.accountHoldReason ??
        holdEffectLabel(input.wallet.complianceHold) ??
        walletStatusReason(input.wallet.status),
    };
  }

  if (input.wallet.status !== 'active') {
    return {
      canSend: false,
      reason: walletStatusReason(input.wallet.status),
    };
  }

  if (!input.profile?.tierAssessment.currentLimits.capabilities.canSend) {
    return {
      canSend: false,
      reason: input.profile
        ? explainPaymentsLimitBlock({
            assessment: input.profile.tierAssessment,
            operation: 'send',
          })
        : 'Complete basic verification before sending money.',
    };
  }

  if (input.availableCents <= 0) {
    return {
      canSend: false,
      reason: 'Add money or receive a payment before sending.',
    };
  }

  return {
    canSend: true,
    reason: 'Ready to send from available balance.',
  };
}

function resolveHeroState(input: {
  wallet: PaymentsWalletSnapshot | null;
  availableCents: number;
  pendingCents: number;
  readOnly: boolean;
  isBrandNew: boolean;
}): PaymentsWalletBalanceHeroState {
  if (input.readOnly) {
    return 'held';
  }
  if (input.pendingCents > 0) {
    return 'pending';
  }
  if (input.isBrandNew) {
    return 'brand_new';
  }
  if (input.availableCents <= 0) {
    return 'zero';
  }
  return 'available';
}

function buildLegalCopy(input: PaymentsWalletHomeSnapshot): PaymentsLegalCopyBlock[] {
  return buildPaymentsLegalCopyBlocks({
    blockIds: [
      'stored_balance',
      'partner_bank',
      'custodial_account',
      'debit_card',
      'remittance_cancellation',
      'error_resolution',
    ],
    productName: input.productName ?? 'MyPay',
    partnerBankName: input.partnerBankName,
    custodialEntityName: input.custodialEntityName,
    supportContact: input.supportContact,
    locale: input.locale,
    surfaces: ['mobile', 'web'],
  });
}

function pickDisclosureBlock(
  blocks: PaymentsLegalCopyBlock[],
  state: PaymentsWalletBalanceHeroState,
): PaymentsLegalCopyBlock {
  const preferredId: PaymentsLegalCopyBlockId =
    state === 'pending' || state === 'held'
      ? 'custodial_account'
      : 'stored_balance';

  return (
    blocks.find((block) => block.blockId === preferredId) ??
    blocks.find((block) => block.blockId === 'stored_balance') ??
    blocks[0]!
  );
}

function buildHeroDisclosure(input: {
  legalCopyBlocks: PaymentsLegalCopyBlock[];
  heroState: PaymentsWalletBalanceHeroState;
}): PaymentDisclosure {
  const block = pickDisclosureBlock(input.legalCopyBlocks, input.heroState);
  return createPaymentsDisclosureCallout({
    id: `wallet_home_${block.blockId}_${block.version}`,
    tone: input.heroState === 'held' ? 'warning' : 'info',
    title: block.title,
    body: block.summary,
    footnote: block.footnote,
  });
}

function buildReadOnlyBanner(input: {
  systemMode: PaymentsWalletHomeSystemMode;
  systemMessage?: string | null;
  wallet: PaymentsWalletSnapshot | null;
  accountHoldReason?: string | null;
}): PaymentDisclosure | null {
  if (input.systemMode === 'degraded') {
    return createPaymentsDisclosureCallout({
      id: 'wallet_home_read_only_degraded',
      tone: 'warning',
      title: 'MyPay is in read-only mode',
      body:
        input.systemMessage ??
        'Balance and activity can refresh, but money movement is paused until service health recovers.',
    });
  }

  if (!input.wallet || !hasAccountHold(input.wallet, input.systemMode)) {
    return null;
  }

  return createPaymentsDisclosureCallout({
    id: 'wallet_home_read_only_hold',
    tone: 'warning',
    title: 'Wallet is read-only',
    body:
      input.accountHoldReason ??
      holdEffectLabel(input.wallet.complianceHold) ??
      walletStatusReason(input.wallet.status),
  });
}

function buildHeroText(input: {
  heroState: PaymentsWalletBalanceHeroState;
  pendingCents: number;
  currency: CurrencyCode;
  locale: string;
}): Pick<PaymentsWalletBalanceHero, 'title' | 'subtitle' | 'pendingIndicator'> {
  switch (input.heroState) {
    case 'brand_new':
      return {
        title: 'No spendable balance yet',
        subtitle: 'Finish setup, link an account, or receive a payment to start sending.',
        pendingIndicator: null,
      };
    case 'zero':
      return {
        title: 'No spendable balance yet',
        subtitle: 'Add money or request a payment to make this wallet ready to send.',
        pendingIndicator: null,
      };
    case 'pending':
      return {
        title: 'Pending funds are on the way',
        subtitle: 'Only available balance can be sent, withdrawn, or used by card surfaces.',
        pendingIndicator: `${formatPaymentsMoney(input.pendingCents, input.currency, input.locale)} pending`,
      };
    case 'held':
      return {
        title: 'Balance is read-only',
        subtitle: 'You can review balance, activity, receipts, and support references while movement is paused.',
        pendingIndicator:
          input.pendingCents > 0
            ? `${formatPaymentsMoney(input.pendingCents, input.currency, input.locale)} pending`
            : 'Transfers paused',
      };
    case 'available':
      return {
        title: 'Available to send',
        subtitle: 'This balance is server-authoritative and updates from wallet balance events.',
        pendingIndicator: null,
      };
  }
}

function hasVerifiedLinkedAccount(accounts: PaymentsWalletLinkedAccount[]): boolean {
  return accounts.some((account) => account.verificationState === 'verified');
}

function buildQuickActions(input: {
  wallet: PaymentsWalletSnapshot | null;
  profile: PaymentsWalletHomeProfile | PaymentsPaymentProfile | null;
  availableCents: number;
  canSend: boolean;
  canSendReason: string;
  readOnly: boolean;
  linkedAccounts: PaymentsWalletLinkedAccount[];
}): PaymentsWalletQuickAction[] {
  const hasWallet = Boolean(input.wallet);
  const canReceive =
    hasWallet &&
    !input.readOnly &&
    Boolean(input.profile?.tierAssessment.currentLimits.capabilities.canReceive);
  const verifiedLinkedAccount = hasVerifiedLinkedAccount(input.linkedAccounts);
  const addMoneyEnabled = hasWallet && !input.readOnly;
  const withdrawEnabled =
    hasWallet &&
    !input.readOnly &&
    input.availableCents > 0 &&
    verifiedLinkedAccount;

  return [
    {
      id: 'send',
      label: 'Send',
      enabled: input.canSend,
      reason: input.canSend ? null : input.canSendReason,
    },
    {
      id: 'request',
      label: 'Request',
      enabled: canReceive,
      reason: canReceive
        ? null
        : input.readOnly
          ? 'Requests are paused while wallet is read-only.'
          : 'Receiving unlocks after wallet and identity setup.',
    },
    {
      id: 'add_money',
      label: 'Add Money',
      enabled: addMoneyEnabled,
      reason: addMoneyEnabled ? null : 'Wallet setup must finish before adding money.',
    },
    {
      id: 'withdraw',
      label: 'Withdraw',
      enabled: withdrawEnabled,
      reason: withdrawEnabled
        ? null
        : verifiedLinkedAccount
          ? 'Withdrawals require available balance.'
          : 'Verify a linked account before withdrawing.',
    },
  ];
}

function buildLinkedAccountSummary(
  accounts: PaymentsWalletLinkedAccount[],
): PaymentsWalletLinkedAccountSummary {
  const primary =
    accounts.find((account) => account.primary) ??
    accounts.find((account) => account.verificationState === 'verified') ??
    accounts[0] ??
    null;

  if (!primary) {
    return {
      state: 'none',
      title: 'No linked account',
      subtitle: 'Link and verify a bank account to add money or withdraw.',
      primaryAccount: null,
    };
  }

  const institution = primary.institutionName ?? primary.label;
  const suffix = primary.last4 ? ` ending in ${primary.last4}` : '';

  switch (primary.verificationState) {
    case 'verified':
      return {
        state: 'verified',
        title: `${institution}${suffix}`,
        subtitle: 'Verified for add money and withdrawal flows.',
        primaryAccount: primary,
      };
    case 'review':
      return {
        state: 'review',
        title: `${institution}${suffix}`,
        subtitle: 'Verification is still in review.',
        primaryAccount: primary,
      };
    case 'unverified':
      return {
        state: 'unverified',
        title: `${institution}${suffix}`,
        subtitle: 'Finish verification before moving money with this account.',
        primaryAccount: primary,
      };
    case 'failed':
      return {
        state: 'failed',
        title: `${institution}${suffix}`,
        subtitle: 'Verification needs attention before this account can be used.',
        primaryAccount: primary,
      };
  }
}

function buildRealtimePath(
  input: PaymentsWalletHomeSnapshot,
): PaymentsWalletRealtimePath {
  const walletId = input.wallet?.walletId ?? 'new_wallet';
  return {
    connected: input.realtime?.connected ?? false,
    balanceChannel:
      input.realtime?.balanceChannel ?? `payments.wallet.${walletId}.balances`,
    activityChannel:
      input.realtime?.activityChannel ?? `payments.wallet.${walletId}.activity`,
    pollingFallbackMs:
      input.realtime?.pollingFallbackMs ?? DEFAULT_POLLING_FALLBACK_MS,
    lastRefreshedAt: input.serverRefreshedAt,
    lastEventAt: input.realtime?.lastEventAt ?? null,
  };
}

function buildExtensionHooks(input: {
  hasWallet: boolean;
  readOnly: boolean;
}): PaymentsWalletExtensionHook[] {
  const status =
    input.hasWallet && !input.readOnly
      ? 'ready_for_slice'
      : 'blocked_by_wallet';

  return [
    { id: 'cards', label: 'Cards', status },
    { id: 'remittance', label: 'Send abroad', status },
    { id: 'disputes', label: 'Disputes', status: input.hasWallet ? 'ready_for_slice' : 'blocked_by_wallet' },
  ];
}

export function buildPaymentsWalletHomeViewModel(
  input: PaymentsWalletHomeSnapshot,
): PaymentsWalletHomeViewModel {
  const systemMode = input.systemMode ?? 'operational';
  const locale = input.locale ?? 'en-US';
  const wallet = input.wallet;
  const currency = wallet?.defaultCurrency ?? DEFAULT_CURRENCY;
  const availableCents = balanceCents(wallet, 'available');
  const pendingCents = balanceCents(wallet, 'pending');
  const isBrandNew =
    !wallet ||
    (
      availableCents === 0 &&
      pendingCents === 0 &&
      input.recentActivity.length === 0
    );
  const readOnly = hasAccountHold(wallet, systemMode);
  const send = resolveCanSend({
    wallet,
    profile: input.profile,
    availableCents,
    readOnly,
    accountHoldReason: input.accountHoldReason,
  });
  const heroState = resolveHeroState({
    wallet,
    availableCents,
    pendingCents,
    readOnly,
    isBrandNew,
  });
  const legalCopyBlocks = buildLegalCopy(input);
  const heroText = buildHeroText({
    heroState,
    pendingCents,
    currency,
    locale,
  });

  return {
    title: 'MyPay',
    handleLabel: input.profile?.handle ?? 'Handle not set',
    settingsEntryLabel: 'Settings',
    readOnly,
    readOnlyBanner: buildReadOnlyBanner({
      systemMode,
      systemMessage: input.systemMessage,
      wallet,
      accountHoldReason: input.accountHoldReason,
    }),
    balanceHero: {
      state: heroState,
      availableCents,
      pendingCents,
      currency,
      ...heroText,
      canSend: send.canSend,
      canSendReason: send.reason,
      disclosure: buildHeroDisclosure({
        legalCopyBlocks,
        heroState,
      }),
      legalCopyBlocks,
    },
    quickActions: buildQuickActions({
      wallet,
      profile: input.profile,
      availableCents,
      canSend: send.canSend,
      canSendReason: send.reason,
      readOnly,
      linkedAccounts: input.linkedAccounts,
    }),
    recentActivity: input.recentActivity.slice(0, 4),
    activityEmptyState: {
      title: 'No activity yet',
      body: 'Payments, requests, card activity, remittances, refunds, and disputes will appear here after they post.',
    },
    linkedAccountSummary: buildLinkedAccountSummary(input.linkedAccounts),
    realtimePath: buildRealtimePath(input),
    extensionHooks: buildExtensionHooks({
      hasWallet: Boolean(wallet),
      readOnly,
    }),
    isBrandNew,
  };
}
