import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { createJournalNotebook, listJournalEntries, listJournalNotebooks } from '@mylife/journal';
import { Card, Text, borderRadius, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const JOURNAL_ACCENT = colors.modules.journal;

export default function JournalNotebooksScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const [name, setName] = useState('');

  const notebooks = useMemo(() => listJournalNotebooks(db), [db, tick]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text variant="subheading">Notebooks</Text>
            <Text variant="caption" color={colors.textSecondary}>
              Organize entries by theme, season, or project.
            </Text>
          </View>
          <View style={styles.badge}>
            <Text variant="caption" color={JOURNAL_ACCENT}>
              {notebooks.length} total
            </Text>
          </View>
        </View>

        <View style={styles.createRow}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="New notebook name"
            placeholderTextColor={colors.textTertiary}
          />
          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              const trimmed = name.trim();
              if (!trimmed) {
                return;
              }
              createJournalNotebook(db, uuid(), { name: trimmed });
              setName('');
              setTick((value) => value + 1);
            }}
          >
            <Text variant="label" color={colors.background}>Create</Text>
          </Pressable>
        </View>
      </Card>

      <View style={styles.grid}>
        {notebooks.map((journal) => {
          const entries = listJournalEntries(db, { journalId: journal.id, limit: 500 });
          const lastUpdated = entries[0]?.updatedAt?.slice(0, 10) ?? 'No entries yet';
          return (
            <Card key={journal.id} style={styles.notebookCard}>
              <View style={[styles.accentRail, { backgroundColor: journal.isDefault ? JOURNAL_ACCENT : colors.textSecondary }]} />
              <View style={styles.notebookContent}>
                <View style={styles.rowBetween}>
                  <Text variant="body">{journal.name}</Text>
                  {journal.isDefault ? (
                    <View style={styles.defaultPill}>
                      <Text variant="caption" color={colors.background}>Default</Text>
                    </View>
                  ) : null}
                </View>
                <Text variant="caption" color={colors.textSecondary}>
                  {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}
                </Text>
                <Text variant="caption" color={colors.textSecondary}>
                  Last updated: {lastUpdated}
                </Text>
              </View>
            </Card>
          );
        })}
      </View>
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
    paddingBottom: spacing.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  badge: {
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: `${JOURNAL_ACCENT}55`,
    backgroundColor: `${JOURNAL_ACCENT}18`,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  createRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    flex: 1,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
  },
  primaryButton: {
    borderRadius: borderRadius.lg,
    backgroundColor: JOURNAL_ACCENT,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    gap: spacing.sm,
  },
  notebookCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.md,
    backgroundColor: colors.surface,
  },
  accentRail: {
    width: 6,
    borderRadius: borderRadius.sm,
  },
  notebookContent: {
    flex: 1,
    gap: spacing.xs,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  defaultPill: {
    borderRadius: borderRadius.pill,
    backgroundColor: JOURNAL_ACCENT,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
});
