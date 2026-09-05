import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HB_ACCENT_LIGHT, HB_SURFACES, HB_TEXT, HB_TEXT_SECONDARY, HB_TYPOGRAPHY, withAlpha } from '../tokens';
import { GlassCard } from './GlassCard';
import { MaterialSymbol } from './MaterialSymbol';

export type BadgeTileBadge = {
  name: string;
  description: string;
  icon?: string;
  category?: string;
};

export interface BadgeTileProps {
  badge: BadgeTileBadge;
  earned: boolean;
  progress?: number;
  onPress?: () => void;
}

export function BadgeTile({
  badge,
  earned,
  progress,
  onPress,
}: BadgeTileProps) {
  const tint = earned ? HB_ACCENT_LIGHT : HB_TEXT_SECONDARY;
  const safeProgress = Math.min(1, Math.max(0, progress ?? 0));

  return (
    <Pressable disabled={onPress == null} onPress={onPress}>
      <GlassCard
        level={earned ? 4 : 2}
        style={[
          styles.card,
          earned ? styles.cardEarned : styles.cardLocked,
        ]}
      >
        <View style={styles.topRow}>
          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor: withAlpha(tint, earned ? 0.22 : 0.12),
              },
            ]}
          >
            <MaterialSymbol
              name={badge.icon ?? 'military_tech'}
              size={22}
              color={tint}
              filled={earned}
            />
          </View>
          {badge.category ? (
            <View style={styles.categoryChip}>
              <Text style={styles.categoryText}>
                {badge.category}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.title, { color: earned ? HB_TEXT : HB_TEXT_SECONDARY }]}>
          {badge.name}
        </Text>
        <Text style={styles.description}>
          {badge.description}
        </Text>
        {!earned ? (
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${safeProgress * 100}%`,
                },
              ]}
            />
          </View>
        ) : null}
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 176,
  },
  cardEarned: {
    shadowColor: HB_ACCENT_LIGHT,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  cardLocked: {
    opacity: 0.86,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChip: {
    borderRadius: 999,
    backgroundColor: HB_SURFACES.high,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  categoryText: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_TEXT_SECONDARY,
  },
  title: {
    ...HB_TYPOGRAPHY.headlineMd,
    marginBottom: 6,
  },
  description: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    fontSize: 13,
    lineHeight: 18,
  },
  progressTrack: {
    marginTop: 14,
    height: 8,
    borderRadius: 999,
    backgroundColor: HB_SURFACES.high,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: HB_ACCENT_LIGHT,
  },
});
