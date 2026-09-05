import { useCallback, useMemo, useState } from 'react';
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
import * as ExpoLinking from 'expo-linking';
import { useFocusEffect } from 'expo-router';
import {
  calculateBurnRate,
  getActiveMedications,
  getDaysRemaining,
  getLowSupplyAlerts,
  getRefillHistory,
  recordRefill,
  type Medication,
  type Refill,
} from '@mylife/meds';
import {
  GlassCard,
  MaterialSymbol,
  MD_ACCENT,
  MD_ACCENT_LIGHT,
  MD_CYAN_GLOW_STYLE,
  MD_FONTS,
  MD_PILL_RADIUS,
  MD_SURFACES,
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TEXT_TERTIARY,
  MD_TYPOGRAPHY,
  withAlpha,
} from '@mylife/meds/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { getRefillStatusMeta } from '../../lib/meds/phase2';
import { uuid } from '../../lib/uuid';

type RefillCardModel = {
  medication: Medication;
  burnRate: number;
  daysRemaining: number | null;
  history: Refill[];
  status: ReturnType<typeof getRefillStatusMeta>;
};

function formatDateLabel(value?: string | null): string {
  if (!value) {
    return 'TBD';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
}

function formatDueDate(daysRemaining: number | null): string {
  if (daysRemaining === null) {
    return 'Set a fill quantity';
  }
  if (!Number.isFinite(daysRemaining)) {
    return 'As needed';
  }

  const due = new Date();
  due.setDate(due.getDate() + daysRemaining);
  return due.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function parsePhoneNumber(source?: string | null): string | null {
  if (!source) {
    return null;
  }

  const digits = source.replace(/[^\d+]/g, '');
  return digits.length >= 7 ? digits : null;
}

export default function RefillsScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const [selected, setSelected] = useState<RefillCardModel | null>(null);
  const [refillQuantity, setRefillQuantity] = useState('30');
  const [refillNotes, setRefillNotes] = useState('');
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(() => {
    setTick((value) => value + 1);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const medications = useMemo(() => {
    try {
      return getActiveMedications(db);
    } catch {
      return [];
    }
  }, [db, tick]);

  const alerting = useMemo(() => {
    try {
      return getLowSupplyAlerts(db);
    } catch {
      return [];
    }
  }, [db, tick]);

  const refillCards = useMemo<RefillCardModel[]>(() => {
    return medications
      .map((medication) => {
        const burnRate = calculateBurnRate(db, medication.id);
        const daysRemaining = getDaysRemaining(db, medication.id);
        const history = getRefillHistory(db, medication.id);
        return {
          medication,
          burnRate,
          daysRemaining,
          history,
          status: getRefillStatusMeta(daysRemaining),
        };
      })
      .sort((left, right) => {
        const leftDays = left.daysRemaining ?? Number.POSITIVE_INFINITY;
        const rightDays = right.daysRemaining ?? Number.POSITIVE_INFINITY;
        return leftDays - rightDays;
      });
  }, [db, medications]);

  const tracked = refillCards.filter((card) => card.medication.pillCount != null);
  const untracked = refillCards.filter((card) => card.medication.pillCount == null);
  const historyItems = refillCards
    .flatMap((card) =>
      card.history.map((entry) => ({
        ...entry,
        medicationName: card.medication.name,
      })),
    )
    .sort((left, right) => right.refillDate.localeCompare(left.refillDate));

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
    setRefreshing(false);
  }, [refresh]);

  const openRefillSheet = (card: RefillCardModel) => {
    setSelected(card);
    setRefillQuantity(card.medication.pillCount?.toString() || '30');
    setRefillNotes('');
  };

  const handleCall = async () => {
    const phone = parsePhoneNumber(selected?.medication.pharmacy ?? null);
    if (!phone) {
      Alert.alert(
        'No phone number saved',
        'Save a pharmacy phone number in the medication record to call directly from MyMeds.',
      );
      return;
    }

    await ExpoLinking.openURL(`tel:${phone}`);
  };

  const handleRecordRefill = () => {
    if (!selected) {
      return;
    }

    const quantity = Number.parseInt(refillQuantity, 10);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      Alert.alert('Quantity required', 'Enter a valid refill quantity before saving.');
      return;
    }

    try {
      recordRefill(db, uuid(), {
        medicationId: selected.medication.id,
        quantity,
        pharmacy: selected.medication.pharmacy ?? undefined,
        notes: refillNotes.trim() || undefined,
      });
      setSelected(null);
      refresh();
    } catch (error) {
      Alert.alert(
        'Unable to record refill',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  };

  if (medications.length === 0) {
    return (
      <View style={styles.screen}>
        <GlassCard style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No refill data yet</Text>
          <Text style={styles.emptyBody}>
            Add medications first, then capture your initial fill quantity to unlock the refill tracker.
          </Text>
        </GlassCard>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={MD_ACCENT_LIGHT}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <GlassCard style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Inventory overview</Text>
          <Text style={styles.heroTitle}>Refill Tracker</Text>
          <Text style={styles.heroBody}>
            Burn-rate estimates use the saved supply count and dose cadence to show which medications need attention next.
          </Text>
        </GlassCard>

        {alerting.length > 0 ? (
          <GlassCard style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <View style={styles.alertBadge}>
                <MaterialSymbol name="warning" size={16} color="#FFB877" />
              </View>
              <Text style={styles.alertTitle}>Urgent supply</Text>
            </View>
            <View style={styles.alertList}>
              {alerting.map((alert) => (
                <Pressable
                  key={alert.medicationId}
                  style={styles.alertRow}
                  onPress={() => {
                    const match = refillCards.find((card) => card.medication.id === alert.medicationId);
                    if (match) {
                      openRefillSheet(match);
                    }
                  }}
                >
                  <View>
                    <Text style={styles.alertMedication}>{alert.name}</Text>
                    <Text style={styles.alertCopy}>
                      {alert.pillCount} pills left • reorder by {formatDueDate(alert.daysRemaining)}
                    </Text>
                  </View>
                  <Text style={styles.alertDays}>{alert.daysRemaining}d</Text>
                </Pressable>
              ))}
            </View>
          </GlassCard>
        ) : null}

        <View style={styles.listSection}>
          {tracked.map((card) => {
            const progress = Math.min(1, Math.max(card.status.progress, 0.08));
            return (
              <Pressable key={card.medication.id} onPress={() => openRefillSheet(card)}>
                <GlassCard style={styles.refillCard}>
                  <View style={styles.refillHeader}>
                    <View>
                      <Text style={styles.refillMedication}>{card.medication.name}</Text>
                      <Text style={styles.refillMeta}>
                        {card.medication.dosage ?? 'Strength pending'} • {card.medication.frequency.replace(/_/g, ' ')}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: withAlpha(card.status.color, 0.16) },
                      ]}
                    >
                      <Text style={[styles.statusPillText, { color: card.status.color }]}>
                        {card.status.label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressBar,
                        {
                          backgroundColor: card.status.color,
                          width: `${progress * 100}%`,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.metricRow}>
                    <Text style={styles.metricText}>
                      {card.medication.pillCount ?? 0} pills remaining
                    </Text>
                    <Text style={styles.metricText}>
                      {Number.isFinite(card.burnRate) && card.burnRate > 0
                        ? `${card.burnRate.toFixed(1)}/day burn`
                        : 'As needed'}
                    </Text>
                  </View>

                  <View style={styles.metricRow}>
                    <Text style={styles.metricHint}>Due date</Text>
                    <Text style={styles.metricValue}>{formatDueDate(card.daysRemaining)}</Text>
                  </View>

                  <View style={styles.metricRow}>
                    <Text style={styles.metricHint}>Last refill</Text>
                    <Text style={styles.metricValue}>
                      {card.history[0]
                        ? `${formatDateLabel(card.history[0].refillDate)} • ${card.history[0].quantity}`
                        : 'No refill history'}
                    </Text>
                  </View>
                </GlassCard>
              </Pressable>
            );
          })}
        </View>

        {untracked.length > 0 ? (
          <GlassCard style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Add refill tracking</Text>
              <Text style={styles.sectionAction}>{untracked.length} medication{untracked.length === 1 ? '' : 's'}</Text>
            </View>
            <View style={styles.untrackedList}>
              {untracked.map((card) => (
                <Pressable
                  key={card.medication.id}
                  style={styles.untrackedItem}
                  onPress={() => openRefillSheet(card)}
                >
                  <View>
                    <Text style={styles.untrackedMedication}>{card.medication.name}</Text>
                    <Text style={styles.untrackedCopy}>Add your latest fill quantity to begin forecasting.</Text>
                  </View>
                  <MaterialSymbol name="add" size={18} color={MD_ACCENT_LIGHT} />
                </Pressable>
              ))}
            </View>
          </GlassCard>
        ) : null}

        <GlassCard style={styles.sectionCard}>
          <Pressable
            style={styles.sectionHeader}
            onPress={() => setHistoryExpanded((current) => !current)}
          >
            <Text style={styles.sectionTitle}>Refill history</Text>
            <View style={styles.expandRow}>
              <Text style={styles.sectionAction}>
                {historyItems.length} item{historyItems.length === 1 ? '' : 's'}
              </Text>
              <MaterialSymbol
                name={historyExpanded ? 'expand_less' : 'expand_more'}
                size={18}
                color={MD_TEXT_TERTIARY}
              />
            </View>
          </Pressable>

          {historyExpanded ? (
            <View style={styles.historyList}>
              {historyItems.length === 0 ? (
                <Text style={styles.historyEmpty}>No refill history saved yet.</Text>
              ) : (
                historyItems.map((entry) => (
                  <View key={entry.id} style={styles.historyRow}>
                    <View>
                      <Text style={styles.historyMedication}>{entry.medicationName}</Text>
                      <Text style={styles.historyCopy}>
                        {entry.quantity} pills • {formatDateLabel(entry.refillDate)}
                      </Text>
                    </View>
                    <Text style={styles.historyNote}>{entry.notes ?? 'Recorded refill'}</Text>
                  </View>
                ))
              )}
            </View>
          ) : null}
        </GlassCard>
      </ScrollView>

      <Modal
        visible={selected != null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalScrim}>
          <GlassCard style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>Refill detail</Text>
                <Text style={styles.modalTitle}>{selected?.medication.name ?? ''}</Text>
              </View>
              <Pressable onPress={() => setSelected(null)} style={styles.modalClose}>
                <MaterialSymbol name="close" size={18} color={MD_TEXT} />
              </Pressable>
            </View>

            <View style={styles.metaRow}>
              <MetaBlock label="Status" value={selected?.status.label ?? 'OK'} />
              <MetaBlock label="Due" value={formatDueDate(selected?.daysRemaining ?? null)} />
              <MetaBlock
                label="Pharmacy"
                value={selected?.medication.pharmacy ?? 'Not saved'}
              />
            </View>

            <Field
              label="Record refill quantity"
              value={refillQuantity}
              onChangeText={setRefillQuantity}
              placeholder="30"
            />
            <Field
              label="Notes"
              value={refillNotes}
              onChangeText={setRefillNotes}
              placeholder="Optional refill note"
            />

            <View style={styles.modalActions}>
              <Pressable style={styles.modalSecondary} onPress={handleCall}>
                <MaterialSymbol name="phone" size={16} color={MD_TEXT} />
                <Text style={styles.modalSecondaryText}>Call pharmacy</Text>
              </Pressable>
              <Pressable style={styles.modalPrimary} onPress={handleRecordRefill}>
                <MaterialSymbol name="local_pharmacy" size={16} color="#052029" />
                <Text style={styles.modalPrimaryText}>Record refill</Text>
              </Pressable>
            </View>
          </GlassCard>
        </View>
      </Modal>
    </View>
  );
}

function MetaBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaBlock}>
      <Text style={styles.metaBlockLabel}>{label}</Text>
      <Text style={styles.metaBlockValue}>{value}</Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={MD_TEXT_TERTIARY}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MD_SURFACES.base,
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: 16,
    padding: 16,
    paddingBottom: 120,
  },
  heroCard: {
    gap: 10,
    padding: 20,
  },
  heroEyebrow: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: '#FFB877',
  },
  heroTitle: {
    ...MD_TYPOGRAPHY.displayLg,
    color: MD_TEXT,
    fontSize: 34,
    lineHeight: 38,
  },
  heroBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  alertCard: {
    gap: 12,
    padding: 18,
  },
  alertHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  alertBadge: {
    alignItems: 'center',
    backgroundColor: withAlpha('#FFB877', 0.16),
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  alertTitle: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
  },
  alertList: {
    gap: 10,
  },
  alertRow: {
    alignItems: 'center',
    backgroundColor: withAlpha('#FF453A', 0.1),
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  alertMedication: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
  },
  alertCopy: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  alertDays: {
    fontFamily: MD_FONTS.bold,
    fontSize: 18,
    color: '#FFB877',
  },
  listSection: {
    gap: 14,
  },
  refillCard: {
    gap: 12,
    padding: 18,
  },
  refillHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  refillMedication: {
    ...MD_TYPOGRAPHY.headlineMd,
    color: MD_TEXT,
  },
  refillMeta: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  statusPill: {
    borderRadius: MD_PILL_RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusPillText: {
    ...MD_TYPOGRAPHY.labelUpper,
  },
  progressTrack: {
    backgroundColor: withAlpha('#FFFFFF', 0.08),
    borderRadius: 999,
    height: 10,
    overflow: 'hidden',
  },
  progressBar: {
    borderRadius: 999,
    height: '100%',
  },
  metricRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  metricText: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  metricHint: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
  },
  metricValue: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT,
  },
  sectionCard: {
    gap: 14,
    padding: 18,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    ...MD_TYPOGRAPHY.headlineMd,
    color: MD_TEXT,
    flex: 1,
  },
  sectionAction: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_TERTIARY,
  },
  expandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  untrackedList: {
    gap: 10,
  },
  untrackedItem: {
    alignItems: 'center',
    backgroundColor: MD_SURFACES.low,
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  untrackedMedication: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
  },
  untrackedCopy: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  historyList: {
    gap: 10,
  },
  historyRow: {
    backgroundColor: MD_SURFACES.low,
    borderRadius: 18,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  historyMedication: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
  },
  historyCopy: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  historyNote: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_TERTIARY,
  },
  historyEmpty: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_TERTIARY,
  },
  emptyCard: {
    gap: 10,
    margin: 16,
    padding: 20,
  },
  emptyTitle: {
    ...MD_TYPOGRAPHY.headlineMd,
    color: MD_TEXT,
  },
  emptyBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  modalScrim: {
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
  },
  modalCard: {
    gap: 16,
    padding: 20,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalEyebrow: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  modalTitle: {
    ...MD_TYPOGRAPHY.headlineMd,
    color: MD_TEXT,
  },
  modalClose: {
    alignItems: 'center',
    backgroundColor: withAlpha('#FFFFFF', 0.08),
    borderRadius: 16,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaBlock: {
    backgroundColor: MD_SURFACES.low,
    borderRadius: 16,
    gap: 4,
    minWidth: 96,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  metaBlockLabel: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
  },
  metaBlockValue: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
  },
  input: {
    ...MD_TYPOGRAPHY.titleMd,
    backgroundColor: MD_SURFACES.low,
    borderRadius: 18,
    color: MD_TEXT,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalSecondary: {
    alignItems: 'center',
    backgroundColor: withAlpha('#FFFFFF', 0.08),
    borderRadius: 18,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 16,
  },
  modalSecondaryText: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
  },
  modalPrimary: {
    ...MD_CYAN_GLOW_STYLE,
    alignItems: 'center',
    backgroundColor: MD_ACCENT,
    borderRadius: 18,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 16,
  },
  modalPrimaryText: {
    fontFamily: MD_FONTS.bold,
    fontSize: 15,
    color: '#052029',
  },
});
