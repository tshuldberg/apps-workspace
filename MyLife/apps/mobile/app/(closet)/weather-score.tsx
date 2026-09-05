import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  listClothingItems,
  recommendForWeather,
  scoreItemForWeather,
  getRecommendedCategories,
  getLayerLabel,
  type ClothingItem,
  type WeatherCondition,
} from '@mylife/closet';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = '#E879A8';

function scoreColor(score: number): string {
  if (score >= 80) return colors.success;
  if (score >= 50) return '#FF9F0A';
  return colors.danger;
}

export default function WeatherScoreScreen() {
  const db = useDatabase();
  const [tempStr, setTempStr] = useState('70');
  const [condition, setCondition] = useState('clear');

  const items: ClothingItem[] = useMemo(() => {
    try { return listClothingItems(db, {}); } catch { return []; }
  }, [db]);

  const tempF = parseInt(tempStr, 10) || 70;
  const weather: WeatherCondition = useMemo(() => ({
    temperatureF: tempF,
    condition,
    humidity: null,
    windSpeedMph: null,
  }), [tempF, condition]);

  const recommendations = useMemo(() => {
    try { return recommendForWeather(items, weather, 10); } catch { return []; }
  }, [items, weather]);

  const layerLabel = useMemo(() => getLayerLabel(tempF), [tempF]);
  const categories = useMemo(() => getRecommendedCategories(tempF), [tempF]);

  const CONDITIONS = ['clear', 'cloudy', 'rain', 'snow', 'windy'];

  if (items.length === 0) {
    return (
      <View style={styles.emptyScreen}>
        <Text style={styles.emptyIcon}>🌤️</Text>
        <Text variant="subheading" color={colors.textSecondary}>Weather Score</Text>
        <Text variant="caption" color={colors.textTertiary}>
          Add items to your wardrobe to see weather-based scores.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading" style={{ color: ACCENT }}>Weather Score</Text>

      <Card>
        <Text variant="label" color={colors.textTertiary}>WEATHER</Text>
        <View style={styles.weatherRow}>
          <Text variant="body">Temperature:</Text>
          <TextInput
            style={styles.tempInput}
            value={tempStr}
            onChangeText={setTempStr}
            keyboardType="number-pad"
            placeholder="70"
            placeholderTextColor={colors.textTertiary}
          />
          <Text variant="body" color={colors.textSecondary}>F</Text>
        </View>
        <View style={styles.chipRow}>
          {CONDITIONS.map((c) => (
            <View
              key={c}
              style={[styles.chip, condition === c && { backgroundColor: ACCENT }]}
              onTouchEnd={() => setCondition(c)}
            >
              <Text variant="caption" color={condition === c ? colors.background : colors.textSecondary}>
                {c}
              </Text>
            </View>
          ))}
        </View>
        <Text variant="caption" color={colors.textSecondary} style={{ marginTop: spacing.sm }}>
          Layer: {layerLabel}
        </Text>
      </Card>

      {/* 7-day placeholder */}
      <Card>
        <Text variant="label" color={colors.textTertiary}>WHAT TO WEAR</Text>
        <Text variant="body" color={colors.textSecondary}>
          Recommended categories for {tempF}F {condition}:
        </Text>
        <View style={styles.chipRow}>
          {categories.map((cat) => (
            <View key={cat} style={styles.categoryChip}>
              <Text variant="iconCaption" color={ACCENT}>{cat}</Text>
            </View>
          ))}
        </View>
      </Card>

      {/* Scored items */}
      {recommendations.length > 0 && (
        <Card>
          <Text variant="label" color={colors.textTertiary}>TOP RECOMMENDATIONS</Text>
          {recommendations.map((rec) => (
            <View key={rec.itemId} style={styles.recRow}>
              <View style={styles.recInfo}>
                <Text variant="body">{rec.itemName}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {rec.category} {rec.reason ? `- ${rec.reason}` : ''}
                </Text>
              </View>
              <View style={[styles.scoreBadge, { backgroundColor: scoreColor(rec.score) }]}>
                <Text variant="iconCaption" color={colors.background}>
                  {rec.score}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  emptyScreen: {
    flex: 1, backgroundColor: colors.background, justifyContent: 'center',
    alignItems: 'center', padding: spacing.xl,
  },
  emptyIcon: { fontSize: 48, marginBottom: spacing.sm },
  weatherRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm,
  },
  tempInput: {
    width: 60, backgroundColor: colors.surfaceElevated, borderRadius: 8,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    color: colors.text, borderWidth: 1, borderColor: colors.border,
    textAlign: 'center', minHeight: 44,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  chip: {
    backgroundColor: colors.surfaceElevated, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  categoryChip: {
    backgroundColor: colors.surfaceElevated, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: ACCENT,
  },
  recRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.glass,
  },
  recInfo: { flex: 1, gap: 2 },
  scoreBadge: { borderRadius: 12, width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
});
