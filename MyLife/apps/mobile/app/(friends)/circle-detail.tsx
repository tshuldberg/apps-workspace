import { useState, useCallback, useEffect, useMemo } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, Pressable, Alert } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Text, colors } from '@mylife/ui';
import { Pencil, Trash2, CalendarPlus } from 'lucide-react-native';
import {
  getCircle,
  deleteCircle,
  listHangouts,
  listPeople,
  getGroupActivity,
  getCompatibilityPairs,
  detectTraditions,
  type CircleRecord,
  type PersonRecord,
  type GroupActivitySummary,
  type CompatibilityPair,
  type GroupTradition,
} from '@mylife/friends';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.friends;
const BG = '#131318';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const GLASS = 'rgba(255,255,255,0.03)';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';
const SURFACE = '#2A292F';

const AVATAR_COLORS = [
  '#EC4899', '#8B5CF6', '#06B6D4', '#F59E0B',
  '#10B981', '#EF4444', '#6366F1', '#E879A1',
];

function nameHash(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function CircleDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [circle, setCircle] = useState<CircleRecord | null>(null);
  const [peopleMap, setPeopleMap] = useState<Map<string, PersonRecord>>(new Map());
  const [activity, setActivity] = useState<GroupActivitySummary | null>(null);
  const [pairs, setPairs] = useState<CompatibilityPair[]>([]);
  const [traditions, setTraditions] = useState<GroupTradition[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(() => {
    if (!id) return;

    const c = getCircle(db, id);
    if (!c) {
      setLoading(false);
      return;
    }
    setCircle(c);

    const allPeople = listPeople(db, { is_archived: false });
    const pMap = new Map(allPeople.map((p) => [p.id, p]));
    setPeopleMap(pMap);

    const allHangouts = listHangouts(db, {});
    const hangoutInputs = allHangouts.map((h) => ({
      people_ids: h.people_ids ?? [],
      happened_at: h.happened_at,
      activity_tags: h.activity_tags ?? [],
    }));

    const groupActivity = getGroupActivity(c.member_ids, hangoutInputs);
    setActivity(groupActivity);

    // Compatibility pairs scoped to circle members
    const memberPeople = allPeople.filter((p) => c.member_ids.includes(p.id));
    const memberHangouts = hangoutInputs.filter((h) =>
      h.people_ids.some((pid) => c.member_ids.includes(pid)),
    );
    const compat = getCompatibilityPairs(
      memberHangouts,
      memberPeople.map((p) => ({ id: p.id, display_name: p.display_name })),
      5,
    );
    setPairs(compat);

    const groupTraditions = detectTraditions(c.member_ids, hangoutInputs);
    setTraditions(groupTraditions);

    setLoading(false);
  }, [db, id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleDelete = useCallback(() => {
    if (!id) return;
    Alert.alert('Delete Circle', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteCircle(db, id);
          router.back();
        },
      },
    ]);
  }, [db, id, router]);

  const members = useMemo(() => {
    if (!circle) return [];
    return circle.member_ids
      .map((mid) => peopleMap.get(mid))
      .filter(Boolean) as PersonRecord[];
  }, [circle, peopleMap]);

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptySubtitle}>Loading...</Text>
        </View>
      </>
    );
  }

  if (!circle) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Circle not found</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.icon}>{circle.icon ?? '👥'}</Text>
            <Text style={styles.title}>{circle.name}</Text>
            {circle.description && (
              <Text style={styles.description}>{circle.description}</Text>
            )}
            <View style={styles.actions}>
              <Pressable
                style={styles.actionBtn}
                onPress={() => router.push({ pathname: '/(friends)/add-circle', params: { editId: circle.id } })}
              >
                <Pencil size={16} color={TEXT_SECONDARY} strokeWidth={2} />
              </Pressable>
              <Pressable style={styles.actionBtn} onPress={handleDelete}>
                <Trash2 size={16} color="#FFB4AB" strokeWidth={2} />
              </Pressable>
            </View>
          </View>

          {/* Group Stats */}
          {activity && (
            <View style={styles.statsCard}>
              <Text style={styles.sectionLabel}>Group Activity</Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{activity.totalGroupHangouts}</Text>
                  <Text style={styles.statLabel}>Together</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {activity.averageFrequencyDays
                      ? `${activity.averageFrequencyDays}d`
                      : '--'}
                  </Text>
                  <Text style={styles.statLabel}>Avg gap</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {activity.lastGroupHangout
                      ? formatShortDate(activity.lastGroupHangout)
                      : '--'}
                  </Text>
                  <Text style={styles.statLabel}>Last met</Text>
                </View>
              </View>
            </View>
          )}

          {/* Members grid */}
          <View style={styles.membersCard}>
            <Text style={styles.sectionLabel}>Members</Text>
            <View style={styles.membersGrid}>
              {members.map((person) => (
                <Pressable
                  key={person.id}
                  style={styles.memberChip}
                  onPress={() => router.push({ pathname: '/(friends)/person-detail', params: { id: person.id } })}
                >
                  <View
                    style={[
                      styles.memberAvatar,
                      { backgroundColor: AVATAR_COLORS[nameHash(person.display_name) % AVATAR_COLORS.length] },
                    ]}
                  >
                    <Text style={styles.memberAvatarText}>
                      {getInitials(person.display_name)}
                    </Text>
                  </View>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {person.display_name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Traditions */}
          {traditions.length > 0 && (
            <View style={styles.traditionsCard}>
              <Text style={styles.sectionLabel}>Traditions</Text>
              {traditions.map((t, i) => (
                <View key={i} style={styles.traditionRow}>
                  <Text style={styles.traditionIcon}>🔁</Text>
                  <View style={styles.traditionMeta}>
                    <Text style={styles.traditionTitle}>{t.description}</Text>
                    <Text style={styles.traditionSub}>
                      {t.occurrences} times -- last: {formatShortDate(t.lastOccurrence)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Compatibility */}
          {pairs.length > 0 && (
            <View style={styles.compatCard}>
              <Text style={styles.sectionLabel}>Compatibility</Text>
              {pairs.slice(0, 5).map((pair, i) => (
                <View key={i} style={styles.pairRow}>
                  <Text style={styles.pairNames}>
                    {pair.personAName} + {pair.personBName}
                  </Text>
                  <View style={styles.pairBarTrack}>
                    <View
                      style={[
                        styles.pairBarFill,
                        { width: `${Math.round(pair.coOccurrenceRate * 100)}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.pairRate}>
                    {Math.round(pair.coOccurrenceRate * 100)}%
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Log group hangout button */}
          <Pressable
            style={styles.logButton}
            onPress={() =>
              router.push({
                pathname: '/(friends)/log-hangout',
                params: { preselect: circle.member_ids.join(',') },
              })
            }
          >
            <CalendarPlus size={18} color="#131318" strokeWidth={2.5} />
            <Text style={styles.logButtonText}>Log Group Hangout</Text>
          </Pressable>
        </ScrollView>
      </View>
    </>
  );
}

// ── Helpers ────────────────────────────────────────────────────────

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 100 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: TEXT_PRIMARY, textAlign: 'center' },
  emptySubtitle: { fontSize: 15, color: TEXT_SECONDARY },

  header: { alignItems: 'center', marginBottom: 24 },
  icon: { fontSize: 48, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', color: TEXT_PRIMARY, marginBottom: 4 },
  description: { fontSize: 14, color: TEXT_SECONDARY, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 14 },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Stats
  statsCard: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: TEXT_SECONDARY,
    marginBottom: 14,
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: TEXT_PRIMARY },
  statLabel: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 4 },

  // Members
  membersCard: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    marginBottom: 16,
  },
  membersGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  memberChip: { alignItems: 'center', width: 64 },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  memberAvatarText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  memberName: { fontSize: 11, color: TEXT_SECONDARY, textAlign: 'center' },

  // Traditions
  traditionsCard: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    marginBottom: 16,
  },
  traditionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  traditionIcon: { fontSize: 18 },
  traditionMeta: { flex: 1 },
  traditionTitle: { fontSize: 14, fontWeight: '600', color: TEXT_PRIMARY },
  traditionSub: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 2 },

  // Compatibility
  compatCard: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    marginBottom: 16,
  },
  pairRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  pairNames: { fontSize: 12, color: TEXT_PRIMARY, width: 100 },
  pairBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: SURFACE,
    overflow: 'hidden',
  },
  pairBarFill: { height: '100%', borderRadius: 3, backgroundColor: ACCENT },
  pairRate: { fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY, width: 36, textAlign: 'right' },

  // Log button
  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: ACCENT,
    marginTop: 8,
  },
  logButtonText: { fontSize: 15, fontWeight: '700', color: '#131318' },
});
