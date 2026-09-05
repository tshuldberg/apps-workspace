import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { SurfSpot } from '@mylife/surf';
import { getSpots, toggleSpotFavorite } from '@mylife/surf';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  SURF_ACCENT,
  SurfChip,
  SurfEmptyState,
  SurfGlassCard,
  SurfScreen,
  SurfSection,
} from './_ui';

const DIFFICULTIES = ['all', 'beginner', 'intermediate', 'advanced', 'expert'] as const;
const BREAK_TYPES = ['all', 'beach', 'point', 'reef'] as const;

function difficultyFromSpot(spot: SurfSpot): Exclude<(typeof DIFFICULTIES)[number], 'all'> {
  if (spot.breakType === 'beach') return 'beginner';
  if (spot.breakType === 'point') return 'intermediate';
  if (spot.breakType === 'reef') return 'advanced';
  return 'expert';
}

function difficultyColor(level: ReturnType<typeof difficultyFromSpot>): string {
  switch (level) {
    case 'beginner':
      return colors.success;
    case 'intermediate':
      return SURF_ACCENT;
    case 'advanced':
      return '#EAB308';
    default:
      return colors.danger;
  }
}

export default function SurfSpotsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>('all');
  const [breakType, setBreakType] = useState<(typeof BREAK_TYPES)[number]>('all');

  const spots = useMemo(() => getSpots(db), [db]);
  const filtered = useMemo(() => {
    return spots.filter((spot) => {
      const matchesQuery = !query.trim()
        || spot.name.toLowerCase().includes(query.trim().toLowerCase())
        || spot.region.toLowerCase().includes(query.trim().toLowerCase());
      const matchesDifficulty = difficulty === 'all' || difficultyFromSpot(spot) === difficulty;
      const matchesBreak = breakType === 'all' || spot.breakType === breakType;
      return matchesQuery && matchesDifficulty && matchesBreak;
    });
  }, [breakType, difficulty, query, spots]);

  return (
    <SurfScreen>
      <SurfSection eyebrow="Spots" title="Spot Explorer">
        <TextInput
          style={styles.searchInput}
          placeholder="Search spots..."
          placeholderTextColor={colors.textTertiary}
          value={query}
          onChangeText={setQuery}
        />
        <View style={styles.rowWrap}>
          {DIFFICULTIES.map((level) => (
            <SurfChip
              key={level}
              label={level === 'all' ? 'All levels' : level}
              active={difficulty === level}
              onPress={() => setDifficulty(level)}
            />
          ))}
        </View>
        <View style={styles.rowWrap}>
          {BREAK_TYPES.map((type) => (
            <SurfChip
              key={type}
              label={type === 'all' ? 'All breaks' : type}
              active={breakType === type}
              onPress={() => setBreakType(type)}
            />
          ))}
        </View>
      </SurfSection>

      {filtered.length === 0 ? (
        <SurfEmptyState
          icon="🌊"
          title="No spots match filters"
          copy="Try broadening the break type or difficulty mix to surface more breaks."
        />
      ) : (
        <View style={styles.list}>
          {filtered.map((spot) => {
            const level = difficultyFromSpot(spot);
            const levelColor = difficultyColor(level);
            return (
              <SurfGlassCard key={spot.id}>
                <View style={styles.spotHeader}>
                  <Pressable onPress={() => router.push(`/(surf)/spot/${spot.id}` as never)} style={styles.spotCopy}>
                    <Text variant="body" style={styles.spotName}>
                      {spot.name}
                    </Text>
                    <Text variant="caption" color={colors.textSecondary}>
                      {spot.region} · {spot.breakType} · {spot.waveHeightFt.toFixed(1)} ft · {spot.windKts.toFixed(0)} kts
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => toggleSpotFavorite(db, spot.id)} style={styles.favoriteButton}>
                    <Text variant="label" color={spot.isFavorite ? SURF_ACCENT : colors.textSecondary}>
                      {spot.isFavorite ? '★' : '☆'}
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.badgeRow}>
                  <View style={[styles.badge, { backgroundColor: `${levelColor}22` }]}>
                    <Text variant="caption" style={{ color: levelColor, fontWeight: '700' }}>
                      {level}
                    </Text>
                  </View>
                  <View style={styles.badge}>
                    <Text variant="caption" color={colors.textSecondary}>
                      {spot.breakType}
                    </Text>
                  </View>
                  <View style={styles.badge}>
                    <Text variant="caption" color={colors.textSecondary}>
                      {(spot.waveHeightFt * 0.75).toFixed(1)} ★
                    </Text>
                  </View>
                </View>
              </SurfGlassCard>
            );
          })}
        </View>
      )}
    </SurfScreen>
  );
}

const styles = StyleSheet.create({
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    color: colors.text,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  list: {
    gap: spacing.sm,
  },
  spotHeader: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  spotCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  spotName: {
    fontWeight: '700',
  },
  favoriteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
});
