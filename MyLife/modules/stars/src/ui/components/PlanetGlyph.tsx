import { StyleSheet, Text, View } from 'react-native';
import type { ZodiacSign } from '../../types';
import {
  ST_ACCENT,
  ST_FONTS,
  ST_TEXT,
  getStarsPlanetColor,
  withAlpha,
} from '../tokens';
import { PLANET_GLYPHS, ZODIAC_GLYPHS } from './astro-symbols';

export interface PlanetGlyphProps {
  planet: string;
  retrograde?: boolean;
  sign?: ZodiacSign;
  size?: number;
  color?: string;
}

export function PlanetGlyph({
  planet,
  retrograde = false,
  sign,
  size = 24,
  color,
}: PlanetGlyphProps) {
  const normalized = planet.toLowerCase();
  const glyph = PLANET_GLYPHS[normalized] ?? '✦';
  const tone = color ?? getStarsPlanetColor(normalized);
  const shellSize = size + 16;

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.shell,
          {
            width: shellSize,
            height: shellSize,
            borderRadius: shellSize / 2,
            backgroundColor: withAlpha(tone, 0.16),
          },
        ]}
      >
        <Text style={[styles.glyph, { fontSize: size, color: tone }]}>{glyph}</Text>
        {retrograde ? (
          <View style={styles.retroBadge}>
            <Text style={styles.retroText}>R</Text>
          </View>
        ) : null}
      </View>
      {sign ? (
        <View style={styles.signPill}>
          <Text style={styles.signText}>{ZODIAC_GLYPHS[sign]}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 4,
  },
  shell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    fontFamily: ST_FONTS.bold,
    lineHeight: 30,
  },
  retroBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: ST_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  retroText: {
    fontFamily: ST_FONTS.bold,
    fontSize: 9,
    color: ST_TEXT,
  },
  signPill: {
    minWidth: 18,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: withAlpha('#FFFFFF', 0.06),
    alignItems: 'center',
    justifyContent: 'center',
  },
  signText: {
    fontFamily: ST_FONTS.medium,
    fontSize: 10,
    color: ST_TEXT,
  },
});
