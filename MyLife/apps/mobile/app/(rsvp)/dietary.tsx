import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  getDietaryResponses,
  getEvents,
  getRsvpsByEvent,
  DIETARY_OPTIONS,
  aggregateDietaryResponses,
} from '@mylife/rsvp';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { useRsvpContext } from '../../components/rsvp/RsvpContext';

const ACCENT = colors.modules.rsvp;

export default function DietaryScreen() {
  const db = useDatabase();
  const { selectedEventId } = useRsvpContext();

  const events = useMemo(() => getEvents(db), [db]);
  const eventId = selectedEventId ?? events[0]?.id ?? null;

  const rsvps = useMemo(
    () => (eventId ? getRsvpsByEvent(db, eventId) : []),
    [db, eventId],
  );

  const dietaryResponses = useMemo(
    () => (eventId ? getDietaryResponses(db, eventId) : []),
    [db, eventId],
  );

  const totalGuests = rsvps.filter((r) => r.response === 'going').length;

  const summary = useMemo(
    () => aggregateDietaryResponses(dietaryResponses, totalGuests),
    [dietaryResponses, totalGuests],
  );

  const countsEntries = Object.entries(summary.counts).filter(([, count]) => count > 0);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text variant="subheading">Dietary Requirements</Text>
        <Text variant="caption" color={colors.textSecondary}>
          {totalGuests} attending guest{totalGuests !== 1 ? 's' : ''}
          {' -- '}{summary.totalRespondents} responded
        </Text>
      </Card>

      {/* Summary counts */}
      {countsEntries.length > 0 && (
        <Card>
          <Text variant="subheading">Restriction Summary</Text>
          <View style={styles.list}>
            {countsEntries.map(([id, count]) => {
              const option = DIETARY_OPTIONS.find((o) => o.id === id);
              return (
                <View key={id} style={styles.restrictionRow}>
                  <Text variant="body">{option?.label ?? id}</Text>
                  <View style={[styles.badge, { backgroundColor: ACCENT }]}>
                    <Text variant="caption" color={colors.background}>{count}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </Card>
      )}

      {summary.otherEntries.length > 0 && (
        <Card>
          <Text variant="subheading">Custom Restrictions</Text>
          <View style={styles.list}>
            {summary.otherEntries.map((entry, i) => (
              <View key={i} style={styles.entryRow}>
                <Text variant="body">{entry.guestName}</Text>
                <Text variant="caption" color={colors.textSecondary}>{entry.text}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Available dietary options */}
      <Card>
        <Text variant="subheading">Dietary Options</Text>
        <Text variant="caption" color={colors.textSecondary}>
          These options are presented to guests when they RSVP.
        </Text>
        <View style={styles.chipRow}>
          {DIETARY_OPTIONS.map((option) => (
            <View key={option.id} style={styles.chip}>
              <Text variant="caption" color={colors.textSecondary}>{option.label}</Text>
            </View>
          ))}
        </View>
      </Card>

      {/* Per-guest breakdown */}
      {dietaryResponses.length > 0 && (
        <Card>
          <Text variant="subheading">Guest Responses</Text>
          <View style={styles.list}>
            {dietaryResponses.map((response, i) => (
              <View key={i} style={styles.guestRow}>
                <Text variant="body">{response.guestName}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {response.answerJson ?? 'No dietary info'}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  list: { gap: spacing.sm, marginTop: spacing.sm },
  restrictionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.sm, borderRadius: 10,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
  entryRow: { gap: 2, padding: spacing.sm, borderRadius: 10, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border },
  guestRow: { gap: 2, padding: spacing.sm, borderRadius: 10, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 999 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 999,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceElevated,
  },
});
