import { useState } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { Text, LoadingState, EmptyState, colors } from '@mylife/ui';
import { useBadges } from '../../hooks/books/use-badges';
import {
  GlassCard,
  GenreChip,
  ReadingProgressBar,
  BOOKS_SURFACES,
  BOOKS_TYPOGRAPHY,
  JAKARTA_FONTS,
} from '@mylife/books/ui';
import type { BadgeProgress } from '@mylife/books';

const BOOKS_ACCENT = colors.modules.books;
const ACCENT_WARM = '#FFB877';

const TIER_COLORS: Record<string, string> = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
};

const TIER_BG: Record<string, string> = {
  bronze: 'rgba(205,127,50,0.15)',
  silver: 'rgba(192,192,192,0.15)',
  gold: 'rgba(255,215,0,0.15)',
};

const CATEGORY_DISPLAY: Record<string, string> = {
  volume: 'VOLUME ACHIEVEMENTS',
  pages: 'PAGE MASTERY',
  genre: 'GENRE EXPLORER',
  author: 'AUTHOR DEVOTION',
  streak: 'STREAK MILESTONES',
  challenge: 'CHALLENGE CHAMPION',
  speed: 'SPEED READER',
  review: 'SOCIAL & JOURNALING',
  journal: 'SOCIAL & JOURNALING',
};

const FILTER_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'All Badges', value: 'all' },
  { label: 'Volume', value: 'volume' },
  { label: 'Pages', value: 'pages' },
  { label: 'Streak', value: 'streak' },
  { label: 'Genre', value: 'genre' },
  { label: 'Review', value: 'review' },
];

function BadgeItem({ progress }: { progress: BadgeProgress }) {
  const { badge, currentValue, isEarned, progressText } = progress;
  const tierColor = TIER_COLORS[badge.tier] ?? '#9F8E81';
  const tierBg = TIER_BG[badge.tier] ?? BOOKS_SURFACES.focus;
  const fillPct = isEarned ? 1 : Math.min(1, currentValue / badge.threshold);

  return (
    <View style={[badgeStyles.card, { backgroundColor: isEarned ? tierBg : BOOKS_SURFACES.lift }]}>
      {/* Icon circle */}
      <View style={[badgeStyles.iconCircle, { borderColor: isEarned ? tierColor : BOOKS_SURFACES.highest }]}>
        <Text style={badgeStyles.icon}>{badge.icon}</Text>
      </View>

      <Text style={badgeStyles.name} numberOfLines={1}>{badge.name}</Text>
      <Text style={badgeStyles.desc} numberOfLines={2}>{badge.description}</Text>

      {isEarned ? (
        <Text style={[badgeStyles.tierLabel, { color: tierColor }]}>
          {badge.tier.toUpperCase()} TIER
          {badge.earned_at ? ` \u2022 ${new Date(badge.earned_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase()}` : ''}
        </Text>
      ) : (
        <View style={badgeStyles.progressRow}>
          <ReadingProgressBar progress={fillPct} height={4} />
          <Text style={badgeStyles.progressLabel}>{progressText}</Text>
        </View>
      )}
    </View>
  );
}

function LockedBadge() {
  return (
    <View style={badgeStyles.lockedCard}>
      <View style={badgeStyles.lockedCircle}>
        <Text style={badgeStyles.lockIcon}>🔒</Text>
      </View>
      <Text style={badgeStyles.lockedTitle}>Undiscovered</Text>
      <Text style={badgeStyles.lockedHint}>KEEP READING TO UNLOCK</Text>
    </View>
  );
}

