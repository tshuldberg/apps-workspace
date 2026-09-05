import { StyleSheet, Text, View } from 'react-native';
import type { VerificationLevel } from '../../types';
import { MaterialSymbol } from './MaterialSymbol';
import { MK_TEXT, MK_TYPOGRAPHY } from '../tokens';
import { getVerificationMeta, withAlpha } from '../logic';

export function getVerificationBadgeMeta(level: VerificationLevel) {
  return getVerificationMeta(level);
}

export interface VerificationBadgeProps {
  tier: VerificationLevel;
  showLabel?: boolean;
}

export function VerificationBadge({
  tier,
  showLabel = true,
}: VerificationBadgeProps) {
  const meta = getVerificationBadgeMeta(tier);

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: withAlpha(meta.color, 0.16),
          paddingHorizontal: showLabel ? 10 : 8,
        },
      ]}
    >
      <MaterialSymbol
        name={meta.icon}
        size={14}
        color={meta.color}
        filled={tier !== 'unverified'}
      />
      {showLabel ? (
        <Text style={[styles.label, { color: MK_TEXT }]}>{meta.label}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minHeight: 28,
    borderRadius: 999,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  label: {
    ...MK_TYPOGRAPHY.labelUpper,
  },
});
