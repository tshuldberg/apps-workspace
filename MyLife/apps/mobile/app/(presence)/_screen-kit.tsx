import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import {
  GlassPanel,
  MaterialSymbol,
  PR_ACCENT,
  PR_ACCENT_GLOW,
  PR_ACCENT_LIGHT,
  PR_CARD_RADIUS,
  PR_CYAN_GLOW_STYLE,
  PR_FONTS,
  PR_SURFACES,
  PR_TEXT,
  PR_TEXT_SECONDARY,
  PR_TEXT_TERTIARY,
  PR_TYPOGRAPHY,
  type PresenceMaterialSymbolName,
} from '@mylife/presence';

export function PresenceScrollScreen({
  children,
  contentStyle,
}: {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, contentStyle]}>
      {children}
    </ScrollView>
  );
}

export function PresenceHero({
  eyebrow,
  title,
  subtitle,
  icon,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  icon?: PresenceMaterialSymbolName;
  action?: ReactNode;
}) {
  return (
    <GlassPanel padding={24} glow style={styles.heroPanel}>
      <View style={styles.heroOrb} />
      <View style={styles.heroHeader}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.heroTitle}>{title}</Text>
          {subtitle != null ? <Text style={styles.heroSubtitle}>{subtitle}</Text> : null}
        </View>
        {action ?? (
          icon != null ? (
            <View style={styles.heroIconTile}>
              <MaterialSymbol name={icon} size={24} color={PR_ACCENT_LIGHT} filled />
            </View>
          ) : null
        )}
      </View>
    </GlassPanel>
  );
}

export function PresenceSectionHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

export function PresencePillButton({
  label,
  icon,
  onPress,
  tone = 'accent',
}: {
  label: string;
  icon?: PresenceMaterialSymbolName;
  onPress: () => void;
  tone?: 'accent' | 'surface';
}) {
  const accent = tone === 'accent';
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pillButton,
        accent ? styles.pillButtonAccent : styles.pillButtonSurface,
      ]}
    >
      {icon != null ? (
        <MaterialSymbol
          name={icon}
          size={16}
          color={accent ? '#041218' : PR_ACCENT_LIGHT}
          filled={accent}
        />
      ) : null}
      <Text style={[styles.pillButtonText, accent ? styles.pillButtonTextAccent : null]}>{label}</Text>
    </Pressable>
  );
}

export function PresenceChip({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <View style={[styles.chip, selected ? styles.chipSelected : null]}>
      <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{label}</Text>
    </View>
  );

  if (onPress == null) {
    return content;
  }

  return <Pressable onPress={onPress}>{content}</Pressable>;
}

export function PresenceMetricPill({
  label,
  value,
  tint = PR_ACCENT_LIGHT,
}: {
  label: string;
  value: string;
  tint?: string;
}) {
  return (
    <View style={[styles.metricPill, { backgroundColor: `${tint}22` }]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color: tint }]}>{value}</Text>
    </View>
  );
}

export function PresenceRow({
  icon,
  title,
  subtitle,
  right,
  onPress,
}: {
  icon: PresenceMaterialSymbolName;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
}) {
  return (
    <GlassPanel padding={16} onPress={onPress} style={styles.rowPanel}>
      <View style={styles.rowContent}>
        <View style={styles.rowIconTile}>
          <MaterialSymbol name={icon} size={18} color={PR_ACCENT_LIGHT} filled />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.rowTitle}>{title}</Text>
          {subtitle != null ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
        </View>
        {right ?? (onPress != null ? <MaterialSymbol name="chevron_right" size={18} color={PR_TEXT_TERTIARY} /> : null)}
      </View>
    </GlassPanel>
  );
}

