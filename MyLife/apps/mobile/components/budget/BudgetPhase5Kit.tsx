import type { ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  BG_ACCENT_LIGHT,
  BG_DANGER,
  BG_FONTS,
  BG_MONEY,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  BG_TRANSFER,
  GlassCard,
  MaterialSymbol,
} from '@mylife/budget';

export type BudgetPhaseTone = 'money' | 'gold' | 'danger' | 'info' | 'neutral';

const TONE_COLOR: Record<BudgetPhaseTone, string> = {
  money: BG_MONEY,
  gold: BG_ACCENT_LIGHT,
  danger: BG_DANGER,
  info: BG_TRANSFER,
  neutral: BG_TEXT_SECONDARY,
};

export function toneColor(tone: BudgetPhaseTone): string {
  return TONE_COLOR[tone];
}

export function BudgetPhaseScreen({
  children,
  refreshControl,
  contentContainerStyle,
}: {
  children: ReactNode;
  refreshControl?: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <ScrollView
      contentContainerStyle={[styles.screenContent, contentContainerStyle]}
      refreshControl={refreshControl as never}
      style={styles.screen}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={['rgba(255, 184, 119, 0.16)', 'rgba(34, 197, 94, 0.04)', 'transparent']}
        end={{ x: 0.8, y: 0.5 }}
        pointerEvents="none"
        start={{ x: 0, y: 0 }}
        style={styles.heroGlow}
      />
      <LinearGradient
        colors={['rgba(139, 207, 240, 0.08)', 'transparent']}
        end={{ x: 1, y: 0.6 }}
        pointerEvents="none"
        start={{ x: 0, y: 0 }}
        style={styles.sideGlow}
      />
      {children}
    </ScrollView>
  );
}

export function BudgetPhaseHeader({
  eyebrow,
  eyebrowIcon = 'auto_awesome',
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  eyebrowIcon?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <View style={styles.eyebrowRow}>
          <MaterialSymbol color={BG_MONEY} name={eyebrowIcon} size={14} />
          <Text style={styles.eyebrow}>{eyebrow}</Text>
        </View>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      {action ? <View style={styles.headerAction}>{action}</View> : null}
    </View>
  );
}

export function BudgetHeroCard({
  tone = 'money',
  title,
  value,
  subtitle,
  detail,
  footer,
}: {
  tone?: BudgetPhaseTone;
  title: string;
  value: string;
  subtitle?: string;
  detail?: string;
  footer?: ReactNode;
}) {
  const color = toneColor(tone);
  return (
    <GlassCard padding={22} style={styles.heroCard}>
      <LinearGradient
        colors={[`${color}20`, 'rgba(255,255,255,0.04)']}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.heroCardContent}>
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroValue}>{value}</Text>
        {subtitle ? <Text style={styles.heroSubtitle}>{subtitle}</Text> : null}
        {detail ? <Text style={styles.heroDetail}>{detail}</Text> : null}
        {footer ? <View style={styles.heroFooter}>{footer}</View> : null}
      </View>
    </GlassCard>
  );
}

