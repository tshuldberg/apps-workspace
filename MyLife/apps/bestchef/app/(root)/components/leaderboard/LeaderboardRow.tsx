import { Pressable, StyleSheet, View } from 'react-native';
import { BadgeCheck } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import type { Submission } from '@mylife/bestchef';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { DishVisual, RECIPES_SURFACES, RECIPES_TERTIARY } from '@mylife/bestchef/ui';
import { Text } from '@mylife/ui';
import { useAppThemeColors as useThemeColors } from '../../providers/AppThemeProvider';
import { formatScore } from './utils';

export interface LeaderboardRowProps {
  submission: Submission;
  rank: number;
  isLast?: boolean;
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

export function LeaderboardRow({ submission, rank, isLast }: LeaderboardRowProps) {
  const router = useRouter();
  const tc = useThemeColors();
  const entry = submission as LeaderboardDisplaySubmission;

  const ratio =
    submission.upvoteCount / Math.max(submission.upvoteCount + submission.downvoteCount, 1);
  const title = entry.dishName ?? entry.recipeTitle ?? submission.chefLocation ?? submission.chefOrigin ?? `Entry #${rank}`;
  const chefLine = [
    entry.chefDisplayName,
    entry.cuisine,
    entry.dishRegion ?? submission.region,
  ]
    .filter(Boolean)
    .join(' · ');

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
      onPress={() => router.push(`/recipe/${submission.id}`)}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        !isLast && styles.rowDivider,
        pressed && { opacity: 0.8 },
      ]}
    >
      {/* Rank */}
      <Text style={[styles.rankText, { color: tc.textSecondary }]}>{rank}</Text>

      {/* Thumb */}
      <DishVisual dish={dishSource} size={48} radius={12} />

      {/* Info column */}
      <View style={styles.infoCol}>
        <View style={styles.titleRow}>
          <Text style={[styles.titleText, { color: tc.text }]} numberOfLines={1}>
            {title}
          </Text>
          {submission.isRestaurant && (
            <BadgeCheck size={12} color={RECIPES_TERTIARY} strokeWidth={2.5} />
          )}
        </View>
        {chefLine.length > 0 && (
          <Text style={[styles.metaText, { color: tc.textSecondary }]} numberOfLines={1}>
            {chefLine}
          </Text>
        )}
        {/* Score bar */}
        <View style={styles.scoreBarTrack}>
          <View
            style={[
              styles.scoreBarFill,
              { width: `${Math.round(ratio * 100)}%` },
            ]}
          />
        </View>
      </View>

      {/* Trailing score column */}
      <View style={styles.trailingCol}>
        <Text style={[styles.scoreText, { color: tc.text }]}>
          {formatScore(submission.voteScore)}
        </Text>
        <View style={styles.reviewedRow}>
          <BadgeCheck size={9} color={RECIPES_TERTIARY} strokeWidth={2.5} />
          <Text style={[styles.reviewedText, { color: tc.textSecondary }]}>
            {submission.reviewedCount}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 14,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RECIPES_SURFACES.focus,
  },
  rankText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 14,
    width: 26,
    textAlign: 'center',
  },
  infoCol: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  titleText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
    flex: 1,
  },
  metaText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
  },
  scoreBarTrack: {
    height: 4,
    maxWidth: 110,
    backgroundColor: RECIPES_SURFACES.focus,
    borderRadius: 999,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: 4,
    backgroundColor: '#22C55E',
    borderRadius: 999,
  },
  trailingCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  scoreText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 14,
  },
  reviewedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  reviewedText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 10,
  },
});
