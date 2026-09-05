import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  BG_ACCENT,
  BG_ACCENT_LIGHT,
  BG_ACCOUNT_TYPES,
  BG_FONTS,
  BG_MONEY,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  BG_TYPOGRAPHY,
  AmountDisplay,
  GlassCard,
  MaterialSymbol,
  createAccount,
  getCurrencies,
  type AccountType,
} from '@mylife/budget';
import { useDatabase } from '../../../components/DatabaseProvider';
import { setBudgetAccountMeta, syncBudgetNetWorthSnapshot } from '../../../lib/budget-phase4';
import { uuid } from '../../../lib/uuid';

type AccountTypeOption = {
  type: AccountType;
  label: string;
  icon: string;
  copy: string;
};

const ACCOUNT_TYPE_OPTIONS: AccountTypeOption[] = [
  {
    type: 'checking',
    label: 'Checking',
    icon: 'account_balance',
    copy: 'Bills, debit spending, and direct deposit.',
  },
  {
    type: 'savings',
    label: 'Savings',
    icon: 'savings',
    copy: 'Cash reserves and emergency funds.',
  },
  {
    type: 'credit',
    label: 'Credit',
    icon: 'credit_card',
    copy: 'Cards you pay down each month.',
  },
  {
    type: 'investment',
    label: 'Investment',
    icon: 'trending_up',
    copy: 'Brokerage, retirement, and long-term growth.',
  },
  {
    type: 'loan',
    label: 'Loan',
    icon: 'payments',
    copy: 'Auto, student, personal, and other debt.',
  },
  {
    type: 'mortgage',
    label: 'Mortgage',
    icon: 'home',
    copy: 'Property debt tracked in your balance sheet.',
  },
  {
    type: 'cash',
    label: 'Cash',
    icon: 'local_atm',
    copy: 'Wallet cash or petty cash.',
  },
  {
    type: 'other',
    label: 'Other',
    icon: 'wallet',
    copy: 'Anything that does not fit the usual buckets.',
  },
];

const DEFAULT_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'JPY', 'AUD'];

function parseCurrencyInput(value: string): number | null {
  const normalized = value.replace(/[^0-9.-]/g, '').trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.round(parsed * 100);
}

function normalizeLast4(value: string) {
  return value.replace(/\D/g, '').slice(-4);
}

