import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
  type ScrollViewProps,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import {
  MaterialSymbol,
  WK_ACCENT,
  WK_ACCENT_DARK,
  WK_ACCENT_LIGHT,
  WK_FONTS,
  WK_SURFACES,
  WK_TYPOGRAPHY,
} from '@mylife/workouts';

export function WorkoutPhaseScreen({
  children,
  contentContainerStyle,
  ...props
}: ScrollViewProps) {
  return (
    <View style={styles.screen}>
      <ScrollView
        {...props}
        style={styles.scroll}
        contentContainerStyle={[styles.content, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function WorkoutPhaseHeader({
  title,
  onBack,
  right,
  close = false,
}: {
  title: string;
  onBack: () => void;
  right?: ReactNode;
  close?: boolean;
}) {
  return (
    <View style={styles.headerShell}>
      <BlurView tint="dark" intensity={20} style={StyleSheet.absoluteFillObject} />
      <View style={styles.headerRow}>
        <Pressable onPress={onBack} style={styles.headerButton}>
          <MaterialSymbol
            name={close ? 'close' : 'arrow_back'}
            size={18}
            color="rgba(228, 225, 233, 0.88)"
          />
        </Pressable>
        <RNText style={styles.headerTitle}>{title}</RNText>
        <View style={styles.headerRight}>{right}</View>
      </View>
    </View>
  );
}

export function WorkoutGradientButton({
  label,
  onPress,
  icon,
  disabled = false,
  colors = [WK_ACCENT_LIGHT, WK_ACCENT],
}: {
  label: string;
  onPress: () => void;
  icon?: string;
  disabled?: boolean;
  colors?: [string, string];
}) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={disabled ? styles.disabled : undefined}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientButton}
      >
        {icon ? <MaterialSymbol name={icon} size={16} color={WK_ACCENT_DARK} /> : null}
        <RNText style={styles.gradientButtonText}>{label}</RNText>
      </LinearGradient>
    </Pressable>
  );
}

export function WorkoutGhostButton({
  label,
  onPress,
  icon,
  accent = 'rgba(228, 225, 233, 0.84)',
}: {
  label: string;
  onPress: () => void;
  icon?: string;
  accent?: string;
}) {
  return (
    <Pressable onPress={onPress} style={styles.ghostButton}>
      {icon ? <MaterialSymbol name={icon} size={16} color={accent} /> : null}
      <RNText style={[styles.ghostButtonText, { color: accent }]}>{label}</RNText>
    </Pressable>
  );
}

export function WorkoutEyebrow({
  children,
  accent = WK_ACCENT_LIGHT,
}: {
  children: ReactNode;
  accent?: string;
}) {
  return <RNText style={[styles.eyebrow, { color: accent }]}>{children}</RNText>;
}

export function WorkoutHeroTitle({ children }: { children: ReactNode }) {
  return <RNText style={styles.heroTitle}>{children}</RNText>;
}

export function WorkoutBodyCopy({ children }: { children: ReactNode }) {
  return <RNText style={styles.bodyCopy}>{children}</RNText>;
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatMinutesLabel(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0 min';
  return `${Math.round(minutes)} min`;
}

export function formatDateLabel(value: string): string {
  const date = new Date(value);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTimeLabel(value: string): string {
  const date = new Date(value);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatVolumeLabel(volume: number): string {
  if (!Number.isFinite(volume) || volume <= 0) return '0 lbs';
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(volume >= 10000 ? 0 : 1)}k lbs`;
  }
  return `${Math.round(volume)} lbs`;
}

export function estimateWorkoutVolume(sets: number, reps: number, weight: number): number {
  return Math.max(0, sets) * Math.max(0, reps) * Math.max(0, weight);
}

export function avatarLabel(displayName: string): string {
  const trimmed = displayName.trim();
  return trimmed.length > 0 ? trimmed.charAt(0).toUpperCase() : 'M';
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: WK_SURFACES.lowest,
  },
  scroll: {
    flex: 1,
    backgroundColor: WK_SURFACES.lowest,
  },
  content: {
    paddingBottom: 172,
  },
  headerShell: {
    minHeight: 94,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    backgroundColor: 'rgba(19, 19, 24, 0.7)',
  },
  headerRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#E4E1E9',
    fontFamily: WK_FONTS.semiBold,
    fontSize: 15,
    lineHeight: 18,
    letterSpacing: -0.2,
    textTransform: 'uppercase',
  },
  headerRight: {
    minWidth: 38,
    alignItems: 'flex-end',
  },
  gradientButton: {
    minHeight: 52,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  gradientButtonText: {
    color: WK_ACCENT_DARK,
    fontFamily: WK_FONTS.semiBold,
    fontSize: 15,
    lineHeight: 18,
    letterSpacing: -0.2,
  },
  disabled: {
    opacity: 0.45,
  },
  ghostButton: {
    minHeight: 48,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  ghostButtonText: {
    fontFamily: WK_FONTS.medium,
    fontSize: 14,
    lineHeight: 18,
  },
  eyebrow: {
    ...WK_TYPOGRAPHY.labelUpper,
  },
  heroTitle: {
    ...WK_TYPOGRAPHY.displayLg,
    color: '#E4E1E9',
    fontSize: 36,
    lineHeight: 40,
  },
  bodyCopy: {
    ...WK_TYPOGRAPHY.bodyMd,
    color: 'rgba(214, 195, 181, 0.82)',
  },
});
