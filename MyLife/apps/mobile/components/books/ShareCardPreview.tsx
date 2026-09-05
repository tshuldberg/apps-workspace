import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@mylife/ui';
import { getCardThemeColors, type CardData } from '@mylife/books';

interface ShareCardPreviewProps {
  data: CardData;
  width?: number;
}

export function ShareCardPreview({ data, width = 300 }: ShareCardPreviewProps) {
  const height = (width / 9) * 16;
  const themeColors = getCardThemeColors(data.theme);

  return (
    <View style={[styles.card, { width, height, backgroundColor: themeColors.background }]}>
      {data.showDisplayName && (
        <Text style={[styles.displayName, { color: themeColors.textSecondary }]}>
          {data.displayName}
        </Text>
      )}

      {data.templateId === 'year_summary' && (
        <View style={styles.section}>
          <Text style={[styles.bigNumber, { color: themeColors.text }]}>{data.totalBooks ?? 0}</Text>
          <Text style={[styles.label, { color: themeColors.textSecondary }]}>books read</Text>
          <Text style={[styles.stat, { color: themeColors.textSecondary }]}>
            {(data.totalPages ?? 0).toLocaleString()} pages
          </Text>
          {data.averageRating != null && (
            <Text style={[styles.stat, { color: themeColors.textSecondary }]}>
              {data.averageRating.toFixed(1)} avg rating
            </Text>
          )}
        </View>
      )}

      {data.templateId === 'monthly_chart' && data.monthlyBooks && (
        <View style={styles.chartSection}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Monthly Books</Text>
          <View style={styles.barChart}>
            {Object.entries(data.monthlyBooks).map(([month, count]) => {
              const maxCount = Math.max(...Object.values(data.monthlyBooks!), 1);
              const barHeight = Math.max((count / maxCount) * 60, 2);
              return (
                <View key={month} style={styles.barCol}>
                  <View style={[styles.chartBar, { height: barHeight, backgroundColor: themeColors.accent }]} />
                  <Text style={[styles.barLabel, { color: themeColors.textSecondary }]}>
                    {month.slice(0, 3)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {data.templateId === 'genre_breakdown' && data.genreDistribution && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Genres</Text>
          {data.genreDistribution.slice(0, 5).map((g) => (
            <View key={g.genre} style={styles.genreRow}>
              <Text style={[styles.genreLabel, { color: themeColors.text }]}>{g.genre}</Text>
              <View style={[styles.genreBar, { width: `${g.percentage}%`, backgroundColor: themeColors.accent }]} />
            </View>
          ))}
        </View>
      )}

      {data.templateId === 'top_authors' && data.topAuthors && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Top Authors</Text>
          {data.topAuthors.map((a, i) => (
            <Text key={a.author} style={[styles.authorRow, { color: themeColors.text }]}>
              {i + 1}. {a.author} ({a.count})
            </Text>
          ))}
        </View>
      )}

      {data.templateId === 'reading_streak' && (
        <View style={styles.section}>
          <Text style={[styles.bigNumber, { color: themeColors.text }]}>{data.currentStreak ?? 0}</Text>
          <Text style={[styles.label, { color: themeColors.textSecondary }]}>day streak</Text>
          <Text style={[styles.stat, { color: themeColors.textSecondary }]}>
            Longest: {data.longestStreak ?? 0} days
          </Text>
          {data.recentDays && (
            <View style={styles.dotGrid}>
              {data.recentDays.map((active, i) => (
                <View
                  key={i}
                  style={[styles.dot, { backgroundColor: active ? themeColors.accent : themeColors.backgroundGradient }]}
                />
              ))}
            </View>
          )}
        </View>
      )}

      <Text style={[styles.watermark, { color: themeColors.textSecondary }]}>MyBooks</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  displayName: {
    fontSize: 12,
    position: 'absolute',
    top: 16,
  },
  section: {
    alignItems: 'center',
    gap: 6,
  },
  chartSection: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  bigNumber: {
    fontSize: 48,
    fontWeight: '700',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
  },
  stat: {
    fontSize: 13,
  },
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    width: '100%',
    height: 80,
  },
  barCol: {
    alignItems: 'center',
    gap: 2,
  },
  chartBar: {
    width: 12,
    borderRadius: 3,
  },
  barLabel: {
    fontSize: 8,
  },
  genreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  genreLabel: {
    fontSize: 12,
    width: 80,
  },
  genreBar: {
    height: 8,
    borderRadius: 4,
    maxWidth: '60%',
  },
  authorRow: {
    fontSize: 14,
  },
  dotGrid: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  watermark: {
    fontSize: 10,
    position: 'absolute',
    bottom: 12,
    opacity: 0.5,
  },
});
