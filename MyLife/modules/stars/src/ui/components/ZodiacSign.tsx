import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ZodiacElement, ZodiacSign as ZodiacSignName } from '../../types';
import {
  ST_ELEMENTS,
  ST_FONTS,
  ST_TEXT_SECONDARY,
  getStarsSignElement,
  withAlpha,
} from '../tokens';
import { ZODIAC_GLYPHS, ZODIAC_LABELS } from './astro-symbols';

export interface ZodiacSignProps {
  sign: ZodiacSignName;
  size?: number;
  showName?: boolean;
  element?: ZodiacElement;
  style?: StyleProp<ViewStyle>;
}

export function ZodiacSign({
  sign,
  size = 28,
  showName = false,
  element,
  style,
}: ZodiacSignProps) {
  const signElement = element ?? getStarsSignElement(sign);
  const tone = ST_ELEMENTS[signElement];
  const chipSize = size + 18;

  return (
    <View style={[styles.wrap, style]}>
      <View
        style={[
          styles.chip,
          {
            width: chipSize,
            height: chipSize,
            borderRadius: chipSize / 2,
            backgroundColor: withAlpha(tone, 0.16),
          },
        ]}
      >
        <Text style={[styles.glyph, { color: tone, fontSize: size }]}>{ZODIAC_GLYPHS[sign]}</Text>
      </View>
      {showName ? <Text style={styles.label}>{ZODIAC_LABELS[sign]}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 6,
  },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    fontFamily: ST_FONTS.bold,
    lineHeight: 32,
  },
  label: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    color: ST_TEXT_SECONDARY,
  },
});
