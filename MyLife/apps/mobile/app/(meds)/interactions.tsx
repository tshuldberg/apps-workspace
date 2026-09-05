import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  checkInteractions,
  getActiveMedications,
  getInteractionsForMedication,
  type InteractionWarning,
} from '@mylife/meds';
import {
  GlassCard,
  MaterialSymbol,
  MD_ACCENT,
  MD_ACCENT_LIGHT,
  MD_PILL_RADIUS,
  MD_SURFACES,
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TEXT_TERTIARY,
  MD_TYPOGRAPHY,
  withAlpha,
} from '@mylife/meds/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  buildSeverityRecommendation,
  getAutocompleteSuggestions,
  groupInteractionsBySeverity,
} from '../../lib/meds/phase2';

type InteractionCard = {
  id: string;
  primary: string;
  secondary: string;
  severity: InteractionWarning['severity'];
  description: string;
  recommendation: string;
};

function titleCase(value: string): string {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function severityColor(severity: InteractionWarning['severity']): string {
  switch (severity) {
    case 'severe':
      return '#FF453A';
    case 'moderate':
      return '#FFB877';
    default:
      return '#8BCFF0';
  }
}

export default function InteractionsScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [candidateName, setCandidateName] = useState('');

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

  const currentInteractionCards = useMemo<InteractionCard[]>(() => {
    const seen = new Set<string>();
    const cards: InteractionCard[] = [];

    for (const medication of medications) {
      let warnings: InteractionWarning[] = [];

      try {
        warnings = getInteractionsForMedication(db, medication.id);
      } catch {
        warnings = [];
      }

      for (const warning of warnings) {
        const left = medication.name.trim().toLowerCase();
        const right = warning.drug.trim().toLowerCase();
        const pairKey = [left, right].sort().join('::');

        if (seen.has(pairKey)) {
          continue;
        }

        seen.add(pairKey);
        cards.push({
          id: pairKey,
          primary: titleCase(medication.name),
          secondary: titleCase(warning.drug),
          severity: warning.severity,
          description: warning.description,
          recommendation: buildSeverityRecommendation(warning.severity),
        });
      }
    }

    return cards.sort((left, right) => {
      const order = { severe: 0, moderate: 1, mild: 2 };
      return order[left.severity] - order[right.severity];
    });
  }, [db, medications]);

  const candidateSuggestions = useMemo(
    () => getAutocompleteSuggestions(candidateName, candidateName.trim() || undefined),
    [candidateName],
  );

  const candidateInteractions = useMemo<InteractionCard[]>(() => {
    if (!candidateName.trim()) {
      return [];
    }

    try {
      return checkInteractions(
        db,
        candidateName.trim(),
        medications.map((medication) => medication.name),
      ).map((warning, index) => ({
        id: `${candidateName.trim().toLowerCase()}-${warning.drug.toLowerCase()}-${index}`,
        primary: titleCase(candidateName.trim()),
        secondary: titleCase(warning.drug),
        severity: warning.severity,
        description: warning.description,
        recommendation: buildSeverityRecommendation(warning.severity),
      }));
    } catch {
      return [];
    }
  }, [candidateName, db, medications]);

  const groupedCurrent = groupInteractionsBySeverity(currentInteractionCards);
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
    setRefreshing(false);
  }, [refresh]);

  if (medications.length === 0) {
    return (
      <View style={styles.screen}>
        <GlassCard style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No medications to review</Text>
          <Text style={styles.emptyBody}>
            Add your medications first, then come back here to run interaction checks against the active list.
          </Text>
        </GlassCard>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={MD_ACCENT_LIGHT} />
      }
      showsVerticalScrollIndicator={false}
    >
      <GlassCard style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Safety check</Text>
        <Text style={styles.heroTitle}>Drug Interactions</Text>
        <Text style={styles.heroBody}>
          Review active conflicts across your medication list, then test a new medication before you add it.
        </Text>
      </GlassCard>

      <View style={styles.metricRow}>
        <MetricPill label="Active meds" value={String(medications.length)} />
        <MetricPill label="Severe" value={String(groupedCurrent.severe.length)} />
        <MetricPill label="Moderate" value={String(groupedCurrent.moderate.length)} />
        <MetricPill label="Mild" value={String(groupedCurrent.mild.length)} />
      </View>

      <GlassCard style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Check a medication</Text>
          <Pressable style={styles.refreshButton} onPress={refresh}>
            <MaterialSymbol name="refresh" size={16} color={MD_ACCENT_LIGHT} />
            <Text style={styles.refreshText}>Re-run</Text>
          </Pressable>
        </View>

        <View style={styles.searchField}>
          <MaterialSymbol name="search" size={18} color={MD_TEXT_TERTIARY} />
          <TextInput
            value={candidateName}
            onChangeText={setCandidateName}
            placeholder="Add a medication name to test against your list..."
            placeholderTextColor={MD_TEXT_TERTIARY}
            style={styles.searchInput}
          />
        </View>

        <View style={styles.chipRow}>
          {candidateSuggestions.map((suggestion) => (
            <Pressable
              key={suggestion}
              onPress={() => setCandidateName(suggestion)}
              style={[
                styles.suggestionChip,
                suggestion.toLowerCase() === candidateName.trim().toLowerCase()
                  ? styles.suggestionChipActive
                  : null,
              ]}
            >
              <Text
                style={[
                  styles.suggestionChipText,
                  suggestion.toLowerCase() === candidateName.trim().toLowerCase()
                    ? styles.suggestionChipTextActive
                    : null,
                ]}
              >
                {suggestion}
              </Text>
            </Pressable>
          ))}
        </View>

        {candidateName.trim() ? (
          <View style={styles.candidateSection}>
            <Text style={styles.sectionCaption}>Candidate check</Text>
            {candidateInteractions.length === 0 ? (
              <Text style={styles.clearCopy}>
                No known conflicts were found for {titleCase(candidateName.trim())}.
              </Text>
            ) : (
              <View style={styles.interactionList}>
                {candidateInteractions.map((card) => (
                  <InteractionCardView key={card.id} card={card} />
                ))}
              </View>
            )}
          </View>
        ) : null}
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Current medication list</Text>
        <View style={styles.chipRow}>
          {medications.map((medication) => (
            <View key={medication.id} style={styles.listChip}>
              <Text style={styles.listChipText}>{titleCase(medication.name)}</Text>
            </View>
          ))}
        </View>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Active interactions</Text>
        <SeveritySection title="Severe" cards={groupedCurrent.severe} />
        <SeveritySection title="Moderate" cards={groupedCurrent.moderate} />
        <SeveritySection title="Mild" cards={groupedCurrent.mild} />

        {currentInteractionCards.length === 0 ? (
          <Text style={styles.clearCopy}>
            Your current medication list has no known conflicts in the bundled interaction database.
          </Text>
        ) : null}
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Coverage matrix</Text>
        <View style={styles.matrix}>
          {medications.map((medication) => {
            const count = currentInteractionCards.filter(
              (card) =>
                card.primary.toLowerCase() === medication.name.toLowerCase() ||
                card.secondary.toLowerCase() === medication.name.toLowerCase(),
            ).length;

            return (
              <View key={medication.id} style={styles.matrixRow}>
                <Text style={styles.matrixLabel}>{titleCase(medication.name)}</Text>
                <View
                  style={[
                    styles.matrixDot,
                    {
                      backgroundColor:
                        count === 0
                          ? '#30D158'
                          : count >= 2
                            ? '#FF453A'
                            : '#FFB877',
                    },
                  ]}
                />
                <Text style={styles.matrixValue}>{count === 0 ? 'Clear' : `${count} issue${count === 1 ? '' : 's'}`}</Text>
              </View>
            );
          })}
        </View>
      </GlassCard>

      <GlassCard style={styles.referenceCard}>
        <View style={styles.referenceHeader}>
          <View style={styles.referenceIcon}>
            <MaterialSymbol name="info" size={18} color={MD_ACCENT_LIGHT} />
          </View>
          <Text style={styles.referenceTitle}>Clinical reference</Text>
        </View>
        <Text style={styles.referenceBody}>
          Interaction results in MyMeds are a local reference layer. Use them as a prompt to confirm the plan with your pharmacist or prescriber, especially for severe combinations.
        </Text>
      </GlassCard>
    </ScrollView>
  );
}

