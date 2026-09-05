import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, Medal } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import type { Submission } from '@mylife/bestchef';
import { MEDAL_GOLD, MEDAL_SILVER, MEDAL_BRONZE, JAKARTA_FONTS } from '@mylife/bestchef';
import { DishVisual, MedalBadge } from '@mylife/bestchef/ui';
import { Text } from '@mylife/ui';
import { formatScore } from './utils';

export interface PodiumCardProps {
  submission: Submission;
  rank: 1 | 2 | 3;
  height: number;
  medalColor: string;
}

type LeaderboardDisplaySubmission = Submission & {
  chefDisplayName?: string | null;
  dishName?: string | null;
  recipeTitle?: string | null;
  cuisine?: string | null;
  dishRegion?: string | null;
  gradientFrom?: string | null;
  gradientTo?: string | null;
  emoji?: string | null;
};

const DISC_SIZE: Record<1 | 2 | 3, number> = { 1: 74, 2: 60, 3: 60 };
const RANK_TO_MEDAL: Record<1 | 2 | 3, 'gold' | 'silver' | 'bronze'> = {
  1: 'gold',
  2: 'silver',
  3: 'bronze',
};

export function PodiumCard({ submission, rank, height, medalColor }: PodiumCardProps) {
  const router = useRouter();
  const entry = submission as LeaderboardDisplaySubmission;
  const discSize = DISC_SIZE[rank];
  const medal = RANK_TO_MEDAL[rank];
  const scoreLabel = `${formatScore(submission.voteScore)} pts`;
  const title = entry.dishName ?? entry.recipeTitle ?? submission.chefLocation ?? submission.region ?? `#${rank}`;
  const subtitle = entry.chefDisplayName ?? submission.chefOrigin ?? submission.region ?? null;

  const dishSource = {
    name: title,
    cuisine: entry.cuisine ?? submission.countryCode,
    gradientFrom: entry.gradientFrom ?? null,
    gradientTo: entry.gradientTo ?? null,
    emoji: entry.emoji ?? null,
    photoUrl: submission.photoUrl,
  };

  return (
    <Pressable
      style={styles.col}
      onPress={() => router.push(`/recipe/${submission.id}`)}
      accessibilityRole="button"
    >
      {/* Emoji disc with medal badge overlay */}
      <View style={styles.discWrap}>
        <DishVisual dish={dishSource} size={discSize} radius={discSize / 2} />
        <View style={styles.badgeOverlay}>
          <MedalBadge
            rank={medal}
            icon={
              rank === 1 ? (
                <Crown size={12} color="#3A1B00" strokeWidth={2.5} />
              ) : (
                <Medal size={12} color="#3A1B00" strokeWidth={2.5} />
              )
            }
            size={22}
          />
        </View>
      </View>

      {/* Title */}
      <Text
        style={styles.title}
        numberOfLines={2}
      >
        {title}
      </Text>
      {subtitle != null && (
        <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
      )}

      {/* Score */}
      <Text style={styles.score}>{scoreLabel}</Text>

      {/* Podium base */}
      <LinearGradient
        colors={[hexWithOpacity(medalColor, 0.45), hexWithOpacity(medalColor, 0.20)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.base, { height }]}
      >
        <Text style={[styles.rankLabel, { color: medalColor }]}>{`#${rank}`}</Text>
      </LinearGradient>
    </Pressable>
  );
}

/** Approximate hex+alpha by blending with black background for LinearGradient (which needs solid colors).
 *  We use rgba() string which expo-linear-gradient supports. */
function hexWithOpacity(hex: string, alpha: number): string {
  // expo-linear-gradient accepts rgba strings
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const styles = StyleSheet.create({
  col: {
    flex: 1,
    alignItems: 'center',
  },
  discWrap: {
    position: 'relative',
  },
  badgeOverlay: {
    position: 'absolute',
    top: -4,
    right: -4,
  },
  title: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 11,
    color: '#E4E1E9',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 2,
    lineHeight: 14,
    paddingHorizontal: 4,
  },
  subtitle: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 9,
    color: 'rgba(214,195,181,0.58)',
    marginBottom: 2,
    paddingHorizontal: 4,
  },
  score: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 10,
    color: 'rgba(214,195,181,0.6)',
    marginBottom: 6,
  },
  base: {
    width: '100%',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 12,
  },
  rankLabel: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 24,
  },
});
