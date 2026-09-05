import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@mylife/ui';
import { GoldGradientView, DishVisual } from '@mylife/bestchef/ui';
import {
  getTopSubmissionsThisWeek,
  JAKARTA_FONTS,
  GOLD_GRADIENT,
} from '@mylife/bestchef';
import type { Submission } from '@mylife/bestchef';
import { Crown, Play, ThumbsUp, CheckSquare, Clock } from 'lucide-react-native';
import { useAppThemeColors as useThemeColors } from '../../providers/AppThemeProvider';
import { useBestChefCloud } from '../../providers/BestChefCloudProvider';
import { useI18n } from '../../i18n/I18nProvider';

function formatK(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

interface HeroSubmission extends Submission {
  dishName?: string;
  cuisine?: string;
  emoji?: string;
  gradientFrom?: string;
  gradientTo?: string;
  cookTimeMins?: number;
}

export function HeroChampionCard() {
  const router = useRouter();
  const tc = useThemeColors();
  const { t } = useI18n();
  const { isReady } = useBestChefCloud();
  const [submission, setSubmission] = useState<HeroSubmission | null>(null);

  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    void (async () => {
      const result = await getTopSubmissionsThisWeek({ limit: 1 });
      if (cancelled) return;
      if (result.ok && result.data.length > 0) {
        setSubmission(result.data[0] as HeroSubmission ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isReady]);

  if (!submission) return null;

  const gradientFrom = submission.gradientFrom ?? '#D9742F';
  const gradientTo = submission.gradientTo ?? '#8C401E';
  const emoji = submission.emoji ?? '\u{1F37D}';
  const dishName = submission.dishName ?? 'Top Dish';
  const cuisine = submission.cuisine ?? '';
  const region = submission.region ?? '';
  const hasVideo = submission.photoUrl != null;
  const cookTime = submission.cookTimeMins ?? 0;
  const upvotes = submission.upvoteCount ?? submission.voteScore ?? 0;
  const reviewedCount = submission.reviewedCount ?? 0;

  return (
    <Pressable
      onPress={() => router.push(`/recipe/${submission.recipeSnapshotId}`)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.95 }]}
    >
      {/* Gradient + emoji backdrop */}
      <LinearGradient
        colors={[gradientFrom, gradientTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <DishVisual
        dish={{
          name: dishName,
          cuisine,
          gradientFrom,
          gradientTo,
          emoji,
          photoUrl: submission.photoUrl,
        }}
        size={280}
        radius={24}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Scrim */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.6)']}
        start={{ x: 0, y: 0.3 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Top row: badge + play */}
      <View style={styles.topRow}>
        <GoldGradientView style={styles.badge}>
          <Crown size={11} color="#3A1B00" fill="#3A1B00" />
          <Text style={styles.badgeText}>{t('#1 THIS WEEK')}</Text>
        </GoldGradientView>

        {hasVideo && (
          <View style={styles.playButton}>
            <Play size={14} color="#000000" fill="#000000" />
          </View>
        )}
      </View>

      {/* Bottom content */}
      <View style={styles.bottom}>
        {(cuisine || region) && (
          <Text style={styles.meta}>
            {[cuisine, region].filter(Boolean).join(' · ')}
          </Text>
        )}
        <Text style={styles.title} numberOfLines={2}>{dishName}</Text>
        <View style={styles.statsRow}>
          {upvotes > 0 && (
            <View style={styles.statItem}>
              <ThumbsUp size={12} color="rgba(255,255,255,0.85)" fill="rgba(255,255,255,0.85)" />
              <Text style={styles.statText}>{formatK(upvotes)}</Text>
            </View>
          )}
          {reviewedCount > 0 && (
            <View style={styles.statItem}>
              <CheckSquare size={12} color="rgba(255,255,255,0.85)" />
              <Text style={styles.statText}>{formatK(reviewedCount)}</Text>
            </View>
          )}
          {cookTime > 0 && (
            <View style={styles.statItem}>
              <Clock size={12} color="rgba(255,255,255,0.85)" />
              <Text style={styles.statText}>{cookTime}m</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 280,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#D9742F',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 12,
  },
  topRow: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 11,
    color: '#3A1B00',
    letterSpacing: 0.2,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottom: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    gap: 6,
  },
  meta: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.2,
  },
  title: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 26,
    color: '#FFFFFF',
    lineHeight: 32,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
  },
});
