import React from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, Card, ReadingGoalRing, Button, colors, spacing } from '@mybooks/ui';
import { mockGoal, mockReviews, finishedCount, mockSessions } from '@/data/mock';

export default function StatsScreen() {
  const router = useRouter();
  const booksRead = finishedCount();
  const totalPages = mockSessions
    .filter((s) => s.status === 'finished')
    .reduce((sum, s) => sum + s.current_page, 0);
  const avgRating =
    mockReviews.length > 0
      ? mockReviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / mockReviews.length
      : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Year at a glance */}
      <View style={styles.yearSection}>
        <Text variant="heading">{mockGoal.year}</Text>
        <ReadingGoalRing
          current={booksRead}
          target={mockGoal.target_books}
          size={160}
        />
      </View>

      {/* Stat cards */}
      <View style={styles.statGrid}>
        <Card style={styles.statCard}>
          <Text variant="stat" color={colors.accent}>{booksRead}</Text>
          <Text variant="label" color={colors.textSecondary}>Books Read</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text variant="stat" color={colors.accent}>{totalPages.toLocaleString()}</Text>
          <Text variant="label" color={colors.textSecondary}>Pages Read</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text variant="stat" color={colors.accent}>{avgRating.toFixed(1)}</Text>
          <Text variant="label" color={colors.textSecondary}>Avg Rating</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text variant="stat" color={colors.accent}>
            {booksRead > 0 ? Math.round(totalPages / booksRead) : 0}
          </Text>
          <Text variant="label" color={colors.textSecondary}>Avg Pages/Book</Text>
        </Card>
      </View>

      {/* Monthly chart placeholder */}
      <Card style={styles.chartCard}>
        <Text variant="subheading">Monthly Breakdown</Text>
        <View style={styles.chartPlaceholder}>
          {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((month) => (
            <View key={month} style={styles.barColumn}>
              <View
                style={[
                  styles.bar,
                  {
                    height: month === 'Jan' ? 40 : month === 'Feb' ? 24 : 8,
                    backgroundColor: month === 'Jan' || month === 'Feb' ? colors.accent : colors.surfaceElevated,
                  },
                ]}
              />
              <Text variant="caption" color={colors.textTertiary}>{month}</Text>
            </View>
          ))}
        </View>
      </Card>

      {/* Rating distribution placeholder */}
      <Card style={styles.chartCard}>
        <Text variant="subheading">Rating Distribution</Text>
        <View style={styles.ratingDistribution}>
          {[5, 4.5, 4, 3.5, 3].map((r) => {
            const count = mockReviews.filter((rev) => rev.rating === r).length;
            return (
              <View key={r} style={styles.ratingRow}>
                <Text variant="caption" color={colors.textSecondary} style={styles.ratingLabel}>
                  {r}
                </Text>
                <View style={styles.ratingBarTrack}>
                  <View
                    style={[
                      styles.ratingBarFill,
                      { width: count > 0 ? `${Math.max(count * 50, 10)}%` : '0%' },
                    ]}
                  />
                </View>
                <Text variant="caption" color={colors.textTertiary}>{count}</Text>
              </View>
            );
          })}
        </View>
      </Card>

      {/* Year in Review CTA */}
      <View style={styles.reviewCTA}>
        <Button
          variant="primary"
          label="View Year in Review"
          onPress={() => router.push('/year-review')}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  yearSection: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    width: '48%' as unknown as number,
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  chartCard: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  chartPlaceholder: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 60,
    paddingTop: spacing.sm,
  },
  barColumn: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  bar: {
    width: 24,
    borderRadius: 4,
  },
  ratingDistribution: {
    gap: spacing.xs,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ratingLabel: {
    width: 28,
    textAlign: 'right',
  },
  ratingBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 4,
  },
  ratingBarFill: {
    height: 8,
    backgroundColor: colors.star,
    borderRadius: 4,
  },
  reviewCTA: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
});
