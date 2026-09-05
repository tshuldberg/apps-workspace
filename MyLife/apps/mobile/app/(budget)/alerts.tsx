import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  BG_FONTS,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  GlassCard,
  checkAlerts,
  createBudgetAlert,
  deleteBudgetAlert,
  getActivityByEnvelope,
  getAlertHistoryByMonth,
  getBudgetAlerts,
  getSetting,
  listEnvelopes,
  listTransactions,
  setSetting,
  updateBudgetAlert,
  type AlertConfig,
  type AlertHistory,
  type AlertNotification,
  type BudgetAlert,
  type BudgetTransaction,
  type Envelope,
  type EnvelopeSpendState,
} from '@mylife/budget';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  BudgetActionButton,
  BudgetBottomSheet,
  BudgetChip,
  BudgetEmptyState,
  BudgetPhaseHeader,
  BudgetPhaseScreen,
  BudgetSection,
  BudgetSegmentedControl,
} from '../../components/budget/BudgetPhase5Kit';
import { uuid } from '../../lib/uuid';

type ViewMode = 'active' | 'history';
type AlertRuleType = 'envelope_over' | 'spending_exceeds' | 'balance_below' | 'recurring_missed' | 'unusual_transaction';
type AlertChannel = 'push' | 'email' | 'both';
type AlertMetaMap = Record<string, { channel: AlertChannel }>;

const ALERT_META_KEY = 'budget_phase5_alert_meta';
const RULE_TYPES: Array<{ label: string; supported: boolean; value: AlertRuleType }> = [
  { label: 'Envelope Over', supported: true, value: 'envelope_over' },
  { label: 'Spending Exceeds', supported: false, value: 'spending_exceeds' },
  { label: 'Balance Below', supported: false, value: 'balance_below' },
  { label: 'Recurring Missed', supported: false, value: 'recurring_missed' },
  { label: 'Unusual Transaction', supported: false, value: 'unusual_transaction' },
];

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDateTime(isoDate: string): string {
  return new Date(isoDate).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function parseThreshold(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 10 || parsed > 200) {
    return null;
  }
  return Math.round(parsed);
}

function loadMeta(raw: string | null): AlertMetaMap {
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as AlertMetaMap;
  } catch {
    return {};
  }
}

function buildEnvelopeStates(
  envelopes: Envelope[],
  splitActivity: Map<string, number>,
  transactions: BudgetTransaction[],
): EnvelopeSpendState[] {
  const activityMap = new Map(splitActivity);

  transactions.forEach((transaction) => {
    if (!transaction.envelope_id || transaction.direction === 'transfer') {
      return;
    }

    const current = activityMap.get(transaction.envelope_id) ?? 0;
    const signedAmount =
      transaction.direction === 'outflow'
        ? -Math.abs(transaction.amount)
        : Math.abs(transaction.amount);
    activityMap.set(transaction.envelope_id, current + signedAmount);
  });

  return envelopes.map((envelope) => {
    const activity = activityMap.get(envelope.id) ?? 0;
    return {
      envelopeId: envelope.id,
      name: envelope.name,
      spent: Math.abs(Math.min(activity, 0)),
      targetAmount: envelope.monthly_budget,
    };
  });
}

