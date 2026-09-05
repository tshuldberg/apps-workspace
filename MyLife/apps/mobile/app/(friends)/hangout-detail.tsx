import { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack, useFocusEffect } from 'expo-router';
import { Text, colors } from '@mylife/ui';
import {
  getHangout,
  deleteHangout,
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

const ACTIVITY_ICONS: Record<string, { emoji: string; label: string }> = {
  coffee: { emoji: '\u2615', label: 'Coffee' },
  dinner: { emoji: '\uD83C\uDF7D\uFE0F', label: 'Dinner' },
  lunch: { emoji: '\uD83E\uDD57', label: 'Lunch' },
  drinks: { emoji: '\uD83C\uDF7B', label: 'Drinks' },
  hike: { emoji: '\uD83E\uDD7E', label: 'Hike' },
  movie: { emoji: '\uD83C\uDFAC', label: 'Movie' },
  gaming: { emoji: '\uD83C\uDFAE', label: 'Gaming' },
  party: { emoji: '\uD83C\uDF89', label: 'Party' },
  study: { emoji: '\uD83D\uDCDA', label: 'Study' },
  work: { emoji: '\uD83D\uDCBC', label: 'Work' },
  gym: { emoji: '\uD83D\uDCAA', label: 'Gym' },
  shopping: { emoji: '\uD83D\uDECD\uFE0F', label: 'Shopping' },
  concert: { emoji: '\uD83C\uDFB5', label: 'Concert' },
  travel: { emoji: '\u2708\uFE0F', label: 'Travel' },
  random: { emoji: '\uD83C\uDFB2', label: 'Random' },
};

// ── Quality labels ──────────────────────────────────────────────────

const QUALITY_LABELS: Record<number, string> = {
  1: 'Rough',
  2: 'Meh',
  3: 'Fine',
  4: 'Good',
  5: 'Amazing',
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

// ── Formatting ──────────────────────────────────────────────────────

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hrs = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hrs}hr ${rem}min` : `${hrs}hr`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function HangoutDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDatabase();

  const [hangout, setHangout] = useState<HangoutRecord | null>(null);
  const [peopleMap, setPeopleMap] = useState<Record<string, PersonRecord>>({});
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      const h = getHangout(db, id);
      setHangout(h);

      const active = listPeople(db, { is_archived: false });
      const archived = listPeople(db, { is_archived: true });
      const map: Record<string, PersonRecord> = {};
      for (const p of [...active, ...archived]) {
        map[p.id] = p;
      }
      setPeopleMap(map);
      setLoading(false);
    }, [db, id]),
  );

  const handleDelete = useCallback(() => {
    if (!hangout) return;
    Alert.alert('Delete hangout?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteHangout(db, hangout.id);
          router.back();
        },
      },
    ]);
  }, [db, hangout, router]);

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.screen}>
          <View style={styles.centered}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        </View>
      </>
    );
  }

  if (!hangout) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.screen}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Text style={styles.backArrow}>{'\u2190'}</Text>
            </Pressable>
            <Text style={styles.headerTitle}>Not found</Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={styles.centered}>
            <Text style={styles.emptyText}>This hangout could not be found.</Text>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.screen}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backArrow}>{'\u2190'}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Hangout</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Date & time */}
          <View style={styles.dateSection}>
            <Text style={styles.dateText}>{formatDate(hangout.happened_at)}</Text>
            <Text style={styles.timeText}>{formatTime(hangout.happened_at)}</Text>
          </View>

          {/* People */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>WHO WAS THERE</Text>
            <View style={styles.peopleList}>
              {hangout.people_ids.map((pid) => {
                const person = peopleMap[pid];
                const name = person?.display_name ?? 'Unknown';
                return (
                  <Pressable
                    key={pid}
                    style={styles.personRow}
                    onPress={() => {
                      if (person) {
                        router.push({
                          pathname: '/(friends)/person-detail',
                          params: { id: pid },
                        });
                      }
                    }}
                  >
                    <View
                      style={[
                        styles.avatar,
                        { backgroundColor: getAvatarColor(name) },
                      ]}
                    >
                      <Text style={styles.avatarText}>
                        {getInitials(name)}
                      </Text>
                    </View>
                    <Text style={styles.personName}>{name}</Text>
                    <Text style={styles.chevron}>{'\u203A'}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Duration & location */}
          {(hangout.duration_minutes != null || hangout.location_name) && (
            <View style={styles.section}>
              <View style={styles.metaCard}>
                {hangout.duration_minutes != null && (
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Duration</Text>
                    <Text style={styles.metaValue}>
                      {formatDuration(hangout.duration_minutes)}
                    </Text>
                  </View>
                )}
                {hangout.location_name && (
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Location</Text>
                    <Text style={styles.metaValue}>{hangout.location_name}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Activities */}
          {hangout.activity_tags.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ACTIVITIES</Text>
              <View style={styles.activityRow}>
                {hangout.activity_tags.map((tag) => {
                  const info = ACTIVITY_ICONS[tag];
                  return (
                    <View key={tag} style={styles.activityChip}>
                      <Text style={styles.activityEmoji}>
                        {info?.emoji ?? tag}
                      </Text>
                      <Text style={styles.activityLabel}>
                        {info?.label ?? tag}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Quality rating */}
          {hangout.quality_rating != null && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>QUALITY</Text>
              <View style={styles.qualityRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <View
                    key={n}
                    style={[
                      styles.qualityDot,
                      {
                        backgroundColor:
                          n <= hangout.quality_rating! ? ACCENT : '#35343A',
                      },
                    ]}
                  />
                ))}
                <Text style={styles.qualityLabel}>
                  {QUALITY_LABELS[hangout.quality_rating]}
                </Text>
              </View>
            </View>
          )}

          {/* Notes */}
          {hangout.notes_md && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>NOTES</Text>
              <View style={styles.notesCard}>
                <Text style={styles.notesText}>{hangout.notes_md}</Text>
              </View>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actionsRow}>
            <Pressable style={styles.deleteButton} onPress={handleDelete}>
              <Text style={styles.deleteButtonText}>Delete Hangout</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
  },
  backArrow: {
    fontSize: 24,
    color: TEXT_PRIMARY,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: TEXT_SECONDARY,
    fontSize: 15,
  },
  emptyText: {
    color: TEXT_SECONDARY,
    fontSize: 16,
  },

  // Date section
  dateSection: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 4,
  },
  dateText: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  timeText: {
    fontSize: 14,
    color: TEXT_SECONDARY,
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: TEXT_SECONDARY,
    marginBottom: 10,
  },

  // People
  peopleList: {
    gap: 6,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  personName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  chevron: {
    fontSize: 20,
    color: '#9F8E81',
  },

  // Meta card
  metaCard: {
    flexDirection: 'row',
    gap: 20,
    padding: 16,
    borderRadius: 14,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  metaItem: {
    gap: 4,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9F8E81',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },

  // Activities
  activityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: `${ACCENT}15`,
    borderWidth: 1,
    borderColor: `${ACCENT}30`,
  },
  activityEmoji: {
    fontSize: 16,
  },
  activityLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: ACCENT,
  },

  // Quality
  qualityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qualityDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  qualityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginLeft: 8,
  },

  // Notes
  notesCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  notesText: {
    fontSize: 15,
    color: TEXT_PRIMARY,
    lineHeight: 22,
  },

  // Actions
  actionsRow: {
    marginTop: 12,
    gap: 10,
  },
  deleteButton: {
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#EF4444',
  },
});
