import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  BG_ACCENT,
  BG_ACCENT_LIGHT,
  BG_DANGER,
  BG_FONTS,
  BG_MONEY,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  BG_TYPOGRAPHY,
  GlassCard,
  MaterialSymbol,
  createAccount,
  type AccountType,
} from '@mylife/budget';
import { useDatabase } from '../../components/DatabaseProvider';
import { setBudgetAccountMeta, syncBudgetNetWorthSnapshot } from '../../lib/budget-phase4';
import { uuid } from '../../lib/uuid';

type LinkMode = 'success' | 'mfa' | 'invalid' | 'unavailable';

type ImportedAccountTemplate = {
  balance: number;
  label: string;
  last4: string;
  type: AccountType;
};

type BankInfo = {
  accent: string;
  accounts: ImportedAccountTemplate[];
  copy: string;
  name: string;
};

const POPULAR_BANKS: BankInfo[] = [
  {
    accent: '#117ACA',
    accounts: [
      { balance: 284_230, label: 'Everyday Checking', last4: '1842', type: 'checking' },
      { balance: 1_264_000, label: 'Reserve Savings', last4: '5510', type: 'savings' },
    ],
    copy: 'Best for checking + high-yield savings.',
    name: 'Chase',
  },
  {
    accent: '#D03027',
    accounts: [
      { balance: 923_400, label: '360 Savings', last4: '2121', type: 'savings' },
      { balance: 412_700, label: '360 Checking', last4: '0974', type: 'checking' },
    ],
    copy: 'Cash savings and flexible personal banking.',
    name: 'Capital One',
  },
  {
    accent: '#016FD0',
    accounts: [
      { balance: 183_450, label: 'Blue Cash Preferred', last4: '7712', type: 'credit' },
      { balance: 642_000, label: 'High Yield Savings', last4: '4428', type: 'savings' },
    ],
    copy: 'Popular for cards and high-yield savings.',
    name: 'American Express',
  },
  {
    accent: '#E31837',
    accounts: [
      { balance: 516_980, label: 'Advantage Plus Checking', last4: '4090', type: 'checking' },
      { balance: 1_940_000, label: 'Investment Edge', last4: '8802', type: 'investment' },
    ],
    copy: 'Checking plus investment-linked cash flow.',
    name: 'Bank of America',
  },
  {
    accent: '#003B70',
    accounts: [
      { balance: 338_700, label: 'Access Checking', last4: '6123', type: 'checking' },
      { balance: 765_400, label: 'Goal Savings', last4: '8841', type: 'savings' },
    ],
    copy: 'Daily spending and short-term savings.',
    name: 'Citi',
  },
  {
    accent: '#D71E28',
    accounts: [
      { balance: 412_000, label: 'Everyday Checking', last4: '1458', type: 'checking' },
      { balance: 21_850_000, label: 'Home Mortgage', last4: '9930', type: 'mortgage' },
    ],
    copy: 'Traditional branch banking plus mortgage servicing.',
    name: 'Wells Fargo',
  },
];

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function normalizeBankAccountType(type: AccountType) {
  if (type === 'mortgage') {
    return 'loan';
  }
  if (type === 'cash') {
    return 'other';
  }
  return type;
}

function statusCopy(mode: LinkMode) {
  switch (mode) {
    case 'mfa':
      return {
        title: 'Additional authentication required',
        message:
          'The institution requested MFA. Phase 4 keeps the placeholder state visible without importing accounts.',
      };
    case 'invalid':
      return {
        title: 'Credentials rejected',
        message:
          'The placeholder link was rejected. Review credentials in the real Plaid flow before retrying.',
      };
    case 'unavailable':
      return {
        title: 'Institution unavailable',
        message:
          'This institution is temporarily unavailable. Try again later or add an unlinked account manually.',
      };
    default:
      return {
        title: 'Ready to link',
        message:
          'This workspace does not include the Plaid native SDK yet, so the phase 4 flow simulates a secure import locally.',
      };
  }
}

