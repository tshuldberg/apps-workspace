import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BadgeCheck, Star } from 'lucide-react-native';
import {
  BCSectionHeader,
  VerdictRing,
  HERO_GRADIENT,
  JAKARTA_FONTS,
} from '@mylife/bestchef/ui';
import { getReviewedVotesForSubmission, type ReviewedVoteRow } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useRouter } from 'expo-router';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useI18n } from '../../i18n/I18nProvider';
import { useAppThemeColors as useThemeColors } from '../../providers/AppThemeProvider';

const CHEF_GRADIENT_PAIRS: [string, string][] = [
  ['#C9894D', '#FFB877'],
  ['#22C55E', '#86EFAC'],
  ['#8BCFF0', '#60A5FA'],
  ['#A78BFA', '#C4B5FD'],
  ['#F472B6', '#FBCFE8'],
];

function gradientForName(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffffff;
  }
  return CHEF_GRADIENT_PAIRS[Math.abs(hash) % CHEF_GRADIENT_PAIRS.length]!;
}

function initials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0]?.[0] ?? '?').toUpperCase();
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

interface ReviewRowProps {
  row: ReviewedVoteRow;
}

function ReviewRow({ row }: ReviewRowProps) {
  const tc = useThemeColors();
  const name = row.reviewerName ?? 'Chef';
  const gradientColors = gradientForName(name);
  const ratingCount = typeof row.rating === 'number'
    ? Math.max(0, Math.min(5, Math.round(row.rating)))
    : 0;

  return (
    <View style={styles.reviewRow}>
      {/* Avatar */}
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.avatar}
      >
        <Text style={styles.avatarText}>{initials(name)}</Text>
      </LinearGradient>

      <View style={styles.reviewContent}>
        {/* Name + verified badge */}
        <View style={styles.reviewMeta}>
          <Text style={[styles.reviewerName, { color: tc.text }]} numberOfLines={1}>
            {name}
          </Text>
          {row.reviewerIsRestaurant && (
            <BadgeCheck size={12} color={HERO_GRADIENT.from} strokeWidth={2.5} />
          )}
          {/* Stars */}
          {ratingCount > 0 && (
            <View style={styles.stars}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  size={10}
                  color={i < ratingCount ? '#FFB877' : 'rgba(255,255,255,0.18)'}
                  fill={i < ratingCount ? '#FFB877' : 'transparent'}
                  strokeWidth={2}
                />
              ))}
            </View>
          )}
        </View>
        {/* Verdict + notes */}
        {(row.verdict || row.notes) && (
          <Text
            style={[styles.reviewBody, { color: tc.textSecondary }]}
            numberOfLines={4}
          >
            {[row.verdict, row.notes].filter(Boolean).join(' — ')}
          </Text>
        )}
      </View>
    </View>
  );
}

export interface CommunityVerdictSectionProps {
  submissionId: string;
  upvoteCount: number;
  downvoteCount: number;
  reviewedCount: number;
  supabase: SupabaseClient | null;
}

export function CommunityVerdictSection({
  submissionId,
  upvoteCount,
  downvoteCount,
  reviewedCount,
  supabase,
}: CommunityVerdictSectionProps) {
  const tc = useThemeColors();
  const { t, formatNumber } = useI18n();
  const router = useRouter();
  const [reviews, setReviews] = useState<ReviewedVoteRow[]>([]);

  const total = Math.max(upvoteCount + downvoteCount, 1);
  const ratio = upvoteCount / total;
  const percent = Math.floor(ratio * 100);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    void getReviewedVotesForSubmission(supabase, { submissionId, limit: 5 }).then((result) => {
      if (!cancelled && result.ok) setReviews(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [supabase, submissionId]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <BCSectionHeader
        title={t('Community Verdict')}
        style={styles.sectionHeader}
      />

      {/* Verdict ring + stats */}
      <View style={styles.verdictRow}>
        <VerdictRing progress={ratio} size={76} />
        <View style={styles.verdictStats}>
          <Text style={[styles.lovedIt, { color: tc.text }]}>
            {t('{percent}% loved it', { percent })}
          </Text>
          <Text style={[styles.voteCounts, { color: tc.textSecondary }]}>
            {t('{count} upvotes', { count: formatNumber(upvoteCount) })}
            {' · '}
            {t('{count} downvotes', { count: formatNumber(downvoteCount) })}
          </Text>
          {reviewedCount > 0 && (
            <Text style={[styles.reviewedLabel, { color: tc.textTertiary }]}>
              {t('{count} reviewed votes (3\u00d7 weight)', { count: formatNumber(reviewedCount) })}
            </Text>
          )}
        </View>
      </View>

      {/* Reviews list */}
      {reviews.length > 0 ? (
        <View style={styles.reviewsList}>
          {reviews.map((row) => (
            <ReviewRow key={row.id} row={row} />
          ))}
          <Pressable
            style={({ pressed }) => [styles.seeAll, pressed && { opacity: 0.7 }]}
            onPress={() => router.push(`/recipe/${submissionId}/reviews`)}
            accessibilityRole="link"
          >
            <Text style={[styles.seeAllText, { color: HERO_GRADIENT.from }]}>
              {t('See all reviews')}
            </Text>
          </Pressable>
        </View>
      ) : (
        <Text style={[styles.emptyText, { color: tc.textSecondary }]}>
          {t('No reviewed votes yet \u2014 be the first.')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  sectionHeader: { paddingHorizontal: 0, paddingVertical: 0 },

  verdictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  verdictStats: { flex: 1, gap: 4 },
  lovedIt: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 20,
    lineHeight: 24,
  },
  voteCounts: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  reviewedLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
    lineHeight: 15,
  },

  reviewsList: { gap: 14 },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 13,
    lineHeight: 18,
    includeFontPadding: false,
    textAlign: 'center',
    color: '#FFFFFF',
  },
  reviewContent: { flex: 1, gap: 4 },
  reviewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  reviewerName: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 13,
  },
  stars: {
    flexDirection: 'row',
    gap: 1,
  },
  reviewBody: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    lineHeight: 19,
  },

  seeAll: { paddingVertical: 4 },
  seeAllText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 13,
  },

  emptyText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    lineHeight: 19,
  },
});
