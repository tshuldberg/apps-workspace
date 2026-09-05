import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@mylife/ui';
import { GARDEN_ACCENT, GARDEN_DANGER, GARDEN_SURFACES, GARDEN_TYPOGRAPHY } from './tokens';

type CompanionState = 'synergy' | 'antagonistic' | 'neutral' | 'self';

interface CompanionMatrixCellProps {
  state: CompanionState;
  value?: string;
}

export function CompanionMatrixCell({ state, value }: CompanionMatrixCellProps) {
  const bg =
    state === 'synergy'
      ? GARDEN_ACCENT
      : state === 'antagonistic'
        ? GARDEN_DANGER
        : state === 'self'
          ? 'transparent'
          : GARDEN_SURFACES.focus;

  const textColor =
    state === 'synergy' || state === 'antagonistic'
      ? '#0E0E13'
      : colors.textSecondary;

  return (
    <View style={[styles.cell, { backgroundColor: bg }]}>
      {state === 'self' && (
        <>
          <View style={styles.diagonal} />
          <View style={[styles.diagonal, styles.diagonalAlt]} />
        </>
      )}
      {value != null && state !== 'self' && (
        <Text style={[styles.value, { color: textColor }]}>{value}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    aspectRatio: 1,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  diagonal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(159, 142, 129, 0.3)',
    transform: [{ rotate: '45deg' }],
  },
  diagonalAlt: {
    transform: [{ rotate: '-45deg' }],
  },
  value: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
  },
});
