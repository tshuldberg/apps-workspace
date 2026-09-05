// Shared layout primitives for DoWork tabs.
//
// Mirrors apps/mobile/app/(workouts)/(tabs)/_screen-kit.tsx but uses DoWork
// brand tokens. Provides: WorkoutHero, WorkoutSectionHeader, WorkoutTabScrollView,
// WorkoutPrimaryButton plus a few formatters.

import React from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WK_FONTS } from '@mylife/workouts';
import {
  DW_ACCENT,
  DW_BORDER,
  DW_ON_ACCENT,
  DW_SURFACES,
  DW_TEXT,
} from '../theme/tokens';

export function WorkoutHero({
  title,
  subtitle,
  trailing,
}: {
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <View style={styles.hero}>
      <View style={styles.heroText}>
        <Text style={styles.heroTitle}>{title}</Text>
        {subtitle ? <Text style={styles.heroSubtitle}>{subtitle}</Text> : null}
      </View>
      {trailing ? <View>{trailing}</View> : null}
    </View>
  );
}

export function WorkoutSectionHeader({
  title,
  trailing,
}: {
  title: string;
  trailing?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {trailing}
    </View>
  );
}

export function WorkoutTabScrollView({
  refreshing,
  onRefresh,
  children,
  contentStyle,
}: {
  refreshing?: boolean;
  onRefresh?: () => void;
  children: React.ReactNode;
  contentStyle?: ViewProps['style'];
}) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 96 },
        contentStyle,
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh
          ? (
              <RefreshControl
                refreshing={refreshing ?? false}
                onRefresh={onRefresh}
                tintColor={DW_ACCENT}
              />
            )
          : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

export function WorkoutPrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.primaryButton,
        pressed && { opacity: 0.86 },
        disabled && { opacity: 0.4 },
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function formatMinutes(durationSeconds: number): string {
  if (!durationSeconds || durationSeconds < 0) return '0m';
  const minutes = Math.round(durationSeconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

export function formatVolume(volume: number): string {
  if (!volume || volume <= 0) return '0';
  if (volume >= 1000) return `${(volume / 1000).toFixed(1)}k`;
  return volume.toString();
}

export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) >= 1000) {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: value >= 10000 ? 0 : 1,
      notation: 'compact',
    }).format(value);
  }
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: value >= 100 ? 0 : 1,
  }).format(value);
}

export function formatDeltaPercent(delta: number | null): string {
  if (delta === null) return '—';
  const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '·';
  return `${arrow} ${Math.abs(delta)}%`;
}

export function formatDateLabel(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const now = new Date();
  const ageMs = now.getTime() - date.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  if (ageMs < dayMs) return 'Today';
  if (ageMs < 2 * dayMs) return 'Yesterday';
  if (ageMs < 7 * dayMs) return `${Math.floor(ageMs / dayMs)}d ago`;
  return date.toLocaleDateString();
}

export function getDeltaTint(delta: number | null): string {
  if (delta === null || delta === 0) return DW_TEXT.tertiary;
  if (delta > 0) return '#30D158';
  return '#FF6B6B';
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 16,
  },
  heroText: {
    flex: 1,
    gap: 4,
  },
  heroTitle: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 32,
    color: DW_TEXT.primary,
    letterSpacing: -1,
  },
  heroSubtitle: {
    fontFamily: WK_FONTS.medium,
    fontSize: 14,
    color: DW_TEXT.secondary,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 12,
    color: DW_TEXT.secondary,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  scroll: {
    flex: 1,
    backgroundColor: DW_SURFACES.base,
  },
  scrollContent: {
    paddingHorizontal: 0,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: DW_ACCENT,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: DW_BORDER.subtle,
  },
  primaryButtonText: {
    color: DW_ON_ACCENT,
    fontFamily: WK_FONTS.bold,
    fontSize: 15,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
