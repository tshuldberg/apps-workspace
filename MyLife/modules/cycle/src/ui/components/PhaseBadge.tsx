import { StyleSheet, Text, View } from 'react-native';
import { CYCLE_FONTS } from '../typography';
import { CYCLE_PHASE_COLORS, type CyclePhaseKey } from '../tokens';

const PHASE_LABELS: Record<CyclePhaseKey, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulation: 'Ovulation',
  luteal: 'Luteal',
};

interface PhaseBadgeProps {
  phase: CyclePhaseKey;
  size?: 'sm' | 'md';
}

/**
 * Small pill showing a colored dot and the phase label.
 * Used in calendar day cells, history rows, and the phase legend.
 */
export function PhaseBadge({ phase, size = 'sm' }: PhaseBadgeProps) {
  const color = CYCLE_PHASE_COLORS[phase];
  const isMd = size === 'md';
  const dotSize = isMd ? 10 : 8;
  const labelSize = isMd ? 12 : 10;
  const gap = isMd ? 8 : 6;

  return (
    <View style={[styles.pill, { gap }]}>
      <View
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
          backgroundColor: color,
        }}
      />
      <Text
        style={[
          styles.label,
          { fontSize: labelSize, color: 'rgba(228, 225, 233, 0.85)' },
        ]}
      >
        {PHASE_LABELS[phase]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontFamily: CYCLE_FONTS.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
