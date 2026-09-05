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
import { CalendarHeart } from 'lucide-react-native';
import {
  listHangouts,
  listPeople,
  type HangoutRecord,
  type PersonRecord,
} from '@mylife/friends';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.friends;
const BG = '#131318';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const GLASS = 'rgba(255,255,255,0.03)';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';

// ── Activity tag emoji map ──────────────────────────────────────────

const ACTIVITY_ICONS: Record<string, string> = {
  coffee: '\u2615',
  dinner: '\uD83C\uDF7D\uFE0F',
  lunch: '\uD83E\uDD57',
  drinks: '\uD83C\uDF7B',
  hike: '\uD83E\uDD7E',
  movie: '\uD83C\uDFAC',
  gaming: '\uD83C\uDFAE',
  party: '\uD83C\uDF89',
  study: '\uD83D\uDCDA',
  work: '\uD83D\uDCBC',
  gym: '\uD83D\uDCAA',
  shopping: '\uD83D\uDECD\uFE0F',
  concert: '\uD83C\uDFB5',
  travel: '\u2708\uFE0F',
  random: '\uD83C\uDFB2',
};

// ── Avatar helpers ──────────────────────────────────────────────────

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

// ── Duration label ──────────────────────────────────────────────────

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hrs = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

// ── Date formatting ─────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function getMonthKey(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

// ── Quality stars ───────────────────────────────────────────────────

function QualityStars({ rating }: { rating: number }) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <View
          key={n}
          style={[
            styles.starDot,
            { backgroundColor: n <= rating ? ACCENT : '#35343A' },
          ]}
        />
      ))}
    </View>
  );
}

export default function FriendsHangoutsScreen() {
  const router = useRouter();
  const db = useDatabase();

  const [hangouts, setHangouts] = useState<HangoutRecord[]>([]);
  const [peopleMap, setPeopleMap] = useState<Record<string, PersonRecord>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(() => {
    const allHangouts = listHangouts(db);
    setHangouts(allHangouts);

    const people = listPeople(db, { is_archived: false });
    const map: Record<string, PersonRecord> = {};
    for (const p of people) {
      map[p.id] = p;
    }
    // Also load archived people so hangout cards resolve names
    const archived = listPeople(db, { is_archived: true });
    for (const p of archived) {
      map[p.id] = p;
    }
    setPeopleMap(map);
    setLoading(false);
  }, [db]);

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

  const isEmpty = hangouts.length === 0 && !loading;

  // Group hangouts by month
  const grouped: { month: string; items: HangoutRecord[] }[] = [];
  let currentMonth = '';
  for (const h of hangouts) {
    const month = getMonthKey(h.happened_at);
    if (month !== currentMonth) {
      currentMonth = month;
      grouped.push({ month, items: [h] });
    } else {
      grouped[grouped.length - 1].items.push(h);
    }
  }

  function getPeopleNames(ids: string[]): string {
    return ids
      .map((id) => peopleMap[id]?.display_name ?? 'Unknown')
      .join(', ');
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {isEmpty ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <CalendarHeart size={48} color={ACCENT} strokeWidth={1.5} />
            </View>
            <Text style={styles.emptyTitle}>Time well spent</Text>
            <Text style={styles.emptySubtitle}>
              Log your first hangout to see your social timeline.
            </Text>
            <Pressable
              style={styles.emptyButton}
              onPress={() => router.push('/(friends)/log-hangout')}
            >
              <Text style={styles.emptyButtonText}>Log Hangout</Text>
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
                {group.items.map((hangout) => (
                  <Pressable
                    key={hangout.id}
                    style={styles.card}
                    onPress={() =>
                      router.push({
                        pathname: '/(friends)/hangout-detail',
                        params: { id: hangout.id },
                      })
                    }
                  >
                    {/* People avatars row */}
                    <View style={styles.cardAvatarRow}>
                      {hangout.people_ids.slice(0, 4).map((pid) => {
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
                      {hangout.people_ids.length > 4 && (
                        <View style={[styles.miniAvatar, { backgroundColor: '#35343A' }]}>
                          <Text style={styles.miniAvatarText}>
                            +{hangout.people_ids.length - 4}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Card body */}
                    <View style={styles.cardBody}>
                      <Text style={styles.cardPeople} numberOfLines={1}>
                        {getPeopleNames(hangout.people_ids)}
                      </Text>
                      <View style={styles.cardMetaRow}>
                        {hangout.activity_tags.length > 0 && (
                          <Text style={styles.cardActivity}>
                            {hangout.activity_tags
                              .map((t) => ACTIVITY_ICONS[t] ?? t)
                              .join(' ')}
                          </Text>
                        )}
                        {hangout.location_name && (
                          <Text style={styles.cardLocation} numberOfLines={1}>
                            {hangout.location_name}
                          </Text>
                        )}
                      </View>
                      <View style={styles.cardFooter}>
                        <Text style={styles.cardDate}>
                          {formatDate(hangout.happened_at)}
                        </Text>
                        {hangout.duration_minutes != null && (
                          <Text style={styles.cardDuration}>
                            {formatDuration(hangout.duration_minutes)}
                          </Text>
                        )}
                        {hangout.quality_rating != null && (
                          <QualityStars rating={hangout.quality_rating} />
                        )}
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            ))}
          </ScrollView>
        )}

        {/* FAB */}
        {hangouts.length > 0 && (
          <Pressable
            style={styles.fab}
            onPress={() => router.push('/(friends)/log-hangout')}
          >
            <Text style={styles.fabText}>+</Text>
          </Pressable>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  listScroll: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  cardAvatarRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    width: 54,
  },
  miniAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniAvatarText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  cardPeople: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardActivity: {
    fontSize: 14,
  },
  cardLocation: {
    fontSize: 13,
    color: '#9F8E81',
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  cardDate: {
    fontSize: 12,
    color: '#9F8E81',
  },
  cardDuration: {
    fontSize: 12,
    color: '#9F8E81',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  starDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
