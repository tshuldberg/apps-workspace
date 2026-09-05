import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { icons } from 'lucide-react-native';
import {
  AmountDisplay,
  DisclosureCallout,
  PaymentGlassCard,
  StatusBadge,
  TransactionRow,
  createPaymentsLaunchSandboxWalletHomeSnapshot,
  buildPaymentsWalletHomeViewModel,
  type PaymentsWalletQuickAction,
  type PaymentsWalletQuickActionId,
} from '@mylife/payments';
import { colors } from '@mylife/ui';

const SettingsIcon = icons.Settings;
const SendIcon = icons.Send;
const RequestIcon = icons.HandCoins;
const AddMoneyIcon = icons.Plus;
const WithdrawIcon = icons.ArrowDownToLine;
const CardIcon = icons.CreditCard;
const GlobeIcon = icons.Globe;
const DisputeIcon = icons.ShieldAlert;
const RealtimeIcon = icons.RadioTower;

function iconForAction(actionId: PaymentsWalletQuickActionId) {
  switch (actionId) {
    case 'send':
      return SendIcon;
    case 'request':
      return RequestIcon;
    case 'add_money':
      return AddMoneyIcon;
    case 'withdraw':
      return WithdrawIcon;
  }
}

function linkedTone(state: ReturnType<typeof buildPaymentsWalletHomeViewModel>['linkedAccountSummary']['state']) {
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

export default function PaymentsIndexScreen() {
  const router = useRouter();
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
    const timer = setInterval(() => {
      setServerRefreshedAt(new Date().toISOString());
    }, walletHome.realtimePath.pollingFallbackMs);

    return () => clearInterval(timer);
  }, [walletHome.realtimePath.pollingFallbackMs]);

  const linkedSummary = walletHome.linkedAccountSummary;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{walletHome.title}</Text>
          <Text style={styles.handle}>{walletHome.handleLabel}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={walletHome.settingsEntryLabel}
          style={styles.settingsButton}
          onPress={() => router.push('/(payments)/settings' as never)}
        >
          <SettingsIcon size={20} color="#F5FBF8" strokeWidth={2} />
        </Pressable>
      </View>

      {walletHome.readOnlyBanner ? (
        <DisclosureCallout disclosure={walletHome.readOnlyBanner} />
      ) : null}

      <PaymentGlassCard eyebrow="Available balance" title={walletHome.balanceHero.title}>
        <AmountDisplay
          amountCents={walletHome.balanceHero.availableCents}
          currency={walletHome.balanceHero.currency}
          direction="neutral"
          label="Available"
          valueStyle={styles.heroAmount}
        />
        <View style={styles.heroMetaRow}>
          {walletHome.balanceHero.pendingIndicator ? (
            <StatusBadge tone="warning" label={walletHome.balanceHero.pendingIndicator} />
          ) : null}
          <StatusBadge
            tone={walletHome.balanceHero.canSend ? 'success' : 'info'}
            label={walletHome.balanceHero.canSend ? 'Can send' : 'Cannot send yet'}
          />
        </View>
        <Text style={styles.heroSubtitle}>{walletHome.balanceHero.subtitle}</Text>
        <Text style={styles.sendReason}>{walletHome.balanceHero.canSendReason}</Text>
        <DisclosureCallout disclosure={walletHome.balanceHero.disclosure} />
      </PaymentGlassCard>

      <View style={styles.quickActionGrid}>
        {walletHome.quickActions.map((action) => (
          <QuickActionButton
            key={action.id}
            action={action}
            onPress={
              action.id === 'send'
                ? () => router.push('/(payments)/send' as never)
                : action.id === 'request'
                  ? () => router.push('/(payments)/request' as never)
                  : action.id === 'add_money'
                    ? () => router.push('/(payments)/add' as never)
                    : action.id === 'withdraw'
                      ? () => router.push('/(payments)/withdraw' as never)
                      : undefined
            }
          />
        ))}
      </View>

      <PaymentGlassCard eyebrow="Recent activity" title="Activity preview">
        {walletHome.recentActivity.length > 0 ? (
          walletHome.recentActivity.map((item) => (
            <TransactionRow key={item.id} item={item} />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{walletHome.activityEmptyState.title}</Text>
            <Text style={styles.emptyBody}>{walletHome.activityEmptyState.body}</Text>
          </View>
        )}
      </PaymentGlassCard>

      <PaymentGlassCard eyebrow="Linked account" title={linkedSummary.title}>
        <View style={styles.summaryRow}>
          <StatusBadge tone={linkedTone(linkedSummary.state)} label={linkedSummary.state.replace('_', ' ')} />
          <Text style={styles.summaryText}>{linkedSummary.subtitle}</Text>
        </View>
      </PaymentGlassCard>

      <PaymentGlassCard eyebrow="Prepared surfaces" title="Cards, remittance, and disputes">
        <View style={styles.hookRow}>
          {walletHome.extensionHooks.map((hook) => {
            const HookIcon =
              hook.id === 'cards'
                ? CardIcon
                : hook.id === 'remittance'
                  ? GlobeIcon
                  : DisputeIcon;
            return (
              <View key={hook.id} style={styles.hookPill}>
                <HookIcon size={16} color="#BAE6FD" strokeWidth={2} />
                <Text style={styles.hookLabel}>{hook.label}</Text>
              </View>
            );
          })}
        </View>
      </PaymentGlassCard>

      <View style={styles.realtimeRow}>
        <RealtimeIcon size={16} color="#A7F3D0" strokeWidth={2} />
        <Text style={styles.realtimeText}>
          {walletHome.realtimePath.connected ? 'Live' : 'Polling'} balance and activity ·{' '}
          {walletHome.realtimePath.lastRefreshedAt}
        </Text>
      </View>
    </ScrollView>
  );
}

