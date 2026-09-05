import { useState, useCallback, useEffect } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Text, colors } from '@mylife/ui';
import { Users, Plus } from 'lucide-react-native';
import {
  listCircles,
  listHangouts,
  listPeople,
  getGroupActivity,
  type CircleRecord,
  type PersonRecord,
} from '@mylife/friends';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.friends;
const BG = '#131318';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const GLASS = 'rgba(255,255,255,0.03)';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';

// ── Avatar helpers ────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────

export default function CirclesListScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [circles, setCircles] = useState<CircleRecord[]>([]);
  const [peopleMap, setPeopleMap] = useState<Map<string, PersonRecord>>(new Map());
  const [lastGroupDates, setLastGroupDates] = useState<Map<string, string | null>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(() => {
    const allCircles = listCircles(db);
    const allPeople = listPeople(db, { is_archived: false });
    const allHangouts = listHangouts(db, {});

    const pMap = new Map(allPeople.map((p) => [p.id, p]));
    setPeopleMap(pMap);
    setCircles(allCircles);

    // Calculate last group hangout per circle
    const hangoutInputs = allHangouts.map((h) => ({
      people_ids: h.people_ids ?? [],
      happened_at: h.happened_at,
    }));

    const dates = new Map<string, string | null>();
    for (const circle of allCircles) {
      const activity = getGroupActivity(circle.member_ids, hangoutInputs);
      dates.set(circle.id, activity.lastGroupHangout);
    }
    setLastGroupDates(dates);
    setLoading(false);
  }, [db]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
    setRefreshing(false);
  }, [loadData]);

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

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {circles.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Users size={48} color={ACCENT} strokeWidth={1.5} />
            </View>
            <Text style={styles.emptyTitle}>No circles yet</Text>
            <Text style={styles.emptySubtitle}>
              Create a circle to group friends together and track group dynamics.
            </Text>
            <Pressable
              style={styles.addButton}
              onPress={() => router.push('/(friends)/add-circle')}
            >
              <Plus size={18} color="#131318" strokeWidth={2.5} />
              <Text style={styles.addButtonText}>Create Circle</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />
            }
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Circles</Text>
              <Pressable
                style={styles.headerAdd}
                onPress={() => router.push('/(friends)/add-circle')}
              >
                <Plus size={20} color={ACCENT} strokeWidth={2} />
              </Pressable>
            </View>

            {/* Circle cards */}
            {circles.map((circle) => {
              const memberNames = circle.member_ids
                .map((id) => peopleMap.get(id)?.display_name ?? 'Unknown')
                .slice(0, 5);
              const lastDate = lastGroupDates.get(circle.id);

              return (
                <Pressable
                  key={circle.id}
                  style={[styles.circleCard, circle.color ? { borderLeftColor: circle.color } : {}]}
                  onPress={() => router.push({ pathname: '/(friends)/circle-detail', params: { id: circle.id } })}
                >
                  <View style={styles.circleHeader}>
                    <View style={styles.circleMeta}>
                      <Text style={styles.circleIcon}>{circle.icon ?? '👥'}</Text>
                      <View>
                        <Text style={styles.circleName}>{circle.name}</Text>
                        <Text style={styles.circleMemberCount}>
                          {circle.member_ids.length} member{circle.member_ids.length !== 1 ? 's' : ''}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Stacked avatars */}
                  <View style={styles.avatarStack}>
                    {memberNames.map((name, i) => (
                      <View
                        key={i}
                        style={[
                          styles.avatar,
                          {
                            backgroundColor: AVATAR_COLORS[nameHash(name) % AVATAR_COLORS.length],
                            marginLeft: i > 0 ? -10 : 0,
                            zIndex: memberNames.length - i,
                          },
                        ]}
                      >
                        <Text style={styles.avatarText}>{getInitials(name)}</Text>
                      </View>
                    ))}
                    {circle.member_ids.length > 5 && (
                      <View style={[styles.avatar, styles.avatarMore, { marginLeft: -10 }]}>
                        <Text style={styles.avatarMoreText}>+{circle.member_ids.length - 5}</Text>
                      </View>
                    )}
                  </View>

                  {lastDate && (
                    <Text style={styles.lastHangout}>
                      Last together: {formatDate(lastDate)}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>
    </>
  );
}

// ── Helpers ────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 100 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: TEXT_PRIMARY },
  headerAdd: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },

  circleCard: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderLeftWidth: 4,
    borderLeftColor: ACCENT,
    marginBottom: 14,
  },
  circleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  circleMeta: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  circleIcon: { fontSize: 24 },
  circleName: { fontSize: 16, fontWeight: '700', color: TEXT_PRIMARY },
  circleMemberCount: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 2 },

  avatarStack: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: BG,
  },
  avatarText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  avatarMore: { backgroundColor: 'rgba(255,255,255,0.1)' },
  avatarMoreText: { fontSize: 10, fontWeight: '600', color: TEXT_SECONDARY },

  lastHangout: { fontSize: 12, color: TEXT_SECONDARY },

  // Empty
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(236, 72, 153, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: TEXT_PRIMARY, textAlign: 'center', marginBottom: 12 },
  emptySubtitle: { fontSize: 15, color: TEXT_SECONDARY, textAlign: 'center', lineHeight: 22, maxWidth: 280, marginBottom: 24 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: ACCENT,
  },
  addButtonText: { fontSize: 15, fontWeight: '700', color: '#131318' },
});
