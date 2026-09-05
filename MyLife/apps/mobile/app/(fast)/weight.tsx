import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {
  createWeightEntry,
  getWeightEntries,
  deleteWeightEntry,
} from '@mylife/fast';
import type { WeightEntry } from '@mylife/fast';
import { Card, EmptyState, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const ACCENT = colors.modules.fast;

export default function WeightScreen() {
  const db = useDatabase();
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState<'lbs' | 'kg'>('lbs');
  const [notes, setNotes] = useState('');
  const [days, setDays] = useState(30);

  const load = useCallback(() => {
    try {
      setEntries(getWeightEntries(db, days));
    } catch (err) {
      console.warn('Failed to load weight entries', err);
      setEntries([]);
    }
  }, [db, days]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = () => {
    const num = parseFloat(value);
    if (!Number.isFinite(num) || num <= 0) {
      Alert.alert('Invalid weight', 'Please enter a positive number.');
      return;
    }
    try {
      createWeightEntry(db, uuid(), num, unit, undefined, notes || undefined);
      setValue('');
      setNotes('');
      load();
    } catch (err) {
      console.warn('Failed to create weight entry', err);
      Alert.alert('Error', 'Could not save weight entry. Please try again.');
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete', 'Remove this weight entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          try {
            deleteWeightEntry(db, id);
            load();
          } catch (err) {
            console.warn('Failed to delete weight entry', err);
          }
        },
      },
    ]);
  };

  const latest = entries[0];
  const oldest = entries[entries.length - 1];
  const delta = latest && oldest && entries.length > 1
    ? latest.weightValue - oldest.weightValue
    : null;

  // Simple bar chart data
  const chartEntries = entries.slice(0, 30).reverse();
  const minW = chartEntries.reduce((m, e) => Math.min(m, e.weightValue), Infinity);
  const maxW = chartEntries.reduce((m, e) => Math.max(m, e.weightValue), 0);
  const range = maxW - minW || 1;

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={entries}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <>
          <Card>
            <Text variant="subheading">Log Weight</Text>
            <View style={styles.formRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={value}
                onChangeText={setValue}
                placeholder="Weight"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
              />
              <Pressable
                style={[styles.unitToggle, unit === 'lbs' && styles.unitActive]}
                onPress={() => setUnit('lbs')}
              >
                <Text variant="caption" color={unit === 'lbs' ? colors.background : colors.text}>lbs</Text>
              </Pressable>
              <Pressable
                style={[styles.unitToggle, unit === 'kg' && styles.unitActive]}
                onPress={() => setUnit('kg')}
              >
                <Text variant="caption" color={unit === 'kg' ? colors.background : colors.text}>kg</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              value={notes}
              onChangeText={setNotes}
              placeholder="Notes (optional)"
              placeholderTextColor={colors.textTertiary}
            />
            <Pressable style={styles.addButton} onPress={handleAdd}>
              <Text variant="label" color={colors.background}>Add Entry</Text>
            </Pressable>
          </Card>

          {latest ? (
            <Card>
              <View style={styles.rowBetween}>
                <View>
                  <Text variant="caption" color={colors.textSecondary}>Current</Text>
                  <Text style={styles.bigValue}>{latest.weightValue} {latest.unit}</Text>
                </View>
                {delta != null ? (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text variant="caption" color={colors.textSecondary}>Change ({days}d)</Text>
                    <Text
                      style={[styles.bigValue, { color: delta <= 0 ? colors.success : colors.danger }]}
                    >
                      {delta > 0 ? '+' : ''}{delta.toFixed(1)} {latest.unit}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Card>
          ) : null}

          {chartEntries.length > 1 ? (
            <Card>
              <Text variant="subheading">Trend</Text>
              <View style={styles.chartRow}>
                {chartEntries.map((entry, i) => {
                  const pct = ((entry.weightValue - minW) / range) * 100;
                  return (
                    <View key={entry.id ?? i} style={styles.barContainer}>
                      <View style={[styles.bar, { height: `${Math.max(6, pct)}%` }]} />
                    </View>
                  );
                })}
              </View>
              <View style={styles.rowBetween}>
                <Text variant="caption" color={colors.textSecondary}>{minW.toFixed(1)}</Text>
                <Text variant="caption" color={colors.textSecondary}>{maxW.toFixed(1)}</Text>
              </View>
            </Card>
          ) : null}

          <View style={styles.daysRow}>
            {[30, 60, 90].map((d) => (
              <Pressable
                key={d}
                style={[styles.dayChip, days === d && styles.dayChipActive]}
                onPress={() => setDays(d)}
              >
                <Text variant="caption" color={days === d ? colors.background : colors.text}>{d}d</Text>
              </Pressable>
            ))}
          </View>

          <Text variant="label" color={colors.textSecondary} style={{ marginTop: spacing.sm }}>
            Weight Log
          </Text>
        </>
      }
      renderItem={({ item }) => (
        <Pressable onLongPress={() => handleDelete(item.id)}>
          <Card>
            <View style={styles.rowBetween}>
              <View>
                <Text variant="body">{item.weightValue} {item.unit}</Text>
                <Text variant="caption" color={colors.textSecondary}>{item.date}</Text>
              </View>
              {item.notes ? (
                <Text variant="caption" color={colors.textSecondary} style={{ flex: 1, textAlign: 'right' }}>
                  {item.notes}
                </Text>
              ) : null}
            </View>
          </Card>
        </Pressable>
      )}
      ListEmptyComponent={
        <EmptyState
          icon="⚖️"
          title="No weight entries yet"
          message="Add your first weight entry above to start tracking trends."
          accentColor={ACCENT}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  formRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
    marginTop: spacing.xs,
  },
  unitToggle: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  unitActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  addButton: {
    borderRadius: 8,
    backgroundColor: ACCENT,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  bigValue: {
    color: ACCENT,
    fontSize: 22,
    fontWeight: '700',
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 100,
    gap: 2,
    marginTop: spacing.sm,
  },
  barContainer: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 2,
    backgroundColor: ACCENT,
    minHeight: 4,
  },
  daysRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  dayChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  dayChipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
});
