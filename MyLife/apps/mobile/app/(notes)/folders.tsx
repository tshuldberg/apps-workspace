import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { createFolder, getFolders, getNotes, type NoteFolder } from '@mylife/notes';
import { Card, Text, borderRadius, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const ACCENT = colors.modules.notes;

export default function NotesFoldersScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const [name, setName] = useState('');
  const folders = useMemo(() => getFolders(db), [db, tick]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text variant="subheading">Folders</Text>
        <View style={styles.createRow}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="New folder name"
            placeholderTextColor={colors.textTertiary}
          />
          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              const trimmed = name.trim();
              if (!trimmed) {
                return;
              }
              createFolder(db, uuid(), { name: trimmed });
              setName('');
              setTick((value) => value + 1);
            }}
          >
            <Text variant="label" color={colors.background}>Add</Text>
          </Pressable>
        </View>
      </Card>

      {folders.length === 0 ? (
        <Card>
          <Text variant="body" color={colors.textSecondary}>
            Create folders to group your notes, clips, or research collections.
          </Text>
        </Card>
      ) : folders.map((folder) => (
        <FolderCard key={folder.id} folder={folder} db={db} />
      ))}
    </ScrollView>
  );
}

function FolderCard({ folder, db }: { folder: NoteFolder; db: ReturnType<typeof useDatabase> }) {
  const noteCount = getNotes(db, { folderId: folder.id, limit: 500 }).length;
  return (
    <Card>
      <View style={styles.folderRow}>
        <View>
          <Text variant="body">{folder.name}</Text>
          <Text variant="caption" color={colors.textSecondary}>
            {noteCount} note{noteCount === 1 ? '' : 's'}
          </Text>
        </View>
        <View style={styles.folderBadge}>
          <Text variant="caption" color={ACCENT}>Folder</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  createRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
  },
  primaryButton: {
    borderRadius: borderRadius.lg,
    backgroundColor: ACCENT,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  folderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  folderBadge: {
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: `${ACCENT}55`,
    backgroundColor: `${ACCENT}18`,
  },
});