export function BudgetMetricCard({
  label,
  value,
  caption,
  tone = 'neutral',
  icon,
  style,
}: {
  label: string;
  value: string;
  caption?: string;
  tone?: BudgetPhaseTone;
  icon?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const color = toneColor(tone);
  return (
    <GlassCard padding={18} style={[styles.metricCard, style]}>
      <View style={styles.metricHeader}>
        <Text style={styles.metricLabel}>{label}</Text>
        {icon ? <MaterialSymbol color={color} name={icon} size={18} /> : null}
      </View>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      {caption ? <Text style={styles.metricCaption}>{caption}</Text> : null}
    </GlassCard>
  );
}

export function BudgetSection({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        </View>
        {action ? <View style={styles.sectionAction}>{action}</View> : null}
      </View>
      {children}
    </View>
  );
}

export function BudgetChip({
  label,
  active = false,
  tone = 'neutral',
  icon,
  onPress,
  disabled = false,
}: {
  label: string;
  active?: boolean;
  tone?: BudgetPhaseTone;
  icon?: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const color = toneColor(tone);
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.chip,
        active ? { backgroundColor: `${color}20` } : null,
        disabled ? styles.chipDisabled : null,
      ]}
    >
      {icon ? (
        <MaterialSymbol
          color={active ? color : BG_TEXT_TERTIARY}
          name={icon}
          size={14}
        />
      ) : null}
      <Text
        style={[
          styles.chipLabel,
          { color: active ? color : BG_TEXT_SECONDARY },
          disabled ? styles.chipLabelDisabled : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function BudgetSegmentedControl({
  options,
  value,
  onChange,
}: {
  options: Array<{ label: string; value: string }>;
  value: string;
  onChange: (nextValue: string) => void;
}) {
  return (
    <View style={styles.segmentedControl}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.segmentedOption, active ? styles.segmentedOptionActive : null]}
          >
            <Text style={[styles.segmentedLabel, active ? styles.segmentedLabelActive : null]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function BudgetProgressBar({
  progress,
  tone = 'money',
  trackColor = 'rgba(255,255,255,0.08)',
}: {
  progress: number;
  tone?: BudgetPhaseTone;
  trackColor?: string;
}) {
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View style={[styles.progressTrack, { backgroundColor: trackColor }]}>
      <LinearGradient
        colors={[`${toneColor(tone)}CC`, toneColor(tone)]}
        end={{ x: 1, y: 0.5 }}
        start={{ x: 0, y: 0.5 }}
        style={[styles.progressFill, { width: `${clamped * 100}%` }]}
      />
    </View>
  );
}

export function BudgetEmptyState({
  icon,
  title,
  message,
}: {
  icon: string;
  title: string;
  message: string;
}) {
  return (
    <GlassCard padding={24} style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <MaterialSymbol color={BG_ACCENT_LIGHT} name={icon} size={24} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
    </GlassCard>
  );
}

export function BudgetBottomSheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.sheetRoot}>
        <Pressable onPress={onClose} style={styles.sheetBackdrop} />
        <View style={styles.sheetContainer}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sheetSubtitle}>{subtitle}</Text> : null}
          <View style={styles.sheetBody}>{children}</View>
          {footer ? <View style={styles.sheetFooter}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

export function BudgetActionButton({
  label,
  icon,
  onPress,
  tone = 'gold',
  quiet = false,
  disabled = false,
}: {
  label: string;
  icon?: string;
  onPress: () => void;
  tone?: BudgetPhaseTone;
  quiet?: boolean;
  disabled?: boolean;
}) {
  const color = toneColor(tone);
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.actionButton,
        quiet ? { backgroundColor: 'rgba(255,255,255,0.04)' } : { backgroundColor: `${color}22` },
        disabled ? styles.actionButtonDisabled : null,
      ]}
    >
      {icon ? <MaterialSymbol color={color} name={icon} size={16} /> : null}
      <Text style={[styles.actionButtonLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG_SURFACES.base,
  },
  screenContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 120,
    gap: 22,
  },
  heroGlow: {
    position: 'absolute',
    top: -40,
    left: -20,
    right: -20,
    height: 220,
  },
  sideGlow: {
    position: 'absolute',
    top: 160,
    right: -60,
    width: 220,
    height: 240,
    borderRadius: 999,
  },
  header: {
    gap: 14,
  },
  headerCopy: {
    gap: 8,
  },
  headerAction: {
    alignSelf: 'flex-start',
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eyebrow: {
    fontFamily: BG_FONTS.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: BG_MONEY,
  },
  headerTitle: {
    fontFamily: BG_FONTS.extraBold,
    fontSize: 30,
    lineHeight: 34,
    color: BG_TEXT,
    letterSpacing: -0.8,
  },
  headerSubtitle: {
    fontFamily: BG_FONTS.medium,
    fontSize: 14,
    lineHeight: 21,
    color: BG_TEXT_SECONDARY,
  },
  heroCard: {
    overflow: 'hidden',
  },
  heroCardContent: {
    gap: 8,
  },
  heroTitle: {
    fontFamily: BG_FONTS.bold,
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: BG_TEXT_TERTIARY,
  },
  heroValue: {
    fontFamily: BG_FONTS.extraBold,
    fontSize: 42,
    lineHeight: 46,
    color: BG_TEXT,
    letterSpacing: -1.2,
  },
  heroSubtitle: {
    fontFamily: BG_FONTS.medium,
    fontSize: 15,
    lineHeight: 22,
    color: BG_TEXT_SECONDARY,
  },
  heroDetail: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 18,
    color: BG_TEXT_TERTIARY,
  },
  heroFooter: {
    marginTop: 8,
  },
  metricCard: {
    gap: 8,
    minHeight: 114,
    justifyContent: 'space-between',
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  metricLabel: {
    fontFamily: BG_FONTS.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: BG_TEXT_TERTIARY,
  },
  metricValue: {
    fontFamily: BG_FONTS.extraBold,
    fontSize: 27,
    lineHeight: 30,
    letterSpacing: -0.8,
  },
  metricCaption: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 18,
    color: BG_TEXT_SECONDARY,
  },
  section: {
    gap: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionCopy: {
    flex: 1,
    gap: 4,
  },
  sectionAction: {
    alignSelf: 'center',
  },
  sectionTitle: {
    fontFamily: BG_FONTS.bold,
    fontSize: 20,
    lineHeight: 24,
    color: BG_TEXT,
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 19,
    color: BG_TEXT_SECONDARY,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  chipDisabled: {
    opacity: 0.45,
  },
  chipLabel: {
    fontFamily: BG_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  chipLabelDisabled: {
    color: BG_TEXT_TERTIARY,
  },
  segmentedControl: {
    flexDirection: 'row',
    gap: 8,
    padding: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  segmentedOption: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  segmentedOptionActive: {
    backgroundColor: 'rgba(255,184,119,0.16)',
  },
  segmentedLabel: {
    fontFamily: BG_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 18,
    color: BG_TEXT_SECONDARY,
  },
  segmentedLabelActive: {
    color: BG_ACCENT_LIGHT,
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 10,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,184,119,0.12)',
  },
  emptyTitle: {
    fontFamily: BG_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    color: BG_TEXT,
  },
  emptyMessage: {
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 20,
    color: BG_TEXT_SECONDARY,
    textAlign: 'center',
  },
  sheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetContainer: {
    backgroundColor: BG_SURFACES.low,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
    gap: 12,
    minHeight: 280,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginBottom: 4,
  },
  sheetTitle: {
    fontFamily: BG_FONTS.bold,
    fontSize: 20,
    lineHeight: 24,
    color: BG_TEXT,
  },
  sheetSubtitle: {
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 19,
    color: BG_TEXT_SECONDARY,
  },
  sheetBody: {
    gap: 14,
  },
  sheetFooter: {
    marginTop: 8,
  },
  actionButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonLabel: {
    fontFamily: BG_FONTS.bold,
    fontSize: 13,
    lineHeight: 16,
  },
});
