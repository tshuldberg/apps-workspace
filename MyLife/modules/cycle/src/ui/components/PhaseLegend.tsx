import { StyleSheet, View } from 'react-native';
import { PhaseBadge } from './PhaseBadge';
import type { CyclePhaseKey } from '../tokens';

const PHASES: CyclePhaseKey[] = ['menstrual', 'follicular', 'ovulation', 'luteal'];

/**
 * Horizontal row of 4 PhaseBadges used below the PhaseRing on the Home screen.
 */
export function PhaseLegend() {
  return (
    <View style={styles.row}>
      {PHASES.map((phase) => (
        <PhaseBadge key={phase} phase={phase} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 16,
  },
});
