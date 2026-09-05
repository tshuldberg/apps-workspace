import { useState, useMemo, useRef, useEffect } from 'react';
import { View, Pressable, StyleSheet, ScrollView, TextInput } from 'react-native';
import { Text, colors, spacing } from '@mylife/ui';
import { getOrCreateDailyNote, getDailyNoteDates, updateNote, type Note } from '@mylife/notes';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.notes;

function getTodayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function offsetDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function DailyNoteScreen() {
  const db = useDatabase();
  const [currentDate, setCurrentDate] = useState(getTodayIso);
  const [body, setBody] = useState('');
  const [tick, setTick] = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const note = useMemo<Note | null>(() => {
    try {
      return getOrCreateDailyNote(db, currentDate);
    } catch {
      return null;
    }
  }, [db, currentDate, tick]);

  useEffect(() => {
    if (note) {
      setBody(note.body);
    } else {
      setBody('');
    }
  }, [note]);

  const dates = useMemo(() => {
    try {
      return getDailyNoteDates(db);
    } catch {
      return [];
    }
  }, [db, tick]);

  const isToday = currentDate === getTodayIso();

  function handleBodyChange(newBody: string) {
    setBody(newBody);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (!note) return;
      try {
        updateNote(db, note.id, { body: newBody });
        setTick((t) => t + 1);
      } catch {
        // silently fail for autosave
      }
    }, 500);
  }

  return (
    <View style={styles.container}>
      <View style={styles.navBar}>
        <Pressable onPress={() => setCurrentDate((d) => offsetDate(d, -1))} style={styles.arrowButton}>
          <Text variant="body" color={colors.text}>{'<'}</Text>
        </Pressable>
        <Pressable onPress={() => setCurrentDate(getTodayIso())} style={styles.dateContainer}>
          <Text variant="body" color={isToday ? ACCENT : colors.text} style={{ fontWeight: '600' }}>
            {currentDate}
          </Text>
          {isToday && (
            <View style={styles.todayBadge}>
              <Text variant="caption" color={ACCENT} style={{ fontSize: 11 }}>Today</Text>
            </View>
          )}
        </Pressable>
        <Pressable onPress={() => setCurrentDate((d) => offsetDate(d, 1))} style={styles.arrowButton}>
          <Text variant="body" color={colors.text}>{'>'}</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} keyboardShouldPersistTaps="handled">
        {note ? (
          <TextInput
            value={body}
            onChangeText={handleBodyChange}
            placeholder={`Write your daily note for ${currentDate}...`}
            placeholderTextColor={colors.textTertiary}
            multiline
            style={styles.editor}
            textAlignVertical="top"
          />
        ) : (
          <View style={styles.emptyState}>
            <Text variant="body" color={colors.textSecondary}>
              Could not load daily note.
            </Text>
          </View>
        )}

        {dates.length > 1 && (
          <View style={styles.datesSection}>
            <Text variant="caption" color={colors.textSecondary} style={{ fontWeight: '600', marginBottom: spacing.sm }}>
              Previous Daily Notes
            </Text>
            <View style={styles.datesRow}>
              {dates.filter((d) => d !== currentDate).slice(0, 14).map((d) => (
                <Pressable key={d} onPress={() => setCurrentDate(d)} style={styles.dateChip}>
                  <Text variant="caption" color={colors.textSecondary}>{d}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  arrowButton: { padding: spacing.xs, borderRadius: 8 },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    backgroundColor: colors.glass,
  },
  todayBadge: {
    marginLeft: spacing.xs,
    backgroundColor: `${colors.modules.notes}26`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  content: { flex: 1 },
  contentInner: { padding: spacing.md, gap: spacing.lg },
  editor: {
    minHeight: 300,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 15,
    lineHeight: 24,
    fontFamily: 'monospace',
  },
  emptyState: { paddingVertical: spacing.xxl, alignItems: 'center' },
  datesSection: { marginTop: spacing.sm },
  datesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  dateChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.glass,
  },
});
