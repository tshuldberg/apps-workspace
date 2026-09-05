import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  createJournalNotebook,
  exportJournalData,
  getJournalDashboard,
  getJournalSetting,
  listJournalNotebooks,
  listJournalPromptCategories,
  serializeJournalExport,
  setJournalSetting,
} from '@mylife/journal';
import type { JournalPromptCategory } from '@mylife/journal';
import { Card, Text, borderRadius, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const JOURNAL_ACCENT = colors.modules.journal;

export default function JournalSettingsScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const [newJournalName, setNewJournalName] = useState('');
  const refresh = () => setTick((value) => value + 1);
  const notebooks = useMemo(() => listJournalNotebooks(db), [db, tick]);
  const dashboard = useMemo(() => getJournalDashboard(db), [db, tick]);
  const promptEnabled = useMemo(() => getJournalSetting(db, 'dailyPromptEnabled') === 'true', [db, tick]);
  const promptCategory = useMemo(
    () => (getJournalSetting(db, 'dailyPromptCategory') ?? 'reflection') as JournalPromptCategory,
    [db, tick],
  );
  const exportBundle = useMemo(() => exportJournalData(db), [db, tick]);
  const exportPreview = useMemo(
    () => serializeJournalExport(exportBundle, 'markdown').slice(0, 420),
    [exportBundle],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text variant="subheading">Module Snapshot</Text>
        <View style={styles.list}>
          <Text variant="body">Entries: {dashboard.entryCount}</Text>
          <Text variant="body">Journals: {dashboard.journalCount}</Text>
          <Text variant="body">Current streak: {dashboard.currentStreak}</Text>
          <Text variant="body">Longest streak: {dashboard.longestStreak}</Text>
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Notebook Management</Text>
        <TextInput
          style={styles.input}
          value={newJournalName}
          onChangeText={setNewJournalName}
          placeholder="New notebook name"
          placeholderTextColor={colors.textTertiary}
        />
        <Pressable
          style={styles.primaryButton}
          onPress={() => {
            if (!newJournalName.trim()) {
              return;
            }

            createJournalNotebook(db, uuid(), {
              name: newJournalName.trim(),
            });
            setNewJournalName('');
            refresh();
          }}
        >
          <Text variant="label" color={colors.background}>Create Notebook</Text>
        </Pressable>
        <View style={styles.list}>
          {notebooks.map((journal) => (
            <Text key={journal.id} variant="caption" color={colors.textSecondary}>
              {journal.name}{journal.isDefault ? ' · default' : ''}
            </Text>
          ))}
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Prompt Preferences</Text>
        <Text variant="caption" color={colors.textSecondary}>
          Choose a category for your daily writing prompt.
        </Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => {
            setJournalSetting(db, 'dailyPromptEnabled', promptEnabled ? 'false' : 'true');
            refresh();
          }}
        >
          <Text variant="label" color={colors.background}>
            {promptEnabled ? 'Disable daily prompts' : 'Enable daily prompts'}
          </Text>
        </Pressable>
        <View style={styles.chipRow}>
          {listJournalPromptCategories().map((category) => {
            const selected = category === promptCategory;
            return (
              <Pressable
                key={category}
                onPress={() => {
                  setJournalSetting(db, 'dailyPromptCategory', category);
                  refresh();
                }}
                style={[styles.chip, selected ? styles.chipActive : null]}
              >
                <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                  {category}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Export Preview</Text>
        <Text variant="caption" color={colors.textSecondary}>
          Entries: {exportBundle.entries.length} · Journals: {exportBundle.journals.length} · Tags: {exportBundle.tags.length}
        </Text>
        <Text variant="caption" color={colors.textSecondary}>
          {exportPreview}
        </Text>
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
  input: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
  },
  primaryButton: {
    marginTop: spacing.sm,
    backgroundColor: JOURNAL_ACCENT,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
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
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceElevated,
  },
  chipActive: {
    backgroundColor: JOURNAL_ACCENT,
    borderColor: JOURNAL_ACCENT,
  },
});
