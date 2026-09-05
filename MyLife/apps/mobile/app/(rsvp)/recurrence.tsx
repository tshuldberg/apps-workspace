import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  generateOccurrences,
  getEvents,
  getRecurrenceRule,
  createRecurrenceRule,
} from '@mylife/rsvp';
import type { RecurrenceFrequency } from '@mylife/rsvp';
import { Card, Text, EmptyState, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { useRsvpContext } from '../../components/rsvp/RsvpContext';

const ACCENT = colors.modules.rsvp;
const FREQUENCIES: RecurrenceFrequency[] = ['daily', 'weekly', 'biweekly', 'monthly', 'custom'];

const PRESETS = [
  { label: 'Book Club (Monthly)', freq: 'monthly' as RecurrenceFrequency },
  { label: 'Game Night (Weekly)', freq: 'weekly' as RecurrenceFrequency },
  { label: 'Team Meeting (Biweekly)', freq: 'biweekly' as RecurrenceFrequency },
];

export default function RecurrenceScreen() {
  const db = useDatabase();
  const { selectedEventId } = useRsvpContext();
  const [tick, setTick] = useState(0);
  const [selectedFreq, setSelectedFreq] = useState<RecurrenceFrequency>('weekly');

  const refresh = () => setTick((v) => v + 1);
  const events = useMemo(() => getEvents(db), [db, tick]);
  const eventId = selectedEventId ?? events[0]?.id ?? null;

  const rule = useMemo(
    () => (eventId ? getRecurrenceRule(db, eventId) : null),
    [db, eventId, tick],
  );

  // Preview next 10 occurrences
  const previewDates = useMemo(() => {
    if (!rule) return [];
    const config = {
      frequency: rule.frequency,
      intervalCount: rule.intervalCount,
      dayOfWeek: rule.dayOfWeek,
      dayOfMonth: rule.dayOfMonth,
      endType: rule.endType,
      endAfterCount: rule.endAfterCount,
      endByDate: rule.endByDate,
    };
    const event = events.find((e) => e.id === rule.eventId);
    const startDate = event?.startAt.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
    return generateOccurrences(startDate, config, 10);
  }, [rule, events]);

  const handleSetRecurrence = () => {
    if (!eventId) return;
    const id = `rec_${Date.now()}`;
    createRecurrenceRule(db, id, eventId, {
      frequency: selectedFreq,
      intervalCount: 1,
    });
    refresh();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {!eventId ? (
        <EmptyState
          icon={'\uD83D\uDD01'}
          title="No event selected"
          message="Select an event to configure recurrence."
        />
      ) : (
        <>
          {/* Current rule */}
          <Card>
            <Text variant="subheading">Recurrence Rule</Text>
            {rule ? (
              <View style={styles.ruleInfo}>
                <Text variant="body">
                  Repeats: {rule.frequency} (every {rule.intervalCount})
                </Text>
                <Text variant="caption" color={colors.textSecondary}>
                  End: {rule.endType}{rule.endByDate ? ` (${rule.endByDate})` : ''}
                </Text>
              </View>
            ) : (
              <Text variant="caption" color={colors.textSecondary}>
                No recurrence set. Choose a frequency below.
              </Text>
            )}
          </Card>

          {/* Frequency picker */}
          {!rule && (
            <Card>
              <Text variant="subheading">Set Frequency</Text>
              <View style={styles.chipRow}>
                {FREQUENCIES.map((f) => {
                  const selected = f === selectedFreq;
                  return (
                    <Pressable
                      key={f}
                      onPress={() => setSelectedFreq(f)}
                      style={[styles.chip, selected && styles.chipActive]}
                    >
                      <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                        {f}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable style={styles.primaryButton} onPress={handleSetRecurrence}>
                <Text variant="label" color={colors.background}>Set Recurrence</Text>
              </Pressable>
            </Card>
          )}

          {/* Presets */}
          {!rule && (
            <Card>
              <Text variant="subheading">Quick Presets</Text>
              <View style={styles.list}>
                {PRESETS.map((preset) => (
                  <Pressable
                    key={preset.label}
                    style={styles.presetRow}
                    onPress={() => setSelectedFreq(preset.freq)}
                  >
                    <Text variant="body">{preset.label}</Text>
                    <Text variant="caption" color={ACCENT}>{preset.freq}</Text>
                  </Pressable>
                ))}
              </View>
            </Card>
          )}

          {/* Preview calendar */}
          {previewDates.length > 0 && (
            <Card>
              <Text variant="subheading">Next 10 Occurrences</Text>
              <View style={styles.list}>
                {previewDates.map((date, i) => (
                  <View key={i} style={styles.dateRow}>
                    <Text variant="body">#{i + 1}</Text>
                    <Text variant="body" color={colors.textSecondary}>{date}</Text>
                  </View>
                ))}
              </View>
            </Card>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  ruleInfo: { gap: 2, marginTop: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 999,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceElevated,
  },
  chipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  list: { gap: spacing.sm, marginTop: spacing.sm },
  presetRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.sm, borderRadius: 10,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
  dateRow: {
    flexDirection: 'row', gap: spacing.md, alignItems: 'center',
    padding: spacing.sm, borderRadius: 10,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
  primaryButton: {
    backgroundColor: ACCENT, borderRadius: 12,
    paddingVertical: spacing.sm, alignItems: 'center', marginTop: spacing.sm,
  },
});
