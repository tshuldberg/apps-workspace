import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Play } from 'lucide-react-native';
import {
  getTopSubmissionsThisWeek,
  getFollowing,
  getBestChefClient,
  JAKARTA_FONTS,
  type Submission,
} from '@mylife/bestchef';
import {
  BCSectionHeader,
  DishVisual,
  RankBadge,
} from '@mylife/bestchef/ui';
import { useAppThemeColors as useThemeColors } from '../../providers/AppThemeProvider';
import { useHomeFilter } from '../../state/useHomeFilter';
import { useI18n } from '../../i18n/I18nProvider';

const CARD_WIDTH = 200;
const CARD_HEIGHT = 140;

export function TopThisWeekCarousel() {
  const router = useRouter();
  const tc = useThemeColors();
  const { t } = useI18n();
  const { selected } = useHomeFilter();
  const [items, setItems] = useState<Submission[]>([]);
  const abortRef = useRef(false);

  useEffect(() => {
    abortRef.current = false;
    load();
    return () => { abortRef.current = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  async function load() {
    try {
      let result;
      if (selected === 'restaurants') {
        result = await getTopSubmissionsThisWeek({ limit: 5, isRestaurant: true });
      } else if (selected === 'following') {
        const supabase = getBestChefClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          // Not signed in -- fall through to trending
          result = await getTopSubmissionsThisWeek({ limit: 5 });
        } else {
          const followingResult = await getFollowing({ userId: user.id, limit: 200 });
          const followerIds = followingResult.ok ? followingResult.data.map((f) => f.profileId) : [];
          result = await getTopSubmissionsThisWeek({ limit: 5, followerIds });
        }
      } else if (selected === 'nearby') {
        // Location-gated: gracefully degrade to trending when no region is available
        result = await getTopSubmissionsThisWeek({ limit: 5 });
      } else {
        result = await getTopSubmissionsThisWeek({ limit: 5 });
      }
      if (!abortRef.current && result.ok) {
        setItems(result.data);
      }
    } catch {
      // Network unavailable -- leave prior state
    }
  }

  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <BCSectionHeader
        title={t('Top This Week')}
        subtitle={t('Reviewed & ranked')}
        action={{ text: t('See all'), onPress: () => router.push('/(tabs)/leaderboard') }}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {items.map((sub, idx) => (
          <Pressable
            key={sub.id}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
            onPress={() => router.push(`/recipe/${sub.recipeSnapshotId}`)}
          >
            {/* Thumbnail */}
            <View style={styles.thumb}>
              <DishVisual
                dish={{
                  name: '',
                  photoUrl: sub.photoUrl,
                }}
                size={CARD_WIDTH}
                radius={18}
              />
              {/* Rank badge top-left */}
              <View style={styles.rankOverlay}>
                <RankBadge rank={idx + 1} variant={idx === 0 ? 'gold' : 'default'} />
              </View>
              {/* Play icon bottom-right when video present */}
              {(sub as Submission & { hasVideo?: boolean }).hasVideo ? (
                <View style={styles.playOverlay}>
                  <Play size={22} color="#FFFFFF" fill="#FFFFFF" strokeWidth={0} />
                </View>
              ) : null}
            </View>
            {/* Info below thumb */}
            <View style={styles.info}>
              <Text
                style={[styles.title, { color: tc.text }]}
                numberOfLines={1}
              >
                {sub.chefOrigin ?? `Rank #${idx + 1}`}
              </Text>
              <View style={styles.chefRow}>
                <View style={[styles.avatar, { backgroundColor: tc.surfaceElevated }]} />
                <Text
                  style={[styles.chefName, { color: tc.textSecondary }]}
                  numberOfLines={1}
                >
                  {sub.chefLocation ?? 'Chef'}
                </Text>
                {sub.isRestaurant ? (
                  <Text style={[styles.verifiedSeal, { color: tc.textTertiary }]}>
                    {'✓'}
                  </Text>
                ) : null}
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  scrollContent: {
    paddingHorizontal: 18,
    gap: 14,
    paddingRight: 18,
  },
  card: {
    width: CARD_WIDTH,
    gap: 10,
  },
  thumb: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 18,
    overflow: 'hidden',
  },
  rankOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
  },
  playOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
  },
  info: {
    gap: 4,
  },
  title: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
  },
  chefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  chefName: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    flex: 1,
  },
  verifiedSeal: {
    fontSize: 11,
    fontFamily: JAKARTA_FONTS.bold,
  },
});
