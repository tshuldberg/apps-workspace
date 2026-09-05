import { useState, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack, useFocusEffect } from 'expo-router';
import { Text } from '@mylife/ui';
import {
  getPerson,
  listHangoutsForPerson,
  listMemoriesForPerson,
  listGiftsForPerson,
  buildPersonTimeline,
  detectMilestones,
  getYearGroup,
  formatTimelineDate,
  type TimelineEntry,
  type Milestone,
  type PersonRecord,
} from '@mylife/friends';
import { useDatabase } from '../../components/DatabaseProvider';

const BG = '#131318';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const GLASS = 'rgba(255,255,255,0.03)';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';
const LINE_COLOR = '#35343A';

const TYPE_COLORS: Record<string, string> = {
  hangout: '#EC4899',
  memory: '#8B5CF6',
  gift_given: '#10B981',
  gift_received: '#06B6D4',
  life_event: '#F59E0B',
  milestone: '#FFB877',
};

const GRADIENT_PAIRS: [string, string][] = [
  ['#EC4899', '#F472B6'],
  ['#8B5CF6', '#A78BFA'],
  ['#06B6D4', '#22D3EE'],
  ['#F59E0B', '#FBBF24'],
  ['#10B981', '#34D399'],
  ['#EF4444', '#F87171'],
  ['#6366F1', '#818CF8'],
  ['#E879A1', '#F0ABAF'],
];

