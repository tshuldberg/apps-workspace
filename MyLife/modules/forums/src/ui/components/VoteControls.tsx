import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { getVoteTone } from '../logic';
import {
  FR_SURFACES,
  FR_TEXT,
  FR_TYPOGRAPHY,
} from '../tokens';
import { MaterialSymbol } from './MaterialSymbol';

export type ForumsVoteState = 'up' | 'down' | null;

export interface VoteControlsProps {
  count: number;
  userVote: ForumsVoteState;
  orientation?: 'vertical' | 'horizontal';
  onUp?: () => void;
  onDown?: () => void;
}

async function triggerVoteHaptic() {
  try {
    await Haptics.selectionAsync();
  } catch {
    // Ignore haptic failures on unsupported platforms.
  }
}

export function VoteControls({
  count,
  userVote,
  orientation = 'vertical',
  onUp,
  onDown,
}: VoteControlsProps) {
  const isHorizontal = orientation === 'horizontal';

  const handleUp = () => {
    void triggerVoteHaptic();
    onUp?.();
  };

  const handleDown = () => {
    void triggerVoteHaptic();
    onDown?.();
  };

  return (
    <View style={[styles.container, isHorizontal ? styles.row : styles.column]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Upvote" onPress={handleUp}>
        <MaterialSymbol
          name="arrow_upward"
          size={18}
          color={getVoteTone('up', userVote)}
          filled={userVote === 'up'}
        />
      </Pressable>
      <Text style={styles.count}>{count}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Downvote" onPress={handleDown}>
        <MaterialSymbol
          name="arrow_downward"
          size={18}
          color={getVoteTone('down', userVote)}
          filled={userVote === 'down'}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: FR_SURFACES.low,
  },
  column: {
    flexDirection: 'column',
  },
  row: {
    flexDirection: 'row',
  },
  count: {
    ...FR_TYPOGRAPHY.titleMd,
    color: FR_TEXT,
    minWidth: 30,
    textAlign: 'center',
  },
});
