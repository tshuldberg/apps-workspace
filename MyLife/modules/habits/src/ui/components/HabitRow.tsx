import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Habit } from '../../types';
import { HB_ACCENT_LIGHT, HB_COMPLETION_STATUS, HB_HABIT_TYPES, HB_SURFACES, HB_TEXT, HB_TEXT_SECONDARY, HB_TEXT_TERTIARY, HB_TYPOGRAPHY, withAlpha } from '../tokens';
import { GlassCard } from './GlassCard';
import { CheckCircle } from './CheckCircle';
import { MaterialSymbol } from './MaterialSymbol';
import { StreakFlame } from './StreakFlame';
import type { AreaChipArea } from './AreaChip';

export interface HabitRowProps {
  habit: Habit;
  checked?: boolean;
  actionItemCount?: number;
  streakCount?: number;
  area?: AreaChipArea | null;
  frozen?: boolean;
  onCheck?: () => void;
  onPress?: () => void;
  onLongPress?: () => void;
  showArea?: boolean;
  showStreak?: boolean;
  progressLabel?: string;
}

function getHabitTypeColor(habitType: Habit['habitType']) {
  switch (habitType) {
    case 'timed':
      return HB_HABIT_TYPES.timed;
    case 'negative':
      return HB_HABIT_TYPES.sobriety;
    case 'measurable':
      return HB_HABIT_TYPES.measurement;
    default:
      return HB_HABIT_TYPES.binary;
  }
}

function ActionControl({
  habit,
  checked,
  progressLabel,
  onPress,
}: {
  habit: Habit;
  checked: boolean;
  progressLabel?: string;
  onPress?: () => void;
}) {
  if (habit.habitType === 'standard') {
    return (
      <CheckCircle
        checked={checked}
        onPress={onPress}
      />
    );
  }

  const tint = getHabitTypeColor(habit.habitType);
  const label = progressLabel
    ?? (habit.habitType === 'timed'
      ? 'Start'
      : habit.habitType === 'measurable'
        ? 'Log'
        : 'Slip');
  const icon = habit.habitType === 'timed'
    ? 'play_arrow'
    : habit.habitType === 'measurable'
      ? 'add'
      : 'close';

  return (
    <Pressable onPress={onPress} style={[styles.actionPill, { backgroundColor: withAlpha(tint, 0.2) }]}>
      <MaterialSymbol
        name={icon}
        size={16}
        color={tint}
        filled
      />
      <Text style={[styles.actionLabel, { color: tint }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function HabitRow({
  habit,
  checked = false,
  actionItemCount = 0,
  streakCount = 0,
  area = null,
  frozen = false,
  onCheck,
  onPress,
  onLongPress,
  showArea = true,
  showStreak = true,
  progressLabel,
}: HabitRowProps) {
  const typeTint = getHabitTypeColor(habit.habitType);

  return (
    <GlassCard level={2} style={styles.card}>
      <Pressable
        onLongPress={onLongPress}
        onPress={onPress}
        style={styles.row}
      >
        <View style={styles.left}>
          <ActionControl
            habit={habit}
            checked={checked}
            progressLabel={progressLabel}
            onPress={onCheck}
          />
          <View style={styles.copy}>
            <View style={styles.titleRow}>
              <Text
                style={[
                  styles.title,
                  checked ? styles.titleChecked : null,
                ]}
                numberOfLines={1}
              >
                {habit.name}
              </Text>
              <View
                style={[
                  styles.typeDot,
                  {
                    backgroundColor: typeTint,
                  },
                ]}
              />
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>
                {habit.frequency}
                {habit.timeOfDay !== 'anytime' ? ` • ${habit.timeOfDay}` : ''}
              </Text>
              {actionItemCount > 0 ? (
                <Text style={styles.meta}>
                  {actionItemCount} action item{actionItemCount === 1 ? '' : 's'}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
        <View style={styles.right}>
          {showStreak ? (
            <StreakFlame
              count={streakCount}
              frozen={frozen}
              size={16}
            />
          ) : null}
          {showArea && area ? (
            <View style={styles.areaMeta}>
              <View
                style={[
                  styles.areaDot,
                  {
                    backgroundColor: area.color ?? HB_TEXT_TERTIARY,
                  },
                ]}
              />
              <Text style={styles.areaLabel} numberOfLines={1}>
                {area.name}
              </Text>
            </View>
          ) : null}
          <MaterialSymbol
            name="chevron_right"
            size={18}
            color={HB_TEXT_TERTIARY}
          />
        </View>
      </Pressable>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  copy: {
    flex: 1,
    gap: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    ...HB_TYPOGRAPHY.bodyMd,
    flex: 1,
    color: HB_TEXT,
    fontSize: 15,
    lineHeight: 20,
  },
  titleChecked: {
    color: HB_TEXT_SECONDARY,
    textDecorationLine: 'line-through',
  },
  typeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  meta: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_TERTIARY,
    fontSize: 12,
    lineHeight: 16,
  },
  actionPill: {
    minWidth: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actionLabel: {
    ...HB_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    lineHeight: 10,
  },
  right: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
  },
  areaMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 132,
  },
  areaDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  areaLabel: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_TERTIARY,
    fontSize: 12,
    lineHeight: 16,
  },
});
