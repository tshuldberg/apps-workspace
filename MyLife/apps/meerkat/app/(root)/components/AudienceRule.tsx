import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import type { AudienceRule } from '@mylife/sync';
import { MK_RADIUS, type MkColors } from '../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';

export function AudienceBadge({ rule }: { rule: AudienceRule }) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const isPublic = rule.type === 'public';
  return (
    <View style={[styles.badge, isPublic && { borderColor: c.warning, backgroundColor: c.warningSoft }]}>
      <Text style={[styles.badgeText, isPublic && { color: c.warning }]}>{rule.label}</Text>
    </View>
  );
}

export function AudienceRuleSummary({
  rule,
  title = 'Who can see this?',
}: {
  rule: AudienceRule;
  title?: string;
}) {
  const styles = useMkStyles(makeStyles);
  return (
    <View style={styles.summary}>
      <View style={styles.summaryHeader}>
        <Text style={styles.summaryTitle}>{title}</Text>
        <AudienceBadge rule={rule} />
      </View>
      <Text style={styles.summaryText}>{rule.explanation} {rule.replyNotice}</Text>
      {rule.hostedNotice ? <Text style={styles.hostedText}>{rule.hostedNotice}</Text> : null}
    </View>
  );
}

export function AudienceSelector({
  value,
  options,
  onChange,
}: {
  value: AudienceRule;
  options: readonly AudienceRule[];
  onChange: (rule: AudienceRule) => void;
}) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  return (
    <View style={styles.selector}>
      {options.map((option) => {
        const selected = option.type === value.type;
        return (
          <Pressable
            key={option.type}
            accessibilityRole="button"
            accessibilityLabel={`Audience ${option.label}`}
            accessibilityState={{ selected }}
            onPress={() => onChange(option)}
            style={({ pressed }) => [
              styles.selectorRow,
              selected && styles.selectorRowSelected,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.selectorText}>
              <Text style={styles.selectorLabel}>{option.label}</Text>
              <Text style={styles.selectorHint}>{option.explanation}</Text>
              {option.hostedNotice ? <Text style={styles.selectorHosted}>{option.hostedNotice}</Text> : null}
            </View>
            {selected ? <Check size={17} color={c.accent} strokeWidth={2.4} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderColor: c.accent,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.pill,
    backgroundColor: c.glass,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    color: c.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  summary: {
    backgroundColor: c.surfaceHigh,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 11,
    paddingVertical: 9,
    gap: 5,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  summaryTitle: {
    flex: 1,
    color: c.text,
    fontSize: 12.5,
    fontWeight: '800',
  },
  summaryText: {
    color: c.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  hostedText: {
    color: c.warning,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  selector: {
    gap: 8,
  },
  selectorRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectorRowSelected: {
    borderColor: c.accent,
    backgroundColor: c.glass,
  },
  selectorText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  selectorLabel: {
    color: c.text,
    fontSize: 13,
    fontWeight: '800',
  },
  selectorHint: {
    color: c.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  selectorHosted: {
    color: c.warning,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  pressed: { opacity: 0.7 },
});