function nameHash(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getGradient(name: string): string {
  return GRADIENT_PAIRS[nameHash(name) % GRADIENT_PAIRS.length][0];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function fetchLifeEvents(db: unknown, personId: string) {
  // Life events CRUD doesn't exist yet; raw query
  try {
    const rows = (db as { query: (sql: string, params: unknown[]) => unknown[] }).query(
      `SELECT * FROM fn_life_events WHERE person_id = ? ORDER BY happened_at DESC`,
      [personId],
    ) as Array<{ id: string; person_id: string; type: string; description: string | null; happened_at: string | null }>;
    return rows;
  } catch {
    return [];
  }
}

export default function TimelineScreen() {
  const router = useRouter();
  const { personId, personName } = useLocalSearchParams<{ personId: string; personName: string }>();
  const db = useDatabase();
  const [person, setPerson] = useState<PersonRecord | null>(null);
  const [entries, setEntries] = useState<TimelineEntry[]>([]);

  const load = useCallback(() => {
    if (!personId) return;
    const p = getPerson(db, personId);
    setPerson(p);
    if (!p) return;

    const hangouts = listHangoutsForPerson(db, personId);
    const memories = listMemoriesForPerson(db, personId);
    const gifts = listGiftsForPerson(db, personId);
    const lifeEvents = fetchLifeEvents(db, personId);

    const milestones: Milestone[] = detectMilestones(
      p.display_name,
      p.when_met ?? null,
      hangouts.map((h) => ({ happened_at: h.happened_at, activity_tags: h.activity_tags })),
    );

    const timeline = buildPersonTimeline(
      personId,
      hangouts,
      memories,
      gifts,
      lifeEvents,
      milestones,
    );

    setEntries(timeline);
  }, [db, personId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Group entries by year
  const yearGroups = useMemo(() => {
    const groups = new Map<string, TimelineEntry[]>();
    for (const entry of entries) {
      const year = getYearGroup(entry.date);
      if (!groups.has(year)) groups.set(year, []);
      groups.get(year)!.push(entry);
    }
    return Array.from(groups.entries());
  }, [entries]);

  const displayName = person?.display_name ?? personName ?? 'this person';
  const initials = displayName ? getInitials(displayName) : '?';
  const avatarColor = displayName ? getGradient(displayName) : '#9F8E81';

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

        {/* Hero */}
        <View style={styles.hero}>
          <View style={[styles.heroAvatar, { backgroundColor: avatarColor }]}>
            <Text style={styles.heroAvatarText}>{initials}</Text>
          </View>
          <Text style={styles.heroTitle}>Your story with {displayName}</Text>
          <Text style={styles.heroSubtitle}>
            {entries.length} moment{entries.length !== 1 ? 's' : ''} together
          </Text>
        </View>

        {/* Empty state */}
        {entries.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No timeline entries yet</Text>
            <Text style={styles.emptySubtext}>
              Log hangouts, memories, and gifts to build your shared story
            </Text>
          </View>
        )}

        {/* Timeline */}
        {yearGroups.map(([year, yearEntries]) => (
          <View key={year} style={styles.yearGroup}>
            {/* Year header */}
            <View style={styles.yearHeaderContainer}>
              <View style={styles.yearHeaderLine} />
              <Text style={styles.yearHeaderText}>{year}</Text>
              <View style={styles.yearHeaderLine} />
            </View>

            {/* Entries */}
            {yearEntries.map((entry, idx) => {
              const isMilestone = entry.type === 'milestone';
              const dotColor = TYPE_COLORS[entry.type] ?? '#9F8E81';
              const isLast = idx === yearEntries.length - 1;

              return (
                <View key={entry.id} style={styles.entryRow}>
                  {/* Timeline line + dot */}
                  <View style={styles.lineColumn}>
                    <View style={[
                      styles.dot,
                      isMilestone && styles.dotMilestone,
                      { backgroundColor: dotColor },
                    ]} />
                    {!isLast && <View style={styles.line} />}
                  </View>

                  {/* Entry card */}
                  <View style={[
                    styles.entryCard,
                    isMilestone && styles.entryCardMilestone,
                  ]}>
                    <View style={styles.entryHeader}>
                      <Text style={styles.entryIcon}>{entry.icon}</Text>
                      <View style={[styles.typeBadge, { backgroundColor: `${dotColor}20` }]}>
                        <Text style={[styles.typeBadgeText, { color: dotColor }]}>
                          {formatTypeName(entry.type)}
                        </Text>
                      </View>
                      {isMilestone && (
                        <Text style={styles.starBadge}>{'\u2B50'}</Text>
                      )}
                    </View>
                    <Text style={styles.entryTitle}>{entry.title}</Text>
                    <Text style={styles.entrySummary}>{entry.summary}</Text>
                    <Text style={styles.entryDate}>{formatTimelineDate(entry.date)}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ))}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </>
  );
}

function formatTypeName(type: string): string {
  switch (type) {
    case 'hangout': return 'Hangout';
    case 'memory': return 'Memory';
    case 'gift_given': return 'Gift given';
    case 'gift_received': return 'Gift received';
    case 'life_event': return 'Life event';
    case 'milestone': return 'Milestone';
    default: return type;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    paddingBottom: 40,
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

  // Hero
  hero: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  heroAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroAvatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    color: TEXT_SECONDARY,
  },

  // Empty state
  emptyCard: {
    marginHorizontal: 20,
    marginTop: 32,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Year groups
  yearGroup: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  yearHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  yearHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: LINE_COLOR,
  },
  yearHeaderText: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    paddingHorizontal: 16,
  },

  // Entry row
  entryRow: {
    flexDirection: 'row',
    marginBottom: 0,
  },
  lineColumn: {
    width: 32,
    alignItems: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 16,
  },
  dotMilestone: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFB877',
  },
  line: {
    width: 1,
    flex: 1,
    backgroundColor: LINE_COLOR,
    marginTop: 4,
  },

  // Entry card
  entryCard: {
    flex: 1,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 12,
    padding: 14,
    marginLeft: 8,
    marginBottom: 12,
  },
  entryCardMilestone: {
    borderColor: 'rgba(255, 184, 119, 0.3)',
    backgroundColor: 'rgba(255, 184, 119, 0.04)',
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  entryIcon: {
    fontSize: 18,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  starBadge: {
    fontSize: 14,
    marginLeft: 'auto',
  },
  entryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  entrySummary: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    lineHeight: 18,
    marginBottom: 6,
  },
  entryDate: {
    fontSize: 12,
    color: '#9F8E81',
  },

  bottomSpacer: {
    height: 40,
  },
});
