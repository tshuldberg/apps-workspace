import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { getNotesStats, getSetting, setSetting } from '@mylife/notes';
import { Card, Text, borderRadius, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.notes;

export default function NotesSettingsScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const stats = useMemo(() => getNotesStats(db), [db, tick]);
  const sortPreference = getSetting(db, 'home_sort') ?? 'updated';
  const previewPreference = getSetting(db, 'show_preview') ?? 'true';

  function save(key: string, value: string) {
    setSetting(db, key, value);
    setTick((current) => current + 1);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text variant="subheading">Library Snapshot</Text>
        <View style={styles.list}>
          <Text variant="body">Notes: {stats.totalNotes}</Text>
          <Text variant="body">Folders: {stats.totalFolders}</Text>
          <Text variant="body">Tags: {stats.totalTags}</Text>
          <Text variant="body">Words: {stats.totalWords}</Text>
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Home Sort</Text>
        <View style={styles.chipRow}>
          {['updated', 'created', 'title'].map((option) => {
            const selected = option === sortPreference;
            return (
              <Pressable
                key={option}
                style={[styles.chip, selected ? styles.chipActive : null]}
                onPress={() => save('home_sort', option)}
              >
                <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Preview Cards</Text>
        <View style={styles.chipRow}>
          {[
            { label: 'Show previews', value: 'true' },
            { label: 'Compact list', value: 'false' },
          ].map((option) => {
            const selected = option.value === previewPreference;
            return (
              <Pressable
                key={option.value}
                style={[styles.chip, selected ? styles.chipActive : null]}
                onPress={() => save('show_preview', option.value)}
              >
                <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  list: { gap: spacing.sm, marginTop: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceElevated,
  },
  chipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
});
