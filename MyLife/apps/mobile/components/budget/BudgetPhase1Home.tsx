import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import {
  AmountDisplay,
  BG_ACCENT,
  BG_ACCENT_LIGHT,
  BG_DANGER,
  BG_FONTS,
  BG_MONEY,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_MUTED,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  BG_TYPOGRAPHY,
  EnvelopeCard,
  GlassCard,
  GoalProgressRing,
  MaterialSymbol,
  SectionHeader,
  allocateToEnvelope,
  calculateMonthBudget,
  calculateSpendingPulse,
  calculateNetCash,
  checkAlerts,
  getActivityByEnvelope,
  getAlertHistoryByMonth,
  getAllocationMap,
  getBudgetAlerts,
  getCategoryGroups,
  getEnvelopesByGroup,
  getGoals,
  getTotalIncome,
  listEnvelopes,
  listTransactions,
  type AlertConfig,
  type AlertNotification,
  type BudgetGoal,
  type BudgetTransaction,
  type CategoryGroup,
  type Envelope,
  type EnvelopeSpendState,
  type SpendingPulse,
} from '@mylife/budget';
import { useDatabase } from '../../components/DatabaseProvider';

type EnvelopeRow = {
  envelope: Envelope;
  allocated: number;
  spent: number;
  activity: number;
  available: number;
};

type GroupSection = {
  id: string;
  name: string;
  envelopes: EnvelopeRow[];
  totalAllocated: number;
  totalSpent: number;
  totalAvailable: number;
  accent: string;
};

type AllocationTarget = {
  envelope: Envelope;
  allocated: number;
  spent: number;
};

type DonutSegment = {
  key: string;
  label: string;
  value: number;
  color: string;
};

const GROUP_ACCENTS = [
  BG_ACCENT_LIGHT,
  BG_MONEY,
  '#8BCFF0',
  '#A78BFA',
  '#F59E0B',
  '#F97316',
] as const;

