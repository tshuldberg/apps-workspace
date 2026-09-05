// DoWork Trainers tab - public directory of verified, active trainers.
//
// All rows come from invite-provisioned trainer profiles (dw_trainers). The
// list never renders fake or demo trainers: an empty directory shows the
// invite CTA instead. Tapping a trainer opens their public profile; the footer
// routes prospective trainers to invite redemption.

import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { BadgeCheck, ChevronRight, Search, Sparkles, Users } from 'lucide-react-native';
import { WK_FONTS } from '@mylife/workouts';
import { useDoWorkCloud } from '../providers/DoWorkCloudProvider';
import { listBlockedUserIds } from '../data/cloud-blocks';
import {
  listActiveTrainers,
  type CloudTrainerProfile,
} from '../data/cloud-trainers';
import { DW_ACCENT, DW_BORDER, DW_ON_ACCENT, DW_SURFACES, DW_TEXT } from '../theme/tokens';
import { WorkoutHero, WorkoutTabScrollView, formatCompactNumber } from './_screen-kit';

type LoadState =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; trainers: CloudTrainerProfile[] };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'DW';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function TrainerAvatar({ trainer, size }: { trainer: CloudTrainerProfile; size: number }) {
  if (trainer.heroImagePath) {
    return (
      <Image
        source={{ uri: trainer.heroImagePath }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: DW_SURFACES.high }}
      />
    );
  }
  return (
    <View
      style={[
        styles.avatarFallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.avatarInitials, { fontSize: size * 0.36 }]}>{initials(trainer.displayName)}</Text>
    </View>
  );
}

function SpecialtyChips({ specialties, max }: { specialties: string[]; max: number }) {
  if (specialties.length === 0) return null;
  const shown = specialties.slice(0, max);
  const extra = specialties.length - shown.length;
  return (
    <View style={styles.chipRow}>
      {shown.map((specialty) => (
        <View key={specialty} style={styles.chip}>
          <Text style={styles.chipText}>{specialty}</Text>
        </View>
      ))}
      {extra > 0 ? (
        <View style={styles.chip}>
          <Text style={styles.chipText}>+{extra}</Text>
        </View>
      ) : null}
    </View>
  );
}

function subscriberLabel(count: number): string {
  return `${formatCompactNumber(count)} ${count === 1 ? 'subscriber' : 'subscribers'}`;
}

