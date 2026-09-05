import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  getPet,
  applyDecay,
  EVOLUTION_NAMES,
  type Pet,
} from '@mylife/mood';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';

const accentColor = colors.modules.mood;

const SPECIES_EMOJI: Record<string, string> = {
  egg: '\u{1F95A}',
  cat: '\u{1F431}',
  dog: '\u{1F436}',
  bird: '\u{1F426}',
  bunny: '\u{1F430}',
  fox: '\u{1F98A}',
};

interface PetMiniCardProps {
  onPress: () => void;
}

export function PetMiniCard({ onPress }: PetMiniCardProps) {
  const db = useDatabase();
  const [pet, setPet] = useState<Pet | null>(null);

  useFocusEffect(
    useCallback(() => {
      setPet(getPet(db));
    }, [db]),
  );

  if (!pet) {
    return (
      <Pressable style={styles.card} onPress={onPress}>
        <View style={styles.emojiContainer}>
          <Text style={styles.emoji}>{'\u{1F95A}'}</Text>
        </View>
        <Text variant="caption" color={accentColor}>Adopt a virtual pet!</Text>
      </Pressable>
    );
  }

  const { newHappiness } = applyDecay(pet, new Date().toISOString());
  const emoji = pet.evolutionStage === 0
    ? '\u{1F95A}'
    : (SPECIES_EMOJI[pet.species] ?? '\u{1F95A}');
  const stageName = EVOLUTION_NAMES[pet.evolutionStage] ?? 'Unknown';

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.emojiContainer}>
        <Text style={styles.emoji}>{emoji}</Text>
      </View>
      <View style={styles.info}>
        <Text variant="body" color={colors.text}>{pet.name}</Text>
        <Text variant="caption" color={colors.textSecondary}>{stageName}</Text>
      </View>
      <View style={styles.happinessOuter}>
        <View
          style={[
            styles.happinessFill,
            {
              width: `${newHappiness}%`,
              backgroundColor: newHappiness > 60 ? colors.success : newHappiness > 30 ? colors.warning : colors.danger,
            },
          ]}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  emojiContainer: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 28, lineHeight: 36 },
  info: { flex: 1, gap: 2 },
  happinessOuter: {
    width: 60,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.glassStrong,
    overflow: 'hidden',
  },
  happinessFill: {
    height: '100%',
    borderRadius: 3,
  },
});