export default function BudgetCreateAccountScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [balance, setBalance] = useState('0.00');
  const [currency, setCurrency] = useState('USD');
  const [institution, setInstitution] = useState('');
  const [last4, setLast4] = useState('');
  const [includeInNetWorth, setIncludeInNetWorth] = useState(true);
  const [includeInBudget, setIncludeInBudget] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [availableCurrencies, setAvailableCurrencies] = useState<string[]>(DEFAULT_CURRENCIES);

  useEffect(() => {
    try {
      const codes = getCurrencies(db).map((row) => row.code);
      const unique = Array.from(new Set([...DEFAULT_CURRENCIES, ...codes]));
      setAvailableCurrencies(unique);
    } catch {
      setAvailableCurrencies(DEFAULT_CURRENCIES);
    }
  }, [db]);

  const previewBalance = useMemo(() => {
    const parsed = parseCurrencyInput(balance);
    if (parsed == null) {
      return 0;
    }
    return type === 'credit' || type === 'loan' || type === 'mortgage'
      ? -Math.abs(parsed)
      : parsed;
  }, [balance, type]);

  function handleCreate() {
    if (submitting) {
      return;
    }

    const trimmedName = name.trim();
    const parsedBalance = parseCurrencyInput(balance);
    const normalizedCurrency = currency.trim().toUpperCase();
    const normalizedMask = normalizeLast4(last4);

    if (!trimmedName) {
      Alert.alert('Missing name', 'Enter an account name before saving.');
      return;
    }
    if (parsedBalance == null) {
      Alert.alert('Invalid balance', 'Enter a valid starting balance.');
      return;
    }
    if (normalizedCurrency.length !== 3) {
      Alert.alert('Invalid currency', 'Use a 3-letter currency code like USD.');
      return;
    }

    const accountId = uuid();
    setSubmitting(true);

    try {
      db.transaction(() => {
        createAccount(db, accountId, {
          currency: normalizedCurrency,
          current_balance: parsedBalance,
          name: trimmedName,
          type,
        });

        setBudgetAccountMeta(db, accountId, {
          includeInBudget,
          includeInNetWorth,
          institution: institution.trim() || undefined,
          last4: normalizedMask || undefined,
          source: 'manual',
        });
      });

      syncBudgetNetWorthSnapshot(db);
      router.replace(`/(budget)/account/${accountId}` as never);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create account.';
      Alert.alert('Account not saved', message);
      setSubmitting(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      style={styles.screen}
    >
      <GlassCard style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>New Account</Text>
            <Text style={styles.heroTitle}>Add a manual account with the same phase 4 shell as bank-linked accounts.</Text>
          </View>
          <View style={styles.heroBadge}>
            <MaterialSymbol color={BG_MONEY} name="nest_eco_leaf" size={16} />
            <Text style={styles.heroBadgeLabel}>Mission Control</Text>
          </View>
        </View>

        <AmountDisplay
          cents={previewBalance}
          currencyCode={currency.trim().toUpperCase() || 'USD'}
          size="xl"
          type={previewBalance < 0 ? 'expense' : 'income'}
        />
        <Text style={styles.heroMeta}>
          Start with a real balance, then reconcile from the account detail view.
        </Text>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Account identity</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Account name</Text>
          <TextInput
            autoFocus
            onChangeText={setName}
            placeholder="Chase Checking"
            placeholderTextColor={BG_TEXT_TERTIARY}
            style={styles.input}
            value={name}
          />
        </View>

        <View style={styles.typeGrid}>
          {ACCOUNT_TYPE_OPTIONS.map((option) => {
            const selected = option.type === type;
            return (
              <Pressable
                key={option.type}
                onPress={() => setType(option.type)}
                style={[
                  styles.typeCard,
                  selected ? styles.typeCardSelected : null,
                ]}
              >
                <View
                  style={[
                    styles.typeIcon,
                    {
                      backgroundColor: `${BG_ACCOUNT_TYPES[option.type]}22`,
                    },
                  ]}
                >
                  <MaterialSymbol
                    color={BG_ACCOUNT_TYPES[option.type]}
                    name={option.icon}
                    size={18}
                  />
                </View>
                <Text style={styles.typeTitle}>{option.label}</Text>
                <Text style={styles.typeCopy}>{option.copy}</Text>
              </Pressable>
            );
          })}
        </View>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Balances and currency</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Starting balance</Text>
          <TextInput
            keyboardType="decimal-pad"
            onChangeText={setBalance}
            placeholder="0.00"
            placeholderTextColor={BG_TEXT_TERTIARY}
            style={styles.input}
            value={balance}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Currency</Text>
          <View style={styles.currencyRow}>
            {availableCurrencies.slice(0, 6).map((code) => {
              const selected = currency.toUpperCase() === code;
              return (
                <Pressable
                  key={code}
                  onPress={() => setCurrency(code)}
                  style={[
                    styles.currencyChip,
                    selected ? styles.currencyChipSelected : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.currencyChipLabel,
                      selected ? styles.currencyChipLabelSelected : null,
                    ]}
                  >
                    {code}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            autoCapitalize="characters"
            maxLength={3}
            onChangeText={setCurrency}
            placeholder="Custom code"
            placeholderTextColor={BG_TEXT_TERTIARY}
            style={styles.input}
            value={currency}
          />
        </View>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Metadata</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Institution</Text>
          <TextInput
            onChangeText={setInstitution}
            placeholder="Optional for manual accounts"
            placeholderTextColor={BG_TEXT_TERTIARY}
            style={styles.input}
            value={institution}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Last 4 digits</Text>
          <TextInput
            keyboardType="number-pad"
            maxLength={4}
            onChangeText={setLast4}
            placeholder="1234"
            placeholderTextColor={BG_TEXT_TERTIARY}
            style={styles.input}
            value={last4}
          />
        </View>

        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <Text style={styles.toggleTitle}>Include in net worth</Text>
            <Text style={styles.toggleSubtitle}>Stored with account metadata for phase 4 summaries.</Text>
          </View>
          <Switch
            onValueChange={setIncludeInNetWorth}
            thumbColor={includeInNetWorth ? BG_ACCENT_LIGHT : BG_TEXT_TERTIARY}
            trackColor={{ false: BG_SURFACES.high, true: `${BG_ACCENT}88` }}
            value={includeInNetWorth}
          />
        </View>

        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <Text style={styles.toggleTitle}>Include in budget surfaces</Text>
            <Text style={styles.toggleSubtitle}>Use this for manual accounts that should stay visible in cash planning.</Text>
          </View>
          <Switch
            onValueChange={setIncludeInBudget}
            thumbColor={includeInBudget ? BG_MONEY : BG_TEXT_TERTIARY}
            trackColor={{ false: BG_SURFACES.high, true: `${BG_MONEY}66` }}
            value={includeInBudget}
          />
        </View>
      </GlassCard>

      <GlassCard style={styles.linkCard}>
        <View style={styles.linkCardIcon}>
          <MaterialSymbol color={BG_ACCENT_LIGHT} name="account_balance" size={18} />
        </View>
        <View style={styles.linkCardCopy}>
          <Text style={styles.linkCardTitle}>Prefer bank sync?</Text>
          <Text style={styles.linkCardSubtitle}>Phase 4 includes a secure placeholder bank-link flow with imported accounts.</Text>
        </View>
        <Pressable
          onPress={() => router.push('/(budget)/connect-bank' as never)}
          style={styles.inlineAction}
        >
          <Text style={styles.inlineActionLabel}>Open</Text>
          <MaterialSymbol color={BG_ACCENT_LIGHT} name="arrow_forward" size={16} />
        </Pressable>
      </GlassCard>

      <View style={styles.actionRow}>
        <Pressable onPress={() => router.back()} style={styles.secondaryAction}>
          <Text style={styles.secondaryActionLabel}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleCreate}
          style={[styles.primaryAction, submitting ? styles.primaryActionDisabled : null]}
        >
          <Text style={styles.primaryActionLabel}>
            {submitting ? 'Saving...' : 'Save account'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG_SURFACES.base,
  },
  content: {
    padding: 20,
    paddingBottom: 48,
    gap: 18,
  },
  heroCard: {
    gap: 18,
  },
  heroTopRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  heroCopy: {
    flex: 1,
    gap: 8,
  },
  eyebrow: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroTitle: {
    ...BG_TYPOGRAPHY.headlineMd,
    color: BG_TEXT,
  },
  heroMeta: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  heroBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: BG_SURFACES.high,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroBadgeLabel: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  sectionCard: {
    gap: 16,
  },
  sectionLabel: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    backgroundColor: BG_SURFACES.low,
    borderRadius: 16,
    color: BG_TEXT,
    fontFamily: BG_FONTS.medium,
    fontSize: 15,
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  typeGrid: {
    gap: 12,
  },
  typeCard: {
    backgroundColor: BG_SURFACES.low,
    borderRadius: 18,
    gap: 8,
    padding: 16,
  },
  typeCardSelected: {
    backgroundColor: BG_SURFACES.high,
  },
  typeIcon: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  typeTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 15,
    lineHeight: 20,
  },
  typeCopy: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  currencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  currencyChip: {
    backgroundColor: BG_SURFACES.low,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  currencyChipSelected: {
    backgroundColor: `${BG_ACCENT}22`,
  },
  currencyChipLabel: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  currencyChipLabelSelected: {
    color: BG_ACCENT_LIGHT,
  },
  toggleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
  },
  toggleCopy: {
    flex: 1,
    gap: 4,
  },
  toggleTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  toggleSubtitle: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  linkCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  linkCardIcon: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.high,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  linkCardCopy: {
    flex: 1,
    gap: 4,
  },
  linkCardTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  linkCardSubtitle: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  inlineAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  inlineActionLabel: {
    color: BG_ACCENT_LIGHT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryAction: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.high,
    borderRadius: 18,
    flex: 1,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 16,
  },
  secondaryActionLabel: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 15,
    lineHeight: 20,
  },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: BG_MONEY,
    borderRadius: 18,
    flex: 1.4,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 16,
  },
  primaryActionDisabled: {
    opacity: 0.72,
  },
  primaryActionLabel: {
    color: BG_SURFACES.base,
    fontFamily: BG_FONTS.bold,
    fontSize: 15,
    lineHeight: 20,
  },
});
