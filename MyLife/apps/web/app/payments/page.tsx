'use client';

import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  CreditCard,
  Globe2,
  HandCoins,
  Plus,
  RadioTower,
  Send,
  Settings,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';
import {
  DisclosureCallout,
  PaymentGlassCard,
  StatusBadge,
  TransactionRow,
  createPaymentsLaunchSandboxWalletHomeSnapshot,
  buildPaymentsWalletHomeViewModel,
  formatPaymentAmount,
  type PaymentsLinkedAccountState,
  type PaymentsWalletQuickAction,
  type PaymentsWalletQuickActionId,
} from '@mylife/payments';

function iconForAction(actionId: PaymentsWalletQuickActionId): LucideIcon {
  switch (actionId) {
    case 'send':
      return Send;
    case 'request':
      return HandCoins;
    case 'add_money':
      return Plus;
    case 'withdraw':
      return ArrowDownToLine;
  }
}

function linkedTone(state: PaymentsLinkedAccountState) {
  switch (state) {
    case 'verified':
      return 'success';
    case 'review':
      return 'warning';
    case 'failed':
      return 'danger';
    case 'none':
    case 'unverified':
      return 'info';
  }
}

export default function PaymentsPage() {
  const [serverRefreshedAt, setServerRefreshedAt] = useState(
    () => '2026-04-24T16:30:00.000Z',
  );
  const snapshot = useMemo(
    () => createPaymentsLaunchSandboxWalletHomeSnapshot({ serverRefreshedAt }),
    [serverRefreshedAt],
  );
  const walletHome = useMemo(
    () => buildPaymentsWalletHomeViewModel(snapshot),
    [snapshot],
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setServerRefreshedAt(new Date().toISOString());
    }, walletHome.realtimePath.pollingFallbackMs);

    return () => window.clearInterval(timer);
  }, [walletHome.realtimePath.pollingFallbackMs]);

  const linkedSummary = walletHome.linkedAccountSummary;
  const heroAmount = formatPaymentAmount(
    {
      amountCents: walletHome.balanceHero.availableCents,
      currency: walletHome.balanceHero.currency,
    },
    { direction: 'neutral' },
  );

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.header}>
          <div style={styles.headerText}>
            <h1 style={styles.title}>{walletHome.title}</h1>
            <p style={styles.handle}>{walletHome.handleLabel}</p>
          </div>
          <a href="/settings" aria-label={walletHome.settingsEntryLabel} style={styles.settingsLink}>
            <Settings size={20} strokeWidth={2} />
          </a>
        </header>

        {walletHome.readOnlyBanner ? (
          <DisclosureCallout disclosure={walletHome.readOnlyBanner} />
        ) : null}

        <section style={styles.grid}>
          <PaymentGlassCard
            eyebrow="Available balance"
            title={walletHome.balanceHero.title}
            style={styles.heroCard}
          >
            <p style={styles.heroAmount}>{heroAmount}</p>
            <div style={styles.heroMetaRow}>
              {walletHome.balanceHero.pendingIndicator ? (
                <StatusBadge tone="warning" label={walletHome.balanceHero.pendingIndicator} />
              ) : null}
              <StatusBadge
                tone={walletHome.balanceHero.canSend ? 'success' : 'info'}
                label={walletHome.balanceHero.canSend ? 'Can send' : 'Cannot send yet'}
              />
            </div>
            <p style={styles.heroSubtitle}>{walletHome.balanceHero.subtitle}</p>
            <p style={styles.sendReason}>{walletHome.balanceHero.canSendReason}</p>
            <DisclosureCallout disclosure={walletHome.balanceHero.disclosure} />
          </PaymentGlassCard>

          <div style={styles.sideStack}>
            <PaymentGlassCard eyebrow="Linked account" title={linkedSummary.title}>
              <div style={styles.summaryBlock}>
                <StatusBadge tone={linkedTone(linkedSummary.state)} label={linkedSummary.state.replace('_', ' ')} />
                <p style={styles.mutedText}>{linkedSummary.subtitle}</p>
              </div>
            </PaymentGlassCard>

            <PaymentGlassCard eyebrow="Prepared surfaces" title="Cards, remittance, disputes">
              <div style={styles.hookRow}>
                {walletHome.extensionHooks.map((hook) => {
                  const HookIcon =
                    hook.id === 'cards'
                      ? CreditCard
                      : hook.id === 'remittance'
                        ? Globe2
                        : ShieldAlert;
                  return (
                    <span key={hook.id} style={styles.hookPill}>
                      <HookIcon size={16} strokeWidth={2} />
                      {hook.label}
                    </span>
                  );
                })}
              </div>
            </PaymentGlassCard>
          </div>
        </section>

        <div style={styles.quickActionGrid}>
          {walletHome.quickActions.map((action) => (
            <QuickActionButton key={action.id} action={action} />
          ))}
        </div>

        <PaymentGlassCard eyebrow="Recent activity" title="Activity preview">
          {walletHome.recentActivity.length > 0 ? (
            walletHome.recentActivity.map((item) => (
              <TransactionRow key={item.id} item={item} />
            ))
          ) : (
            <div style={styles.emptyState}>
              <strong style={styles.emptyTitle}>{walletHome.activityEmptyState.title}</strong>
              <p style={styles.emptyBody}>{walletHome.activityEmptyState.body}</p>
            </div>
          )}
        </PaymentGlassCard>

        <div style={styles.realtimeRow}>
          <RadioTower size={16} strokeWidth={2} />
          <span>
            {walletHome.realtimePath.connected ? 'Live' : 'Polling'} balance and activity ·{' '}
            {walletHome.realtimePath.lastRefreshedAt}
          </span>
        </div>
      </div>
    </main>
  );
}

