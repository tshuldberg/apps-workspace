import type { ReactNode } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import {
  GlassPanel,
  MaterialSymbol,
  WK_ACCENT,
  WK_ACCENT_DARK,
  WK_ACCENT_LIGHT,
  WK_CATEGORY_COLORS,
  WK_FONTS,
  WK_GLASS_NAV,
  WK_SURFACES,
  WK_TYPOGRAPHY,
} from '@mylife/workouts';

export function WorkoutTabScrollView({
  children,
  refreshing = false,
  onRefresh,
  contentContainerStyle,
  stickyHeaderIndices = [0],
  ...props
}: ScrollViewProps & {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <ScrollView
      {...props}
      style={[styles.screen, props.style]}
      stickyHeaderIndices={stickyHeaderIndices}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={WK_ACCENT}
            colors={[WK_ACCENT]}
          />
        ) : props.refreshControl
      }
      contentContainerStyle={[styles.content, contentContainerStyle]}
    >
      {children}
    </ScrollView>
  );
}

export function WorkoutTopBar({
  title = 'MyWorkouts',
  subtitle,
  right,
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.topBarWrap}>
      <BlurView tint="dark" intensity={WK_GLASS_NAV.blur} style={StyleSheet.absoluteFillObject} />
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <LinearGradient
            colors={['rgba(255, 184, 119, 0.30)', 'rgba(201, 137, 77, 0.18)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatar}
          >
            <MaterialSymbol name="fitness_center" size={18} color={WK_ACCENT_LIGHT} />
          </LinearGradient>
          <View style={styles.brandCopy}>
            <RNText style={styles.brandTitle}>{title}</RNText>
            {subtitle ? <RNText style={styles.brandSubtitle}>{subtitle}</RNText> : null}
          </View>
        </View>

        <View style={styles.topBarRight}>{right}</View>
      </View>
    </View>
  );
}

export function WorkoutIconButton({
  name,
  onPress,
  color = 'rgba(228, 225, 233, 0.74)',
}: {
  name: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable onPress={onPress} style={styles.iconButton}>
      <MaterialSymbol name={name} size={20} color={color} />
    </Pressable>
  );
}

export function WorkoutHero({
  eyebrow,
  title,
  subtitle,
  accent = WK_ACCENT,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  accent?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.hero}>
      <View style={{ flex: 1, gap: 8 }}>
        <RNText style={[styles.eyebrow, { color: accent }]}>{eyebrow}</RNText>
        <RNText style={styles.heroTitle}>{title}</RNText>
        {subtitle ? <RNText style={styles.heroSubtitle}>{subtitle}</RNText> : null}
      </View>
      {action}
    </View>
  );
}

export function WorkoutSectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <RNText style={styles.sectionTitle}>{title}</RNText>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction}>
          <RNText style={styles.sectionAction}>{actionLabel}</RNText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function WorkoutPrimaryButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <LinearGradient
        colors={[WK_ACCENT_LIGHT, WK_ACCENT]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryButton}
      >
        {icon ? <MaterialSymbol name={icon} size={16} color={WK_ACCENT_DARK} /> : null}
        <RNText style={styles.primaryButtonText}>{label}</RNText>
      </LinearGradient>
    </Pressable>
  );
}

export function WorkoutSecondaryButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.secondaryButton}>
      {icon ? <MaterialSymbol name={icon} size={16} color={WK_ACCENT_LIGHT} /> : null}
      <RNText style={styles.secondaryButtonText}>{label}</RNText>
    </Pressable>
  );
}

export function WorkoutValuePill({
  label,
  value,
  tint = WK_ACCENT_LIGHT,
}: {
  label: string;
  value: string;
  tint?: string;
}) {
  return (
    <GlassPanel padding={14} style={styles.valuePill}>
      <RNText style={styles.valuePillLabel}>{label}</RNText>
      <RNText style={[styles.valuePillValue, { color: tint }]}>{value}</RNText>
    </GlassPanel>
  );
}