function SeveritySection({
  title,
  cards,
}: {
  title: string;
  cards: InteractionCard[];
}) {
  if (cards.length === 0) {
    return null;
  }

  return (
    <View style={styles.severitySection}>
      <Text style={styles.sectionCaption}>{title}</Text>
      <View style={styles.interactionList}>
        {cards.map((card) => (
          <InteractionCardView key={card.id} card={card} />
        ))}
      </View>
    </View>
  );
}

function InteractionCardView({ card }: { card: InteractionCard }) {
  const color = severityColor(card.severity);

  return (
    <View style={[styles.interactionCard, { backgroundColor: withAlpha(color, 0.12) }]}>
      <View style={styles.interactionHeader}>
        <View
          style={[
            styles.severityPill,
            { backgroundColor: withAlpha(color, 0.18) },
          ]}
        >
          <Text style={[styles.severityPillText, { color }]}>{card.severity.toUpperCase()}</Text>
        </View>
        <Text style={styles.interactionPair}>{card.primary} + {card.secondary}</Text>
      </View>
      <Text style={styles.interactionBody}>{card.description}</Text>
      <Text style={styles.interactionRecommendation}>{card.recommendation}</Text>
    </View>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricPill}>
      <Text style={styles.metricPillLabel}>{label}</Text>
      <Text style={styles.metricPillValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MD_SURFACES.base,
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
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricPill: {
    backgroundColor: withAlpha(MD_ACCENT, 0.12),
    borderRadius: MD_PILL_RADIUS,
    gap: 4,
    minWidth: 88,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  metricPillLabel: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
  },
  metricPillValue: {
    ...MD_TYPOGRAPHY.headlineMd,
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
  refreshButton: {
    alignItems: 'center',
    backgroundColor: withAlpha(MD_ACCENT, 0.14),
    borderRadius: 16,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  refreshText: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: MD_SURFACES.low,
    borderRadius: MD_PILL_RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  suggestionChipActive: {
    backgroundColor: withAlpha(MD_ACCENT, 0.18),
  },
  suggestionChipText: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  suggestionChipTextActive: {
    color: MD_ACCENT_LIGHT,
  },
  candidateSection: {
    gap: 12,
  },
  sectionCaption: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
  },
  clearCopy: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  listChip: {
    backgroundColor: withAlpha('#FFFFFF', 0.06),
    borderRadius: MD_PILL_RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  listChipText: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT,
  },
  severitySection: {
    gap: 10,
  },
  interactionList: {
    gap: 10,
  },
  interactionCard: {
    borderRadius: 18,
    gap: 10,
    padding: 14,
  },
  interactionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  severityPill: {
    borderRadius: MD_PILL_RADIUS,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  severityPillText: {
    ...MD_TYPOGRAPHY.labelUpper,
  },
  interactionPair: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
    flex: 1,
  },
  interactionBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  interactionRecommendation: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_TERTIARY,
  },
  matrix: {
    gap: 10,
  },
  matrixRow: {
    alignItems: 'center',
    backgroundColor: MD_SURFACES.low,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  matrixLabel: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
    flex: 1,
  },
  matrixDot: {
    borderRadius: 999,
    height: 12,
    width: 12,
  },
  matrixValue: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
    minWidth: 72,
    textAlign: 'right',
  },
  referenceCard: {
    gap: 10,
    padding: 18,
  },
  referenceHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  referenceIcon: {
    alignItems: 'center',
    backgroundColor: withAlpha(MD_ACCENT, 0.16),
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  referenceTitle: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
  },
  referenceBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
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
});
