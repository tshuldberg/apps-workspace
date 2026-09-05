import { StyleSheet, View } from 'react-native';
import type { Submission } from '@mylife/bestchef';
import { MEDAL_GOLD, MEDAL_SILVER, MEDAL_BRONZE } from '@mylife/bestchef';
import { PodiumCard } from './PodiumCard';

export interface PodiumProps {
  gold?: Submission;
  silver?: Submission;
  bronze?: Submission;
}

/**
 * Bottom-aligned horizontal podium: silver (left, 110pt) + gold (center, 140pt)
 * + bronze (right, 90pt). Matching the are-blaze PodiumView layout.
 */
export function Podium({ gold, silver, bronze }: PodiumProps) {
  const entries = [silver, gold, bronze].filter(Boolean);
  if (entries.length === 0) return null;

  return (
    <View style={styles.row}>
      {silver != null && (
        <PodiumCard
          submission={silver}
          rank={2}
          height={110}
          medalColor={MEDAL_SILVER}
        />
      )}
      {gold != null && (
        <PodiumCard
          submission={gold}
          rank={1}
          height={140}
          medalColor={MEDAL_GOLD}
        />
      )}
      {bronze != null && (
        <PodiumCard
          submission={bronze}
          rank={3}
          height={90}
          medalColor={MEDAL_BRONZE}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
    gap: 10,
  },
});
