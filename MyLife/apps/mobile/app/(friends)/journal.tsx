import { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack, useFocusEffect } from 'expo-router';
import { Text } from '@mylife/ui';
import {
  listJournalForPerson,
  deleteJournalEntry,
  countJournalByType,
  getPerson,
  type JournalEntryRecord,
  type JournalCountByType,
  type PersonRecord,
} from '@mylife/friends';
import { useDatabase } from '../../components/DatabaseProvider';

const BG = '#131318';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const GLASS = 'rgba(255,255,255,0.03)';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';

const GRATITUDE_COLOR = '#10B981';
const PROCESSING_COLOR = '#6B7280';
const GROWTH_COLOR = '#8BCFF0';

type JournalType = 'gratitude' | 'conflict' | 'growth';

const SECTION_CONFIG: {
  type: JournalType;
  label: string;
  color: string;
  emptyPrompt: string;
}[] = [
  {
    type: 'gratitude',
    label: 'Gratitude',
    color: GRATITUDE_COLOR,
    emptyPrompt: 'What do you appreciate about this friendship?',
  },
  {
    type: 'conflict',
    label: 'Processing',
    color: PROCESSING_COLOR,
    emptyPrompt: "What's on your mind about this friendship?",
  },
  {
    type: 'growth',
    label: 'Growth',
    color: GROWTH_COLOR,
    emptyPrompt: 'How has this friendship changed?',
  },
];

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function JournalScreen() {
  const router = useRouter();
  const { personId, personName } = useLocalSearchParams<{
    personId: string;
    personName: string;
  }>();
  const db = useDatabase();
  const [entries, setEntries] = useState<Record<JournalType, JournalEntryRecord[]>>({
    gratitude: [],
    conflict: [],
    growth: [],
  });
  const [counts, setCounts] = useState<JournalCountByType>({
    gratitude: 0,
    conflict: 0,
    growth: 0,
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [person, setPerson] = useState<PersonRecord | null>(null);

  const load = useCallback(() => {
    if (!personId) return;
    const p = getPerson(db, personId);
    setPerson(p);
    const c = countJournalByType(db, personId);
    setCounts(c);
    const gratitude = listJournalForPerson(db, personId, 'gratitude');
    const conflict = listJournalForPerson(db, personId, 'conflict');
    const growth = listJournalForPerson(db, personId, 'growth');
    setEntries({ gratitude, conflict, growth });
  }, [db, personId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleDelete = useCallback(
    (id: string) => {
      Alert.alert('Delete entry?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteJournalEntry(db, id);
            load();
          },
        },
      ]);
    },
    [db, load],
  );

  const displayName = person?.display_name ?? personName ?? 'this person';

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backArrow}>{'\u2190'}</Text>
          </Pressable>
        </View>

        <View style={styles.titleSection}>
          <Text style={styles.title}>Journal</Text>
          <Text style={styles.subtitle}>
            A private space to reflect on your friendship with {displayName}
          </Text>
        </View>

        {/* Summary counts */}
        <View style={styles.countsRow}>
          {SECTION_CONFIG.map(({ type, label, color }) => (
            <View key={type} style={styles.countCard}>
              <Text style={[styles.countNumber, { color }]}>{counts[type]}</Text>
              <Text style={styles.countLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Sections */}
        {SECTION_CONFIG.map(({ type, label, color, emptyPrompt }) => (
          <View key={type} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: color }]} />
              <Text style={styles.sectionTitle}>{label}</Text>
              <Pressable
                style={[styles.addButton, { backgroundColor: `${color}20` }]}
                onPress={() =>
                  router.push({
                    pathname: '/(friends)/add-journal',
                    params: { personId, personName: displayName, type },
                  })
                }
              >
                <Text style={[styles.addButtonText, { color }]}>+ Add</Text>
              </Pressable>
            </View>

            {entries[type].length === 0 ? (
              <Pressable
                style={styles.emptyCard}
                onPress={() =>
                  router.push({
                    pathname: '/(friends)/add-journal',
                    params: { personId, personName: displayName, type },
                  })
                }
              >
                <Text style={styles.emptyText}>{emptyPrompt}</Text>
              </Pressable>
            ) : (
              entries[type].map((entry) => (
                <Pressable
                  key={entry.id}
                  style={[styles.entryCard, { borderLeftColor: color }]}
                  onPress={() =>
                    setExpandedId(expandedId === entry.id ? null : entry.id)
                  }
                  onLongPress={() => handleDelete(entry.id)}
                >
                  <View style={styles.entryHeader}>
                    <Text style={styles.entryTitle}>{entry.title}</Text>
                    <Text style={styles.entryDate}>
                      {formatDate(entry.created_at)}
                    </Text>
                  </View>
                  {entry.description_md && expandedId !== entry.id && (
                    <Text style={styles.entryPreview} numberOfLines={2}>
                      {entry.description_md}
                    </Text>
                  )}
                  {entry.description_md && expandedId === entry.id && (
                    <Text style={styles.entryFull}>{entry.description_md}</Text>
                  )}
                </Pressable>
              ))
            )}
          </View>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    paddingBottom: 60,
  },
  headerRow: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 8,
  },
  backArrow: {
    fontSize: 24,
    color: TEXT_PRIMARY,
  },
  titleSection: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    lineHeight: 20,
  },

  // Counts
  countsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 24,
  },
  countCard: {
    flex: 1,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  countNumber: {
    fontSize: 24,
    fontWeight: '700',
  },
  countLabel: {
    fontSize: 11,
    color: TEXT_SECONDARY,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },

  // Sections
  section: {
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  addButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Empty state
  emptyCard: {
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9F8E81',
    fontStyle: 'italic',
    textAlign: 'center',
  },

  // Entry cards
  entryCard: {
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 12,
    borderLeftWidth: 3,
    padding: 14,
    marginBottom: 8,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  entryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    flex: 1,
    marginRight: 8,
  },
  entryDate: {
    fontSize: 12,
    color: '#9F8E81',
  },
  entryPreview: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    lineHeight: 19,
  },
  entryFull: {
    fontSize: 14,
    color: TEXT_PRIMARY,
    lineHeight: 21,
    marginTop: 4,
  },
});
