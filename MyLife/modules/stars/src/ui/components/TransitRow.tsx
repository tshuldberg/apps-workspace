import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Aspect, ZodiacSign } from '../../types';
import type { TransitEvent } from '../../engine/transits';
import {
  ST_FONTS,
  ST_TEXT,
  ST_TEXT_SECONDARY,
  ST_TEXT_TERTIARY,
  getStarsAspectColor,
  withAlpha,
} from '../tokens';
import { ASPECT_GLYPHS, titleCase } from './astro-symbols';
import { PlanetGlyph } from './PlanetGlyph';

export interface TransitRowData
  extends Pick<
    TransitEvent,
    'id' | 'transitingBody' | 'natalBody' | 'aspectType' | 'currentOrb' | 'exactDate' | 'interpretationBrief'
  > {
  endDate?: string;
  transitingSign?: ZodiacSign;
  natalSign?: ZodiacSign;
}

export interface TransitRowProps {
  transit: TransitRowData;
  onPress?: () => void;
}

function getStrengthPercent(currentOrb: number): number {
  const maxOrb = 8;
  return Math.max(10, Math.round((1 - Math.min(currentOrb, maxOrb) / maxOrb) * 100));
}

export function TransitRow({ transit, onPress }: TransitRowProps) {
  const tone = getStarsAspectColor(transit.aspectType as Aspect);
  const strength = getStrengthPercent(transit.currentOrb);

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.iconRow}>
        <PlanetGlyph
          planet={transit.transitingBody}
          sign={transit.transitingSign}
          size={20}
        />
        <Text style={[styles.aspectGlyph, { color: tone }]}>
          {ASPECT_GLYPHS[transit.aspectType as Aspect]}
        </Text>
        <PlanetGlyph planet={transit.natalBody} sign={transit.natalSign} size={20} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>
          {titleCase(transit.transitingBody)} {titleCase(transit.aspectType)} {titleCase(transit.natalBody)}
        </Text>
        <Text style={styles.dates}>
          {transit.endDate ? `${transit.exactDate} to ${transit.endDate}` : transit.exactDate}
        </Text>
        <View style={styles.strengthTrack}>
          <View
            style={[
              styles.strengthFill,
              { width: `${strength}%`, backgroundColor: tone },
            ]}
          />
        </View>
        <Text style={styles.body}>
          {transit.interpretationBrief || 'A notable celestial aspect is active.'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: withAlpha('#FFFFFF', 0.04),
  },
  iconRow: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  aspectGlyph: {
    fontFamily: ST_FONTS.bold,
    fontSize: 20,
    lineHeight: 26,
  },
  copy: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontFamily: ST_FONTS.bold,
    fontSize: 16,
    color: ST_TEXT,
  },
  dates: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    color: ST_TEXT_TERTIARY,
  },
  strengthTrack: {
    height: 5,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: withAlpha('#FFFFFF', 0.08),
  },
  strengthFill: {
    height: '100%',
    borderRadius: 999,
  },
  body: {
    fontFamily: ST_FONTS.regular,
    fontSize: 13,
    lineHeight: 19,
    color: ST_TEXT_SECONDARY,
  },
});
