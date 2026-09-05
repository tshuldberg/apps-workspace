import { StyleSheet, Text, View } from 'react-native';
import type { Account } from '../../types';
import {
  BG_ACCOUNT_TYPES,
  BG_DANGER,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TYPOGRAPHY,
} from '../tokens';
import { AmountDisplay } from './AmountDisplay';
import { GlassCard } from './GlassCard';
import { MaterialSymbol } from './MaterialSymbol';

function getAccountIcon(type: Account['type']): string {
  switch (type) {
    case 'checking':
      return 'account_balance';
    case 'savings':
      return 'savings';
    case 'credit':
      return 'credit_card';
    case 'investment':
      return 'trending_up';
    case 'loan':
    case 'mortgage':
      return 'payments';
    case 'cash':
      return 'local_atm';
    default:
      return 'wallet';
  }
}

function formatMask(name: string): string {
  const digits = name.replace(/\D/g, '');
  if (digits.length < 4) {
    return '';
  }
  return `••${digits.slice(-4)}`;
}

export interface AccountCardProps {
  account: Account;
  onPress?: () => void;
  onLongPress?: () => void;
  updatedLabel?: string;
}

export function AccountCard({
  account,
  onPress,
  onLongPress,
  updatedLabel,
}: AccountCardProps) {
  const iconColor = BG_ACCOUNT_TYPES[account.type];
  const isDebt = account.type === 'credit' || account.type === 'loan' || account.type === 'mortgage';
  const displayBalance =
    isDebt && account.current_balance > 0
      ? -account.current_balance
      : account.current_balance;

  return (
    <GlassCard onLongPress={onLongPress} onPress={onPress} style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <View style={[styles.iconCircle, { backgroundColor: `${iconColor}22` }]}>
            <MaterialSymbol name={getAccountIcon(account.type)} size={20} color={iconColor} />
          </View>
          <View style={styles.copy}>
            <Text numberOfLines={1} style={styles.title}>
              {account.name}
            </Text>
            <Text style={styles.metaText}>
              {account.type.toUpperCase()}
              {formatMask(account.name) ? ` • ${formatMask(account.name)}` : ''}
            </Text>
          </View>
        </View>
        <AmountDisplay
          cents={displayBalance}
          currencyCode={account.currency}
          size="lg"
          type={displayBalance < 0 ? 'expense' : 'income'}
          style={styles.balance}
        />
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.updatedText}>
          {updatedLabel ?? 'Updated moments ago'}
        </Text>
        {account.archived === 1 ? (
          <View style={styles.archivedPill}>
            <Text style={styles.archivedText}>Archived</Text>
          </View>
        ) : null}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...BG_TYPOGRAPHY.headlineMd,
    color: BG_TEXT,
  },
  metaText: {
    color: BG_TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 16,
  },
  balance: {
    textAlign: 'right',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  updatedText: {
    color: BG_TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 16,
  },
  archivedPill: {
    backgroundColor: BG_SURFACES.high,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  archivedText: {
    color: BG_DANGER,
    fontSize: 11,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
});