export default function TrainersScreen() {
  const router = useRouter();
  const { supabase, isReady, userId } = useDoWorkCloud();
  const [load, setLoad] = useState<LoadState>({ state: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const fetchTrainers = useCallback(async () => {
    if (!supabase) {
      setLoad({ state: 'error', message: 'Trainer profiles need a cloud connection.' });
      return;
    }
    const result = await listActiveTrainers(supabase);
    if (!result.ok) {
      setLoad({ state: 'error', message: result.error });
      return;
    }
    // Blocked trainers never appear in discovery (same rule as the social
    // feed); a failed block read fails open to the unfiltered list.
    let blocked = new Set<string>();
    if (userId) {
      const blocksResult = await listBlockedUserIds(supabase, userId);
      if (blocksResult.ok) blocked = blocksResult.blockedUserIds;
    }
    setLoad({
      state: 'ready',
      trainers: result.trainers.filter((trainer) => !blocked.has(trainer.userId)),
    });
  }, [supabase, userId]);

  useFocusEffect(
    useCallback(() => {
      if (!isReady) return;
      void fetchTrainers();
    }, [isReady, fetchTrainers]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTrainers();
    setRefreshing(false);
  }, [fetchTrainers]);

  const filtered = useMemo(() => {
    if (load.state !== 'ready') return [];
    const q = query.trim().toLowerCase();
    if (!q) return load.trainers;
    return load.trainers.filter((trainer) => {
      const haystack = [
        trainer.displayName,
        trainer.handle ?? '',
        trainer.headline ?? '',
        ...trainer.specialties,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [load, query]);

  const openTrainer = useCallback(
    (trainer: CloudTrainerProfile) => {
      if (!trainer.handle) return;
      router.push(`/(root)/trainer/${trainer.handle}` as never);
    },
    [router],
  );

  const goRedeem = useCallback(() => {
    router.push('/(root)/redeem-invite' as never);
  }, [router]);

  const inviteFooter = (
    <Pressable
      style={({ pressed }) => [styles.inviteCard, pressed && { opacity: 0.9 }]}
      onPress={goRedeem}
      accessibilityRole="button"
      accessibilityLabel="Are you a trainer? Redeem your invite"
    >
      <View style={styles.inviteIcon}>
        <Sparkles size={18} color={DW_ACCENT} />
      </View>
      <View style={styles.inviteCopy}>
        <Text style={styles.inviteTitle}>Are you a trainer?</Text>
        <Text style={styles.inviteBody}>Redeem your invite code to open your Studio.</Text>
      </View>
      <ChevronRight size={18} color={DW_TEXT.tertiary} />
    </Pressable>
  );

  if (load.state === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={DW_ACCENT} />
        <Text style={styles.centeredText}>Loading trainers…</Text>
      </View>
    );
  }

  if (load.state === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Can&rsquo;t load trainers</Text>
        <Text style={styles.centeredText}>{load.message}</Text>
        <Pressable
          style={({ pressed }) => [styles.retryButton, pressed && { opacity: 0.86 }]}
          onPress={() => void fetchTrainers()}
          accessibilityRole="button"
        >
          <Text style={styles.retryLabel}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const featured = filtered[0] ?? null;
  const rest = filtered.slice(1);
  const directoryEmpty = load.trainers.length === 0;
  const noMatches = !directoryEmpty && filtered.length === 0;

  return (
    <WorkoutTabScrollView refreshing={refreshing} onRefresh={onRefresh}>
      <WorkoutHero title="Trainers" subtitle="Coaches building on DoWork" />

      <View style={styles.searchWrap}>
        <Search size={16} color={DW_TEXT.tertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or specialty"
          placeholderTextColor={DW_TEXT.disabled}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search trainers"
        />
      </View>

      {directoryEmpty ? (
        <View style={styles.emptyBlock}>
          <View style={styles.emptyIcon}>
            <Users size={26} color={DW_ACCENT} />
          </View>
          <Text style={styles.emptyTitle}>No trainers yet</Text>
          <Text style={styles.emptyBody}>
            DoWork trainers join by invite. If you coach, redeem your invite to publish your
            profile and library.
          </Text>
          {inviteFooter}
        </View>
      ) : noMatches ? (
        <View style={styles.emptyBlock}>
          <Text style={styles.emptyTitle}>No matches</Text>
          <Text style={styles.emptyBody}>No trainers match “{query.trim()}”. Try another search.</Text>
        </View>
      ) : (
        <>
          {featured ? (
            <Pressable
              style={({ pressed }) => [styles.featuredCard, pressed && { opacity: 0.94 }]}
              onPress={() => openTrainer(featured)}
              accessibilityRole="button"
              accessibilityLabel={`Featured trainer ${featured.displayName}`}
            >
              <View style={styles.featuredTopRow}>
                <TrainerAvatar trainer={featured} size={64} />
                <View style={styles.featuredBadge}>
                  <BadgeCheck size={13} color={DW_ACCENT} />
                  <Text style={styles.featuredBadgeText}>Featured</Text>
                </View>
              </View>
              <Text style={styles.featuredName}>{featured.displayName}</Text>
              {featured.handle ? <Text style={styles.handle}>@{featured.handle}</Text> : null}
              {featured.headline ? (
                <Text style={styles.featuredHeadline} numberOfLines={2}>
                  {featured.headline}
                </Text>
              ) : null}
              <SpecialtyChips specialties={featured.specialties} max={4} />
              <Text style={styles.subscribers}>{subscriberLabel(featured.subscriberCount)}</Text>
            </Pressable>
          ) : null}

          <View style={styles.list}>
            {rest.map((trainer) => (
              <Pressable
                key={trainer.id}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}
                onPress={() => openTrainer(trainer)}
                accessibilityRole="button"
                accessibilityLabel={`Trainer ${trainer.displayName}`}
              >
                <TrainerAvatar trainer={trainer} size={52} />
                <View style={styles.rowCopy}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {trainer.displayName}
                  </Text>
                  {trainer.headline ? (
                    <Text style={styles.rowHeadline} numberOfLines={1}>
                      {trainer.headline}
                    </Text>
                  ) : trainer.handle ? (
                    <Text style={styles.rowHeadline} numberOfLines={1}>
                      @{trainer.handle}
                    </Text>
                  ) : null}
                  <SpecialtyChips specialties={trainer.specialties} max={2} />
                  <Text style={styles.rowMeta}>{subscriberLabel(trainer.subscriberCount)}</Text>
                </View>
                <ChevronRight size={18} color={DW_TEXT.tertiary} />
              </Pressable>
            ))}
          </View>

          {inviteFooter}
        </>
      )}
    </WorkoutTabScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: DW_SURFACES.base,
    gap: 12,
    paddingHorizontal: 32,
  },
  centeredText: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    color: DW_TEXT.secondary,
    textAlign: 'center',
  },
  errorTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 18,
    color: DW_TEXT.primary,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 4,
    backgroundColor: DW_ACCENT,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  retryLabel: {
    fontFamily: WK_FONTS.bold,
    fontSize: 14,
    color: DW_ON_ACCENT,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  searchWrap: {
    marginHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: WK_FONTS.medium,
    fontSize: 15,
    color: DW_TEXT.primary,
    padding: 0,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${DW_ACCENT}22`,
    borderWidth: 1,
    borderColor: DW_BORDER.default,
  },
  avatarInitials: {
    fontFamily: WK_FONTS.extraBold,
    color: DW_ACCENT,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  chip: {
    backgroundColor: DW_SURFACES.high,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: DW_BORDER.subtle,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 11,
    color: DW_TEXT.secondary,
  },
  featuredCard: {
    marginHorizontal: 20,
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.default,
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    gap: 6,
  },
  featuredTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${DW_ACCENT}1A`,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  featuredBadgeText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 10,
    color: DW_ACCENT,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  featuredName: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 22,
    color: DW_TEXT.primary,
    letterSpacing: -0.4,
  },
  handle: {
    fontFamily: WK_FONTS.medium,
    fontSize: 13,
    color: DW_ACCENT,
  },
  featuredHeadline: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    color: DW_TEXT.secondary,
    lineHeight: 20,
    marginTop: 2,
  },
  subscribers: {
    marginTop: 6,
    fontFamily: WK_FONTS.semiBold,
    fontSize: 12,
    color: DW_TEXT.tertiary,
  },
  list: {
    paddingHorizontal: 20,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontFamily: WK_FONTS.bold,
    fontSize: 16,
    color: DW_TEXT.primary,
  },
  rowHeadline: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    color: DW_TEXT.secondary,
  },
  rowMeta: {
    marginTop: 2,
    fontFamily: WK_FONTS.semiBold,
    fontSize: 11,
    color: DW_TEXT.tertiary,
  },
  emptyBlock: {
    marginHorizontal: 20,
    alignItems: 'center',
    gap: 10,
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${DW_ACCENT}18`,
  },
  emptyTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 18,
    color: DW_TEXT.primary,
  },
  emptyBody: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    color: DW_TEXT.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  inviteCard: {
    marginHorizontal: 20,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.default,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  inviteIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${DW_ACCENT}18`,
  },
  inviteCopy: {
    flex: 1,
    gap: 2,
  },
  inviteTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 15,
    color: DW_TEXT.primary,
  },
  inviteBody: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    color: DW_TEXT.secondary,
  },
});
