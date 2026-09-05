import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import type { ZodiacSign } from '../../types';
import { ST_FONTS, ST_TEXT_SECONDARY, getStarsZodiacColor, withAlpha } from '../tokens';
import { ZODIAC_GLYPHS, ZODIAC_LABELS, ZODIAC_ORDER } from './astro-symbols';

export interface ZodiacStripProps {
  currentSign: ZodiacSign;
  showAll?: boolean;
  onPressSign?: (sign: ZodiacSign) => void;
}

export function ZodiacStrip({
  currentSign,
  showAll = true,
  onPressSign,
}: ZodiacStripProps) {
  const signs = showAll ? ZODIAC_ORDER : [currentSign];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {signs.map((sign) => {
        const active = sign === currentSign;
        const tone = getStarsZodiacColor(sign);
        return (
          <Pressable
            key={sign}
            onPress={() => onPressSign?.(sign)}
            style={[
              styles.pill,
              { backgroundColor: active ? withAlpha(tone, 0.18) : withAlpha('#FFFFFF', 0.04) },
            ]}
          >
            <Text style={[styles.glyph, { color: tone }]}>{ZODIAC_GLYPHS[sign]}</Text>
            <Text style={styles.label}>{ZODIAC_LABELS[sign]}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  glyph: {
    fontFamily: ST_FONTS.bold,
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    color: ST_TEXT_SECONDARY,
  },
});