export function WorkoutTile({
  icon,
  title,
  subtitle,
  value,
  onPress,
  accent = WK_ACCENT_LIGHT,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  value?: string;
  onPress: () => void;
  accent?: string;
}) {
  return (
    <GlassPanel padding={18} onPress={onPress} style={styles.tile}>
      <View style={[styles.tileIcon, { backgroundColor: `${accent}22` }]}>
        <MaterialSymbol name={icon} size={18} color={accent} />
      </View>
      <View style={styles.tileCopy}>
        <RNText style={styles.tileTitle}>{title}</RNText>
        {subtitle ? <RNText style={styles.tileSubtitle}>{subtitle}</RNText> : null}
      </View>
      {value ? <RNText style={styles.tileValue}>{value}</RNText> : null}
      <MaterialSymbol
        name="chevron_right"
        size={18}
        color="rgba(214, 195, 181, 0.54)"
      />
    </GlassPanel>
  );
}

export function WorkoutCategoryDot({
  color,
}: {
  color: string;
}) {
  return <View style={[styles.dot, { backgroundColor: color }]} />;
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

export function formatVolume(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(value)));
}

export function formatDateLabel(value: string | null | undefined): string {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTimeLabel(value: string | null | undefined): string {
  if (!value) return 'No timestamp';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatMinutes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0m';
  if (value >= 60) {
    const hours = Math.floor(value / 60);
    const minutes = value % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${Math.round(value)}m`;
}

export function formatDeltaPercent(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return 'No prior period';
  if (value === 0) return 'Flat vs prior';
  return `${value > 0 ? '+' : ''}${value}% vs prior`;
}

export function getDeltaTint(value: number | null): string {
  if (value == null || value === 0) return 'rgba(214, 195, 181, 0.72)';
  return value > 0 ? WK_CATEGORY_COLORS.recovery : '#FFB4AB';
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: WK_SURFACES.base,
  },
  content: {
    paddingBottom: 160,
  },
  topBarWrap: {
    minHeight: 124,
    backgroundColor: WK_GLASS_NAV.backgroundColor,
    overflow: 'hidden',
  },
  backToHub: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingTop: 52,
    paddingBottom: 2,
    paddingLeft: 16,
    paddingRight: 12,
    gap: 2,
  },
  backToHubLabel: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 16,
    color: 'rgba(214, 195, 181, 0.78)',
    letterSpacing: 0.2,
  },
  topBar: {
    paddingTop: 4,
    paddingHorizontal: 24,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandCopy: {
    gap: 2,
  },
  brandTitle: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 18,
    lineHeight: 20,
    color: WK_ACCENT,
    letterSpacing: -0.4,
  },
  brandSubtitle: {
    fontFamily: WK_FONTS.medium,
    fontSize: 10,
    lineHeight: 12,
    color: 'rgba(214, 195, 181, 0.6)',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  hero: {
    paddingHorizontal: 24,
    paddingTop: 20,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  eyebrow: {
    ...WK_TYPOGRAPHY.labelUpper,
  },
  heroTitle: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 36,
    lineHeight: 40,
    color: '#E4E1E9',
    letterSpacing: -1.2,
  },
  heroSubtitle: {
    ...WK_TYPOGRAPHY.bodyMd,
    color: 'rgba(214, 195, 181, 0.78)',
    maxWidth: 320,
  },
  sectionHeader: {
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    color: '#E4E1E9',
    letterSpacing: -0.4,
  },
  sectionAction: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
    color: WK_ACCENT_LIGHT,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  primaryButton: {
    minHeight: 42,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 12,
    lineHeight: 14,
    color: WK_ACCENT_DARK,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  secondaryButton: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: WK_SURFACES.high,
  },
  secondaryButtonText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 14,
    color: 'rgba(228, 225, 233, 0.88)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  valuePill: {
    minWidth: 92,
    alignItems: 'flex-start',
    gap: 6,
  },
  valuePillLabel: {
    ...WK_TYPOGRAPHY.labelUpper,
    color: 'rgba(214, 195, 181, 0.68)',
  },
  valuePillValue: {
    fontFamily: WK_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: -0.4,
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileCopy: {
    flex: 1,
    gap: 4,
  },
  tileTitle: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: '#E4E1E9',
  },
  tileSubtitle: {
    ...WK_TYPOGRAPHY.bodySm,
    color: 'rgba(214, 195, 181, 0.72)',
  },
  tileValue: {
    fontFamily: WK_FONTS.bold,
    fontSize: 12,
    lineHeight: 14,
    color: WK_ACCENT_LIGHT,
    marginRight: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
