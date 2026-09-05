import { StyleSheet, Text, View } from 'react-native';
import type { Condition } from '../../types';
import { MK_SURFACES, MK_TEXT, MK_TYPOGRAPHY } from '../tokens';
import { getConditionMeta } from '../logic';

const SIZE_STYLES = {
  sm: { paddingHorizontal: 8, paddingVertical: 4, fontSize: 9 },
  md: { paddingHorizontal: 10, paddingVertical: 5, fontSize: 10 },
} as const;

export function getConditionPillTone(condition: Condition) {
  return getConditionMeta(condition);
}

export interface ConditionPillProps {
  condition: Condition;
  size?: 'sm' | 'md';
}

export function ConditionPill({
  condition,
  size = 'md',
}: ConditionPillProps) {
  const meta = getConditionPillTone(condition);
  const config = SIZE_STYLES[size];
  const textColor = condition === 'poor' ? MK_TEXT : MK_SURFACES.lowest;

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: meta.color,
          paddingHorizontal: config.paddingHorizontal,
          paddingVertical: config.paddingVertical,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: textColor,
            fontSize: config.fontSize,
            lineHeight: config.fontSize * 1.15,
          },
        ]}
      >
        {meta.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  text: {
    ...MK_TYPOGRAPHY.labelUpper,
    fontWeight: '700',
  },
});
