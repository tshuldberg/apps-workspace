import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from './GlassCard';
import {
  MOOD_ACCENT,
  MOOD_ACCENT_LIGHT,
  MOOD_SURFACES,
  MOOD_TYPOGRAPHY,
} from './tokens';
import { colors } from '@mylife/ui';

interface PetCardProps {
  name: string;
  mood: string;
  happiness: number;
  imageUrl?: string;
  onPress?: () => void;
}

export function PetCard({
  name,
  mood,
  happiness,
  imageUrl,
  onPress,
}: PetCardProps) {
  const clampedHappiness = Math.max(0, Math.min(100, happiness));

  return (
    <GlassCard level={2} onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        {imageUrl != null ? (
          <Image source={{ uri: imageUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.placeholderEmoji}>{'\uD83D\uDC23'}</Text>
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.mood}>{mood.toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.meterSection}>
        <Text style={styles.meterLabel}>HAPPINESS METER</Text>
        <View style={styles.meterRow}>
          <View style={styles.meterTrack}>
            <LinearGradient
              colors={[MOOD_ACCENT_LIGHT, MOOD_ACCENT]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.meterFill, { width: `${clampedHappiness}%` }]}
            />
          </View>
          <Text style={styles.meterValue}>{clampedHappiness}%</Text>
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    backgroundColor: MOOD_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderEmoji: {
    fontSize: 28,
  },
  info: {
    gap: 2,
  },
  name: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  mood: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    color: MOOD_ACCENT,
  },
  meterSection: {
    gap: 6,
  },
  meterLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    color: colors.textSecondary,
  },
  meterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  meterTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: MOOD_SURFACES.highest,
    overflow: 'hidden',
  },
  meterFill: {
    height: 4,
    borderRadius: 2,
  },
  meterValue: {
    fontFamily: MOOD_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