function formatCurrency(cents: number, currencyCode = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function parseCurrencyToCents(value: string): number | null {
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

function formatMonthLabel(month: string): string {
  const [year, monthValue] = month.split('-').map(Number);
  return new Date(year, monthValue - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function shiftMonth(month: string, delta: number): string {
  const [year, monthValue] = month.split('-').map(Number);
  const date = new Date(year, monthValue - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthBounds(month: string): { from: string; to: string } {
  const [year, monthValue] = month.split('-').map(Number);
  const lastDay = new Date(year, monthValue, 0).getDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, '0')}`,
  };
}

function mergeActivityByEnvelope(
  transactions: BudgetTransaction[],
  splitActivity: Map<string, number>,
): Map<string, number> {
  const merged = new Map(splitActivity);

  for (const tx of transactions) {
    if (!tx.envelope_id || tx.direction === 'transfer') {
      continue;
    }

    const current = merged.get(tx.envelope_id) ?? 0;
    const signedAmount =
      tx.direction === 'outflow' ? -Math.abs(tx.amount) : Math.abs(tx.amount);
    merged.set(tx.envelope_id, current + signedAmount);
  }

  return merged;
}

function buildSections(
  db: ReturnType<typeof useDatabase>,
  envelopes: Envelope[],
  groups: CategoryGroup[],
  allocationMap: Map<string, number>,
  activityMap: Map<string, number>,
): GroupSection[] {
  const envelopeMap = new Map(envelopes.map((envelope) => [envelope.id, envelope]));
  const assigned = new Set<string>();
  const sections: GroupSection[] = [];

  groups.forEach((group, index) => {
    const rows: EnvelopeRow[] = [];
    const refs = getEnvelopesByGroup(db, group.id);

    refs.forEach((ref) => {
      const envelope = envelopeMap.get(ref.id);
      if (!envelope || envelope.archived === 1) {
        return;
      }

      assigned.add(envelope.id);
      const allocated = allocationMap.get(envelope.id) ?? envelope.monthly_budget;
      const activity = activityMap.get(envelope.id) ?? 0;
      const spent = Math.abs(Math.min(activity, 0));

      rows.push({
        envelope,
        allocated,
        spent,
        activity,
        available: allocated + activity,
      });
    });

    if (rows.length === 0) {
      return;
    }

    const totalAllocated = rows.reduce((sum, row) => sum + row.allocated, 0);
    const totalSpent = rows.reduce((sum, row) => sum + row.spent, 0);
    sections.push({
      id: group.id,
      name: group.name,
      envelopes: rows,
      totalAllocated,
      totalSpent,
      totalAvailable: rows.reduce((sum, row) => sum + row.available, 0),
      accent: GROUP_ACCENTS[index % GROUP_ACCENTS.length],
    });
  });

  const ungrouped = envelopes
    .filter((envelope) => envelope.archived === 0 && !assigned.has(envelope.id))
    .map((envelope) => {
      const allocated = allocationMap.get(envelope.id) ?? envelope.monthly_budget;
      const activity = activityMap.get(envelope.id) ?? 0;
      return {
        envelope,
        allocated,
        spent: Math.abs(Math.min(activity, 0)),
        activity,
        available: allocated + activity,
      };
    });

  if (ungrouped.length > 0) {
    sections.push({
      id: '__ungrouped__',
      name: 'Uncategorized',
      envelopes: ungrouped,
      totalAllocated: ungrouped.reduce((sum, row) => sum + row.allocated, 0),
      totalSpent: ungrouped.reduce((sum, row) => sum + row.spent, 0),
      totalAvailable: ungrouped.reduce((sum, row) => sum + row.available, 0),
      accent: BG_TEXT_MUTED,
    });
  }

  return sections;
}

function ButtonChip({
  icon,
  label,
  onPress,
  tone = 'surface',
}: {
  icon?: string;
  label: string;
  onPress: () => void;
  tone?: 'surface' | 'accent' | 'danger';
}) {
  const backgroundColor =
    tone === 'accent'
      ? `${BG_ACCENT}22`
      : tone === 'danger'
        ? `${BG_DANGER}22`
        : BG_SURFACES.high;
  const color = tone === 'danger' ? BG_DANGER : BG_TEXT_SECONDARY;

  return (
    <Pressable onPress={onPress} style={[styles.chip, { backgroundColor }]}>
      {icon ? <MaterialSymbol color={color} name={icon} size={14} /> : null}
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </Pressable>
  );
}

function BudgetDonut({
  segments,
  centerLabel,
  centerValue,
}: {
  segments: DonutSegment[];
  centerLabel: string;
  centerValue: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const size = 180;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <View style={styles.donutShell}>
      <Svg height={size} width={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="transparent"
          r={radius}
          stroke={BG_SURFACES.high}
          strokeWidth={strokeWidth}
        />
        {segments.map((segment) => {
          const length = total > 0 ? (segment.value / total) * circumference : 0;
          const dashOffset = circumference - offset;
          offset += length;
          return (
            <Circle
              key={segment.key}
              cx={size / 2}
              cy={size / 2}
              fill="transparent"
              r={radius}
              stroke={segment.color}
              strokeDasharray={`${Math.max(length, 0)} ${circumference}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              strokeWidth={strokeWidth}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
        })}
      </Svg>
      <View style={styles.donutCenter}>
        <Text style={styles.donutCenterLabel}>{centerLabel}</Text>
        <Text style={styles.donutCenterValue}>{centerValue}</Text>
      </View>
    </View>
  );
}

function SummaryCard({
  label,
  value,
  subtitle,
  tone,
}: {
  label: string;
  value: number;
  subtitle: string;
  tone: 'income' | 'expense' | 'neutral';
}) {
  return (
    <GlassCard style={styles.summaryCard}>
      <Text style={styles.eyebrow}>{label}</Text>
      <AmountDisplay cents={value} size="lg" type={tone} />
      <Text style={styles.summarySubtitle}>{subtitle}</Text>
    </GlassCard>
  );
}

