import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { createJournalEntry, getJournalEntryById, listJournalNotebooks, updateJournalEntry } from '@mylife/journal';
import type { JournalMood } from '@mylife/journal';
import { Card, Text, borderRadius, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const JOURNAL_ACCENT = colors.modules.journal;
const MOODS: JournalMood[] = ['low', 'okay', 'good', 'great', 'grateful'];

function splitTags(raw: string): string[] {
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export default function JournalNewEntryScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const entryId = typeof params.id === 'string' ? params.id : '';
  const notebooks = useMemo(() => listJournalNotebooks(db), [db]);
  const existingEntry = useMemo(
    () => (entryId ? getJournalEntryById(db, entryId) : null),
    [db, entryId],
  );
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [mood, setMood] = useState<JournalMood | null>(null);
  const [selectedJournalId, setSelectedJournalId] = useState(notebooks[0]?.id ?? '');

  useEffect(() => {
    if (!existingEntry) {
      return;
    }
    setTitle(existingEntry.title ?? '');
    setBody(existingEntry.body);
    setTags(existingEntry.tags.join(', '));
    setMood(existingEntry.mood ?? null);
    setSelectedJournalId(existingEntry.journalId);
  }, [existingEntry]);

  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text variant="subheading">{existingEntry ? 'Edit Entry' : 'Write Freely'}</Text>
        <Text variant="caption" color={colors.textSecondary}>
          Capture the moment, tag it, and keep it private on this device.
        </Text>

        <TextInput
          style={[styles.input, styles.titleInput]}
          value={title}
          onChangeText={setTitle}
          placeholder="Entry title"
          placeholderTextColor={colors.textTertiary}
        />

        <View style={styles.chipRow}>
          {notebooks.map((journal) => {
            const selected = selectedJournalId === journal.id;
            return (
              <Pressable
                key={journal.id}
                onPress={() => setSelectedJournalId(journal.id)}
                style={[styles.chip, selected ? styles.chipActive : null]}
              >
                <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                  {journal.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          style={[styles.input, styles.bodyInput]}
          value={body}
          onChangeText={setBody}
          placeholder="Write what happened, what mattered, or what you want to remember."
          placeholderTextColor={colors.textTertiary}
          multiline
          textAlignVertical="top"
        />

        <TextInput
          style={styles.input}
          value={tags}
          onChangeText={setTags}
          placeholder="Tags, comma separated"
          placeholderTextColor={colors.textTertiary}
        />

        <View style={styles.chipRow}>
          {MOODS.map((option) => {
            const selected = option === mood;
            return (
              <Pressable
                key={option}
                onPress={() => setMood(selected ? null : option)}
                style={[styles.chip, selected ? styles.chipActive : null]}
              >
                <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.footerRow}>
          <Text variant="caption" color={colors.textSecondary}>
            {wordCount} word{wordCount === 1 ? '' : 's'}
          </Text>
          <View style={styles.actions}>
            <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
              <Text variant="label" color={colors.text}>Cancel</Text>
            </Pressable>
            <Pressable
              style={styles.primaryButton}
            onPress={() => {
                if (!body.trim() || !selectedJournalId) {
                  return;
                }
                if (existingEntry) {
                  updateJournalEntry(db, existingEntry.id, {
                    journalId: selectedJournalId,
                    title: title.trim() || null,
                    body: body.trim(),
                    tags: splitTags(tags),
                    mood,
                  });
                  router.replace({ pathname: '/(journal)/entry-detail', params: { id: existingEntry.id } });
                  return;
                }
                const id = uuid();
                createJournalEntry(db, id, {
                  journalId: selectedJournalId,
                  entryDate: new Date().toISOString().slice(0, 10),
                  title: title.trim() || null,
                  body: body.trim(),
                  tags: splitTags(tags),
                  mood,
                });
                router.replace({ pathname: '/(journal)/entry-detail', params: { id } });
              }}
            >
              <Text variant="label" color={colors.background}>{existingEntry ? 'Save Changes' : 'Save'}</Text>
            </Pressable>
          </View>
        </View>
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
    paddingBottom: spacing.xxl,
  },
  input: {
    marginTop: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
  },
  titleInput: {
    fontSize: 18,
    fontWeight: '600',
  },
  bodyInput: {
    minHeight: 220,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
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
    borderColor: JOURNAL_ACCENT,
    backgroundColor: JOURNAL_ACCENT,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryButton: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  primaryButton: {
    borderRadius: borderRadius.lg,
    backgroundColor: JOURNAL_ACCENT,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
