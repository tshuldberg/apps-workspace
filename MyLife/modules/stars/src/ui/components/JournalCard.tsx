import { StyleSheet, Text, View } from 'react-native';
import type { MoonPhase, ZodiacSign } from '../../types';
import { ST_FONTS, ST_TEXT, ST_TEXT_SECONDARY, ST_TEXT_TERTIARY, withAlpha } from '../tokens';
import { GlassCard } from './GlassCard';
import { MoonPhaseGlyph } from './MoonPhaseGlyph';
import { MaterialSymbol } from './MaterialSymbol';
import { titleCase } from './astro-symbols';

export interface JournalCardEntry {
  id: string;
  date: string;
  content: string;
  title?: string;
  mood?: string | null;
  moonPhase?: MoonPhase | null;
  moonSign?: ZodiacSign | null;
  transitTag?: string | null;
}

export interface JournalCardProps {
  entry: JournalCardEntry;
  onPress?: () => void;
}

export function JournalCard({ entry, onPress }: JournalCardProps) {
  const title =
    entry.title ??
    entry.content
      .split(/[.!?]/)
      .map((part) => part.trim())
      .find(Boolean) ??
    'Untitled Reflection';
  const preview = entry.content.length > 140
    ? `${entry.content.slice(0, 137).trimEnd()}...`
    : entry.content;

  return (
    <GlassCard onPress={onPress}>
      <View style={styles.header}>
        <View>
          <Text style={styles.date}>{entry.date}</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
        {entry.moonPhase ? <MoonPhaseGlyph phase={entry.moonPhase} size={42} /> : null}
      </View>
      <Text style={styles.preview}>{preview}</Text>
      <View style={styles.tags}>
        {entry.mood ? (
          <View style={styles.pill}>
            <MaterialSymbol name="favorite" size={14} color="#FFB4AB" filled />
            <Text style={styles.pillText}>{titleCase(entry.mood)}</Text>
          </View>
        ) : null}
        {entry.moonPhase ? (
          <View style={styles.pill}>
            <Text style={styles.pillText}>
              {titleCase(entry.moonPhase.replace('_moon', '').replace(/_/g, ' '))}
              {entry.moonSign ? ` · ${titleCase(entry.moonSign)}` : ''}
            </Text>
          </View>
        ) : null}
        {entry.transitTag ? (
          <View style={[styles.pill, styles.transitPill]}>
            <MaterialSymbol name="auto_awesome" size={14} color="#C4B5FD" />
            <Text style={styles.pillText}>{entry.transitTag}</Text>
          </View>
        ) : null}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  date: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    color: ST_TEXT_TERTIARY,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 4,
    fontFamily: ST_FONTS.bold,
    fontSize: 20,
    lineHeight: 24,
    color: ST_TEXT,
  },
  preview: {
    marginTop: 12,
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: ST_TEXT_SECONDARY,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: withAlpha('#FFFFFF', 0.06),
  },
  transitPill: {
    backgroundColor: withAlpha('#A78BFA', 0.14),
  },
  pillText: {
    fontFamily: ST_FONTS.medium,
    fontSize: 11,
    color: ST_TEXT_SECONDARY,
  },
});
