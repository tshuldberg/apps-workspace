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
import { Cake } from 'lucide-react-native';
import {
  listPeople,
  getUpcomingBirthdays,
  formatBirthdayDate,
  generateDaysUntilLabel,
  type UpcomingBirthday,
} from '@mylife/friends';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.friends;
const BG = '#131318';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const GLASS = 'rgba(255,255,255,0.03)';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';

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

export default function FriendsBirthdaysScreen() {
  const router = useRouter();
  const db = useDatabase();

  const [thisWeek, setThisWeek] = useState<UpcomingBirthday[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingBirthday[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(() => {
    const people = listPeople(db, { is_archived: false });
    const allUpcoming = getUpcomingBirthdays(people, 90);

    setThisWeek(allUpcoming.filter((b) => b.daysUntil <= 7));
    setUpcoming(allUpcoming.filter((b) => b.daysUntil > 7));
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

  const isEmpty = thisWeek.length === 0 && upcoming.length === 0 && !loading;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {isEmpty ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Cake size={48} color={ACCENT} strokeWidth={1.5} />
            </View>
            <Text style={styles.emptyTitle}>Never forget again</Text>
            <Text style={styles.emptySubtitle}>
              Know a birthday? Add it to a friend's profile to get gentle
              reminders so you always show up.
            </Text>
            <Pressable
              style={styles.emptyButton}
              onPress={() => router.push('/(friends)/people')}
            >
              <Text style={styles.emptyButtonText}>Add Birthday</Text>
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
            {/* This Week section */}
            {thisWeek.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionHeader}>
                  {'\uD83C\uDF82'} COMING UP!
                </Text>
                {thisWeek.map((b) => (
                  <Pressable
                    key={b.id}
                    style={styles.weekCard}
                    onPress={() =>
                      router.push({
                        pathname: '/(friends)/person-detail',
                        params: { id: b.id },
                      })
                    }
                  >
                    <View
                      style={[
                        styles.avatar,
                        { backgroundColor: getAvatarColor(b.display_name) },
                      ]}
                    >
                      <Text style={styles.avatarText}>
                        {getInitials(b.display_name)}
                      </Text>
                    </View>
                    <View style={styles.cardBody}>
                      <Text style={styles.cardName} numberOfLines={1}>
                        {b.display_name}
                      </Text>
                      <Text style={styles.cardDate}>
                        {formatBirthdayDate(b.birthday)}
                        {b.age != null ? ` \u00B7 Turning ${b.age}` : ''}
                      </Text>
                    </View>
                    <View style={styles.badgePink}>
                      <Text style={styles.badgePinkText}>
                        {generateDaysUntilLabel(b.daysUntil)}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Upcoming section */}
            {upcoming.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionHeader}>UPCOMING</Text>
                {upcoming.map((b) => (
                  <Pressable
                    key={b.id}
                    style={styles.upcomingCard}
                    onPress={() =>
                      router.push({
                        pathname: '/(friends)/person-detail',
                        params: { id: b.id },
                      })
                    }
                  >
                    <View
                      style={[
                        styles.avatar,
                        { backgroundColor: getAvatarColor(b.display_name) },
                      ]}
                    >
                      <Text style={styles.avatarText}>
                        {getInitials(b.display_name)}
                      </Text>
                    </View>
                    <View style={styles.cardBody}>
                      <Text style={styles.cardName} numberOfLines={1}>
                        {b.display_name}
                      </Text>
                      <Text style={styles.cardDate}>
                        {formatBirthdayDate(b.birthday)}
                        {b.age != null ? ` \u00B7 Turning ${b.age}` : ''}
                      </Text>
                    </View>
                    <View style={styles.badgeGray}>
                      <Text style={styles.badgeGrayText}>
                        {generateDaysUntilLabel(b.daysUntil)}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>
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
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: TEXT_SECONDARY,
    marginTop: 16,
    marginBottom: 12,
  },
  // ── This-week highlighted cards ──
  weekCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(236, 72, 153, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.15)',
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
  },
  // ── Standard upcoming cards ──
  upcomingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardBody: {
    flex: 1,
    gap: 2,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  cardDate: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  // ── Badges ──
  badgePink: {
    backgroundColor: 'rgba(236, 72, 153, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgePinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: ACCENT,
  },
  badgeGray: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeGrayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9F8E81',
  },
  // ── Empty state ──
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
    maxWidth: 320,
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
});
