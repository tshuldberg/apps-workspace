import type { ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import {
  BG_ACCENT,
  BG_ACCENT_LIGHT,
  BG_CARD_RADIUS,
  BG_DANGER,
  BG_FONTS,
  BG_MONEY,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_MUTED,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  BG_TRANSFER,
  BG_TYPOGRAPHY,
  GlassCard,
  MaterialSymbol,
} from '@mylife/budget';

export type BudgetButtonTone = 'primary' | 'secondary' | 'ghost' | 'danger';

export function formatBudgetCurrency(cents: number, options?: { compact?: boolean }): string {
  const value = cents / 100;
  if (options?.compact && Math.abs(value) >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function parseBudgetCurrencyInput(value: string): number | null {
  const normalized = value.replace(/[^0-9.-]/g, '').trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(parsed * 100);
}

export function currentBudgetMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function monthKeyFromOffset(offset: number): string {
  const base = new Date();
  const target = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`;
}

export function formatBudgetMonth(month: string): string {
  const [year, monthValue] = month.split('-').map(Number);
  return new Date(year, monthValue - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export function formatBudgetDate(date: string): string {
  const [year, monthValue, day] = date.split('-').map(Number);
  return new Date(year, monthValue - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function normalizeMerchantName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function merchantInitials(value: string): string {
  const words = normalizeMerchantName(value).split(' ').filter(Boolean).slice(0, 2);
  if (words.length === 0) {
    return 'TX';
  }
  return words.map((word) => word[0]?.toUpperCase() ?? '').join('');
}

export function BudgetScreen({
  children,
  contentContainerStyle,
  ...props
}: ScrollViewProps) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.screenContent, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      {...props}
    >
      {children}
    </ScrollView>
  );
}

export function BudgetSectionLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function BudgetHeadline({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.headlineRow}>
      <View style={styles.headlineCopy}>
        <Text style={styles.headlineTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headlineSubtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.headlineRight}>{right}</View> : null}
    </View>
  );
}

export function BudgetButton({
  label,
  tone = 'primary',
  onPress,
  icon,
  disabled,
  style,
}: {
  label: string;
  tone?: BudgetButtonTone;
  onPress?: () => void;
  icon?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const palette =
    tone === 'primary'
      ? { backgroundColor: BG_MONEY, color: '#082510' }
      : tone === 'danger'
        ? { backgroundColor: 'rgba(255, 180, 171, 0.16)', color: BG_DANGER }
        : tone === 'secondary'
          ? { backgroundColor: BG_SURFACES.high, color: BG_TEXT }
          : { backgroundColor: 'rgba(255,255,255,0.04)', color: BG_TEXT_SECONDARY };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        { backgroundColor: palette.backgroundColor, opacity: disabled ? 0.45 : 1 },
        style,
      ]}
    >
      {icon ? <MaterialSymbol name={icon} size={16} color={palette.color} /> : null}
      <Text style={[styles.buttonText, { color: palette.color }]}>{label}</Text>
    </Pressable>
  );
}

export function BudgetInput({
  multiline,
  style,
  ...props
}: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={BG_TEXT_TERTIARY}
      style={[styles.input, multiline ? styles.textArea : null, style]}
      multiline={multiline}
      {...props}
    />
  );
}

export function BudgetMetric({
  label,
  value,
  tone = 'neutral',
  icon,
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'money' | 'warning' | 'danger' | 'transfer';
  icon?: string;
}) {
  const color =
    tone === 'money'
      ? BG_MONEY
      : tone === 'warning'
        ? BG_ACCENT_LIGHT
        : tone === 'danger'
          ? BG_DANGER
          : tone === 'transfer'
            ? BG_TRANSFER
            : BG_TEXT;

  return (
    <View style={styles.metricTile}>
      <View style={styles.metricLabelRow}>
        {icon ? <MaterialSymbol name={icon} size={12} color={BG_TEXT_TERTIARY} /> : null}
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
    </View>
  );
}

export function BudgetProgressBar({
  value,
  total,
  tone = BG_MONEY,
}: {
  value: number;
  total: number;
  tone?: string;
}) {
  const percent = total <= 0 ? 0 : Math.max(0, Math.min(value / total, 1));

  return (
    <View style={styles.progressTrack}>
      <View
        style={[
          styles.progressFill,
          {
            width: `${Math.max(percent * 100, percent > 0 ? 6 : 0)}%`,
            backgroundColor: tone,
          },
        ]}
      />
    </View>
  );
}

export function BudgetSheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheetCard} onPress={() => undefined}>
          <View style={styles.sheetHandle} />
          <BudgetHeadline title={title} subtitle={subtitle} />
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function BudgetEmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: string;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <GlassCard style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <MaterialSymbol name={icon} size={20} color={BG_ACCENT_LIGHT} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
      {action}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG_SURFACES.base,
  },
  screenContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120,
    gap: 16,
  },
  sectionLabel: {
    ...BG_TYPOGRAPHY.labelUpper,
    color: BG_TEXT_TERTIARY,
  },
  headlineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  headlineCopy: {
    flex: 1,
    gap: 4,
  },
  headlineRight: {
    flexShrink: 0,
  },
  headlineTitle: {
    ...BG_TYPOGRAPHY.headlineMd,
    color: BG_TEXT,
  },
  headlineSubtitle: {
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    color: BG_TEXT_SECONDARY,
  },
  button: {
    minHeight: 48,
    borderRadius: BG_CARD_RADIUS,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  buttonText: {
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  input: {
    minHeight: 52,
    borderRadius: BG_CARD_RADIUS,
    backgroundColor: BG_SURFACES.low,
    color: BG_TEXT,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontFamily: BG_FONTS.medium,
    fontSize: 16,
    lineHeight: 20,
  },
  textArea: {
    minHeight: 112,
    textAlignVertical: 'top',
  },
  metricTile: {
    flex: 1,
    minWidth: 108,
    borderRadius: BG_CARD_RADIUS,
    backgroundColor: BG_SURFACES.low,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  metricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricLabel: {
    ...BG_TYPOGRAPHY.labelUpper,
    color: BG_TEXT_TERTIARY,
  },
  metricValue: {
    fontFamily: BG_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
  },
  progressTrack: {
    height: 10,
    borderRadius: BG_CARD_RADIUS,
    backgroundColor: BG_SURFACES.high,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: BG_CARD_RADIUS,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.56)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: BG_SURFACES.base,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 16,
  },
  sheetHandle: {
    width: 48,
    height: 4,
    borderRadius: 999,
    backgroundColor: BG_TEXT_MUTED,
    alignSelf: 'center',
    opacity: 0.6,
  },
  emptyCard: {
    gap: 10,
    alignItems: 'flex-start',
  },
  emptyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${BG_ACCENT}22`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    ...BG_TYPOGRAPHY.headlineMd,
    color: BG_TEXT,
  },
  emptyMessage: {
    fontFamily: BG_FONTS.medium,
    fontSize: 14,
    lineHeight: 20,
    color: BG_TEXT_SECONDARY,
  },
});