export default function BadgeGalleryScreen() {
  const { evaluation, stats, badgesByCategory, loading, refresh } = useBadges();
  const [filter, setFilter] = useState('all');

  const earnedCount = evaluation?.allProgress.filter((p) => p.isEarned).length ?? 0;
  const totalCount = evaluation?.allProgress.length ?? 0;
  const currentStreak = stats?.currentStreak ?? 0;

  if (loading && !evaluation) {
    return (
      <View style={{ flex: 1, backgroundColor: BOOKS_SURFACES.base }}>
        <LoadingState rows={4} />
      </View>
    );
  }

  if (totalCount === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: BOOKS_SURFACES.base, justifyContent: 'center' }}>
        <EmptyState
          icon="🏅"
          title="No badges available"
          message="Start reading to unlock achievements."
        />
      </View>
    );
  }

  // Group and filter categories
  const filteredCategories = Object.entries(badgesByCategory).filter(
    ([cat]) => filter === 'all' || cat === filter
  );

  // Merge review + journal into "Social & Journaling"
  const mergedCategories: Array<[string, BadgeProgress[]]> = [];
  let socialBadges: BadgeProgress[] = [];

  for (const [cat, badges] of filteredCategories) {
    if (cat === 'review' || cat === 'journal') {
      socialBadges = [...socialBadges, ...badges];
    } else {
      mergedCategories.push([cat, badges]);
    }
  }
  if (socialBadges.length > 0) {
    mergedCategories.push(['review', socialBadges]);
  }

  // Next streak milestone
  const nextStreakMilestone = [7, 15, 30, 50, 100, 365].find((m) => m > currentStreak) ?? currentStreak + 10;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={BOOKS_ACCENT} />}
    >
      {/* Hero Card */}
      <GlassCard level={2} style={styles.heroCard}>
        <Text style={styles.starIcon}>⭐</Text>
        <Text style={styles.heroTitle}>Achievement{'\n'}Gallery</Text>
        <Text style={styles.heroDesc}>
          Your journey through the obsidian halls of literature, captured in silver and gold.
        </Text>
        <View style={styles.heroCountRow}>
          <Text style={styles.heroCount}>{earnedCount}</Text>
          <Text style={styles.heroCountLabel}>BADGES EARNED</Text>
        </View>
      </GlassCard>

      {/* Current Streak */}
      <GlassCard level={1} style={styles.streakCard}>
        <Text style={styles.streakIcon}>🔥</Text>
        <Text style={styles.streakValue}>{currentStreak} Days</Text>
        <Text style={styles.streakHint}>Next milestone: {nextStreakMilestone} days</Text>
      </GlassCard>

      {/* Category Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        <View style={styles.chipRow}>
          {FILTER_OPTIONS.map((opt) => (
            <GenreChip
              key={opt.value}
              label={opt.label}
              selected={filter === opt.value}
              onPress={() => setFilter(opt.value)}
            />
          ))}
        </View>
      </ScrollView>

      {/* Badge Categories */}
      {mergedCategories.map(([category, badges]) => (
        <View key={category} style={styles.categorySection}>
          <Text style={styles.categoryLabel}>
            {CATEGORY_DISPLAY[category] ?? category.toUpperCase()}
          </Text>
          <View style={styles.badgeGrid}>
            {badges.map((bp) => (
              <BadgeItem key={bp.badge.id} progress={bp} />
            ))}
          </View>
        </View>
      ))}

      {/* Undiscovered */}
      <View style={styles.categorySection}>
        <LockedBadge />
      </View>
    </ScrollView>
  );
}

// --- badge item styles ---

const badgeStyles = StyleSheet.create({
  card: {
    width: '47%' as unknown as number,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BOOKS_SURFACES.focus,
    marginBottom: 4,
  },
  icon: {
    fontSize: 28,
  },
  name: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
    color: '#E4E1E9',
    textAlign: 'center',
  },
  desc: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 11,
    color: '#D6C3B5',
    textAlign: 'center',
    lineHeight: 15,
  },
  tierLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 10,
    letterSpacing: 0.5,
    marginTop: 4,
  },
  progressRow: {
    width: '100%',
    gap: 4,
    marginTop: 4,
  },
  progressLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 10,
    color: '#9F8E81',
    textAlign: 'center',
  },
  lockedCard: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  lockedCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BOOKS_SURFACES.focus,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: BOOKS_SURFACES.highest,
    borderStyle: 'dashed',
  },
  lockIcon: {
    fontSize: 24,
    opacity: 0.5,
  },
  lockedTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
    color: '#9F8E81',
  },
  lockedHint: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    color: '#9F8E81',
  },
});

// --- screen styles ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.base,
  },
  content: {
    padding: 20,
    gap: 16,
    paddingBottom: 100,
  },
  heroCard: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 8,
  },
  starIcon: {
    fontSize: 40,
    marginBottom: 4,
  },
  heroTitle: {
    ...BOOKS_TYPOGRAPHY.displayLg,
    color: '#E4E1E9',
    textAlign: 'center',
  },
  heroDesc: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: '#D6C3B5',
    textAlign: 'center',
    lineHeight: 20,
  },
  heroCountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 8,
  },
  heroCount: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 40,
    color: '#E4E1E9',
  },
  heroCountLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: ACCENT_WARM,
  },
  streakCard: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 4,
  },
  streakIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  streakValue: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 28,
    color: '#E4E1E9',
  },
  streakHint: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: '#9F8E81',
  },
  chipScroll: {
    flexGrow: 0,
    marginVertical: 4,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  categorySection: {
    gap: 12,
  },
  categoryLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#9F8E81',
    paddingHorizontal: 4,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
});
