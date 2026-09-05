import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { MK_MONO, MK_RADIUS, scopeColor, scopeLabel, type MkColors } from '../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';

/**
 * Meerkat-native button. The hub @mylife/ui Button renders in HUB tokens
 * (orange accent, dark surfaces) which fight Meerkat's palette, so the app
 * owns its own button that reads the active Meerkat palette. Same minimal API.
 */
type MkButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: MkButtonVariant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useAppThemeColors();
  const btn = useMkStyles(makeButtonStyles);
  const textColor =
    variant === 'primary'
      ? c.onAccent
      : variant === 'danger'
        ? c.danger
        : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        btn.base,
        variant === 'primary' && { backgroundColor: pressed ? c.accentDim : c.accent },
        variant === 'secondary' && btn.secondary,
        variant === 'secondary' && pressed && { backgroundColor: c.surfaceElevated },
        variant === 'ghost' && btn.ghost,
        variant === 'danger' && btn.danger,
        pressed && variant !== 'primary' && { opacity: 0.75 },
        disabled && btn.disabled,
        style,
      ]}
    >
      <Text style={[btn.text, { color: textColor }]}>{title}</Text>
    </Pressable>
  );
}

const makeButtonStyles = (c: MkColors) => StyleSheet.create({
  base: {
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: MK_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: {
    backgroundColor: c.surfaceHigh,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: c.dangerSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.danger,
  },
  disabled: {
    opacity: 0.4,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
});

/**
 * Honesty notice. Used anywhere a screen could be misread as live network
 * connectivity. Copy must never imply an active mesh/relay/peer connection
 * the engine cannot back with a real recorded session.
 *
 * Tone drives the dot color: the default info dot is the brand accent, but a
 * blocker ("not available in this build") must never show a green dot that
 * reads as OK; pass 'warning' for degraded/unconfigured and 'danger' for
 * failures.
 */
export type HonestNoticeTone = 'info' | 'warning' | 'danger';

export function HonestNotice({ text, tone = 'info' }: { text: string; tone?: HonestNoticeTone }) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const dotColor = tone === 'warning' ? c.warning : tone === 'danger' ? c.danger : c.accentDim;
  return (
    <View style={styles.notice} accessibilityRole="summary">
      <Text style={[styles.noticeDot, { color: dotColor }]}>●</Text>
      <Text style={styles.noticeText}>{text}</Text>
    </View>
  );
}

export function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  const styles = useMkStyles(makeStyles);
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
    </View>
  );
}

export function Panel({ children }: { children: React.ReactNode }) {
  const styles = useMkStyles(makeStyles);
  return <View style={styles.panel}>{children}</View>;
}

export function ScopeBadge({ scope }: { scope: string }) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const color = scopeColor(scope, c);
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{scopeLabel(scope)}</Text>
    </View>
  );
}

export function CopyRow({
  label,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const styles = useMkStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [styles.copyBtn, pressed && styles.pressed]}
    >
      <Text style={styles.copyBtnText}>{label}</Text>
    </Pressable>
  );
}

export function Mono({ children }: { children: React.ReactNode }) {
  const styles = useMkStyles(makeStyles);
  return <Text style={styles.mono} selectable>{children}</Text>;
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: c.surfaceHigh,
    borderColor: c.glassBorder,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noticeDot: {
    color: c.accentDim,
    fontSize: 10,
  },
  noticeText: {
    flex: 1,
    color: c.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  sectionHeader: {
    marginBottom: 8,
    gap: 2,
  },
  sectionTitle: {
    color: c.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  sectionHint: {
    color: c.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  panel: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 16,
    gap: 12,
    // Light-mode elevation: a hairline border alone disappears on white.
    // Harmless on dark, where the border carries the separation.
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  badge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  copyBtn: {
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: c.surfaceHigh,
    borderRadius: MK_RADIUS.pill,
    paddingHorizontal: 16,
    paddingVertical: 9,
    alignSelf: 'flex-start',
  },
  copyBtnText: {
    color: c.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
  mono: {
    color: c.text,
    fontFamily: MK_MONO,
    fontSize: 13,
    lineHeight: 19,
  },
});