export default function ConnectBankScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [selectedBank, setSelectedBank] = useState<BankInfo | null>(null);
  const [linkMode, setLinkMode] = useState<LinkMode>('success');
  const [processing, setProcessing] = useState(false);
  const [statusCard, setStatusCard] = useState<{
    tone: 'success' | 'warning' | 'danger';
    title: string;
    message: string;
  } | null>(null);
  const [successSummary, setSuccessSummary] = useState<{
    bankName: string;
    importedAccounts: string[];
  } | null>(null);

  const filteredBanks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return POPULAR_BANKS;
    }
    return POPULAR_BANKS.filter((bank) =>
      bank.name.toLowerCase().includes(query),
    );
  }, [search]);

  function handleFinishLink() {
    if (!selectedBank || processing) {
      return;
    }

    const modeCopy = statusCopy(linkMode);
    if (linkMode !== 'success') {
      setStatusCard({
        tone: linkMode === 'mfa' ? 'warning' : 'danger',
        title: modeCopy.title,
        message: modeCopy.message,
      });
      setSelectedBank(null);
      return;
    }

    setProcessing(true);

    try {
      const connectionId = uuid();
      const now = new Date().toISOString();
      const itemId = `plaid-${slugify(selectedBank.name)}-${Date.now()}`;
      const importedAccounts: string[] = [];

      db.transaction(() => {
        db.execute(
          `INSERT INTO bg_bank_connections
            (id, provider, provider_item_id, display_name, institution_id, institution_name, status, last_successful_sync, last_attempted_sync, created_at, updated_at)
           VALUES (?, 'plaid', ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
          [
            connectionId,
            itemId,
            `${selectedBank.name} placeholder link`,
            slugify(selectedBank.name),
            selectedBank.name,
            now,
            now,
            now,
            now,
          ],
        );

        db.execute(
          `INSERT INTO bg_bank_sync_state
            (connection_id, cursor, last_webhook_cursor, sync_status, last_successful_sync, last_attempted_sync, last_error, updated_at)
           VALUES (?, NULL, NULL, 'idle', ?, ?, NULL, ?)`,
          [connectionId, now, now, now],
        );

        selectedBank.accounts.forEach((template) => {
          const localAccountId = uuid();
          const bankAccountId = uuid();
          const accountName = `${selectedBank.name} ${template.label}`;

          createAccount(db, localAccountId, {
            currency: 'USD',
            current_balance: template.balance,
            name: accountName,
            type: template.type,
          });

          setBudgetAccountMeta(db, localAccountId, {
            includeInBudget: true,
            includeInNetWorth: true,
            institution: selectedBank.name,
            last4: template.last4,
            source: 'bank',
          });

          db.execute(
            `INSERT INTO bg_bank_accounts
              (id, connection_id, provider_account_id, mask, name, official_name, type, subtype, currency, current_balance, available_balance, local_account_id, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'USD', ?, ?, ?, 1, ?, ?)`,
            [
              bankAccountId,
              connectionId,
              `${itemId}-${slugify(template.label)}-${template.last4}`,
              template.last4,
              template.label,
              `${selectedBank.name} ${template.label}`,
              normalizeBankAccountType(template.type),
              template.balance,
              template.type === 'credit' || template.type === 'loan' || template.type === 'mortgage'
                ? null
                : template.balance,
              localAccountId,
              now,
              now,
            ],
          );

          importedAccounts.push(accountName);
        });
      });

      syncBudgetNetWorthSnapshot(db);
      setSuccessSummary({
        bankName: selectedBank.name,
        importedAccounts,
      });
      setStatusCard({
        tone: 'success',
        title: 'Accounts imported',
        message:
          'The placeholder import created linked accounts locally and seeded the sync state for the redesigned accounts surfaces.',
      });
      setSelectedBank(null);
    } catch (error) {
      setStatusCard({
        tone: 'danger',
        title: 'Link failed',
        message:
          error instanceof Error ? error.message : 'The placeholder import failed.',
      });
    } finally {
      setProcessing(false);
    }
  }

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
        <GlassCard style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <MaterialSymbol color={BG_ACCENT_LIGHT} name="account_balance" size={20} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>Connect Bank</Text>
              <Text style={styles.heroTitle}>Link your institution without leaving the redesigned budget shell.</Text>
              <Text style={styles.heroMeta}>
                Phase 4 uses a local Plaid placeholder so the full account-detail and sync states are wired before native credentials land.
              </Text>
            </View>
          </View>
        </GlassCard>

        <GlassCard style={styles.privacyCard}>
          <View style={styles.privacyIcon}>
            <MaterialSymbol color={BG_MONEY} name="verified_user" size={18} />
          </View>
          <View style={styles.privacyCopy}>
            <Text style={styles.privacyTitle}>Privacy-first sync</Text>
            <Text style={styles.privacySubtitle}>
              Credentials are never stored in the mobile shell. The real provider exchange stays server-side once the native Plaid SDK is added.
            </Text>
          </View>
        </GlassCard>

        {statusCard ? (
          <GlassCard
            style={[
              styles.statusCard,
              statusCard.tone === 'danger'
                ? styles.statusDanger
                : statusCard.tone === 'warning'
                  ? styles.statusWarning
                  : styles.statusSuccess,
            ]}
          >
            <Text style={styles.statusTitle}>{statusCard.title}</Text>
            <Text style={styles.statusMessage}>{statusCard.message}</Text>
          </GlassCard>
        ) : null}

        {successSummary ? (
          <GlassCard style={styles.successCard}>
            <Text style={styles.sectionLabel}>Last placeholder import</Text>
            <Text style={styles.successTitle}>{successSummary.bankName}</Text>
            <View style={styles.successList}>
              {successSummary.importedAccounts.map((accountName) => (
                <View key={accountName} style={styles.successRow}>
                  <MaterialSymbol color={BG_MONEY} name="check_circle" size={14} />
                  <Text style={styles.successRowLabel}>{accountName}</Text>
                </View>
              ))}
            </View>
            <View style={styles.actionRow}>
              <Pressable
                onPress={() => router.replace('/(budget)/accounts?refresh=1' as never)}
                style={styles.primaryAction}
              >
                <Text style={styles.primaryActionLabel}>View accounts</Text>
              </Pressable>
              <Pressable
                onPress={() => setSuccessSummary(null)}
                style={styles.secondaryAction}
              >
                <Text style={styles.secondaryActionLabel}>Clear</Text>
              </Pressable>
            </View>
          </GlassCard>
        ) : null}

        <View style={styles.searchShell}>
          <MaterialSymbol color={BG_TEXT_TERTIARY} name="search" size={18} />
          <TextInput
            onChangeText={setSearch}
            placeholder="Search institutions"
            placeholderTextColor={BG_TEXT_TERTIARY}
            style={styles.searchInput}
            value={search}
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Popular banks</Text>
          <Pressable onPress={() => router.push('/(budget)/account/create' as never)} style={styles.inlineAction}>
            <Text style={styles.inlineActionLabel}>Add unlinked account</Text>
            <MaterialSymbol color={BG_ACCENT_LIGHT} name="arrow_forward" size={16} />
          </Pressable>
        </View>

        <View style={styles.bankGrid}>
          {filteredBanks.map((bank) => (
            <Pressable
              key={bank.name}
              onPress={() => {
                setSelectedBank(bank);
                setLinkMode('success');
              }}
              style={[styles.bankCard, { backgroundColor: bank.accent }]}
            >
              <Text style={styles.bankName}>{bank.name}</Text>
              <Text style={styles.bankCopy}>{bank.copy}</Text>
            </Pressable>
          ))}
        </View>

        {filteredBanks.length === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No institutions found</Text>
            <Text style={styles.emptyCopy}>
              Try a broader search or add the account manually and reconcile it later.
            </Text>
          </GlassCard>
        ) : null}
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={() => setSelectedBank(null)}
        transparent
        visible={selectedBank != null}
      >
        <View style={styles.modalScrim}>
          <GlassCard style={styles.modalCard}>
            <Text style={styles.eyebrow}>Plaid placeholder</Text>
            <Text style={styles.modalTitle}>
              {selectedBank ? `Link ${selectedBank.name}` : 'Link bank'}
            </Text>
            <Text style={styles.modalBody}>
              {statusCopy(linkMode).message}
            </Text>

            <View style={styles.modeRow}>
              {([
                ['success', 'Success'],
                ['mfa', 'MFA'],
                ['invalid', 'Invalid'],
                ['unavailable', 'Unavailable'],
              ] as const).map(([modeValue, label]) => {
                const selected = linkMode === modeValue;
                return (
                  <Pressable
                    key={modeValue}
                    onPress={() => setLinkMode(modeValue)}
                    style={[
                      styles.modeChip,
                      selected ? styles.modeChipSelected : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modeChipLabel,
                        selected ? styles.modeChipLabelSelected : null,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {selectedBank ? (
              <GlassCard style={styles.previewCard}>
                <Text style={styles.sectionLabel}>Import preview</Text>
                {selectedBank.accounts.map((account) => (
                  <View key={`${selectedBank.name}-${account.label}`} style={styles.previewRow}>
                    <View style={styles.previewCopy}>
                      <Text style={styles.previewTitle}>{account.label}</Text>
                      <Text style={styles.previewMeta}>
                        {account.type} • ••{account.last4}
                      </Text>
                    </View>
                    <Text style={styles.previewBalance}>
                      {(account.balance / 100).toLocaleString('en-US', {
                        style: 'currency',
                        currency: 'USD',
                      })}
                    </Text>
                  </View>
                ))}
              </GlassCard>
            ) : null}

            <View style={styles.actionRow}>
              <Pressable
                onPress={() => setSelectedBank(null)}
                style={styles.secondaryAction}
              >
                <Text style={styles.secondaryActionLabel}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleFinishLink}
                style={[styles.primaryAction, processing ? styles.primaryActionDisabled : null]}
              >
                <Text style={styles.primaryActionLabel}>
                  {processing ? 'Linking...' : 'Continue'}
                </Text>
              </Pressable>
            </View>
          </GlassCard>
        </View>
      </Modal>
    </>
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
    gap: 14,
  },
  heroRow: {
    flexDirection: 'row',
    gap: 14,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.high,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
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
    fontFamily: BG_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  privacyCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  privacyIcon: {
    alignItems: 'center',
    backgroundColor: `${BG_MONEY}22`,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  privacyCopy: {
    flex: 1,
    gap: 4,
  },
  privacyTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  privacySubtitle: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  statusCard: {
    gap: 6,
  },
  statusSuccess: {
    backgroundColor: `${BG_MONEY}18`,
  },
  statusWarning: {
    backgroundColor: `${BG_ACCENT}18`,
  },
  statusDanger: {
    backgroundColor: `${BG_DANGER}18`,
  },
  statusTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  statusMessage: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  successCard: {
    gap: 14,
  },
  successTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 18,
    lineHeight: 24,
  },
  successList: {
    gap: 8,
  },
  successRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  successRowLabel: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  searchShell: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.low,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  searchInput: {
    color: BG_TEXT,
    flex: 1,
    fontFamily: BG_FONTS.medium,
    fontSize: 15,
    lineHeight: 20,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  sectionLabel: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
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
  bankGrid: {
    gap: 12,
  },
  bankCard: {
    borderRadius: 20,
    gap: 8,
    minHeight: 112,
    padding: 18,
  },
  bankName: {
    color: '#FFFFFF',
    fontFamily: BG_FONTS.bold,
    fontSize: 18,
    lineHeight: 24,
  },
  bankCopy: {
    color: 'rgba(255,255,255,0.88)',
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 17,
    maxWidth: '80%',
  },
  emptyCard: {
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  emptyCopy: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  modalScrim: {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    flex: 1,
    justifyContent: 'flex-end',
    padding: 20,
  },
  modalCard: {
    gap: 16,
    paddingBottom: 20,
  },
  modalTitle: {
    ...BG_TYPOGRAPHY.headlineMd,
    color: BG_TEXT,
  },
  modalBody: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modeChip: {
    backgroundColor: BG_SURFACES.low,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modeChipSelected: {
    backgroundColor: `${BG_ACCENT}22`,
  },
  modeChipLabel: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  modeChipLabelSelected: {
    color: BG_ACCENT_LIGHT,
  },
  previewCard: {
    backgroundColor: BG_SURFACES.low,
    gap: 12,
  },
  previewRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  previewCopy: {
    flex: 1,
    gap: 4,
  },
  previewTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  previewMeta: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  previewBalance: {
    color: BG_ACCENT_LIGHT,
    fontFamily: BG_FONTS.bold,
    fontSize: 13,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: BG_MONEY,
    borderRadius: 18,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  primaryActionDisabled: {
    opacity: 0.72,
  },
  primaryActionLabel: {
    color: BG_SURFACES.base,
    fontFamily: BG_FONTS.bold,
    fontSize: 14,
    lineHeight: 18,
  },
  secondaryAction: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.high,
    borderRadius: 18,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  secondaryActionLabel: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
});
