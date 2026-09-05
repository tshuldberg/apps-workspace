import { StyleSheet, Text, View } from 'react-native';
import {
  MD_PILL_RADIUS,
  MD_TYPOGRAPHY,
  resolveBPClassification,
  withAlpha,
} from '../tokens';

export interface BPClassificationProps {
  systolic: number;
  diastolic: number;
}

export function getBPClassificationMeta(systolic: number, diastolic: number) {
  return resolveBPClassification(systolic, diastolic);
}

export function BPClassification({
  systolic,
  diastolic,
}: BPClassificationProps) {
  const meta = resolveBPClassification(systolic, diastolic);

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: withAlpha(meta.color, 0.16),
        },
      ]}
    >
      <Text style={[styles.text, { color: meta.color }]}>
        {meta.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: MD_PILL_RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  text: {
    ...MD_TYPOGRAPHY.labelUpper,
  },
});