function QuickActionButton({ action }: { action: PaymentsWalletQuickAction }) {
  const Icon = iconForAction(action.id);

  return (
    <button
      type="button"
      disabled={!action.enabled}
      title={action.reason ?? action.label}
      style={{
        ...styles.quickAction,
        ...(!action.enabled ? styles.quickActionDisabled : null),
      }}
    >
      <Icon size={20} strokeWidth={2} />
      <span>{action.label}</span>
    </button>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background:
      'radial-gradient(circle at 15% 0%, rgba(0, 195, 137, 0.16), transparent 34%), radial-gradient(circle at 90% 10%, rgba(56, 189, 248, 0.12), transparent 28%), linear-gradient(180deg, #061511 0%, #091A15 100%)',
    color: '#F5FBF8',
    padding: '36px 24px 72px',
  },
  shell: {
    width: 'min(1120px, 100%)',
    margin: '0 auto',
    display: 'grid',
    gap: 20,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
  },
  headerText: {
    display: 'grid',
    gap: 6,
  },
  title: {
    margin: 0,
    fontSize: 36,
    lineHeight: 1.05,
    fontWeight: 800,
    letterSpacing: 0,
  },
  handle: {
    margin: 0,
    color: 'rgba(245, 251, 248, 0.66)',
    fontSize: 15,
    fontWeight: 700,
  },
  settingsLink: {
    width: 44,
    height: 44,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    border: '1px solid rgba(245,251,248,0.14)',
    color: '#F5FBF8',
    background: 'rgba(245,251,248,0.08)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.45fr) minmax(280px, 0.8fr)',
    gap: 18,
    alignItems: 'stretch',
  },
  heroCard: {
    minHeight: 428,
  },
  heroAmount: {
    margin: 0,
    color: '#F5FBF8',
    fontSize: 'clamp(3rem, 8vw, 5.5rem)',
    lineHeight: 0.95,
    fontWeight: 850,
    letterSpacing: 0,
    fontVariantNumeric: 'tabular-nums',
    fontFeatureSettings: '"tnum" 1, "ss01" 1',
  },
  heroMetaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
  },
  heroSubtitle: {
    margin: 0,
    maxWidth: 620,
    color: 'rgba(245, 251, 248, 0.72)',
    fontSize: 15,
    lineHeight: 1.55,
  },
  sendReason: {
    margin: 0,
    color: '#A7F3D0',
    fontSize: 14,
    fontWeight: 800,
    lineHeight: 1.45,
  },
  sideStack: {
    display: 'grid',
    gap: 18,
  },
  summaryBlock: {
    display: 'grid',
    gap: 12,
  },
  mutedText: {
    margin: 0,
    color: 'rgba(245, 251, 248, 0.72)',
    fontSize: 14,
    lineHeight: 1.5,
  },
  hookRow: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  hookPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    border: '1px solid rgba(56,189,248,0.22)',
    background: 'rgba(56,189,248,0.12)',
    color: '#BAE6FD',
    padding: '10px 12px',
    fontSize: 13,
    fontWeight: 800,
  },
  quickActionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 12,
  },
  quickAction: {
    minHeight: 62,
    border: '1px solid rgba(0,195,137,0.26)',
    borderRadius: 18,
    background: 'rgba(0,195,137,0.16)',
    color: '#F5FBF8',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    fontSize: 14,
    fontWeight: 850,
    cursor: 'pointer',
  },
  quickActionDisabled: {
    border: '1px solid rgba(148,163,184,0.18)',
    background: 'rgba(148,163,184,0.10)',
    color: 'rgba(245,251,248,0.42)',
    cursor: 'not-allowed',
  },
  emptyState: {
    border: '1px solid rgba(245,251,248,0.10)',
    borderRadius: 18,
    background: 'rgba(245,251,248,0.05)',
    padding: 16,
    display: 'grid',
    gap: 8,
  },
  emptyTitle: {
    color: '#F5FBF8',
    fontSize: 16,
  },
  emptyBody: {
    margin: 0,
    color: 'rgba(245,251,248,0.68)',
    fontSize: 14,
    lineHeight: 1.5,
  },
  realtimeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: 'rgba(245,251,248,0.58)',
    fontSize: 12,
    lineHeight: 1.5,
  },
};
