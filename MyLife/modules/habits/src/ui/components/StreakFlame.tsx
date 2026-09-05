import { StyleSheet, Text, View } from 'react-native';
import { HB_STREAK, HB_TEXT, HB_TYPOGRAPHY, HB_VIOLET_GLOW_STYLE, withAlpha } from '../tokens';
import { MaterialSymbol } from './MaterialSymbol';

export type StreakFlameTone = 'fire' | 'legendary' | 'frozen';

export function getStreakFlameTone(
  count: number,
  frozen = false,
): StreakFlameTone {
  if (frozen) {
    return 'frozen';
  }

  if (count >= 100) {
    return 'legendary';
  }

  return 'fire';
}

export function getStreakFlameColor(
  count: number,
  frozen = false,
): string {
  const tone = getStreakFlameTone(count, frozen);
  return HB_STREAK[tone];
}

export interface StreakFlameProps {
  count: number;
  size?: number;
  showNumber?: boolean;
  frozen?: boolean;
}

export function StreakFlame({
  count,
  size = 18,
  showNumber = true,
  frozen = false,
}: StreakFlameProps) {
  const tone = getStreakFlameTone(count, frozen);
  const color = HB_STREAK[tone];

  return (
    <View
      style={[
        styles.container,
        tone === 'legendary'
          ? HB_VIOLET_GLOW_STYLE
          : {
            shadowColor: color,
            shadowOpacity: 0.18,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: 6,
          },
      ]}
    >
      <View
        style={[
          styles.iconBadge,
          {
            minWidth: size + 10,
            borderRadius: size,
            backgroundColor: withAlpha(color, 0.18),
          },
        ]}
      >
        <MaterialSymbol
          name="local_fire_department"
          size={size}
          color={color}
          filled
        />
        {showNumber ? (
          <Text style={[styles.count, { color }]}>
            {count}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  count: {
    ...HB_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    lineHeight: 10,
    fontFamily: HB_TYPOGRAPHY.labelUpper.fontFamily,
  },
});
