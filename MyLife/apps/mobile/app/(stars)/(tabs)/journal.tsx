import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import {
  GlassCard,
  JournalCard,
  MaterialSymbol,
  type MoonPhase,
  type ZodiacSign,
  deleteJournalEntry,
  getJournalEntries,
  withAlpha,
  ST_ACCENT,
  ST_ACCENT_LIGHT,
  ST_FONTS,
  ST_SURFACES,
  ST_TEXT,
  ST_TEXT_SECONDARY,
  ST_TEXT_TERTIARY,
} from '@mylife/stars';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  deriveEntryTitle,
  filterJournalEntries,
  getMoodSummary,
  groupJournalEntriesByMonth,
  type JournalFilterKey,
} from '../../../components/stars/phase1';

const FILTERS: Array<{ key: JournalFilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'this_month', label: 'This Month' },
  { key: 'full_moons', label: 'Full Moons' },
  { key: 'new_moons', label: 'New Moons' },
  { key: 'transits', label: 'Transits' },
  { key: 'tagged', label: 'Tagged' },
  { key: 'intentions', label: 'Intentions' },
];

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function JournalScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<JournalFilterKey>('all');
  const refresh = useCallback(() => setRefreshSeed((value) => value + 1), []);
  const today = new Date().toISOString().slice(0, 10);

  const entries = useMemo(() => {
    try {
      return getJournalEntries(db, 80);
    } catch {
      return [];
    }
  }, [db, refreshSeed]);
  const filteredEntries = useMemo(
    () => filterJournalEntries(entries, query, filter, today),
    [entries, filter, query, today],
  );
  const groupedEntries = useMemo(
    () => groupJournalEntriesByMonth(filteredEntries),
    [filteredEntries],
  );
  const moodSummary = useMemo(() => getMoodSummary(entries), [entries]);

  const confirmDelete = useCallback(
    (id: string) => {
      Alert.alert('Delete entry', 'This reflection will be removed permanently.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteJournalEntry(db, id);
            refresh();
          },
        },
      ]);
    },
    [db, refresh],
  );

  return (
    <View style={styles.shell}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={refresh}
            tintColor={ST_ACCENT_LIGHT}
          />
        }
      >
        <GlassCard variant="high" style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Cosmic Journal</Text>
          <Text style={styles.heroTitle}>Track the emotional weather of your chart.</Text>
          <Text style={styles.heroBody}>
            Search reflections, filter by moon phase, and revisit the patterns that keep surfacing across your sky.
          </Text>
        </GlassCard>

        <View style={styles.searchWrap}>
          <MaterialSymbol name="search" size={18} color={ST_TEXT_TERTIARY} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search entries, moods, moons, or cards..."
            placeholderTextColor={ST_TEXT_TERTIARY}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map((item) => {
            const active = item.key === filter;
            return (
              <Pressable
                key={item.key}
                style={[styles.filterChip, active ? styles.filterChipActive : null]}
                onPress={() => setFilter(item.key)}
              >
                <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.summaryRow}>
          <GlassCard style={[styles.summaryCard, styles.summaryCardWide]}>
            <Text style={styles.summaryEyebrow}>Total Entries</Text>
            <Text style={styles.summaryValue}>{entries.length}</Text>
          </GlassCard>
          <GlassCard style={styles.summaryCard}>
            <Text style={styles.summaryEyebrow}>Dominant Mood</Text>
            <Text style={styles.summaryValueSmall}>
              {moodSummary[0] ? titleCase(moodSummary[0].mood) : 'Open'}
            </Text>
            <Text style={styles.summaryHint}>
              {moodSummary[0] ? `${moodSummary[0].count} entries` : 'Start your journey'}
            </Text>
          </GlassCard>
        </View>

        {groupedEntries.length === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Start your cosmic journey</Text>
            <Text style={styles.emptyBody}>
              Your journal becomes more powerful as it captures moon phases, moods, and repeating transit patterns.
            </Text>
            <Pressable
              style={styles.primaryButton}
              onPress={() => router.push('/(stars)/journal-compose' as never)}
            >
              <Text style={styles.primaryButtonText}>Create First Entry</Text>
            </Pressable>
          </GlassCard>
        ) : (
          groupedEntries.map((group) => (
            <View key={group.id} style={styles.groupSection}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupTitle}>{group.label}</Text>
                <Text style={styles.groupCount}>{group.entries.length} entries</Text>
              </View>
              <View style={styles.groupList}>
                {group.entries.map((entry) => (
                  <Swipeable
                    key={entry.id}
                    renderRightActions={() => (
                      <View style={styles.deleteActionWrap}>
                        <Pressable
                          style={styles.deleteAction}
                          onPress={() => confirmDelete(entry.id)}
                        >
                          <MaterialSymbol name="delete" size={18} color="#FFFFFF" />
                          <Text style={styles.deleteActionText}>Delete</Text>
                        </Pressable>
                      </View>
                    )}
                  >
                    <JournalCard
                      entry={{
                        id: entry.id,
                        date: entry.date,
                        content: entry.content,
                        title: entry.title ?? deriveEntryTitle(entry.content),
                        mood: entry.mood,
                        moonPhase: entry.moonPhase as MoonPhase,
                        moonSign: entry.moonSign as ZodiacSign,
                        transitTag:
                          entry.intention
                          ?? (
                            entry.retrogradePlanets && entry.retrogradePlanets !== '[]'
                              ? 'Retrograde'
                              : entry.tarotCardName ?? null
                          ),
                      }}
                      onPress={() => router.push(`/(stars)/journal-entry/${entry.id}` as never)}
                    />
                  </Swipeable>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Pressable
        style={styles.fab}
        onPress={() => router.push('/(stars)/journal-compose' as never)}
      >
        <MaterialSymbol name="add" size={24} color="#22113E" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: ST_SURFACES.base,
  },
  screen: {
    flex: 1,
    backgroundColor: ST_SURFACES.base,
  },
  content: {
    padding: 16,
    paddingBottom: 140,
    gap: 16,
  },
  heroCard: {
    gap: 12,
  },
  heroEyebrow: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: ST_ACCENT_LIGHT,
  },
  heroTitle: {
    fontFamily: ST_FONTS.extraBold,
    fontSize: 28,
    lineHeight: 34,
    color: ST_TEXT,
  },
  heroBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: ST_TEXT_SECONDARY,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: withAlpha('#FFFFFF', 0.05),
  },
  searchInput: {
    flex: 1,
    color: ST_TEXT,
    fontFamily: ST_FONTS.medium,
    fontSize: 14,
  },
  filterRow: {
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: withAlpha('#FFFFFF', 0.05),
  },
  filterChipActive: {
    backgroundColor: ST_ACCENT_LIGHT,
  },
  filterChipText: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: ST_TEXT_SECONDARY,
  },
  filterChipTextActive: {
    color: '#22113E',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    gap: 8,
  },
  summaryCardWide: {
    flex: 1.2,
  },
  summaryEyebrow: {
    fontFamily: ST_FONTS.medium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    color: ST_TEXT_TERTIARY,
  },
  summaryValue: {
    fontFamily: ST_FONTS.extraBold,
    fontSize: 34,
    lineHeight: 40,
    color: ST_ACCENT_LIGHT,
  },
  summaryValueSmall: {
    fontFamily: ST_FONTS.bold,
    fontSize: 18,
    lineHeight: 24,
    color: ST_TEXT,
  },
  summaryHint: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    color: ST_TEXT_SECONDARY,
  },
  emptyCard: {
    gap: 12,
  },
  emptyTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 20,
    lineHeight: 26,
    color: ST_TEXT,
  },
  emptyBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: ST_TEXT_SECONDARY,
  },
  primaryButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: ST_ACCENT_LIGHT,
  },
  primaryButtonText: {
    fontFamily: ST_FONTS.bold,
    fontSize: 12,
    color: '#22113E',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  groupSection: {
    gap: 12,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  groupTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 20,
    color: ST_TEXT,
  },
  groupCount: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: ST_TEXT_TERTIARY,
  },
  groupList: {
    gap: 10,
  },
  deleteActionWrap: {
    justifyContent: 'center',
    paddingLeft: 12,
  },
  deleteAction: {
    minWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 18,
    backgroundColor: '#FF453A',
  },
  deleteActionText: {
    fontFamily: ST_FONTS.bold,
    fontSize: 12,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 112,
    width: 58,
    height: 58,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ST_ACCENT_LIGHT,
    shadowColor: ST_ACCENT,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
});
