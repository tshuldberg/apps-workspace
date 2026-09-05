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
import { useFocusEffect } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import {
  createDiaryEntry,
  deleteDiaryEntry,
  getActiveMedications,
  getDiaryEntries,
  getDiaryInsights,
  getDoseLogsForMedication,
  updateDiaryEntry,
  type DiaryEntryDetail,
} from '@mylife/meds';
import {
  GlassCard,
  MaterialSymbol,
  MoodChip,
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
  getPainLevelMeta,
  withAlpha,
} from '@mylife/meds/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  filterDiaryEntries,
  groupDiaryEntriesByDate,
  SIDE_EFFECT_LIBRARY,
  type DiaryFilterKey,
} from '../../lib/meds/phase2';
import { uuid } from '../../lib/uuid';

const DIARY_FILTERS: Array<{ key: DiaryFilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'side_effects', label: 'Side Effects' },
  { key: 'missed_doses', label: 'Missed Doses' },
  { key: 'high_rated', label: 'High Rated' },
  { key: 'low_rated', label: 'Low Rated' },
];

const MOOD_OPTIONS = ['great', 'good', 'neutral', 'bad', 'terrible'] as const;
const PAIN_OPTIONS = [0, 2, 4, 6, 8, 10];

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function titleCase(value: string): string {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export default function DiaryScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<DiaryFilterKey>('all');
  const [composerVisible, setComposerVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DiaryEntryDetail | null>(null);

  const [selectedMedicationId, setSelectedMedicationId] = useState('');
  const [selectedDoseLogId, setSelectedDoseLogId] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState<string | null>('good');
  const [selectedPainLevel, setSelectedPainLevel] = useState<number | null>(2);
  const [selectedSideEffects, setSelectedSideEffects] = useState<string[]>([]);
  const [customSideEffects, setCustomSideEffects] = useState('');
  const [effectiveness, setEffectiveness] = useState(4);
  const [notes, setNotes] = useState('');

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

  const entries = useMemo(() => {
    try {
      return getDiaryEntries(db, { limit: 500 });
    } catch {
      return [];
    }
  }, [db, tick]);

  const insights = useMemo(() => {
    try {
      return getDiaryInsights(db);
    } catch {
      return {
        entryCount: 0,
        missedDoseCount: 0,
        averageEffectiveness: null,
        mostCommonSideEffect: null,
        highestRatedMedication: null,
        patterns: [],
      };
    }
  }, [db, tick]);

  const filteredEntries = useMemo(
    () => filterDiaryEntries(entries, filter, search),
    [entries, filter, search],
  );

  const groupedEntries = useMemo(
    () => groupDiaryEntriesByDate(filteredEntries),
    [filteredEntries],
  );

  const recentDoseLogs = useMemo(() => {
    if (!selectedMedicationId) {
      return [];
    }

    try {
      const from = new Date();
      from.setDate(from.getDate() - 21);
      return getDoseLogsForMedication(db, selectedMedicationId, {
        from: from.toISOString(),
      }).slice(0, 6);
    } catch {
      return [];
    }
  }, [db, selectedMedicationId, tick]);

  const openComposer = (entry?: DiaryEntryDetail) => {
    const nextEntry = entry ?? null;
    setEditingEntry(nextEntry);
    setSelectedMedicationId(nextEntry?.medicationId ?? medications[0]?.id ?? '');
    setSelectedDoseLogId(nextEntry?.doseLogId ?? null);
    setSelectedMood(nextEntry?.mood ?? 'good');
    setSelectedPainLevel(nextEntry?.painLevel ?? 2);
    setEffectiveness(nextEntry?.effectiveness ?? 4);
    setNotes(nextEntry?.notes ?? '');

    const sideEffects = nextEntry?.sideEffects ?? [];
    setSelectedSideEffects(sideEffects.filter((item) => SIDE_EFFECT_LIBRARY.includes(item)));
    setCustomSideEffects(
      sideEffects.filter((item) => !SIDE_EFFECT_LIBRARY.includes(item)).join(', '),
    );

    setComposerVisible(true);
  };

  const closeComposer = () => {
    setComposerVisible(false);
    setEditingEntry(null);
  };

  const toggleSideEffect = (sideEffect: string) => {
    setSelectedSideEffects((current) =>
      current.includes(sideEffect)
        ? current.filter((item) => item !== sideEffect)
        : [...current, sideEffect],
    );
  };

  const handleSave = () => {
    if (!selectedMedicationId) {
      Alert.alert('Medication required', 'Select a medication before saving the diary entry.');
      return;
    }

    const extraEffects = customSideEffects
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const sideEffects = Array.from(new Set([...selectedSideEffects, ...extraEffects]));
    const selectedDose = recentDoseLogs.find((dose) => dose.id === selectedDoseLogId);
    const recordedAt =
      selectedDose?.actualTime ??
      selectedDose?.scheduledTime ??
      new Date().toISOString();

    try {
      if (editingEntry) {
        updateDiaryEntry(db, editingEntry.id, {
          doseLogId: selectedDoseLogId,
          mood: selectedMood ?? undefined,
          painLevel: selectedPainLevel ?? undefined,
          effectiveness,
          sideEffects,
          notes: notes.trim() || undefined,
          recordedAt,
        });
      } else {
        createDiaryEntry(db, uuid(), {
          medicationId: selectedMedicationId,
          doseLogId: selectedDoseLogId ?? undefined,
          mood: selectedMood ?? undefined,
          painLevel: selectedPainLevel ?? undefined,
          effectiveness,
          sideEffects,
          notes: notes.trim() || undefined,
          recordedAt,
        });
      }

      closeComposer();
      refresh();
    } catch (error) {
      Alert.alert(
        'Unable to save diary entry',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  };

  const confirmDelete = (entryId: string) => {
    Alert.alert('Delete diary entry?', 'This medication journal note will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteDiaryEntry(db, entryId);
          refresh();
        },
      },
    ]);
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
    setRefreshing(false);
  }, [refresh]);

  if (medications.length === 0) {
    return (
      <View style={styles.screen}>
        <GlassCard style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No medications available</Text>
          <Text style={styles.emptyBody}>
            Add a medication first, then use the journal to capture how each dose felt over time.
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
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={MD_ACCENT_LIGHT} />
        }
        showsVerticalScrollIndicator={false}
      >
        <GlassCard style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Medication journal</Text>
          <Text style={styles.heroTitle}>Medication Diary</Text>
          <Text style={styles.heroBody}>
            Group dose reflections by day, spot repeating side effects, and track which medications feel most effective.
          </Text>
        </GlassCard>

        <GlassCard style={styles.sectionCard}>
          <View style={styles.searchField}>
            <MaterialSymbol name="search" size={18} color={MD_TEXT_TERTIARY} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search notes, side effects, or medication names..."
              placeholderTextColor={MD_TEXT_TERTIARY}
              style={styles.searchInput}
            />
          </View>
          <View style={styles.filterRow}>
            {DIARY_FILTERS.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => setFilter(item.key)}
                style={[
                  styles.filterChip,
                  filter === item.key ? styles.filterChipActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    filter === item.key ? styles.filterChipTextActive : null,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </GlassCard>

        {groupedEntries.length === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Start the journal</Text>
            <Text style={styles.emptyBody}>
              Add notes after a dose, capture side effects, and rate how well each medication is working.
            </Text>
            <Pressable style={styles.primaryButton} onPress={() => openComposer()}>
              <Text style={styles.primaryButtonText}>Add First Entry</Text>
            </Pressable>
          </GlassCard>
        ) : (
          groupedEntries.map((group) => (
            <View key={group.key} style={styles.groupSection}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupTitle}>{group.label}</Text>
                <Text style={styles.groupCount}>{group.entries.length} entries</Text>
              </View>
              <View style={styles.groupList}>
                {group.entries.map((entry) => (
                  <Swipeable
                    key={entry.id}
                    renderLeftActions={() => (
                      <View style={styles.editActionWrap}>
                        <Pressable style={styles.editAction} onPress={() => openComposer(entry)}>
                          <MaterialSymbol name="edit" size={16} color="#052029" />
                          <Text style={styles.editActionText}>Edit</Text>
                        </Pressable>
                      </View>
                    )}
                    renderRightActions={() => (
                      <View style={styles.deleteActionWrap}>
                        <Pressable style={styles.deleteAction} onPress={() => confirmDelete(entry.id)}>
                          <MaterialSymbol name="delete" size={16} color="#FFFFFF" />
                          <Text style={styles.deleteActionText}>Delete</Text>
                        </Pressable>
                      </View>
                    )}
                  >
                    <GlassCard style={styles.entryCard}>
                      <View style={styles.entryHeader}>
                        <View>
                          <Text style={styles.entryMedication}>{entry.medicationName}</Text>
                          <Text style={styles.entryMeta}>
                            {entry.dosage ?? 'Dose note'} • {formatDateTime(entry.recordedAt)}
                            {entry.doseStatus ? ` • ${entry.doseStatus}` : ''}
                          </Text>
                        </View>
                        <View style={styles.ratingRow}>
                          {Array.from({ length: 5 }, (_, index) => (
                            <MaterialSymbol
                              key={`${entry.id}-star-${index}`}
                              name="star"
                              size={16}
                              filled={index < entry.effectiveness}
                              color={index < entry.effectiveness ? '#FFB877' : withAlpha('#FFB877', 0.24)}
                            />
                          ))}
                        </View>
                      </View>

                      <View style={styles.metaRow}>
                        {entry.mood ? <MoodChip mood={entry.mood} /> : null}
                        {entry.painLevel != null ? (
                          <View
                            style={[
                              styles.painChip,
                              {
                                backgroundColor: withAlpha(getPainLevelMeta(entry.painLevel).color, 0.16),
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.painChipText,
                                { color: getPainLevelMeta(entry.painLevel).color },
                              ]}
                            >
                              Pain {entry.painLevel}/10
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      {entry.sideEffects.length > 0 ? (
                        <View style={styles.sideEffectRow}>
                          {entry.sideEffects.map((sideEffect) => (
                            <View key={`${entry.id}-${sideEffect}`} style={styles.sideEffectChip}>
                              <Text style={styles.sideEffectChipText}>{titleCase(sideEffect)}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}

                      {entry.notes ? <Text style={styles.entryNotes}>{entry.notes}</Text> : null}
                    </GlassCard>
                  </Swipeable>
                ))}
              </View>
            </View>
          ))
        )}

        <GlassCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Insights</Text>
          <View style={styles.insightGrid}>
            <InsightBlock
              label="Common side effect"
              value={insights.mostCommonSideEffect ?? 'None yet'}
            />
            <InsightBlock
              label="Highest rated"
              value={insights.highestRatedMedication?.name ?? 'Not enough data'}
            />
            <InsightBlock
              label="Average effectiveness"
              value={
                insights.averageEffectiveness != null
                  ? `${insights.averageEffectiveness.toFixed(1)}/5`
                  : 'N/A'
              }
            />
          </View>
          <View style={styles.patternList}>
            {(insights.patterns.length > 0 ? insights.patterns : ['Keep logging to reveal patterns.']).map((pattern) => (
              <View key={pattern} style={styles.patternRow}>
                <View style={styles.patternDot} />
                <Text style={styles.patternText}>{pattern}</Text>
              </View>
            ))}
          </View>
        </GlassCard>
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => openComposer()}>
        <MaterialSymbol name="add" size={24} color="#052029" />
      </Pressable>

      <Modal
        visible={composerVisible}
        transparent
        animationType="slide"
        onRequestClose={closeComposer}
      >
        <View style={styles.modalScrim}>
          <GlassCard style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.heroEyebrow}>{editingEntry ? 'Edit entry' : 'New entry'}</Text>
                <Text style={styles.modalTitle}>Medication journal</Text>
              </View>
              <Pressable onPress={closeComposer} style={styles.modalClose}>
                <MaterialSymbol name="close" size={18} color={MD_TEXT} />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>Medication</Text>
            <View style={styles.filterRow}>
              {medications.map((medication) => (
                <Pressable
                  key={medication.id}
                  onPress={() => {
                    setSelectedMedicationId(medication.id);
                    setSelectedDoseLogId(null);
                  }}
                  style={[
                    styles.filterChip,
                    selectedMedicationId === medication.id ? styles.filterChipActive : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selectedMedicationId === medication.id ? styles.filterChipTextActive : null,
                    ]}
                  >
                    {medication.name}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Related dose</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.doseRow}>
                <Pressable
                  onPress={() => setSelectedDoseLogId(null)}
                  style={[
                    styles.doseChip,
                    selectedDoseLogId == null ? styles.doseChipActive : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.doseChipText,
                      selectedDoseLogId == null ? styles.doseChipTextActive : null,
                    ]}
                  >
                    Manual note
                  </Text>
                </Pressable>
                {recentDoseLogs.map((dose) => (
                  <Pressable
                    key={dose.id}
                    onPress={() => setSelectedDoseLogId(dose.id)}
                    style={[
                      styles.doseChip,
                      selectedDoseLogId === dose.id ? styles.doseChipActive : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.doseChipText,
                        selectedDoseLogId === dose.id ? styles.doseChipTextActive : null,
                      ]}
                    >
                      {formatDateTime(dose.actualTime ?? dose.scheduledTime)} • {dose.status}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.fieldLabel}>Mood at dose time</Text>
            <View style={styles.moodRow}>
              {MOOD_OPTIONS.map((mood) => (
                <Pressable
                  key={mood}
                  onPress={() => setSelectedMood(mood)}
                  style={[
                    styles.moodWrap,
                    selectedMood === mood ? styles.moodWrapActive : null,
                  ]}
                >
                  <MoodChip mood={mood} />
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Pain level</Text>
            <View style={styles.filterRow}>
              {PAIN_OPTIONS.map((painValue) => (
                <Pressable
                  key={painValue}
                  onPress={() => setSelectedPainLevel(painValue)}
                  style={[
                    styles.filterChip,
                    selectedPainLevel === painValue ? styles.filterChipActive : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selectedPainLevel === painValue ? styles.filterChipTextActive : null,
                    ]}
                  >
                    {painValue}/10
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Effectiveness</Text>
            <View style={styles.starRow}>
              {Array.from({ length: 5 }, (_, index) => {
                const value = index + 1;
                return (
                  <Pressable key={value} onPress={() => setEffectiveness(value)}>
                    <MaterialSymbol
                      name="star"
                      size={24}
                      filled={value <= effectiveness}
                      color={value <= effectiveness ? '#FFB877' : withAlpha('#FFB877', 0.22)}
                    />
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Side effects</Text>
            <View style={styles.filterRow}>
              {SIDE_EFFECT_LIBRARY.map((sideEffect) => (
                <Pressable
                  key={sideEffect}
                  onPress={() => toggleSideEffect(sideEffect)}
                  style={[
                    styles.filterChip,
                    selectedSideEffects.includes(sideEffect) ? styles.filterChipActive : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selectedSideEffects.includes(sideEffect) ? styles.filterChipTextActive : null,
                    ]}
                  >
                    {sideEffect}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Custom side effects</Text>
              <TextInput
                value={customSideEffects}
                onChangeText={setCustomSideEffects}
                placeholder="Comma-separated if needed"
                placeholderTextColor={MD_TEXT_TERTIARY}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="How did the dose feel?"
                placeholderTextColor={MD_TEXT_TERTIARY}
                multiline
                textAlignVertical="top"
                style={[styles.input, styles.notesInput]}
              />
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.modalSecondary} onPress={closeComposer}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalPrimary} onPress={handleSave}>
                <Text style={styles.modalPrimaryText}>
                  {editingEntry ? 'Save Changes' : 'Add Entry'}
                </Text>
              </Pressable>
            </View>
          </GlassCard>
        </View>
      </Modal>
    </View>
  );
}

function InsightBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.insightBlock}>
      <Text style={styles.insightLabel}>{label}</Text>
      <Text style={styles.insightValue}>{value}</Text>
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
    paddingBottom: 140,
  },
  heroCard: {
    gap: 10,
    padding: 20,
  },
  heroEyebrow: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
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
  sectionCard: {
    gap: 14,
    padding: 18,
  },
  searchField: {
    alignItems: 'center',
    backgroundColor: MD_SURFACES.low,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  searchInput: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
    flex: 1,
    padding: 0,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    backgroundColor: MD_SURFACES.low,
    borderRadius: MD_PILL_RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filterChipActive: {
    backgroundColor: withAlpha(MD_ACCENT, 0.18),
  },
  filterChipText: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  filterChipTextActive: {
    color: MD_ACCENT_LIGHT,
  },
  emptyCard: {
    gap: 10,
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
  primaryButton: {
    ...MD_CYAN_GLOW_STYLE,
    alignItems: 'center',
    backgroundColor: MD_ACCENT,
    borderRadius: 18,
    justifyContent: 'center',
    paddingVertical: 16,
  },
  primaryButtonText: {
    fontFamily: MD_FONTS.bold,
    fontSize: 15,
    color: '#052029',
  },
  groupSection: {
    gap: 10,
  },
  groupHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  groupTitle: {
    ...MD_TYPOGRAPHY.headlineMd,
    color: MD_TEXT,
    flex: 1,
  },
  groupCount: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_TERTIARY,
  },
  groupList: {
    gap: 10,
  },
  entryCard: {
    gap: 12,
    padding: 16,
  },
  entryHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  entryMedication: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
  },
  entryMeta: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 2,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  painChip: {
    borderRadius: MD_PILL_RADIUS,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  painChipText: {
    ...MD_TYPOGRAPHY.labelUpper,
  },
  sideEffectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sideEffectChip: {
    backgroundColor: withAlpha('#FFB877', 0.12),
    borderRadius: MD_PILL_RADIUS,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  sideEffectChipText: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: '#FFB877',
  },
  entryNotes: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT,
  },
  editActionWrap: {
    justifyContent: 'center',
    paddingRight: 10,
  },
  editAction: {
    alignItems: 'center',
    backgroundColor: MD_ACCENT,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minWidth: 92,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  editActionText: {
    fontFamily: MD_FONTS.bold,
    fontSize: 13,
    color: '#052029',
  },
  deleteActionWrap: {
    justifyContent: 'center',
    paddingLeft: 10,
  },
  deleteAction: {
    alignItems: 'center',
    backgroundColor: '#FF453A',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minWidth: 92,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  deleteActionText: {
    fontFamily: MD_FONTS.bold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  sectionTitle: {
    ...MD_TYPOGRAPHY.headlineMd,
    color: MD_TEXT,
  },
  insightGrid: {
    gap: 10,
  },
  insightBlock: {
    backgroundColor: MD_SURFACES.low,
    borderRadius: 18,
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  insightLabel: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
  },
  insightValue: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
  },
  patternList: {
    gap: 8,
  },
  patternRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  patternDot: {
    backgroundColor: MD_ACCENT_LIGHT,
    borderRadius: 999,
    height: 8,
    marginTop: 6,
    width: 8,
  },
  patternText: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
    flex: 1,
  },
  fab: {
    ...MD_CYAN_GLOW_STYLE,
    alignItems: 'center',
    backgroundColor: MD_ACCENT,
    borderRadius: 28,
    bottom: 28,
    height: 56,
    justifyContent: 'center',
    position: 'absolute',
    right: 20,
    width: 56,
  },
  modalScrim: {
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
  },
  modalCard: {
    gap: 14,
    padding: 20,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
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
  field: {
    gap: 8,
  },
  fieldLabel: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
  },
  doseRow: {
    flexDirection: 'row',
    gap: 8,
  },
  doseChip: {
    backgroundColor: MD_SURFACES.low,
    borderRadius: MD_PILL_RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  doseChipActive: {
    backgroundColor: withAlpha(MD_ACCENT, 0.18),
  },
  doseChipText: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  doseChipTextActive: {
    color: MD_ACCENT_LIGHT,
  },
  moodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  moodWrap: {
    borderRadius: MD_PILL_RADIUS,
  },
  moodWrapActive: {
    backgroundColor: withAlpha(MD_ACCENT, 0.12),
    padding: 4,
  },
  starRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    ...MD_TYPOGRAPHY.titleMd,
    backgroundColor: MD_SURFACES.low,
    borderRadius: 18,
    color: MD_TEXT,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  notesInput: {
    minHeight: 112,
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
    justifyContent: 'center',
    paddingVertical: 16,
  },
  modalPrimaryText: {
    fontFamily: MD_FONTS.bold,
    fontSize: 15,
    color: '#052029',
  },
});
