import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';
import { createDocument, getDocument, updateDocument, getProperties, type DocCategory, type FileType } from '@mylife/homes';

const ACCENT = colors.modules.homes;
const CATEGORIES: DocCategory[] = ['deed', 'warranty', 'insurance', 'permit', 'receipt', 'manual', 'contract', 'other'];
const FILE_TYPES: FileType[] = ['pdf', 'image', 'other'];

export default function AddDocumentScreen() {
  const { id, propertyId: paramPropId } = useLocalSearchParams<{ id?: string; propertyId?: string }>();
  const db = useDatabase();
  const router = useRouter();
  const isEdit = !!id;
  const properties = useMemo(() => getProperties(db), [db]);

  const [propId, setPropId] = useState(paramPropId ?? properties[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocCategory>('other');
  const [fileType, setFileType] = useState<FileType>('pdf');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');

  useEffect(() => {
    if (id) {
      const d = getDocument(db, id);
      if (d) {
        setPropId(d.propertyId); setTitle(d.title); setCategory(d.category);
        setFileType(d.fileType); setExpiryDate(d.expiryDate ?? '');
        setNotes(d.notes ?? ''); setTags(d.tags ?? '');
      }
    }
  }, [id, db]);

  const handleSave = () => {
    if (!title.trim()) { Alert.alert('Required', 'Title is required.'); return; }
    const data = {
      propertyId: propId, title: title.trim(), category, fileUri: 'local://placeholder',
      fileType, fileSizeBytes: 0, expiryDate: expiryDate.trim() || undefined,
      notes: notes.trim() || undefined, tags: tags.trim() || undefined,
    };
    if (isEdit && id) { updateDocument(db, id, data); }
    else { createDocument(db, uuid(), data); }
    router.back();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading">{isEdit ? 'Edit Document' : 'Add Document'}</Text>

      <View style={styles.placeholderNotice}>
        <Text variant="caption" color={ACCENT}>
          File picker coming soon. For now, documents are saved as metadata records.
        </Text>
      </View>

      <Text variant="label" color={colors.textSecondary}>Title *</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholderTextColor={colors.textTertiary} />

      <Text variant="label" color={colors.textSecondary}>Category</Text>
      <View style={styles.chipRow}>
        {CATEGORIES.map((c) => (
          <Pressable key={c} style={[styles.chip, category === c && styles.chipActive]} onPress={() => setCategory(c)}>
            <Text variant="label" color={category === c ? colors.background : colors.textSecondary} style={{ fontSize: 11 }}>{c}</Text>
          </Pressable>
        ))}
      </View>

      <Text variant="label" color={colors.textSecondary}>File Type</Text>
      <View style={styles.chipRow}>
        {FILE_TYPES.map((t) => (
          <Pressable key={t} style={[styles.chip, fileType === t && styles.chipActive]} onPress={() => setFileType(t)}>
            <Text variant="label" color={fileType === t ? colors.background : colors.textSecondary}>{t}</Text>
          </Pressable>
        ))}
      </View>

      <Text variant="label" color={colors.textSecondary}>Expiry Date</Text>
      <TextInput style={styles.input} value={expiryDate} onChangeText={setExpiryDate}
        placeholder="YYYY-MM-DD" placeholderTextColor={colors.textTertiary} />

      <Text variant="label" color={colors.textSecondary}>Tags (comma separated)</Text>
      <TextInput style={styles.input} value={tags} onChangeText={setTags} placeholderTextColor={colors.textTertiary} />

      <Text variant="label" color={colors.textSecondary}>Notes</Text>
      <TextInput style={[styles.input, { minHeight: 80 }]} value={notes} onChangeText={setNotes} multiline placeholderTextColor={colors.textTertiary} />

      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Text variant="label" color={colors.background}>{isEdit ? 'Save' : 'Add Document'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  input: { borderWidth: 1, borderColor: colors.glassBorder, borderRadius: 8, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, color: colors.text, backgroundColor: 'rgba(255,255,255,0.06)' },
  chipRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  chip: { backgroundColor: colors.glassStrong, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipActive: { backgroundColor: ACCENT },
  saveButton: { backgroundColor: ACCENT, borderRadius: 12, paddingVertical: spacing.sm, alignItems: 'center', marginTop: spacing.md },
  placeholderNotice: { backgroundColor: 'rgba(217,119,6,0.10)', borderRadius: 8, padding: spacing.sm },
});
