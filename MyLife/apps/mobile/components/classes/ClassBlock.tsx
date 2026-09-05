import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { colors } from '@mylife/ui';
import {
  type BlockPosition,
  type ClassRow,
  type DayTime,
  type ConflictIndexEntry,
  withAlpha,
} from '@mylife/classes';
import { ConflictBadge } from './ConflictBadge';

export interface ClassBlockProps {
  cls: ClassRow;
  block: DayTime;
  position: BlockPosition;
  conflicts: ConflictIndexEntry[];
  onConflictPress?: (entry: ConflictIndexEntry[]) => void;
}

/**
 * Single colored block on the weekly schedule. Tapping navigates to the
 * class detail screen (route ships in P1-C; this Link is wired now so the
 * navigation contract is locked).
 */
export function ClassBlock({
  cls,
  block,
  position,
  conflicts,
  onConflictPress,
}: ClassBlockProps) {
  const accent = cls.color;
  return (
    <Link
      href={{ pathname: '/(classes)/class/[id]', params: { id: cls.id } }}
      asChild
    >
      <Pressable
        accessibilityLabel={`${cls.name} ${block.start_time} to ${block.end_time}`}
        style={[
          styles.block,
          {
            top: `${position.topPct}%`,
            height: `${Math.max(2, position.heightPct)}%`,
            backgroundColor: withAlpha(accent, 0.18),
            borderColor: withAlpha(accent, 0.6),
          },
        ]}
      >
        <View style={[styles.accentBar, { backgroundColor: accent }]} />
        <View style={styles.body}>
          <Text numberOfLines={1} style={[styles.name, { color: accent }]}>
            {cls.name}
          </Text>
          <Text numberOfLines={1} style={styles.meta}>
            {block.start_time}-{block.end_time}
          </Text>
          {cls.room ? (
            <Text numberOfLines={1} style={styles.meta}>
              {cls.room}
              {cls.building ? ` · ${cls.building}` : ''}
            </Text>
          ) : null}
          {conflicts.length > 0 ? (
            <View style={styles.badgeRow}>
              <ConflictBadge
                conflicts={conflicts}
                onPress={() => onConflictPress?.(conflicts)}
              />
            </View>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  block: {
    position: 'absolute',
    left: 2,
    right: 2,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  accentBar: {
    width: 3,
  },
  body: {
    flex: 1,
    padding: 6,
    gap: 1,
  },
  name: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  meta: {
    fontSize: 10,
    lineHeight: 12,
    color: colors.textSecondary,
  },
  badgeRow: {
    marginTop: 4,
    flexDirection: 'row',
  },
});
