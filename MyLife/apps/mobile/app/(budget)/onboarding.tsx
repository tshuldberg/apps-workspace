import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import {
  BG_ACCENT,
  BG_ACCENT_LIGHT,
  BG_FONTS,
  BG_MONEY,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_MUTED,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  GlassCard,
  MaterialSymbol,
  createAccount,
  createCategoryGroup,
  createEnvelope,
  createGoal,
  getCategoryGroups,
  getGoals,
  getSetting,
  listAccounts,
  listEnvelopes,
  setEnvelopeGroup,
  setSetting,
  type Account,
  type CategoryGroup,
} from '@mylife/budget';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

type StepId = 'welcome' | 'accounts' | 'envelopes' | 'income' | 'notifications' | 'done';

type AccountDraft = {
  key: string;
  type: Account['type'];
  title: string;
  icon: string;
  enabled: boolean;
  name: string;
  balance: string;
};

type EnvelopeGroupDraft = {
  id: string;
  icon: string;
  name: string;
  description: string;
  enabled: boolean;
  defaults: string[];
};

type CustomEnvelopeDraft = {
  id: string;
  groupId: string;
  name: string;
};

const STEPS: Array<{ id: StepId; label: string }> = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'envelopes', label: 'Envelopes' },
  { id: 'income', label: 'Income' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'done', label: 'Done' },
];

const DEFAULT_ACCOUNTS: AccountDraft[] = [
  {
    balance: '',
    enabled: true,
    icon: 'account_balance',
    key: 'checking',
    name: 'Checking',
    title: 'Checking',
    type: 'checking',
  },
  {
    balance: '',
    enabled: false,
    icon: 'savings',
    key: 'savings',
    name: 'Savings',
    title: 'Savings',
    type: 'savings',
  },
  {
    balance: '',
    enabled: false,
    icon: 'credit_card',
    key: 'credit',
    name: 'Credit Card',
    title: 'Credit',
    type: 'credit',
  },
];

const DEFAULT_GROUPS: EnvelopeGroupDraft[] = [
  {
    defaults: ['Rent', 'Groceries', 'Utilities', 'Transportation'],
    description: 'Essentials and obligations that keep the month stable.',
    enabled: true,
    icon: 'account_balance_wallet',
    id: 'needs',
    name: 'Needs',
  },
  {
    defaults: ['Dining Out', 'Fun Money', 'Shopping'],
    description: 'Lifestyle spending you want to control without guilt.',
    enabled: true,
    icon: 'local_atm',
    id: 'wants',
    name: 'Wants',
  },
  {
    defaults: ['Emergency Fund', 'Travel', 'Annual Fees'],
    description: 'Buffers, true expenses, and future plans.',
    enabled: true,
    icon: 'savings',
    id: 'savings',
    name: 'Savings',
  },
  {
    defaults: ['Credit Card Payment', 'Loan Payment'],
    description: 'Debt payoff envelopes and minimum payment planning.',
    enabled: true,
    icon: 'payments',
    id: 'debts',
    name: 'Debts',
  },
];

function toCents(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.round(parsed * 100);
}

function getGroupColor(groupId: string): string {
  switch (groupId) {
    case 'needs':
      return BG_ACCENT_LIGHT;
    case 'wants':
      return '#8BCFF0';
    case 'savings':
      return BG_MONEY;
    case 'debts':
      return '#FFB4AB';
    default:
      return BG_TEXT_MUTED;
  }
}

