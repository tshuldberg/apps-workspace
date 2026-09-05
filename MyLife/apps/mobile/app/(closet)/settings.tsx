import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  exportClosetData,
  getClosetDashboard,
  getClosetSetting,
  listClothingItems,
  listDirtyClothingItems,
  serializeClosetExport,
  setClosetSetting,
} from '@mylife/closet';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const CLOSET_ACCENT = '#E879A8';
const THRESHOLDS = ['90', '180', '365'];
const WEAR_LIMITS = ['1', '2', '3', '5'];
const REMINDER_TYPES = ['none', 'weekly'];
const REMINDER_DAYS = ['0', '1', '2', '3', '4', '5', '6'];

export default function ClosetSettingsScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const refresh = () => setTick((value) => value + 1);
  const items = useMemo(() => listClothingItems(db, { status: 'active', limit: 500 }), [db, tick]);
  const dirtyItems = useMemo(() => listDirtyClothingItems(db), [db, tick]);
  const dashboard = useMemo(() => getClosetDashboard(db), [db, tick]);
  const donationThreshold = getClosetSetting(db, 'donationThresholdDays') ?? '365';
  const laundryAutoDirty = getClosetSetting(db, 'laundryAutoDirty') ?? '1';
  const laundryWearsBeforeDirty = getClosetSetting(db, 'laundryWearsBeforeDirty') ?? '1';
  const laundryReminder = getClosetSetting(db, 'laundryReminder') ?? 'none';
  const laundryReminderDay = getClosetSetting(db, 'laundryReminderDay') ?? '0';
  const exportPreview = serializeClosetExport(exportClosetData(db), exportFormat).slice(0, 700);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text variant="subheading">Module Snapshot</Text>
        <View style={styles.list}>
          <Text variant="body">Items: {items.length}</Text>
          <Text variant="body">Outfits: {dashboard.totalOutfits}</Text>
          <Text variant="body">Dirty items: {dirtyItems.length}</Text>
          <Text variant="body">Donation candidates: {dashboard.donationCandidateCount}</Text>
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Donation Threshold</Text>
        <Text variant="caption" color={colors.textSecondary}>
          Items older than this many days since last wear are suggested for donation.
        </Text>
        <View style={styles.chipRow}>
          {THRESHOLDS.map((value) => {
            const selected = value === donationThreshold;
            return (
              <Pressable
                key={value}
                onPress={() => {
                  setClosetSetting(db, 'donationThresholdDays', value);
                  refresh();
                }}
                style={[styles.chip, selected ? styles.chipActive : null]}
              >
                <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                  {value}d
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Laundry Preferences</Text>
        <Text variant="caption" color={colors.textSecondary}>
          Auto-dirty after wear
        </Text>
        <View style={styles.chipRow}>
          {[
            { label: 'On', value: '1' },
            { label: 'Off', value: '0' },
          ].map((option) => {
            const selected = option.value === laundryAutoDirty;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  setClosetSetting(db, 'laundryAutoDirty', option.value);
                  refresh();
                }}
                style={[styles.chip, selected ? styles.chipActive : null]}
              >
                <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text variant="caption" color={colors.textSecondary}>
          Wears before dirty
        </Text>
        <View style={styles.chipRow}>
          {WEAR_LIMITS.map((value) => {
            const selected = value === laundryWearsBeforeDirty;
            return (
              <Pressable
                key={value}
                onPress={() => {
                  setClosetSetting(db, 'laundryWearsBeforeDirty', value);
                  refresh();
                }}
                style={[styles.chip, selected ? styles.chipActive : null]}
              >
                <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                  {value}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text variant="caption" color={colors.textSecondary}>
          Reminder
        </Text>
        <View style={styles.chipRow}>
          {REMINDER_TYPES.map((value) => {
            const selected = value === laundryReminder;
            return (
              <Pressable
                key={value}
                onPress={() => {
                  setClosetSetting(db, 'laundryReminder', value);
                  refresh();
                }}
                style={[styles.chip, selected ? styles.chipActive : null]}
              >
                <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                  {value}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {laundryReminder === 'weekly' ? (
          <View style={styles.chipRow}>
            {REMINDER_DAYS.map((value) => {
              const selected = value === laundryReminderDay;
              return (
                <Pressable
                  key={value}
                  onPress={() => {
                    setClosetSetting(db, 'laundryReminderDay', value);
                    refresh();
                  }}
                  style={[styles.chip, selected ? styles.chipActive : null]}
                >
                  <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][Number(value)]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </Card>

      <Card>
        <Text variant="subheading">Export Preview</Text>
        <View style={styles.chipRow}>
          {(['json', 'csv'] as const).map((value) => {
            const selected = value === exportFormat;
            return (
              <Pressable
                key={value}
                onPress={() => setExportFormat(value)}
                style={[styles.chip, selected ? styles.chipActive : null]}
              >
                <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                  {value.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Card style={styles.previewCard}>
          <Text variant="caption" color={colors.textSecondary}>
            {exportPreview}
          </Text>
        </Card>
      </Card>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  list: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceElevated,
  },
  chipActive: {
    backgroundColor: CLOSET_ACCENT,
    borderColor: CLOSET_ACCENT,
  },
  previewCard: {
    marginTop: spacing.sm,
  },
});