export default function BudgetPhase1Home() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ refresh?: string }>();

  const [month, setMonth] = useState(getCurrentMonth);
  const [sections, setSections] = useState<GroupSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [totalIncome, setTotalIncome] = useState(0);
  const [readyToBudget, setReadyToBudget] = useState(0);
  const [netCash, setNetCash] = useState(0);
  const [pulse, setPulse] = useState<SpendingPulse | null>(null);
  const [activeAlerts, setActiveAlerts] = useState<AlertNotification[]>([]);
  const [topGoal, setTopGoal] = useState<BudgetGoal | null>(null);
  const [allocationTarget, setAllocationTarget] = useState<AllocationTarget | null>(null);
  const [allocationInput, setAllocationInput] = useState('');
  const [autoFilling, setAutoFilling] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    try {
      const range = getMonthBounds(month);
      const lastMonth = shiftMonth(month, -1);
      const lastRange = getMonthBounds(lastMonth);
      const envelopes = listEnvelopes(db, false);
      const groups = getCategoryGroups(db, false);
      const allocationMap = getAllocationMap(db, month);
      const monthTransactions = listTransactions(db, {
        from_date: range.from,
        limit: 500,
        to_date: range.to,
      });
      const lastTransactions = listTransactions(db, {
        from_date: lastRange.from,
        limit: 500,
        to_date: lastRange.to,
      });
      const splitActivity = getActivityByEnvelope(db, month);
      const activityMap = mergeActivityByEnvelope(monthTransactions, splitActivity);
      const nextSections = buildSections(
        db,
        envelopes,
        groups,
        allocationMap,
        activityMap,
      );
      const income = getTotalIncome(db, month);

      const monthBudget = calculateMonthBudget({
        groups: nextSections.map((section) => ({
          categories: section.envelopes.map((row) => ({
            activity: row.activity,
            allocated: row.allocated,
            carryForward: 0,
            categoryId: row.envelope.id,
            name: row.envelope.name,
          })),
          groupId: section.id,
          name: section.name,
        })),
        month,
        totalIncome: income,
      });

      const netCashResult = calculateNetCash(
        monthTransactions.map((tx) => ({
          amount:
            tx.direction === 'outflow'
              ? -Math.abs(tx.amount)
              : Math.abs(tx.amount),
          date: tx.occurred_on,
          isTransfer: tx.direction === 'transfer',
        })),
      );

      const spentThisMonth = monthTransactions
        .filter((tx) => tx.direction === 'outflow')
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
      const spentLastMonth = lastTransactions
        .filter((tx) => tx.direction === 'outflow')
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
      const totalBudgetCents = nextSections.reduce(
        (sum, section) => sum + section.totalAllocated,
        0,
      );

      const alertConfigs = getBudgetAlerts(db);
      const alertHistory = getAlertHistoryByMonth(db, month);
      const envelopeStates: EnvelopeSpendState[] = nextSections
        .flatMap((section) => section.envelopes)
        .map((row) => ({
          envelopeId: row.envelope.id,
          name: row.envelope.name,
          spent: row.spent,
          targetAmount: row.allocated,
        }));
      const engineConfigs: AlertConfig[] = alertConfigs.map((alert) => ({
        envelopeId: alert.envelope_id,
        id: alert.id,
        isEnabled: alert.is_enabled === 1,
        thresholdPct: alert.threshold_pct,
      }));

      setSections(nextSections);
      setTotalIncome(income);
      setReadyToBudget(monthBudget.readyToAssign - monthBudget.overspent);
      setNetCash(netCashResult.netCash);
      setPulse(
        calculateSpendingPulse({
          spentLastMonthCents: spentLastMonth > 0 ? spentLastMonth : null,
          spentThisMonthCents: spentThisMonth,
          today: new Date().toISOString().slice(0, 10),
          totalBudgetCents,
        }),
      );
      setActiveAlerts(
        checkAlerts(
          engineConfigs,
          envelopeStates,
          alertHistory.map((entry) => ({
            alertId: entry.alert_id,
            amountSpent: entry.amount_spent,
            envelopeId: entry.envelope_id,
            month: entry.month,
            notifiedAt: entry.notified_at,
            spentPct: entry.spent_pct,
            targetAmount: entry.target_amount,
            thresholdPct: entry.threshold_pct,
          })),
          month,
        ),
      );
      setTopGoal(
        getGoals(db)
          .filter((goal) => goal.is_completed === 0)
          .sort((left, right) => {
            const leftDate = left.target_date ?? '9999-12-31';
            const rightDate = right.target_date ?? '9999-12-31';
            return leftDate.localeCompare(rightDate);
          })[0] ?? null,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the budget plan.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, month]);

  useEffect(() => {
    load();
  }, [load, params.refresh]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const toggleSection = useCallback((sectionId: string) => {
    setCollapsed((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }));
  }, []);

  const donutSegments = useMemo<DonutSegment[]>(
    () =>
      sections
        .filter((section) => section.totalAllocated > 0)
        .map((section) => ({
          color: section.accent,
          key: section.id,
          label: section.name,
          value: section.totalAllocated,
        })),
    [sections],
  );

  const topGoalProgress = useMemo(() => {
    if (!topGoal || topGoal.target_amount <= 0) {
      return 0;
    }
    return Math.min(topGoal.completed_amount, topGoal.target_amount);
  }, [topGoal]);

  const openAllocationSheet = useCallback((target: AllocationTarget) => {
    setAllocationTarget(target);
    setAllocationInput((target.allocated / 100).toFixed(2));
  }, []);

  const closeAllocationSheet = useCallback(() => {
    setAllocationTarget(null);
    setAllocationInput('');
  }, []);

  const handleSaveAllocation = useCallback(() => {
    if (!allocationTarget) {
      return;
    }

    const cents = parseCurrencyToCents(allocationInput);
    if (cents == null || cents < 0) {
      Alert.alert('Invalid amount', 'Enter a valid allocation amount.');
      return;
    }

    try {
      allocateToEnvelope(db, allocationTarget.envelope.id, month, cents);
      closeAllocationSheet();
      load();
    } catch (err) {
      Alert.alert(
        'Unable to update allocation',
        err instanceof Error ? err.message : 'Please try again.',
      );
    }
  }, [allocationInput, allocationTarget, closeAllocationSheet, db, load, month]);

  const handleAutoFill = useCallback(() => {
    if (autoFilling) {
      return;
    }

    const remaining = readyToBudget;
    if (remaining <= 0) {
      Alert.alert('Nothing to assign', 'Ready to Budget is already fully assigned.');
      return;
    }

    const deficits = sections
      .flatMap((section) => section.envelopes)
      .map((row) => ({
        current: row.allocated,
        deficit: Math.max(row.envelope.monthly_budget - row.allocated, 0),
        envelopeId: row.envelope.id,
        name: row.envelope.name,
      }))
      .filter((row) => row.deficit > 0);

    if (deficits.length === 0) {
      Alert.alert(
        'No underfunded categories',
        'Every envelope is already at or above its monthly target.',
      );
      return;
    }

    setAutoFilling(true);

    try {
      let remainingToAssign = remaining;
      db.transaction(() => {
        deficits.forEach((row) => {
          if (remainingToAssign <= 0) {
            return;
          }
          const add = Math.min(row.deficit, remainingToAssign);
          if (add <= 0) {
            return;
          }
          allocateToEnvelope(db, row.envelopeId, month, row.current + add);
          remainingToAssign -= add;
        });
      });
      load();
    } catch (err) {
      Alert.alert(
        'Auto-fill failed',
        err instanceof Error ? err.message : 'Please try again.',
      );
      setAutoFilling(false);
    }
  }, [autoFilling, db, load, month, readyToBudget, sections]);

  useEffect(() => {
    if (!loading) {
      setAutoFilling(false);
    }
  }, [loading]);

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            colors={[BG_ACCENT]}
            onRefresh={onRefresh}
            refreshing={refreshing}
            tintColor={BG_ACCENT}
          />
        }
        style={styles.container}
      >
        <View style={styles.monthRow}>
          <Pressable
            onPress={() => setMonth((current) => shiftMonth(current, -1))}
            style={styles.monthButton}
          >
            <MaterialSymbol color={BG_TEXT} name="arrow_downward" size={16} />
          </Pressable>
          <Pressable onPress={() => setMonth(getCurrentMonth())} style={styles.monthLabelWrap}>
            <Text style={styles.monthLabel}>{formatMonthLabel(month)}</Text>
            <Text style={styles.monthLabelHint}>Tap to jump back to current month</Text>
          </Pressable>
          <Pressable
            onPress={() => setMonth((current) => shiftMonth(current, 1))}
            style={styles.monthButton}
          >
            <MaterialSymbol color={BG_TEXT} name="arrow_upward" size={16} />
          </Pressable>
        </View>

        {error ? (
          <GlassCard style={styles.errorCard}>
            <Text style={styles.errorTitle}>Budget plan unavailable</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <ButtonChip icon="repeat" label="Try Again" onPress={load} tone="danger" />
          </GlassCard>
        ) : null}

        <GlassCard style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>Ready to Budget</Text>
              <Text style={styles.heroTitle}>Assign this month’s cash with intent.</Text>
            </View>
            <ButtonChip
              icon="tune"
              label={autoFilling ? 'Filling…' : 'Auto-fill'}
              onPress={handleAutoFill}
              tone="accent"
            />
          </View>

          {loading ? (
            <Text style={styles.loadingCopy}>Calculating month plan…</Text>
          ) : (
            <>
              <AmountDisplay
                cents={readyToBudget}
                size="xl"
                type={readyToBudget >= 0 ? 'income' : 'expense'}
              />
              <Text style={styles.heroSubtitle}>
                {sections.reduce((sum, section) => sum + section.envelopes.length, 0)} envelopes •{' '}
                {formatCurrency(totalIncome)} income this month
              </Text>
            </>
          )}
        </GlassCard>

        <View style={styles.summaryGrid}>
          <SummaryCard
            label="Net Cash"
            subtitle={netCash >= 0 ? 'Positive cash flow' : 'More out than in'}
            tone={netCash >= 0 ? 'income' : 'expense'}
            value={netCash}
          />
          <SummaryCard
            label="Income"
            subtitle="Tracked inflows for this month"
            tone="income"
            value={totalIncome}
          />
        </View>

        {pulse ? (
          <GlassCard style={styles.microCard}>
            <View style={styles.inlineRow}>
              <View style={styles.inlineIcon}>
                <MaterialSymbol color={BG_MONEY} name="trending_up" size={18} />
              </View>
              <View style={styles.inlineCopy}>
                <Text style={styles.inlineTitle}>Spending Pulse</Text>
                <Text style={styles.inlineBody}>{pulse.summary}</Text>
              </View>
              <Text style={styles.inlineMeta}>
                {formatCurrency(pulse.safeDailySpendCents)}/day
              </Text>
            </View>
          </GlassCard>
        ) : null}

        {activeAlerts.length > 0 ? (
          <GlassCard style={styles.microCard}>
            <View style={styles.inlineRow}>
              <View style={[styles.inlineIcon, { backgroundColor: `${BG_DANGER}22` }]}>
                <MaterialSymbol color={BG_DANGER} name="warning" size={18} />
              </View>
              <View style={styles.inlineCopy}>
                <Text style={styles.inlineTitle}>Budget alerts</Text>
                <Text style={styles.inlineBody}>
                  {activeAlerts[0].envelopeName}: {activeAlerts[0].spentPct}% spent
                  {activeAlerts.length > 1 ? ` • +${activeAlerts.length - 1} more` : ''}
                </Text>
              </View>
              <ButtonChip
                icon="notifications"
                label="Alerts"
                onPress={() => router.push('/(budget)/alerts')}
              />
            </View>
          </GlassCard>
        ) : null}

        <GlassCard style={styles.donutCard}>
          <SectionHeader
            action={
              <Text style={styles.sectionMeta}>
                {formatCurrency(
                  sections.reduce((sum, section) => sum + section.totalAllocated, 0),
                )}
              </Text>
            }
            title="Allocation Distribution"
          />
          {donutSegments.length === 0 ? (
            <Text style={styles.emptyCopy}>Add envelopes to visualize your budget mix.</Text>
          ) : (
            <View style={styles.donutLayout}>
              <BudgetDonut
                centerLabel="Assigned"
                centerValue={formatCurrency(
                  sections.reduce((sum, section) => sum + section.totalAllocated, 0),
                )}
                segments={donutSegments}
              />
              <View style={styles.legendColumn}>
                {donutSegments.slice(0, 5).map((segment) => (
                  <View key={segment.key} style={styles.legendRow}>
                    <View
                      style={[styles.legendDot, { backgroundColor: segment.color }]}
                    />
                    <View style={styles.legendCopy}>
                      <Text numberOfLines={1} style={styles.legendLabel}>
                        {segment.label}
                      </Text>
                      <Text style={styles.legendValue}>
                        {formatCurrency(segment.value)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </GlassCard>

        {sections.map((section) => {
          const isCollapsed = collapsed[section.id] === true;

          return (
            <GlassCard key={section.id} style={styles.groupCard}>
              <Pressable onPress={() => toggleSection(section.id)} style={styles.groupHeader}>
                <SectionHeader
                  action={
                    <View style={styles.groupHeaderMeta}>
                      <Text style={styles.groupValue}>
                        {formatCurrency(section.totalAvailable)}
                      </Text>
                      <MaterialSymbol
                        color={BG_TEXT_TERTIARY}
                        name={isCollapsed ? 'arrow_forward' : 'arrow_downward'}
                        size={16}
                      />
                    </View>
                  }
                  title={section.name}
                />
              </Pressable>

              {!isCollapsed ? (
                <View style={styles.groupBody}>
                  {section.envelopes.map((row) => (
                    <EnvelopeCard
                      allocated={row.allocated}
                      envelope={row.envelope}
                      key={row.envelope.id}
                      onLongPress={() =>
                        openAllocationSheet({
                          allocated: row.allocated,
                          envelope: row.envelope,
                          spent: row.spent,
                        })
                      }
                      onPress={() => router.push(`/(budget)/${row.envelope.id}`)}
                      spent={row.spent}
                    />
                  ))}

                  <Pressable
                    onPress={() => router.push('/(budget)/create')}
                    style={styles.addEnvelopeRow}
                  >
                    <MaterialSymbol color={BG_ACCENT_LIGHT} name="add" size={16} />
                    <Text style={styles.addEnvelopeLabel}>Add Envelope</Text>
                  </Pressable>
                </View>
              ) : null}
            </GlassCard>
          );
        })}

        <GlassCard style={styles.goalCard}>
          <Pressable
            onPress={() => router.push('/(budget)/goals')}
            style={styles.goalCardBody}
          >
            <View style={styles.goalCopy}>
              <Text style={styles.eyebrow}>Goals</Text>
              <Text style={styles.goalTitle}>
                {topGoal ? topGoal.name : 'Open your savings plan'}
              </Text>
              <Text style={styles.goalSubtitle}>
                {topGoal
                  ? `${formatCurrency(topGoal.completed_amount)} saved of ${formatCurrency(topGoal.target_amount)}`
                  : 'Track bigger priorities without leaving your budget.'}
              </Text>
            </View>
            {topGoal ? (
              <GoalProgressRing
                colorByStatus={
                  topGoal.completed_amount >= topGoal.target_amount
                    ? 'ahead'
                    : topGoal.target_date
                      ? 'on_track'
                      : 'behind'
                }
                current={topGoalProgress}
                size={92}
                target={topGoal.target_amount}
              />
            ) : (
              <View style={styles.goalPlaceholder}>
                <MaterialSymbol color={BG_ACCENT_LIGHT} name="flag" size={20} />
              </View>
            )}
          </Pressable>
        </GlassCard>
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={closeAllocationSheet}
        transparent
        visible={allocationTarget != null}
      >
        <View style={styles.modalScrim}>
          <GlassCard style={styles.modalCard}>
            <Text style={styles.modalEyebrow}>Adjust Allocation</Text>
            <Text style={styles.modalTitle}>
              {allocationTarget?.envelope.name ?? 'Envelope'}
            </Text>
            <Text style={styles.modalHint}>
              Current spent: {formatCurrency(allocationTarget?.spent ?? 0)}
            </Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Allocated this month</Text>
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={setAllocationInput}
                placeholder="0.00"
                placeholderTextColor={BG_TEXT_TERTIARY}
                style={styles.input}
                value={allocationInput}
              />
            </View>

            <View style={styles.modalActions}>
              <ButtonChip icon="close" label="Cancel" onPress={closeAllocationSheet} />
              <ButtonChip
                icon="check_circle"
                label="Save Allocation"
                onPress={handleSaveAllocation}
                tone="accent"
              />
            </View>
          </GlassCard>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_SURFACES.lowest,
  },
  content: {
    paddingBottom: 128,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 16,
  },
  monthRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  monthButton: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.high,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  monthLabelWrap: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  monthLabel: {
    ...BG_TYPOGRAPHY.headlineMd,
    color: BG_TEXT,
  },
  monthLabelHint: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
  },
  heroCard: {
    gap: 16,
    padding: 20,
  },
  heroHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  eyebrow: {
    ...BG_TYPOGRAPHY.labelUpper,
    color: BG_ACCENT_LIGHT,
  },
  heroTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 22,
    lineHeight: 28,
  },
  heroSubtitle: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    gap: 10,
    minHeight: 136,
  },
  summarySubtitle: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  microCard: {
    paddingVertical: 14,
  },
  inlineRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  inlineIcon: {
    alignItems: 'center',
    backgroundColor: `${BG_MONEY}22`,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  inlineCopy: {
    flex: 1,
    gap: 2,
  },
  inlineTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  inlineBody: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  inlineMeta: {
    color: BG_ACCENT_LIGHT,
    fontFamily: BG_FONTS.bold,
    fontSize: 12,
    lineHeight: 16,
  },
  donutCard: {
    gap: 16,
  },
  sectionMeta: {
    color: BG_ACCENT_LIGHT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 16,
  },
  donutLayout: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
  },
  donutShell: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  donutCenter: {
    alignItems: 'center',
    gap: 4,
    position: 'absolute',
  },
  donutCenterLabel: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  donutCenterValue: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    textAlign: 'center',
  },
  legendColumn: {
    flex: 1,
    gap: 10,
  },
  legendRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  legendDot: {
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  legendCopy: {
    flex: 1,
    gap: 2,
  },
  legendLabel: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 16,
  },
  legendValue: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  groupCard: {
    gap: 0,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  groupHeader: {
    paddingBottom: 4,
  },
  groupHeaderMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  groupValue: {
    color: BG_ACCENT_LIGHT,
    fontFamily: BG_FONTS.bold,
    fontSize: 13,
    lineHeight: 16,
  },
  groupBody: {
    gap: 12,
    paddingTop: 12,
  },
  addEnvelopeRow: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.high,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
  },
  addEnvelopeLabel: {
    color: BG_ACCENT_LIGHT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 16,
  },
  goalCard: {
    padding: 18,
  },
  goalCardBody: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
  },
  goalCopy: {
    flex: 1,
    gap: 6,
  },
  goalTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 20,
    lineHeight: 24,
  },
  goalSubtitle: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  goalPlaceholder: {
    alignItems: 'center',
    backgroundColor: `${BG_ACCENT}22`,
    borderRadius: 46,
    height: 92,
    justifyContent: 'center',
    width: 92,
  },
  chip: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    fontFamily: BG_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  errorCard: {
    gap: 10,
  },
  errorTitle: {
    color: BG_DANGER,
    fontFamily: BG_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
  },
  errorMessage: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  loadingCopy: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyCopy: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  modalScrim: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    flex: 1,
    justifyContent: 'flex-end',
    padding: 20,
  },
  modalCard: {
    gap: 16,
    marginBottom: 96,
  },
  modalEyebrow: {
    ...BG_TYPOGRAPHY.labelUpper,
    color: BG_ACCENT_LIGHT,
  },
  modalTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 22,
    lineHeight: 28,
  },
  modalHint: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  input: {
    backgroundColor: BG_SURFACES.high,
    borderRadius: 16,
    color: BG_TEXT,
    fontFamily: BG_FONTS.medium,
    fontSize: 18,
    lineHeight: 22,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
});
