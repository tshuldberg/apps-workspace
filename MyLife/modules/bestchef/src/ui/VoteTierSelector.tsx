import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@mylife/ui';
import { RECIPES_ACCENT } from './tokens';
import { JAKARTA_FONTS } from './typography';

const TIERS = [
  { tier: 0, label: 'Not for me', emoji: '👎' },
  { tier: 1, label: "I'd eat that", emoji: '👍' },
  { tier: 2, label: "Momma's", emoji: '❤️' },
  { tier: 3, label: 'Best Chef', emoji: '🏆' },
] as const;

interface VoteTierSelectorProps {
  onVote: (tier: number) => void;
  selectedTier?: number;
  disabled?: boolean;
}

export function VoteTierSelector({
  onVote,
  selectedTier,
  disabled = false,
}: VoteTierSelectorProps) {
  return (
    <View style={styles.row}>
      {TIERS.map(({ tier, label, emoji }) => {
        const isSelected = selectedTier === tier;
        return (
          <Pressable
            key={tier}
            onPress={() => {
              if (!disabled) onVote(tier);
            }}
            style={[
              styles.button,
              isSelected && styles.buttonSelected,
              disabled && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.emoji}>{emoji}</Text>
            <Text
              style={[
                styles.label,
                isSelected && styles.labelSelected,
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  buttonSelected: {
    backgroundColor: 'rgba(34, 197, 94, 0.14)',
    borderColor: RECIPES_ACCENT,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  emoji: {
    fontSize: 20,
    lineHeight: 26,
  },
  label: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 10,
    letterSpacing: 0.3,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  labelSelected: {
    color: RECIPES_ACCENT,
  },
});
