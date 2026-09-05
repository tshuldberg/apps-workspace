import { useCallback, useEffect, useMemo, useState } from 'react';
import { uuid } from '../../../lib/uuid';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getAccounts,
  getFilters,
  createFilter,
  deleteFilter,
  getFolders,
  getMessages,
  countMatches,
} from '@mylife/mail';
import type { MailFilter, MailFilterField, MailFilterAction } from '@mylife/mail';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';

const ACCENT = colors.modules.mail;

const FIELDS: { key: MailFilterField; label: string }[] = [
  { key: 'from', label: 'From' },
  { key: 'to', label: 'To' },
  { key: 'subject', label: 'Subject' },
  { key: 'body', label: 'Body' },
];

const ACTIONS: { key: MailFilterAction; label: string }[] = [
  { key: 'move', label: 'Move to folder' },
  { key: 'star', label: 'Star' },
  { key: 'mark_read', label: 'Mark as read' },
  { key: 'delete', label: 'Delete' },
];

export default function FilterEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const db = useDatabase();
  const router = useRouter();
  const isEditing = !!id;

  const accounts = useMemo(() => getAccounts(db), [db]);
  const [filterAccountId, setFilterAccountId] = useState(accounts[0]?.id ?? '');
  const folders = useMemo(() => {
    if (!filterAccountId) return [];
    return getFolders(db, filterAccountId);
  }, [db, filterAccountId]);

  const [name, setName] = useState('');
  const [field, setField] = useState<MailFilterField>('from');
  const [pattern, setPattern] = useState('');
  const [action, setAction] = useState<MailFilterAction>('move');
  const [actionValue, setActionValue] = useState('');
  const [priority, setPriority] = useState('10');
  const [testCount, setTestCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load existing filter -- search all accounts to find it
  useEffect(() => {
    if (!id) return;
    try {
      for (const a of accounts) {
        const all = getFilters(db, a.id);
        const existing = all.find((f) => f.id === id);
        if (existing) {
          setFilterAccountId(a.id);
          setName(existing.name);
          setField(existing.field);
          setPattern(existing.pattern);
          setAction(existing.action);
          setActionValue(existing.actionValue ?? '');
          setPriority(String(existing.priority));
          break;
        }
      }
    } catch { /* ignored */ }
  }, [db, id, accounts]);

  const handleTest = useCallback(() => {
    try {
      const messages = getMessages(db, { folder: 'Inbox', limit: 200 });
      const filter: Pick<MailFilter, 'field' | 'pattern' | 'action' | 'actionValue' | 'isActive' | 'priority'> = {
        field,
        pattern,
        action,
        actionValue: actionValue || null,
        isActive: true,
        priority: parseInt(priority, 10) || 10,
      };
      const count = countMatches(messages, filter as MailFilter);
      setTestCount(count);
    } catch { /* ignored */ }
  }, [db, field, pattern, action, actionValue, priority]);

  const handleSave = useCallback(() => {
    if (!name.trim()) { setError('Enter a filter name'); return; }
    if (!pattern.trim()) { setError('Enter a pattern'); return; }
    setError(null);

    try {
      if (isEditing && id) {
        // Delete and recreate (no update function for filters)
        deleteFilter(db, id);
      }
      const newId = isEditing && id ? id : `filter_${uuid()}`;
      createFilter(db, newId, {
        accountId: filterAccountId,
        name: name.trim(),
        field,
        pattern: pattern.trim(),
        action,
        actionValue: action === 'move' ? actionValue : undefined,
        priority: parseInt(priority, 10) || 10,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save filter');
    }
  }, [db, id, isEditing, filterAccountId, name, field, pattern, action, actionValue, priority, router]);

  const handleDeleteFilter = useCallback(() => {
    if (!id) return;
    Alert.alert('Delete Filter', 'Remove this filter?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => { deleteFilter(db, id); router.back(); },
      },
    ]);
  }, [db, id, router]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text variant="body" color={ACCENT}>Cancel</Text>
        </Pressable>
        <Pressable onPress={handleSave}>
          <Text variant="body" color={ACCENT}>Save</Text>
        </Pressable>
      </View>

      {/* Name */}
      <TextInput
        style={styles.input}
        placeholder='Filter name (e.g., "Newsletter filter")'
        placeholderTextColor={colors.textTertiary}
        value={name}
        onChangeText={setName}
        autoFocus
      />

      {/* Condition */}
      <Text variant="label" color={colors.textTertiary} style={styles.sectionLabel}>Condition</Text>
      <View style={styles.pickerRow}>
        {FIELDS.map((f) => (
          <Pressable
            key={f.key}
            style={[styles.pickerChip, field === f.key && styles.pickerChipActive]}
            onPress={() => setField(f.key)}
          >
            <Text variant="caption" color={field === f.key ? ACCENT : colors.textSecondary}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.input}
        placeholder={`Pattern (e.g., "newsletter@")`}
        placeholderTextColor={colors.textTertiary}
        value={pattern}
        onChangeText={setPattern}
      />
      <Text variant="body" color={colors.textSecondary}>
        When <Text variant="body" color={ACCENT}>{FIELDS.find((f) => f.key === field)?.label}</Text>{' '}
        contains '<Text variant="body" color={colors.text}>{pattern || '...'}</Text>'
      </Text>

      {/* Action */}
      <Text variant="label" color={colors.textTertiary} style={styles.sectionLabel}>Action</Text>
      <View style={styles.pickerRow}>
        {ACTIONS.map((a) => (
          <Pressable
            key={a.key}
            style={[styles.pickerChip, action === a.key && styles.pickerChipActive]}
            onPress={() => setAction(a.key)}
          >
            <Text variant="caption" color={action === a.key ? ACCENT : colors.textSecondary}>
              {a.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {action === 'move' && (
        <View style={styles.folderPicker}>
          {folders.map((f) => (
            <Pressable
              key={f.id}
              style={[styles.pickerChip, actionValue === f.name && styles.pickerChipActive]}
              onPress={() => setActionValue(f.name)}
            >
              <Text variant="caption" color={actionValue === f.name ? ACCENT : colors.textSecondary}>
                {f.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Priority */}
      <Text variant="label" color={colors.textTertiary} style={styles.sectionLabel}>Priority</Text>
      <TextInput
        style={styles.input}
        placeholder="Priority (lower = higher)"
        placeholderTextColor={colors.textTertiary}
        value={priority}
        onChangeText={setPriority}
        keyboardType="number-pad"
      />
      <Text variant="caption" color={colors.textTertiary}>
        Filters run in priority order. First match wins.
      </Text>

      {/* Test */}
      <Pressable style={styles.testBtn} onPress={handleTest}>
        <Text variant="caption" color={ACCENT}>Test against inbox</Text>
      </Pressable>
      {testCount !== null && (
        <Text variant="body" color={colors.text}>
          Would match {testCount} message{testCount !== 1 ? 's' : ''}
        </Text>
      )}

      {error && <Text variant="caption" color={colors.danger}>{error}</Text>}

      {/* Delete (edit mode) */}
      {isEditing && (
        <Pressable style={styles.deleteBtn} onPress={handleDeleteFilter}>
          <Text variant="body" color={colors.danger}>Delete Filter</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
  },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, padding: spacing.sm, color: colors.text,
    fontFamily: 'Inter', fontSize: 16,
  },
  sectionLabel: { marginTop: spacing.sm },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pickerChip: {
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pickerChipActive: { borderColor: ACCENT, backgroundColor: 'rgba(59,130,246,0.1)' },
  folderPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  testBtn: {
    paddingVertical: spacing.sm, borderRadius: 8, alignItems: 'center',
    borderWidth: 1, borderColor: ACCENT,
  },
  deleteBtn: {
    paddingVertical: spacing.sm, alignItems: 'center', marginTop: spacing.lg,
  },
});