export default function AlertsScreen() {
  const db = useDatabase();

  const [mode, setMode] = useState<ViewMode>('active');
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const [history, setHistory] = useState<AlertHistory[]>([]);
  const [metaMap, setMetaMap] = useState<AlertMetaMap>({});
  const [previewMap, setPreviewMap] = useState<Map<string, AlertNotification>>(new Map());
  const [envelopeStates, setEnvelopeStates] = useState<Map<string, EnvelopeSpendState>>(new Map());
  const [refreshing, setRefreshing] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);
  const [draftRuleType, setDraftRuleType] = useState<AlertRuleType>('envelope_over');
  const [draftEnvelopeId, setDraftEnvelopeId] = useState<string | null>(null);
  const [draftThreshold, setDraftThreshold] = useState('80');
  const [draftChannel, setDraftChannel] = useState<AlertChannel>('both');

  const load = useCallback(() => {
    try {
      const nextEnvelopes = listEnvelopes(db, false).filter((envelope) => envelope.archived === 0);
      const nextAlerts = getBudgetAlerts(db);
      const nextHistory = getAlertHistoryByMonth(db, currentMonth());
      const monthTransactions = listTransactions(db, {
        from_date: `${currentMonth()}-01`,
        limit: 1000,
        to_date: `${currentMonth()}-31`,
      });
      const states = buildEnvelopeStates(
        nextEnvelopes,
        getActivityByEnvelope(db, currentMonth()),
        monthTransactions,
      );
      const preview = checkAlerts(
        nextAlerts.map<AlertConfig>((alertRule) => ({
          envelopeId: alertRule.envelope_id,
          id: alertRule.id,
          isEnabled: alertRule.is_enabled === 1,
          thresholdPct: alertRule.threshold_pct,
        })),
        states,
        nextHistory.map((entry) => ({
          alertId: entry.alert_id,
          amountSpent: entry.amount_spent,
          envelopeId: entry.envelope_id,
          month: entry.month,
          notifiedAt: entry.notified_at,
          spentPct: entry.spent_pct,
          targetAmount: entry.target_amount,
          thresholdPct: entry.threshold_pct,
        })),
        currentMonth(),
      );

      setEnvelopes(nextEnvelopes);
      setAlerts(nextAlerts);
      setHistory(nextHistory);
      setMetaMap(loadMeta(getSetting(db, ALERT_META_KEY)));
      setPreviewMap(new Map(preview.map((entry) => [entry.alertId, entry])));
      setEnvelopeStates(new Map(states.map((state) => [state.envelopeId, state])));
    } finally {
      setRefreshing(false);
    }
  }, [db]);

  useEffect(() => {
    load();
  }, [load]);

  const persistMetaMap = useCallback(
    (nextMap: AlertMetaMap) => {
      setSetting(db, ALERT_META_KEY, JSON.stringify(nextMap));
      setMetaMap(nextMap);
    },
    [db],
  );

  const openCreateSheet = useCallback(() => {
    setEditingAlertId(null);
    setDraftRuleType('envelope_over');
    setDraftEnvelopeId(envelopes[0]?.id ?? null);
    setDraftThreshold('80');
    setDraftChannel('both');
    setSheetVisible(true);
  }, [envelopes]);

  const openEditSheet = useCallback(
    (alertRule: BudgetAlert) => {
      setEditingAlertId(alertRule.id);
      setDraftRuleType('envelope_over');
      setDraftEnvelopeId(alertRule.envelope_id);
      setDraftThreshold(String(alertRule.threshold_pct));
      setDraftChannel(metaMap[alertRule.id]?.channel ?? 'both');
      setSheetVisible(true);
    },
    [metaMap],
  );

  const handleSave = useCallback(() => {
    const threshold = parseThreshold(draftThreshold);
    if (draftRuleType !== 'envelope_over') {
      Alert.alert(
        'Rule type not yet supported',
        'Phase 5 ships a redesigned alerts surface on top of the existing envelope-threshold engine. The other rule types still need backend support.',
      );
      return;
    }
    if (!draftEnvelopeId || threshold === null) {
      Alert.alert('Complete the rule', 'Pick an envelope and choose a threshold between 10% and 200%.');
      return;
    }

    try {
      if (editingAlertId) {
        updateBudgetAlert(db, editingAlertId, { threshold_pct: threshold });
        persistMetaMap({
          ...metaMap,
          [editingAlertId]: { channel: draftChannel },
        });
      } else {
        const newId = uuid();
        createBudgetAlert(db, newId, {
          envelope_id: draftEnvelopeId,
          threshold_pct: threshold,
        });
        persistMetaMap({
          ...metaMap,
          [newId]: { channel: draftChannel },
        });
      }

      setSheetVisible(false);
      load();
    } catch (saveError) {
      Alert.alert(
        'Unable to save alert',
        saveError instanceof Error ? saveError.message : 'Try again in a moment.',
      );
    }
  }, [
    db,
    draftChannel,
    draftEnvelopeId,
    draftRuleType,
    draftThreshold,
    editingAlertId,
    load,
    metaMap,
    persistMetaMap,
  ]);

  const handleToggle = useCallback(
    (alertId: string, enabled: boolean) => {
      try {
        updateBudgetAlert(db, alertId, { is_enabled: enabled ? 1 : 0 });
        load();
      } catch (toggleError) {
        Alert.alert(
          'Unable to update alert',
          toggleError instanceof Error ? toggleError.message : 'Try again in a moment.',
        );
      }
    },
    [db, load],
  );

  const handleDelete = useCallback(
    (alertId: string) => {
      Alert.alert('Delete this alert?', 'This removes the rule and its phase-5 channel metadata.', [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              deleteBudgetAlert(db, alertId);
              const nextMetaMap = { ...metaMap };
              delete nextMetaMap[alertId];
              persistMetaMap(nextMetaMap);
              load();
            } catch (deleteError) {
              Alert.alert(
                'Unable to delete alert',
                deleteError instanceof Error ? deleteError.message : 'Try again in a moment.',
              );
            }
          },
        },
      ]);
    },
    [db, load, metaMap, persistMetaMap],
  );

  const sheetPreview = useMemo(() => {
    const threshold = parseThreshold(draftThreshold);
    if (!draftEnvelopeId || threshold === null) {
      return null;
    }

    const state = envelopeStates.get(draftEnvelopeId);
    if (!state || state.targetAmount <= 0) {
      return null;
    }

    const spentPct = Math.round((state.spent / state.targetAmount) * 100);
    return {
      spentPct,
      willFire: spentPct >= threshold,
    };
  }, [draftEnvelopeId, draftThreshold, envelopeStates]);

  const refreshControl = (
    <RefreshControl
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
      refreshing={refreshing}
      tintColor={BG_TEXT}
    />
  );

  return (
    <>
      <BudgetPhaseScreen refreshControl={refreshControl}>
        <BudgetPhaseHeader
          action={
            <BudgetActionButton
              icon="add_alert"
              label="New Rule"
              onPress={openCreateSheet}
              tone="gold"
            />
          }
          eyebrow="Alerts"
          eyebrowIcon="notifications_active"
          subtitle="The current backend supports envelope threshold rules. Phase 5 adds the management surface, previews, and channel metadata around that live data."
          title="Alerts"
        />

        <BudgetSegmentedControl
          onChange={(nextValue) => setMode(nextValue as ViewMode)}
          options={[
            { label: 'Active Rules', value: 'active' },
            { label: 'History', value: 'history' },
          ]}
          value={mode}
        />

        {mode === 'active' ? (
          <BudgetSection
            subtitle={`${alerts.length} rule${alerts.length === 1 ? '' : 's'} currently configured`}
            title="Live rules"
          >
            {alerts.length > 0 ? (
              <View style={styles.listColumn}>
                {alerts.map((alertRule) => {
                  const envelope = envelopes.find((item) => item.id === alertRule.envelope_id);
                  const state = envelopeStates.get(alertRule.envelope_id);
                  const preview = previewMap.get(alertRule.id);
                  return (
                    <GlassCard key={alertRule.id} padding={18}>
                      <View style={styles.ruleHeader}>
                        <View style={styles.ruleCopy}>
                          <Text style={styles.ruleTitle}>{envelope?.name ?? 'Unknown envelope'}</Text>
                          <Text style={styles.ruleMeta}>
                            Warn at {alertRule.threshold_pct}% · {metaMap[alertRule.id]?.channel ?? 'both'}
                          </Text>
                        </View>
                        <BudgetChip
                          active={alertRule.is_enabled === 1}
                          label={alertRule.is_enabled === 1 ? 'On' : 'Off'}
                          onPress={() => handleToggle(alertRule.id, alertRule.is_enabled !== 1)}
                          tone={alertRule.is_enabled === 1 ? 'money' : 'danger'}
                        />
                      </View>
                      <Text style={styles.ruleStatus}>
                        {state
                          ? `${state.targetAmount > 0 ? Math.round((state.spent / state.targetAmount) * 100) : 0}% spent of ${formatCurrency(state.targetAmount)}`
                          : 'No spending state yet'}
                      </Text>
                      <Text style={[styles.ruleStatus, preview ? styles.ruleStatusDanger : styles.ruleStatusNeutral]}>
                        {preview
                          ? `${preview.message}`
                          : 'Preview: the threshold is not currently firing.'}
                      </Text>
                      <View style={styles.ruleActions}>
                        <BudgetActionButton
                          icon="edit"
                          label="Edit"
                          onPress={() => openEditSheet(alertRule)}
                          quiet
                          tone="gold"
                        />
                        <BudgetActionButton
                          icon="delete"
                          label="Delete"
                          onPress={() => handleDelete(alertRule.id)}
                          quiet
                          tone="danger"
                        />
                      </View>
                    </GlassCard>
                  );
                })}
              </View>
            ) : (
              <BudgetEmptyState
                icon="notifications"
                message="Add your first envelope threshold to get proactive overspend warnings."
                title="No alerts configured"
              />
            )}
          </BudgetSection>
        ) : (
          <BudgetSection
            subtitle={`${currentMonth()} event log`}
            title="Recent fires"
          >
            {history.length > 0 ? (
              <View style={styles.listColumn}>
                {history.map((entry) => {
                  const envelope = envelopes.find((item) => item.id === entry.envelope_id);
                  return (
                    <GlassCard key={entry.id} padding={18}>
                      <View style={styles.historyHeader}>
                        <View style={styles.ruleCopy}>
                          <Text style={styles.ruleTitle}>{envelope?.name ?? 'Unknown envelope'}</Text>
                          <Text style={styles.ruleMeta}>
                            {entry.spent_pct}% spent against a {entry.threshold_pct}% rule
                          </Text>
                        </View>
                        <Text style={styles.historyStamp}>{formatDateTime(entry.notified_at)}</Text>
                      </View>
                      <Text style={styles.ruleStatus}>
                        {formatCurrency(entry.amount_spent)} spent of {formatCurrency(entry.target_amount)}
                      </Text>
                    </GlassCard>
                  );
                })}
              </View>
            ) : (
              <BudgetEmptyState
                icon="schedule"
                message="Once a threshold fires, the event log for this month will appear here."
                title="Quiet month"
              />
            )}
          </BudgetSection>
        )}
      </BudgetPhaseScreen>

      <BudgetBottomSheet
        footer={
          <View style={styles.sheetActions}>
            <BudgetActionButton
              icon="save"
              label={editingAlertId ? 'Update Rule' : 'Save Rule'}
              onPress={handleSave}
              tone="money"
            />
          </View>
        }
        onClose={() => setSheetVisible(false)}
        subtitle="Only Envelope Over is wired to the current schema. The other options stay visible so Phase 5 mirrors the intended roadmap without pretending they persist today."
        title={editingAlertId ? 'Edit alert rule' : 'New alert rule'}
        visible={sheetVisible}
      >
        <View style={styles.sheetSection}>
          <Text style={styles.sheetLabel}>Rule type</Text>
          <View style={styles.chipWrap}>
            {RULE_TYPES.map((ruleType) => (
              <BudgetChip
                active={draftRuleType === ruleType.value}
                disabled={!ruleType.supported}
                key={ruleType.value}
                label={ruleType.label}
                onPress={() => setDraftRuleType(ruleType.value)}
                tone={ruleType.supported ? 'gold' : 'neutral'}
              />
            ))}
          </View>
        </View>

        <View style={styles.sheetSection}>
          <Text style={styles.sheetLabel}>Envelope</Text>
          <View style={styles.chipWrap}>
            {envelopes.map((envelope) => (
              <BudgetChip
                active={draftEnvelopeId === envelope.id}
                key={envelope.id}
                label={envelope.name}
                onPress={() => setDraftEnvelopeId(envelope.id)}
                tone="money"
              />
            ))}
          </View>
        </View>

        <View style={styles.sheetSection}>
          <Text style={styles.sheetLabel}>Threshold percentage</Text>
          <TextInput
            keyboardType="number-pad"
            onChangeText={setDraftThreshold}
            placeholder="80"
            placeholderTextColor={BG_TEXT_TERTIARY}
            style={styles.input}
            value={draftThreshold}
          />
        </View>

        <View style={styles.sheetSection}>
          <Text style={styles.sheetLabel}>Notification channel</Text>
          <View style={styles.chipWrap}>
            {(['push', 'email', 'both'] as AlertChannel[]).map((channel) => (
              <BudgetChip
                active={draftChannel === channel}
                key={channel}
                label={channel}
                onPress={() => setDraftChannel(channel)}
                tone="info"
              />
            ))}
          </View>
        </View>

        {sheetPreview ? (
          <GlassCard padding={16}>
            <Text style={styles.sheetLabel}>Preview</Text>
            <Text style={styles.previewText}>
              Current spend is {sheetPreview.spentPct}% of budget. This rule would {sheetPreview.willFire ? '' : 'not '}fire right now.
            </Text>
          </GlassCard>
        ) : null}
      </BudgetBottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  listColumn: {
    gap: 10,
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  ruleCopy: {
    flex: 1,
    gap: 4,
  },
  ruleTitle: {
    fontFamily: BG_FONTS.bold,
    fontSize: 15,
    lineHeight: 20,
    color: BG_TEXT,
  },
  ruleMeta: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 18,
    color: BG_TEXT_SECONDARY,
  },
  ruleStatus: {
    marginTop: 10,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 18,
    color: BG_TEXT_SECONDARY,
  },
  ruleStatusDanger: {
    color: '#FCA5A5',
  },
  ruleStatusNeutral: {
    color: BG_TEXT_TERTIARY,
  },
  ruleActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  historyStamp: {
    fontFamily: BG_FONTS.semiBold,
    fontSize: 11,
    lineHeight: 16,
    color: BG_TEXT_TERTIARY,
  },
  sheetSection: {
    gap: 10,
  },
  sheetLabel: {
    fontFamily: BG_FONTS.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: BG_TEXT_TERTIARY,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  input: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: BG_TEXT,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: BG_FONTS.medium,
    fontSize: 15,
    lineHeight: 20,
  },
  previewText: {
    marginTop: 8,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 20,
    color: BG_TEXT_SECONDARY,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
  },
});