export function PresenceEmptyState({
  icon,
  title,
  body,
}: {
  icon: PresenceMaterialSymbolName;
  title: string;
  body: string;
}) {
  return (
    <GlassPanel padding={24} style={styles.emptyPanel}>
      <View style={styles.emptyIconTile}>
        <MaterialSymbol name={icon} size={24} color={PR_ACCENT_LIGHT} filled />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </GlassPanel>
  );
}

export function PresenceBottomSheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.sheetHandle} />
          <ScrollView contentContainerStyle={styles.sheetContent} bounces={false}>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export const presenceScreenKitStyles = StyleSheet.create({
  fieldLabel: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: PR_TEXT_SECONDARY,
    marginBottom: 8,
  },
  input: {
    backgroundColor: PR_SURFACES.mid,
    borderRadius: 18,
    color: PR_TEXT,
    fontFamily: PR_FONTS.medium,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputMultiline: {
    minHeight: 132,
    textAlignVertical: 'top',
  },
  stack: {
    gap: 12,
  },
  rowWrap: {
    gap: 10,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: PR_ACCENT_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    ...PR_CYAN_GLOW_STYLE,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: PR_SURFACES.mid,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryButtonText: {
    ...PR_TYPOGRAPHY.titleMd,
    color: '#041218',
    fontFamily: PR_FONTS.bold,
  },
  secondaryButtonText: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
  },
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PR_SURFACES.lowest,
  },
  content: {
    gap: 16,
    padding: 16,
    paddingBottom: 112,
  },
  heroPanel: {
    overflow: 'hidden',
  },
  heroOrb: {
    position: 'absolute',
    width: 180,
    height: 180,
    right: -64,
    top: -96,
    borderRadius: 999,
    backgroundColor: PR_ACCENT_GLOW,
    opacity: 0.18,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  eyebrow: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: PR_TEXT_SECONDARY,
  },
  heroTitle: {
    ...PR_TYPOGRAPHY.displayLg,
    color: PR_TEXT,
    fontSize: 36,
    lineHeight: 42,
  },
  heroSubtitle: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
    maxWidth: 280,
  },
  heroIconTile: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: `${PR_ACCENT}22`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    ...PR_TYPOGRAPHY.headlineMd,
    color: PR_TEXT,
    flex: 1,
  },
  pillButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillButtonAccent: {
    backgroundColor: PR_ACCENT_LIGHT,
    ...PR_CYAN_GLOW_STYLE,
  },
  pillButtonSurface: {
    backgroundColor: PR_SURFACES.high,
  },
  pillButtonText: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
  },
  pillButtonTextAccent: {
    color: '#041218',
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: PR_SURFACES.mid,
  },
  chipSelected: {
    backgroundColor: `${PR_ACCENT_LIGHT}22`,
  },
  chipText: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_SECONDARY,
  },
  chipTextSelected: {
    color: PR_ACCENT_LIGHT,
    fontFamily: PR_FONTS.semiBold,
  },
  metricPill: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
    minWidth: 96,
  },
  metricLabel: {
    ...PR_TYPOGRAPHY.labelTight,
    color: PR_TEXT_SECONDARY,
  },
  metricValue: {
    ...PR_TYPOGRAPHY.titleMd,
  },
  rowPanel: {
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  rowIconTile: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: `${PR_ACCENT}22`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
  },
  rowSubtitle: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_SECONDARY,
  },
  emptyPanel: {
    alignItems: 'center',
    gap: 10,
  },
  emptyIconTile: {
    width: 56,
    height: 56,
    borderRadius: PR_CARD_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${PR_ACCENT}22`,
  },
  emptyTitle: {
    ...PR_TYPOGRAPHY.headlineMd,
    color: PR_TEXT,
    textAlign: 'center',
  },
  emptyBody: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
    textAlign: 'center',
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: PR_SURFACES.base,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 10,
    maxHeight: '88%',
  },
  sheetHandle: {
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: PR_TEXT_TERTIARY,
    alignSelf: 'center',
    opacity: 0.4,
  },
  sheetContent: {
    gap: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
});
