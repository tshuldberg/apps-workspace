import type { ReactNode } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  MaterialSymbol,
  WK_ACCENT,
  WK_ACCENT_DARK,
  WK_ACCENT_LIGHT,
  WK_FONTS,
  WK_SURFACES,
} from '@mylife/workouts';
import {
  formatDifficultyLabel,
  getDifficultyStars,
  getExerciseArtworkLabel,
  withAlpha,
} from '../../lib/workouts/phase3';

export function WorkoutRouteHeader({
  title,
  overline,
  onBack,
  right,
}: {
  title: string;
  overline?: string;
  onBack: () => void;
  right?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} style={styles.headerButton}>
        <MaterialSymbol name="arrow_back" size={20} color="rgba(228, 225, 233, 0.78)" />
      </Pressable>

      <View style={styles.headerCopy}>
        {overline ? <Text style={styles.overline}>{overline}</Text> : null}
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

export function DifficultyStars({
  difficulty,
  tint = WK_ACCENT_LIGHT,
}: {
  difficulty: string;
  tint?: string;
}) {
  const active = getDifficultyStars(difficulty);
  return (
    <View style={styles.starsRow}>
      {[0, 1, 2].map((index) => (
        <MaterialSymbol
          key={`${difficulty}-${index}`}
          name="star"
          size={14}
          color={index < active ? tint : 'rgba(214, 195, 181, 0.28)'}
        />
      ))}
      <Text style={styles.starsLabel}>{formatDifficultyLabel(difficulty)}</Text>
    </View>
  );
}

export function ExerciseArtwork({
  title,
  accent,
  uri,
  height = 200,
}: {
  title: string;
  accent: string;
  uri?: string | null;
  height?: number;
}) {
  return (
    <View style={[styles.artwork, { height }]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      ) : (
        <LinearGradient
          colors={[withAlpha(accent, 'CC'), withAlpha(accent, '22')]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      )}
      <View style={styles.artworkOverlay} />
      {!uri ? (
        <View style={styles.artworkMonogram}>
          <Text style={styles.artworkMonogramText}>{getExerciseArtworkLabel({ name: title })}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function StickyActionBar({
  primaryLabel,
  onPrimary,
  primaryIcon = 'arrow_forward',
  secondaryLabel,
  onSecondary,
}: {
  primaryLabel: string;
  onPrimary: () => void;
  primaryIcon?: string;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <View style={styles.stickyWrap}>
      <View style={styles.stickyBar}>
        {secondaryLabel && onSecondary ? (
          <Pressable onPress={onSecondary} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>{secondaryLabel}</Text>
          </Pressable>
        ) : null}

        <Pressable onPress={onPrimary} style={styles.primaryButton}>
          <LinearGradient
            colors={[WK_ACCENT_LIGHT, WK_ACCENT]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryGradient}
          >
            <MaterialSymbol name={primaryIcon} size={18} color={WK_ACCENT_DARK} />
            <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 56,
    paddingHorizontal: 24,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WK_SURFACES.low,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  headerRight: {
    minWidth: 38,
    alignItems: 'flex-end',
  },
  overline: {
    fontFamily: WK_FONTS.medium,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: WK_ACCENT_LIGHT,
  },
  headerTitle: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.8,
    color: '#E4E1E9',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  starsLabel: {
    marginLeft: 4,
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(214, 195, 181, 0.72)',
  },
  artwork: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: WK_SURFACES.low,
  },
  artworkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(14, 14, 19, 0.26)',
  },
  artworkMonogram: {
    position: 'absolute',
    bottom: 18,
    left: 18,
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14, 14, 19, 0.48)',
  },
  artworkMonogramText: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 22,
    lineHeight: 24,
    letterSpacing: -0.8,
    color: '#E4E1E9',
  },
  stickyWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  stickyBar: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    padding: 10,
    borderRadius: 24,
    backgroundColor: 'rgba(19, 19, 24, 0.94)',
  },
  primaryButton: {
    flex: 1,
    borderRadius: 999,
    overflow: 'hidden',
  },
  primaryGradient: {
    minHeight: 54,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 14,
    lineHeight: 16,
    letterSpacing: 0.2,
    color: WK_ACCENT_DARK,
    textTransform: 'uppercase',
  },
  secondaryButton: {
    minHeight: 54,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WK_SURFACES.low,
  },
  secondaryButtonText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 16,
    color: 'rgba(228, 225, 233, 0.82)',
  },
});
