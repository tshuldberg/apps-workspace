import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BG_ACCENT, BG_ON_ACCENT, BG_SURFACES, BG_TEXT_SECONDARY } from '../tokens';
import { BG_FONTS } from '../typography';

export type PeriodSelectorValue =
  | 'this_month'
  | 'last_30d'
  | 'this_year'
  | 'custom';

const OPTIONS: Array<{ value: PeriodSelectorValue; label: string }> = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_30d', label: 'Last 30d' },
  { value: 'this_year', label: 'This Year' },
  { value: 'custom', label: 'Custom' },
];

export interface PeriodSelectorProps {
  value: PeriodSelectorValue;
  onChange: (value: PeriodSelectorValue) => void;
}

export function PeriodSelector({
  value,
  onChange,
}: PeriodSelectorProps) {
  return (
    <View style={styles.row}>
      {OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              styles.chip,
              { backgroundColor: selected ? BG_ACCENT : BG_SURFACES.high },
            ]}
          >
            <Text
              style={[
                styles.label,
                { color: selected ? BG_ON_ACCENT : BG_TEXT_SECONDARY },
              ]}
            >
              {option.label}
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
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 34,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    justifyContent: 'center',
  },
  label: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
});