function QuickActionButton({
  action,
  onPress,
}: {
  action: PaymentsWalletQuickAction;
  onPress?: () => void;
}) {
  const Icon = iconForAction(action.id);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !action.enabled }}
      accessibilityLabel={action.label}
      style={[styles.quickAction, !action.enabled && styles.quickActionDisabled]}
      disabled={!action.enabled}
      onPress={onPress}
    >
      <Icon
        size={21}
        color={action.enabled ? '#F5FBF8' : 'rgba(245,251,248,0.38)'}
        strokeWidth={2}
      />
      <Text style={[styles.quickActionText, !action.enabled && styles.quickActionTextDisabled]}>
        {action.label}
      </Text>
    </Pressable>
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
    justifyContent: 'space-between',
    gap: 16,
  },
  headerText: {
    gap: 6,
  },
  title: {
    color: '#F5FBF8',
    fontSize: 32,
    fontWeight: '800',
  },
  handle: {
    color: 'rgba(245,251,248,0.66)',
    fontSize: 15,
    fontWeight: '600',
  },
  settingsButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(245,251,248,0.08)',
    borderColor: 'rgba(245,251,248,0.14)',
    borderRadius: 18,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  heroAmount: {
    fontSize: 44,
    letterSpacing: -1.2,
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  heroSubtitle: {
    color: 'rgba(245,251,248,0.72)',
    fontSize: 15,
    lineHeight: 22,
  },
  sendReason: {
    color: '#A7F3D0',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  quickActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickAction: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,195,137,0.16)',
    borderColor: 'rgba(0,195,137,0.26)',
    borderRadius: 18,
    borderWidth: 1,
    flexBasis: '47%',
    flexDirection: 'row',
    flexGrow: 1,
    gap: 10,
    justifyContent: 'center',
    minHeight: 58,
    paddingHorizontal: 14,
  },
  quickActionDisabled: {
    backgroundColor: 'rgba(148,163,184,0.10)',
    borderColor: 'rgba(148,163,184,0.18)',
  },
  quickActionText: {
    color: '#F5FBF8',
    fontSize: 14,
    fontWeight: '800',
  },
  quickActionTextDisabled: {
    color: 'rgba(245,251,248,0.42)',
  },
  emptyState: {
    backgroundColor: 'rgba(245,251,248,0.05)',
    borderColor: 'rgba(245,251,248,0.10)',
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  emptyTitle: {
    color: '#F5FBF8',
    fontSize: 16,
    fontWeight: '800',
  },
  emptyBody: {
    color: 'rgba(245,251,248,0.68)',
    fontSize: 14,
    lineHeight: 20,
  },
  summaryRow: {
    gap: 12,
  },
  summaryText: {
    color: 'rgba(245,251,248,0.72)',
    fontSize: 14,
    lineHeight: 20,
  },
  hookRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  hookPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(56,189,248,0.12)',
    borderColor: 'rgba(56,189,248,0.22)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  hookLabel: {
    color: '#BAE6FD',
    fontSize: 13,
    fontWeight: '800',
  },
  realtimeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 12,
  },
  realtimeText: {
    color: 'rgba(245,251,248,0.58)',
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});
