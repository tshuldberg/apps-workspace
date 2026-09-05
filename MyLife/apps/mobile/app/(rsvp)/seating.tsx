import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  createSeatingTable,
  getTablesByEvent,
  getAssignmentsByEvent,
  assignSeat,
  autoAssign,
  getUnassignedGuests,
  generateSeatingText,
  getEvents,
  getRsvpsByEvent,
} from '@mylife/rsvp';
import type { TableShape } from '@mylife/rsvp';
import { Card, Text, EmptyState, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { useRsvpContext } from '../../components/rsvp/RsvpContext';

const ACCENT = colors.modules.rsvp;
const SHAPES: TableShape[] = ['round', 'rectangle', 'long'];

export default function SeatingScreen() {
  const db = useDatabase();
  const { selectedEventId } = useRsvpContext();
  const [tick, setTick] = useState(0);
  const [tableLabel, setTableLabel] = useState('');
  const [tableCapacity, setTableCapacity] = useState('8');
  const [tableShape, setTableShape] = useState<TableShape>('round');

  const refresh = () => setTick((v) => v + 1);
  const events = useMemo(() => getEvents(db), [db, tick]);
  const eventId = selectedEventId ?? events[0]?.id ?? null;

  const tables = useMemo(
    () => (eventId ? getTablesByEvent(db, eventId) : []),
    [db, eventId, tick],
  );

  const assignments = useMemo(
    () => (eventId ? getAssignmentsByEvent(db, eventId) : []),
    [db, eventId, tick],
  );

  const rsvps = useMemo(
    () => (eventId ? getRsvpsByEvent(db, eventId) : []),
    [db, eventId, tick],
  );

  const goingGuests = rsvps.filter((r) => r.response === 'going').map((r) => r.guestName);
  const assignedNames = new Set(assignments.map((a) => a.guestName));
  const unassigned = goingGuests.filter((name) => !assignedNames.has(name));

  const handleAddTable = () => {
    if (!eventId || !tableLabel.trim()) return;
    const cap = parseInt(tableCapacity, 10);
    const id = `tbl_${Date.now()}`;
    createSeatingTable(db, id, eventId, {
      label: tableLabel.trim(),
      shape: tableShape,
      capacity: !isNaN(cap) && cap > 0 ? cap : 8,
    });
    setTableLabel('');
    refresh();
  };

  const handleAutoAssign = () => {
    if (!eventId || tables.length === 0 || unassigned.length === 0) return;
    const assignedCounts = new Map<string, number>();
    for (const a of assignments) {
      assignedCounts.set(a.tableId, (assignedCounts.get(a.tableId) ?? 0) + 1);
    }
    const result = autoAssign(tables, assignedCounts, unassigned);
    for (const input of result.assigned) {
      const id = `seat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      assignSeat(db, id, {
        tableId: input.tableId,
        eventId,
        guestName: input.guestName,
      });
    }
    refresh();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {!eventId ? (
        <EmptyState
          icon={'\uD83E\uDE91'}
          title="No event selected"
          message="Select an event to manage seating."
        />
      ) : (
        <>
          {/* Summary */}
          <Card>
            <Text variant="subheading">Seating Arrangement</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: ACCENT }]}>{tables.length}</Text>
                <Text variant="caption" color={colors.textSecondary}>Tables</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: ACCENT }]}>{assignments.length}</Text>
                <Text variant="caption" color={colors.textSecondary}>Seated</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: colors.warning }]}>{unassigned.length}</Text>
                <Text variant="caption" color={colors.textSecondary}>Unassigned</Text>
              </View>
            </View>
            {unassigned.length > 0 && tables.length > 0 && (
              <Pressable style={styles.autoButton} onPress={handleAutoAssign}>
                <Text variant="label" color={colors.background}>Auto-Assign All</Text>
              </Pressable>
            )}
          </Card>

          {/* Tables with assignments */}
          {tables.map((table) => {
            const tableAssignments = assignments.filter((a) => a.tableId === table.id);
            return (
              <Card key={table.id}>
                <View style={styles.tableHeader}>
                  <Text variant="subheading">{table.label}</Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {table.shape} -- {tableAssignments.length}/{table.capacity}
                  </Text>
                </View>
                <View style={styles.list}>
                  {tableAssignments.length === 0 ? (
                    <Text variant="caption" color={colors.textSecondary}>No guests assigned.</Text>
                  ) : (
                    tableAssignments.map((a) => (
                      <View key={a.id} style={styles.guestRow}>
                        <Text variant="body">{a.guestName}</Text>
                        {a.seatNumber != null && (
                          <Text variant="caption" color={colors.textSecondary}>Seat {a.seatNumber}</Text>
                        )}
                      </View>
                    ))
                  )}
                </View>
              </Card>
            );
          })}

          {/* Unassigned guests */}
          {unassigned.length > 0 && (
            <Card>
              <Text variant="subheading">Unassigned Guests</Text>
              <View style={styles.list}>
                {unassigned.map((name) => (
                  <View key={name} style={styles.guestRow}>
                    <Text variant="body">{name}</Text>
                  </View>
                ))}
              </View>
            </Card>
          )}

          {/* Add table form */}
          <Card>
            <Text variant="subheading">Add Table</Text>
            <View style={styles.formGrid}>
              <TextInput
                style={styles.input}
                value={tableLabel}
                onChangeText={setTableLabel}
                placeholder="Table name (e.g. Table 1)"
                placeholderTextColor={colors.textTertiary}
              />
              <View style={styles.chipRow}>
                {SHAPES.map((s) => {
                  const selected = s === tableShape;
                  return (
                    <Pressable
                      key={s}
                      onPress={() => setTableShape(s)}
                      style={[styles.chip, selected && styles.chipActive]}
                    >
                      <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                        {s}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                style={styles.input}
                value={tableCapacity}
                onChangeText={setTableCapacity}
                placeholder="Capacity"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
              />
              <Pressable style={styles.primaryButton} onPress={handleAddTable}>
                <Text variant="label" color={colors.background}>Add Table</Text>
              </Pressable>
            </View>
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  statsGrid: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  statCard: {
    flex: 1, padding: spacing.sm, borderRadius: 12,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, gap: 2,
  },
  statValue: { fontSize: 18, fontWeight: '700' },
  autoButton: {
    backgroundColor: ACCENT, borderRadius: 12,
    paddingVertical: spacing.sm, alignItems: 'center', marginTop: spacing.sm,
  },
  tableHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  list: { gap: spacing.xs, marginTop: spacing.sm },
  guestRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.sm, borderRadius: 8,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 999,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceElevated,
  },
  chipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  formGrid: { gap: spacing.sm, marginTop: spacing.sm },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    color: colors.text, backgroundColor: colors.surfaceElevated,
  },
  primaryButton: {
    backgroundColor: ACCENT, borderRadius: 12,
    paddingVertical: spacing.sm, alignItems: 'center',
  },
});