export default function BudgetOnboardingScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountDrafts, setAccountDrafts] = useState<AccountDraft[]>(DEFAULT_ACCOUNTS);
  const [groupDrafts, setGroupDrafts] = useState<EnvelopeGroupDraft[]>(DEFAULT_GROUPS);
  const [customEnvelopes, setCustomEnvelopes] = useState<CustomEnvelopeDraft[]>([]);
  const [customEnvelopeName, setCustomEnvelopeName] = useState('');
  const [customEnvelopeGroupId, setCustomEnvelopeGroupId] = useState<string>('needs');
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [payFrequency, setPayFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('monthly');
  const [nextPayDate, setNextPayDate] = useState('');
  const [notifyAlerts, setNotifyAlerts] = useState(true);
  const [notifyDigest, setNotifyDigest] = useState(true);
  const [notifyReminders, setNotifyReminders] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<string>('unknown');
  const [checkingRedirect, setCheckingRedirect] = useState(true);
  const transition = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    try {
      const complete = getSetting(db, 'onboarding_complete');
      if (complete === 'true') {
        router.replace('/(budget)/' as never);
        return;
      }
    } catch {
      // keep onboarding open if settings are unavailable
    } finally {
      setCheckingRedirect(false);
    }
  }, [db, router]);

  const animateToStep = useCallback((nextIndex: number) => {
    Animated.timing(transition, {
      duration: 120,
      toValue: 0,
      useNativeDriver: true,
    }).start(() => {
      setStepIndex(nextIndex);
      transition.setValue(0);
      Animated.timing(transition, {
        duration: 180,
        toValue: 1,
        useNativeDriver: true,
      }).start();
    });
  }, [transition]);

  const persistAccounts = useCallback(() => {
    const existingAccounts = listAccounts(db, false);
    accountDrafts
      .filter((draft) => draft.enabled)
      .forEach((draft) => {
        const exists = existingAccounts.some(
          (account) =>
            account.type === draft.type &&
            account.name.trim().toLowerCase() === draft.name.trim().toLowerCase(),
        );
        if (!exists) {
          createAccount(db, uuid(), {
            current_balance: toCents(draft.balance),
            name: draft.name.trim() || draft.title,
            type: draft.type,
          });
        }
      });

    setSetting(db, 'onboarding_accounts', JSON.stringify(accountDrafts));
  }, [accountDrafts, db]);

  const persistEnvelopes = useCallback(() => {
    const existingGroups = getCategoryGroups(db);
    const existingEnvelopes = listEnvelopes(db, false);

    groupDrafts
      .filter((group) => group.enabled)
      .forEach((groupDraft) => {
        let group = existingGroups.find(
          (item) => item.name.trim().toLowerCase() === groupDraft.name.trim().toLowerCase(),
        );

        if (!group) {
          group = createCategoryGroup(db, uuid(), { name: groupDraft.name }) as CategoryGroup;
        }

        const names = [
          ...groupDraft.defaults,
          ...customEnvelopes
            .filter((item) => item.groupId === groupDraft.id)
            .map((item) => item.name),
        ];

        names.forEach((name) => {
          const trimmed = name.trim();
          if (!trimmed) {
            return;
          }

          const existingEnvelope = existingEnvelopes.find(
            (envelope) => envelope.name.trim().toLowerCase() === trimmed.toLowerCase(),
          );
          const envelope = existingEnvelope ?? createEnvelope(db, uuid(), {
            icon: groupDraft.id === 'debts' ? '💳' : groupDraft.id === 'savings' ? '💚' : '💰',
            monthly_budget: 0,
            name: trimmed,
          });

          setEnvelopeGroup(db, envelope.id, group.id);
        });
      });

    setSetting(
      db,
      'onboarding_envelopes',
      JSON.stringify({
        customEnvelopes,
        groups: groupDrafts,
      }),
    );
  }, [customEnvelopes, db, groupDrafts]);

  const persistIncome = useCallback(() => {
    setSetting(db, 'monthly_income', monthlyIncome.trim());
    setSetting(db, 'pay_frequency', payFrequency);
    setSetting(db, 'next_pay_date', nextPayDate.trim());

    const incomeTarget = toCents(monthlyIncome);
    if (incomeTarget > 0) {
      const existingGoals = getGoals(db);
      const existingGoal = existingGoals.find(
        (goal) => goal.name.trim().toLowerCase() === 'income buffer',
      );
      if (!existingGoal) {
        const anchorEnvelope =
          listEnvelopes(db, false).find((envelope) => envelope.name === 'Emergency Fund') ??
          listEnvelopes(db, false)[0];
        if (anchorEnvelope) {
          createGoal(db, uuid(), {
            completed_amount: 0,
            envelope_id: anchorEnvelope.id,
            name: 'Income Buffer',
            target_amount: incomeTarget,
          });
        }
      }
    }
  }, [db, monthlyIncome, nextPayDate, payFrequency]);

  const requestNotificationPermission = useCallback(async () => {
    const permission = await Notifications.requestPermissionsAsync();
    setPermissionStatus(permission.status);
    return permission.status;
  }, []);

  const persistNotifications = useCallback(async () => {
    let status = permissionStatus;
    if ((notifyAlerts || notifyDigest || notifyReminders) && status === 'unknown') {
      status = await requestNotificationPermission();
    }

    setSetting(db, 'notifications_permission', status);
    setSetting(db, 'notifications_alerts', notifyAlerts ? 'true' : 'false');
    setSetting(db, 'notifications_digest', notifyDigest ? 'true' : 'false');
    setSetting(db, 'notifications_reminders', notifyReminders ? 'true' : 'false');
  }, [
    db,
    notifyAlerts,
    notifyDigest,
    notifyReminders,
    permissionStatus,
    requestNotificationPermission,
  ]);

  const handleAddCustomEnvelope = () => {
    const trimmed = customEnvelopeName.trim();
    if (!trimmed) {
      return;
    }

    setCustomEnvelopes((current) => [
      ...current,
      {
        groupId: customEnvelopeGroupId,
        id: uuid(),
        name: trimmed,
      },
    ]);
    setCustomEnvelopeName('');
  };

  const handleNext = useCallback(async () => {
    if (saving) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const currentStep = STEPS[stepIndex]?.id;
      if (currentStep === 'accounts') {
        persistAccounts();
      }
      if (currentStep === 'envelopes') {
        persistEnvelopes();
      }
      if (currentStep === 'income') {
        persistIncome();
      }
      if (currentStep === 'notifications') {
        await persistNotifications();
      }
      if (currentStep === 'done') {
        setSetting(db, 'onboarding_complete', 'true');
        router.replace('/(budget)/' as never);
        return;
      }

      animateToStep(Math.min(stepIndex + 1, STEPS.length - 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save onboarding step.');
    } finally {
      setSaving(false);
    }
  }, [
    animateToStep,
    db,
    persistAccounts,
    persistEnvelopes,
    persistIncome,
    persistNotifications,
    router,
    saving,
    stepIndex,
  ]);

  const handleBack = () => {
    if (stepIndex === 0) {
      return;
    }
    animateToStep(stepIndex - 1);
  };

  const currentStep = STEPS[stepIndex]?.id;
  const activeGroups = groupDrafts.filter((group) => group.enabled);
  const totalEnvelopeCount = activeGroups.reduce((count, group) => {
    return (
      count +
      group.defaults.length +
      customEnvelopes.filter((item) => item.groupId === group.id).length
    );
  }, 0);

  if (checkingRedirect) {
    return (
      <View style={styles.loadingState}>
        <MaterialSymbol color={BG_ACCENT_LIGHT} name="flag" size={22} />
        <Text style={styles.loadingCopy}>Preparing onboarding…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          {stepIndex > 0 ? (
            <Pressable onPress={handleBack} style={styles.backButton}>
              <MaterialSymbol color={BG_TEXT} name="arrow_forward" size={18} />
            </Pressable>
          ) : (
            <View style={styles.backButtonSpacer} />
          )}
          <View>
            <Text style={styles.stepLabel}>Step {stepIndex + 1} of {STEPS.length}</Text>
            <Text style={styles.stepTitle}>{STEPS[stepIndex]?.label}</Text>
          </View>
        </View>
        <View style={styles.dotsRow}>
          {STEPS.map((step, index) => (
            <View
              key={step.id}
              style={[
                styles.dot,
                index === stepIndex ? styles.dotActive : null,
                index < stepIndex ? styles.dotComplete : null,
              ]}
            />
          ))}
        </View>
      </View>

      <Animated.ScrollView
        contentContainerStyle={styles.content}
        style={{
          opacity: transition,
          transform: [
            {
              translateY: transition.interpolate({
                inputRange: [0, 1],
                outputRange: [14, 0],
              }),
            },
          ],
        }}
      >
        {currentStep === 'welcome' ? (
          <>
            <GlassCard style={styles.heroCard}>
              <View style={styles.logoBadge}>
                <MaterialSymbol color={BG_ACCENT_LIGHT} name="account_balance_wallet" size={28} />
              </View>
              <Text style={styles.heroTitle}>Know where every dollar went</Text>
              <Text style={styles.heroSubtitle}>
                MyBudget helps you build a plan around the cash you actually have, then keeps every
                transaction connected back to that plan.
              </Text>
              <View style={styles.featureStack}>
                <FeatureRow icon="check_circle" text="Envelope budgeting without spreadsheet friction" />
                <FeatureRow icon="repeat" text="Recurring subscriptions and reminders in one view" />
                <FeatureRow icon="pie_chart" text="Reports that explain where your budget is drifting" />
              </View>
            </GlassCard>
            <Pressable onPress={handleNext} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Get Started</Text>
              <MaterialSymbol color={BG_SURFACES.lowest} name="arrow_forward" size={18} />
            </Pressable>
          </>
        ) : null}

        {currentStep === 'accounts' ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEyebrow}>Accounts</Text>
              <Text style={styles.sectionTitle}>Add your accounts</Text>
              <Text style={styles.sectionCopy}>
                Start with checking, then include savings or credit if you want the opening budget to
                reflect those balances.
              </Text>
            </View>

            <View style={styles.stack}>
              {accountDrafts.map((draft) => (
                <GlassCard key={draft.key} style={styles.accountCard}>
                  <View style={styles.accountHeader}>
                    <View style={styles.accountIdentity}>
                      <View style={styles.iconBadge}>
                        <MaterialSymbol color={BG_ACCENT_LIGHT} name={draft.icon} size={18} />
                      </View>
                      <View>
                        <Text style={styles.accountTitle}>{draft.title}</Text>
                        <Text style={styles.accountHint}>{draft.type}</Text>
                      </View>
                    </View>
                    <Pressable
                      onPress={() =>
                        setAccountDrafts((current) =>
                          current.map((item) =>
                            item.key === draft.key ? { ...item, enabled: !item.enabled } : item,
                          ),
                        )
                      }
                      style={[styles.togglePill, draft.enabled ? styles.togglePillActive : null]}
                    >
                      <Text style={[styles.togglePillText, draft.enabled ? styles.togglePillTextActive : null]}>
                        {draft.enabled ? 'Included' : 'Skip'}
                      </Text>
                    </Pressable>
                  </View>
                  {draft.enabled ? (
                    <View style={styles.formStack}>
                      <TextInput
                        onChangeText={(value) =>
                          setAccountDrafts((current) =>
                            current.map((item) =>
                              item.key === draft.key ? { ...item, name: value } : item,
                            ),
                          )
                        }
                        placeholder="Account name"
                        placeholderTextColor={BG_TEXT_TERTIARY}
                        style={styles.textInput}
                        value={draft.name}
                      />
                      <TextInput
                        keyboardType="decimal-pad"
                        onChangeText={(value) =>
                          setAccountDrafts((current) =>
                            current.map((item) =>
                              item.key === draft.key ? { ...item, balance: value } : item,
                            ),
                          )
                        }
                        placeholder="Starting balance"
                        placeholderTextColor={BG_TEXT_TERTIARY}
                        style={styles.textInput}
                        value={draft.balance}
                      />
                    </View>
                  ) : null}
                </GlassCard>
              ))}
            </View>

            <GlassCard style={styles.inlineCard}>
              <Text style={styles.inlineTitle}>Want to connect a bank instead?</Text>
              <Text style={styles.inlineCopy}>
                You can start manual and connect later, or jump to the Plaid connection flow now.
              </Text>
              <Pressable
                onPress={() => router.push('/(budget)/connect-bank' as never)}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Connect Bank</Text>
              </Pressable>
            </GlassCard>
          </>
        ) : null}

        {currentStep === 'envelopes' ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEyebrow}>Envelopes</Text>
              <Text style={styles.sectionTitle}>Categorize your spending</Text>
              <Text style={styles.sectionCopy}>
                Start with four proven buckets, then add a few custom envelopes that match your life.
              </Text>
            </View>

            <View style={styles.stack}>
              {groupDrafts.map((group) => {
                const tone = getGroupColor(group.id);
                const customCount = customEnvelopes.filter((item) => item.groupId === group.id).length;
                return (
                  <GlassCard key={group.id} style={styles.groupCard}>
                    <View style={styles.groupHeader}>
                      <View style={styles.accountIdentity}>
                        <View style={[styles.iconBadge, { backgroundColor: `${tone}22` }]}>
                          <MaterialSymbol color={tone} name={group.icon} size={18} />
                        </View>
                        <View style={styles.groupCopy}>
                          <Text style={styles.accountTitle}>{group.name}</Text>
                          <Text style={styles.groupHint}>
                            {group.description}
                          </Text>
                        </View>
                      </View>
                      <Pressable
                        onPress={() =>
                          setGroupDrafts((current) =>
                            current.map((item) =>
                              item.id === group.id ? { ...item, enabled: !item.enabled } : item,
                            ),
                          )
                        }
                        style={[styles.togglePill, group.enabled ? styles.togglePillActive : null]}
                      >
                        <Text style={[styles.togglePillText, group.enabled ? styles.togglePillTextActive : null]}>
                          {group.enabled ? 'On' : 'Off'}
                        </Text>
                      </Pressable>
                    </View>

                    {group.enabled ? (
                      <View style={styles.wrapRow}>
                        {group.defaults.map((name) => (
                          <View key={name} style={styles.nameChip}>
                            <Text style={styles.nameChipText}>{name}</Text>
                          </View>
                        ))}
                        {customEnvelopes
                          .filter((item) => item.groupId === group.id)
                          .map((item) => (
                            <View key={item.id} style={[styles.nameChip, styles.customNameChip]}>
                              <Text style={styles.nameChipText}>{item.name}</Text>
                            </View>
                          ))}
                        <Text style={styles.groupFootnote}>{customCount} custom</Text>
                      </View>
                    ) : null}
                  </GlassCard>
                );
              })}
            </View>

            <GlassCard style={styles.inlineCard}>
              <Text style={styles.inlineTitle}>Add custom envelopes</Text>
              <View style={styles.wrapRow}>
                {groupDrafts.map((group) => (
                  <Pressable
                    key={group.id}
                    onPress={() => setCustomEnvelopeGroupId(group.id)}
                    style={[
                      styles.chip,
                      customEnvelopeGroupId === group.id ? styles.chipActive : null,
                    ]}
                  >
                    <Text style={[styles.chipText, customEnvelopeGroupId === group.id ? styles.chipTextActive : null]}>
                      {group.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                onChangeText={setCustomEnvelopeName}
                placeholder="Add a custom envelope"
                placeholderTextColor={BG_TEXT_TERTIARY}
                style={styles.textInput}
                value={customEnvelopeName}
              />
              <Pressable onPress={handleAddCustomEnvelope} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Add Envelope</Text>
              </Pressable>
            </GlassCard>
          </>
        ) : null}

        {currentStep === 'income' ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEyebrow}>Income</Text>
              <Text style={styles.sectionTitle}>How much do you earn?</Text>
              <Text style={styles.sectionCopy}>
                This is optional, but it helps MyBudget estimate safe pacing and payday timing.
              </Text>
            </View>

            <GlassCard style={styles.inlineCard}>
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={setMonthlyIncome}
                placeholder="Monthly income"
                placeholderTextColor={BG_TEXT_TERTIARY}
                style={styles.textInput}
                value={monthlyIncome}
              />
              <View style={styles.wrapRow}>
                {(['weekly', 'biweekly', 'monthly'] as const).map((frequency) => (
                  <Pressable
                    key={frequency}
                    onPress={() => setPayFrequency(frequency)}
                    style={[styles.chip, payFrequency === frequency ? styles.chipActive : null]}
                  >
                    <Text style={[styles.chipText, payFrequency === frequency ? styles.chipTextActive : null]}>
                      {frequency}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                onChangeText={setNextPayDate}
                placeholder="Next pay date (YYYY-MM-DD)"
                placeholderTextColor={BG_TEXT_TERTIARY}
                style={styles.textInput}
                value={nextPayDate}
              />
            </GlassCard>
          </>
        ) : null}

        {currentStep === 'notifications' ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEyebrow}>Notifications</Text>
              <Text style={styles.sectionTitle}>Stay informed</Text>
              <Text style={styles.sectionCopy}>
                Choose the reminders that help you stay on plan without turning the app into noise.
              </Text>
            </View>

            <GlassCard style={styles.inlineCard}>
              <Text style={styles.inlineTitle}>Permission status</Text>
              <Text style={styles.inlineCopy}>
                {permissionStatus === 'unknown'
                  ? 'Permission not requested yet.'
                  : `Notifications are currently ${permissionStatus}.`}
              </Text>
              <Pressable onPress={requestNotificationPermission} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Request Permission</Text>
              </Pressable>
            </GlassCard>

            <View style={styles.stack}>
              <ToggleRow
                description="Budget threshold alerts and overspending warnings."
                enabled={notifyAlerts}
                label="Alerts"
                onPress={() => setNotifyAlerts((current) => !current)}
              />
              <ToggleRow
                description="Weekly digest and planning reminders."
                enabled={notifyDigest}
                label="Digest"
                onPress={() => setNotifyDigest((current) => !current)}
              />
              <ToggleRow
                description="Upcoming bills, subscription renewals, and paydays."
                enabled={notifyReminders}
                label="Reminders"
                onPress={() => setNotifyReminders((current) => !current)}
              />
            </View>
          </>
        ) : null}

        {currentStep === 'done' ? (
          <>
            <GlassCard style={styles.doneCard}>
              <View style={styles.doneBadge}>
                <MaterialSymbol color={BG_MONEY} name="check_circle" size={24} />
              </View>
              <Text style={styles.doneTitle}>You&apos;re all set</Text>
              <Text style={styles.doneSubtitle}>
                Your first budget structure is ready. You can fine-tune envelopes, add transactions,
                and connect accounts from the main budget tabs.
              </Text>
              <View style={styles.doneStats}>
                <SummaryStat label="Accounts" value={String(accountDrafts.filter((draft) => draft.enabled).length)} />
                <SummaryStat label="Groups" value={String(activeGroups.length)} />
                <SummaryStat label="Envelopes" value={String(totalEnvelopeCount)} />
              </View>
            </GlassCard>
          </>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </Animated.ScrollView>

      {currentStep !== 'welcome' ? (
        <View style={styles.footer}>
          <Pressable onPress={handleBack} style={styles.footerSecondary}>
            <Text style={styles.footerSecondaryText}>Back</Text>
          </Pressable>

          {currentStep === 'accounts' || currentStep === 'income' || currentStep === 'notifications' ? (
            <Pressable onPress={handleNext} style={styles.footerGhost}>
              <Text style={styles.footerGhostText}>Skip for now</Text>
            </Pressable>
          ) : null}

          <Pressable onPress={handleNext} style={styles.footerPrimary}>
            <Text style={styles.footerPrimaryText}>
              {saving
                ? 'Saving…'
                : currentStep === 'done'
                  ? 'Continue to Budget'
                  : 'Next'}
            </Text>
            <MaterialSymbol color={BG_SURFACES.lowest} name="arrow_forward" size={18} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function FeatureRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.featureRow}>
      <View style={styles.featureIcon}>
        <MaterialSymbol color={BG_ACCENT_LIGHT} name={icon} size={16} />
      </View>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

function ToggleRow({
  description,
  enabled,
  label,
  onPress,
}: {
  description: string;
  enabled: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <GlassCard style={styles.toggleCard}>
      <View style={styles.toggleHeader}>
        <View style={styles.toggleCopy}>
          <Text style={styles.accountTitle}>{label}</Text>
          <Text style={styles.groupHint}>{description}</Text>
        </View>
        <Pressable onPress={onPress} style={[styles.togglePill, enabled ? styles.togglePillActive : null]}>
          <Text style={[styles.togglePillText, enabled ? styles.togglePillTextActive : null]}>
            {enabled ? 'On' : 'Off'}
          </Text>
        </Pressable>
      </View>
    </GlassCard>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryStat}>
      <Text style={styles.summaryStatValue}>{value}</Text>
      <Text style={styles.summaryStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: BG_SURFACES.base,
    flex: 1,
  },
  loadingState: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.base,
    flex: 1,
    gap: 10,
    justifyContent: 'center',
  },
  loadingCopy: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 14,
    lineHeight: 18,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  topBarLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.low,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    transform: [{ rotate: '180deg' }],
    width: 36,
  },
  backButtonSpacer: {
    width: 36,
  },
  stepLabel: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
  },
  stepTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    backgroundColor: BG_SURFACES.high,
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  dotActive: {
    backgroundColor: BG_ACCENT_LIGHT,
    width: 26,
  },
  dotComplete: {
    backgroundColor: BG_MONEY,
  },
  content: {
    gap: 18,
    paddingBottom: 140,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  heroCard: {
    gap: 16,
    marginTop: 6,
  },
  logoBadge: {
    alignItems: 'center',
    backgroundColor: `${BG_ACCENT}22`,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  heroTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.extraBold,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.8,
  },
  heroSubtitle: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  featureStack: {
    gap: 10,
  },
  featureRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  featureIcon: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.low,
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  featureText: {
    color: BG_TEXT,
    flex: 1,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 17,
  },
  sectionHeader: {
    gap: 6,
  },
  sectionEyebrow: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 22,
    lineHeight: 26,
  },
  sectionCopy: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  stack: {
    gap: 12,
  },
  accountCard: {
    gap: 12,
  },
  accountHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  accountIdentity: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  iconBadge: {
    alignItems: 'center',
    backgroundColor: `${BG_ACCENT}16`,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  accountTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 15,
    lineHeight: 18,
  },
  accountHint: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  formStack: {
    gap: 10,
  },
  textInput: {
    backgroundColor: BG_SURFACES.low,
    borderRadius: 16,
    color: BG_TEXT,
    fontFamily: BG_FONTS.medium,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  togglePill: {
    backgroundColor: BG_SURFACES.high,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  togglePillActive: {
    backgroundColor: `${BG_MONEY}22`,
  },
  togglePillText: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  togglePillTextActive: {
    color: BG_MONEY,
  },
  inlineCard: {
    gap: 12,
  },
  inlineTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
  },
  inlineCopy: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  secondaryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: BG_SURFACES.high,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: BG_ACCENT_LIGHT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 16,
  },
  primaryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: BG_ACCENT_LIGHT,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  primaryButtonText: {
    color: BG_SURFACES.lowest,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  groupCard: {
    gap: 12,
  },
  groupHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  groupCopy: {
    maxWidth: 220,
  },
  groupHint: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  nameChip: {
    backgroundColor: BG_SURFACES.low,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  customNameChip: {
    backgroundColor: `${BG_ACCENT}18`,
  },
  nameChipText: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  groupFootnote: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    paddingVertical: 8,
  },
  chip: {
    backgroundColor: BG_SURFACES.high,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipActive: {
    backgroundColor: `${BG_ACCENT}22`,
  },
  chipText: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  chipTextActive: {
    color: BG_ACCENT_LIGHT,
  },
  toggleCard: {
    gap: 8,
  },
  toggleHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  toggleCopy: {
    flex: 1,
    gap: 4,
    paddingRight: 12,
  },
  doneCard: {
    gap: 16,
  },
  doneBadge: {
    alignItems: 'center',
    backgroundColor: `${BG_MONEY}18`,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  doneTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.extraBold,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.7,
  },
  doneSubtitle: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  doneStats: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryStat: {
    backgroundColor: BG_SURFACES.low,
    borderRadius: 18,
    flex: 1,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  summaryStatValue: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
  },
  summaryStatLabel: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
  },
  errorText: {
    color: '#FFB4AB',
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    backgroundColor: 'rgba(19, 19, 24, 0.86)',
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: 14,
    position: 'absolute',
    width: '100%',
  },
  footerSecondary: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.high,
    borderRadius: 999,
    justifyContent: 'center',
    minWidth: 72,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  footerSecondaryText: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 16,
  },
  footerGhost: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 88,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  footerGhostText: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  footerPrimary: {
    alignItems: 'center',
    backgroundColor: BG_ACCENT_LIGHT,
    borderRadius: 999,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  footerPrimaryText: {
    color: BG_SURFACES.lowest,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
});
