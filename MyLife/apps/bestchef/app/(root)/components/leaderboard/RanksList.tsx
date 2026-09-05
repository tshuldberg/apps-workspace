import { StyleSheet, View } from 'react-native';
import type { Submission } from '@mylife/bestchef';
import { RECIPES_SURFACES } from '@mylife/bestchef/ui';
import { LeaderboardRow } from './LeaderboardRow';

export interface RanksListProps {
  /** entries[0] is rank 4, entries[N] is rank 4+N */
  entries: Submission[];
}

/**
 * Single rounded card containing ranks 4-100 as LeaderboardRows.
 * Surface shift instead of 1px dividers (RECIPES_NO_BORDER convention).
 */
export function RanksList({ entries }: RanksListProps) {
  if (entries.length === 0) return null;
  return (
    <View style={styles.card}>
      {entries.map((submission, index) => (
        <LeaderboardRow
          key={submission.id}
          submission={submission}
          rank={index + 4}
          isLast={index === entries.length - 1}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 120,
    backgroundColor: RECIPES_SURFACES.lift,
    borderRadius: 20,
    overflow: 'hidden',
  },
});
