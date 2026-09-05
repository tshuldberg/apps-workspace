import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, Card, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { getDocument, deleteDocument } from '@mylife/homes';

const ACCENT = colors.modules.homes;

export default function DocumentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDatabase();
  const router = useRouter();
  const doc = useMemo(() => id ? getDocument(db, id) : null, [db, id]);

  if (!doc) return <View style={styles.center}><Text variant="body" color={colors.textSecondary}>Not found</Text></View>;

  const handleDelete = () => {
    Alert.alert('Delete Document', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteDocument(db, doc.id); router.back(); } },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading">{doc.title}</Text>
      <Card>
        <FactRow label="Category" value={doc.category} />
        <FactRow label="File Type" value={doc.fileType.toUpperCase()} />
        <FactRow label="Size" value={`${Math.round(doc.fileSizeBytes / 1024)} KB`} />
        {doc.expiryDate && <FactRow label="Expires" value={doc.expiryDate.slice(0, 10)} />}
        {doc.tags && <FactRow label="Tags" value={doc.tags} />}
        {doc.notes && <FactRow label="Notes" value={doc.notes} />}
      </Card>
      <View style={styles.actions}>
        <Pressable style={styles.editButton} onPress={() => router.push(`/(homes)/document/add?id=${id}`)}>
          <Text variant="label" color={ACCENT}>Edit</Text>
        </Pressable>
        <Pressable style={styles.deleteButton} onPress={handleDelete}>
          <Text variant="label" color={colors.danger}>Delete</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.factRow}>
      <Text variant="caption" color={colors.textSecondary} style={{ width: 100 }}>{label}</Text>
      <Text variant="body" style={{ flex: 1 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  factRow: { flexDirection: 'row', paddingVertical: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm },
  editButton: { flex: 1, borderWidth: 1, borderColor: ACCENT, borderRadius: 8, paddingVertical: spacing.sm, alignItems: 'center' },
  deleteButton: { flex: 1, borderWidth: 1, borderColor: colors.danger, borderRadius: 8, paddingVertical: spacing.sm, alignItems: 'center' },
});
