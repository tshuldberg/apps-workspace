import { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
} from 'react-native';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { Text, colors } from '@mylife/ui';
import { Heart } from 'lucide-react-native';
import {
  listMemories,
  listPeople,
  type MemoryRecord,
  type PersonRecord,
} from '@mylife/friends';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.friends;
const BG = '#131318';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const GLASS = 'rgba(255,255,255,0.03)';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';
const JOKE_BG = 'rgba(168, 85, 247, 0.06)';
const JOKE_BORDER = 'rgba(168, 85, 247, 0.25)';

// ── Helpers ─────────────────────────────────────────────────────────

const GRADIENT_PAIRS: string[] = [
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

function getAvatarColor(name: string): string {
  return GRADIENT_PAIRS[nameHash(name) % GRADIENT_PAIRS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getMonthKey(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function FriendsMemoriesScreen() {
  const router = useRouter();
  const db = useDatabase();

  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [peopleMap, setPeopleMap] = useState<Record<string, PersonRecord>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'jokes'>('all');

  const loadData = useCallback(() => {
    const allMemories = listMemories(db,
      filter === 'jokes' ? { is_inside_joke: true } : undefined,
    );
    setMemories(allMemories);

    const people = listPeople(db, { is_archived: false });
    const map: Record<string, PersonRecord> = {};
    for (const p of people) {
      map[p.id] = p;
    }
    const archived = listPeople(db, { is_archived: true });
    for (const p of archived) {
      map[p.id] = p;
    }
    setPeopleMap(map);
    setLoading(false);
  }, [db, filter]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
    setRefreshing(false);
  }, [loadData]);

  const isEmpty = memories.length === 0 && !loading;

  // Group memories by month
  const grouped: { month: string; items: MemoryRecord[] }[] = [];
  let currentMonth = '';
  for (const m of memories) {
    const month = m.happened_at ? getMonthKey(m.happened_at) : 'Undated';
    if (month !== currentMonth) {
      currentMonth = month;
      grouped.push({ month, items: [m] });
    } else {
      grouped[grouped.length - 1].items.push(m);
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {/* Filter toggle */}
        <View style={styles.filterRow}>
          <Pressable
            style={[styles.filterPill, filter === 'all' && styles.filterPillActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
              All
            </Text>
          </Pressable>
          <Pressable
            style={[styles.filterPill, filter === 'jokes' && styles.filterPillActive]}
            onPress={() => setFilter('jokes')}
          >
            <Text style={[styles.filterText, filter === 'jokes' && styles.filterTextActive]}>
              Inside Jokes
            </Text>
          </Pressable>
        </View>

        {isEmpty ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Heart size={48} color={ACCENT} strokeWidth={1.5} />
            </View>
            <Text style={styles.emptyTitle}>Moments worth keeping</Text>
            <Text style={styles.emptySubtitle}>
              Capture inside jokes, shared adventures, and the things you never
              want to forget about the people you love.
            </Text>
            <Pressable
              style={styles.emptyButton}
              onPress={() => router.push('/(friends)/add-memory')}
            >
              <Text style={styles.emptyButtonText}>Add Memory</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            style={styles.listScroll}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={ACCENT}
              />
            }
          >
            {grouped.map((group) => (
              <View key={group.month}>
                <Text style={styles.monthHeader}>{group.month.toUpperCase()}</Text>
                {group.items.map((memory) => (
                  <Pressable
                    key={memory.id}
                    style={[
                      styles.card,
                      memory.is_inside_joke && styles.jokeCard,
                    ]}
                    onPress={() =>
                      router.push({
                        pathname: '/(friends)/memory-detail',
                        params: { id: memory.id },
                      })
                    }
                  >
                    {/* Inside joke badge */}
                    {memory.is_inside_joke && (
                      <View style={styles.jokeBadge}>
                        <Text style={styles.jokeBadgeText}>😂</Text>
                      </View>
                    )}

                    {/* Title */}
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {memory.title}
                    </Text>

                    {/* Date */}
                    {memory.happened_at && (
                      <Text style={styles.cardDate}>
                        {formatDate(memory.happened_at)}
                      </Text>
                    )}

                    {/* People initials */}
                    {memory.person_ids.length > 0 && (
                      <View style={styles.cardPeopleRow}>
                        {memory.person_ids.slice(0, 5).map((pid) => {
                          const person = peopleMap[pid];
                          const name = person?.display_name ?? '?';
                          return (
                            <View
                              key={pid}
                              style={[
                                styles.miniAvatar,
                                { backgroundColor: getAvatarColor(name) },
                              ]}
                            >
                              <Text style={styles.miniAvatarText}>
                                {getInitials(name)}
                              </Text>
                            </View>
                          );
                        })}
                        {memory.person_ids.length > 5 && (
                          <View style={[styles.miniAvatar, { backgroundColor: '#35343A' }]}>
                            <Text style={styles.miniAvatarText}>
                              +{memory.person_ids.length - 5}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Tags */}
                    {memory.tags.length > 0 && (
                      <View style={styles.tagsRow}>
                        {memory.tags.slice(0, 3).map((tag) => (
                          <View key={tag} style={styles.tagChip}>
                            <Text style={styles.tagText}>{tag}</Text>
                          </View>
                        ))}
                        {memory.tags.length > 3 && (
                          <Text style={styles.tagMore}>+{memory.tags.length - 3}</Text>
                        )}
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
            ))}
          </ScrollView>
        )}

        {/* FAB */}
        <Pressable
          style={styles.fab}
          onPress={() => router.push('/(friends)/add-memory')}
        >
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  filterPillActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  listScroll: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 100,
  },
  monthHeader: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: TEXT_SECONDARY,
    marginTop: 20,
    marginBottom: 12,
  },
  card: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    gap: 6,
  },
  jokeCard: {
    backgroundColor: JOKE_BG,
    borderColor: JOKE_BORDER,
    transform: [{ rotate: '-0.5deg' }],
  },
  jokeBadge: {
    position: 'absolute',
    top: -6,
    right: 12,
  },
  jokeBadgeText: {
    fontSize: 18,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  cardDate: {
    fontSize: 12,
    color: '#9F8E81',
  },
  cardPeopleRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  miniAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniAvatarText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(236, 72, 153, 0.12)',
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
    color: ACCENT,
  },
  tagMore: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    alignSelf: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(236, 72, 153, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 12,
  },
  emptySubtitle: {
    fontSize: 15,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  emptyButton: {
    backgroundColor: ACCENT,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  fabText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 30,
  },
});
